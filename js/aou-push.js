/* ============================================================
   allofus.one · phone + desktop push notifications (v21, Oct 19 2026)
   How it works on this stack (static site + Supabase, no app store):
   1. The service worker (sw.js) listens for `push` and shows the notification; tapping it opens the right page.
   2. This module subscribes the browser (Web Push + VAPID) and stores the subscription in `push_subscriptions`.
   3. The database writes a row into `notifications` for every tag, comment, reaction, request, hug and DM
      (triggers in supabase/allofus-ALL-v20-v21.sql, honoring the member's switches in profiles.home.notif).
   4. A sender delivers unsent rows to every subscription of that member: the GitHub Action in _push/push-notifications.workflow.yml
      (copy it to .github/workflows/) runs _push/send.mjs every 10 minutes (needs the three repo secrets named in SETUP.md). Swap it for a Supabase
      Edge Function + database webhook when you want delivery within seconds.
   Works on Android (Chrome, Samsung, Firefox), Windows and Mac browsers. iPhone and iPad: iOS 16.4 or newer,
   only after the site is added to the Home Screen (Share → Add to Home Screen), then turn it on from the app.
   ============================================================ */
import { CONFIG } from './aou-config.js';
const b64ToU8 = (s) => { const pad = '='.repeat((4 - s.length % 4) % 4); const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
/* what this device can do right now */
export function pushState() {
  const key = CONFIG.VAPID_PUBLIC_KEY || '';
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!key) return { ok: false, why: 'not-configured', msg: 'Push is not switched on for this site yet.' };
  if (isIOS() && !standalone()) return { ok: false, why: 'ios-home', msg: 'On iPhone and iPad: tap Share, then “Add to Home Screen”, open allofus.one from there and turn this on.' };
  if (!has) return { ok: false, why: 'unsupported', msg: 'This browser cannot receive push notifications. Chrome, Edge, Firefox, Samsung Internet and Safari 16.4+ can.' };
  if (Notification.permission === 'denied') return { ok: false, why: 'denied', msg: 'Notifications are blocked for allofus.one in your browser settings. Allow them there, then try again.' };
  return { ok: true, why: Notification.permission === 'granted' ? 'granted' : 'ask', msg: '' };
}
const reg = async () => { try { return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js')); } catch (e) { return null; } };
/* is this browser subscribed (and saved for this member)? */
export async function pushSubscribed() { try { const r = await reg(); if (!r) return false; const s = await r.pushManager.getSubscription(); return !!s; } catch (e) { return false; } }
/* turn on: ask permission, subscribe, save. Returns { ok, msg } */
export async function pushOn(sb, me) {
  const st = pushState(); if (!st.ok) return { ok: false, msg: st.msg };
  if (!sb || !me) return { ok: false, msg: 'Sign in first.' };
  try {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, msg: 'Notifications stay off until you allow them.' };
    const r = await reg(); if (!r) return { ok: false, msg: 'The service worker could not start. Reload and try again.' };
    await navigator.serviceWorker.ready;
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CONFIG.VAPID_PUBLIC_KEY) });
    const j = sub.toJSON(); const row = { user_id: me.id, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 160) };
    const { error } = await sb.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) { if (/relation|schema cache/i.test(error.message)) return { ok: false, msg: 'The server is not ready for push yet (run supabase/allofus-ALL-v20-v21.sql).' }; return { ok: false, msg: error.message }; }
    try { localStorage.setItem('aou_push', '1'); } catch (e) { }
    try { await r.showNotification('allofus.one notifications are on', { body: 'Tags, comments, reactions, requests and messages reach this device now.', icon: '/images/favicon-192.png', badge: '/images/social/allofus-icon-128.png', tag: 'aou-hello', data: { url: '/?v=notif' } }); } catch (e) { }
    return { ok: true, msg: 'Notifications are on for this device.' };
  } catch (e) { return { ok: false, msg: e.message || 'Could not turn notifications on.' }; }
}
/* turn off on this device (keeps other devices) */
export async function pushOff(sb, me) {
  try { const r = await reg(); const sub = r && await r.pushManager.getSubscription(); if (sub) { try { if (sb && me) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch (e) { } await sub.unsubscribe(); } } catch (e) { }
  try { localStorage.setItem('aou_push', '0'); } catch (e) { }
  return { ok: true, msg: 'Notifications are off on this device.' };
}
/* the one-time opt-in card on the feed (dismissable; asked again after 14 days if skipped) */
export function pushPromptHTML(me) {
  if (!me) return ''; const st = pushState(); if (!st.ok || st.why === 'granted') return '';
  try { const skip = +(localStorage.getItem('aou_push_skip') || 0); if (Date.now() - skip < 14 * 864e5) return ''; if (localStorage.getItem('aou_push') === '1') return ''; } catch (e) { }
  return `<div class="fl-card push-ask" id="push-ask"><div class="pa-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg></div><div class="pa-t"><b>Get a ping on this device</b><span>When someone tags you, comments, reacts, hugs you, messages you or asks to connect. You pick which under Control panel → Notifications.</span></div><div class="pa-b"><button class="fl-btn p sm" data-push-on>Turn on</button><button class="fl-btn sm" data-push-skip>Not now</button></div></div>`;
}
export function wirePushPrompt(root, { sb, me, toast }) {
  const c = root.querySelector('#push-ask'); if (!c) return;
  c.querySelector('[data-push-on]').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Turning on…'; const r = await pushOn(sb, me); toast(r.msg); if (r.ok) c.remove(); else { e.target.disabled = false; e.target.textContent = 'Turn on'; } };
  c.querySelector('[data-push-skip]').onclick = () => { try { localStorage.setItem('aou_push_skip', String(Date.now())); } catch (e) { } c.remove(); };
}
export const PUSH_CSS = `.push-ask{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-color:#bae6fd;background:linear-gradient(135deg,#f0f9ff,#fff)}.push-ask .pa-ic{width:44px;height:44px;border-radius:14px;background:#0369a1;color:#fff;display:grid;place-items:center;flex:none}.push-ask .pa-t{flex:1;min-width:200px}.push-ask .pa-t b{display:block;font-size:14px}.push-ask .pa-t span{display:block;font:500 12.5px/1.4 var(--ff);color:#475569;margin-top:2px}.push-ask .pa-b{display:flex;gap:6px}
.push-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-top:8px}.push-row .sw{position:relative;width:46px;height:26px;flex:none}.push-row .sw input{opacity:0;width:0;height:0;position:absolute}.push-row .sw i{position:absolute;inset:0;border-radius:26px;background:#cbd5e1;transition:.2s;cursor:pointer}.push-row .sw i::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.25)}.push-row .sw input:checked+i{background:#16a34a}.push-row .sw input:checked+i::after{transform:translateX(20px)}.push-row .sw input:focus-visible+i{outline:3px solid #93c5fd}.push-row b{font-size:13.5px}.push-row small{display:block;color:#475569;font-size:12px;margin-top:2px}.push-row .t{flex:1;min-width:160px}`;
/* the switch in Control panel → Notifications */
export async function pushSettingHTML() {
  const st = pushState(); const on = st.ok && st.why === 'granted' && await pushSubscribed();
  const line = !st.ok ? st.msg : on ? 'On for this device. Other devices turn it on from their own Control panel.' : 'Off on this device. Flip it on and allow notifications when the browser asks.';
  return `<div class="push-row"><label class="sw"><input type="checkbox" id="s-push-sw" ${on ? 'checked' : ''} ${st.ok ? '' : 'disabled'} aria-label="Phone and desktop push notifications"><i></i></label><div class="t"><b>Phone + desktop push notifications</b><small id="s-push-line">${line}</small></div><button class="fl-btn sm" id="s-push-test" ${on ? '' : 'hidden'}>Send me a test</button></div>`;
}
export function wirePushSetting(root, { sb, me, toast }) {
  const sw = root.querySelector('#s-push-sw'), line = root.querySelector('#s-push-line'), test = root.querySelector('#s-push-test'); if (!sw) return;
  sw.onchange = async () => { sw.disabled = true; const r = sw.checked ? await pushOn(sb, me) : await pushOff(sb, me); sw.disabled = false; if (!r.ok) sw.checked = false; line.textContent = r.msg; if (test) test.hidden = !sw.checked; toast(r.msg); };
  if (test) test.onclick = async () => { try { const r = await reg(); await r.showNotification('Test from allofus.one', { body: 'This is what a notification looks like here. Tap it to open your Alerts.', icon: '/images/favicon-192.png', badge: '/images/social/allofus-icon-128.png', tag: 'aou-test', data: { url: '/?v=notif' } }); toast('Sent. Look at your notification tray.'); } catch (e) { toast('Could not show a test notification here.'); } };
}
/* live in-app toasts from the notifications table (one channel, every kind) */
export function watchNotifications(sb, me, onRow) {
  if (!sb || !me || !sb.channel) return null;
  try { const ch = sb.channel('notif-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + me.id }, (p) => { if (p.new) onRow(p.new); }).subscribe(); return ch; } catch (e) { return null; }
}

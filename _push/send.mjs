/* allofus.one · push sender (runs in GitHub Actions every 10 minutes, or anywhere Node 20+ runs)
   Reads unsent rows from `notifications`, sends one Web Push per device in `push_subscriptions`, marks them sent.
   Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (never in the repo, never in the browser), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
   Install once: npm i web-push   (the workflow does this). */
import webpush from 'web-push';
const URL0 = process.env.SUPABASE_URL || 'https://izfccjaznlcffvjxawya.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, PUB = process.env.VAPID_PUBLIC_KEY, PRV = process.env.VAPID_PRIVATE_KEY;
if (!KEY || !PUB || !PRV) { console.log('push: secrets missing (SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Nothing sent.'); process.exit(0); }
webpush.setVapidDetails('mailto:info@eyetoad.com', PUB, PRV);
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const rest = async (path, init = {}) => { const r = await fetch(URL0 + '/rest/v1/' + path, Object.assign({ headers: H }, init)); if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + (await r.text()).slice(0, 200)); return r.status === 204 ? null : r.json(); };
const since = new Date(Date.now() - 36e5 * 12).toISOString(); // rows older than 12 h are stale: mark sent, skip
const rows = await rest(`notifications?select=id,user_id,kind,title,body,url,created_at&sent_at=is.null&order=created_at.asc&limit=300`);
if (!rows.length) { console.log('push: nothing to send'); process.exit(0); }
const stale = rows.filter(r => r.created_at < since).map(r => r.id); const fresh = rows.filter(r => r.created_at >= since);
if (stale.length) await rest(`notifications?id=in.(${stale.join(',')})`, { method: 'PATCH', body: JSON.stringify({ sent_at: new Date().toISOString() }) });
const users = [...new Set(fresh.map(r => r.user_id))];
const subs = users.length ? await rest(`push_subscriptions?select=id,user_id,endpoint,p256dh,auth,fails&user_id=in.(${users.join(',')})`) : [];
const byUser = {}; subs.forEach(s => (byUser[s.user_id] = byUser[s.user_id] || []).push(s));
let sent = 0, gone = 0, failed = 0;
for (const n of fresh) {
  const list = byUser[n.user_id] || [];
  const payload = JSON.stringify({ title: n.title, body: n.body || '', url: n.url || '/?v=notif', tag: 'aou-' + n.kind + '-' + n.id, kind: n.kind });
  for (const s of list) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'normal' }); sent++; await rest(`push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ last_ok: new Date().toISOString(), fails: 0 }) }); }
    catch (e) { const code = e.statusCode || 0; if (code === 404 || code === 410) { gone++; await rest(`push_subscriptions?id=eq.${s.id}`, { method: 'DELETE' }); } else { failed++; await rest(`push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ fails: (s.fails || 0) + 1 }) }); console.log('push fail', code, String(e.body || e.message).slice(0, 120)); } }
  }
}
await rest(`notifications?id=in.(${fresh.map(r => r.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ sent_at: new Date().toISOString() }) });
console.log(`push: ${fresh.length} notification(s) for ${users.length} member(s) · ${sent} sent · ${gone} dead subscriptions removed · ${failed} failed · ${stale.length} stale skipped`);

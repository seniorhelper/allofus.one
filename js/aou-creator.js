/* allofus.one · CREATOR TIPS + SOCIAL FEEDS + CONNECTED TOOLS (v28, Oct 24 2026) · behind CONFIG.CREATOR_TOOLS
   Zach's model ("Creator Payouts & Tip Model v1"): creators keep 100%. allofus never touches creator money:
   a creator links their own payment handles and a Tip tap opens that app. Tipping allofus is a separate line that
   starts at $0, is never pre-picked, and unlocks nothing. Server side: supabase/_parts/v28-creator.sql.
   1. mountProfile(body, prof, F3)   payout card + tip sheet + "From my channels" on /?u=<name>
   2. creatorView(body, F3)          /?v=creator · creator setup: terms, handles (48 h wait on changes), feeds, stats, admin queue
   3. supportView(body, F3)          /?v=support · optional tip to allofus (card via Authorize.net Accept Hosted, Venmo Business, PayPal)
   4. mountGrowTools(host, F3)       Grow your business → Connected tools per Brand page (AI Speed to Leads, CommercePlugs, webhooks)
   Embeds load only when tapped (no third-party requests until the viewer asks). Outbound links are rel="noopener". */
import { CONFIG } from './aou-config.js';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const toastOf = (F3) => (m) => (F3 && F3.toast ? F3.toast(m) : alert(m));
export const TERMS_VERSION = 'creator-v2-2026-11-07';

/* the switch: CONFIG.CREATOR_TOOLS (site-wide), or admins, or a QA device with localStorage aou_ff_creator = '1'.
   The database has its own flag (creator_tools) and answers empty until it is on, so both must be on for members. */
export function flagOn(F3) { const me = F3 && F3.getMe && F3.getMe(); return CONFIG.CREATOR_TOOLS === true || lsGet('aou_ff_creator', '') === '1' || !!(me && me.isAdmin); }

export const APPS = {
  venmo: { name: 'Venmo', color: '#008cff', hint: '@your-name (use a Venmo Business profile)' },
  paypal: { name: 'PayPal', color: '#003087', hint: 'your paypal.me name' },
  cashapp: { name: 'Cash App', color: '#00c244', hint: '$cashtag' },
  kofi: { name: 'Ko-fi', color: '#ff5e5b', hint: 'ko-fi.com/your-name' },
  bmac: { name: 'Buy Me a Coffee', color: '#c08a00', hint: 'buymeacoffee.com/your-name' },
  stripe: { name: 'Card (Stripe link)', color: '#635bff', hint: 'https://buy.stripe.com/…' },
  square: { name: 'Card (Square link)', color: '#111827', hint: 'https://square.link/u/…' },
};
const BIZ_HELP = { venmo: 'https://help.venmo.com/hc/en-us/articles/360043574634' };   // HEAD-checked 200 on 2026-10-24
const PLATFORM_AMOUNTS = [0, 200, 500, 1000];

const CSS = `
.cr-card{border:1px solid #e5e7eb;border-radius:16px;background:#fff;padding:14px;margin-bottom:12px;font-family:Poppins,Arial,sans-serif}
.cr-card h3{margin:0 0 4px;font-size:16px;color:#0b1a3a}.cr-card p{margin:0 0 8px;color:#475569;font-size:13px;line-height:1.45}
.cr-100{display:inline-block;background:#ecfdf5;color:#047857;font:800 11px Poppins,Arial;border-radius:999px;padding:3px 9px;margin-bottom:6px}
.cr-apps{display:flex;flex-wrap:wrap;gap:6px}.cr-app{border:1.5px solid var(--c);color:var(--c);background:#fff;border-radius:999px;padding:7px 12px;font:700 13px Poppins,Arial;cursor:pointer}
.cr-app:hover,.cr-app:focus-visible{background:var(--c);color:#fff}.cr-ok{font-size:11px;margin-left:4px}
.cr-sheet{position:fixed;inset:0;background:rgba(10,15,40,.5);z-index:1250;display:flex;align-items:flex-end;justify-content:center}
.cr-sheet>div{background:#fff;border-radius:20px 20px 0 0;max-width:460px;width:100%;padding:18px 18px 22px;font-family:Poppins,Arial,sans-serif;max-height:92vh;overflow:auto}
@media(min-width:700px){.cr-sheet{align-items:center}.cr-sheet>div{border-radius:20px}}
.cr-sheet h3{margin:0 0 6px;color:#0b1a3a}.cr-go{display:block;text-align:center;background:var(--c,#2563eb);color:#fff!important;text-decoration:none;border-radius:14px;padding:12px;font:800 15px Poppins,Arial;margin:10px 0}
.cr-plat{border-top:1px dashed #cbd5e1;margin-top:12px;padding-top:10px}.cr-plat small{display:block;color:#64748b;font-size:12px;margin-bottom:6px}
.cr-amts{display:flex;gap:6px;flex-wrap:wrap}.cr-amts label{border:1.5px solid #cbd5e1;border-radius:10px;padding:6px 10px;font:700 13px Poppins,Arial;cursor:pointer}
.cr-amts input{position:absolute;opacity:0;pointer-events:none}.cr-amts label:has(input:checked){border-color:#0b1a3a;background:#0b1a3a;color:#fff}
.cr-amts label:has(input:focus-visible){outline:2px solid #2563eb;outline-offset:2px}
.cr-x{float:right;border:0;background:none;font-size:22px;cursor:pointer;color:#64748b}.cr-rep{border:0;background:none;color:#64748b;font-size:12px;text-decoration:underline;cursor:pointer;padding:0}
.cr-feed{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.cr-it{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f8fafc;font-size:12px}
.cr-it button.cr-play{display:block;width:100%;aspect-ratio:16/10;border:0;background:#0b1a3a center/cover no-repeat;color:#fff;font:800 13px Poppins,Arial;cursor:pointer;position:relative}
.cr-it button.cr-play span{background:rgba(0,0,0,.55);border-radius:999px;padding:5px 10px}
.cr-it iframe{width:100%;aspect-ratio:9/12;border:0;display:block;background:#000}.cr-it iframe.wide{aspect-ratio:16/9}.cr-it iframe.short{aspect-ratio:auto;height:152px}
.cr-it .t{padding:6px 8px;display:flex;justify-content:space-between;gap:6px;align-items:flex-start}.cr-it .t a{color:#0b1a3a;font-weight:700;text-decoration:none;overflow-wrap:anywhere}
.cr-it audio{width:100%}
.cr-f{display:grid;gap:8px}.cr-f label{display:grid;gap:3px;font:600 13px Poppins,Arial;color:#334155}
.cr-f input[type=text],.cr-f input[type=url],.cr-f select{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px;font:14px Poppins,Arial;width:100%;box-sizing:border-box}
.cr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.cr-h{border:1px solid #e5e7eb;border-radius:12px;padding:10px;display:grid;gap:6px}
.cr-tag{display:inline-block;border-radius:999px;padding:2px 8px;font:700 11px Poppins,Arial;background:#f1f5f9;color:#334155}.cr-tag.ok{background:#ecfdf5;color:#047857}.cr-tag.wait{background:#fef3c7;color:#92400e}
.cr-note{font-size:12px;color:#64748b}.cr-warn{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px;font-size:13px;color:#7c2d12}
.cr-wrap{max-width:820px;margin:0 auto;padding:12px}
.cr-stat{display:flex;gap:10px;flex-wrap:wrap}.cr-stat div{border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px;min-width:110px}.cr-stat b{display:block;font-size:20px;color:#0b1a3a}
`;
function injectCSS() { if (document.getElementById('aou-creator-css')) return; const s = document.createElement('style'); s.id = 'aou-creator-css'; s.textContent = CSS; document.head.appendChild(s); }
const vh = () => { let v = lsGet('aou_vh', ''); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem('aou_vh', v); } catch (e) { } } return v; };
const safeHttps = (u) => /^https:\/\/[^\s"'<>]+$/i.test(String(u || ''));

/* ---------- embeds (official players only, built from ids the server validated) ---------- */
function embedSrc(it) {
  const id = String(it.ext_id || '');
  switch (it.provider) {
    case 'youtube': return /^[A-Za-z0-9_-]{11}$/.test(id) ? ['https://www.youtube-nocookie.com/embed/' + id + '?rel=0', 'wide'] : null;
    case 'vimeo': return /^\d{5,12}$/.test(id) ? ['https://player.vimeo.com/video/' + id + '?dnt=1', 'wide'] : null;
    case 'tiktok': return /^\d{8,25}$/.test(id) ? ['https://www.tiktok.com/embed/v2/' + id, ''] : null;
    case 'instagram': return /^(p|reel)\/[A-Za-z0-9_-]{5,40}$/.test(id) ? ['https://www.instagram.com/' + id + '/embed', ''] : null;
    case 'spotify': return /^(episode|track|show|album|playlist)\/[A-Za-z0-9]{22}$/.test(id) ? ['https://open.spotify.com/embed/' + id, 'short'] : null;
    case 'soundcloud': return /^[A-Za-z0-9_-]{2,60}\/[A-Za-z0-9_-]{2,120}$/.test(id) ? ['https://w.soundcloud.com/player/?url=' + encodeURIComponent('https://soundcloud.com/' + id), 'short'] : null;
    default: return null;
  }
}
const PROV = { youtube: 'YouTube', vimeo: 'Vimeo', tiktok: 'TikTok', instagram: 'Instagram', spotify: 'Spotify', soundcloud: 'SoundCloud', x: 'X', podcast: 'Podcast', blog: 'Blog' };
function itemHTML(it, opts = {}) {
  const thumb = safeHttps(it.thumb) ? it.thumb : (it.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(it.ext_id || '') ? 'https://i.ytimg.com/vi/' + it.ext_id + '/hqdefault.jpg' : '');
  const src = embedSrc(it); const title = it.title || PROV[it.provider] || 'Post';
  const link = safeHttps(it.link) ? it.link : '#';
  const media = it.provider === 'podcast' && safeHttps(it.media_url) ? `<audio controls preload="none" src="${esc(it.media_url)}"></audio>`
    : src ? `<button type="button" class="cr-play" data-src="${esc(src[0])}" data-cls="${src[1]}" aria-label="Play ${esc(title)} (loads ${esc(PROV[it.provider])})" ${thumb ? `style="background-image:url('${esc(thumb)}')"` : ''}><span>▶ ${esc(PROV[it.provider])}</span></button>`
    : thumb ? `<a href="${esc(link)}" target="_blank" rel="noopener"><img src="${esc(thumb)}" alt="" loading="lazy" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block"></a>` : '';
  return `<div class="cr-it" data-id="${esc(it.id)}">${media}<div class="t"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(title.slice(0, 90))}</a>${opts.owner ? `<button type="button" class="cr-rep" data-rm="${esc(it.id)}" aria-label="Remove">✕</button>` : `<button type="button" class="cr-rep" data-repitem="${esc(it.id)}" title="Report this">Report</button>`}</div></div>`;
}
function wireEmbeds(root) {
  $$('.cr-play', root).forEach(b => b.onclick = () => {
    const f = document.createElement('iframe'); f.src = b.dataset.src; f.className = b.dataset.cls || ''; f.loading = 'lazy';
    f.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen'); f.setAttribute('allowfullscreen', '');
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation'); f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.title = b.getAttribute('aria-label') || 'Embedded post'; b.replaceWith(f);
  });
}

/* ---------- reporting (uses the v26 reports table; the v28 trigger holds the item for review) ---------- */
const REPORT_CATS = [['scam', 'Scam or fake payment handle'], ['harassment', 'Harassment'], ['sexual', 'Sexual content'], ['illegal', 'Illegal'], ['child_safety', 'Child safety (urgent)'], ['other', 'Something else']];
async function report(F3, kind, id, reported) {
  const me = F3.getMe && F3.getMe(); const toast = toastOf(F3);
  if (!me) { toast('Please sign in to report.'); return; }
  const wrap = document.createElement('div'); wrap.className = 'cr-sheet'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Report');
  wrap.innerHTML = `<div><button class="cr-x" type="button" aria-label="Close">×</button><h3>Report</h3><div class="cr-f"><label>What is wrong?<select data-cat>${REPORT_CATS.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label><label>Details (optional)<input type="text" data-det maxlength="400"></label><button class="fl-btn p" type="button" data-send>Send report</button></div></div>`;
  document.body.appendChild(wrap); const close = () => wrap.remove();
  $('.cr-x', wrap).onclick = close; wrap.onclick = (e) => { if (e.target === wrap) close(); };
  $('[data-send]', wrap).onclick = async () => {
    const { error } = await F3.sb.from('reports').insert({ reporter: me.id, reported: reported || null, target_kind: kind, target_id: String(id), category: $('[data-cat]', wrap).value, details: $('[data-det]', wrap).value.slice(0, 400), reason: kind });
    close(); toast(error ? (/duplicate|unique/i.test(error.message) ? 'You already reported this. Thank you.' : 'Could not send. Please try again.') : 'Thank you. A person will review it.');
  };
}

/* ---------- 1. profile: payout card + tip sheet + feed ---------- */
export async function mountProfile(body, prof, F3) {
  if (!flagOn(F3) || !prof || !prof.id || !F3.sb) return;
  injectCSS();
  const me = F3.getMe && F3.getMe(); const mine = !!(me && me.id === prof.id);
  const aside = $('.fl3 > aside', body); if (!aside) return;
  const [cardR, feedR] = await Promise.all([F3.sb.rpc('creator_card', { p_user: prof.id }).then(r => r, () => ({})), F3.sb.rpc('creator_feed', { p_user: prof.id, p_limit: 12 }).then(r => r, () => ({}))]);
  if (!body.isConnected) return;
  const card = cardR && cardR.data; const items = (feedR && Array.isArray(feedR.data)) ? feedR.data : [];
  const name = prof.name || prof.username || 'this creator';
  const host = document.createElement('div'); host.id = 'cr-slot';
  if (card && card.handles && card.handles.length) {
    host.innerHTML = `<div class="cr-card" aria-label="Tip ${esc(name)}"><span class="cr-100">100% goes to ${esc(name)}</span><h3>💸 Tip ${esc(name)}</h3>${card.headline ? `<p>${esc(card.headline)}</p>` : ''}<p class="cr-note" style="margin:0 0 8px">Your money goes straight to them in the app you pick. allofus never touches it.</p>
      <div class="cr-apps">${card.handles.map(h => { const a = APPS[h.kind] || { name: h.kind, color: '#334155' }; return `<button type="button" class="cr-app" style="--c:${a.color}" data-tip="${esc(h.kind)}">${esc(a.name)}${h.verified ? '<span class="cr-ok" title="Handle checked by allofus">✓</span>' : ''}</button>`; }).join('')}</div>
      <p style="margin:8px 0 0">${mine ? '<a class="cr-note" href="/?v=creator">Edit my tip handles</a>' : `<button type="button" class="cr-rep" data-repcreator>Report this creator</button>`}</p></div>`;
  } else if (mine) {
    host.innerHTML = `<div class="cr-card"><h3>💸 Get tips. You keep 100%.</h3><p>Join Creators Corner to add a Tip button that opens your own Venmo, PayPal or Cash App. Money goes straight to you. allofus never touches it.</p><a class="fl-btn p sm" href="/creators/">Creators Corner</a></div>`;
  }
  if (items.length || (mine && card)) {
    const f = document.createElement('div'); f.className = 'cr-card'; f.id = 'cr-feed';
    f.innerHTML = `<h3>📺 From ${mine ? 'my' : esc(name.split(' ')[0]) + '’s'} channels</h3>${items.length ? `<div class="cr-feed">${items.map(it => itemHTML(it)).join('')}</div><p class="cr-note" style="margin:6px 0 0">Videos load from their own site only when you tap play.</p>` : `<p>Show your YouTube, TikTok or Instagram posts here. <a href="/?v=creator#feeds">Add a post</a></p>`}`;
    host.appendChild(f);
  }
  if (!host.innerHTML) return;
  aside.prepend(host); wireEmbeds(host);
  $$('[data-tip]', host).forEach(b => b.onclick = () => tipSheet(F3, prof, card, b.dataset.tip));
  const rc = $('[data-repcreator]', host); if (rc) rc.onclick = () => report(F3, 'creator', prof.id, prof.id);
  $$('[data-repitem]', host).forEach(b => b.onclick = () => report(F3, 'feed_item', b.dataset.repitem, prof.id));
}

function platformTipHTML(prefix) {
  return `<div class="cr-plat"><b style="font-size:14px;color:#0b1a3a">Also support allofus? <span style="font-weight:500;color:#64748b">(optional)</span></b>
  <small>This tip goes to allofus.one, not the creator. It keeps allofus free, private and ad-light. $0 is always fine.</small>
  <div class="cr-amts" role="radiogroup" aria-label="Optional tip to allofus">${PLATFORM_AMOUNTS.map(c => `<label><input type="radio" name="${prefix}-amt" value="${c}" ${c === 0 ? 'checked' : ''}>${c ? '$' + c / 100 : '$0'}</label>`).join('')}<label><input type="radio" name="${prefix}-amt" value="other">Other</label></div>
  <div data-other hidden style="margin-top:6px"><label class="cr-note">Amount in dollars (1 to 500) <input type="number" min="1" max="500" step="1" data-otheramt style="width:90px;border:1.5px solid #cbd5e1;border-radius:8px;padding:5px"></label></div>
  <div data-pmethods hidden style="margin-top:8px"></div></div>`;
}
function wirePlatformTip(root, F3, prefix, context) {
  const methods = $('[data-pmethods]', root); const other = $('[data-other]', root);
  const amount = () => { const v = ($(`input[name="${prefix}-amt"]:checked`, root) || {}).value; if (v === 'other') { const d = Math.round(+($('[data-otheramt]', root).value || 0)); return d >= 1 && d <= 500 ? d * 100 : 0; } return +v || 0; };
  const render = () => {
    const isOther = (($(`input[name="${prefix}-amt"]:checked`, root) || {}).value === 'other'); other.hidden = !isOther;
    const c = amount(); if (!c) { methods.hidden = true; methods.innerHTML = ''; return; }
    methods.hidden = false; methods.innerHTML = platformMethodsHTML(c);
    wirePlatformMethods(methods, F3, c, context);
  };
  $$(`input[name="${prefix}-amt"]`, root).forEach(i => i.onchange = render); const oa = $('[data-otheramt]', root); if (oa) oa.oninput = render;
}
function platformMethodsHTML(cents) {
  const P = CONFIG.PLATFORM_TIP || {}; const btns = [];
  if (CONFIG.AUTHNET_PAY_URL) btns.push(`<button type="button" class="fl-btn p sm" data-pcard>💳 Card · $${(cents / 100).toFixed(cents % 100 ? 2 : 0)}</button>`);
  if (P.venmo && /^[A-Za-z0-9_-]{5,30}$/.test(P.venmo)) btns.push(`<a class="fl-btn sm" data-pvenmo target="_blank" rel="noopener" href="https://venmo.com/u/${esc(P.venmo)}" style="border-color:#008cff;color:#008cff">Venmo</a>`);
  if (P.paypal && /^https:\/\/(www\.)?(paypal\.me\/|paypal\.com\/donate)/i.test(P.paypal)) btns.push(`<a class="fl-btn sm" data-ppaypal target="_blank" rel="noopener" href="${esc(P.paypal)}" style="border-color:#003087;color:#003087">PayPal</a>`);
  return btns.length ? `<div class="cr-row">${btns.join('')}</div><p class="cr-note" style="margin:4px 0 0">Venmo and PayPal open in their app; please type the amount there. Tips are voluntary and unlock nothing.</p>` : `<p class="cr-note">Platform tips open soon. Thank you for thinking of us 💛</p>`;
}
function wirePlatformMethods(root, F3, cents, context) {
  const toast = toastOf(F3);
  const tap = (k) => { try { F3.sb && F3.sb.rpc('creator_tap', { p_creator: null, p_kind: k, p_vh: vh(), p_post: null }); } catch (e) { } };
  const v = $('[data-pvenmo]', root); if (v) v.addEventListener('click', () => tap('venmo'));
  const p = $('[data-ppaypal]', root); if (p) p.addEventListener('click', () => tap('paypal'));
  const c = $('[data-pcard]', root); if (c) c.onclick = async () => {
    const me = F3.getMe && F3.getMe(); if (!me) { toast('Please sign in to tip by card.'); return; }
    c.disabled = true; c.textContent = 'Opening secure checkout…';
    try {
      const { data, error } = await F3.sb.rpc('platform_tip_start', { p_cents: cents, p_method: 'card', p_context: context || null });
      if (error || !data) throw new Error(error ? error.message : 'no ref');
      const { data: sess } = await F3.sb.auth.getSession(); const jwt = sess && sess.session && sess.session.access_token;
      const r = await fetch(CONFIG.AUTHNET_PAY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt, apikey: CONFIG.SUPABASE_ANON_KEY }, body: JSON.stringify({ ref: data.ref }) });
      const j = await r.json(); if (!r.ok || !j.token || !/^https:\/\/(accept|test)\.authorize\.net\//.test(j.action || '')) throw new Error(j.error || 'checkout');
      const f = document.createElement('form'); f.method = 'post'; f.action = j.action; f.innerHTML = `<input type="hidden" name="token" value="${esc(j.token)}">`; document.body.appendChild(f); f.submit();
    } catch (e) { c.disabled = false; c.textContent = '💳 Card'; toast('Card checkout is not open yet. Thank you anyway 💛'); }
  };
}

function tipSheet(F3, prof, card, kind) {
  const h = (card.handles || []).find(x => x.kind === kind); if (!h || !safeHttps(h.url)) return;
  const a = APPS[kind] || { name: kind, color: '#2563eb' }; const name = prof.name || prof.username || 'this creator';
  const me = F3.getMe && F3.getMe();
  const wrap = document.createElement('div'); wrap.className = 'cr-sheet'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Tip ' + name);
  wrap.innerHTML = `<div><button class="cr-x" type="button" aria-label="Close">×</button><h3>Tip ${esc(name)}</h3>
    <p class="cr-note" style="margin:0">Opens ${esc(a.name)}${h.handle ? ` to <b>${kind === 'cashapp' ? '$' : kind === 'venmo' ? '@' : ''}${esc(h.handle)}</b>` : ''}${h.verified ? ' <span class="cr-tag ok">✓ checked</span>' : ''}. You pick the amount there. 100% goes to ${esc(name)}.</p>
    ${h.verified ? '' : `<p class="cr-note" style="margin:6px 0 0">allofus has not checked this handle yet. Make sure the name in ${esc(a.name)} matches before you send.</p>`}
    <a class="cr-go" style="--c:${a.color}" href="${esc(h.url)}" target="_blank" rel="noopener noreferrer" data-go>Open ${esc(a.name)}</a>
    ${card.show_platform_tip ? platformTipHTML('crp') : ''}
    <p class="cr-note" style="margin:10px 0 0">Tips are gifts. They don't unlock anything on allofus. Payments are between you and ${esc(name)} under ${esc(a.name)}'s rules.</p></div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); }; const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey); $('.cr-x', wrap).onclick = close; wrap.onclick = (e) => { if (e.target === wrap) close(); };
  $('[data-go]', wrap).addEventListener('click', () => { try { F3.sb.rpc('creator_tap', { p_creator: prof.id, p_kind: kind, p_vh: me ? null : vh(), p_post: null }); } catch (e) { } });
  if (card.show_platform_tip) wirePlatformTip(wrap, F3, 'crp', 'creator:' + prof.id);
  setTimeout(() => { const g = $('[data-go]', wrap); if (g) g.focus(); }, 30);
}


/* ---------- v32: Creators Corner application (terms clickwrap, logged in the database) + Zach's approval queue ---------- */
const MADWACKD = `<div class="cr-card"><h3>🎬 Make your videos with madwackd.ai</h3><p>Our sister studio turns an idea into a finished short video: script, voice, music and edit. Make it there, then paste the link here or post it to your feed.</p><a class="fl-btn p sm" href="/creators/tools/">9 free creator tools</a> <a class="fl-btn sm" href="https://madwackd.ai/?utm_source=allofus&utm_medium=creators_corner" target="_blank" rel="noopener">Open madwackd.ai</a></div>`;
export const TERMS_SUMMARY = `<ul style="margin:6px 0 8px 18px;padding:0"><li>You are 18 or older and these are your own accounts and your own work.</li><li><b>You keep 100% of what fans send you.</b> Tips go straight from the fan to you in your own payment app. allofus never holds, touches or takes a cut of that money.</li><li>Tips are gifts. They unlock nothing on allofus. You handle your own taxes.</li><li>Fans may also choose to tip allofus. That is always optional and starts at $0.</li><li>Every application is reviewed by a person. We may decline or remove creator tools for rule-breaking (scams, fake handles, sexual content, harassment).</li><li><b>allofus may change these Creator Terms at any time.</b> We will tell you in the app and by e-mail before a change takes effect, and at least 30 days before any new fee. If you keep using creator tools after that, you accept the new terms.</li></ul>`;
async function applyView(body, F3, st) {
  const sb = F3.sb; const toast = toastOf(F3); const a = st.application; const tv = st.terms_version || TERMS_VERSION;
  const when = (t) => t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  let head = '';
  if (a && a.status === 'pending') head = `<div class="cr-card"><span class="cr-tag wait">Waiting for approval</span><h3>Thanks, your application is in</h3><p>Sent ${esc(when(a.applied_at))}. A person reads every application, usually within a day or two. You'll get an alert when it is decided.</p><p class="cr-note">You accepted Creator Terms ${esc(a.terms_version)} on ${esc(when(st.accepted && st.accepted.at))}.</p></div>`;
  else if (a && a.status === 'declined') head = `<div class="cr-card"><span class="cr-tag">Not approved</span><h3>Your application was not approved this time</h3>${a.decision_note ? `<p>${esc(a.decision_note)}</p>` : ''}<p class="cr-note">You can apply again 7 days after ${esc(when(a.decided_at))}.</p></div>`;
  const form = (!a || a.status !== 'pending') ? `<div class="cr-card"><span class="cr-100">Creators keep 100%. Always.</span><h3>Apply to Creators Corner</h3>
    <p>Get a Tip button on your profile that opens <i>your</i> Venmo, PayPal, Cash App, Ko-fi or Buy Me a Coffee, and show your videos and posts from other platforms. 18+ only.</p>
    <div class="cr-f"><label>What do you create? (a sentence or two)<textarea data-about rows="3" maxlength="1000" placeholder="Short comedy videos about life in Denver, twice a week."></textarea></label>
    <label>Links to your work (optional)<input type="text" data-links maxlength="600" placeholder="youtube.com/@you, tiktok.com/@you"></label>
    <div class="cr-warn" style="background:#f8fafc;border-color:#cbd5e1;color:#0f172a"><b>Creator Terms (${esc(tv)})</b>${TERMS_SUMMARY}<a href="/terms/#creators" target="_blank" rel="noopener">Read the full Creator Terms</a></div>
    <label><span><input type="checkbox" data-agree> I have read and agree to the Creator Terms (${esc(tv)}).</span></label>
    <div><button class="fl-btn p" type="button" data-apply>Send my application</button></div>
    <p class="cr-note" style="margin:0">When you tap Send we record your account, the terms version and the date and time you agreed.</p></div></div>` : '';
  body.innerHTML = `<div class="cr-wrap">${head}${form}${MADWACKD}${F3.getMe().isAdmin ? '<div class="cr-card" id="cr-admin"><h3>🛡️ Admin · Creators Corner applications</h3><div data-apps>Loading…</div></div>' : ''}</div>`;
  const ap = $('[data-apply]', body);
  if (ap) ap.onclick = async () => {
    if (!$('[data-agree]', body).checked) { toast('Please read and accept the Creator Terms first.'); return; }
    ap.disabled = true;
    const { error } = await sb.rpc('creator_apply', { p_about: $('[data-about]', body).value, p_links: $('[data-links]', body).value, p_terms_version: tv, p_user_agent: navigator.userAgent.slice(0, 300) });
    ap.disabled = false;
    if (error) { toast(String(error.message || error).replace(/^.*exception:?\s*/i, '').slice(0, 160)); return; }
    toast('Sent. We will let you know.'); creatorView(body, F3);
  };
  if (F3.getMe().isAdmin) appsQueue($('[data-apps]', body), F3);
}
async function appsQueue(host, F3) {
  if (!host) return; const sb = F3.sb; const toast = toastOf(F3);
  const { data, error } = await sb.rpc('admin_creator_applications', { p_status: 'pending' });
  if (error) { host.innerHTML = `<p class="cr-note">${esc(error.message)}</p>`; return; }
  const rows = data || [];
  host.innerHTML = `<p><b>${rows.length}</b> waiting for you.</p>` + (rows.map(x => `<div class="cr-h" data-u="${esc(x.user_id)}"><div class="cr-row"><b>${esc(x.name || x.username || 'member')}</b> <a href="/?u=${esc(x.username || '')}" target="_blank" rel="noopener">@${esc(x.username || '?')}</a><span class="cr-note">applied ${esc(new Date(x.applied_at).toLocaleString())} · terms ${esc(x.terms_version)} accepted ${esc(x.accepted_at ? new Date(x.accepted_at).toLocaleString() : '?')}</span></div><p style="margin:4px 0">${esc(x.about || '')}</p>${x.links ? `<p class="cr-note" style="overflow-wrap:anywhere;margin:0 0 4px">${esc(x.links)}</p>` : ''}<div class="cr-row"><button class="fl-btn sm p" data-dec="1">Approve</button><button class="fl-btn sm" data-dec="0">Decline</button></div></div>`).join('') || '<p class="cr-note">No applications waiting.</p>');
  $$('[data-dec]', host).forEach(b => b.onclick = async () => {
    const u = b.closest('[data-u]').dataset.u; const ok = b.dataset.dec === '1';
    const note = ok ? null : prompt('Optional note to the member (why it was not approved):', '');
    if (!ok && note === null) return;
    const { error: e2 } = await sb.rpc('admin_creator_decide', { p_user: u, p_approve: ok, p_note: note || null });
    toast(e2 ? 'Could not save: ' + e2.message : ok ? 'Approved. They have been told.' : 'Declined. They have been told.'); appsQueue(host, F3);
  });
}

/* ---------- 2. creator setup page ---------- */
export async function creatorView(body, F3) {
  injectCSS();
  const toast = toastOf(F3); const me = F3.getMe && F3.getMe(); const sb = F3.sb;
  if (!flagOn(F3)) { body.innerHTML = `<div class="cr-wrap"><div class="cr-card"><h3>Creator tools are coming soon</h3><p>Tips that go 100% to creators, and your other channels on your profile. We'll let you know when it opens.</p></div></div>`; return; }
  if (!me) { body.innerHTML = `<div class="cr-wrap"><div class="cr-card"><h3>Creators Corner</h3><p>Sign in (or join free) to apply. Creators keep 100% of fan tips. <a href="/creators/">How it works</a></p><button class="fl-btn p" data-signin>🔑 Sign in</button></div></div>`; return; }
  body.innerHTML = '<div class="cr-wrap"><div class="cr-card">Loading…</div></div>';
  const ms = await sb.rpc('creator_my_status');
  if (ms.error) { body.innerHTML = `<div class="cr-wrap"><div class="cr-card"><h3>Almost ready</h3><p>Creators Corner opens in a moment. Please reload.</p></div></div>`; return; }
  const mst = ms.data || {}; const app = mst.application;
  if (!app || app.status !== 'approved') { await applyView(body, F3, mst); return; }
  const [cp, hs, fs, its, st] = await Promise.all([
    sb.from('creator_profiles').select('*').eq('user_id', me.id).maybeSingle(), sb.from('creator_handles').select('*').eq('user_id', me.id),
    sb.from('creator_feeds').select('*').eq('user_id', me.id).order('created_at'), sb.from('creator_feed_items').select('*').eq('user_id', me.id).is('feed_id', null).order('created_at', { ascending: false }).limit(60),
    sb.rpc('creator_stats')]);
  if (cp.error && /creator_profiles/.test(cp.error.message || '')) { body.innerHTML = `<div class="cr-wrap"><div class="cr-card"><h3>Almost ready</h3><p>The database update for creator tools (v28) has not been run yet.</p></div></div>`; return; }
  const prof = cp.data || {}; const handles = Object.fromEntries((hs.data || []).map(h => [h.kind, h])); const feeds = fs.data || []; const embeds = its.data || []; const stats = st.data || {};
  const now = Date.now(); const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  body.innerHTML = `<div class="cr-wrap">
  <div class="cr-card"><span class="cr-100">Creators keep 100%. Always.</span><h3>Creator tools</h3><p>Fans tip you in your own payment app. Your money goes straight to you. allofus never holds it or takes a cut.</p>
   <div class="cr-f"><label><span><input type="checkbox" data-on ${prof.enabled ? 'checked' : ''}> Show a Tip button on my profile</span></label>
   <label>One line fans see (optional)<input type="text" data-headline maxlength="140" value="${esc(prof.headline || '')}" placeholder="Every tip helps me make more videos. Thank you!"></label>
   <p class="cr-note">Approved ${esc(new Date(app.decided_at || app.applied_at).toLocaleDateString())}. You accepted <a href="/terms/#creators" target="_blank" rel="noopener">Creator Terms</a> ${esc(app.terms_version)} on ${esc(new Date((mst.accepted && mst.accepted.at) || app.applied_at).toLocaleDateString())}.</p>
   <div><button class="fl-btn p" type="button" data-save>Save</button> <a class="fl-btn" href="/?u=${esc(me.username || '')}">See my profile</a></div></div></div>

  <div class="cr-card"><h3>Your tip apps</h3>
   <div class="cr-warn"><b>Use a business profile for tips.</b> Venmo, Cash App and PayPal personal accounts are for friends and family. Payments from fans can get a personal account frozen. A free <a href="${BIZ_HELP.venmo}" target="_blank" rel="noopener">Venmo Business profile</a> (1.9% + 10¢ per payment) keeps you safe and separates your income for taxes.</div>
   <p class="cr-note" style="margin:8px 0">To stop scammers: when you <b>change</b> a handle, the new one goes live after <b>48 hours</b> and we notify you. To get a ✓, put your code in that app's bio or name, then tap "Ask for a check".</p>
   <div class="cr-f">${Object.entries(APPS).map(([k, a]) => { const h = handles[k]; const live = h && new Date(h.live_at).getTime() <= now; return `<div class="cr-h" data-kind="${k}"><div class="cr-row"><b style="color:${a.color}">${esc(a.name)}</b>${h ? (live ? (h.hidden ? '<span class="cr-tag">hidden</span>' : '<span class="cr-tag ok">live</span>') : `<span class="cr-tag wait">goes live ${esc(when(h.live_at))}</span>`) + (h.verified ? ' <span class="cr-tag ok">✓ checked</span>' : '') : ''}</div>
     <div class="cr-row"><input type="text" data-handle value="${esc(h ? h.handle : '')}" placeholder="${esc(a.hint)}" aria-label="${esc(a.name)} handle" style="flex:1;min-width:180px">${['venmo', 'paypal', 'cashapp'].includes(k) ? `<label class="cr-note"><input type="checkbox" data-biz ${h && h.is_business ? 'checked' : ''}> business profile</label>` : ''}<button class="fl-btn sm" type="button" data-sethandle>Save</button>${h ? `<button class="fl-btn sm" type="button" data-rmhandle>Remove</button>` : ''}</div>
     ${h && !h.verified ? `<p class="cr-note" style="margin:0">Your check code: <b>${esc(h.verify_code)}</b> · <button type="button" class="cr-rep" data-askcheck>Ask for a check</button></p>` : ''}</div>`; }).join('')}</div>
   <p class="cr-note" style="margin:8px 0 0">Not offered: Zelle and crypto (no buyer protection, common in scams). Taxes: income is still reportable; payment apps send a 1099-K only above federal limits. Check with your tax pro.</p></div>

  <div class="cr-card" id="feeds"><h3>Your other channels</h3><p>Show your videos and posts from other platforms on your profile. We use each platform's official embed and never copy or scrape your account.</p>
   <div class="cr-f"><div class="cr-row" hidden><select data-fkind aria-label="Feed type"><option value="youtube">YouTube channel</option><option value="podcast">Podcast RSS</option><option value="blog">Blog / Substack / Medium RSS</option></select><input type="url" data-furl placeholder="https://www.youtube.com/channel/UC…" style="flex:1;min-width:200px" aria-label="Feed link"><button class="fl-btn sm p" type="button" data-addfeed>Connect</button></div>
   ${feeds.length ? feeds.map(f => `<div class="cr-h"><div class="cr-row"><b>${esc(f.title || f.kind)}</b><span class="cr-tag ${f.status === 'active' ? 'ok' : 'wait'}">${esc(f.status)}</span>${f.last_error ? `<span class="cr-note">last check: ${esc(f.last_error.slice(0, 80))}</span>` : f.last_ok_at ? `<span class="cr-note">checked ${esc(when(f.last_ok_at))}</span>` : '<span class="cr-note">first check within the hour</span>'}</div><div class="cr-row"><span class="cr-note" style="overflow-wrap:anywhere">${esc(f.source_url)}</span>${f.status !== 'blocked' ? `<button class="fl-btn sm" type="button" data-pause="${f.id}" data-p="${f.status === 'active' ? 1 : 0}">${f.status === 'active' ? 'Pause' : 'Resume'}</button>` : ''}<button class="fl-btn sm" type="button" data-rmfeed="${f.id}">Remove</button></div></div>`).join('') : ''}
   <b style="font-size:14px">Paste a post</b><p class="cr-note" style="margin:0">One YouTube, TikTok, Instagram, Vimeo, Spotify, SoundCloud or X post at a time.</p>
   <div class="cr-row"><input type="url" data-eurl placeholder="https://www.tiktok.com/@you/video/…" style="flex:1;min-width:200px" aria-label="Post link"><button class="fl-btn sm p" type="button" data-addembed>Add</button></div>
   ${embeds.length ? `<div class="cr-feed">${embeds.map(it => itemHTML(it, { owner: true }).replace('<div class="t">', it.mod_status === 'ok' ? '<div class="t">' : `<span class="cr-tag wait" style="margin:4px">${it.mod_status === 'pending' ? 'in review' : 'hidden'}</span><div class="t">`)).join('')}</div>` : ''}</div></div>

  <div class="cr-card"><h3>Tip taps</h3><p>We never see your money, so this counts how many people tapped Tip (your own taps don't count).</p>
   <div class="cr-stat"><div><b>${+stats.week || 0}</b><span class="cr-note">this week</span></div><div><b>${+stats.month || 0}</b><span class="cr-note">last 30 days</span></div>${Object.entries(stats.by_kind || {}).map(([k, n]) => `<div><b>${+n}</b><span class="cr-note">${esc((APPS[k] || { name: k }).name)}</span></div>`).join('')}</div></div>
  ${MADWACKD}
  ${me.isAdmin ? '<div class="cr-card" id="cr-admin"><h3>🛡️ Admin · Creators Corner applications</h3><div data-apps>Loading…</div><h3 style="margin-top:14px">🛡️ Admin · handle checks + held posts</h3><div data-admin>Loading…</div></div>' : ''}</div>`;
  wireEmbeds(body);
  const reload = () => creatorView(body, F3);
  const err = (e) => toast(String((e && e.message) || e || 'Something went wrong').replace(/^.*exception:?\s*/i, '').slice(0, 160));
  $('[data-save]', body).onclick = async () => {
    const on = $('[data-on]', body).checked;
    const { error } = await sb.rpc('creator_setup', { p_enabled: on, p_headline: $('[data-headline]', body).value, p_show_platform_tip: false, p_terms_version: app.terms_version });
    if (error) err(error); else { toast(on ? 'Saved. Your Tip button is on.' : 'Saved.'); reload(); }
  };
  $$('[data-sethandle]', body).forEach(b => b.onclick = async () => {
    const row = b.closest('[data-kind]'); const k = row.dataset.kind; const v = $('[data-handle]', row).value.trim(); if (!v) { toast('Type your handle first.'); return; }
    const biz = $('[data-biz]', row);
    if (['venmo', 'cashapp', 'paypal'].includes(k) && biz && !biz.checked && !confirm('Is this a personal account? Fans paying a personal account can get it frozen. Tap OK to save anyway, or Cancel to switch to a business profile first.')) return;
    const { data, error } = await sb.rpc('creator_set_handle', { p_kind: k, p_handle: v, p_is_business: !!(biz && biz.checked) });
    if (error) err(error); else { toast(data && data.changed ? 'Saved. The new handle goes live in 48 hours. We sent you a notice.' : 'Saved.'); reload(); }
  });
  $$('[data-rmhandle]', body).forEach(b => b.onclick = async () => { const k = b.closest('[data-kind]').dataset.kind; const { error } = await sb.rpc('creator_remove_handle', { p_kind: k }); if (error) err(error); else reload(); });
  $$('[data-askcheck]', body).forEach(b => b.onclick = async () => { const k = b.closest('[data-kind]').dataset.kind; const h = handles[k]; try { await sb.from('bugs').insert({ user_id: me.id, kind: 'creator_check', note: `Please check my ${k} handle ${h.handle} for code ${h.verify_code}`, page: location.href }); } catch (e) { } toast('Asked. We check by hand, usually within a day.'); });
  const fk = $('[data-fkind]', body), fu = $('[data-furl]', body);
  if (fk) fk.onchange = () => { fu.placeholder = fk.value === 'youtube' ? 'https://www.youtube.com/channel/UC…' : 'https://…/feed.xml'; };
  if ($('[data-addfeed]', body)) $('[data-addfeed]', body).onclick = async () => { const { error } = await sb.rpc('creator_add_feed', { p_kind: fk.value, p_url: fu.value.trim() }); if (error) err(error); else { toast('Connected. New posts show within about an hour.'); reload(); } };
  $('[data-addembed]', body).onclick = async () => { const { data, error } = await sb.rpc('creator_add_embed', { p_url: $('[data-eurl]', body).value.trim() }); if (error) err(error); else { toast(data && data.mod_status === 'pending' ? 'Added. It shows after a quick review.' : 'Added to your profile.'); reload(); } };
  $$('[data-pause]', body).forEach(b => b.onclick = async () => { const { error } = await sb.rpc('creator_pause_feed', { p_id: +b.dataset.pause, p_paused: b.dataset.p === '1' }); if (error) err(error); else reload(); });
  $$('[data-rmfeed]', body).forEach(b => b.onclick = async () => { if (!confirm('Remove this channel and its posts from your profile?')) return; const { error } = await sb.rpc('creator_remove_feed', { p_id: +b.dataset.rmfeed }); if (error) err(error); else reload(); });
  $$('[data-rm]', body).forEach(b => b.onclick = async () => { const { error } = await sb.rpc('creator_remove_item', { p_id: +b.dataset.rm }); if (error) err(error); else reload(); });
  if (me.isAdmin) { adminQueue($('[data-admin]', body), F3); appsQueue($('[data-apps]', body), F3); }
}

async function adminQueue(host, F3) {
  const sb = F3.sb; const toast = toastOf(F3);
  const [h, p, s] = await Promise.all([sb.rpc('admin_creator_handles', { p_only_unverified: true }), sb.rpc('admin_pending_feed_items'), sb.rpc('platform_tip_stats')]);
  const hs = h.data || [], ps = p.data || [], st = s.data || {};
  host.innerHTML = `<div class="cr-stat" style="margin-bottom:8px"><div><b>${+st.creator_taps_30d || 0}</b><span class="cr-note">creator tip taps</span></div><div><b>${+st.creators_on || 0}</b><span class="cr-note">creators on</span></div></div>
   <b>Handles to check (${hs.length})</b><p class="cr-note">Open the link, look for the code in their bio or name, then ✓ or ✕ (✕ hides it).</p>${hs.map(x => `<div class="cr-row" style="margin:4px 0"><span>@${esc(x.username || '?')} · ${esc(x.kind)} · <a href="${esc(safeHttps(x.url) ? x.url : '#')}" target="_blank" rel="noopener">${esc(x.handle.slice(0, 40))}</a> · code <b>${esc(x.verify_code)}</b></span><button class="fl-btn sm" data-ver="${x.id}" data-ok="1">✓</button><button class="fl-btn sm" data-ver="${x.id}" data-ok="0">✕</button></div>`).join('') || '<p class="cr-note">None.</p>'}
   <b>Held channel posts (${ps.length})</b>${ps.map(x => `<div class="cr-row" style="margin:4px 0"><span>@${esc(x.username || '?')} · ${esc(x.provider)} · <a href="${esc(safeHttps(x.link) ? x.link : '#')}" target="_blank" rel="noopener">${esc((x.title || x.link).slice(0, 60))}</a></span><button class="fl-btn sm" data-fi="${x.id}" data-s="ok">Show</button><button class="fl-btn sm" data-fi="${x.id}" data-s="hidden">Hide</button></div>`).join('') || '<p class="cr-note">None.</p>'}`;
  $$('[data-ver]', host).forEach(b => b.onclick = async () => { const { error } = await sb.rpc('admin_creator_verify', { p_id: +b.dataset.ver, p_ok: b.dataset.ok === '1' }); toast(error ? 'Could not save.' : 'Saved.'); adminQueue(host, F3); });
  $$('[data-fi]', host).forEach(b => b.onclick = async () => { const { error } = await sb.rpc('admin_feed_item', { p_id: +b.dataset.fi, p_status: b.dataset.s }); toast(error ? 'Could not save.' : 'Saved.'); adminQueue(host, F3); });
}

/* ---------- 3. Support allofus ---------- */
export async function supportView(body, F3) {
  injectCSS();
  const q = new URLSearchParams(location.search); const paid = q.get('tipped');
  body.innerHTML = `<div class="cr-wrap"><div class="cr-card">${paid ? '<p class="cr-tag ok" role="status">Thank you for supporting allofus 💛</p>' : ''}<h3>Support allofus</h3>
   <p>allofus has no investors telling us to sell your data, and creators keep 100% of their tips. We pay for servers, the database, safety review and support from voluntary tips and optional, member-controlled ads.</p>
   <p><b>Tipping is optional.</b> It unlocks nothing, and $0 is always fine. You can use everything either way.</p>
   ${platformTipHTML('sup')}
   <p class="cr-note" style="margin-top:10px">Tips go to Eye To Ad Media (Search Converts LLC), which runs allofus.one. They are not tax-deductible. See the <a href="/terms/#tips">Terms</a>.</p></div></div>`;
  wirePlatformTip(body, F3, 'sup', 'support_page');
}

/* ---------- 4. Grow your business → Connected tools ---------- */
const TOOL_KINDS = {
  aispeedtoleads: { name: 'AI Speed to Leads', color: '#0ea5e9', url: 'https://aispeedtoleads.com/', body: 'An AI assistant follows up on every new inquiry in about 60 seconds. Paste your AI Speed to Leads webhook to send new Brand-page leads straight in. Only people who asked to be contacted are ever called.', label: 'Get a fast quote' },
  commerceplugs: { name: 'CommercePlugs', color: '#7c3aed', url: 'https://commerceplugs.com/join/', body: 'List your online store on CommercePlugs and put a Shop button on your Brand page.', label: 'Shop our store' },
  webhook: { name: 'Any webhook', color: '#334155', url: '', body: 'Zapier, Make, your CRM: we POST a signed JSON message for the events you pick. Check the X-AOU-Signature header (HMAC-SHA256 of the body with your secret).', label: '' },
  link: { name: 'A button link', color: '#16a34a', url: '', body: 'Booking, menu, quote form: show it as a button on your Brand page.', label: 'Book now' },
};
export async function mountGrowTools(host, F3) {
  if (!host || !flagOn(F3) || !F3.sb) return;
  injectCSS();
  const toast = toastOf(F3); const me = F3.getMe && F3.getMe(); const pages = ((F3.myPages && F3.myPages()) || []).filter(p => p && p.slug);
  host.hidden = false; host.className = 'gr-card';
  if (!me || !pages.length) { host.innerHTML = `<h3>Connected tools</h3><p>Connect AI Speed to Leads, CommercePlugs or any webhook to your Brand page. ${me ? '<a href="/?v=brand">Make a free Brand page</a> first.' : 'Sign in and make a free Brand page first.'}</p>`; return; }
  let slug = lsGet('aou_tools_page', '') || pages[0].slug; if (!pages.some(p => p.slug === slug)) slug = pages[0].slug;
  const draw = async () => {
    const { data, error } = await F3.sb.from('page_integrations').select('*').eq('page_slug', slug).order('id');
    if (error) { host.innerHTML = `<h3>Connected tools</h3><p class="cr-note">Almost ready: the v28 database update has not been run yet.</p>`; return; }
    const rows = data || [];
    host.innerHTML = `<h3>Connected tools</h3><p>Plug your Brand page into the tools you already use.</p>
     ${pages.length > 1 ? `<label class="cr-note">Brand page <select data-page>${pages.map(p => `<option value="${esc(p.slug)}" ${p.slug === slug ? 'selected' : ''}>${esc(p.name || p.slug)}</option>`).join('')}</select></label>` : ''}
     ${rows.map(r => { const t = TOOL_KINDS[r.kind] || TOOL_KINDS.link; return `<div class="cr-h" data-row="${r.id}" style="margin-top:8px;border-left:4px solid ${t.color}"><div class="cr-row"><b>${esc(t.name)}</b>${r.active ? '<span class="cr-tag ok">on</span>' : '<span class="cr-tag">off</span>'}${r.show_on_page && r.url ? '<span class="cr-tag">button on page</span>' : ''}${r.last_status ? `<span class="cr-note">last send: ${esc(r.last_status)}</span>` : ''}</div>
       ${r.url ? `<span class="cr-note" style="overflow-wrap:anywhere">${esc(r.label || '')} → ${esc(r.url)}</span>` : ''}${r.webhook_url ? `<span class="cr-note" style="overflow-wrap:anywhere">Webhook: ${esc(r.webhook_url.replace(/(https:\/\/[^/]+\/).{6,}/, '$1…'))} · events: ${esc((r.events || []).join(', '))}</span><span class="cr-note">Secret: <code data-sec hidden>${esc(r.secret)}</code> <button type="button" class="cr-rep" data-showsec>show</button></span>` : ''}
       <div class="cr-row">${r.webhook_url ? `<button class="fl-btn sm" type="button" data-test="${r.id}">Send a test</button>` : ''}<button class="fl-btn sm" type="button" data-toggle="${r.id}" data-a="${r.active ? 0 : 1}">${r.active ? 'Turn off' : 'Turn on'}</button><button class="fl-btn sm" type="button" data-del="${r.id}">Remove</button></div></div>`; }).join('')}
     <div class="cr-f" style="margin-top:10px"><b style="font-size:14px">Add a tool</b>
      <div class="cr-row">${Object.entries(TOOL_KINDS).map(([k, t]) => `<button class="fl-btn sm" type="button" data-pick="${k}" style="border-color:${t.color};color:${t.color}">${esc(t.name)}</button>`).join('')}</div>
      <div data-form hidden class="cr-h"></div></div>
     <p class="cr-note" style="margin:8px 0 0">Webhook messages never include a visitor's private info unless they sent it to you in a lead form. AI Speed to Leads and CommercePlugs are run by Eye To Ad Media (the team behind allofus).</p>`;
    const ps = $('[data-page]', host); if (ps) ps.onchange = () => { slug = ps.value; try { localStorage.setItem('aou_tools_page', slug); } catch (e) { } draw(); };
    $$('[data-showsec]', host).forEach(b => b.onclick = () => { const c = b.previousElementSibling; c.hidden = !c.hidden; b.textContent = c.hidden ? 'show' : 'hide'; });
    $$('[data-toggle]', host).forEach(b => b.onclick = async () => { const { error } = await F3.sb.from('page_integrations').update({ active: b.dataset.a === '1' }).eq('id', +b.dataset.toggle); if (error) toast('Could not save.'); draw(); });
    $$('[data-del]', host).forEach(b => b.onclick = async () => { if (!confirm('Remove this tool?')) return; const { error } = await F3.sb.from('page_integrations').delete().eq('id', +b.dataset.del); if (error) toast('Could not remove.'); draw(); });
    $$('[data-test]', host).forEach(b => b.onclick = async () => {
      if (!CONFIG.BIZ_WEBHOOK_URL) { toast('Test sends open once the biz-webhook function is deployed.'); return; }
      b.disabled = true; try { const { data: sess } = await F3.sb.auth.getSession(); const r = await fetch(CONFIG.BIZ_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sess && sess.session && sess.session.access_token), apikey: CONFIG.SUPABASE_ANON_KEY }, body: JSON.stringify({ slug, event: 'test', id: +b.dataset.test }) }); const j = await r.json().catch(() => ({})); toast(r.ok ? 'Test sent. Your tool answered ' + (j.status || 'OK') + '.' : (j.error || 'Test failed.')); } catch (e) { toast('Test failed.'); } b.disabled = false; draw();
    });
    $$('[data-pick]', host).forEach(b => b.onclick = () => {
      const k = b.dataset.pick; const t = TOOL_KINDS[k]; const form = $('[data-form]', host); form.hidden = false;
      const needsHook = k === 'webhook' || k === 'aispeedtoleads'; const needsUrl = k !== 'webhook';
      form.innerHTML = `<b style="color:${t.color}">${esc(t.name)}</b><p class="cr-note" style="margin:0">${esc(t.body)}</p>
       ${needsUrl ? `<label>Button link${k === 'aispeedtoleads' ? ' (optional)' : ''}<input type="url" data-u value="${esc(t.url)}" placeholder="https://"></label><label>Button text<input type="text" data-l maxlength="60" value="${esc(t.label)}"></label><label class="cr-note"><input type="checkbox" data-show ${k === 'link' || k === 'commerceplugs' ? 'checked' : ''}> Show this button on my Brand page</label>` : ''}
       ${needsHook ? `<label>Webhook URL${k === 'aispeedtoleads' ? ' (from your AI Speed to Leads dashboard, optional)' : ''}<input type="url" data-w placeholder="https://"></label><div class="cr-row cr-note">Send: <label><input type="checkbox" data-ev="lead" checked> new leads</label><label><input type="checkbox" data-ev="follow"> new followers</label></div>` : ''}
       ${k === 'aispeedtoleads' ? `<p class="cr-note" style="margin:0">No account yet? <a href="https://aispeedtoleads.com/?utm_source=allofus&utm_medium=referral&utm_campaign=grow&utm_content=tools" target="_blank" rel="sponsored noopener">See how it works</a>.</p>` : ''}
       <div class="cr-row"><button class="fl-btn p sm" type="button" data-add>Connect</button><button class="fl-btn sm" type="button" data-cancel>Cancel</button></div>`;
      $('[data-cancel]', form).onclick = () => { form.hidden = true; form.innerHTML = ''; };
      $('[data-add]', form).onclick = async () => {
        const u = ($('[data-u]', form) || {}).value || null, w = ($('[data-w]', form) || {}).value || null;
        if ((u && !safeHttps(u)) || (w && !safeHttps(w))) { toast('Links must start with https://'); return; }
        if (k === 'webhook' && !w) { toast('Paste the webhook URL.'); return; }
        if (k !== 'webhook' && !u && !w) { toast('Add a link or a webhook.'); return; }
        const ev = $$('[data-ev]', form).filter(x => x.checked).map(x => x.dataset.ev);
        const { error } = await F3.sb.from('page_integrations').insert({ page_slug: slug, kind: k, url: u ? u.trim() : null, label: (($('[data-l]', form) || {}).value || '').trim() || null, webhook_url: w ? w.trim() : null, events: ev.length ? ev : ['lead'], show_on_page: !!(($('[data-show]', form) || {}).checked) });
        if (error) toast(/check constraint|urls_chk/i.test(error.message) ? 'That link is not allowed. Use a public https:// address.' : 'Could not connect. Please try again.'); else { toast('Connected.'); draw(); }
      };
    });
  };
  await draw();
}

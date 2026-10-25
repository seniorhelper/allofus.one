/* allofus.one · Content layer (v27, Oct 23 2026)
   Makes the feed feel alive while the member count is small, without ever faking people:
   1. "Today on allofus" system cards, clearly labeled, interleaved at most 1 in 6 posts: the daily spark, a LIFEboard
      tip, a feature spotlight (rotating), "members posting lately" (real counts), a World Window teaser. Each card has
      Dismiss and "Fewer like this"; both respect the device's aou_feedprefs / aou_sysprefs. Never more than 4 per load.
   2. /?v=discover: public, attributed content from an allow-list only: NASA (APOD with a key or DEMO_KEY, else the
      keyless NASA Image Library), Wikipedia's featured feed (api.wikimedia.org), Action Global News (the World news
      JSON feed already used by the rail), and Pixabay when CONFIG.PIXABAY_KEY is set (off until Zach adds a key; results
      are shown temporarily and never hot-linked into posts, per Pixabay's API terms). "Share to feed" opens the real
      composer with the link and credit prefilled, so a real post with a link preview is created by the member.
   3. "What's new": the last 5 release notes (More menu).
   4. Admin "Members & email" section, and the email opt-in that was pending from a sign-up that needed confirmation. */
import { CONFIG } from './aou-config.js';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
const PREFS = 'aou_sysprefs';
const prefs = () => { try { return Object.assign({ off: false, fewer: [], hidden: [] }, JSON.parse(localStorage.getItem(PREFS) || '{}')); } catch (e) { return { off: false, fewer: [], hidden: [] }; } };
const setPrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch (e) { } };
const feedLess = () => { try { const p = JSON.parse(localStorage.getItem('aou_feedprefs') || '{}'); return (p.less || []).map(String); } catch (e) { return []; } };
const UTM = (u, c) => u + (u.includes('?') ? '&' : '?') + 'utm_source=allofus&utm_medium=referral&utm_campaign=feed_card&utm_content=' + c;

/* ---------- release notes (newest first; keep 5 in the sheet) ---------- */
export const WHATS_NEW = [
  { v: 'v27', d: '2026-10-23', t: 'The tour, LIFEspark, World Window and email updates', p: ['Take the tour: a 12-step walk through everything one account gets you (header button, or /?tour=1).', 'LIFEspark: a daily spark, three tiny wins, a two-minute breathing timer and "Ask allofus".', 'World Window: NASA, Wikipedia and World news, with sources on every card and one-tap sharing.', 'Optional email updates at sign-up, with one-click unsubscribe in every email.', 'Your graph is yours: a did:key identity and signed, verifiable exports (Your data page).'] },
  { v: 'v26', d: '2026-10-23', t: 'Circles, feed controls and the AI guide', p: ['Circles: Family, Inner Tribe, Professional, Local and your own. Post to one circle only.', 'Feed controls: mute words, hide reposts, see one circle, and "Why am I seeing this?" on every post.', 'Your data: one-click export (now with circles) and self-serve delete.', 'Ask allofus: real answers from the guide, and it tells you when it is an AI.', 'Grow your business: free listings, press releases and 60-second lead follow-up in one place.'] },
  { v: 'v25', d: '2026-10-21', t: 'VR arrival and the two-sided menu', p: ['A new way into VR: the saw-cut arrival.', 'A two-sided VR menu with its own guided tour.', 'Landing views that face something worth seeing.'] },
  { v: 'v24', d: '2026-10-19', t: 'Quest fixes and the VR layer', p: ['The VR layer no longer freezes at session start on Quest.', 'Shared VR layer with World VR Mall, kept identical in both.'] },
  { v: 'v21', d: '2026-10-19', t: 'Push, mentions and the photo editor', p: ['@mentions with alerts.', 'Edit photos before posting: light, crop, filters.', 'Push notifications on phone and desktop.'] }
];
export function whatsNewHTML() { return `<div class="wn"><p class="muted" style="margin:0 0 10px;font-size:12.5px">What changed on allofus.one, newest first. Built in Denver, shipped often.</p>${WHATS_NEW.slice(0, 5).map(r => `<section class="wn-r"><h4><b>${esc(r.v)}</b> ${esc(r.t)} <small>${esc(r.d)}</small></h4><ul>${r.p.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}<p style="margin:10px 0 0"><a class="fl-btn p sm" href="/?tour=1">Take the tour</a> <a class="fl-btn sm" href="/report-bug/">Report a bug</a></p></div>`; }

/* ---------- system cards ---------- */
const TIPS = ['Open LIFEboard and add one goal under "dream". You can drag it to "doing" later.', 'The LIFEboard journal keeps one line a day. A year of one-liners is a book about you.', 'Habits on LIFEboard count streaks. Miss a day, the streak restarts; the history stays.', 'The life wheel on LIFEboard takes two minutes and shows you where the week went.', 'Money blocks on LIFEboard are private math: income in, expenses out, no bank link needed.', 'LIFEboard shows up in the 3D world too: walk up to your board and read it.', 'Save a Daily spark from LIFEspark to your LIFEboard journal with one tap.', 'LIFEboard goals can carry a tag (health, work, home). Filter by tag when the list grows.'];
const FEATURES = [
  ['Circles', 'Share with Family, Inner Tribe, Professional or Local only. Audiences never mix.', '/?v=circles', '#7c3aed'],
  ['Courses', 'Teach what you know in five short lessons, free. Learners track them on LIFEboard.', '/?v=courses', '#0284c7'],
  ['FLOWworks', 'Pads for projects: sketch, plan and track on tiles you lay out yourself.', '/?v=work', '#14b8a6'],
  ['Unity Call', 'Free video calls with one link. No download, no time limit.', '/meet/', '#ef4444'],
  ['Global Room', 'Your whole group on one wall for a talk or a watch party.', '/rooms/', '#22c55e'],
  ['Games', 'Browser games, nothing to install.', '/games/', '#0891b2'],
  ['Grow your business', 'Free listings, a press release builder and 60-second lead follow-up.', '/?v=grow', '#0ea5e9'],
  ['Moments', 'Faces, backdrops and quick clips. Fast, fun posts.', '/moments/', '#ec4899'],
  ['3D world', 'Walk the world in your browser. Build a house. Bring a headset for VR.', '/world/', '#06b6d4'],
  ['World VR Mall', 'A 3D mall where every store opens a real small business. Built by the same team.', UTM('https://worldvrmall.com/', 'spotlight_wvm'), '#f97316', true],
  ['LIFEspark', 'A daily spark, three tiny wins and two minutes of breath.', '/?v=spark', '#f59e0b'],
  ['World Window', 'NASA, Wikipedia and world news with sources on every card.', '/?v=discover', '#0369a1']
];
const KINDS = ['spark', 'tip', 'feature', 'people', 'discover'];
const cardShell = (kind, title, inner, color = '#0369a1') => `<article class="fl-card aou-sys" data-sys="${kind}" style="--c:${color}" aria-label="allofus card"><header><span class="tag">allofus</span><b>${esc(title)}</b><span class="sp"></span><button type="button" class="x" data-sys-fewer title="Show fewer cards like this">Fewer like this</button><button type="button" class="x" data-sys-x aria-label="Dismiss">✕</button></header><div class="bd">${inner}</div></article>`;
async function buildCard(kind, slot, ctx) {
  const n = dayNum() + slot;
  if (kind === 'spark') { const M = await import('./aou-lifespark.js'); const s = M.todaySpark(); return cardShell('spark', 'Daily spark', `<p class="big">${esc(s.text)}</p><div class="row"><a class="fl-btn p sm" href="/?v=spark">Answer it in LIFEspark</a>${ctx.me ? `<a class="fl-btn sm" href="/?share=${encodeURIComponent('https://allofus.one/?v=spark')}&text=${encodeURIComponent('Daily spark: "' + s.text + '"\n\nMy answer: ')}">Post my answer</a>` : ''}</div>`, '#f59e0b'); }
  if (kind === 'tip') { const t = TIPS[n % TIPS.length]; return cardShell('tip', 'LIFEboard tip', `<p>${esc(t)}</p><div class="row"><a class="fl-btn sm" href="/?v=board">Open LIFEboard</a></div>`, '#65a30d'); }
  if (kind === 'feature') { const [name, d, href, c, ext] = FEATURES[n % FEATURES.length]; return cardShell('feature', 'Did you know', `<p><b>${esc(name)}.</b> ${esc(d)}</p><div class="row"><a class="fl-btn sm" href="${esc(href)}"${ext ? ' target="_blank" rel="sponsored noopener"' : ''}>Open ${esc(name)}</a></div>`, c); }
  if (kind === 'people') { let who = []; let total = 0; try { if (ctx.sb) { const { data } = await ctx.sb.from('feed_posts').select('user_id').eq('public', true).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).limit(200); const ids = [...new Set((data || []).map(x => x.user_id).filter(Boolean))]; total = ids.length; if (ids.length) { const { data: ps } = await ctx.sb.from('profiles').select('username,display_name').in('id', ids.slice(0, 6)); who = ps || []; } } } catch (e) { } if (!total) return ''; return cardShell('people', 'Posting lately', `<p><b>${total}</b> ${total === 1 ? 'member' : 'members'} posted this week${who.length ? ': ' + who.map(p => `<a href="/?u=${esc(p.username || '')}">${esc(p.display_name || p.username || 'Member')}</a>`).join(', ') : ''}. Small room, real people. Say hi.</p><div class="row"><a class="fl-btn sm" href="/?v=search">Find people</a><a class="fl-btn sm" href="/?v=conn">My connections</a></div>`, '#ec4899'); }
  if (kind === 'discover') { return cardShell('discover', 'World Window', `<p>Something worth a minute: NASA's picture of the day, Wikipedia's featured article and world news, with the source on every card.</p><div class="row"><a class="fl-btn p sm" href="/?v=discover">Open World Window</a></div>`, '#0369a1'); }
  return '';
}
export const CONTENT_CSS = `.aou-sys{--c:#0369a1;border-left:4px solid var(--c)!important;padding:12px 14px 12px!important;font-family:Poppins,Arial,sans-serif}.aou-sys header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}.aou-sys header .tag{font:800 10px/1 Poppins,Arial;letter-spacing:.09em;text-transform:uppercase;color:#fff;background:var(--c);border-radius:999px;padding:5px 8px}.aou-sys header b{font:800 13.5px Poppins,Arial;color:#0b1a3a}.aou-sys header .sp{flex:1}.aou-sys header .x{border:0;background:transparent;color:#64748b;font:600 11.5px Poppins,Arial;cursor:pointer;padding:4px 6px;border-radius:8px;min-height:28px}.aou-sys header .x:hover{background:#f1f5f9;color:#0f172a}.aou-sys .bd p{margin:0 0 8px;font:500 13.5px/1.5 Poppins,Arial;color:#334155}.aou-sys .bd p.big{font:700 16px/1.4 Poppins,Arial;color:#0b1a3a}.aou-sys .row{display:flex;gap:8px;flex-wrap:wrap}.aou-sys .row .fl-btn{min-height:36px}
.wn-r{border-top:1px solid #eef2f7;padding:10px 0 4px}.wn-r:first-of-type{border-top:0;padding-top:0}.wn-r h4{margin:0 0 4px;font:700 14px Poppins,Arial;color:#0b1a3a;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.wn-r h4 b{color:#0369a1}.wn-r h4 small{color:#64748b;font-weight:500;margin-left:auto}.wn-r ul{margin:0;padding-left:18px;font:500 13px/1.5 Poppins,Arial;color:#334155}
.dc-wrap{max-width:980px;margin:14px auto;padding:0 12px;display:grid;gap:14px;font-family:Poppins,Arial,sans-serif}.dc-hero{background:linear-gradient(135deg,#0b1a3a,#0369a1);color:#fff;border-radius:20px;padding:18px 22px}.dc-hero h2{margin:0;font:800 22px Poppins,Arial}.dc-hero p{margin:4px 0 0;color:#dbeafe;font:500 13.5px/1.45 Poppins,Arial}.dc-tabs{display:flex;gap:6px;flex-wrap:wrap}.dc-tabs button{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;min-height:38px;padding:0 14px;font:700 13px Poppins,Arial;color:#0f172a;cursor:pointer}.dc-tabs button.on{background:#0b1a3a;color:#fff;border-color:#0b1a3a}
.dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.dc-c{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}.dc-c img{width:100%;aspect-ratio:16/10;object-fit:cover;background:#f1f5f9;display:block}.dc-c .in{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}.dc-c h4{margin:0;font:800 15px/1.3 Poppins,Arial;color:#0b1a3a}.dc-c p{margin:0;font:500 13px/1.5 Poppins,Arial;color:#475569;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.dc-c .src{font:600 11.5px Poppins,Arial;color:#64748b}.dc-c .src a{color:#0369a1}.dc-c .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:6px}.dc-c .row .fl-btn{min-height:36px}
.dc-note{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:14px 16px;font:500 13px/1.5 Poppins,Arial;color:#475569}.dc-note h3{margin:0 0 6px;font:800 15px Poppins,Arial;color:#0b1a3a}.dc-form{display:flex;gap:8px;margin:8px 0}.dc-form input{flex:1;border:1.5px solid #cbd5e1;border-radius:12px;padding:9px 12px;font:500 14px Poppins,Arial;min-width:0}`;
const css = () => { if ($('#aou-content-css')) return; const s = document.createElement('style'); s.id = 'aou-content-css'; s.textContent = CONTENT_CSS; document.head.appendChild(s); };

/* The feedList hook (aou-flat2.js) calls this after aou-circles' hook, for the home feed only; it returns nothing and
   inserts cards into the DOM once the posts have rendered. */
export function feedHook(mount, q, data, ctx) {
  const home = !!(q && q.publicOnly && !q.user && !q.group && !q.page && !q.ids && !q.users); if (!home) return;
  const P = prefs(); if (P.off || feedLess().some(w => /^(allofus|tips?|cards?)$/i.test(w))) return; css();
  (async () => {
    let tries = 0; const go = async () => { const posts = $$('article.fl-post', mount); if (posts.length < 3 && tries++ < 20) return setTimeout(go, 150); if ($('.aou-sys', mount)) return;
      const order = KINDS.filter(k => !P.hidden.includes(k)); if (!order.length) return;
      const weight = (k) => P.fewer.includes(k) ? 0.25 : 1; const start = dayNum() % order.length;
      let slot = 0, made = 0; for (let idx = 5; idx < posts.length && made < 4; idx += 6) { let kind = order[(start + slot) % order.length]; slot++; if (Math.random() > weight(kind)) continue; let html = ''; try { html = await buildCard(kind, slot, ctx); } catch (e) { } if (!html) continue; const t = document.createElement('template'); t.innerHTML = html; const el = t.content.firstElementChild; posts[idx].after(el); made++; }
      if (made && posts.length < 6) { /* tiny feeds: one card at the end so the page still breathes */ }
    };
    if ($$('article.fl-post', mount).length && $$('article.fl-post', mount).length < 6) { /* very small feed: one card after the last post */ setTimeout(async () => { if ($('.aou-sys', mount)) return; const posts = $$('article.fl-post', mount); if (!posts.length) return; const order = KINDS.filter(k => !P.hidden.includes(k)); const kind = order[dayNum() % order.length]; let html = ''; try { html = await buildCard(kind, 0, ctx); } catch (e) { } if (!html) return; const t = document.createElement('template'); t.innerHTML = html; posts[posts.length - 1].after(t.content.firstElementChild); }, 400); }
    setTimeout(go, 80);
  })();
}
document.addEventListener('click', (e) => {
  const x = e.target.closest('[data-sys-x],[data-sys-fewer]'); if (!x) return; const card = x.closest('.aou-sys'); const kind = card && card.dataset.sys; const P = prefs();
  if (x.hasAttribute('data-sys-fewer') && kind) { if (P.fewer.includes(kind)) { P.hidden.push(kind); } else P.fewer.push(kind); setPrefs(P); try { const fp = JSON.parse(localStorage.getItem('aou_feedprefs') || '{}'); fp.less = Array.from(new Set([...(fp.less || []), 'allofus:' + kind])); localStorage.setItem('aou_feedprefs', JSON.stringify(fp)); } catch (er) { } }
  if (card) { card.style.transition = 'opacity .2s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 200); }
});

/* ---------- World Window ---------- */
const ALLOW = ['https://api.nasa.gov/', 'https://images-api.nasa.gov/', 'https://api.wikimedia.org/', 'https://pixabay.com/api/', 'https://actionglobalnews.com/'];
async function get(url, headers) { if (!ALLOW.some(a => url.startsWith(a))) throw new Error('not allowed'); const key = 'aou_dc_' + url.replace(/[^a-z0-9]/gi, '').slice(-80); try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 6 * 3600e3) return c.v; } catch (e) { } const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 9000); const r = await fetch(url, { signal: ac.signal, credentials: 'omit', headers: headers || {} }); clearTimeout(to); if (!r.ok) throw new Error(String(r.status)); const v = await r.json(); try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (e) { } return v; }
const safeUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const SOURCES = {
  nasa: { name: 'NASA', async load() {
    const key = CONFIG.NASA_KEY || 'DEMO_KEY'; const out = [];
    try { const a = await get(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&thumbs=true`); if (a && a.title) out.push({ title: a.title, text: a.explanation, img: safeUrl(a.media_type === 'video' ? a.thumbnail_url : a.url), url: 'https://apod.nasa.gov/apod/astropix.html', credit: a.copyright ? `Image credit: ${strip(a.copyright)} / NASA APOD` : 'Image credit: NASA, Astronomy Picture of the Day', src: 'NASA APOD', srcUrl: 'https://apod.nasa.gov/' }); } catch (e) { }
    if (!out.length) { try { const q = ['earth', 'moon', 'mars', 'nebula', 'aurora', 'jupiter', 'saturn'][dayNum() % 7]; const j = await get(`https://images-api.nasa.gov/search?q=${q}&media_type=image&page_size=6&year_start=${new Date().getFullYear() - 1}`); (j.collection && j.collection.items || []).slice(0, 4).forEach(it => { const d = it.data && it.data[0]; const l = it.links && it.links[0]; if (!d || !l) return; out.push({ title: d.title, text: d.description, img: safeUrl(l.href), url: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`, credit: `Image credit: NASA${d.center ? ' / ' + d.center : ''}`, src: 'NASA Image Library', srcUrl: 'https://images.nasa.gov/' }); }); } catch (e) { } }
    return out; } },
  wiki: { name: 'Wikipedia', async load() {
    const d = new Date(); const u = `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const j = await get(u, { 'Api-User-Agent': 'allofus.one World Window (info@eyetoad.com)' }); const out = [];
    const art = (p, label) => p && out.push({ title: strip(p.titles ? p.titles.normalized : p.title), text: p.extract || p.description || '', img: safeUrl(p.thumbnail && p.thumbnail.source), url: safeUrl(p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page), credit: 'Text: Wikipedia, CC BY-SA 4.0. Image: Wikimedia Commons, see the article for its license.', src: label, srcUrl: 'https://en.wikipedia.org/' });
    art(j.tfa, 'Wikipedia · featured article');
    if (j.image && j.image.title) out.push({ title: strip(j.image.description && j.image.description.text) || 'Picture of the day', text: '', img: safeUrl(j.image.thumbnail && j.image.thumbnail.source), url: safeUrl(j.image.file_page), credit: `Image: ${strip(j.image.artist && j.image.artist.text) || 'Wikimedia Commons'}${j.image.license && j.image.license.type ? ', ' + strip(j.image.license.type) : ''}`, src: 'Wikimedia Commons · picture of the day', srcUrl: 'https://commons.wikimedia.org/' });
    (j.mostread && j.mostread.articles || []).slice(0, 3).forEach(p => art(p, 'Wikipedia · most read'));
    (j.onthisday || []).slice(0, 2).forEach(e => { const p = e.pages && e.pages[0]; if (p) out.push({ title: `${e.year}: ${strip(e.text).slice(0, 110)}`, text: p.extract || '', img: safeUrl(p.thumbnail && p.thumbnail.source), url: safeUrl(p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page), credit: 'Text: Wikipedia, CC BY-SA 4.0.', src: 'Wikipedia · on this day', srcUrl: 'https://en.wikipedia.org/' }); });
    return out; } },
  news: { name: 'World news', async load() { const j = await get('https://actionglobalnews.com/feed.json'); return (j.items || []).slice(0, 8).map(i => ({ title: strip(i.title), text: strip(i.summary || i.content_text || ''), img: safeUrl(i.image), url: safeUrl(i.url || i.external_url), credit: 'Action Global News', src: 'Action Global News', srcUrl: 'https://actionglobalnews.com/' })); } },
  pixabay: { name: 'Pixabay', async load(q) { const key = CONFIG.PIXABAY_KEY; if (!key) return null; const j = await get(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q || 'calm nature')}&image_type=photo&safesearch=true&per_page=12&orientation=horizontal`); return (j.hits || []).map(h => ({ title: strip(h.tags), text: `By ${strip(h.user)} on Pixabay (Content License).`, img: safeUrl(h.webformatURL), url: safeUrl(h.pageURL), credit: `Photo: ${strip(h.user)} via Pixabay`, src: 'Pixabay', srcUrl: 'https://pixabay.com/', noImgShare: true })); } }
};
const share = (it, me) => { if (!me) { location.href = '/?auth=join'; return; } const u = new URL('/', location.origin); u.searchParams.set('share', it.url); u.searchParams.set('text', `${it.title}\n\n${it.credit}`); location.href = u.toString(); };
export async function discoverView(body, F3) {
  css(); const me = F3.getMe && F3.getMe(); const tab0 = new URLSearchParams(location.search).get('tab') || 'all';
  const tabs = [['all', 'Today'], ['nasa', 'NASA'], ['wiki', 'Wikipedia'], ['news', 'World news']]; if (CONFIG.PIXABAY_KEY) tabs.push(['pixabay', 'Pixabay']);
  body.innerHTML = `<div class="dc-wrap"><div class="dc-hero"><h2>World Window</h2><p>Good things from the open web, with the source on every card. Share one to your feed and the credit comes along.</p></div><div class="dc-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-dt="${k}" class="${k === tab0 ? 'on' : ''}">${n}</button>`).join('')}</div><div id="dc-body"></div><div class="dc-note"><h3>Where this comes from</h3>NASA images are public domain unless a copyright holder is named on the card. Wikipedia text is CC BY-SA 4.0; images on Wikimedia Commons carry their own license, shown on the file page. World news is the Action Global News feed. ${CONFIG.PIXABAY_KEY ? 'Pixabay results are shown here temporarily under the <a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noopener">Pixabay Content License</a>; sharing posts the Pixabay page, not the image file.' : 'Pixabay photos turn on when a free API key is added (see MASTER-GAMEPLAN §Comms).'} allofus.one keeps no record of what you open here.</div></div>`;
  const host = $('#dc-body', body);
  const card = (it) => `<article class="dc-c">${it.img ? `<a href="${esc(it.url)}" target="_blank" rel="noopener"><img src="${esc(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>` : ''}<div class="in"><h4>${esc(it.title)}</h4>${it.text ? `<p>${esc(strip(it.text)).slice(0, 420)}</p>` : ''}<div class="src">${esc(it.credit)} · <a href="${esc(it.srcUrl)}" target="_blank" rel="noopener">${esc(it.src)}</a></div><div class="row">${it.url ? `<a class="fl-btn sm" href="${esc(it.url)}" target="_blank" rel="noopener">Read at the source</a>` : ''}${it.url ? `<button class="fl-btn p sm" type="button" data-share>Share to feed</button>` : ''}</div></div></article>`;
  const draw = async (tab) => {
    host.innerHTML = '<div class="dc-note">Loading…</div>';
    const keys = tab === 'all' ? ['nasa', 'wiki', 'news'] : [tab]; let items = [];
    const pq = tab === 'pixabay' ? (new URLSearchParams(location.search).get('q') || 'calm nature') : '';
    const res = await Promise.all(keys.map(k => SOURCES[k].load(pq).catch(() => [])));
    res.forEach((r, i) => { if (r) items = items.concat(tab === 'all' ? r.slice(0, keys[i] === 'news' ? 3 : 3) : r); });
    if (!items.length) { host.innerHTML = `<div class="dc-note">Nothing loaded right now (a source may be down or rate-limited). Try another tab or come back in a bit.</div>`; return; }
    host.innerHTML = (tab === 'pixabay' ? `<form class="dc-form" id="dc-pq"><input name="q" value="${esc(pq)}" maxlength="60" aria-label="Search Pixabay" placeholder="Search free photos"><button class="fl-btn p" type="submit">Search</button></form>` : '') + `<div class="dc-grid">${items.map(card).join('')}</div>`;
    $$('.dc-c', host).forEach((el, i) => { const b = $('[data-share]', el); if (b) b.onclick = () => share(items[i], me); });
    const f = $('#dc-pq', host); if (f) f.onsubmit = (e) => { e.preventDefault(); const u = new URL(location.href); u.searchParams.set('q', f.q.value.trim().slice(0, 60)); history.replaceState(null, '', u); draw('pixabay'); };
  };
  $$('[data-dt]', body).forEach(b => b.onclick = () => { $$('[data-dt]', body).forEach(x => x.classList.toggle('on', x === b)); try { const u = new URL(location.href); u.searchParams.set('tab', b.dataset.dt); history.replaceState(null, '', u); } catch (e) { } draw(b.dataset.dt); });
  await draw(tab0);
}

/* ---------- admin: Members & email ---------- */
export async function adminEmail(main, { sb, me, toast }) {
  main.innerHTML = `<div class="fl-card"><h3>Members &amp; email</h3><p class="muted">Who said yes to the occasional update, and the weekly digest controls. Needs <code>v27-growth.sql</code> and the <code>weekly-digest</code> function (MASTER-GAMEPLAN §Comms).</p><div class="ad-kpis" id="em-k"><div class="ad-kpi"><b>…</b><small>MEMBERS</small></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="fl-btn p" type="button" data-em-test>Send test digest to me</button><button class="fl-btn" type="button" data-em-wel>Send test welcome to me</button><a class="fl-btn" href="/?v=spark">Preview this week's spark</a></div><p class="muted" id="em-msg" style="margin-top:8px;font-size:12px"></p></div>
  <div class="fl-card"><h3>How the emails work</h3><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#334155"><li><b>Welcome</b>: one email on sign-up (Database webhook on profiles → <code>welcome-mail</code>). Three things to do first, plus the tour link.</li><li><b>Weekly digest</b> (Sundays): only to members with <code>email_optin</code> on. New members, the top posts, this week's spark, one feature spotlight. One-click unsubscribe in the footer.</li><li><b>Never</b>: marketing to people who did not opt in; no tracking pixels in any email.</li></ul></div>`;
  const k = $('#em-k', main), msg = $('#em-msg', main);
  try { const { data, error } = await sb.rpc('aou_email_stats'); if (error) throw error; const S = data || {}; k.innerHTML = [['members', 'MEMBERS'], ['opted_in', 'OPTED IN'], ['opted_in_7d', 'OPTED IN · 7D'], ['new_members_7d', 'NEW · 7D'], ['with_pubkey', 'WITH ID KEY']].map(([a, b]) => `<div class="ad-kpi"><b>${S[a] == null ? '—' : Number(S[a]).toLocaleString()}</b><small>${b}</small></div>`).join(''); }
  catch (e) { k.innerHTML = `<div class="ad-kpi"><b>—</b><small>RUN v27-growth.sql</small></div>`; msg.textContent = /function|schema cache|does not exist/i.test(e.message || '') ? 'Run supabase/_parts/v27-growth.sql, then reload.' : (e.message || String(e)); }
  const call = async (fn, body, btn) => { btn.disabled = true; msg.textContent = 'Sending…'; try { const { data, error } = await sb.functions.invoke(fn, { body }); if (error) throw error; msg.textContent = (data && (data.message || JSON.stringify(data))) || 'Sent.'; toast('Sent'); } catch (e) { msg.textContent = `Not sent: ${e.message || e}. Is the ${fn} function deployed with RESEND_API_KEY set?`; } btn.disabled = false; };
  $('[data-em-test]', main).onclick = (e) => call('weekly-digest', { test: true }, e.currentTarget);
  $('[data-em-wel]', main).onclick = (e) => call('welcome-mail', { test: true, user_id: me.id }, e.currentTarget);
}

/* ---------- /?unsub=<token> from an email footer: one click, no sign-in needed ---------- */
export async function handleUnsub(sb) {
  const q = new URLSearchParams(location.search); const token = q.get('unsub'); if (!token || !sb) return;
  css(); let ok = false, msg = '';
  if (/^[0-9a-f-]{36}$/i.test(token)) { try { const { data, error } = await sb.rpc('unsubscribe', { token }); if (error) throw error; ok = !!data; msg = ok ? 'Done. You are unsubscribed from allofus updates. Account notices (like password resets) still arrive.' : 'That link was already used, or the address is not subscribed. Nothing else to do.'; } catch (e) { msg = 'Could not unsubscribe right now: ' + (e.message || e) + '. Email info@eyetoad.com and we will do it by hand.'; } }
  else msg = 'That unsubscribe link looks incomplete. Email info@eyetoad.com and we will take care of it.';
  const bar = document.createElement('div'); bar.className = 'tr-offer'; bar.setAttribute('role', 'status'); bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99990;background:#0b1a3a;color:#fff;border-radius:16px;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 18px 50px rgba(2,8,30,.4);font:600 13.5px Poppins,Arial;max-width:min(520px,calc(100vw - 24px))';
  bar.innerHTML = `<span>${esc(msg)}</span><button type="button" style="border:0;border-radius:10px;min-height:36px;padding:0 12px;font:700 13px Poppins,Arial;cursor:pointer;background:#fff;color:#0b1a3a">OK</button>`; bar.lastChild.onclick = () => bar.remove(); document.body.appendChild(bar);
  try { const u = new URL(location.href); u.searchParams.delete('unsub'); history.replaceState(null, '', u); } catch (e) { }
}

/* ---------- a sign-up that needed email confirmation could not store the opt-in; apply it on the first signed-in load ---------- */
export async function applyPendingOptin(sb, me) {
  let v = null; try { v = localStorage.getItem('aou_email_optin_pending'); } catch (e) { } if (!v || !sb || !me) return;
  try { const { error } = await sb.from('profiles').update({ email_optin: v === '1' }).eq('id', me.id); if (!error || !/column|schema cache/i.test(error.message || '')) localStorage.removeItem('aou_email_optin_pending'); } catch (e) { }
}

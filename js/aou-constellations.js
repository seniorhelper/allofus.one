/* ============================================================
   allofus.one · Constellations (v30, Oct 25 2026) · runs /constellations/
   Communities drawn as a live star map: every member is a star, every Constellation a shape, genres are regions of sky.
   Old-web soul inside each one: window chrome, a marquee, a flip counter, a guestbook, a webring and an 88x31 badge.
   Data: public.spaces (+ genre/status from supabase/_parts/v30-rooms-constellations.sql), space_members,
   constellation_guestbook, constellation_counts(), constellation_review() (admins). Rooms live at /chat/?r=c-<slug>.
   Works before v30 runs: everything reads as approved 'gathering' and the guestbook/review parts stay hidden.
   ============================================================ */
import { CONFIG } from './aou-config.js';
import { screen, STRIKE_TEXT } from './aou-match-safety.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const toast = (m, ms = 3200) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); };
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const FOUNDER = '320bf5d4-2d2d-482e-8633-87ced55e4155';

/* twelve genres, each with its own hand-drawn glyph (24x24, stroke) and a region of the sky */
const G = {
  gathering: ['Gathering', 'Meetups and good company', '#e0567a', '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="4" r="1.6"/><circle cx="19" cy="9" r="1.6"/><circle cx="17" cy="18" r="1.6"/><circle cx="7" cy="18" r="1.6"/><circle cx="5" cy="9" r="1.6"/>'],
  party: ['Party', 'Celebrations and nights out', '#e8590c', '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2"/>'],
  guild: ['Guild', 'Crafts, trades and skills', '#7c5c2e', '<path d="M4 15h11l3-3H7z"/><path d="M9 15v5h5v-5"/><path d="M13 9l5-5 2 2-5 5"/>'],
  salon: ['Salon', 'Ideas, books and big talk', '#7c3aed', '<path d="M4 6h10v7H8l-4 3z"/><path d="M14 9h6v7l-3-2h-6v-1"/>'],
  jam: ['Jam', 'Music, art and making things', '#0e8f7e', '<path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4"/>'],
  summit: ['Summit', 'Business, goals and big plans', '#1d4ed8', '<path d="M2 20l7-12 4 6 3-4 6 10z"/><path d="M9 8l1.5 2.5"/>'],
  market: ['Market', 'Buy, sell, swap and give', '#0f766e', '<path d="M3 9l2-5h14l2 5"/><path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path d="M5 12v8h14v-8"/>'],
  quest: ['Quest', 'Outdoors, travel and adventure', '#b45309', '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'],
  haven: ['Haven', 'Support, recovery and comfort', '#d97706', '<path d="M9 4h6l1 3H8z"/><path d="M8 7h8v9a4 4 0 0 1-8 0z"/><path d="M12 10v4"/><path d="M10 20h4"/>'],
  kin: ['Kin', 'Family, parents and caregivers', '#db2777', '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>'],
  lab: ['Lab', 'Tech, science and makers', '#4338ca', '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'],
  arena: ['Arena', 'Games, sports and play', '#be123c', '<path d="M12 3l7 3v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'],
};
const GK = Object.keys(G);
const glyph = (g, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(G[g] || G.gathering)[3]}</svg>`;
const SWATCH = ['#e0567a', '#e8590c', '#d97706', '#0e8f7e', '#0f766e', '#1d4ed8', '#4338ca', '#7c3aed', '#db2777', '#14183a'];

let sb = null, me = null, admin = false, ALL = [], COUNTS = new Map(), MINE = new Set(), filter = '';
const norm = (r) => ({ ...r, genre: G[r.genre] ? r.genre : 'gathering', status: r.status || 'approved', color: r.color || G[r.genre || 'gathering']?.[2] || '#4338ca' });
const live = () => ALL.filter((c) => c.status === 'approved');
const members = (c) => Number((COUNTS.get(c.slug) || {}).members || 0);

/* ---------- the sky ---------- */
let SKY = null;
function buildSky() {
  const cv = $('#sky'), box = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = box.width * dpr; cv.height = box.height * dpr;
  const W = box.width, H = box.height, top = innerWidth < 761 ? 300 : 210;
  const R = rng(7), dust = Array.from({ length: Math.round(W * H / 2600) }, () => ({ x: R() * W, y: R() * H * .92, r: R() * 1.2 + .2, p: R() * 6.28, s: .5 + R() * 1.5 }));
  // genre regions on a loose band across the sky
  const cols = innerWidth < 761 ? 3 : 6, rows = Math.ceil(GK.length / cols);
  const region = (g) => { const i = GK.indexOf(g); const cx = (i % cols + .5) / cols, cy = (Math.floor(i / cols) + .5) / rows; return { x: 30 + cx * (W - 60), y: top + cy * (H - top - 70) }; };
  const shapes = live().map((c) => {
    const r = rng(hash(c.slug)), n = Math.max(3, Math.min(9, 3 + Math.round(Math.log2(members(c) + 1) * 1.6))), base = region(c.genre);
    const spread = Math.min(W / cols, (H - top) / rows) * .42;
    const ox = (r() - .5) * spread * .9, oy = (r() - .5) * spread * .6;
    const pts = Array.from({ length: n }, () => ({ x: base.x + ox + (r() - .5) * spread, y: base.y + oy + (r() - .5) * spread * .7, r: 1.6 + r() * 1.8, p: r() * 6.28 }));
    // a chain through nearest neighbours draws the shape
    const order = [pts[0]], left = pts.slice(1); while (left.length) { const a = order[order.length - 1]; left.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)); order.push(left.shift()); }
    const cx = order.reduce((s, p) => s + p.x, 0) / n, cy = order.reduce((s, p) => s + p.y, 0) / n;
    return { c, pts: order, cx, cy, col: c.color };
  });
  // genres nobody has lit yet show a faint ghost shape that invites the first one
  for (const g of GK) { if (shapes.some((s) => s.c.genre === g)) continue; const r = rng(hash('ghost-' + g)), base = region(g), sp = Math.min(W / cols, (H - top) / rows) * .32; const pts = Array.from({ length: 4 }, () => ({ x: base.x + (r() - .5) * sp, y: base.y + (r() - .5) * sp * .6, r: 1.2, p: r() * 6.28 })); shapes.push({ ghost: g, c: { name: G[g][0] + ' · light the first one', genre: g, slug: '' }, pts, cx: pts.reduce((a, p) => a + p.x, 0) / 4, cy: base.y, col: G[g][2] }); }
  SKY = { cv, ctx: cv.getContext('2d'), W, H, dpr, dust, shapes, hot: null };
}
function drawSky(t) {
  if (!SKY) return; const { ctx, W, H, dpr, dust, shapes, hot } = SKY; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const d of dust) { const a = still ? .6 : .35 + .35 * Math.sin(d.p + t / 1000 * d.s); ctx.fillStyle = `rgba(255,248,230,${a})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.28); ctx.fill(); }
  for (const s of shapes) {
    const on = hot === s; ctx.globalAlpha = s.ghost && !on ? .38 : 1; ctx.lineWidth = on ? 2.4 : 1.4; ctx.strokeStyle = on ? '#fff' : 'rgba(255,240,220,.55)'; ctx.setLineDash(on ? [] : [4, 5]);
    ctx.beginPath(); s.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
    for (const p of s.pts) { const tw = still ? 1 : 1 + .25 * Math.sin(p.p + t / 600); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5 * tw); g.addColorStop(0, '#fff'); g.addColorStop(.25, s.col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5 * tw, 0, 6.28); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (on ? 1.4 : 1), 0, 6.28); ctx.fill(); }
    ctx.font = `${on ? 700 : 600} ${on ? 14 : 12}px "Bricolage Grotesque", Arial`; ctx.fillStyle = on ? '#fff' : 'rgba(255,245,230,.85)'; ctx.textAlign = 'center'; ctx.fillText(s.c.name.slice(0, 34), s.cx, Math.max(...s.pts.map((p) => p.y)) + 20); ctx.globalAlpha = 1;
  }
  if (!still) requestAnimationFrame(drawSky);
}
function hitShape(x, y) { if (!SKY) return null; let best = null, bd = 46; for (const s of SKY.shapes) for (const p of s.pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = s; } } return best; }
function wireSky() {
  const cv = $('#sky'), tip = $('#tip');
  cv.addEventListener('mousemove', (e) => { const b = cv.getBoundingClientRect(), s = hitShape(e.clientX - b.left, e.clientY - b.top); SKY.hot = s; cv.style.cursor = s ? 'pointer' : 'default'; if (s) { tip.style.display = 'block'; tip.style.left = Math.min(e.clientX - b.left + 16, b.width - 270) + 'px'; tip.style.top = (e.clientY - b.top + 14) + 'px'; tip.innerHTML = s.ghost ? `<b>${esc(G[s.ghost][0])}</b>${esc(G[s.ghost][1])}. Nobody has lit one yet. Click to be first.` : `<b>${esc(s.c.name)}</b>${esc(G[s.c.genre][0])} · ${members(s.c)} ${members(s.c) === 1 ? 'star' : 'stars'}`; } else tip.style.display = 'none'; if (matchMedia('(prefers-reduced-motion: reduce)').matches) drawSky(0); });
  cv.addEventListener('mouseleave', () => { SKY.hot = null; tip.style.display = 'none'; });
  cv.addEventListener('click', (e) => { const b = cv.getBoundingClientRect(), s = hitShape(e.clientX - b.left, e.clientY - b.top); if (s) { if (s.ghost) openCreate(s.ghost); else openDetail(s.c.slug); } });
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { buildSky(); drawSky(0); }, 200); });
}
function flip(n) { $('#flip').innerHTML = String(n).padStart(5, '0').split('').map((d) => `<i>${d}</i>`).join(''); }

/* ---------- cards ---------- */
function starsSVG(c) { const r = rng(hash(c.slug)), n = Math.max(3, Math.min(9, 3 + Math.round(Math.log2(members(c) + 1) * 1.6))); const pts = Array.from({ length: n }, (_, i) => [12 + i * (276 / n) + r() * 18, 10 + r() * 38]); return `<svg class="mystars" viewBox="0 0 300 58" aria-hidden="true"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${c.color}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".7"/>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${c.color}"/><circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('')}</svg>`; }
function card(c, extra = '') { return `<article class="win" style="--g:${c.color}" data-open="${esc(c.slug)}" tabindex="0" role="button" aria-label="Open ${esc(c.name)}"><div class="bar">${esc(G[c.genre][0].toUpperCase())}.EXE<span class="dots"><i></i><i></i><i></i></span></div><div class="body"><h3>${glyph(c.genre)}${esc(c.name)}</h3>${starsSVG(c)}<p>${esc((c.about || G[c.genre][1]).slice(0, 140))}</p><div class="mini"><span>${members(c)} ${members(c) === 1 ? 'star' : 'stars'}</span>${c.kind === 'official' ? '<span>Official</span>' : ''}${c.status !== 'approved' ? `<span class="pend">${esc(c.status)}</span>` : ''}${extra}</div></div></article>`; }
function drawGrid() {
  const list = live().filter((c) => !filter || c.genre === filter).sort((a, b) => members(b) - members(a) || a.name.localeCompare(b.name));
  $('#grid').innerHTML = list.map((c) => card(c)).join('') || `<div class="empty">No ${filter ? esc(G[filter][0]) + ' ' : ''}Constellations yet. <button class="btn sm gold" data-light>Light the first one</button></div>`;
  $$('.genre').forEach((b) => b.classList.toggle('on', b.dataset.g === filter));
}
function drawMine() {
  if (!me) return; const mine = ALL.filter((c) => c.owner === me.id || MINE.has(c.slug));
  $('#mine-band').hidden = !mine.length; $('#mine').innerHTML = mine.map((c) => card(c, c.owner === me.id ? '<span>You started it</span>' : '<span>Member</span>')).join('');
}
function drawQueue() {
  if (!admin) return; const q = ALL.filter((c) => c.status === 'pending' || c.status === 'paused');
  $('#queue-band').hidden = false;
  $('#queue').innerHTML = q.map((c) => `<article class="win" style="--g:${c.color}"><div class="bar">REVIEW · ${esc(c.status.toUpperCase())}</div><div class="body"><h3>${glyph(c.genre)}${esc(c.name)}</h3><p><b>${esc(G[c.genre][0])}</b> · /${esc(c.slug)} · started ${new Date(c.created_at).toLocaleString()}</p><p>${esc(c.about || '(no description)')}</p><input type="text" placeholder="Note to the creator (optional)" data-note="${esc(c.slug)}"><div class="row"><button class="btn sm gold" data-review="approved" data-slug="${esc(c.slug)}">Approve</button><button class="btn sm" data-review="paused" data-slug="${esc(c.slug)}">Pause</button><button class="btn sm" data-review="rejected" data-slug="${esc(c.slug)}">Turn down</button></div></div></article>`).join('') || '<div class="empty">Nothing waiting. The sky is tidy.</div>';
}

/* ---------- a Constellation's window ---------- */
function windowOv(title, color, html) { $$('.ov').forEach((o) => o.remove()); const o = document.createElement('div'); o.className = 'ov'; o.innerHTML = `<article class="win" style="--g:${color}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="bar">${esc(title)}<button type="button" data-x aria-label="Close">X</button></div><div class="body">${html}</div></article>`; document.body.appendChild(o); const x = () => { o.remove(); if (location.hash) history.replaceState(null, '', location.pathname); }; $('[data-x]', o).onclick = x; o.addEventListener('click', (e) => { if (e.target === o) x(); }); document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { x(); document.removeEventListener('keydown', k); } }); $('[data-x]', o).focus(); return o; }
async function openDetail(slug) {
  const c = ALL.find((x) => x.slug === slug); if (!c) return; history.replaceState(null, '', '#' + slug);
  const ring = live().filter((x) => x.genre === c.genre); const i = ring.findIndex((x) => x.slug === slug);
  const prev = ring[(i - 1 + ring.length) % ring.length], next = ring[(i + 1) % ring.length];
  const isMember = MINE.has(slug), owner = me && c.owner === me.id; const roomSlug = c.kind === 'official' ? 'general' : 'c-' + c.slug;
  const o = windowOv(`${G[c.genre][0].toUpperCase()}.EXE · ${c.name}`, c.color, `
    <div class="marquee" aria-hidden="true"><span>★ Welcome to ${esc(c.name)} ★ ${esc(c.about || G[c.genre][1])} ★ Sign the guestbook ★</span></div>
    <div class="dhead">${glyph(c.genre, 'gl')}<div><h3>${esc(c.name)}</h3><small>${esc(G[c.genre][0])} · ${esc(G[c.genre][1])}${c.status !== 'approved' ? ' · ' + esc(c.status) + (c.review_note ? ': ' + esc(c.review_note) : '') : ''}</small></div><div class="act"><span class="flip" aria-label="${members(c)} members">${String(members(c)).padStart(4, '0').split('').map((d) => `<i>${d}</i>`).join('')}</span></div></div>
    ${starsSVG(c)}
    <p>${esc(c.about || '')}</p>
    <div class="row">${c.status === 'approved' ? (isMember ? `<button class="btn sm" data-leave="${esc(slug)}">Leave</button>` : `<button class="btn sm gold" data-join="${esc(slug)}">Join · become a star</button>`) : ''}<a class="btn sm" href="/chat/?r=${encodeURIComponent(roomSlug)}">Enter the Room</a><a class="btn sm" href="/?g=${encodeURIComponent(slug)}">Open the feed</a>${owner ? '<span class="mini"><span>You started this one</span></span>' : ''}</div>
    ${ring.length > 1 ? `<nav class="ring" aria-label="${esc(G[c.genre][0])} ring"><button data-open="${esc(prev.slug)}">◀ ${esc(prev.name.slice(0, 18))}</button><span>${esc(G[c.genre][0].toUpperCase())} RING</span><button data-random="${esc(c.genre)}">✦ random</button><button data-open="${esc(next.slug)}">${esc(next.name.slice(0, 18))} ▶</button></nav>` : ''}
    <h4 style="font:700 18px var(--fd);margin:6px 0 0">Guestbook</h4>
    ${c.status === 'approved' ? `<form id="gb-f" class="row" style="align-items:stretch"><input type="text" id="gb-t" maxlength="280" placeholder="${me ? 'Leave a note for this Constellation…' : 'Join allofus to sign the guestbook'}" ${me ? '' : 'disabled'} aria-label="Guestbook note" style="flex:1;min-width:200px"><button class="btn sm" ${me ? '' : 'disabled'}>Sign</button></form><div class="shield" id="gb-s" hidden></div>` : '<p class="lead" style="font-size:15px">The guestbook opens once this Constellation is approved.</p>'}
    <div class="gb" id="gb"><div class="empty">Loading notes…</div></div>
    <details><summary><b>Get the 88x31 badge</b> for your site or profile</summary><p style="margin:8px 0">A tiny old-web button that links back here.</p><canvas class="badge88" id="b88" width="88" height="31"></canvas><div class="row" style="margin-top:8px"><button class="btn sm" data-dl>Download PNG</button><button class="btn sm" data-copy>Copy link HTML</button></div></details>`);
  drawBadge($('#b88', o), c);
  $('[data-dl]', o).onclick = () => { const a = document.createElement('a'); a.download = `allofus-${c.slug}-88x31.png`; a.href = $('#b88', o).toDataURL('image/png'); a.click(); };
  $('[data-copy]', o).onclick = async () => { const h = `<a href="https://allofus.one/constellations/#${c.slug}"><img src="allofus-${c.slug}-88x31.png" width="88" height="31" alt="${esc(c.name)} on allofus.one"></a>`; try { await navigator.clipboard.writeText(h); toast('Badge HTML copied. Upload the PNG next to it.'); } catch (e) { toast('Could not copy.'); } };
  const f = $('#gb-f', o); if (f) { const t = $('#gb-t', o), s = $('#gb-s', o); t.oninput = () => { const r = screen(t.value); s.hidden = r.level === 'ok'; s.className = 'shield ' + r.level; s.textContent = r.level === 'block' ? 'Blocked by the Shield. ' + STRIKE_TEXT : r.level === 'warn' ? 'Heads-up: ' + r.hits.map((h) => h.label).join('; ') : ''; }; f.onsubmit = async (e) => { e.preventDefault(); const body = t.value.trim(); if (!body || !sb || !me) return; if (screen(body).level === 'block') { t.oninput(); return; } const { data, error } = await sb.from('constellation_guestbook').insert({ space_slug: slug, body }).select().single(); if (error) { toast(/relation|schema/.test(error.message) ? 'Guestbooks open after tonight\'s update.' : error.message); return; } if (data.status === 'removed') { toast('Blocked by the Shield. ' + STRIKE_TEXT, 6000); } else toast('Signed. Thank you.'); t.value = ''; loadGB(slug, o); }; }
  loadGB(slug, o);
}
async function loadGB(slug, o) {
  const box = $('#gb', o); if (!sb) { box.innerHTML = ''; return; }
  const { data, error } = await sb.from('constellation_guestbook').select('id,user_id,body,created_at,status').eq('space_slug', slug).order('created_at', { ascending: false }).limit(40);
  if (error) { box.innerHTML = '<div class="empty">The guestbook opens after tonight\'s update.</div>'; return; }
  const ids = [...new Set((data || []).map((n) => n.user_id))]; const names = new Map();
  if (ids.length) { const { data: pr } = await sb.from('profiles').select('id,username,display_name').in('id', ids); (pr || []).forEach((p) => names.set(p.id, p)); }
  box.innerHTML = (data || []).filter((n) => n.status === 'ok').map((n) => { const p = names.get(n.user_id) || {}; return `<div class="n"><b>${p.username ? `<a href="/?u=${encodeURIComponent(p.username)}">${esc(p.display_name || '@' + p.username)}</a>` : 'A member'}</b><time>${new Date(n.created_at).toLocaleDateString()}</time><p>${esc(n.body)}</p></div>`; }).join('') || '<div class="empty">No notes yet. Be the first to sign.</div>';
}
function drawBadge(cv, c) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#14183a'; x.fillRect(0, 0, 88, 31); x.fillStyle = c.color; x.fillRect(1, 1, 30, 29); const r = rng(hash(c.slug)); x.fillStyle = '#fff'; for (let i = 0; i < 6; i++) x.fillRect(4 + Math.floor(r() * 23), 4 + Math.floor(r() * 22), 2, 2); x.fillStyle = '#ffe9b8'; x.font = 'bold 9px monospace'; x.fillText(c.name.slice(0, 9).toUpperCase(), 34, 13); x.fillStyle = '#9fb3ff'; x.font = '8px monospace'; x.fillText('allofus.one', 34, 25); x.strokeStyle = '#fff'; x.strokeRect(.5, .5, 87, 30); }

/* ---------- light a new one ---------- */
function openCreate(preset) {
  if (!me) { try { localStorage.setItem('aou_next', '/constellations/'); } catch (e) { } location.href = '/?auth=join'; return; }
  let genre = G[preset] ? preset : 'gathering', color = G[genre][2];
  const o = windowOv('LIGHT.EXE · a new Constellation', color, `<p style="margin:0">Pick a genre, give it your own title, and say what it's for. A person at allofus reviews every new Constellation, usually within a day. Then it lights up in the sky with its own Room, feed and guestbook.</p>
    <div class="gpick" id="gp">${GK.map((g) => `<button type="button" data-g="${g}" style="--g:${G[g][2]}" class="${g === genre ? 'on' : ''}">${glyph(g)}<span>${G[g][0]}<small>${G[g][1]}</small></span></button>`).join('')}</div>
    <label class="f">Title<input type="text" id="cn" maxlength="60" placeholder="Saturday Trail Crew"></label>
    <label class="f">What is it for?<textarea id="ca" rows="3" maxlength="600" placeholder="Easy weekend hikes around Denver. All paces welcome."></textarea></label>
    <div class="row"><label class="f" style="flex:1">Who can join<select id="cv"><option value="public">Anyone</option><option value="request">By request</option></select></label></div>
    <div><span class="f" style="font:700 12px var(--fu);letter-spacing:.12em;color:var(--mut)">COLOR</span><div class="sw" id="sw">${SWATCH.map((c) => `<button type="button" style="--c:${c}" data-c="${c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
    <div class="shield" id="cs" hidden></div>
    <div class="row"><button class="btn gold" id="cgo" type="button">Send it for review</button><span class="mini"><span>Up to 3 waiting at a time</span></span></div>`);
  const bar = $('.win', o); const setC = (c) => { color = c; bar.style.setProperty('--g', c); $$('#sw button', o).forEach((b) => b.classList.toggle('on', b.dataset.c === c)); };
  $$('#gp button', o).forEach((b) => b.onclick = () => { genre = b.dataset.g; $$('#gp button', o).forEach((x) => x.classList.toggle('on', x === b)); setC(G[genre][2]); });
  $$('#sw button', o).forEach((b) => b.onclick = () => setC(b.dataset.c)); setC(color);
  const chk = () => { const r = screen($('#cn', o).value + ' ' + $('#ca', o).value), s = $('#cs', o); s.hidden = r.level === 'ok'; s.className = 'shield ' + r.level; s.textContent = r.level === 'block' ? 'Blocked by the Shield. ' + STRIKE_TEXT : r.level === 'warn' ? 'Heads-up: ' + r.hits.map((h) => h.label).join('; ') : ''; $('#cgo', o).disabled = r.level === 'block'; };
  $('#cn', o).oninput = chk; $('#ca', o).oninput = chk;
  $('#cgo', o).onclick = async () => {
    const name = $('#cn', o).value.trim(), about = $('#ca', o).value.trim(); if (name.length < 3) { toast('Give it a title (3+ letters).'); return; } if (screen(name + ' ' + about).level === 'block') return;
    let slug = slugify(name); if (slug.length < 3) slug = 'c-' + Date.now().toString(36); if (ALL.some((c) => c.slug === slug)) slug = (slug + '-' + Math.random().toString(36).slice(2, 5)).slice(0, 40);
    const row = { slug, owner: me.id, name, about, color, visibility: $('#cv', o).value, genre, kind: 'community' };
    $('#cgo', o).disabled = true; let { data, error } = await sb.from('spaces').insert(row).select().single();
    if (error && /genre|status|column/.test(error.message)) { delete row.genre; ({ data, error } = await sb.from('spaces').insert(row).select().single()); }
    $('#cgo', o).disabled = false;
    if (error) { toast(/adult|row-level/.test(error.message) ? 'Please confirm your date of birth on your profile first.' : error.message.replace(/^.*SHIELD:\s*/, 'Shield: ')); return; }
    ALL.unshift(norm(data)); o.remove(); drawMine(); drawQueue();
    windowOv('SENT.EXE', color, `<p><b>${esc(name)}</b> is waiting for review. You'll see it under <b>Yours</b> on this page, and it lights up in the sky as soon as it's approved.</p><p><button class="btn gold" data-x2>Back to the sky</button></p>`).querySelector('[data-x2]').onclick = () => $$('.ov').forEach((x) => x.remove());
  };
}

/* ---------- boot ---------- */
export async function bootConstellations() {
  $('#genres').innerHTML = `<button class="genre on" data-g="">All</button>` + GK.map((g) => `<button class="genre" data-g="${g}" style="--g:${G[g][2]}">${glyph(g)}${G[g][0]}</button>`).join('');
  flip(0);
  document.addEventListener('click', async (e) => {
    const g = e.target.closest('.genre'); if (g) { filter = g.dataset.g; drawGrid(); return; }
    const op = e.target.closest('[data-open]'); if (op) { openDetail(op.dataset.open); return; }
    const rd = e.target.closest('[data-random]'); if (rd) { const l = live().filter((c) => c.genre === rd.dataset.random); openDetail(l[Math.floor(Math.random() * l.length)].slug); return; }
    if (e.target.closest('#light,[data-light]')) { openCreate(filter); return; }
    const j = e.target.closest('[data-join],[data-leave]'); if (j) { if (!me) { try { localStorage.setItem('aou_next', '/constellations/'); } catch (x) { } location.href = '/?auth=join'; return; } const slug = j.dataset.join || j.dataset.leave; const { error } = j.dataset.join ? await sb.from('space_members').insert({ space_slug: slug, user_id: me.id }) : await sb.from('space_members').delete().eq('space_slug', slug).eq('user_id', me.id); if (error && !/duplicate/.test(error.message)) { toast(/adult|row-level/.test(error.message) ? 'Please confirm your date of birth on your profile first.' : error.message); return; } if (j.dataset.join) { MINE.add(slug); bump(slug, 1); toast('You are a star in this Constellation now.'); } else { MINE.delete(slug); bump(slug, -1); toast('Left.'); } openDetail(slug); drawGrid(); drawMine(); return; }
    const rv = e.target.closest('[data-review]'); if (rv) { const note = ($(`[data-note="${rv.dataset.slug}"]`) || {}).value || null; const { error } = await sb.rpc('constellation_review', { p_slug: rv.dataset.slug, p_decision: rv.dataset.review, p_note: note }); if (error) { toast(error.message); return; } const c = ALL.find((x) => x.slug === rv.dataset.slug); if (c) c.status = rv.dataset.review; drawQueue(); drawGrid(); buildSky(); toast('Done: ' + rv.dataset.review); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.win[data-open]')) openDetail(e.target.dataset.open); });
  const bump = (slug, d) => { const c = COUNTS.get(slug) || { members: 0 }; c.members = Math.max(0, Number(c.members) + d); COUNTS.set(slug, c); };
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY); try { (await import('./aou-safety.js')).guardClient(sb); } catch (e) { }
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      const { data: pr } = await sb.from('profiles').select('id,username,display_name').eq('id', session.user.id).maybeSingle();
      me = { id: session.user.id, username: pr && pr.username, name: pr && (pr.display_name || pr.username) };
      const chip = $('#me-chip'); chip.textContent = '@' + (me.username || 'me'); chip.href = '/?v=u';
      admin = me.id === FOUNDER; if (!admin) { try { const { data } = await sb.rpc('is_admin'); admin = !!data; } catch (e) { } }
      const { data: mem } = await sb.from('space_members').select('space_slug').eq('user_id', me.id).eq('status', 'in'); (mem || []).forEach((m) => MINE.add(m.space_slug));
    }
    const { data } = await sb.from('spaces').select('*').order('created_at', { ascending: false }).limit(500); ALL = (data || []).map(norm);
    try { const { data: cnt, error } = await sb.rpc('constellation_counts'); if (error) throw error; (cnt || []).forEach((r) => COUNTS.set(r.slug, r)); }
    catch (e) { const { data: m } = await sb.from('space_members').select('space_slug').eq('status', 'in').limit(5000); (m || []).forEach((r) => { const c = COUNTS.get(r.space_slug) || { members: 0 }; c.members++; COUNTS.set(r.space_slug, c); }); }
  } catch (e) { console.warn('constellations offline', e); }
  flip(live().reduce((s, c) => s + members(c), 0));
  drawGrid(); drawMine(); drawQueue(); buildSky(); wireSky(); requestAnimationFrame(drawSky);
  const h = decodeURIComponent(location.hash.slice(1)); if (h && ALL.some((c) => c.slug === h)) openDetail(h);
}

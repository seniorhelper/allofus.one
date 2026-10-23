/* ============================================================
   allofus.one · UX layer (Oct 23 2026)
   One outline icon set, the emblem tiles (tinted rounded square + gradient ring), the grouped
   main menu (You · Connect · Create & Grow · Explore) used by the header row, the home rail,
   the Tools card and the More sheet, the signed-in boot cache (no "Sign in" flash), and the
   CSS that styles all of it plus the admin panel. No library, no network.
   ============================================================ */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- icons: 24 × 24, 1.9 stroke, round joins ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2c2.1.7 3.5 2.8 3.5 5.8"/>',
  groups: '<circle cx="12" cy="6.5" r="3"/><circle cx="5.5" cy="16.5" r="2.7"/><circle cx="18.5" cy="16.5" r="2.7"/><path d="M10.2 9.2 7.2 14M13.8 9.2l3 4.8M8.4 16.5h7.2"/>',
  video: '<rect x="2.5" y="5.5" width="13" height="13" rx="3"/><path d="m15.5 10 6-3.5v11l-6-3.5"/>',
  brand: '<path d="M3.5 9 5 4h14l1.5 5"/><path d="M3.5 9a2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0"/><path d="M5 11.5V20h14v-8.5"/><path d="M10 20v-5h4v5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5H13"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8 13.5h3v3H8z"/>',
  inbox: '<path d="M3 13.5 5.5 5h13l2.5 8.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
  board: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M17.25 13.5v7.5M13.5 17.25H21"/>',
  rocket: '<path d="M12 15.5 8.5 12C10 6.5 14 3.5 20.5 3.5 20.5 10 17.5 14 12 15.5z"/><path d="M8.5 12H5l2.5-3.5h4M12 15.5V19l3.5-2.5v-4"/><circle cx="15.5" cy="8.5" r="1.6"/><path d="M6 18c-1 .8-1.6 2-1.5 3.5 1.5.1 2.7-.5 3.5-1.5"/>',
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>',
  sliders: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.4"/><circle cx="10" cy="12" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/>',
  hub: '<circle cx="12" cy="12" r="2.2"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
  phone: '<path d="M5 3.5h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6.5 6.5l1.5-2.3 4.5 1.8V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  cube: '<path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="m4 7.4 8 4.6 8-4.6M12 12v9.2"/>',
  vr: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v6a2.5 2.5 0 0 1-2.5 2.5h-3l-2-2.5h-3l-2 2.5h-3A2.5 2.5 0 0 1 3 14.5z"/><circle cx="8" cy="11.5" r="1.6"/><circle cx="16" cy="11.5" r="1.6"/>',
  game: '<path d="M7 7h10a5 5 0 0 1 4.8 6.3l-.9 3.4a2.6 2.6 0 0 1-4.4 1.2L14.3 16H9.7l-2.2 1.9a2.6 2.6 0 0 1-4.4-1.2l-.9-3.4A5 5 0 0 1 7 7z"/><path d="M7.5 10.2v3.4M5.8 11.9h3.4"/><circle cx="15.8" cy="10.8" r=".9" fill="currentColor"/><circle cx="17.8" cy="13" r=".9" fill="currentColor"/>',
  cam: '<path d="M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5C7 18 10 18.5 12 20c2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V20"/>',
  hex: '<path d="M7.5 4h9l4.5 8-4.5 8h-9L3 12z"/><circle cx="12" cy="12" r="2.6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.9-3.9"/>',
  invite: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7 1.6 0 3 .5 4.2 1.3M19 14v6M16 17h6"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/>',
  bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 11v9M9 4.5 10.5 7M15 4.5 13.5 7M3.5 10.5H7M17 10.5h3.5M3.5 15.5H7M17 15.5h3.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H16"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  hash: '<path d="M5 9h15M4 15h15M10 3.5 8 20.5M16 3.5l-2 17"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-7M21 20H3"/>',
  pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  bookmark: '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z"/>',
  news: '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6"/><path d="M7 8h7M7 12h7M7 16h4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2-5.2 3.6-6.9.4 1.6 1.4 2.8 2.6 3.3C11 7.6 12.3 5 15 3c.3 2.5 1.3 4.3 2.6 5.8C19 10.4 19 12.2 19 14.4 19 18.2 15.9 21 12 21z"/>'
};
export const uxIcon = (k, cls = '') => `<svg class="ux-ic ${cls}" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[k] || P.star}</svg>`;
/* the emblem: a tinted rounded square with a gradient ring in the item's own color (--c) fading into its group color (--g) */
export const emb = (icon, c, g, extra = '') => `<span class="ux-em" style="--c:${c};--g:${g || c}"${extra}>${P[icon] ? uxIcon(icon) : `<i class="ux-emo">${esc(icon || '•')}</i>`}</span>`;

/* ---------- every destination, grouped ---------- */
export const UX_GROUPS = [
  { k: 'you', n: 'You', c: '#0ea5e9', items: [
    ['/?v=u', 'Profile', 'user', '#0ea5e9', 'Your page, posts and photos'],
    ['/?v=panel', 'Control panel', 'sliders', '#3b82f6', 'Settings, privacy and your data'],
    ['/?v=inbox', 'Inbox', 'inbox', '#14b8a6', 'Everything waiting on you'],
    ['/?v=notif', 'Alerts', 'bell', '#f97316', 'Tags, comments and reactions'],
    ['/?v=mydata', 'Your data', 'shield', '#3b82f6', 'Download or delete your data']] },
  { k: 'connect', n: 'Connect', c: '#ec4899', items: [
    ['/?v=conn', 'Connections', 'users', '#ec4899', 'Requests and your people'],
    ['/?v=circles', 'Circles', 'users', '#7c3aed', 'Family, Inner Tribe, Professional, Local'],
    ['/?v=dm', 'DMs', 'chat', '#a855f7', 'Private messages'],
    ['/?v=hub', 'Comm Hub', 'hub', '#8b5cf6', 'Calls, chats and channels in one place'],
    ['/meet/', 'Unity Call', 'phone', '#ef4444', 'Free video calls, one link'],
    ['/?v=groups', 'Groups', 'groups', '#16a34a', 'Buy, sell, trade and free'],
    ['/?v=events', 'Events', 'cal', '#f43f5e', 'What is on, with RSVPs'],
    ['/?v=room', 'Chat rooms', 'hash', '#0ea5e9', '#general, #help, #kindness and more']] },
  { k: 'grow', n: 'Create & Grow', c: '#f59e0b', items: [
    ['/?v=brand', 'My brand', 'brand', '#6366f1', 'Free Brand pages with real SEO'],
    ['/?v=grow', 'Grow your business', 'rocket', '#0ea5e9', 'Listings, press releases, 60-second lead follow-up'],
    ['/?v=marketing', 'Marketing dash', 'chart', '#16a34a', 'Page views, followers, reach and your ads'],
    ['/boost/', 'searchBOOST', 'rocket', '#f97316', 'Get found, get leads'],
    ['/moments/', 'Moments', 'cam', '#ec4899', 'Faces, backdrops and quick clips'],
    ['/?v=courses', 'Courses', 'book', '#0284c7', 'Learn and teach'],
    ['/?v=board', 'LIFEboard', 'board', '#f59e0b', 'Goals, habits, vision and money'],
    ['/?v=spark', 'LIFEspark', 'smile', '#f59e0b', 'Your daily spark, three tiny wins, two minutes of breath'],
    ['/?v=work', 'FLOWworks', 'hex', '#14b8a6', 'Your pads, sketches and boards'],
    ['/?v=video', 'Video', 'video', '#dc2626', 'Every video, newest first']] },
  { k: 'explore', n: 'Explore', c: '#8b5cf6', items: [
    ['/?v=spaces', 'Spaces', 'layers', '#0d9488', 'A home for any group or team'],
    ['/?v=discover', 'Discover', 'news', '#0369a1', 'NASA, Wikipedia and world news, with sources'],
    ['/rooms/', 'Global Room', 'globe', '#22c55e', 'Your whole group in one room'],
    ['/world/', '3D world', 'cube', '#06b6d4', 'Walk the world in your browser'],
    ['/world/?vr=1', 'VR', 'vr', '#7c3aed', 'Put on a Quest and step in'],
    ['/games/', 'Games', 'game', '#0891b2', 'Play now, no download'],
    ['/match/', 'Match', 'target', '#64748b', 'Have, need, match']] }
];
const EXTRA = { 'v:feed': ['Home', 'home', '#0369a1', 'Your feed', 'you'], 'v:search': ['Search', 'search', '#0369a1', 'People, posts, brands and groups', 'you'], 'v:admin': ['Admin', 'shield', '#16a34a', 'Dashboard and moderation', 'you'], '/mission/': ['Mission', 'flag', '#e11d48', 'Why allofus.one exists', 'explore'] };
const keyOf = (href) => { try { const u = new URL(String(href || ''), 'https://allofus.one'); if (u.origin !== 'https://allofus.one' && u.origin !== location.origin) return 'ext:' + u.href; if (u.pathname === '/' || u.pathname === '/index.html') { if (u.searchParams.get('v')) return 'v:' + u.searchParams.get('v'); if (u.searchParams.has('board')) return 'v:board'; if (u.searchParams.has('hub')) return 'v:hub'; if (u.searchParams.has('work')) return 'v:work'; return 'v:feed'; } return u.pathname + (u.searchParams.has('vr') ? '?vr=1' : ''); } catch (e) { return 'ext:' + href; } };
const DEST = {}; UX_GROUPS.forEach(g => g.items.forEach(([h, n, i, c, d]) => { DEST[keyOf(h)] = { h, n, i, c, d, g: g.k, gc: g.c }; })); Object.entries(EXTRA).forEach(([k, [n, i, c, d, g]]) => { DEST[k] = { h: k.startsWith('v:') ? (k === 'v:feed' ? '/' : '/?v=' + k.slice(2)) : k, n, i, c, d, g, gc: (UX_GROUPS.find(x => x.k === g) || {}).c || c }; });
export const destFor = (href) => DEST[keyOf(href)] || null;

/* ---------- the header tile row ---------- */
/* NAV rows are [view, label, iconKey, color, wide]; each gets the destination's outline icon and its group's ring */
export function uxTilesHTML(NAV) {
  const t = (attrs, d, label, badge) => `<button ${attrs} style="--c:${d.c};--g:${d.gc}" title="${esc(d.d || label)}">${emb(d.i, d.c, d.gc)}<span class="l">${esc(label)}</span>${badge ? `<b class="badge" data-badge="${badge}" hidden></b>` : ''}</button>`;
  const short = { conn: 'People', brand: 'Brand' };
  return `<nav class="fl-tiles ux-tiles" aria-label="Main">${NAV.map(([k, n]) => t(`data-v="${k}"`, destFor(k === 'feed' ? '/' : '/?v=' + k) || { c: '#0369a1', gc: '#0369a1', i: 'star' }, short[k] || n, k)).join('')}${t('data-v="board"', destFor('/?v=board'), 'LIFEboard')}<a class="t ux-boost" href="/boost/" style="--c:#38f0ff;--g:#f97316" title="searchBOOST: get found, get leads">${emb('rocket', '#38f0ff', '#a855f7')}<span class="l">searchBOOST</span></a><button data-more class="t-more" style="--c:#94a3b8;--g:#64748b" aria-label="More: every page on allofus.one">${emb('more', '#94a3b8', '#64748b')}<span class="l">More</span></button></nav>`;
}

/* ---------- the home rail: the member's own tiles, grouped ---------- */
/* list = the member's tiles [{ i, n, h, c }] in their order; indexes stay the member's so drag / remove keep working */
export function uxRailHTML(list) {
  const buckets = UX_GROUPS.map(g => ({ g, rows: [] })); const mine = { g: { k: 'mine', n: 'Your tiles', c: '#64748b' }, rows: [] };
  list.forEach((t, i) => { const d = destFor(t.h); const b = d ? (buckets.find(x => x.g.k === d.g) || mine) : mine; b.rows.push({ t, i: t._i != null ? t._i : i, d }); });
  const row = ({ t, i, d }) => { const c = d ? d.c : (t.c || '#0369a1'); const gc = d ? d.gc : '#64748b'; return `<a class="ux-row" href="${esc(t.h)}" draggable="true" data-i="${i}" style="--c:${esc(c)};--g:${esc(gc)}"${/^https?:/.test(t.h) && !/allofus\.one/.test(t.h) ? ' target="_blank" rel="noopener"' : ''}>${emb(d ? d.i : t.i, c, gc)}<span class="tx"><b>${esc(t.n)}</b>${d && d.d ? `<small>${esc(d.d)}</small>` : ''}</span><span class="x" data-x="${i}" role="button" aria-label="Remove ${esc(t.n)}">✕</span></a>`; };
  return `<div class="ux-menu">${buckets.concat([mine]).filter(b => b.rows.length).map(b => `<section class="ux-g" style="--g:${b.g.c}" aria-label="${esc(b.g.n)}"><h4>${esc(b.g.n)}</h4><div class="ux-list">${b.rows.map(row).join('')}</div></section>`).join('')}</div>`;
}

/* ---------- the Tools card (right rail) ---------- */
export function uxToolsHTML(tools) { return tools.map(([h, , n]) => { const d = destFor(h) || { i: 'star', c: '#0369a1', gc: '#0369a1' }; return `<a href="${esc(h)}" style="--c:${d.c};--g:${d.gc}">${emb(d.i, d.c, d.gc)}<span>${esc(n)}</span></a>`; }).join(''); }

/* ---------- the More sheet body (same groups; keeps the data- hooks moreSheet wires) ---------- */
export function uxMoreHTML(me) {
  const tile = (h, n, i, c, gc, attr = '') => `<a class="mo-t" href="${h}" ${attr} style="--c:${c};--g:${gc}">${emb(i, c, gc)}<span>${esc(n)}</span></a>`;
  const btn = (data, n, i, c) => `<button class="mo-t" ${data} style="--c:${c};--g:#64748b">${emb(i, c, '#64748b')}<span>${esc(n)}</span></button>`;
  const groups = UX_GROUPS.map(g => `<section class="mo-sec" style="--g:${g.c}"><h4>${esc(g.n)}</h4><div class="mo-grid">${g.items.map(([h, n, i, c]) => tile(h, n, i, c, g.c)).join('')}</div></section>`).join('');
  const acct = `<section class="mo-sec" style="--g:#64748b"><h4>Help &amp; account</h4><div class="mo-grid">${tile('/?v=search', 'Search', 'search', '#0369a1', '#64748b')}${tile('/?tour=1', 'Take the tour', 'star', '#0ea5e9', '#64748b')}${btn('data-mo-new', "What's new", 'flag', '#7c3aed')}${btn('data-invite', 'Invite friends', 'invite', '#16a34a')}${me && me.isAdmin ? tile('/?v=admin', 'Admin', 'shield', '#16a34a', '#16a34a', 'data-adm') : ''}${tile('/mission/', 'Mission', 'flag', '#e11d48', '#64748b')}${btn('data-mo-bug', 'Report a bug', 'bug', '#ef4444')}${btn('data-mo-help', 'Help · Orbit', 'help', '#0ea5e9')}${me ? btn('data-mo-out', 'Sign out', 'out', '#64748b') : ''}</div></section>`;
  return groups + acct;
}

/* ---------- signed-in boot cache: paint the member's header before any network round trip ---------- */
const CK = 'aou_me_cache';
export const meCache = {
  get() { try { return JSON.parse(localStorage.getItem(CK) || 'null'); } catch (e) { return null; } },
  set(me) { try { if (!me || !me.id) return; const av = (me.home && me.home.flat && me.home.flat.avatar) || ''; localStorage.setItem(CK, JSON.stringify({ id: me.id, name: me.name || '', username: me.username || '', avatar: av, isAdmin: !!me.isAdmin, t: Date.now() })); } catch (e) { } },
  clear() { try { localStorage.removeItem(CK); } catch (e) { } }
};
/* the stored Supabase session's user (local, instant). null when there is none or it expired more than a week ago (a refresh token that old is dead anyway). */
export function storedUser() { try { const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x)); if (!k) return null; const v = JSON.parse(localStorage.getItem(k) || 'null'); const u = v && (v.user || (v.currentSession && v.currentSession.user)); if (!u || !u.id || !(v.refresh_token || (v.currentSession && v.currentSession.refresh_token))) return null; if (v.expires_at && v.expires_at * 1000 < Date.now() - 7 * 864e5) return null; return u; } catch (e) { return null; } }
/* a minimal "me" for the first paint: the session user plus the last loaded profile (name, avatar, admin flag) */
export function bootMe() { const u = storedUser(); if (!u) return null; const c = meCache.get(); const md = u.user_metadata || {}; const same = c && c.id === u.id; return { id: u.id, email: u.email, username: same ? c.username : '', name: (same && c.name) || md.display_name || md.name || String(u.email || 'Me').split('@')[0], home: same && c.avatar ? { flat: { avatar: c.avatar } } : {}, isAdmin: !!(same && c.isAdmin), _boot: true }; }

/* ---------- skeleton blocks for "Loading…" states ---------- */
export const skel = (n = 3, kind = 'rows') => kind === 'posts' ? `<div class="ux-sk ux-skp" aria-busy="true" aria-label="Loading posts">${Array.from({ length: n }, (_, i) => `<div class="ux-skpost"><div class="hd"><i class="a"></i><div><i class="l w4"></i><i class="l w3"></i></div></div><i class="l w9"></i><i class="l w7"></i>${i % 2 ? '' : '<i class="b"></i>'}</div>`).join('')}</div>` : kind === 'cards' ? `<div class="ux-sk" aria-busy="true" aria-label="Loading">${Array.from({ length: n }, () => '<div class="ux-skc"><i class="a"></i><div><i class="l w6"></i><i class="l w4"></i></div></div>').join('')}</div>` : `<div class="ux-sk" aria-busy="true" aria-label="Loading">${Array.from({ length: n }, (_, i) => `<i class="l ${['w9', 'w7', 'w8', 'w5'][i % 4]}"></i>`).join('')}</div>`;

/* ---------- CSS (appended last, so it wins over the older layers) ---------- */
/* ---------- bottom-bar style pieces: a bare icon in its own color (filters, order, quick bubbles) ---------- */
export const uxChip = (icon, c, label) => `<span class="ux-ci" style="--c:${c}">${uxIcon(icon)}</span>${esc(label)}`;
/* quick bubbles after the "who posted lately" faces, so the row is never half empty */
const QUICK = [['/moments/', 'Moment', 'cam', '#ec4899'], ['/?v=grow', 'Grow', 'rocket', '', 'hot'], ['/?v=circles', 'Circles', 'users', '#7c3aed'], ['/?v=events', 'Events', 'cal', '#e11d48'], ['/?v=courses', 'Courses', 'book', '#0284c7'], ['/?v=board', 'LIFEboard', 'board', '#65a30d'], ['/?v=spark', 'Spark', 'smile', '#f59e0b'], ['/?tour=1', 'Tour', 'star', '#0ea5e9']];
export function uxQuickHTML() { return `<span class="ux-sep" aria-hidden="true"></span><b class="ux-rowlab q">Quick start</b>${QUICK.map(([h, n, i, c, x]) => `<a class="mo ux-q${x ? ' ' + x : ''}" href="${h}" style="--c:${c || '#4f46e5'}"><span class="ring"><span class="av">${uxIcon(i)}</span></span><small>${esc(n)}</small></a>`).join('')}`; }

export const UX_CSS = `
.ux-em{--c:#0369a1;--g:#0369a1;position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;width:38px;height:38px;border-radius:12px;color:var(--c);border:1.5px solid transparent;background:linear-gradient(150deg,rgba(255,255,255,.96),rgba(255,255,255,.88)) padding-box,linear-gradient(135deg,var(--c),var(--g)) border-box;box-shadow:0 2px 6px rgba(15,23,42,.06);transition:transform .15s ease,box-shadow .15s ease,background .15s ease}
.ux-em::before{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--c);opacity:.1;pointer-events:none}
@supports (color:color-mix(in srgb,red,blue)){.ux-em{color:color-mix(in srgb,var(--c) 82%,#0b1a3a)}}
.ux-em .ux-ic{width:21px;height:21px;position:relative}
.ux-em .ux-emo{font-style:normal;font-size:19px;line-height:1;position:relative}
/* the logo lockup: at least 280 px wide on desktop (network rule), about 200 px on phones */
@media(min-width:1001px){.fl .fl-top .lock .embl{width:64px!important;height:64px!important}.fl .fl-top .lock .wm .a,.fl .fl-top .lock .wm .o{font-size:40px!important}}
/* header row: dark navy, continues the bar above it */
.fl .fl-top .w,.fl.pagehead .fl-top .w{background:linear-gradient(180deg,#0b1a3a,#081429)!important;border-bottom:1px solid rgba(56,240,255,.14)!important;padding:6px clamp(10px,2vw,28px) 8px!important}
.fl .fl-top nav.fl-tiles.ux-tiles{display:grid!important;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;margin:0 auto;max-width:1400px;width:100%;flex-wrap:nowrap}
.fl .fl-top nav.ux-tiles>button,.fl .fl-top nav.ux-tiles>a.t{all:unset;box-sizing:border-box;position:relative;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;width:auto!important;height:auto!important;min-height:66px;padding:6px 2px 7px!important;border-radius:14px!important;cursor:pointer;color:#cfdbf1;font:700 11.5px/1.1 Poppins,Arial;text-align:center;text-decoration:none;background:transparent!important;border:0!important;box-shadow:none!important;animation:none!important;transition:background .15s ease}
.fl .fl-top nav.ux-tiles>*:hover{background:rgba(255,255,255,.06)!important}
.fl .fl-top nav.ux-tiles>*:focus-visible{outline:2px solid #38f0ff;outline-offset:1px}
.fl .fl-top nav.ux-tiles .l{display:block;max-width:100%;white-space:nowrap;overflow:visible;font-size:11.5px;letter-spacing:0;color:inherit}
.fl .fl-top nav.ux-tiles .ux-em{width:36px;height:36px;border-radius:11px;color:#fff;background:linear-gradient(150deg,#13244a,#0b1a3a) padding-box,linear-gradient(135deg,var(--c),var(--g)) border-box;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.fl .fl-top nav.ux-tiles .ux-em::before{opacity:.22}
@supports (color:color-mix(in srgb,red,blue)){.fl .fl-top nav.ux-tiles .ux-em{color:color-mix(in srgb,var(--c) 45%,#fff)}}
.fl .fl-top nav.ux-tiles>*:hover .ux-em{transform:translateY(-2px);box-shadow:0 8px 18px rgba(0,0,0,.35),0 0 0 3px rgba(255,255,255,.04)}
.fl .fl-top nav.ux-tiles>button.on{color:#fff}
.fl .fl-top nav.ux-tiles>button.on .ux-em{color:#fff;background:linear-gradient(135deg,var(--c),var(--g)) padding-box,linear-gradient(135deg,var(--c),var(--g)) border-box;box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 16px -2px var(--c)}
.fl .fl-top nav.ux-tiles>button.on .ux-em::before{opacity:0}
.fl .fl-top nav.ux-tiles>button.on::after{content:"";position:absolute;left:30%;right:30%;bottom:1px;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--c),var(--g))}
.fl .fl-top nav.ux-tiles .ux-boost .ux-em{background:linear-gradient(135deg,#1e3a8a,#7c3aed) padding-box,linear-gradient(135deg,#38f0ff,#f97316) border-box;color:#fff}
.fl .fl-top nav.ux-tiles .ux-boost .l{color:#9ff6ff}
.fl .fl-top nav.ux-tiles .badge{position:absolute;top:2px;left:calc(50% + 8px);right:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff3b5c;color:#fff;font:900 10px/18px Poppins,Arial;text-align:center;box-shadow:0 0 0 2px #0b1a3a}
@media(max-width:1180px){.fl .fl-top nav.ux-tiles .l{font-size:10.5px}.fl .fl-top nav.ux-tiles .ux-em{width:32px;height:32px}}
/* phones and tablets: one swipeable strip with fading edges */
@media(max-width:1000px){.fl .fl-top .w,.fl.pagehead .fl-top .w{display:block!important;padding:4px 0 6px!important}.fl .fl-top nav.fl-tiles.ux-tiles{display:flex!important;box-sizing:border-box;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:none;gap:2px;padding:0 10px;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 28px),transparent)}.fl .fl-top nav.ux-tiles::-webkit-scrollbar{display:none}.fl .fl-top nav.ux-tiles>button,.fl .fl-top nav.ux-tiles>a.t{flex:0 0 70px;min-height:62px;scroll-snap-align:start}.fl .fl-top nav.ux-tiles .ux-em{width:34px;height:34px}.fl .fl-top nav.ux-tiles .l{font-size:11px}}
/* home rail = the main menu, grouped */
.fl .rail.ux-rail{display:block!important;margin-top:10px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:6px 6px 10px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.ux-menu{display:flex;flex-direction:column;gap:4px}
.ux-g h4{display:flex;align-items:center;gap:8px;margin:10px 10px 4px;font:800 11px/1 Poppins,Arial;letter-spacing:.09em;text-transform:uppercase;color:#334155}
.ux-g h4::before{content:"";width:8px;height:8px;border-radius:3px;background:var(--g);box-shadow:0 0 0 3px color-mix(in srgb,var(--g) 18%,transparent)}
.ux-list{display:flex;flex-direction:column;gap:1px}
.fl .rail.ux-rail a.ux-row{all:unset;box-sizing:border-box;position:relative;display:flex;align-items:center;gap:11px;min-height:46px;padding:5px 8px;border-radius:12px!important;cursor:pointer;color:#0f172a;text-decoration:none;transition:background .12s ease}
.fl .rail.ux-rail a.ux-row:hover{background:#f1f5f9}
.fl .rail.ux-rail a.ux-row:hover .ux-em{transform:scale(1.06)}
.fl .rail.ux-rail a.ux-row:focus-visible{outline:2px solid #0369a1;outline-offset:1px}
.fl .rail.ux-rail a.ux-row.drag{opacity:.4}
.ux-row .ux-em{width:36px;height:36px}
.ux-row .tx{display:flex;flex-direction:column;min-width:0;gap:1px}
.ux-row .tx b{font:700 13.5px/1.2 Poppins,Arial;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ux-row .tx small{font:500 11.5px/1.25 Poppins,Arial;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fl .rail.ux-rail .x{position:absolute;top:50%;right:8px;transform:translateY(-50%);display:none;color:#64748b;font-size:12px}
.fl .rail.ux-rail.edit .x{display:block}
.fl .rail.ux-rail button.add{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:6px;margin:8px 6px 0;min-height:42px;border:1.5px dashed #cbd5e1;border-radius:12px!important;color:#0369a1;font:700 12.5px Poppins,Arial;cursor:pointer}
.fl .rail.ux-rail button.add:hover{border-color:#0369a1;background:#f0f9ff}
.fl .rail.ux-rail button.add:focus-visible{outline:2px solid #0369a1;outline-offset:2px}
/* Tools card */
.fl .tools-card .tgrid{gap:6px}
.fl .tools-card .tgrid a{gap:6px;padding:10px 4px 8px;min-height:76px;border-color:#e8edf4;font:700 11.5px/1.2 Poppins,Arial;color:#0f172a;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.fl .tools-card .tgrid a:hover{border-color:var(--c,#0369a1);background:#fff;transform:translateY(-1px);box-shadow:0 6px 16px rgba(15,23,42,.08)}
.fl .tools-card .tgrid a .ux-em{width:34px;height:34px}
.fl .tools-card .tgrid a .ux-em svg{width:20px;height:20px;color:inherit}
/* More sheet */
.mo-sec{margin-top:6px}.mo-sec+.mo-sec{margin-top:14px}
.mo-sec h4{display:flex;align-items:center;gap:8px;margin:0 2px 8px;font:800 11px/1 Poppins,Arial;letter-spacing:.09em;text-transform:uppercase;color:#334155}
.mo-sec h4::before{content:"";width:8px;height:8px;border-radius:3px;background:var(--g)}
.mo-sec .mo-grid{grid-template-columns:repeat(4,1fr);gap:8px}
@media(min-width:700px){.mo-sec .mo-grid{grid-template-columns:repeat(5,1fr)}}
.mo-sec .mo-t{gap:7px;min-height:84px;padding:10px 4px 8px;border-color:#e8edf4;font:700 11.5px/1.2 Poppins,Arial;color:#0f172a;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.mo-sec .mo-t:hover{border-color:var(--c);transform:translateY(-1px);box-shadow:0 6px 16px rgba(15,23,42,.08)}
.mo-sec .mo-t:focus-visible{outline:2px solid #0369a1;outline-offset:2px}
.mo-sec .mo-t svg{width:20px;height:20px;color:inherit}
/* skeletons */
.ux-sk{display:flex;flex-direction:column;gap:10px;padding:6px 0}
.ux-sk i{display:block;border-radius:8px;background:linear-gradient(90deg,#eef2f7 0,#f8fafc 40%,#eef2f7 80%);background-size:300% 100%;animation:uxSk 1.3s ease-in-out infinite}
.ux-sk .l{height:12px}.ux-sk .w9{width:92%}.ux-sk .w8{width:80%}.ux-sk .w7{width:70%}.ux-sk .w6{width:60%}.ux-sk .w5{width:50%}.ux-sk .w4{width:38%}
.ux-skc{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #eef2f7;border-radius:14px;background:#fff}.ux-skc .a{width:40px;height:40px;border-radius:50%;flex:none}.ux-skc>div{flex:1;display:flex;flex-direction:column;gap:8px}
.ux-sk .w3{width:26%}.ux-skpost{background:#fff;border:1px solid #e8edf4;border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}.ux-skpost .hd{display:flex;gap:10px;align-items:center}.ux-skpost .hd>div{flex:1;display:flex;flex-direction:column;gap:7px}.ux-skpost .a{width:42px;height:42px;border-radius:50%;flex:none}.ux-skpost .b{height:150px;border-radius:12px}.ux-skp{gap:12px}
@keyframes uxSk{0%{background-position:100% 0}100%{background-position:0 0}}
@media(prefers-reduced-motion:reduce){.ux-sk i{animation:none}.ux-em,.fl .fl-top nav.ux-tiles>*{transition:none}}
/* contrast + touch targets found in the UX pass */
.fl .fl-sort>span,.fl .fl-sort small{color:#475569}.fl .fl-sort small{font-size:11.5px}
.fl .fl-top .fl-search button[type=submit]{min-width:40px;min-height:34px}
/* focus everywhere: a visible ring for keyboard users, none for mouse */
.fl :is(a,button,input,select,textarea,[tabindex]):focus-visible{outline:2px solid #0369a1;outline-offset:2px}
.fl .fl-top .bar :is(a,button,input):focus-visible{outline-color:#38f0ff}
/* admin panel */
.ad-root .ad-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(135deg,#0b1a3a,#13244a);color:#fff;border-radius:18px;padding:16px 18px;margin-bottom:12px;box-shadow:0 10px 30px rgba(11,26,58,.18)}
.ad-root .ad-head .ux-em{width:44px;height:44px;border-radius:14px;color:#fff;background:linear-gradient(135deg,#16a34a,#0ea5e9) padding-box,linear-gradient(135deg,#4ade80,#38f0ff) border-box}
.ad-root .ad-head h2{margin:0;font:800 19px/1.2 Poppins,Arial;color:#fff}
.ad-root .ad-head p{margin:2px 0 0;font:500 12.5px/1.35 Poppins,Arial;color:#cbd5e1}
.ad-root .ad-head .grow{flex:1;min-width:180px}
.ad-root .ad-nav{display:flex;flex-direction:column;gap:4px}
.ad-root .ad-nav a{display:flex;align-items:center;gap:10px;min-height:46px;padding:5px 10px 5px 6px;border-radius:12px;text-decoration:none;color:#0f172a;font:700 13.5px Poppins,Arial;border:1px solid transparent;transition:background .12s ease,border-color .12s ease}
.ad-root .ad-nav a .ux-em{width:34px;height:34px}
.ad-root .ad-nav a:hover{background:#f1f5f9}
.ad-root .ad-nav a.on{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
.ad-root .ad-nav a.on .ux-em{color:#fff;background:linear-gradient(135deg,var(--c),var(--g)) padding-box,linear-gradient(135deg,var(--c),var(--g)) border-box}
.ad-root .ad-nav a.on .ux-em::before{opacity:0}
.ad-root .fl-card{border-radius:18px;padding:16px 18px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.ad-root .fl-card>h3{display:flex;align-items:center;gap:8px;font:800 16px/1.25 Poppins,Arial;color:#0f172a;margin:0 0 10px}
.ad-root .ad-kpis{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.ad-root .ad-kpi{position:relative;overflow:hidden;border-radius:16px;padding:14px 16px 13px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.ad-root .ad-kpi::after{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#0ea5e9,#6366f1)}
.ad-root .ad-kpi.live::after{background:linear-gradient(180deg,#22c55e,#16a34a)}
.ad-root .ad-kpi b{font:800 28px/1 Poppins,Arial}
.ad-root .ad-kpi small{color:#475569;font:700 11px Poppins,Arial;letter-spacing:.06em}
.ad-root .ad-chart{border-radius:18px;padding:14px 16px;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.ad-root .ad-chart h4{font:800 14px Poppins,Arial;color:#0f172a;margin-bottom:8px}
.ad-root .ad-tbl{font-size:13px}.ad-root .ad-tbl th{position:sticky;top:0;background:#f8fafc;color:#475569;padding:9px 8px}.ad-root .ad-tbl td{padding:10px 8px}.ad-root .ad-tbl tr:hover td{background:#f8fafc}
/* every button in the admin panel (and any section added to it later) is a real, 44 px button */
.ad-root>:not(.r) :where(.fl-btn,button:not(.x):not(.ha):not(.lnk)){min-height:44px;padding:0 16px;border-radius:12px!important;font:700 13.5px Poppins,Arial;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border:1.5px solid #cbd5e1;background:#fff;color:#0f172a;transition:background .12s ease,border-color .12s ease,box-shadow .12s ease,transform .12s ease}
.ad-root>:not(.r) :where(.fl-btn,button:not(.x):not(.ha):not(.lnk)):hover{border-color:#0369a1;background:#f0f9ff;color:#075985}
.ad-root>:not(.r) :is(.fl-btn.p,button.p,.btn-primary,[data-primary]){background:linear-gradient(135deg,#0369a1,#4f46e5);border-color:transparent;color:#fff;box-shadow:0 6px 16px rgba(79,70,229,.25)}
.ad-root>:not(.r) :is(.fl-btn.p,button.p,.btn-primary,[data-primary]):hover{background:linear-gradient(135deg,#075985,#4338ca);color:#fff}
.ad-root>:not(.r) :is(.fl-btn.danger,button.danger,.btn-danger,[data-danger],[data-adel]){background:#fff1f2;border-color:#fecdd3;color:#b91c1c}
.ad-root>:not(.r) :is(.fl-btn.danger,button.danger,.btn-danger,[data-danger],[data-adel]):hover{background:#dc2626;border-color:#dc2626;color:#fff}
.ad-root>:not(.r) :is(.fl-btn.ok,button.ok,.btn-ok,[data-ok]){background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
.ad-root>:not(.r) :is(.fl-btn.ok,button.ok,.btn-ok,[data-ok]):hover{background:#16a34a;border-color:#16a34a;color:#fff}
.ad-root>:not(.r) :is(.fl-btn,button):disabled{opacity:.55;cursor:not-allowed}
.ad-root>:not(.r) :is(.fl-btn,button):focus-visible{outline:2px solid #0369a1;outline-offset:2px}
.ad-root .ad-tbl :where(.fl-btn,button){min-height:38px;padding:0 12px;font-size:12.5px}
.ad-root .fl-chips{gap:8px}
@media(max-width:600px){.ad-root .ad-head{padding:14px}.ad-root .ad-kpis{grid-template-columns:repeat(2,1fr)}.ad-root .ad-kpi b{font-size:23px}}
/* ===== v26b: feed filter row, order row and moments row in the bottom-bar style Zach likes ===== */
/* feed filters: icon + word, each its own color; the active one gets the same tinted pill as the bottom bar */
.fl .fl-filters{display:grid!important;grid-template-columns:repeat(5,1fr);gap:2px!important;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:5px!important;margin:0 0 8px!important;box-shadow:0 6px 18px -14px rgba(15,23,42,.35)}
.fl .fl-filters button{flex-direction:column!important;gap:3px!important;min-height:58px!important;padding:6px 2px!important;background:transparent!important;border:0!important;border-radius:12px!important;color:#14183a!important;font:700 12px/1.1 var(--ff)!important;box-shadow:none!important}
.fl .fl-filters button .dot{display:none!important}
.ux-ci{display:inline-flex;color:var(--c);flex:none}.ux-ci .ux-ic{width:20px;height:20px;stroke-width:2.1}
.fl .fl-filters button .ux-ci .ux-ic{width:25px;height:25px;stroke-width:2}
.fl .fl-filters button:hover{background:color-mix(in srgb,var(--c,#0369a1) 7%,#fff)!important;color:#14183a!important}
.fl .fl-filters button.on{background:color-mix(in srgb,var(--c,#0369a1) 13%,#fff)!important;color:color-mix(in srgb,var(--c,#0369a1) 72%,#0b1a3a)!important;box-shadow:none!important;border:0!important}
.fl .fl-filters button.on::after{display:none!important}
@media(max-width:560px){.fl .fl-filters button{font-size:11px!important;min-height:54px!important}.fl .fl-filters button .ux-ci .ux-ic{width:23px;height:23px}}
/* order row: one bar, the explanation fills the space to the right instead of a blank gap */
.fl .fl-sort{flex-wrap:nowrap;gap:4px;margin:0 0 10px;background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:5px 6px 5px 12px}
.fl .fl-sort>span{font:800 11px var(--ff);color:#475569;text-transform:uppercase;letter-spacing:.07em;margin-right:4px}
.fl .fl-sort button{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border:0!important;background:transparent;border-radius:9px;color:#14183a}
.fl .fl-sort button .ux-ci .ux-ic{width:18px;height:18px}
.fl .fl-sort button:hover{background:color-mix(in srgb,var(--c,#0369a1) 8%,#fff)}
.fl .fl-sort button.on{background:color-mix(in srgb,var(--c,#0369a1) 14%,#fff);color:color-mix(in srgb,var(--c,#0369a1) 72%,#0b1a3a)}
.fl .fl-sort small{flex:1 1 auto;flex-basis:auto!important;min-width:0;margin-left:6px;padding-left:12px;border-left:1px solid #e2e8f0;font:600 12px/1.35 var(--ff);color:#475569}
@media(max-width:560px){.fl .fl-sort{flex-wrap:wrap}.fl .fl-sort small{flex-basis:100%!important;border-left:0;padding:2px 0 0;margin-left:0}}
/* moments row: two rows. Row 1 = who posted lately (small faces). Row 2 = quick-start bubbles (bigger, colored). */
.moments{flex-wrap:wrap;row-gap:4px;align-items:flex-end;position:relative;padding-top:18px}
.moments::before{content:"Posting lately";position:absolute;left:4px;top:0;font:800 10px/1 var(--ff,Poppins,Arial);letter-spacing:.08em;text-transform:uppercase;color:#64748b}
.moments .mo:not(.ux-q){gap:2px;font-size:10px;color:#475569}.moments .mo:not(.ux-q) .ring{padding:2px}.moments .mo:not(.ux-q) .av{width:38px;height:38px;font-size:14px}
.moments .ux-rowlab{flex-basis:100%;font:800 10px/1 var(--ff,Poppins,Arial);letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:6px 0 0 4px}
.moments .ux-sep{display:none}
.moments .ux-q .av{width:52px;height:52px}
.moments .ux-q .ring{background:color-mix(in srgb,var(--c) 35%,#fff)}
.moments .ux-q .av{background:color-mix(in srgb,var(--c) 11%,#fff);color:var(--c)}
.moments .ux-q .av .ux-ic{width:24px;height:24px;stroke-width:2}
.moments .ux-q.hot .ring,.moments .ux-q.hot .av{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
.moments .ux-q:hover .av{transform:translateY(-1px)}
`;

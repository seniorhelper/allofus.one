/* allofus.one · v26 (Oct 23 2026): Circles, Feed controls, "Why am I seeing this?", Your data page.
   - Circles: a member's own audiences (Family, Inner Tribe, Professional, Local + custom). A post can go to ONE circle;
     the database (supabase/_parts/v26-features.sql) makes sure only the author, that circle and admins can read it.
   - Feed controls (stored on this device only, local-first): mute words, hide reposts, show one circle, why-am-I-seeing-this.
   - Your data: one-click JSON export + delete-account (reuses aou-flat3.js exportMyData / deleteAccountSheet).
   Everything feature-detects: before the v26 SQL is run, Circles shows a friendly "turning on soon" card and the
   composer and feed behave exactly as before. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DEFAULTS = [['Family', 'family', '#e11d48'], ['Inner Tribe', 'tribe', '#7c3aed'], ['Professional', 'pro', '#0369a1'], ['Local', 'local', '#059669']];
const CTL_KEY = 'aou_feedctl';
export const CIRCLES_CSS = `.aw-bar{background:#fff;border:1px solid #e5e7eb;border-radius:14px;margin:0 0 12px;font:500 13px/1.45 Poppins,Arial,sans-serif;color:#334155}.aw-bar>summary{list-style:none;cursor:pointer;padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.aw-bar>summary::-webkit-details-marker{display:none}.aw-bar>summary b{color:#0b1a3a}.aw-bar .pill{background:#eef6ff;color:#0369a1;border-radius:999px;padding:2px 9px;font-weight:700;font-size:12px}.aw-bar .pill.on{background:#0b1a3a;color:#fff}.aw-bar .aw-in{padding:4px 14px 14px;display:grid;gap:10px}.aw-bar label{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:700;color:#0b1a3a}.aw-bar input[type=text],.aw-bar select{border:1.5px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:500 13px Poppins,Arial;min-width:0;flex:1 1 180px;background:#fff;color:#0f172a}.aw-bar .why{background:#f8fafc;border-radius:10px;padding:10px 12px;color:#475569}.aw-why{margin:6px 14px 10px;font:500 12px Poppins,Arial;color:#64748b}.aw-why summary{cursor:pointer;width:max-content;max-width:100%}.aw-why p{margin:4px 0 0}.aw-aud{display:inline-flex;align-items:center;gap:6px;font:700 11px Poppins,Arial;color:#475569;margin:6px 6px 0 0}.aw-aud select{border:1.5px solid #cbd5e1;border-radius:8px;padding:3px 6px;font:600 12px Poppins,Arial;background:#fff;color:#0f172a}.ci-wrap{max-width:860px;margin:16px auto;padding:0 12px;display:grid;gap:14px;font-family:Poppins,Arial,sans-serif}.ci-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px}.ci-card h2,.ci-card h3{margin:0 0 6px;color:#0b1a3a}.ci-card p{margin:0 0 8px;color:#475569;line-height:1.5}.ci-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.ci-c{border:1.5px solid #e2e8f0;border-radius:14px;padding:12px;display:grid;gap:8px}.ci-c h4{margin:0;display:flex;align-items:center;gap:8px;color:#0b1a3a}.ci-c h4 i{width:12px;height:12px;border-radius:50%;display:inline-block}.ci-m{display:flex;flex-wrap:wrap;gap:6px}.ci-m span{background:#f1f5f9;border-radius:999px;padding:3px 4px 3px 10px;font-size:12px;display:inline-flex;gap:4px;align-items:center}.ci-m button{border:0;background:#e2e8f0;border-radius:50%;width:20px;height:20px;cursor:pointer;line-height:1}.ci-row{display:flex;gap:8px;flex-wrap:wrap}.ci-row select,.ci-row input{flex:1 1 140px;border:1.5px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:500 13px Poppins,Arial;min-width:0}.ci-promise{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:8px 0 0;padding:0;list-style:none}.ci-promise li{background:#f8fafc;border-radius:12px;padding:10px 12px;color:#334155;font-size:13px}.ci-promise b{display:block;color:#0b1a3a}`;

const ctlGet = () => { try { return Object.assign({ mute: [], hideReposts: false, circle: '' }, JSON.parse(localStorage.getItem(CTL_KEY) || '{}')); } catch (e) { return { mute: [], hideReposts: false, circle: '' }; } };
const ctlSet = (v) => { try { localStorage.setItem(CTL_KEY, JSON.stringify(v)); } catch (e) { } };
const css = () => { if (document.getElementById('aou-circles-css')) return; const s = document.createElement('style'); s.id = 'aou-circles-css'; s.textContent = CIRCLES_CSS; document.head.appendChild(s); };

/* ---------- data layer (feature-detected, cached for the page) ---------- */
let ready = null, myCircles = null, conns = null;
export async function circlesReady(sb) {
  if (!sb || !sb.from) return false; if (ready !== null) return ready;
  /* the probe 404s until the v26 SQL is run, so remember the answer (no: 1 h, yes: 24 h) instead of asking on every page */
  try { const c = JSON.parse(localStorage.getItem('aou_circ_ready') || 'null'); if (c && Date.now() - c.t < (c.v ? 864e5 : 36e5)) { ready = c.v; return ready; } } catch (e) { }
  try { const [a, b] = await Promise.all([sb.from('circles').select('id').limit(1), sb.from('feed_posts').select('circle_id').limit(1)]); ready = !a.error && !b.error; } catch (e) { ready = false; }
  try { localStorage.setItem('aou_circ_ready', JSON.stringify({ v: ready, t: Date.now() })); } catch (e) { }
  return ready;
}
async function loadMine(sb, me, force) {
  if (!me) return []; if (myCircles && !force) return myCircles;
  const { data, error } = await sb.from('circles').select('*').eq('owner_id', me.id).order('sort').order('created_at'); if (error) return [];
  myCircles = data || []; return myCircles;
}
async function seedDefaults(sb, me) {
  const have = await loadMine(sb, me, true); if (have.length) return have;
  try { await sb.from('circles').insert(DEFAULTS.map(([name, kind, color], i) => ({ owner_id: me.id, name, kind, color, sort: i }))); } catch (e) { }
  return loadMine(sb, me, true);
}
async function members(sb, circleIds) { if (!circleIds.length) return []; const { data } = await sb.from('circle_members').select('circle_id,member_id').in('circle_id', circleIds); return data || []; }
async function loadConns(sb, me) {
  if (conns) return conns; conns = [];
  try {
    const { data } = await sb.from('connections').select('requester,addressee,status').or(`requester.eq.${me.id},addressee.eq.${me.id}`).eq('status', 'accepted');
    const ids = [...new Set((data || []).map(c => c.requester === me.id ? c.addressee : c.requester))].filter(Boolean);
    if (ids.length) { const { data: ps } = await sb.from('profiles').select('id,username,display_name').in('id', ids.slice(0, 500)); conns = (ps || []).map(p => ({ id: p.id, name: p.display_name || p.username || 'Member', username: p.username || '' })).sort((a, b) => a.name.localeCompare(b.name)); }
  } catch (e) { }
  return conns;
}

/* ---------- composer: "Who sees this" circle picker ---------- */
export async function decorateComposer(c, F3) {
  try {
    const sb = F3.sb, me = F3.getMe && F3.getMe(); if (!me || !F3.live || !c || c.dataset.awAud) return; c.dataset.awAud = '1';
    const h = $('h3', c); if (h && /Post as|Post to/.test(h.textContent)) return; /* page and group posts keep their own audience */
    if (!(await circlesReady(sb))) return; const list = await loadMine(sb, me); css();
    const pub = $('#c-pub', c); const host = (pub && pub.closest('label')) || $('.tools', c) || c;
    const w = document.createElement('label'); w.className = 'aw-aud'; w.title = 'Circles keep audiences apart. A circle post is seen only by you and that circle.';
    w.innerHTML = `Who sees this <select data-aw-aud><option value="">${pub ? 'Use the Public switch' : 'Everyone I normally share with'}</option>${list.map(ci => `<option value="${esc(ci.id)}">Only my ${esc(ci.name)} circle</option>`).join('')}<option value="__new">+ Set up circles…</option></select>`;
    host.after ? host.after(w) : c.appendChild(w);
    const sel = $('[data-aw-aud]', w); sel.onchange = () => { if (sel.value === '__new') { location.href = '/?v=circles'; return; } if (pub) { const lab = pub.closest('label') || pub; lab.style.opacity = sel.value ? '.4' : ''; pub.disabled = !!sel.value; } };
  } catch (e) { }
}
/* called right before the composer inserts its row */
export function applyCircle(row, c) {
  try { const sel = c && $('[data-aw-aud]', c); const v = sel && sel.value; if (!v || v === '__new' || row.group_slug || row.page_slug) return row; row.circle_id = v; row.public = false; } catch (e) { }
  return row;
}

/* ---------- feed: controls bar + filters + why-am-I-seeing-this ---------- */
const sortName = () => { try { const k = localStorage.getItem('aou_sort') || 'new'; return k === 'top' ? 'Top (most reactions and comments)' : k === 'hot' ? 'Hot (the published formula)' : 'Newest first, no ranking'; } catch (e) { return 'Newest first, no ranking'; } };
const dearOn = () => { try { const p = JSON.parse(localStorage.getItem('aou_feedprefs') || '{}'); return !!((p.more || []).length || (p.less || []).length || p.dear); } catch (e) { return false; } };
const rerender = () => { const b = $('.fl-filters button.on'); if (b) b.click(); else location.reload(); };

async function feedBar(mount, ctx) {
  const parent = mount.parentElement; if (!parent || $('.aw-bar', parent)) return; css();
  const ctl = ctlGet(); const sb = ctx.sb, me = ctx.me; const live = me ? await circlesReady(sb) : false; const list = me && live ? await loadMine(sb, me) : [];
  const d = document.createElement('details'); d.className = 'aw-bar'; if (ctl.circle || ctl.mute.length || ctl.hideReposts) d.open = false;
  const active = (ctl.mute.length ? 1 : 0) + (ctl.hideReposts ? 1 : 0) + (ctl.circle ? 1 : 0);
  d.innerHTML = `<summary><b>Feed controls</b><span class="pill">${esc(sortName())}</span>${active ? `<span class="pill on">${active} filter${active > 1 ? 's' : ''} on</span>` : ''}<span style="margin-left:auto;color:#0369a1;font-weight:700">Why am I seeing this?</span></summary>
  <div class="aw-in"><div class="why"><b>How this feed is built:</b> ${esc(sortName())}. You see public posts from members${me ? ', posts shared with circles you are in' : ''}, and your own posts. ${dearOn() ? 'Your Dear Feed words nudge matching posts up or down (you set them in the right rail). ' : ''}Nothing is ranked by what keeps you scrolling, no ad tracker decides what you see, and every post shows its own reason below it.</div>
  ${me && live ? `<label>Show <select data-aw-circle><option value="">Everyone (default)</option><option value="__in">Posts shared with me in circles</option>${list.map(ci => `<option value="${esc(ci.id)}"${ctl.circle === ci.id ? ' selected' : ''}>Only my ${esc(ci.name)} circle</option>`).join('')}</select><a href="/?v=circles" style="font-weight:700;color:#0369a1">Manage circles</a></label>` : (me ? '' : '')}
  <label>Mute words <input type="text" data-aw-mute placeholder="comma separated, e.g. election, spoilers" value="${esc(ctl.mute.join(', '))}"></label>
  <label><input type="checkbox" data-aw-rp ${ctl.hideReposts ? 'checked' : ''}> Hide reposts (🔁 Shared)</label>
  <div><button class="fl-btn sm p" data-aw-save type="button">Apply</button> <button class="fl-btn sm" data-aw-clear type="button">Clear filters</button> <small class="muted">Saved on this device only.</small></div></div>`;
  parent.insertBefore(d, mount);
  const cs = $('[data-aw-circle]', d); if (cs && ctl.circle === '__in') cs.value = '__in';
  $('[data-aw-save]', d).onclick = () => { const v = ctlGet(); v.mute = ($('[data-aw-mute]', d).value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 40); v.hideReposts = $('[data-aw-rp]', d).checked; v.circle = cs ? cs.value : ''; ctlSet(v); rerender(); };
  $('[data-aw-clear]', d).onclick = () => { ctlSet({ mute: [], hideReposts: false, circle: '' }); rerender(); };
}

const reasonFor = (p, me, connSet, circleNames) => {
  if (p._seed) return 'A sample post so the feed is never empty. It goes away as real posts arrive.';
  if (me && p.user_id === me.id) return p.circle_id ? `Your post, shared only with your ${circleNames[p.circle_id] || ''} circle.` : 'Your own post.';
  if (p.circle_id) return 'Someone put you in one of their circles and shared this with that circle only.';
  if (p.group_slug) return 'Posted in a group, shown newest first.';
  if (p.page_slug) return 'Posted by a Brand page.';
  if (connSet && connSet.has(p.user_id)) return 'You are connected to this person. Newest first.';
  return 'A public post. Newest first, no engagement ranking.';
};

/* The feedList hook in aou-flat2.js calls this right after the posts load (async; returns the list to show). */
export async function feedHook(mount, q, data, ctx) {
  const home = !!(q && q.publicOnly && !q.user && !q.group && !q.page && !q.ids);
  const ctl = ctlGet(); const sb = ctx.sb, me = ctx.me;
  if (home) { try { await feedBar(mount, ctx); } catch (e) { } }
  let out = data || [];
  if (home && ctl.circle && me && (await circlesReady(sb))) {
    try {
      let rows = [];
      if (ctl.circle === '__in') { const r = await sb.from('feed_posts').select('*').not('circle_id', 'is', null).neq('user_id', me.id).order('created_at', { ascending: false }).limit(80); rows = r.data || []; }
      else { const mem = (await members(sb, [ctl.circle])).map(m => m.member_id); const [a, b] = await Promise.all([mem.length ? sb.from('feed_posts').select('*').in('user_id', mem).order('created_at', { ascending: false }).limit(80) : { data: [] }, sb.from('feed_posts').select('*').eq('user_id', me.id).eq('circle_id', ctl.circle).order('created_at', { ascending: false }).limit(40)]); const seen = new Set(); rows = [...(a.data || []), ...(b.data || [])].filter(p => !seen.has(p.id) && seen.add(p.id)).sort((x, y) => new Date(y.created_at) - new Date(x.created_at)); }
      const now = new Date().toISOString(); out = rows.filter(p => !p.publish_at || p.publish_at <= now);
    } catch (e) { }
  }
  if (ctl.hideReposts) out = out.filter(p => !/^🔁 Shared:/.test(p.text || ''));
  if (ctl.mute.length) out = out.filter(p => (me && p.user_id === me.id) || !ctl.mute.some(w => (p.text || '').toLowerCase().includes(w)));
  /* annotate after flat2 renders the posts */
  (async () => {
    let connSet = null, names = {};
    try { if (me && sb) { const cs = await loadConns(sb, me); connSet = new Set(cs.map(c => c.id)); if (ready) (await loadMine(sb, me)).forEach(ci => names[ci.id] = ci.name); } } catch (e) { }
    let tries = 0; const go = () => { const posts = $$('article.fl-post', mount); if (!posts.length && tries++ < 20) return setTimeout(go, 150); const byId = {}; out.forEach(p => byId['post-' + p.id] = p); posts.forEach(el => { if (el.querySelector('.aw-why')) return; const p = byId[el.id]; if (!p) return; const w = document.createElement('details'); w.className = 'aw-why'; w.innerHTML = `<summary>Why am I seeing this?</summary><p>${esc(reasonFor(p, me, connSet, names))}</p>`; el.appendChild(w); }); };
    setTimeout(go, 50);
  })();
  return out;
}

/* ---------- /?v=circles ---------- */
export async function circlesView(body, F3) {
  css(); const sb = F3.sb, me = F3.getMe && F3.getMe(), toast = F3.toast || (() => { });
  body.innerHTML = `<div class="ci-wrap"><div class="ci-card"><h2>Circles</h2><p>Your own audiences. Family sees family things, work sees work things, and they never mix. Put connections in a circle, then pick "Who sees this" when you post. A circle post is visible only to you and that circle. Nobody is told which circles they are in or not in.</p></div><div id="ci-body"><div class="ci-card">Loading…</div></div></div>`;
  const host = $('#ci-body', body);
  if (!me) { host.innerHTML = `<div class="ci-card"><p>Sign in to set up your circles.</p><a class="fl-btn p" href="/?auth=in">Sign in</a> <a class="fl-btn" href="/?auth=join">Join free</a></div>`; return; }
  if (!F3.live || !(await circlesReady(sb))) { host.innerHTML = `<div class="ci-card"><h3>Circles are turning on soon</h3><p>This part needs a quick server update (v26). Until then your posts work exactly as before: public, or connections only.</p></div>`; return; }
  const draw = async () => {
    const list = await seedDefaults(sb, me); const mem = await members(sb, list.map(c => c.id)); const cs = await loadConns(sb, me); const nm = {}; cs.forEach(c => nm[c.id] = c);
    host.innerHTML = `<div class="ci-grid">${list.map(ci => { const ms = mem.filter(m => m.circle_id === ci.id); return `<div class="ci-c" data-ci="${esc(ci.id)}"><h4><i style="background:${esc(ci.color || '#0ea5e9')}"></i>${esc(ci.name)} <small class="muted" style="margin-left:auto">${ms.length}</small></h4><div class="ci-m">${ms.map(m => `<span>${esc((nm[m.member_id] || {}).name || 'Member')}<button type="button" title="Remove" data-rm="${esc(m.member_id)}">×</button></span>`).join('') || '<small class="muted">No one yet.</small>'}</div><div class="ci-row"><select data-add><option value="">Add a connection…</option>${cs.filter(c => !ms.some(m => m.member_id === c.id)).map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.username ? ' @' + esc(c.username) : ''}</option>`).join('')}</select>${ci.kind === 'custom' ? `<button class="fl-btn sm" type="button" data-del>Delete</button>` : ''}</div></div>`; }).join('')}</div>
    <div class="ci-card"><h3>New circle</h3><div class="ci-row"><input data-new maxlength="40" placeholder="e.g. Book club, Hiking crew, Neighbors on 5th"><button class="fl-btn p" type="button" data-mk>Create</button></div>${cs.length ? '' : '<p class="muted" style="margin-top:8px">Circles are made from your connections. <a href="/?v=search">Find people</a> to connect with first.</p>'}</div>`;
    $$('[data-ci]', host).forEach(card => {
      const id = card.dataset.ci;
      const add = $('[data-add]', card); add.onchange = async () => { if (!add.value) return; const { error } = await sb.from('circle_members').insert({ circle_id: id, member_id: add.value, owner_id: me.id }); toast(error ? error.message : 'Added'); draw(); };
      $$('[data-rm]', card).forEach(b => b.onclick = async () => { const { error } = await sb.from('circle_members').delete().eq('circle_id', id).eq('member_id', b.dataset.rm); toast(error ? error.message : 'Removed'); draw(); });
      const del = $('[data-del]', card); if (del) del.onclick = async () => { if (!confirm('Delete this circle? Posts shared with it become visible only to you.')) return; const { error } = await sb.from('circles').delete().eq('id', id); toast(error ? error.message : 'Circle deleted'); myCircles = null; draw(); };
    });
    $('[data-mk]', host).onclick = async () => { const n = ($('[data-new]', host).value || '').trim().slice(0, 40); if (!n) return; const { error } = await sb.from('circles').insert({ owner_id: me.id, name: n, kind: 'custom', sort: 10 + list.length }); toast(error ? error.message : 'Circle created'); myCircles = null; draw(); };
  };
  try { await draw(); } catch (e) { host.innerHTML = `<div class="ci-card">Could not load circles: ${esc(e.message || e)}</div>`; }
}

/* ---------- /?v=mydata ---------- */
export async function myDataView(body, F3) {
  css(); const me = F3.getMe && F3.getMe();
  body.innerHTML = `<div class="ci-wrap"><div class="ci-card"><h2>Your data, your graph</h2><p>Everything you make on allofus.one is yours. Take it with you any time in one tap, or close your account.</p>
  <ul class="ci-promise"><li><b>No ad trackers</b>No third-party ad pixels or behavioral profiles.</li><li><b>Never sold</b>We do not sell or rent your data.</li><li><b>No rage-bait ranking</b>Newest first by default; any other sort shows its formula.</li><li><b>You own your graph</b>Export your posts, connections and circles as open JSON.</li></ul></div>
  <div class="ci-card"><h3>Download my data</h3><p>A JSON file with your profile, posts, comments, reactions, saves, connections, circles, LIFEboard and this device's feed settings.</p>${me ? '<button class="fl-btn p" type="button" data-dl>Download my data</button>' : '<a class="fl-btn p" href="/?auth=in">Sign in to download</a>'}</div>
  <div class="ci-card"><h3>Delete my account</h3><p>Removes your posts, comments, reactions, saves, connections, circles and profile. Your sign-in is removed by our team within 7 days.</p>${me ? '<button class="fl-btn" type="button" data-del style="color:#b91c1c;border-color:#fecaca">Delete my account…</button>' : ''}</div>
  <div class="ci-card"><p class="muted">Questions about your data: info@eyetoad.com · 1-800-481-8638 · <a href="/privacy/">Privacy policy</a> · <a href="/mission/#promise">Our promise</a></p></div></div>`;
  try { const card = document.createElement('div'); card.className = 'ci-card'; card.id = 'ci-identity'; const last = $('.ci-wrap > .ci-card:last-child', body); last.before(card); const ID = await import('./aou-identity.js'); await ID.identityBlock(card, F3); } catch (e) { } /* v27 */
  if (!me) return;
  const F = await import('./aou-flat3.js');
  $('[data-dl]', body).onclick = () => F.exportMyData(F3);
  $('[data-del]', body).onclick = () => F.deleteAccountSheet(F3);
}

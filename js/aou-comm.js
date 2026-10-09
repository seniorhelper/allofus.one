/* allofus.one · Comm core (Oct 2026). One messaging engine and ONE thread renderer, used by the Comm Hub overlay
   (js/aou-hub.js) and the DM page (/?v=dm, js/aou-dm.js), so both look and behave the same.

   Data it reads and writes (nothing is ever rewritten in bulk; only the rows a person acts on):
   - messages        (sender, recipient, body)            private two-person messages
   - hub_requests    (from_user, to_user, kind, body)     notes + requests sent through someone's Comm Hub
   - meeting_requests(from_user, to_user, kind, when_at)  scheduled Unity Calls
   - connections     (requester, addressee, status)       pending connection requests show inside the thread
   - comm_state      (user_id, thread_key, ...)           archive / pin / mute / read, v19 (localStorage until then)
   - profiles.home.comm                                    messaging settings (merged, never overwrites other keys)
   Message bodies carry a tiny markup so cards work on every table without new columns:
     ::re:<itemId>|<snippet>::   first line, a quoted reply      ::img:<url>::  an attached picture (one per line)
     ::vibe:<kind>::  a vibe        ::call:<code>::  a Unity Call     ::meet:<id>|<iso>|<min>|<code>|<title>::  a meeting
     ::react:<itemId>|<kind>::  a reaction on another message (kind "none" removes it)
   Works before supabase/allofus-v19-comm.sql is run: missing columns/tables are detected and skipped. */
import { ic } from './aou-icons2.js';
import { VIBES, burst } from './aou-dm.js';
import { CALL_NAME, newCallCode, callUrl, cleanCode, downloadIcs, googleCalUrl } from './aou-call.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const nowIso = () => new Date().toISOString();
const ms = (iso) => { const t = new Date(iso).getTime(); return isNaN(t) ? 0 : t; };

/* ---------- icons: outlined 24-grid SVG, currentColor (the house style of aou-icons2.js) ---------- */
const P = (d, cls = '') => `<svg class="cm-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const fromHouse = (k, fb) => { const s = ic(k); return s ? s.replace('class="hic"', 'class="hic cm-i"') : fb; };
export const CI = {
  back: P('<path d="M15 18l-6-6 6-6"/>'), more: P('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  send: P('<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>'), clip: P('<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>'),
  reply: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/>'), edit: P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'), copy: P('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  flag: P('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>'), archive: P('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>'),
  unarchive: P('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M12 17v-6M9 14l3-3 3 3"/>'), pin: P('<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>'),
  bell: P('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>'), bellOff: P('<path d="M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l2 2H4"/><path d="M10 21a2 2 0 0 0 4 0M3 3l18 18"/>'),
  unread: P('<rect x="3" y="6" width="16" height="13" rx="2"/><path d="M3 8l8 5 8-5"/><circle cx="19.5" cy="5.5" r="2.5" fill="currentColor" stroke="none"/>'), block: P('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  external: P('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), video: P('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
  cal: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), check: P('<path d="M5 12l5 5 9-10"/>'), checks: P('<path d="M2 12.5l4.5 4.5L15 7.5M11 16l1 1 9.5-9.5"/>'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>'), search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'), gear: fromHouse('⚙️', P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>')),
  retry: P('<path d="M4 4v6h6"/><path d="M4.5 15a8 8 0 1 0 1-8L4 10"/>'), heart: P('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  thumb: P('<path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 3 2l-1 4h6a2 2 0 0 1 2 2.3l-1.5 6.2A2 2 0 0 1 17.5 20H7"/>'), laugh: P('<circle cx="12" cy="12" r="9"/><path d="M8 13.5a4 4 0 0 0 8 0z"/><path d="M9 9h.01M15 9h.01"/>'),
  star: P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'), wow: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="15.5" r="2"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  sparkle: fromHouse('✨', P('<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>')), download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'), inbox: P('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'), compose: P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3"/>'), user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  link: P('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'), phone: P('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>'),
  box: P('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'), image: P('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  file: P('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'), hand: P('<path d="M7 11l3-3a2 2 0 0 1 3 0l1 1 2-2 4 4-5 5-3 3a2 2 0 0 1-3 0l-5-5a2 2 0 0 1 0-3z"/><path d="M3 9l4-4M17 21l4-4"/>'),
  lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'), hex: P('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 8v8M8 10l8 4M16 10l-8 4"/>'), clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
};
const REACTS = [['heart', 'Love'], ['thumb', 'Like'], ['laugh', 'Funny'], ['wow', 'Wow'], ['star', 'Star']];
const REQ = { connect: ['hand', 'Connection request'], phone: ['phone', 'Phone-number request'], package: ['box', 'Package request'], pic: ['image', 'Picture'], gif: ['image', 'GIF'], file: ['file', 'File'] };

/* ---------- body markup ---------- */
const MARK = /^::([a-z]+):([\s\S]*)::$/;
const safeBit = (s, n = 80) => String(s || '').replace(/::|\||\n|\r/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export function parseBody(body) {
  const raw = String(body == null ? '' : body); const t = raw.trim(); const m = MARK.exec(t);
  if (m && !t.includes('\n')) { const [, k, v] = m; const parts = v.split('|');
    if (k === 'vibe') { const vb = VIBES.find(x => x.k === v); if (vb) return { card: { t: 'vibe', v: vb } }; }
    if (k === 'call') return { card: { t: 'call', code: cleanCode(v) } };
    if (k === 'meet') return { card: { t: 'meet', id: parts[0], at: parts[1], mins: +parts[2] || 30, code: cleanCode(parts[3]), title: parts.slice(4).join('|') || CALL_NAME } };
    if (k === 'react') return { react: { target: parts[0], kind: parts[1] || 'heart' } };
  }
  const lines = raw.split('\n'); let quote = null; const imgs = []; const keep = [];
  lines.forEach((ln, i) => { const mm = MARK.exec(ln.trim()); if (mm && mm[1] === 're' && i === 0) { const [id, ...sn] = mm[2].split('|'); quote = { id, snip: sn.join('|') }; return; } if (mm && mm[1] === 'img' && /^https?:\/\/|^\//.test(mm[2])) { imgs.push(mm[2]); return; } keep.push(ln); });
  return { text: keep.join('\n').replace(/^\n+|\n+$/g, ''), quote, imgs };
}
export function buildBody({ text = '', quote = null, imgs = [] }) {
  const out = []; if (quote) out.push(`::re:${safeBit(quote.id, 40)}|${safeBit(quote.snip)}::`); const t = String(text).replace(/\r/g, ''); if (t.trim()) out.push(t.trim()); imgs.forEach(u => out.push(`::img:${String(u).replace(/::|\n/g, '')}::`)); return out.join('\n');
}
export function previewOf(item, meId, names = {}) {
  if (!item) return ''; if (item.src === 'conn') return item.from === meId ? 'You asked to connect' : 'Wants to connect';
  if (item.src === 'meeting') return 'Meeting request' + (item.when_at ? ' · ' + item.when_at : '');
  if (item.src === 'hub' && REQ[item.kind] && !item.body) return REQ[item.kind][1];
  const p = parseBody(item.body); const you = item.from === meId ? 'You: ' : '';
  if (p.card) { if (p.card.t === 'vibe') return you + p.card.v.n; if (p.card.t === 'call') return you + 'Started a ' + CALL_NAME; if (p.card.t === 'meet') return you + 'Scheduled: ' + p.card.title; }
  if (p.text) return you + p.text.replace(/\s+/g, ' ').slice(0, 90); if (p.imgs && p.imgs.length) return you + 'Picture'; return '';
}

/* ---------- formatting ---------- */
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
const fmtFull = (iso) => { try { return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
const dayLabel = (iso) => { const d = new Date(iso), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1); if (dayKey(d) === dayKey(t)) return 'Today'; if (dayKey(d) === dayKey(y)) return 'Yesterday'; return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' }); };
const listTime = (iso) => { if (!iso) return ''; const d = new Date(iso), t = Date.now(); if (dayKey(d) === dayKey(new Date())) return fmtTime(iso); if (t - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'short' }); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }); };
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, (u) => `<a href="${u}" target="_blank" rel="noopener nofollow ugc">${u}</a>`).replace(/\n/g, '<br>');
const COLORS = ['#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f97316', '#16a34a', '#0891b2', '#e11d48'];
const hue = (id) => { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
export const nameOf = (p) => (p && (p.display_name || p.name || p.username)) || 'Member';
export const avatarOf = (p) => (p && ((p.home && p.home.flat && p.home.flat.avatar) || p.avatar_url)) || '';
export function avatarHTML(p, size = 40, online = false) { const a = avatarOf(p); const n = nameOf(p); const inner = a ? `<img src="${esc(a)}" alt="" loading="lazy">` : esc(n.slice(0, 1).toUpperCase()); return `<span class="cm-av" style="--s:${size}px;--c:${hue(p && p.id)}" aria-hidden="true">${inner}${online ? '<i class="cm-on"></i>' : ''}</span>`; }

/* ---------- small helpers: toast above any overlay, a soft chime ---------- */
export function commToast(m) { document.querySelectorAll('.cm-toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'cm-toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000); }
let actx = null; function chime() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t = actx.currentTime; [660, 880].forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.25); o.connect(g).connect(actx.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3); }); } catch (e) { } }

/* ---------- settings ---------- */
export const DEFAULT_SETTINGS = { who: 'everyone', requests: true, receipts: true, sound: true, keepArchived: false };

/* ============================================================
   STORE · loads every conversation for the signed-in person
   ============================================================ */
export function createStore({ sb, me, toast = commToast }) {
  const S = {
    by: new Map(), prof: {}, online: {}, conn: { ok: new Set(), pendIn: new Map(), pendOut: new Set() }, meet: {}, blockedBy: {}, adult: {},
    state: Object.assign({}, LS.get('aou_comm_state_' + me.id, {})), caps: { state: null, edited: null, read: null },
    settings: Object.assign({}, DEFAULT_SETTINGS, LS.get('aou_comm_settings_' + me.id, {}), (me.home && me.home.comm) || {}),
    hidden: new Set(LS.get('aou_comm_hidden_' + me.id, [])), edited: new Set(LS.get('aou_comm_edited_' + me.id, [])),
    blocked: new Set(me.blocked || []), listeners: new Set(), open: null, seq: 0, ch: null, poll: 0, loaded: false
  };
  const emit = (why) => { S.listeners.forEach(fn => { try { fn(why); } catch (e) { console.warn('comm listener', e); } }); };
  const peerOf = (it) => (it.from === me.id ? it.to : it.from);
  const bucket = (peer) => { if (!S.by.has(peer)) S.by.set(peer, new Map()); return S.by.get(peer); };
  const put = (it) => { const p = peerOf(it); if (p) bucket(p).set(it.id, it); };
  const drop = (it) => { for (const m of S.by.values()) m.delete(it.id); };
  const find = (id) => { for (const m of S.by.values()) if (m.has(id)) return m.get(id); return null; };
  const fromMsg = (r) => ({ id: 'm:' + r.id, rid: r.id, src: 'messages', from: r.sender, to: r.recipient, body: r.body || '', at: r.created_at, edited_at: r.edited_at || null, read_at: r.read_at || null, kind: 'dm' });
  const fromHub = (r) => ({ id: 'h:' + r.id, rid: r.id, src: 'hub', from: r.from_user, to: r.to_user, body: r.body || '', media: r.media || null, at: r.created_at, edited_at: r.edited_at || null, read_at: r.read_at || null, kind: r.kind, status: r.status });
  const fromMeet = (r) => ({ id: 'q:' + r.id, rid: r.id, src: 'meeting', from: r.from_user, to: r.to_user, at: r.created_at, kind: 'meeting', mkind: r.kind, when_at: r.when_at, note: r.note, status: r.status });
  const fromConn = (r) => ({ id: 'c:' + r.id, rid: r.id, src: 'conn', from: r.requester, to: r.addressee, at: r.created_at, kind: 'conn', status: r.status });
  const sawCols = (row) => { if (!row) return; if (S.caps.edited === null) S.caps.edited = ('edited_at' in row); if (S.caps.read === null) S.caps.read = ('read_at' in row); };
  const saveState = () => LS.set('aou_comm_state_' + me.id, S.state);
  const safe = (p) => { try { return Promise.resolve(p).then(r => r || { data: [] }, e => ({ data: [], error: e })); } catch (e) { return Promise.resolve({ data: [], error: e }); } };

  async function loadProfiles(ids) {
    ids = ids.filter(id => id && !S.prof[id]); if (!ids.length || !sb) return;
    const r = await safe(sb.from('profiles').select('id,username,display_name,home').in('id', ids)); (r.data || []).forEach(p => { S.prof[p.id] = p; });
    const b = await safe(sb.from('profiles').select('id,blocked,adult').in('id', ids.concat([me.id]))); (b.data || []).forEach(p => { S.blockedBy[p.id] = p.blocked || []; S.adult[p.id] = p.adult; if (p.id === me.id && Array.isArray(p.blocked)) S.blocked = new Set(p.blocked); });
    const o = await safe(sb.from('presence').select('user_id,last_seen').in('user_id', ids)); (o.data || []).forEach(x => { S.online[x.user_id] = Date.now() - ms(x.last_seen) < 3 * 60000; });
  }
  async function loadAll() {
    if (!sb) { S.loaded = true; emit('load'); return; }
    const [m, h, q, c, st] = await Promise.all([
      safe(sb.from('messages').select('*').or(`sender.eq.${me.id},recipient.eq.${me.id}`).is('room', null).order('created_at', { ascending: false }).limit(600)),
      safe(sb.from('hub_requests').select('*').or(`to_user.eq.${me.id},from_user.eq.${me.id}`).order('created_at', { ascending: false }).limit(400)),
      safe(sb.from('meeting_requests').select('*').or(`to_user.eq.${me.id},from_user.eq.${me.id}`).order('created_at', { ascending: false }).limit(200)),
      safe(sb.from('connections').select('*').or(`requester.eq.${me.id},addressee.eq.${me.id}`)),
      safe(sb.from('comm_state').select('*').eq('user_id', me.id))
    ]);
    (m.data || []).forEach(r => { if (r.room) return; sawCols(r); put(fromMsg(r)); });
    (h.data || []).forEach(r => put(fromHub(r)));
    (q.data || []).forEach(r => { S.meet[r.id] = r; put(fromMeet(r)); });
    S.conn = { ok: new Set(), pendIn: new Map(), pendOut: new Set() };
    (c.data || []).forEach(r => { const other = r.requester === me.id ? r.addressee : r.requester; if (r.status === 'accepted') S.conn.ok.add(other); else if (r.status === 'pending') { if (r.addressee === me.id) { S.conn.pendIn.set(other, r); put(fromConn(r)); } else S.conn.pendOut.add(other); } });
    if (st.error) S.caps.state = false; else { S.caps.state = true; (st.data || []).forEach(r => { S.state[r.thread_key] = Object.assign({}, S.state[r.thread_key] || {}, { archived: !!r.archived, archived_at: r.archived_at, pinned: !!r.pinned, muted: !!r.muted, last_read_at: r.last_read_at, unread: !!r.marked_unread, accepted: !!r.accepted }); }); saveState(); }
    await loadProfiles([...S.by.keys()]); S.loaded = true; emit('load');
  }
  function onRow(table, pay) {
    const ev = pay.eventType || pay.type; const row = pay.new && Object.keys(pay.new).length ? pay.new : null; const old = pay.old || {};
    if (ev === 'DELETE') { const pre = table === 'messages' ? 'm:' : table === 'hub_requests' ? 'h:' : table === 'meeting_requests' ? 'q:' : 'c:'; const it = find(pre + old.id); if (it) { drop(it); emit('delete'); } return; }
    if (!row) return; let it;
    if (table === 'messages') { if (row.room) return; sawCols(row); it = fromMsg(row); }
    else if (table === 'hub_requests') it = fromHub(row);
    else if (table === 'meeting_requests') { S.meet[row.id] = row; it = fromMeet(row); }
    else if (table === 'connections') { const other = row.requester === me.id ? row.addressee : row.requester; if (row.status === 'accepted') { S.conn.ok.add(other); S.conn.pendIn.delete(other); const ci = find('c:' + row.id); if (ci) ci.status = 'accepted'; emit('conn'); return; } if (row.status === 'pending' && row.addressee === me.id) { S.conn.pendIn.set(other, row); it = fromConn(row); } else return; }
    if (!it) return; const fresh = !find(it.id);
    if (it.from === me.id && fresh) { const tmp = [...bucket(peerOf(it)).values()].find(x => x.pending && x.body === it.body); if (tmp) drop(tmp); }
    put(it); const peer = peerOf(it);
    const go = () => { emit(fresh ? 'insert' : 'update'); if (fresh && it.from !== me.id) { const stt = S.state['u:' + peer] || {}; const pb = parseBody(it.body); if (pb.react) return; if (!stt.muted) { if (S.settings.sound) chime(); if (S.open !== peer) toast('New message from ' + nameOf(S.prof[peer])); } if (pb.card && pb.card.t === 'vibe' && S.open === peer) burst(pb.card.v.e); if (S.open === peer && document.visibilityState === 'visible') api.markRead(peer); } };
    if (!S.prof[peer]) loadProfiles([peer]).then(go); else go();
  }
  function subscribe() {
    if (!sb || typeof sb.channel !== 'function' || S.ch) return;
    try {
      const ch = sb.channel('comm-' + me.id + '-' + Math.random().toString(36).slice(2, 7));
      const on = (table, filter) => ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (p) => onRow(table, p));
      on('messages', `recipient=eq.${me.id}`); on('messages', `sender=eq.${me.id}`); on('hub_requests', `to_user=eq.${me.id}`); on('hub_requests', `from_user=eq.${me.id}`); on('meeting_requests', `to_user=eq.${me.id}`); on('meeting_requests', `from_user=eq.${me.id}`); on('connections', `addressee=eq.${me.id}`);
      ch.subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { if (!S.poll) S.poll = setInterval(() => loadAll(), 20000); } }); S.ch = ch;
    } catch (e) { if (!S.poll) S.poll = setInterval(() => loadAll(), 20000); }
  }
  function destroy() { try { if (S.ch) sb.removeChannel(S.ch); } catch (e) { } S.ch = null; clearInterval(S.poll); S.poll = 0; S.listeners.clear(); }

  /* reactions are messages too; fold them onto their target */
  function reactionsFor(peer) { const out = {}; const list = [...bucket(peer).values()].filter(it => it.src === 'messages' || it.src === 'hub').sort((a, b) => ms(a.at) - ms(b.at)); for (const it of list) { const p = parseBody(it.body); if (!p.react) continue; const t = (out[p.react.target] = out[p.react.target] || {}); for (const k of Object.keys(t)) t[k].delete(it.from); if (p.react.kind !== 'none') (t[p.react.kind] = t[p.react.kind] || new Set()).add(it.from); } return out; }
  function items(peer) { return [...bucket(peer).values()].filter(it => !S.hidden.has(it.id) && !(it.body && parseBody(it.body).react)).filter(it => !(it.src === 'meeting' && hasMeetCard(peer, it.rid))).sort((a, b) => ms(a.at) - ms(b.at) || String(a.id).localeCompare(String(b.id))); }
  function hasMeetCard(peer, id) { for (const it of bucket(peer).values()) { if (it.src === 'meeting') continue; const p = parseBody(it.body); if (p.card && p.card.t === 'meet' && String(p.card.id) === String(id)) return true; } return false; }
  const actionable = (it) => it.to === me.id && ((it.src === 'conn' && it.status === 'pending') || (it.src === 'hub' && REQ[it.kind] && it.kind !== 'pic' && it.kind !== 'gif' && it.kind !== 'file' && it.status === 'new') || (it.src === 'meeting' && it.status === 'sent'));
  function threadInfo(peer) {
    const list = items(peer); const st = S.state['u:' + peer] || {}; const last = list[list.length - 1] || null; const lastIn = [...list].reverse().find(it => it.from !== me.id);
    const lr = ms(st.last_read_at); let unread = list.filter(it => it.from !== me.id && ms(it.at) > lr && !it.read_at && !(it.src === 'hub' && it.status && it.status !== 'new' && it.kind === 'dm')).length; if (st.unread && !unread) unread = 1;
    const sentAny = list.some(it => it.from === me.id);
    const pending = list.some(actionable); const stranger = !S.conn.ok.has(peer) && peer !== me.id;
    const req = stranger && !st.accepted && (pending || (!sentAny && S.settings.requests !== false && list.length > 0));
    let archived = !!st.archived; if (archived && !S.settings.keepArchived && lastIn && ms(lastIn.at) > ms(st.archived_at)) archived = false;
    return { peer, key: 'u:' + peer, prof: S.prof[peer] || { id: peer }, last, at: last ? last.at : null, unread, req, pending, archived, pinned: !!st.pinned, muted: !!st.muted, online: !!S.online[peer], blocked: S.blocked.has(peer), stranger };
  }
  function threads() { return [...S.by.keys()].filter(p => p && items(p).length).map(threadInfo).sort((a, b) => (b.pinned - a.pinned) || (ms(b.at) - ms(a.at))); }

  async function setState(peer, patch) {
    const k = 'u:' + peer; const cur = Object.assign({}, S.state[k] || {}, patch); S.state[k] = cur; saveState(); emit('state');
    if (!sb || S.caps.state === false) return { local: true };
    const row = { user_id: me.id, thread_key: k, archived: !!cur.archived, archived_at: cur.archived_at || null, pinned: !!cur.pinned, muted: !!cur.muted, last_read_at: cur.last_read_at || null, marked_unread: !!cur.unread, accepted: !!cur.accepted, updated_at: nowIso() };
    try { const { error } = await sb.from('comm_state').upsert(row, { onConflict: 'user_id,thread_key' }); if (error) { S.caps.state = false; return { local: true }; } } catch (e) { S.caps.state = false; return { local: true }; }
    return { local: false };
  }
  async function deliver(tmp) {
    tmp.pending = true; tmp.failed = false; emit('pending');
    try {
      if (!sb) throw new Error('You are offline. Your message will wait here; tap Retry.');
      let item = null; let r = { error: { message: 'too long' } };
      if (tmp.body.length <= 1000) r = await sb.from('messages').insert({ sender: me.id, recipient: tmp.to, body: tmp.body }).select().single();
      if (!r.error && r.data) { sawCols(r.data); item = fromMsg(r.data); }
      else { const r2 = await sb.from('hub_requests').insert({ from_user: me.id, to_user: tmp.to, kind: 'dm', body: tmp.body.slice(0, 2000) }).select().single(); if (r2.error || !r2.data) throw (r2.error || r.error || new Error('Not sent')); item = fromHub(r2.data); }
      drop(tmp); if (!find(item.id)) put(item); emit('sent'); return item;
    } catch (e) { tmp.pending = false; tmp.failed = true; tmp.err = (e && e.message) || String(e); emit('failed'); return null; }
  }
  const api = {
    S, me, sb, toast, get loaded() { return S.loaded; }, get settings() { return S.settings; }, get caps() { return S.caps; },
    on(fn) { S.listeners.add(fn); return () => S.listeners.delete(fn); }, loadAll, subscribe, destroy, threads, threadInfo, items, reactionsFor, find,
    profile: (id) => S.prof[id] || null, isConn: (id) => S.conn.ok.has(id), meeting: (id) => S.meet[id] || null,
    setOpen(peer) { S.open = peer; },
    async ensurePeer(idOrUser) {
      if (!idOrUser) return null; const u = String(idOrUser).replace(/^@/, ''); let p = S.prof[u] || Object.values(S.prof).find(x => x.username && x.username.toLowerCase() === u.toLowerCase());
      if (!p && sb) { let r = await safe(sb.from('profiles').select('id,username,display_name,home').ilike('username', u).limit(1)); p = (r.data || [])[0]; if (!p && u.length >= 2) { const lk = u.replace(/[%_,()]/g, ' ').trim(); r = await safe(sb.from('profiles').select('id,username,display_name,home').ilike('display_name', lk).limit(2)); if ((r.data || []).length === 1) p = r.data[0]; if (!p) { r = await safe(sb.from('profiles').select('id,username,display_name,home').ilike('display_name', lk + '%').limit(2)); if ((r.data || []).length === 1) p = r.data[0]; } } if (!p && /^[0-9a-f-]{8,}$|^u-/.test(u)) { r = await safe(sb.from('profiles').select('id,username,display_name,home').eq('id', u).limit(1)); p = (r.data || [])[0]; } if (p) { await loadProfiles([p.id]).catch(() => { }); S.prof[p.id] = S.prof[p.id] || p; } }
      if (!p && S.by.has(u)) p = { id: u }; if (p) bucket(p.id); return p || null;
    },
    async searchPeople(q) {
      const t = String(q || '').replace(/^@/, '').replace(/[%_,()]/g, ' ').trim(); if (!t || !sb) return [];
      const r = await safe(sb.from('profiles').select('id,username,display_name,home').or(`username.ilike.%${t}%,display_name.ilike.%${t}%`).limit(8)); return (r.data || []).filter(x => x.id !== me.id);
    },
    gate(peer) {
      if (peer === me.id) return { ok: true }; if (S.blocked.has(peer)) return { ok: false, mine: true, why: 'You blocked this person. Unblock them to write again.' };
      if ((S.blockedBy[peer] || []).includes(me.id)) return { ok: false, why: 'This person is not accepting your messages.' };
      if (S.adult[me.id] === false || S.adult[peer] === false) return { ok: false, why: 'Direct messages are for members 18 and older.' };
      const c = ((S.prof[peer] || {}).home || {}).comm || {}; const hasThread = items(peer).some(it => it.from === peer);
      if (c.who === 'nobody' && !hasThread) return { ok: false, why: nameOf(S.prof[peer]) + ' has paused new messages for now.' };
      if (c.who === 'connections' && !S.conn.ok.has(peer) && !hasThread) { if (c.requests === false) return { ok: false, why: nameOf(S.prof[peer]) + ' only takes messages from connections.' }; return { ok: true, request: true }; }
      return { ok: true };
    },
    send(peer, body) { const tmp = { id: 't:' + (++S.seq), src: 'pending', from: me.id, to: peer, body, at: nowIso(), pending: true }; put(tmp); const st = S.state['u:' + peer]; if (st && st.archived) setState(peer, { archived: false }); if (!S.conn.ok.has(peer) && !(S.state['u:' + peer] || {}).accepted) setState(peer, { accepted: true }); return deliver(tmp); },
    retry(id) { const t = find(id); if (t && t.failed) return deliver(t); },
    discard(id) { const t = find(id); if (t && (t.failed || t.pending)) { drop(t); emit('discard'); } },
    async edit(it, text) {
      const p = parseBody(it.body); const nb = buildBody({ text, quote: p.quote, imgs: p.imgs || [] }); if (!nb.trim()) return false; if (!sb) { toast('You are offline.'); return false; }
      const table = it.src === 'messages' ? 'messages' : 'hub_requests'; const patch = { body: nb }; const when = nowIso(); if (S.caps.edited !== false) patch.edited_at = when;
      let r = await safe(sb.from(table).update(patch).eq('id', it.rid).select());
      if (r.error && /edited_at|column/i.test(r.error.message || '')) { S.caps.edited = false; delete patch.edited_at; r = await safe(sb.from(table).update(patch).eq('id', it.rid).select()); }
      if (r.error || !r.data || (Array.isArray(r.data) && !r.data.length)) { toast('Could not edit that one. Editing turns on with the v19 database update.'); return false; }
      it.body = nb; it.edited_at = patch.edited_at || when; S.edited.add(it.id); LS.set('aou_comm_edited_' + me.id, [...S.edited].slice(-500)); emit('edit'); return true;
    },
    isEdited: (it) => !!(it.edited_at || S.edited.has(it.id)),
    async remove(it) {
      if (it.pending || it.failed) { api.discard(it.id); return true; }
      const table = { messages: 'messages', hub: 'hub_requests' }[it.src]; let gone = false;
      if (table && sb && it.from === me.id) { const r = await safe(sb.from(table).delete().eq('id', it.rid).select()); gone = !r.error && Array.isArray(r.data) && r.data.length > 0; }
      if (gone) { drop(it); emit('delete'); toast('Deleted for both of you.'); return true; }
      S.hidden.add(it.id); LS.set('aou_comm_hidden_' + me.id, [...S.hidden].slice(-1000)); emit('hide'); toast(it.from === me.id ? 'Removed from your view. Deleting for both of you turns on with the v19 database update.' : 'Removed from your view.'); return true;
    },
    async respond(it, yes) {
      if (!sb) return; let r;
      if (it.src === 'hub') r = await safe(sb.from('hub_requests').update({ status: yes ? 'accepted' : 'declined' }).eq('id', it.rid));
      else if (it.src === 'conn') { r = await safe(sb.from('connections').update({ status: yes ? 'accepted' : 'declined' }).eq('id', it.rid)); if (!r.error && yes) { S.conn.ok.add(it.from); S.conn.pendIn.delete(it.from); } }
      else if (it.src === 'meeting') { r = await safe(sb.from('meeting_requests').update({ status: yes ? 'accepted' : 'declined' }).eq('id', it.rid)); if (!r.error && S.meet[it.rid]) S.meet[it.rid].status = yes ? 'accepted' : 'declined'; }
      if (r && r.error) { toast('Could not answer: ' + r.error.message); return; } it.status = it.src === 'meeting' ? (yes ? 'accepted' : 'declined') : yes ? 'accepted' : 'declined'; if (yes) await setState(peerOf(it), { accepted: true }); emit('respond'); toast(yes ? 'Accepted.' : 'Declined.');
    },
    async respondMeeting(id, yes) { const row = S.meet[id]; if (!sb || !row) return; const r = await safe(sb.from('meeting_requests').update({ status: yes ? 'accepted' : 'declined' }).eq('id', id)); if (r.error) { toast('Could not answer: ' + r.error.message); return; } row.status = yes ? 'accepted' : 'declined'; emit('respond'); toast(yes ? 'See you there. Added to your Unity Calls.' : 'Declined.'); },
    react(peer, target, kind) { const mine = (reactionsFor(peer)[target] || {})[kind]; const k = mine && mine.has(me.id) ? 'none' : kind; return api.send(peer, `::react:${target}|${k}::`); },
    async markRead(peer) {
      const st = S.state['u:' + peer] || {}; const list = items(peer); const lastIn = [...list].reverse().find(it => it.from !== me.id);
      if (!st.unread && lastIn && ms(st.last_read_at) >= ms(lastIn.at)) return; await setState(peer, { last_read_at: nowIso(), unread: false });
      if (!sb) return;
      const newHub = list.filter(it => it.src === 'hub' && it.kind === 'dm' && it.to === me.id && it.status === 'new'); if (newHub.length) { safe(sb.from('hub_requests').update({ status: 'seen' }).in('id', newHub.map(x => x.rid))); newHub.forEach(x => { x.status = 'seen'; }); }
      if (S.settings.receipts && S.caps.read === true) { const ids = list.filter(it => it.src === 'messages' && it.to === me.id && !it.read_at).map(x => x.rid); if (ids.length) { const r = await safe(sb.from('messages').update({ read_at: nowIso() }).in('id', ids)); if (r.error) S.caps.read = false; } }
    },
    archive: (peer, on) => setState(peer, { archived: on, archived_at: on ? nowIso() : null }),
    pin: (peer, on) => setState(peer, { pinned: on }), mute: (peer, on) => setState(peer, { muted: on }), markUnread: (peer) => setState(peer, { unread: true }), accept: (peer) => setState(peer, { accepted: true }),
    async block(peer, on) {
      const cur = new Set(S.blocked); if (on) cur.add(peer); else cur.delete(peer); if (!sb) { S.blocked = cur; emit('block'); return true; }
      const { error } = await sb.from('profiles').update({ blocked: [...cur] }).eq('id', me.id).then(r => r, e => ({ error: e })); if (error) { toast('Could not update the block list.'); return false; }
      S.blocked = cur; me.blocked = [...cur]; emit('block'); toast(on ? 'Blocked. They can no longer message you.' : 'Unblocked.'); return true;
    },
    async report(it, why) { const peer = peerOf(it); if (!sb) return; const reason = (why || 'Message report') + ' · ' + String(parseBody(it.body).text || it.kind || '').slice(0, 300) + ' · ' + it.id; const r = await safe(sb.from('reports').insert({ reporter: me.id, reported: peer, reason: reason.slice(0, 500) })); toast(r.error ? 'Report noted. If it is urgent, call 1-800-481-8638.' : 'Thank you. The report is with our team.'); },
    async upload(file) {
      if (!sb || !sb.storage) throw new Error('Pictures need the live server.'); if (!/^image\//.test(file.type || '')) throw new Error('Pictures only (JPG, PNG, GIF, WebP).'); if (file.size > 8 * 1024 * 1024) throw new Error('That picture is over 8 MB.');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'; const path = `${me.id}/comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await sb.storage.from('posts').upload(path, file, { contentType: file.type || 'image/jpeg' }); if (error) throw error; return sb.storage.from('posts').getPublicUrl(path).data.publicUrl;
    },
    async schedule(peer, { title, start, minutes, note }) {
      const code = newCallCode(); let id = 'x' + Date.now();
      if (sb) { const r = await safe(sb.from('meeting_requests').insert({ from_user: me.id, to_user: peer, kind: 'call', when_at: new Date(start).toISOString(), note: (title + (note ? ' · ' + note : '')).slice(0, 500), status: 'sent' }).select().single()); if (!r.error && r.data) { id = r.data.id; S.meet[id] = r.data; } }
      await api.send(peer, `::meet:${id}|${new Date(start).toISOString()}|${minutes}|${code}|${safeBit(title, 80)}::`); return { id, code };
    },
    startCall(peer) { const code = newCallCode(); api.send(peer, `::call:${code}::`); return code; },
    async saveSettings(patch) {
      S.settings = Object.assign({}, S.settings, patch); LS.set('aou_comm_settings_' + me.id, S.settings); emit('settings'); if (!sb) return { local: true };
      let home = me.home || {}; try { const { data } = await sb.from('profiles').select('home').eq('id', me.id).maybeSingle(); if (data && data.home && typeof data.home === 'object') home = data.home; } catch (e) { }
      const next = Object.assign({}, home, { comm: Object.assign({}, home.comm || {}, S.settings) });
      try { const { error } = await sb.from('profiles').update({ home: next }).eq('id', me.id); if (error) return { local: true }; me.home = next; return { local: false }; } catch (e) { return { local: true }; }
    }
  };
  return api;
}

/* ============================================================
   UI · list + thread + settings. mountComm(host, {store, mode, single})
   mode 'hub' = inside the Comm Hub overlay, 'page' = the DM page.
   ============================================================ */
let cssDone = false;
export function ensureCommCSS() { if (cssDone || document.getElementById('cm-css')) { cssDone = true; return; } const st = document.createElement('style'); st.id = 'cm-css'; st.textContent = COMM_CSS; document.head.appendChild(st); cssDone = true; }

function popMenu(anchor, html, { label = 'Options', onPick, root = document.body } = {}) {
  closeMenus(); const m = document.createElement('div'); m.className = 'cm-menu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', label); m.innerHTML = html; root.appendChild(m);
  const r = anchor.getBoundingClientRect(); const W = innerWidth, H = innerHeight; const mw = Math.min(260, W - 16); m.style.width = mw + 'px';
  let left = Math.min(Math.max(8, r.right - mw), W - mw - 8); let top = r.bottom + 6; const mh = m.offsetHeight; if (top + mh > H - 8) top = Math.max(8, r.top - mh - 6); m.style.left = left + 'px'; m.style.top = top + 'px';
  const btns = $$('button,a', m); anchor.setAttribute('aria-expanded', 'true'); setTimeout(() => btns[0] && btns[0].focus(), 0);
  const close = (focusBack = true) => { m.remove(); anchor.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', out, true); removeEventListener('resize', closeR); if (focusBack && anchor.isConnected) anchor.focus(); };
  const out = (e) => { if (!m.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(false); }; const closeR = () => close(false);
  document.addEventListener('pointerdown', out, true); addEventListener('resize', closeR);
  m.addEventListener('keydown', (e) => { const i = btns.indexOf(document.activeElement); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' && document.activeElement.closest('.cm-rxrow')) { e.preventDefault(); btns[(i + 1) % btns.length].focus(); } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' && document.activeElement.closest('.cm-rxrow')) { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); } else if (e.key === 'Tab') { close(false); } });
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; if (b.tagName === 'A') { close(false); return; } e.preventDefault(); close(); onPick && onPick(b.dataset.k, b); });
  m._close = close; return m;
}
function closeMenus() { $$('.cm-menu').forEach(m => m._close ? m._close(false) : m.remove()); }
const mi = (k, icon, label, cls = '') => `<button type="button" role="menuitem" class="cm-mi ${cls}" data-k="${k}">${CI[icon] || ''}<span>${esc(label)}</span></button>`;

export function mountComm(host, opt) {
  ensureCommCSS(); const { store, mode = 'hub', single = null } = opt; const toast = opt.toast || store.toast || commToast; const me = store.me;
  let tab = LS.get('aou_comm_tab', 'inbox'); let q = ''; let cur = null; let thread = null; let pane = 'empty';
  host.innerHTML = `<div class="cm-app ${mode}${single ? ' single' : ''}">${single ? '' : `<aside class="cm-side" aria-label="Conversations"><div class="cm-sh"><h2>Messages</h2><button type="button" class="cm-ib" data-a="new" aria-label="New message" title="New message">${CI.compose}</button><button type="button" class="cm-ib" data-a="settings" aria-label="Messaging settings" title="Messaging settings">${CI.gear}</button></div>
    <div class="cm-new" hidden><label class="cm-sr" for="cm-to">Send to</label><input id="cm-to" type="text" autocomplete="off" placeholder="@username" maxlength="30"><button type="button" class="cm-btn p" data-a="go">Open</button></div>
    <div class="cm-search">${CI.search}<label class="cm-sr" for="cm-q">Search messages</label><input id="cm-q" type="search" placeholder="Search people and messages" autocomplete="off"></div>
    <div class="cm-tabs" role="tablist" aria-label="Folders">${[['inbox', 'Inbox'], ['requests', 'Requests'], ['pinned', 'Pinned'], ['archived', 'Archived']].map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}<b class="cm-badge" hidden></b></button>`).join('')}</div>
    <div class="cm-list" role="list"></div></aside>`}<section class="cm-main" aria-live="off"></section></div>`;
  const app = $('.cm-app', host), main = $('.cm-main', host), list = $('.cm-list', host);
  const emptyMain = () => { pane = 'empty'; main.innerHTML = `<div class="cm-empty">${CI.inbox}<h3>Your conversations</h3><p>Pick one on the left to read and reply right here. Replies, edits, pictures, ${CALL_NAME}s and meetings all happen in the thread.</p></div>`; };

  function rowHTML(t, match) {
    const p = t.prof; const prev = match || previewOf(t.last, me.id); const sub = [t.pinned ? `<span class="cm-flag" title="Pinned">${CI.pin}<span class="cm-sr">Pinned</span></span>` : '', t.muted ? `<span class="cm-flag" title="Muted">${CI.bellOff}<span class="cm-sr">Muted</span></span>` : ''].join('');
    return `<div role="listitem"><button type="button" class="cm-row${cur === t.peer ? ' on' : ''}${t.unread ? ' un' : ''}" data-peer="${esc(t.peer)}" aria-current="${cur === t.peer}">${avatarHTML(p, 44, t.online)}<span class="cm-rt"><span class="cm-rn"><b>${esc(nameOf(p))}</b>${sub}<time>${esc(listTime(t.at))}</time></span><span class="cm-rp"><span class="no-icons">${esc(prev)}</span>${t.unread ? `<b class="cm-badge" aria-label="${t.unread} unread">${t.unread > 99 ? '99+' : t.unread}</b>` : ''}</span>${t.pending ? '<span class="cm-tag">Needs your answer</span>' : t.req ? '<span class="cm-tag">Message request</span>' : ''}</span></button></div>`;
  }
  function renderList() {
    if (single || !list) return; const all = store.threads(); const ql = q.trim().toLowerCase();
    const cnt = { inbox: all.filter(t => !t.archived && !t.req && t.unread).length, requests: all.filter(t => t.req && !t.archived).length, pinned: all.filter(t => t.pinned && t.unread).length, archived: all.filter(t => t.archived && t.unread).length };
    $$('.cm-tabs [data-tab]', app).forEach(b => { const n = cnt[b.dataset.tab]; const bd = $('.cm-badge', b); bd.hidden = !n; bd.textContent = n; b.setAttribute('aria-selected', String(b.dataset.tab === tab)); b.tabIndex = b.dataset.tab === tab ? 0 : -1; });
    let rows; const matches = {};
    if (ql) { rows = all.filter(t => { const p = t.prof; if ((nameOf(p) + ' ' + (p.username || '')).toLowerCase().includes(ql)) return true; const hit = store.items(t.peer).reverse().find(it => (parseBody(it.body).text || '').toLowerCase().includes(ql)); if (hit) { matches[t.peer] = parseBody(hit.body).text.replace(/\s+/g, ' ').slice(0, 90); return true; } return false; }); }
    else rows = all.filter(t => tab === 'inbox' ? !t.archived && !t.req : tab === 'requests' ? t.req && !t.archived : tab === 'pinned' ? t.pinned : t.archived);
    const empty = { inbox: 'No conversations yet. Open anyone\'s profile and tap DM, or start one with the pencil above.', requests: 'No requests. Messages from people you are not connected with land here first.', pinned: 'Pin a conversation from its options menu to keep it on top.', archived: 'Nothing archived. Archive a thread from its options menu to tidy your inbox.' }[tab];
    list.innerHTML = !store.loaded ? '<div class="cm-skel"><i></i><i></i><i></i></div>' : rows.length ? rows.map(t => rowHTML(t, matches[t.peer])).join('') : `<p class="cm-none">${ql ? 'No matches for “' + esc(q) + '”.' : esc(empty)}</p>`;
  }
  async function open(peerOrUser, { focus = true } = {}) {
    const p = await store.ensurePeer(peerOrUser); if (!p) { toast('No one by that name.'); return null; }
    if (thread) thread.destroy(); cur = p.id; pane = 'thread'; store.setOpen(p.id); app.classList.add('is-thread');
    thread = mountThread(main, { store, peer: p.id, mode, single, toast, onBack: single ? null : back, onOpenFull: opt.onOpenFull, onOpenHub: opt.onOpenHub });
    renderList(); store.markRead(p.id); if (focus) thread.focus(); return p;
  }
  function back() { if (thread) thread.destroy(); thread = null; const was = cur; cur = null; store.setOpen(null); app.classList.remove('is-thread'); emptyMain(); renderList(); const b = was && $(`.cm-row[data-peer="${CSS.escape(was)}"]`, app); if (b) b.focus(); }
  function openSettings() { if (thread) thread.destroy(); thread = null; cur = null; store.setOpen(null); pane = 'settings'; app.classList.add('is-thread'); mountSettings(main, { store, toast, onBack: single ? null : back }); renderList(); }

  if (!single) {
    app.addEventListener('click', (e) => {
      const r = e.target.closest('.cm-row'); if (r) { open(r.dataset.peer); return; }
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; LS.set('aou_comm_tab', tab); renderList(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'settings') openSettings();
      if (a.dataset.a === 'new') { const n = $('.cm-new', app); n.hidden = !n.hidden; if (!n.hidden) $('#cm-to', app).focus(); }
      if (a.dataset.a === 'go') { const v = $('#cm-to', app).value.trim(); if (v) open(v).then(p => { if (p) { $('.cm-new', app).hidden = true; $('#cm-to', app).value = ''; } }); }
    });
    $('#cm-to', app).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-a="go"]', app).click(); } if (e.key === 'Escape') { $('.cm-new', app).hidden = true; } });
    $('#cm-q', app).addEventListener('input', (e) => { q = e.target.value; renderList(); });
    $('.cm-tabs', app).addEventListener('keydown', (e) => { if (!/Arrow(Left|Right)/.test(e.key)) return; const tabs = $$('[data-tab]', app); const i = tabs.findIndex(b => b.dataset.tab === tab); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; tab = n.dataset.tab; LS.set('aou_comm_tab', tab); renderList(); $(`[data-tab="${tab}"]`, app).focus(); });
    list.addEventListener('keydown', (e) => { if (!/Arrow(Up|Down)|Home|End/.test(e.key)) return; const rows = $$('.cm-row', list); const i = rows.indexOf(document.activeElement); if (i < 0) return; e.preventDefault(); const j = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))); rows[j].focus(); });
  }
  const off = store.on((why) => { renderList(); if (thread) thread.refresh(why); });
  emptyMain(); renderList();
  if (single) open(single, { focus: false });
  return { open, back, openSettings, renderList, destroy() { off(); if (thread) thread.destroy(); closeMenus(); }, get current() { return cur; } };
}

/* ---------- the thread: header, log, composer. Used by the Hub and the DM page. ---------- */
export function mountThread(main, { store, peer, mode, single, toast, onBack, onOpenFull, onOpenHub }) {
  const me = store.me; const draftKey = 'aou_comm_draft_' + me.id + '_' + peer; let quote = null; let editing = null; let atts = []; let first = true; let alive = true;
  main.innerHTML = `<div class="cm-th"><header class="cm-hd">${onBack ? `<button type="button" class="cm-ib cm-backb" data-a="back" aria-label="Back to conversations">${CI.back}</button>` : ''}<span class="cm-hav"></span><div class="cm-who"><b class="cm-hn"></b><small class="cm-hs"></small></div>
      <button type="button" class="cm-ib" data-a="call" aria-label="Start a ${CALL_NAME}" title="Start a ${CALL_NAME}">${CI.video}</button><button type="button" class="cm-ib" data-a="sched" aria-label="Schedule a meeting" title="Schedule a meeting">${CI.cal}</button><button type="button" class="cm-ib" data-a="more" aria-haspopup="menu" aria-expanded="false" aria-label="Conversation options" title="Conversation options">${CI.more}</button></header>
    <div class="cm-banner" hidden></div><div class="cm-log" role="log" aria-label="Messages" tabindex="0"></div>
    <form class="cm-comp" autocomplete="off"><div class="cm-ctx" hidden></div><div class="cm-atts" hidden></div><div class="cm-gate" hidden></div>
      <div class="cm-cbar"><button type="button" class="cm-ib" data-a="attach" aria-label="Attach a picture" title="Attach a picture">${CI.clip}</button><button type="button" class="cm-ib" data-a="vibe" aria-haspopup="menu" aria-expanded="false" aria-label="Send a vibe" title="Send a vibe">${CI.sparkle}</button>
      <label class="cm-sr" for="cm-ta-${esc(peer)}">Message</label><textarea id="cm-ta-${esc(peer)}" class="cm-ta" rows="1" maxlength="1000" placeholder="Write a message"></textarea><button type="submit" class="cm-send" aria-label="Send">${CI.send}</button></div>
      <p class="cm-hint">Enter to send · Shift+Enter for a new line</p><input type="file" accept="image/*" multiple hidden></form></div>`;
  const th = $('.cm-th', main), log = $('.cm-log', th), ta = $('.cm-ta', th), ctxEl = $('.cm-ctx', th), attEl = $('.cm-atts', th), gateEl = $('.cm-gate', th), banner = $('.cm-banner', th), file = $('input[type=file]', th), sendB = $('.cm-send', th);
  ta.value = LS.get(draftKey, '') || ''; const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; }; grow();

  function header() {
    const t = store.threadInfo(peer); const p = t.prof; $('.cm-hav', th).innerHTML = avatarHTML(p, 40, t.online); $('.cm-hn', th).textContent = nameOf(p);
    $('.cm-hs', th).innerHTML = (p.username ? `<a href="/?v=u&u=${esc(p.username)}">@${esc(p.username)}</a>` : '') + ` · ${t.online ? 'online now' : store.isConn(peer) ? 'connected' : peer === me.id ? 'notes to self' : 'not connected'}${t.muted ? ' · muted' : ''}${t.archived ? ' · archived' : ''}`;
    const g = store.gate(peer); const cbar = $('.cm-cbar', th); gateEl.hidden = g.ok; cbar.hidden = !g.ok; $('.cm-hint', th).hidden = !g.ok; $('[data-a="call"]', th).disabled = !g.ok; $('[data-a="sched"]', th).disabled = !g.ok;
    if (!g.ok) gateEl.innerHTML = `${CI.lock}<span>${esc(g.why)}</span>${g.mine ? '<button type="button" class="cm-btn" data-a="unblock">Unblock</button>' : ''}`;
    const reqNote = t.req && !t.pending && t.last && t.last.from !== me.id; banner.hidden = !reqNote && !(g.ok && g.request);
    banner.innerHTML = reqNote ? `<span><b>Message request.</b> ${esc(nameOf(p))} is not one of your connections. Reply or accept to move this to your Inbox.</span><span class="cm-bb"><button type="button" class="cm-btn p" data-a="accept">Accept</button><button type="button" class="cm-btn" data-a="archive">Archive</button><button type="button" class="cm-btn r" data-a="block">Block</button></span>` : g.request ? `<span>${esc(nameOf(p))} takes messages from connections. Yours arrives as a request.</span>` : '';
  }
  function cardHTML(it, c, mine) {
    const p = store.profile(it.from) || (it.from === me.id ? { name: 'You' } : {}); const who = mine ? 'You' : esc(nameOf(p));
    if (c.t === 'vibe') return `<div class="cm-card vibe"><span class="cm-vbig no-icons" aria-hidden="true">${c.v.e}</span><span>${mine ? 'You ' + esc(c.v.msg.replace('you', 'them')) : who + ' ' + esc(c.v.msg)}</span></div>`;
    if (c.t === 'call') return `<div class="cm-card call"><div class="cm-ch">${CI.video}<span><b>${CALL_NAME}</b><small>${who} started a video room · room ${esc(c.code)}</small></span></div><div class="cm-cb"><a class="cm-btn p" href="${esc(callUrl(c.code, false))}" target="_blank" rel="noopener">Join</a><button type="button" class="cm-btn" data-copy="${esc(callUrl(c.code))}">${CI.copy}<span>Copy link</span></button></div></div>`;
    if (c.t === 'meet') { const row = store.meeting(c.id); const status = row ? row.status : 'sent'; const canAnswer = row && row.to_user === me.id && status === 'sent'; const d = new Date(c.at); const valid = !isNaN(d);
      return `<div class="cm-card meet"><div class="cm-ch">${CI.cal}<span><b class="no-icons">${esc(c.title)}</b><small>${valid ? esc(d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })) + ' · ' + esc(fmtTime(c.at)) : 'Time to be set'} · ${c.mins} min · ${CALL_NAME}</small></span></div><p class="cm-cs">${status === 'accepted' ? CI.check + ' Accepted' : status === 'declined' ? 'Declined' : mine ? 'Waiting for an answer' : 'Invitation from ' + who}</p>
        <div class="cm-cb">${canAnswer ? `<button type="button" class="cm-btn p" data-meet="${esc(c.id)}" data-yes="1">Accept</button><button type="button" class="cm-btn" data-meet="${esc(c.id)}" data-yes="0">Decline</button>` : ''}<a class="cm-btn${canAnswer ? '' : ' p'}" href="${esc(callUrl(c.code, false))}" target="_blank" rel="noopener">${CI.video}<span>Join</span></a><button type="button" class="cm-btn" data-ics="${esc(it.id)}">${CI.download}<span>.ics</span></button>${valid ? `<a class="cm-btn" href="${esc(googleCalUrl({ title: c.title, start: c.at, minutes: c.mins, code: c.code }))}" target="_blank" rel="noopener">Google</a>` : ''}</div></div>`; }
    return '';
  }
  function reqHTML(it, mine) {
    const p = store.profile(it.from) || {}; const who = mine ? 'You' : esc(nameOf(p)); const live = !mine && ((it.src === 'conn' && it.status === 'pending') || (it.src === 'hub' && it.status === 'new') || (it.src === 'meeting' && it.status === 'sent'));
    let icon = 'hand', title = 'Connection request', sub = mine ? 'You asked to connect' : who + ' wants to connect';
    if (it.src === 'hub') { const [i, n] = REQ[it.kind] || ['inbox', it.kind]; icon = i; title = n; sub = (mine ? 'You sent' : who + ' sent') + ' this through the Comm Hub'; }
    if (it.src === 'meeting') { icon = 'cal'; title = it.mkind === 'vr' ? 'VR meetup request' : it.mkind === 'call' ? 'Call request' : 'Meeting request'; sub = (it.when_at ? 'When: ' + esc(it.when_at) : 'No time set yet') + (it.note ? ' · ' + esc(it.note) : ''); }
    const st = it.status && it.status !== 'new' && it.status !== 'pending' && it.status !== 'sent' ? `<p class="cm-cs">${it.status === 'accepted' ? CI.check + ' Accepted' : esc(it.status[0].toUpperCase() + it.status.slice(1))}</p>` : '';
    const media = it.media ? (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(it.media) ? `<img class="cm-img" src="${esc(it.media)}" alt="Attachment" loading="lazy" data-lb>` : `<a class="cm-btn" href="${esc(it.media)}" target="_blank" rel="noopener">${CI.file}<span>Open file</span></a>`) : '';
    const body = it.body ? `<div class="cm-tx no-icons">${linkify(it.body)}</div>` : '';
    const acts = live && !(it.src === 'hub' && /^(pic|gif|file)$/.test(it.kind)) ? `<div class="cm-cb"><button type="button" class="cm-btn p" data-resp="${esc(it.id)}" data-yes="1">Accept</button><button type="button" class="cm-btn" data-resp="${esc(it.id)}" data-yes="0">Decline</button></div>` : '';
    return `<div class="cm-card req"><div class="cm-ch">${CI[icon] || CI.inbox}<span><b>${esc(title)}</b><small>${sub}</small></span></div>${body}${media}${st}${acts}</div>`;
  }
  function bubbleHTML(it, rx, isLastMine) {
    const mine = it.from === me.id; const isReq = it.src === 'conn' || it.src === 'meeting' || (it.src === 'hub' && it.kind !== 'dm');
    const p = parseBody(it.body); let inner;
    if (isReq) inner = reqHTML(it, mine);
    else if (p.card) inner = cardHTML(it, p.card, mine);
    else { const qt = p.quote ? (() => { const src = store.find(p.quote.id); const qn = src ? (src.from === me.id ? 'You' : nameOf(store.profile(src.from))) : 'Earlier message'; return `<button type="button" class="cm-quote" data-jump="${esc(p.quote.id)}">${CI.reply}<span><b>${esc(qn)}</b><span class="no-icons">${esc(p.quote.snip)}</span></span></button>`; })() : '';
      inner = `${qt}${p.text ? `<div class="cm-tx no-icons">${linkify(p.text)}</div>` : ''}${(p.imgs || []).map(u => `<img class="cm-img" src="${esc(u)}" alt="Picture" loading="lazy" data-lb>`).join('')}`; }
    const r = rx[it.id] ? Object.entries(rx[it.id]).filter(([, s]) => s.size) : []; const rxs = r.length ? `<div class="cm-rx">${r.map(([k, s]) => `<button type="button" class="cm-rxb${s.has(me.id) ? ' on' : ''}" data-rx="${esc(it.id)}" data-kind="${k}" aria-label="${(REACTS.find(x => x[0] === k) || ['', k])[1]} · ${s.size}" aria-pressed="${s.has(me.id)}">${CI[k] || ''}<span>${s.size}</span></button>`).join('')}</div>` : '';
    let state = ''; if (mine && it.pending) state = ' · Sending…'; else if (mine && it.failed) state = ''; else if (mine && isLastMine) { const seen = store.settings.receipts && (it.read_at || (it.src === 'hub' && it.kind === 'dm' && it.status === 'seen')); state = seen ? ' · Seen' : ' · Sent'; }
    const fail = it.failed ? `<div class="cm-fail" role="alert">Not sent. <button type="button" data-retry="${esc(it.id)}">${CI.retry}<span>Retry</span></button><button type="button" data-discard="${esc(it.id)}">Discard</button></div>` : '';
    const meta = `<div class="cm-meta"><time datetime="${esc(it.at)}" title="${esc(fmtFull(it.at))}">${esc(fmtTime(it.at))}</time>${store.isEdited(it) ? ' · <span class="cm-ed">edited</span>' : ''}${esc(state)}</div>`;
    return `<div class="cm-msg${mine ? ' me' : ''}${isReq || p.card ? ' wide' : ''}${it.pending ? ' pend' : ''}" data-id="${esc(it.id)}"><div class="cm-bub${isReq || p.card ? ' cardb' : ''}">${inner}${meta}</div>${it.pending || it.failed ? '' : `<button type="button" class="cm-mb" data-menu="${esc(it.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Message options">${CI.more}</button>`}${rxs}${fail}</div>`;
  }
  function renderLog() {
    const list = store.items(peer); const rx = store.reactionsFor(peer); const near = first || log.scrollHeight - log.scrollTop - log.clientHeight < 120; const lastMine = [...list].reverse().find(it => it.from === me.id && !it.pending && !it.failed);
    if (!list.length) { log.innerHTML = `<div class="cm-hello">${avatarHTML(store.profile(peer) || { id: peer }, 64)}<b>${esc(nameOf(store.profile(peer)))}</b><p>Say hi. You can send a picture, a vibe, start a ${CALL_NAME} or schedule a meeting from here.</p></div>`; first = false; return; }
    let html = ''; let day = ''; let prev = null;
    for (const it of list) {
      const dk = dayKey(it.at); if (dk !== day) { if (prev) html += '</div></div>'; html += `<div class="cm-day" role="separator"><span>${esc(dayLabel(it.at))}</span></div>`; day = dk; prev = null; }
      const grouped = prev && prev.from === it.from && ms(it.at) - ms(prev.at) < 5 * 60000; const mine = it.from === me.id;
      if (!grouped) { if (prev) html += '</div></div>'; const p = store.profile(it.from) || { id: it.from }; html += `<div class="cm-grp${mine ? ' me' : ''}">${mine ? '<div class="cm-gb">' : `<span class="cm-gav">${avatarHTML(p, 32)}</span><div class="cm-gb"><div class="cm-gn"><b>${esc(nameOf(p))}</b></div>`}`; }
      html += bubbleHTML(it, rx, lastMine && it.id === lastMine.id); prev = it;
    }
    html += '</div></div>'; log.innerHTML = html; if (near) { log.scrollTop = log.scrollHeight; $$('img', log).forEach(im => { if (!im.complete) im.addEventListener('load', () => { if (log.scrollHeight - log.scrollTop - log.clientHeight < 400) log.scrollTop = log.scrollHeight; }, { once: true }); }); } first = false;
  }
  function setCtx() {
    if (editing) { ctxEl.hidden = false; ctxEl.innerHTML = `${CI.edit}<span><b>Editing message</b><span class="no-icons">${esc((parseBody(editing.body).text || '').slice(0, 80))}</span></span><button type="button" class="cm-ib sm" data-a="cancel" aria-label="Cancel editing">${CI.x}</button>`; sendB.setAttribute('aria-label', 'Save edit'); sendB.innerHTML = CI.check; }
    else if (quote) { ctxEl.hidden = false; ctxEl.innerHTML = `${CI.reply}<span><b>Replying to ${esc(quote.name)}</b><span class="no-icons">${esc(quote.snip)}</span></span><button type="button" class="cm-ib sm" data-a="cancel" aria-label="Cancel reply">${CI.x}</button>`; sendB.setAttribute('aria-label', 'Send'); sendB.innerHTML = CI.send; }
    else { ctxEl.hidden = true; ctxEl.innerHTML = ''; sendB.setAttribute('aria-label', 'Send'); sendB.innerHTML = CI.send; }
    attEl.hidden = !atts.length; attEl.innerHTML = atts.map((a, i) => `<span class="cm-att">${a.url ? `<img src="${esc(a.url)}" alt="">` : '<i class="cm-spin" aria-label="Uploading"></i>'}<button type="button" class="cm-ib sm" data-unatt="${i}" aria-label="Remove picture">${CI.x}</button></span>`).join('');
  }
  async function addFiles(files) {
    for (const f of [...files].slice(0, 4 - atts.length)) { const a = { url: '' }; atts.push(a); setCtx(); try { a.url = await store.upload(f); } catch (e) { atts.splice(atts.indexOf(a), 1); toast((e && e.message) || 'Upload failed.'); } setCtx(); }
  }
  async function submit() {
    if (atts.some(a => !a.url)) { toast('Waiting for your picture to finish uploading…'); return; }
    const text = ta.value.replace(/\s+$/, ''); if (!text.trim() && !atts.length) return;
    if (editing) { const it = editing; const ok = await store.edit(it, text); if (ok) { editing = null; ta.value = ''; LS.set(draftKey, ''); setCtx(); grow(); } return; }
    const g = store.gate(peer); if (!g.ok) { toast(g.why); return; }
    const body = buildBody({ text, quote: quote && { id: quote.id, snip: quote.snip }, imgs: atts.map(a => a.url) }); if (body.length > 2000) { toast('That is a long one. Please split it into two messages.'); return; }
    ta.value = ''; LS.set(draftKey, ''); quote = null; atts = []; setCtx(); grow(); first = true; store.send(peer, body); ta.focus();
  }
  function msgMenu(btn) {
    const it = store.find(btn.dataset.menu); if (!it) return; const mine = it.from === me.id; const p = parseBody(it.body); const textual = !p.card && (it.src === 'messages' || (it.src === 'hub' && it.kind === 'dm'));
    const html = `<div class="cm-rxrow" role="group" aria-label="React">${REACTS.map(([k, n]) => `<button type="button" role="menuitem" class="cm-ib" data-k="rx:${k}" aria-label="${n}" title="${n}">${CI[k]}</button>`).join('')}</div>` + mi('reply', 'reply', 'Reply') + (mine && textual ? mi('edit', 'edit', 'Edit') : '') + (p.text || it.body ? mi('copy', 'copy', 'Copy text') : '') + (mine ? mi('del', 'trash', it.src === 'messages' || it.src === 'hub' ? 'Delete' : 'Remove', 'r') : mi('hide', 'trash', 'Remove from my view') + mi('report', 'flag', 'Report', 'r'));
    popMenu(btn, html, { label: 'Message options', onPick: async (k) => {
      if (k.startsWith('rx:')) { store.react(peer, it.id, k.slice(3)); return; }
      if (k === 'reply') { editing = null; quote = { id: it.id, name: mine ? 'yourself' : nameOf(store.profile(it.from)), snip: safeBit(p.text || previewOf(it, me.id), 80) }; setCtx(); ta.focus(); }
      if (k === 'edit') { quote = null; editing = it; ta.value = p.text || ''; setCtx(); grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      if (k === 'copy') { const t = p.text || (p.card && p.card.code ? callUrl(p.card.code) : it.body); try { await navigator.clipboard.writeText(t); toast('Copied.'); } catch (e) { toast('Could not copy on this device.'); } }
      if (k === 'del') { if (confirmIn(th, 'Delete this message for both of you?', () => store.remove(it))) return; }
      if (k === 'hide') store.remove(it);
      if (k === 'report') { const why = prompt('What is wrong with this message? (optional)', ''); if (why !== null) store.report(it, why); }
    } });
  }
  function threadMenu(btn) {
    const t = store.threadInfo(peer); const p = t.prof; const full = mode === 'hub' ? (onOpenFull ? mi('full', 'external', 'Open full conversation') : '') : (onOpenHub ? mi('hub', 'hex', 'Open in Comm Hub') : '');
    const html = mi('call', 'video', 'Start a ' + CALL_NAME) + mi('sched', 'cal', 'Schedule a meeting') + full + (p.username ? `<a role="menuitem" class="cm-mi" data-k="prof" href="/?v=u&u=${esc(p.username)}">${CI.user}<span>View profile</span></a>` : '') + '<hr role="separator">' +
      mi(t.pinned ? 'unpin' : 'pin', 'pin', t.pinned ? 'Unpin' : 'Pin to top') + mi(t.archived ? 'unarchive' : 'archive', t.archived ? 'unarchive' : 'archive', t.archived ? 'Unarchive' : 'Archive') + mi(t.muted ? 'unmute' : 'mute', t.muted ? 'bell' : 'bellOff', t.muted ? 'Unmute' : 'Mute') + mi('unread', 'unread', 'Mark as unread') + '<hr role="separator">' + (peer !== me.id ? mi(t.blocked ? 'unblock' : 'block', 'block', t.blocked ? 'Unblock' : 'Block', t.blocked ? '' : 'r') : '');
    popMenu(btn, html, { label: 'Conversation options', onPick: (k) => act(k) });
  }
  async function act(k) {
    const t = store.threadInfo(peer); const p = t.prof;
    if (k === 'back') onBack && onBack();
    if (k === 'more') threadMenu($('[data-a="more"]', th));
    if (k === 'call') { const g = store.gate(peer); if (!g.ok) { toast(g.why); return; } store.startCall(peer); toast(CALL_NAME + ' link posted. Tap Join to go in.'); first = true; }
    if (k === 'sched') schedSheet();
    if (k === 'full') onOpenFull && onOpenFull(p); if (k === 'hub') onOpenHub && onOpenHub(p);
    if (k === 'pin' || k === 'unpin') { await store.pin(peer, k === 'pin'); toast(k === 'pin' ? 'Pinned to the top.' : 'Unpinned.'); }
    if (k === 'archive' || k === 'unarchive') { await store.archive(peer, k === 'archive'); toast(k === 'archive' ? 'Archived. Find it under Archived.' : 'Back in your Inbox.'); if (k === 'archive' && onBack && !single) onBack(); }
    if (k === 'mute' || k === 'unmute') { await store.mute(peer, k === 'mute'); toast(k === 'mute' ? 'Muted. No sounds or pop-ups from this thread.' : 'Unmuted.'); }
    if (k === 'unread') { await store.markUnread(peer); toast('Marked as unread.'); if (onBack && !single) onBack(); }
    if (k === 'block') confirmIn(th, 'Block ' + nameOf(p) + '? They will not be able to message you.', () => store.block(peer, true));
    if (k === 'unblock') store.block(peer, false);
    if (k === 'accept') { await store.accept(peer); toast('Moved to your Inbox.'); }
  }
  function schedSheet() {
    const g = store.gate(peer); if (!g.ok) { toast(g.why); return; } const p = store.profile(peer) || {}; const d = new Date(Date.now() + 864e5); const pad = (n) => String(n).padStart(2, '0'); const dv = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const sh = document.createElement('div'); sh.className = 'cm-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', 'Schedule a meeting');
    sh.innerHTML = `<form class="cm-sf"><div class="cm-sfh">${CI.cal}<b>Schedule a ${CALL_NAME}</b><button type="button" class="cm-ib" data-x aria-label="Close">${CI.x}</button></div><label>Title<input name="t" maxlength="80" required value="${esc(CALL_NAME + ' with ' + nameOf(p))}"></label><div class="cm-2"><label>Date<input name="d" type="date" required value="${dv}"></label><label>Time<input name="h" type="time" required value="10:00"></label></div><label>Length<select name="m"><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option></select></label><label>Note (optional)<textarea name="n" maxlength="300" rows="2" placeholder="What is it about?"></textarea></label><p class="cm-hint">${esc(nameOf(p))} gets an invitation card in this thread with Accept, Join and a calendar file. The video room is a ${CALL_NAME} link.</p><div class="cm-cb"><button type="submit" class="cm-btn p">Send invitation</button><button type="button" class="cm-btn" data-x>Cancel</button></div></form>`;
    th.appendChild(sh); const f = $('form', sh); const close = () => { sh.remove(); $('[data-a="sched"]', th).focus(); }; $$('[data-x]', sh).forEach(b => b.onclick = close); sh.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }); setTimeout(() => f.t.focus(), 0);
    f.onsubmit = async (e) => { e.preventDefault(); const start = new Date(f.d.value + 'T' + f.h.value); if (isNaN(start)) { toast('Pick a date and time.'); return; } const b = $('[type=submit]', f); b.disabled = true; first = true; await store.schedule(peer, { title: f.t.value.trim() || CALL_NAME, start, minutes: +f.m.value, note: f.n.value.trim() }); sh.remove(); toast('Invitation sent.'); ta.focus(); };
  }
  th.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]'); if (a && a.closest('.cm-th') === th && !a.closest('.cm-sheet')) {
      const k = a.dataset.a; if (k === 'attach') { file.click(); return; } if (k === 'vibe') { vibeMenu(a); return; } if (k === 'cancel') { quote = null; if (editing) { editing = null; ta.value = ''; grow(); } setCtx(); ta.focus(); return; } act(k); return; }
    const mb = e.target.closest('[data-menu]'); if (mb) { msgMenu(mb); return; }
    const rb = e.target.closest('[data-rx]'); if (rb) { store.react(peer, rb.dataset.rx, rb.dataset.kind); return; }
    const rt = e.target.closest('[data-retry]'); if (rt) { store.retry(rt.dataset.retry); return; } const dc = e.target.closest('[data-discard]'); if (dc) { store.discard(dc.dataset.discard); return; }
    const ua = e.target.closest('[data-unatt]'); if (ua) { atts.splice(+ua.dataset.unatt, 1); setCtx(); return; }
    const rs = e.target.closest('[data-resp]'); if (rs) { const it = store.find(rs.dataset.resp); if (it) store.respond(it, rs.dataset.yes === '1'); return; }
    const mt = e.target.closest('[data-meet]'); if (mt) { store.respondMeeting(mt.dataset.meet, mt.dataset.yes === '1'); return; }
    const cp = e.target.closest('[data-copy]'); if (cp) { navigator.clipboard.writeText(cp.dataset.copy).then(() => toast('Link copied.'), () => toast(cp.dataset.copy)); return; }
    const ics = e.target.closest('[data-ics]'); if (ics) { const it = store.find(ics.dataset.ics); const c = it && parseBody(it.body).card; if (c) downloadIcs({ id: c.id, title: c.title, start: c.at, minutes: c.mins, code: c.code, organizer: nameOf(store.profile(it.from)) }); return; }
    const jq = e.target.closest('[data-jump]'); if (jq) { const t = $(`.cm-msg[data-id="${CSS.escape(jq.dataset.jump)}"]`, log); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } return; }
  });
  function vibeMenu(btn) { const html = `<div class="cm-vgrid">${VIBES.map(v => `<button type="button" role="menuitem" class="cm-mi" data-k="${v.k}">${v.icon || CI.sparkle}<span>${esc(v.n)}</span></button>`).join('')}</div>`; popMenu(btn, html, { label: 'Send a vibe', onPick: (k) => { const g = store.gate(peer); if (!g.ok) { toast(g.why); return; } const v = VIBES.find(x => x.k === k); first = true; store.send(peer, `::vibe:${k}::`); if (v) burst(v.e); } }); }
  // long-press a bubble on touch to open its menu
  let lp = 0; log.addEventListener('touchstart', (e) => { const m = e.target.closest('.cm-msg'); if (!m || e.target.closest('a,button')) return; lp = setTimeout(() => { const b = $('.cm-mb', m); if (b) msgMenu(b); }, 520); }, { passive: true }); ['touchend', 'touchmove', 'touchcancel'].forEach(ev => log.addEventListener(ev, () => clearTimeout(lp), { passive: true }));
  $('form', th).addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); submit(); } else if (e.key === 'Escape' && (quote || editing)) { e.preventDefault(); quote = null; if (editing) { editing = null; ta.value = ''; grow(); } setCtx(); } else if (e.key === 'ArrowUp' && !ta.value) { const last = [...store.items(peer)].reverse().find(it => it.from === me.id && (it.src === 'messages' || (it.src === 'hub' && it.kind === 'dm')) && !parseBody(it.body).card && !it.pending); if (last) { e.preventDefault(); editing = last; ta.value = parseBody(last.body).text || ''; setCtx(); grow(); } } });
  ta.addEventListener('input', () => { grow(); LS.set(draftKey, ta.value.slice(0, 1000)); });
  ta.addEventListener('paste', (e) => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); addFiles(fs); } });
  file.addEventListener('change', () => { addFiles(file.files); file.value = ''; });
  th.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); th.classList.add('drop'); } }); th.addEventListener('dragleave', () => th.classList.remove('drop')); th.addEventListener('drop', (e) => { th.classList.remove('drop'); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
  const onVis = () => { if (document.visibilityState === 'visible' && alive) store.markRead(peer); }; document.addEventListener('visibilitychange', onVis);
  header(); renderLog(); setCtx();
  return {
    refresh(why) { if (!alive) return; header(); if (why !== 'state') renderLog(); if (why === 'insert') store.markRead(peer); if (editing && !store.find(editing.id)) { editing = null; setCtx(); } },
    focus() { if (!$('.cm-cbar', th).hidden && matchMedia('(min-width: 900px)').matches) ta.focus(); else { const h = $('.cm-hn', th); h.tabIndex = -1; h.focus({ preventScroll: true }); } },
    destroy() { alive = false; document.removeEventListener('visibilitychange', onVis); closeMenus(); }
  };
}
function confirmIn(root, text, yes) {
  const d = document.createElement('div'); d.className = 'cm-sheet'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', text);
  d.innerHTML = `<div class="cm-sf cm-conf"><p>${esc(text)}</p><div class="cm-cb"><button type="button" class="cm-btn r" data-y>Yes</button><button type="button" class="cm-btn" data-n>Cancel</button></div></div>`; root.appendChild(d);
  const close = () => d.remove(); $('[data-n]', d).onclick = close; $('[data-y]', d).onclick = () => { close(); yes(); }; d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }); setTimeout(() => $('[data-n]', d).focus(), 0); return true;
}

/* ---------- messaging settings (who can message me, requests, receipts, sound, archive) ---------- */
export function mountSettings(main, { store, toast = commToast, onBack }) {
  const s = store.settings; const sw = (k, t, d) => `<label class="cm-sw"><span><b>${t}</b><small>${d}</small></span><input type="checkbox" name="${k}" ${s[k] ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
  main.innerHTML = `<div class="cm-th cm-set"><header class="cm-hd">${onBack ? `<button type="button" class="cm-ib cm-backb" data-a="back" aria-label="Back to conversations">${CI.back}</button>` : ''}<span class="cm-hav">${CI.gear}</span><div class="cm-who"><b class="cm-hn" tabindex="-1">Messaging settings</b><small>Saved to your account</small></div></header>
    <form class="cm-setf"><fieldset><legend>Who can message me</legend>${[['everyone', 'Everyone', 'Anyone on allofus.one. People you are not connected with land in Requests.'], ['connections', 'Connections only', 'Others can still send a request if requests are on.'], ['nobody', 'Nobody new', 'Pause new conversations. Existing threads keep working.']].map(([v, n, d]) => `<label class="cm-radio"><input type="radio" name="who" value="${v}" ${s.who === v ? 'checked' : ''}><span><b>${n}</b><small>${d}</small></span></label>`).join('')}</fieldset>
    <fieldset><legend>Inbox</legend>${sw('requests', 'Message requests', 'Let people who are not connections ask to start a conversation.')}${sw('receipts', 'Read receipts', 'Show people when you have seen their message. Off means you do not see theirs either.')}${sw('sound', 'Notification sound', 'A soft chime when a new message arrives (muted threads stay quiet).')}${sw('keepArchived', 'Keep archived chats hidden', 'When off, an archived chat comes back to the Inbox when a new message arrives.')}</fieldset>
    <div class="cm-cb"><button type="submit" class="cm-btn p">Save settings</button><span class="cm-ok" role="status"></span></div><p class="cm-hint">Blocking, muting and archiving are per conversation: open a thread and use its options menu.</p></form></div>`;
  const f = $('form', main); $('[data-a="back"]', main) && ($('[data-a="back"]', main).onclick = onBack); setTimeout(() => { const h = $('.cm-hn', main); h && h.focus({ preventScroll: true }); }, 0);
  f.onsubmit = async (e) => { e.preventDefault(); const patch = { who: (f.querySelector('[name=who]:checked') || {}).value || 'everyone', requests: f.requests.checked, receipts: f.receipts.checked, sound: f.sound.checked, keepArchived: f.keepArchived.checked }; const ok = $('.cm-ok', f); ok.textContent = 'Saving…'; const r = await store.saveSettings(patch); ok.textContent = r.local ? 'Saved on this device.' : 'Saved.'; toast(r.local ? 'Settings saved on this device.' : 'Messaging settings saved.'); };
}

/* ============================================================ CSS (FLAT design: Poppins, ink #14183a, sky→indigo) */
export const COMM_CSS = `
.cm-nf{display:flex;flex-direction:column;gap:8px;margin:0 0 10px;padding:14px 16px;border:1px solid #fcd34d;background:#fffbeb;border-radius:12px;color:#78350f;font:500 14px Poppins,Arial}.cm-nf b{font-weight:800}.cm-nf-list{display:flex;flex-wrap:wrap;gap:8px}.cm-nf-list button{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 12px 6px 6px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#0f172a;cursor:pointer;font:600 14px Poppins,Arial;text-align:left}.cm-nf-list button:hover,.cm-nf-list button:focus-visible{border-color:#2563eb;outline:none;box-shadow:0 0 0 3px rgba(37,99,235,.18)}.cm-nf-list small{display:block;color:#64748b;font-weight:500}.cm-nf-go{align-self:flex-start;color:#1d4ed8;font-weight:700}
.cm-app,.cm-menu,.cm-scope,#hub{--ink:#14183a;--mut:#64748b;--line:#e5e7eb;--line2:#cbd5e1;--bg:#f6f8fc;--sky:#0ea5e9;--ind:#4f46e5;--acc:#0369a1;--soft:#f1f5f9;--red:#dc2626}
.cm-app{font-family:Poppins,"Segoe UI",Arial,sans-serif;color:var(--ink);display:grid;grid-template-columns:340px minmax(0,1fr);height:100%;min-height:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-sizing:border-box}
.cm-app *,.cm-menu *,.cm-app *::before{box-sizing:border-box}.cm-app [hidden],.cm-menu [hidden],#hub [hidden]{display:none!important}.cm-app.single{grid-template-columns:minmax(0,1fr)}
.cm-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cm-i{width:20px;height:20px;flex:none;display:inline-block;vertical-align:middle}
.cm-app :focus-visible,.cm-menu :focus-visible{outline:2px solid #6366f1;outline-offset:2px}
.cm-side{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:#fff}
.cm-sh{display:flex;align-items:center;gap:4px;padding:12px 12px 6px 16px}.cm-sh h2{flex:1;margin:0;font:800 20px/1.2 Poppins,Arial;color:var(--ink)}
.cm-ib{width:40px;height:40px;border:1px solid transparent;background:transparent;border-radius:10px;display:inline-grid;place-items:center;color:var(--ink);cursor:pointer;flex:none;padding:0}.cm-ib:hover{background:var(--soft)}.cm-ib:disabled{opacity:.35;cursor:not-allowed}.cm-ib.sm{width:30px;height:30px}.cm-ib.sm .cm-i{width:16px;height:16px}
.cm-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:7px 12px;border:1px solid var(--line2);background:#fff;color:var(--ink)!important;border-radius:10px;font:700 13px Poppins,Arial;cursor:pointer;text-decoration:none;white-space:nowrap}.cm-btn:hover{border-color:#94a3b8}.cm-btn .cm-i{width:16px;height:16px}.cm-btn.p{background:linear-gradient(135deg,var(--acc),var(--ind));border-color:transparent;color:#fff!important}.cm-btn.r{color:var(--red)!important;border-color:#fecaca}.cm-btn:disabled{opacity:.5}
.cm-new{display:flex;gap:6px;padding:4px 12px 8px}.cm-new input{flex:1;min-width:0}
.cm-new input,.cm-search input,.cm-sf input,.cm-sf select,.cm-sf textarea{border:1px solid var(--line2);border-radius:10px;padding:9px 11px;font:500 14px Poppins,Arial;color:var(--ink);background:#fff;min-height:40px;width:100%}
.cm-search{position:relative;margin:2px 12px 8px}.cm-search .cm-i{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--mut)}.cm-search input{padding-left:36px;background:var(--soft);border-color:transparent}.cm-search input:focus{background:#fff;border-color:var(--line2)}
.cm-tabs{display:flex;gap:2px;padding:0 8px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}.cm-tabs::-webkit-scrollbar{display:none}.cm-tabs button{flex:1 0 auto;border:0;background:none;padding:10px 6px;white-space:nowrap;font:700 13px Poppins,Arial;color:var(--mut);cursor:pointer;border-bottom:2px solid transparent;display:inline-flex;gap:6px;align-items:center;justify-content:center;min-height:42px;border-radius:8px 8px 0 0}.cm-tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--ind)}
.cm-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:8px;background:var(--ind);color:#fff;font:800 11px/1 Poppins,Arial}
.cm-list{flex:1;overflow-y:auto;padding:6px;min-height:0}.cm-none{color:var(--mut);font-size:13px;padding:16px 10px;margin:0}
.cm-row{display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:10px;border:0;border-radius:12px;background:none;cursor:pointer;color:var(--ink);font:inherit;min-height:64px}.cm-row:hover{background:var(--soft)}.cm-row.on{background:#eef2ff}
.cm-rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.cm-rn{display:flex;align-items:center;gap:6px;min-width:0}.cm-rn b{font-weight:600;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.cm-rn time{margin-left:auto;color:var(--mut);font-size:12px;flex:none}.cm-row.un .cm-rn b{font-weight:800}
.cm-rp{display:flex;align-items:center;gap:8px;color:var(--mut);font-size:13px;min-width:0}.cm-rp>span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.cm-row.un .cm-rp>span{color:var(--ink);font-weight:600}
.cm-flag{color:var(--mut);display:inline-flex}.cm-flag .cm-i{width:14px;height:14px}.cm-tag{align-self:flex-start;font:700 11px Poppins,Arial;color:#9a3412;background:#ffedd5;border-radius:6px;padding:1px 7px;margin-top:2px}
.cm-av{position:relative;width:var(--s);height:var(--s);border-radius:50%;background:var(--c);color:#fff;display:inline-grid;place-items:center;font:800 calc(var(--s)*.4)/1 Poppins,Arial;flex:none}.cm-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}.cm-on{position:absolute;right:0;bottom:0;width:30%;height:30%;min-width:10px;min-height:10px;border-radius:50%;background:#22c55e;border:2px solid #fff}
.cm-skel i{display:block;height:56px;border-radius:12px;margin:6px;background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9);background-size:200% 100%;animation:cmsk 1.2s infinite}@keyframes cmsk{to{background-position:-200% 0}}
.cm-main{position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--bg)}
.cm-empty{margin:auto;text-align:center;max-width:380px;padding:24px;color:var(--mut)}.cm-empty .cm-i{width:44px;height:44px;color:#94a3b8}.cm-empty h3{color:var(--ink);font:800 18px Poppins,Arial;margin:10px 0 6px}.cm-empty p{margin:0;font-size:14px;line-height:1.5}
.cm-th{position:relative;display:flex;flex-direction:column;flex:1;min-height:0}
.cm-hd{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 14px;background:#fff;border-bottom:1px solid var(--line);min-height:62px}.cm-hav{display:inline-flex;color:var(--ind)}.cm-who{flex:1;min-width:0;display:flex;flex-direction:column}.cm-who b{font:800 15.5px/1.25 Poppins,Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;outline:none}.cm-who small{color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-who small a{color:var(--acc);text-decoration:none;font-weight:600}
.cm-backb{display:none}
.cm-banner{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;background:#fff7ed;border-bottom:1px solid #fed7aa;font-size:13px}.cm-banner>span:first-child{flex:1 1 220px}.cm-bb{display:flex;gap:6px;flex-wrap:wrap}
.cm-log{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 14px 8px;min-height:0;outline:none;overscroll-behavior:contain}
.cm-hello{text-align:center;color:var(--mut);padding:40px 16px}.cm-hello b{display:block;color:var(--ink);font:800 17px Poppins,Arial;margin:10px 0 4px}.cm-hello p{margin:0 auto;max-width:340px;font-size:14px}
.cm-day{display:flex;align-items:center;gap:10px;color:var(--mut);font:700 11.5px Poppins,Arial;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.04em}.cm-day::before,.cm-day::after{content:"";flex:1;height:1px;background:var(--line)}
.cm-grp{display:flex;gap:8px;align-items:flex-start;margin:10px 0}.cm-grp.me{justify-content:flex-end}.cm-gav{padding-top:18px}.cm-gb{display:flex;flex-direction:column;gap:3px;min-width:0;max-width:min(78%,560px)}.cm-grp.me .cm-gb{align-items:flex-end}
.cm-gn{display:flex;gap:8px;align-items:baseline;font-size:12px;color:var(--mut);padding:0 4px}.cm-gn b{color:var(--ink);font-weight:700;font-size:12.5px}
.cm-msg{position:relative;display:flex;align-items:center;gap:2px;max-width:100%;flex-wrap:wrap}.cm-msg.me{flex-direction:row-reverse}.cm-msg.flash .cm-bub{box-shadow:0 0 0 3px #a5b4fc}.cm-msg.pend{opacity:.7}
.cm-bub{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 12px 6px;font-size:14.5px;line-height:1.45;min-width:0;max-width:100%;overflow-wrap:anywhere}.cm-msg.me .cm-bub{background:linear-gradient(135deg,var(--acc),var(--ind));border-color:transparent;color:#fff}.cm-msg.me .cm-bub a{color:#fff}.cm-bub.cardb{background:#fff!important;color:var(--ink)!important;border:1px solid var(--line)!important;padding:10px 12px 6px}
.cm-tx a{color:var(--acc);text-decoration:underline}
.cm-meta{font-size:11px;opacity:.72;margin-top:2px;text-align:right;white-space:nowrap}.cm-ed{font-style:italic}
.cm-img{display:block;max-width:min(100%,320px);max-height:320px;border-radius:10px;margin:6px 0 2px;cursor:zoom-in;object-fit:cover;background:#e2e8f0}
.cm-quote{display:flex;gap:6px;align-items:flex-start;width:100%;text-align:left;border:0;border-left:3px solid currentColor;background:rgba(15,23,42,.06);border-radius:8px;padding:5px 8px;margin:2px 0 6px;font:inherit;font-size:12.5px;color:inherit;cursor:pointer;opacity:.9}.cm-msg.me .cm-quote{background:rgba(255,255,255,.16)}.cm-quote .cm-i{width:14px;height:14px;margin-top:2px}.cm-quote>span{display:flex;flex-direction:column;min-width:0}.cm-quote>span>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-mb{width:32px;height:32px;border:0;background:none;border-radius:8px;color:var(--mut);cursor:pointer;display:grid;place-items:center;opacity:0;flex:none;padding:0}.cm-mb .cm-i{width:18px;height:18px}.cm-msg:hover .cm-mb,.cm-mb:focus-visible,.cm-mb[aria-expanded=true]{opacity:1}.cm-mb:hover{background:#e2e8f0}
@media (hover:none){.cm-mb{opacity:.55}}
.cm-rx{flex-basis:100%;display:flex;gap:4px;flex-wrap:wrap;margin:-2px 6px 0}.cm-msg.me .cm-rx{justify-content:flex-end}.cm-rxb{display:inline-flex;align-items:center;gap:3px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:2px 7px;font:700 12px Poppins,Arial;color:var(--ink);cursor:pointer;min-height:26px}.cm-rxb .cm-i{width:14px;height:14px;color:#e11d48}.cm-rxb.on{border-color:#a5b4fc;background:#eef2ff}
.cm-fail{flex-basis:100%;text-align:right;font-size:12px;color:var(--red);font-weight:700;display:flex;gap:6px;justify-content:flex-end;align-items:center}.cm-fail button{border:1px solid #fecaca;background:#fff;color:var(--red);border-radius:8px;padding:3px 8px;font:700 12px Poppins,Arial;cursor:pointer;display:inline-flex;gap:4px;align-items:center;min-height:28px}.cm-fail .cm-i{width:14px;height:14px}
.cm-msg.wide .cm-bub{width:min(420px,calc(100% - 40px))}.cm-who b:focus{outline:none}.cm-msg.wide{max-width:100%}
.cm-card .cm-ch{display:flex;gap:10px;align-items:flex-start}.cm-card .cm-ch>.cm-i{width:24px;height:24px;color:var(--ind);margin-top:2px}.cm-card .cm-ch>span{display:flex;flex-direction:column;min-width:0}.cm-card b{font-weight:800;font-size:14.5px}.cm-card small{color:var(--mut);font-size:12.5px}
.cm-cb{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.cm-cs{margin:6px 0 0;font-size:12.5px;color:var(--mut);display:flex;gap:4px;align-items:center}.cm-cs .cm-i{width:15px;height:15px;color:#16a34a}
.cm-card.vibe{text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:13.5px}.cm-vbig{font-size:36px;line-height:1.1;animation:cmpop .6s cubic-bezier(.2,1.6,.4,1)}@keyframes cmpop{0%{transform:scale(.3)}100%{transform:scale(1)}}
.cm-card .cm-tx{margin-top:6px}
.cm-comp{background:#fff;border-top:1px solid var(--line);padding:8px 10px calc(6px + env(safe-area-inset-bottom))}
.cm-ctx{display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:6px;background:#eef2ff;border-radius:10px;font-size:12.5px}.cm-ctx>.cm-i{width:16px;height:16px;color:var(--ind)}.cm-ctx>span{flex:1;min-width:0;display:flex;flex-direction:column}.cm-ctx>span>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut)}
.cm-atts{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}.cm-att{position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;background:#e2e8f0;display:grid;place-items:center}.cm-att img{width:100%;height:100%;object-fit:cover}.cm-att .cm-ib{position:absolute;top:2px;right:2px;background:rgba(255,255,255,.9)}
.cm-spin{width:20px;height:20px;border-radius:50%;border:3px solid #c7d2fe;border-top-color:var(--ind);animation:cmspin 1s linear infinite}@keyframes cmspin{to{transform:rotate(360deg)}}
.cm-cbar{display:flex;align-items:flex-end;gap:4px}.cm-ta{flex:1;min-width:0;resize:none;border:1px solid var(--line2);border-radius:12px;padding:10px 12px;font:500 15px/1.4 Poppins,Arial;color:var(--ink);max-height:160px;min-height:42px;background:#fff}.cm-ta:focus{border-color:#818cf8;outline:none;box-shadow:0 0 0 3px #e0e7ff}
.cm-send{width:44px;height:42px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--acc),var(--ind));color:#fff;display:grid;place-items:center;cursor:pointer;flex:none}.cm-send:hover{filter:brightness(1.08)}
.cm-hint{margin:4px 2px 0;font-size:11.5px;color:var(--mut)}.cm-gate{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--mut);padding:6px}.cm-gate>span{flex:1}
.cm-th.drop::after{content:"Drop pictures to attach";position:absolute;inset:8px;border:2px dashed #818cf8;border-radius:12px;background:rgba(238,242,255,.9);display:grid;place-items:center;font:800 16px Poppins,Arial;color:var(--ind);pointer-events:none}
.cm-menu{position:fixed;z-index:100001;background:#fff;border:1px solid var(--line,#e5e7eb);border-radius:12px;box-shadow:0 18px 40px rgba(2,8,30,.18);padding:6px;font-family:Poppins,Arial;color:#14183a;max-height:70vh;overflow:auto}
.cm-menu hr{border:0;border-top:1px solid #e5e7eb;margin:4px 2px}.cm-mi{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:9px 10px;border-radius:8px;font:600 14px Poppins,Arial;color:#14183a;cursor:pointer;text-align:left;text-decoration:none;min-height:40px}.cm-mi:hover,.cm-mi:focus{background:#f1f5f9}.cm-mi.r{color:#dc2626}.cm-mi .cm-i,.cm-mi .hic{width:18px;height:18px}
.cm-rxrow{display:flex;justify-content:space-between;gap:2px;padding:2px 2px 6px;border-bottom:1px solid #e5e7eb;margin-bottom:4px}.cm-rxrow .cm-ib{color:#e11d48}.cm-vgrid{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.cm-sheet{position:absolute;inset:0;z-index:5;background:rgba(15,23,42,.35);display:flex;align-items:flex-end;justify-content:center;padding:12px}.cm-sf{background:#fff;border-radius:16px;padding:14px 16px;width:100%;max-width:440px;box-shadow:0 20px 50px rgba(2,8,30,.25);max-height:100%;overflow:auto}.cm-sfh{display:flex;align-items:center;gap:8px;margin-bottom:6px}.cm-sfh b{flex:1;font:800 16px Poppins,Arial}.cm-sfh>.cm-i{color:var(--ind)}.cm-sf label{display:block;font:700 12.5px Poppins,Arial;color:#475569;margin:8px 0 0}.cm-sf label input,.cm-sf label select,.cm-sf label textarea{margin-top:4px}.cm-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cm-conf p{margin:4px 0 6px;font-weight:600}
@media (min-width:900px){.cm-sheet{align-items:center}}
.cm-set .cm-setf{padding:16px;overflow:auto;flex:1}.cm-setf fieldset{border:1px solid var(--line);border-radius:12px;background:#fff;margin:0 0 12px;padding:8px 14px}.cm-setf legend{font:800 13px Poppins,Arial;padding:0 6px}
.cm-radio,.cm-sw{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;min-height:48px}.cm-radio:last-child,.cm-sw:last-child{border-bottom:0}.cm-radio span,.cm-sw span{flex:1;display:flex;flex-direction:column}.cm-radio b,.cm-sw b{font-size:14px;font-weight:700}.cm-radio small,.cm-sw small{color:var(--mut);font-size:12.5px}.cm-radio input{width:20px;height:20px;accent-color:var(--ind);flex:none}
.cm-sw input{position:absolute;opacity:0;width:1px;height:1px}.cm-sw i{width:44px;height:26px;border-radius:12px;background:#cbd5e1;position:relative;flex:none;transition:background .2s}.cm-sw i::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s}.cm-sw input:checked+i{background:var(--ind)}.cm-sw input:checked+i::after{left:21px}.cm-sw input:focus-visible+i{outline:2px solid #6366f1;outline-offset:2px}
.cm-ok{font-weight:700;color:#16a34a;font-size:13px;align-self:center}
.cm-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#14183a;color:#fff;padding:10px 16px;border-radius:12px;font:600 13.5px Poppins,Arial;z-index:100002;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:min(92vw,520px);transition:opacity .3s}.cm-toast.out{opacity:0}
@media (max-width:899px){.cm-app{grid-template-columns:minmax(0,1fr);border-radius:0;border-left:0;border-right:0}.cm-app .cm-main{display:none}.cm-app.is-thread .cm-side{display:none}.cm-app.is-thread .cm-main,.cm-app.single .cm-main{display:flex}.cm-side{border-right:0}.cm-backb{display:inline-grid}
  .cm-ib{width:44px;height:44px}.cm-ib.sm{width:36px;height:36px}.cm-btn{min-height:44px}.cm-mb{width:44px;height:44px;margin:-6px}.cm-tabs button{min-height:44px}.cm-mi{min-height:44px}.cm-rxb{min-height:32px}.cm-send{height:44px}.cm-ta{min-height:44px;font-size:16px}.cm-gb{max-width:86%}.cm-gav{display:none}.cm-grp{margin:8px 0}.cm-hd{padding:6px 6px 6px 4px}.cm-hint{display:none}.cm-new input,.cm-search input{font-size:16px;min-height:44px}.cm-sf input,.cm-sf select,.cm-sf textarea{font-size:16px}}
@media (max-width:899px){body:has(.cm-app.page.is-thread) :is(#fl-bug,#fl-fab,#fl-top,#orbit-tab,#orbit-hand,.orbit-hint){display:none!important}}
@media (prefers-reduced-motion:reduce){.cm-vbig,.cm-skel i,.cm-spin{animation:none}}
`;

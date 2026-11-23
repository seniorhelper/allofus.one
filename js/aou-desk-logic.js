/* allofus.one · the desk · pure logic (no DOM, no three.js): saved state, link and embed rules, timer, poke and typing rules.
   Everything read from storage is clamped here before any other code sees it. */

export const KEY = 'aou_desk_v1';
export const LIMITS = { todos: 10, todoLen: 48, notes: 8, noteLen: 110, links: 8, labelLen: 22, urlLen: 300, nameLen: 18 };
export const STYLES = ['wood', 'metal', 'neon'];
export const ROOMS = ['plain', 'loft', 'sky', 'real'];
export const NEONS = ['#22e6ff', '#ff3df0', '#7dff5a', '#ffb020', '#8b7bff'];
export const NOTE_COLORS = ['#ffe873', '#ffb3c7', '#a8e6ff', '#b9f5a6', '#ffd0a1'];
export const DESK = { wMin: 1.0, wMax: 2.4, dMin: 0.6, dMax: 1.0, hOffMin: -0.15, hOffMax: 0.2 };

/* the gate: a one-way fingerprint of the access code (PBKDF2-SHA256). A 6-digit code can be guessed by trying them all,
   so this is a "not listed yet" curtain and nothing private sits behind it. */
const GATE = { salt: '8f1305c1bdd4807bbb0aed68affea688', hash: 'ad5db68b57914d646e2b5368d726faf47049596c45db75de3a0a03438cb6d9d4', iter: 150000 };
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
export async function gateHash(code, subtle) {
  const key = await subtle.importKey('raw', new TextEncoder().encode(String(code)), 'PBKDF2', false, ['deriveBits']);
  return hex(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(GATE.salt), iterations: GATE.iter }, key, 256));
}
export async function gateOk(code, subtle) {
  if (!/^\d{4,12}$/.test(String(code))) return false;
  const h = await gateHash(code, subtle); let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ GATE.hash.charCodeAt(i);
  return diff === 0;
}
export const gateToken = () => GATE.hash.slice(0, 16);

const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const str = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
const pick = (v, list, d) => (list.includes(v) ? v : d);

export function defaults() {
  return {
    v: 1, name: '',
    desk: { style: 'wood', w: 1.6, d: 0.8, hOff: 0, neon: NEONS[0] },
    room: 'plain', dist: 'far', focus: false, tab: 'today', rtab: 'notes', sound: true,
    todos: [{ t: 'Put on the headset and say hello', done: false }],
    notes: [{ t: 'Tap a note to write on it', c: 0 }],
    links: [], embed: '',
    timer: { len: 1500, left: 1500, endsAt: 0 },
  };
}

export function clean(raw) {
  const d = defaults(); if (!raw || typeof raw !== 'object') return d;
  const k = raw.desk || {}, t = raw.timer || {};
  const s = {
    v: 1, name: str(raw.name, LIMITS.nameLen),
    desk: { style: pick(k.style, STYLES, 'wood'), w: clamp(k.w, DESK.wMin, DESK.wMax, 1.6), d: clamp(k.d, DESK.dMin, DESK.dMax, 0.8), hOff: clamp(k.hOff, DESK.hOffMin, DESK.hOffMax, 0), neon: pick(k.neon, NEONS, NEONS[0]) },
    room: pick(raw.room, ROOMS, 'plain'), dist: pick(raw.dist, ['far', 'near'], 'far'), focus: raw.focus === true,
    tab: pick(raw.tab, ['today', 'focus'], 'today'), rtab: pick(raw.rtab, ['notes', 'links'], 'notes'), sound: raw.sound !== false,
    todos: (Array.isArray(raw.todos) ? raw.todos : d.todos).slice(0, LIMITS.todos).map((x) => ({ t: str(x && x.t, LIMITS.todoLen), done: !!(x && x.done) })).filter((x) => x.t),
    notes: (Array.isArray(raw.notes) ? raw.notes : d.notes).slice(0, LIMITS.notes).map((x) => ({ t: str(x && x.t, LIMITS.noteLen), c: clamp(x && x.c, 0, NOTE_COLORS.length - 1, 0) | 0 })),
    links: (Array.isArray(raw.links) ? raw.links : []).slice(0, LIMITS.links).map((x) => ({ label: str(x && x.label, LIMITS.labelLen), url: safeUrl(x && x.url) })).filter((x) => x.url),
    embed: embedFor(raw.embed) ? safeUrl(raw.embed) : '',
    timer: { len: clamp(t.len, 60, 7200, 1500) | 0, left: clamp(t.left, 0, 7200, 1500) | 0, endsAt: clamp(t.endsAt, 0, 8.64e15, 0) },
  };
  if (s.timer.left > s.timer.len) s.timer.left = s.timer.len;
  s.links.forEach((l) => { if (!l.label) l.label = hostOf(l.url); });
  return s;
}

export function load(storage) { try { return clean(JSON.parse(storage.getItem(KEY) || 'null')); } catch (e) { return defaults(); } }
export function save(storage, s) { try { storage.setItem(KEY, JSON.stringify(clean(s))); return true; } catch (e) { return false; } }

/* links: web addresses only (http or https). Anything else (javascript:, data:, file:, mailto:) is refused. */
export function safeUrl(text) {
  let t = typeof text === 'string' ? text.trim() : ''; if (!t || t.length > LIMITS.urlLen || t[0] === '/' ||/[\s<>"'`\\]/.test(t)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = 'https://' + t;
  let u; try { u = new URL(t); } catch (e) { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  if (u.username || u.password || !u.hostname.includes('.')) return '';
  return u.href;
}
export function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, LIMITS.labelLen); } catch (e) { return ''; } }

/* embeds: only players whose makers publish an official embed address. Returns the frame address or null. */
export function embedFor(text) {
  const href = safeUrl(text); if (!href) return null; const u = new URL(href); if (u.protocol !== 'https:') return null;
  const h = u.hostname.replace(/^www\./, ''); const id = (s) => (/^[A-Za-z0-9_-]{6,40}$/.test(s || '') ? s : '');
  if (h === 'youtu.be') { const v = id(u.pathname.slice(1)); return v ? { kind: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/' + v } : null; }
  if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtube-nocookie.com') {
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/); const v = id(u.pathname === '/watch' ? u.searchParams.get('v') : m && m[1]);
    return v ? { kind: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/' + v } : null;
  }
  if (h === 'vimeo.com' || h === 'player.vimeo.com') { const m = u.pathname.match(/(\d{6,12})/); return m ? { kind: 'Vimeo', src: 'https://player.vimeo.com/video/' + m[1] } : null; }
  return null;
}
export const EMBED_HOSTS = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];

/* timer: counts against the wall clock, so it stays right when the page sleeps. */
export function timerLeft(t, now) { return t.endsAt ? Math.max(0, Math.ceil((t.endsAt - now) / 1000)) : t.left; }
export function timerStart(t, now) { if (t.endsAt) return t; const left = t.left > 0 ? t.left : t.len; return { len: t.len, left, endsAt: now + left * 1000 }; }
export function timerPause(t, now) { return { len: t.len, left: timerLeft(t, now), endsAt: 0 }; }
export function timerReset(t) { return { len: t.len, left: t.len, endsAt: 0 }; }
export function timerSet(t, secs) { const len = Math.min(7200, Math.max(60, secs | 0)); return { len, left: len, endsAt: 0 }; }
export function timerDone(t, now) { return !!t.endsAt && now >= t.endsAt; }
export function mmss(s) { s = Math.max(0, s | 0); return String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

/* fingertip press on a flat panel. z = fingertip height above the surface in metres (negative = through it).
   Fires once when the tip goes through; re-arms only after it pulls back out. */
export const POKE = { fire: 0.004, arm: 0.022, deep: -0.09 };
export function pokeStep(st, z, inside) {
  if (!inside || z < POKE.deep) { st.armed = false; st.far = z > POKE.arm; return false; }
  if (z > POKE.arm) { st.armed = true; st.far = true; return false; }
  if (st.armed && z <= POKE.fire) { st.armed = false; return true; }
  return false;
}

/* typing: one key at a time from the desk keyboard or a real keyboard. */
export function typeKey(text, key, max) {
  if (key === 'BACK') return text.slice(0, -1);
  if (key === 'CLEAR') return '';
  if (key === 'SPACE') key = ' ';
  if (typeof key !== 'string' || key.length !== 1 || key < ' ') return text;
  if (text.length >= max) return text;
  if (key === ' ' && (!text || text.endsWith('  '))) return text;
  return text + key;
}

/* wrap text into lines for a canvas, by a measure function (so it can be tested without a canvas). */
export function wrap(text, maxW, measure, maxLines) {
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (let w of words) {
    while (measure(w) > maxW && w.length > 1) { let n = w.length - 1; while (n > 1 && measure(w.slice(0, n)) > maxW) n--; const head = w.slice(0, n); if (cur) { lines.push(cur); cur = ''; } lines.push(head); w = w.slice(n); }
    const next = cur ? cur + ' ' + w : w;
    if (measure(next) <= maxW) cur = next; else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (maxLines && lines.length > maxLines) { const cut = lines.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/.{0,2}$/, '') + '…'; return cut; }
  return lines;
}

/* seat: where the desk goes for a head position (metres, head height above the floor). Works seated or standing. */
export function seatFor(headY, hOff) {
  const top = Math.min(1.25, Math.max(0.55, headY - 0.47 + (hOff || 0)));
  return { top, eye: Math.max(top + 0.3, headY) };
}

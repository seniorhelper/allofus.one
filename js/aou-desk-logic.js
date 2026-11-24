/* allofus.one · the desk · pure logic (no DOM, no three.js): saved state, link and embed rules, timer, poke and typing rules.
   Everything read from storage is clamped here before any other code sees it. */

export const KEY = 'aou_desk_v1';
export const LIMITS = { doneLog: 40, todos: 10, todoLen: 48, notes: 8, noteLen: 110, links: 8, labelLen: 22, urlLen: 300, nameLen: 18 };
export const STYLES = ['wood', 'metal', 'steel', 'black', 'neon'];
export const FINISHES = ['matte', 'gloss'];
export const HANDS = ['soft', 'glove', 'neon', 'dots'];
export const ROOMS = ['plain', 'loft', 'sky', 'stars', 'real'];
export const NEONS = ['#22e6ff', '#ff3df0', '#7dff5a', '#ffb020', '#8b7bff'];
export const NOTE_COLORS = ['#ffe873', '#ffb3c7', '#a8e6ff', '#b9f5a6', '#ffd0a1'];
/* boards: where each one sits around the seat. a = angle to the side, e = angle up, r = distance (1 = standard), k = size. */
/* starting places: further out and spread wide, the way the first headset tester arranged them by hand */
export const BOARDS = { front: { a: 0, e: -0.2, r: 1.45, k: 1.1 }, left: { a: -0.9, e: -0.12, r: 1.55, k: 1 }, right: { a: 0.78, e: -0.11, r: 1.5, k: 1 }, cork: { a: 0.82, e: 0.47, r: 1.3, k: 1 } };
/* to-do: finished items are filed into a done log (newest first, capped). Returns how many were filed. onlyOld = file only those finished before today. */
export function fileDone(S, now, onlyOld) { const day = (ms) => { const d = new Date(ms); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); }; const keep = [], out = []; for (const t of S.todos) { if (t.done && (!onlyOld || (t.at && day(t.at) !== day(now)))) out.push({ t: t.t, at: t.at || now }); else keep.push(t); } if (!out.length) return 0; S.todos = keep; S.done = out.reverse().concat(S.done || []).slice(0, LIMITS.doneLog); return out.length; }
export function doneToday(S, now) { const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime(); return (S.done || []).filter((x) => x.at >= t0).length + S.todos.filter((x) => x.done && x.at >= t0).length; }
export const BLIM = { a: 2.6, eMin: -0.6, eMax: 1.2, rMin: 0.45, rMax: 2.2, kMin: 0.6, kMax: 1.8 };
export function cleanBoards(raw) { const o = {}; for (const n in BOARDS) { const b = (raw && typeof raw === 'object' && raw[n]) || {}, d = BOARDS[n]; o[n] = { a: clamp(b.a, -BLIM.a, BLIM.a, d.a), e: clamp(b.e, BLIM.eMin, BLIM.eMax, d.e), r: clamp(b.r, BLIM.rMin, BLIM.rMax, d.r), k: clamp(b.k, BLIM.kMin, BLIM.kMax, d.k) }; } return o; }
/* extra sheets added by app modules: same placement numbers as boards, plus open or closed. Ids are checked so stored data can not smuggle in odd keys. */
export const SHEET_ID = /^[a-z][a-z0-9-]{0,23}$/;
export function cleanSheets(raw) { const o = {}; if (!raw || typeof raw !== 'object') return o; let n = 0; for (const id of Object.keys(raw)) { if (n >= 24 || !SHEET_ID.test(id)) continue; const b = raw[id] || {}; o[id] = { a: clamp(b.a, -BLIM.a, BLIM.a, 0), e: clamp(b.e, BLIM.eMin, BLIM.eMax, 0.3), r: clamp(b.r, BLIM.rMin, BLIM.rMax, 1), k: clamp(b.k, BLIM.kMin, BLIM.kMax, 1), open: b.open === true, flat: b.flat === true }; n++; } return o; }
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

function clamp(v, a, b, d) { if (v === null || v === undefined || v === '') return d; v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; }
const str = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
const pick = (v, list, d) => (list.includes(v) ? v : d);

export function defaults() {
  return {
    v: 1, name: '',
    desk: { style: 'wood', finish: 'matte', w: 1.6, d: 0.8, hOff: 0, neon: NEONS[0] },
    room: 'plain', planets: true, cork: true, dist: 'far', light: 4, hands: 'soft', guided: false, focus: false, tab: 'today', rtab: 'notes', sound: true,
    todos: [{ t: 'Put on the headset and say hello', done: false, at: 0 }], done: [],
    notes: [{ t: 'Tap a note to write on it', c: 0 }],
    links: [], embed: '', boards: cleanBoards(null), sheets: {},
    timer: { len: 1500, left: 1500, endsAt: 0 },
  };
}

export function clean(raw) {
  const d = defaults(); if (!raw || typeof raw !== 'object') return d;
  const k = raw.desk || {}, t = raw.timer || {};
  const s = {
    v: 1, name: str(raw.name, LIMITS.nameLen),
    desk: { style: pick(k.style, STYLES, 'wood'), finish: pick(k.finish, FINISHES, 'matte'), w: clamp(k.w, DESK.wMin, DESK.wMax, 1.6), d: clamp(k.d, DESK.dMin, DESK.dMax, 0.8), hOff: clamp(k.hOff, DESK.hOffMin, DESK.hOffMax, 0), neon: pick(k.neon, NEONS, NEONS[0]) },
    room: pick(raw.room, ROOMS, 'plain'), planets: raw.planets !== false, cork: raw.cork !== false, dist: pick(raw.dist, ['far', 'near'], 'far'), focus: raw.focus === true, light: Math.round(clamp(raw.light, 0, 4, 4)),
    tab: pick(raw.tab, ['today', 'focus', 'log'], 'today'), rtab: pick(raw.rtab, ['notes', 'links'], 'notes'), sound: raw.sound !== false, hands: pick(raw.hands, HANDS, 'soft'), guided: raw.guided === true,
    todos: (Array.isArray(raw.todos) ? raw.todos : d.todos).slice(0, LIMITS.todos).map((x) => ({ t: str(x && x.t, LIMITS.todoLen), done: !!(x && x.done), at: x && x.done ? clamp(x.at, 0, 4e12, 0) : 0 })).filter((x) => x.t),
    done: (Array.isArray(raw.done) ? raw.done : []).slice(0, LIMITS.doneLog).map((x) => ({ t: str(x && x.t, LIMITS.todoLen), at: clamp(x && x.at, 0, 4e12, 0) })).filter((x) => x.t),
    notes: (Array.isArray(raw.notes) ? raw.notes : d.notes).slice(0, LIMITS.notes).map((x) => ({ t: str(x && x.t, LIMITS.noteLen), c: clamp(x && x.c, 0, NOTE_COLORS.length - 1, 0) | 0 })),
    links: (Array.isArray(raw.links) ? raw.links : []).slice(0, LIMITS.links).map((x) => ({ label: str(x && x.label, LIMITS.labelLen), url: safeUrl(x && x.url) })).filter((x) => x.url),
    embed: embedFor(raw.embed) ? safeUrl(raw.embed) : '', boards: cleanBoards(raw.boards), sheets: cleanSheets(raw.sheets),
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
  const top = Math.min(1.25, Math.max(0.4, headY - 0.47 + (hOff || 0)));
  return { top, eye: Math.max(top + 0.3, headY) };
}

/* keyboard height: its centre sits a forearm below the eyes, but its lowest edge always clears the desk top. */
export const KB = { h: 0.336, tilt: 0.6, clear: 0.03, drop: 0.36, reach: 0.36 };
export function kbY(top, headY) { return Math.max(top + KB.clear + (KB.h / 2) * Math.sin(KB.tilt), headY - KB.drop); }

/* real sky: how far the star globe is turned for a moment in time (radians), from the clock and the time zone.
   Longitude is estimated from the time zone (15 degrees an hour); no location is asked for. */
export function siderealAngle(ms, tzOffsetMin) {
  const days = ms / 86400000 - 10957.5;
  const gmstH = (((18.697374558 + 24.06570982441908 * days) % 24) + 24) % 24;
  const lonDeg = Math.max(-180, Math.min(180, -(Number(tzOffsetMin) || 0) / 4));
  return ((((gmstH * 15 + lonDeg) % 360) + 360) % 360) * Math.PI / 180;
}

/* star colour from its measured colour index (blue-white through white to orange). Writes 0..1 values into out. */
export function starColor(bv, out) {
  const t = Math.max(0, Math.min(1, ((Number(bv) || 0) + 0.4) / 2.4));
  const stops = [[0, 0.62, 0.75, 1], [0.35, 1, 1, 1], [0.7, 1, 0.84, 0.62], [1, 1, 0.64, 0.42]];
  let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1], k = (t - a[0]) / (b[0] - a[0]);
  out[0] = a[1] + (b[1] - a[1]) * k; out[1] = a[2] + (b[2] - a[2]) * k; out[2] = a[3] + (b[3] - a[3]) * k; return out;
}

/* moving the desk with the grab ball: where the seat point and the desk angle end up so the ball sits at (bx, bz)
   and the desk keeps facing the head at (hx, hz). cz = desk centre along the desk's own forward line (negative). */
export function faceHead(cx, cz, hx, hz, deskCz, yawNow) {
  const dx = cx - hx, dz = cz - hz, len = Math.hypot(dx, dz); const yaw = len < 0.25 ? yawNow : Math.atan2(-dx, -dz);
  return { yaw, x: cx - deskCz * Math.sin(yaw), z: cz - deskCz * Math.cos(yaw) };
}

/* allofus.one · the desk · planner logic (pure: no DOM, no imports, no clock, no randomness).
   "now" is always passed in as milliseconds since 1970 (Date.now() from the caller). Days and weeks use the device's LOCAL time
   (a week starts on Monday). Functions that take a state object change it in place and say what they return.
   Saved text is untrusted: parse() rebuilds the state field by field, so unknown keys (including "__proto__") are never copied,
   every string is cleaned and cut, every number is clamped, and every list is capped.
   Planning aid only. The forecast uses the stated stage chances, which are assumptions, not predictions. */

export const LIMITS = { deals: 40, reminders: 20, weeks: 12, name: 40, remText: 60, topText: 60, raw: 300000 };
export const STAGES = ['Lead', 'Talking', 'Proposal', 'Won', 'Lost'];
export const PROB = [10, 30, 60, 100, 0]; /* percent chance a deal in each stage closes: an assumption shown on screen */
export const MAX_VALUE = 1e9;
export const METRICS = [
  { key: 'leads', label: 'Leads', unit: '', step: 1, max: 100000, dec: 0 },
  { key: 'calls', label: 'Calls', unit: '', step: 1, max: 100000, dec: 0 },
  { key: 'proposals', label: 'Proposals', unit: '', step: 1, max: 100000, dec: 0 },
  { key: 'sales', label: 'Sales', unit: '$', step: 100, max: MAX_VALUE, dec: 0 },
  { key: 'deep', label: 'Deep work', unit: 'h', step: 1, max: 168, dec: 1 },
  { key: 'workouts', label: 'Workouts', unit: '', step: 1, max: 50, dec: 0 },
  { key: 'family', label: 'Family time', unit: 'h', step: 1, max: 168, dec: 1 },
];
export const PICKS = ['m15', 'h1', 'tonight', 'tomorrow', 'week'];
const MAX_MS = 4102444800000; /* year 2100 */
const SHUT = 3;

/* ---------- small helpers ---------- */
export function text(v, n) { return (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
export function num(v, min, max, dflt) {
  let n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/,/g, '')) : NaN);
  if (!Number.isFinite(n)) n = Number.isFinite(dflt) ? dflt : 0;
  return Math.min(max, Math.max(min, n));
}
const own = (o, k) => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const nowMs = (v) => num(v, 0, MAX_MS, 0);
const p2 = (n) => (n < 10 ? '0' : '') + n;
const fmt = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
export function validKey(k) {
  const m = typeof k === 'string' ? KEY.exec(k) : null; if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}
const fromKey = (k) => { const m = KEY.exec(k); return new Date(+m[1], +m[2] - 1, +m[3]); };

/* local calendar day of a moment: "2026-11-23" */
export function dayKey(now) { return fmt(new Date(nowMs(now))); }
/* the Monday (local) that starts the week containing this moment */
export function weekKey(now) { const d = new Date(nowMs(now)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); }
/* a day key plus n whole days (n may be negative); works across month and year ends */
export function addDays(key, n) { const d = fromKey(key); d.setDate(d.getDate() + Math.round(n)); return fmt(d); }
/* whole days from key a to key b (b - a), unaffected by daylight-saving changes */
export function dayDiff(a, b) { const x = fromKey(a), y = fromKey(b); return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000); }

/* ---------- state ---------- */
const blankTop = () => [0, 1, 2].map(() => ({ t: '', done: false }));
export function emptyState(now) {
  return { v: 1, nextId: 1, today: { date: dayKey(now), top: blankTop(), shut: [false, false, false] }, streak: { count: 0, last: '' }, deals: [], rem: [], weeks: [] };
}

function cleanToday(raw, now) {
  const t = { date: dayKey(now), top: blankTop(), shut: [false, false, false] }; if (!raw || typeof raw !== 'object') return t;
  const d = own(raw, 'date'); if (validKey(d)) t.date = d;
  const top = own(raw, 'top'); if (Array.isArray(top)) for (let i = 0; i < 3; i++) { const e = top[i]; if (e && typeof e === 'object') t.top[i] = { t: text(own(e, 't'), LIMITS.topText), done: own(e, 'done') === true }; }
  const sh = own(raw, 'shut'); if (Array.isArray(sh)) for (let i = 0; i < SHUT; i++) t.shut[i] = sh[i] === true;
  return t;
}
function cleanDeals(raw, st) {
  const out = [], seen = new Set(); if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.deals; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const name = text(own(e, 'name'), LIMITS.name); if (!name) continue;
    const rid = own(e, 'id'); let id = typeof rid === 'number' && Number.isFinite(rid) ? Math.floor(num(rid, 1, 1e9, 0)) : 0; if (!id || seen.has(id)) id = 0; else seen.add(id);
    out.push({ id, name, value: Math.round(num(own(e, 'value'), 0, MAX_VALUE, 0)), stage: Math.round(num(own(e, 'stage'), 0, STAGES.length - 1, 0)) });
  }
  out.forEach((d) => { if (!d.id) { d.id = freshId(st, seen); seen.add(d.id); } });
  return out;
}
function cleanRem(raw, st) {
  const out = [], seen = new Set(); if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.reminders; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const tx = text(own(e, 'text'), LIMITS.remText); const due = own(e, 'due'); if (!tx || typeof due !== 'number' || !Number.isFinite(due)) continue;
    const rid = own(e, 'id'); let id = typeof rid === 'number' && Number.isFinite(rid) ? Math.floor(num(rid, 1, 1e9, 0)) : 0; if (!id || seen.has(id)) id = 0; else seen.add(id);
    out.push({ id, text: tx, due: Math.round(num(due, 0, MAX_MS, 0)) });
  }
  out.forEach((r) => { if (!r.id) { r.id = freshId(st, seen); seen.add(r.id); } });
  return out.sort((a, b) => a.due - b.due || a.id - b.id);
}
function cleanWeeks(raw) {
  const m = new Map(); if (Array.isArray(raw)) for (let i = 0; i < raw.length && i < 400; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const k = own(e, 'k'); if (!validKey(k) || fromKey(k).getDay() !== 1) continue; const v = own(e, 'v'); if (!Array.isArray(v)) continue;
    m.set(k, METRICS.map((mt, j) => roundTo(num(v[j], 0, mt.max, 0), mt.dec)));
  }
  return Array.from(m.keys()).sort().slice(-LIMITS.weeks).map((k) => ({ k, v: m.get(k) }));
}
function freshId(st, seen) { let n = Math.max(1, st.nextId | 0); while (seen.has(n)) n++; st.nextId = n + 1; return n; }
const roundTo = (n, dec) => { const f = Math.pow(10, dec); return Math.round(n * f) / f; };

/* build a clean state from saved text (or an object). Anything unusable gives a fresh empty state; nothing here throws. */
export function parse(raw, now) {
  let o = raw;
  if (typeof raw === 'string') { if (raw.length > LIMITS.raw) return emptyState(now); try { o = JSON.parse(raw); } catch (e) { return emptyState(now); } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return emptyState(now);
  const st = { v: 1, nextId: Math.floor(num(own(o, 'nextId'), 1, 1e9, 1)), today: cleanToday(own(o, 'today'), now), streak: { count: 0, last: '' }, deals: [], rem: [], weeks: [] };
  const s = own(o, 'streak'); if (s && typeof s === 'object' && validKey(own(s, 'last'))) { st.streak = { count: Math.floor(num(own(s, 'count'), 0, 100000, 0)), last: own(s, 'last') }; if (!st.streak.count) st.streak.last = ''; }
  st.deals = cleanDeals(own(o, 'deals'), st); st.rem = cleanRem(own(o, 'rem'), st); st.weeks = cleanWeeks(own(o, 'weeks'));
  st.nextId = Math.min(1e9, Math.max(st.nextId, 1 + Math.max(0, ...st.deals.map((d) => d.id), ...st.rem.map((r) => r.id))));
  return st;
}
export function serialize(state) { return JSON.stringify(parse(state, 0 + (state && state.today && validKey(state.today.date) ? fromKey(state.today.date).getTime() : 0))); }

/* ---------- today ---------- */
export const allDone = (state) => state.today.top.every((x) => x.t && x.done);
/* call whenever the sheet opens or draws: if the day changed, start a fresh day (unfinished priorities carry over). Returns true if it rolled. */
export function rollDay(state, now) {
  const k = dayKey(now); if (state.today.date === k) return false; if (dayDiff(state.today.date, k) < 0) return false; /* clock went backwards: keep today */
  const keep = state.today.top.map((x) => (x.t && !x.done ? { t: x.t, done: false } : { t: '', done: false }));
  state.today = { date: k, top: keep, shut: [false, false, false] }; return true;
}
export function setTop(state, i, t) { if (!(i >= 0 && i < 3)) return false; state.today.top[i].t = text(t, LIMITS.topText); if (!state.today.top[i].t) state.today.top[i].done = false; syncStreak(state); return true; }
export function toggleTop(state, i, now) { if (!(i >= 0 && i < 3) || !state.today.top[i].t) return false; rollDay(state, now); state.today.top[i].done = !state.today.top[i].done; syncStreak(state); return true; }
export function toggleShut(state, i) { if (!(i >= 0 && i < SHUT)) return false; state.today.shut[i] = !state.today.shut[i]; return true; }
/* keep the streak in step with today's three priorities */
function syncStreak(state) {
  const day = state.today.date, s = state.streak;
  if (allDone(state)) { if (s.last !== day) { s.count = s.last && dayDiff(s.last, day) === 1 ? s.count + 1 : 1; s.last = day; } }
  else if (s.last === day) { s.count = Math.max(0, s.count - 1); s.last = s.count > 0 ? addDays(day, -1) : ''; }
}
/* the streak to show: counts only if the last full day was today or yesterday */
export function streakNow(state, now) { const k = dayKey(now), l = state.streak.last; if (!l || !state.streak.count) return 0; const d = dayDiff(l, k); return d === 0 || d === 1 ? state.streak.count : 0; }

/* ---------- pipeline ---------- */
export function addDeal(state, name, value) {
  const nm = text(name, LIMITS.name); if (!nm || state.deals.length >= LIMITS.deals) return null;
  const d = { id: freshId(state, new Set(state.deals.map((x) => x.id))), name: nm, value: Math.round(num(value, 0, MAX_VALUE, 0)), stage: 0 }; state.deals.push(d); return d;
}
export function moveDeal(state, id, dir) { const d = state.deals.find((x) => x.id === id); if (!d) return false; const s = Math.max(0, Math.min(STAGES.length - 1, d.stage + (dir < 0 ? -1 : 1))); if (s === d.stage) return false; d.stage = s; return true; }
export function setDealValue(state, id, value) { const d = state.deals.find((x) => x.id === id); if (!d) return false; d.value = Math.round(num(value, 0, MAX_VALUE, 0)); return true; }
export function deleteDeal(state, id) { const n = state.deals.length; state.deals = state.deals.filter((x) => x.id !== id); return state.deals.length < n; }
/* count and dollars per stage, in STAGES order */
export function stageTotals(state) { return STAGES.map((s, i) => { const a = state.deals.filter((d) => d.stage === i); return { stage: s, count: a.length, value: a.reduce((t, d) => t + d.value, 0), prob: PROB[i] }; }); }
/* weighted forecast in whole dollars: each deal's value times its stage chance (Won counts in full, Lost counts nothing) */
export function forecast(state) { return Math.round(state.deals.reduce((t, d) => t + d.value * PROB[d.stage] / 100, 0)); }
/* money still open: Lead, Talking and Proposal */
export function openValue(state) { return state.deals.filter((d) => d.stage < 3).reduce((t, d) => t + d.value, 0); }

/* ---------- reminders ---------- */
/* the due moment for a quick pick, in local time */
export function dueFor(pick, now) {
  const t = nowMs(now), d = new Date(t);
  if (pick === 'm15') return t + 15 * 60000;
  if (pick === 'h1') return t + 3600000;
  if (pick === 'tonight') { const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0, 0); if (e.getTime() <= t) e.setDate(e.getDate() + 1); return e.getTime(); }
  if (pick === 'tomorrow') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0, 0, 0).getTime();
  if (pick === 'week') { const add = 7 - ((d.getDay() + 6) % 7); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, 9, 0, 0, 0).getTime(); } /* next Monday, 9 am */
  return null;
}
export function addReminder(state, textIn, pick, now) {
  const tx = text(textIn, LIMITS.remText), due = dueFor(pick, now); if (!tx || due === null || state.rem.length >= LIMITS.reminders) return null;
  const r = { id: freshId(state, new Set(state.rem.map((x) => x.id))), text: tx, due: Math.min(MAX_MS, due) }; state.rem.push(r); state.rem.sort((a, b) => a.due - b.due || a.id - b.id); return r;
}
export function dismissReminder(state, id) { const n = state.rem.length; state.rem = state.rem.filter((x) => x.id !== id); return state.rem.length < n; }
export const dueNow = (state, now) => state.rem.filter((r) => r.due <= nowMs(now));
export const isDue = (r, now) => r.due <= nowMs(now);

/* ---------- week ---------- */
/* make sure this week has a row and only the newest 12 weeks are kept; returns this week's row */
export function ensureWeek(state, now) {
  const k = weekKey(now); let w = state.weeks.find((x) => x.k === k);
  if (!w) { w = { k, v: METRICS.map(() => 0) }; state.weeks.push(w); state.weeks.sort((a, b) => (a.k < b.k ? -1 : 1)); }
  if (state.weeks.length > LIMITS.weeks) state.weeks = state.weeks.slice(-LIMITS.weeks);
  return state.weeks.find((x) => x.k === k) || w;
}
export function setMetric(state, now, i, value) { if (!(i >= 0 && i < METRICS.length)) return false; const m = METRICS[i], w = ensureWeek(state, now); w.v[i] = roundTo(num(value, 0, m.max, 0), m.dec); return true; }
export function bumpMetric(state, now, i, dir) { if (!(i >= 0 && i < METRICS.length)) return false; const m = METRICS[i], w = ensureWeek(state, now); w.v[i] = roundTo(num(w.v[i] + (dir < 0 ? -m.step : m.step), 0, m.max, 0), m.dec); return true; }
/* this week's number, last week's number (null if that week was not recorded), and 'up' / 'down' / 'same' / null */
export function compare(state, now, i) {
  if (!(i >= 0 && i < METRICS.length)) return null; const cur = weekKey(now), prev = addDays(cur, -7), a = state.weeks.find((x) => x.k === cur), b = state.weeks.find((x) => x.k === prev);
  const now_ = a ? a.v[i] : 0, last = b ? b.v[i] : null;
  return { now: now_, last, trend: last === null ? null : now_ > last ? 'up' : now_ < last ? 'down' : 'same' };
}
/* up to 12 numbers, oldest first, ending with this week; a week with no record is null */
export function series(state, now, i) {
  if (!(i >= 0 && i < METRICS.length)) return []; const cur = weekKey(now), out = [];
  for (let n = LIMITS.weeks - 1; n >= 0; n--) { const k = addDays(cur, -7 * n), w = state.weeks.find((x) => x.k === k); out.push(w ? w.v[i] : null); }
  return out;
}
/* "$1,234" style whole-dollar text */
export function dollars(n) { const v = Math.round(num(n, -1e12, 1e12, 0)); return (v < 0 ? '-' : '') + '$' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

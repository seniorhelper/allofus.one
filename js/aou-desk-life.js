/* allofus.one · the desk · "Life" logic: trips, net worth, habits and a wish list (pure: no DOM, no imports, no clock, no randomness).
   "now" is always passed in as milliseconds since 1970 (Date.now() from the caller). Days and weeks use the device's LOCAL time
   (a week starts on Monday). Functions that take a state object change it in place and say what they return.
   Saved text is untrusted: parse() rebuilds the state field by field, so unknown keys (including "__proto__") are never copied,
   every string is cleaned and cut, every number is clamped, and every list is capped.
   Your own numbers only: nothing here reads market data or gives advice. US dollars. */

export const LIMITS = { trips: 6, tripName: 30, packs: 15, packText: 30, accounts: 12, acctName: 24, snaps: 36, habits: 8, habitName: 24, weeks: 12, wishes: 20, wishName: 40, nights: 90, people: 20, raw: 300000 };
export const LINES = ['Flights', 'Stay', 'Food', 'Getting around', 'Fun', 'Other'];
export const KINDS = ['Cash', 'Investments', 'Retirement', 'Property', 'Other asset', 'Debt'];
export const DEFAULT_PACK = ['Passports or IDs', 'Tickets and bookings', 'Phone charger', 'Medicines', 'Clothes for the weather', 'Money and cards'];
export const MAX_LINE = 1e7; /* one budget line */
export const MAX_BAL = 1e10; /* one account */
export const MAX_PRICE = 1e7; /* one wish list price */
const MAX_MS = 4102444800000; /* year 2100 */
const MAX_DAYS = LIMITS.weeks * 7; /* habit ticks kept */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- small helpers ---------- */
export function text(v, n) { return (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
export function num(v, min, max, dflt) {
  let n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/,/g, '')) : NaN);
  if (!Number.isFinite(n)) n = Number.isFinite(dflt) ? dflt : 0;
  return Math.min(max, Math.max(min, n));
}
const whole = (v, min, max, d) => Math.round(num(v, min, max, d));
const cents = (v, min, max, d) => Math.round(num(v, min, max, d) * 100) / 100;
const own = (o, k) => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const nowMs = (v) => num(v, 0, MAX_MS, 0);
const p2 = (n) => (n < 10 ? '0' : '') + n;
const fmt = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/, MKEY = /^(\d{4})-(\d{2})$/;
export function validKey(k) {
  const m = typeof k === 'string' ? KEY.exec(k) : null; if (!m) return false;
  if (+m[1] < 1970 || +m[1] > 2200) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}
export function validMonth(k) { const m = typeof k === 'string' ? MKEY.exec(k) : null; return !!m && +m[1] >= 1970 && +m[1] <= 2200 && +m[2] >= 1 && +m[2] <= 12; }
const fromKey = (k) => { const m = KEY.exec(k); return new Date(+m[1], +m[2] - 1, +m[3]); };

/* local calendar day of a moment: "2026-11-23" */
export function dayKey(now) { return fmt(new Date(nowMs(now))); }
/* local calendar month of a moment: "2026-11" */
export function monthKey(now) { return dayKey(now).slice(0, 7); }
/* the Monday (local) that starts the week containing this moment */
export function weekKey(now) { const d = new Date(nowMs(now)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); }
/* a day key plus n whole days (n may be negative); works across month and year ends */
export function addDays(key, n) { const d = fromKey(key); d.setDate(d.getDate() + Math.round(n)); return fmt(d); }
/* whole days from key a to key b (b - a), unaffected by daylight-saving changes */
export function dayDiff(a, b) { const x = fromKey(a), y = fromKey(b); return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000); }
/* "Wed, Dec 23, 2026" */
export function dateLabel(key) { if (!validKey(key)) return ''; const d = fromKey(key); return DAY_NAMES[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
/* "Dec 2026" */
export function monthLabel(m) { return validMonth(m) ? MON[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4) : ''; }
/* typed date: "2026-12-23", "12/23/2026", "12/23/26" or "12/23" (this year, or next year if already past). Returns a day key or null. */
export function parseDateInput(t, now) {
  const s = text(t, 20), today = dayKey(now); let m, y, mo, d;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(s))) { mo = +m[1]; d = +m[2]; y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(s))) { mo = +m[1]; d = +m[2]; y = +today.slice(0, 4); const k = y + '-' + p2(mo) + '-' + p2(d); if (validKey(k) && k < today) y++; }
  else return null;
  const k = String(y).padStart(4, '0') + '-' + p2(mo) + '-' + p2(d); return validKey(k) ? k : null;
}
/* "$1,234" style whole-dollar text */
export function dollars(n) { const v = Math.round(num(n, -1e13, 1e13, 0)); return (v < 0 ? '-' : '') + '$' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
/* like dollars(), but keeps cents when there are any: "$3.50" */
export function dollarsC(n) { const v = Math.round(num(n, -1e13, 1e13, 0) * 100) / 100; if (Number.isInteger(v)) return dollars(v); const a = Math.abs(v).toFixed(2); const [i, f] = a.split('.'); return (v < 0 ? '-' : '') + '$' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + f; }
/* + / - step for a dollar amount: bigger amounts move in bigger steps */
export function stepFor(v) { return v < 1000 ? 50 : v < 5000 ? 100 : v < 20000 ? 500 : 1000; }
const pctText = (x) => String(x >= 10 ? Math.round(x) : Math.max(0.1, Math.round(x * 10) / 10));

/* ---------- state ---------- */
export function emptyState() { return { v: 1, nextId: 1, trips: [], accts: [], snaps: [], habits: [], wishes: [] }; }

function idOf(e, seen) { const r = own(e, 'id'); let id = typeof r === 'number' && Number.isFinite(r) ? Math.floor(num(r, 1, 1e9, 0)) : 0; if (!id || seen.has(id)) return 0; seen.add(id); return id; }
function freshId(st, seen) { let n = Math.max(1, st.nextId | 0); while (seen.has(n)) n++; st.nextId = Math.min(1e9, n + 1); seen.add(n); return n; }
function usedIds(st) { const s = new Set(); st.trips.forEach((t) => { s.add(t.id); t.pack.forEach((p) => s.add(p.id)); }); st.accts.forEach((a) => s.add(a.id)); st.habits.forEach((h) => s.add(h.id)); st.wishes.forEach((w) => s.add(w.id)); return s; }
const newId = (st) => freshId(st, usedIds(st));

function cleanPack(raw, seen) {
  const out = []; if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.packs; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const t = text(own(e, 't'), LIMITS.packText); if (!t) continue;
    out.push({ id: idOf(e, seen), t, done: own(e, 'done') === true });
  } return out;
}
function cleanTrips(raw, seen, now) {
  const out = []; if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.trips; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue;
    const s = own(e, 'start'), b = own(e, 'budget'), bud = LINES.map((n, j) => (Array.isArray(b) ? whole(b[j], 0, MAX_LINE, 0) : 0));
    out.push({ id: idOf(e, seen), name: text(own(e, 'name'), LIMITS.tripName) || 'Trip', start: validKey(s) ? s : addDays(dayKey(now), 30), nights: whole(own(e, 'nights'), 1, LIMITS.nights, 7), people: whole(own(e, 'people'), 1, LIMITS.people, 1), budget: bud, pack: cleanPack(own(e, 'pack'), seen) });
  } return out;
}
function cleanAccts(raw, seen) {
  const out = []; if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.accounts; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const name = text(own(e, 'name'), LIMITS.acctName); if (!name) continue;
    const k = own(e, 'kind');
    out.push({ id: idOf(e, seen), name, kind: typeof k === 'string' && KINDS.indexOf(k) >= 0 ? k : 'Other asset', bal: whole(own(e, 'bal'), 0, MAX_BAL, 0) });
  } return out;
}
function cleanSnaps(raw) {
  const m = new Map(); if (Array.isArray(raw)) for (let i = 0; i < raw.length && i < 400; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const k = own(e, 'm'); if (!validMonth(k)) continue;
    const assets = whole(own(e, 'assets'), 0, 1e12, 0), debts = whole(own(e, 'debts'), 0, 1e12, 0); m.set(k, { m: k, assets, debts, net: assets - debts });
  }
  return Array.from(m.keys()).sort().slice(-LIMITS.snaps).map((k) => m.get(k));
}
function cleanHabits(raw, seen, now) {
  const out = []; if (!Array.isArray(raw)) return out;
  const win = now === undefined ? null : windowKeys(now);
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.habits; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const name = text(own(e, 'name'), LIMITS.habitName); if (!name) continue;
    const d = own(e, 'days'), set = new Set();
    if (Array.isArray(d)) for (let j = 0; j < d.length && j < 2000; j++) { const k = d[j]; if (validKey(k) && (!win || (k >= win[0] && k <= win[1]))) set.add(k); }
    out.push({ id: idOf(e, seen), name, days: Array.from(set).sort().slice(-MAX_DAYS) });
  } return out;
}
function cleanWishes(raw, seen) {
  const out = []; if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && i < 400 && out.length < LIMITS.wishes; i++) {
    const e = raw[i]; if (!e || typeof e !== 'object') continue; const name = text(own(e, 'name'), LIMITS.wishName); if (!name) continue;
    out.push({ id: idOf(e, seen), name, target: cents(own(e, 'target'), 0, MAX_PRICE, 0), price: cents(own(e, 'price'), 0, MAX_PRICE, 0) });
  } return out;
}
/* oldest and newest day keys a habit may hold: 12 weeks back from this Monday, up to this Sunday */
function windowKeys(now) { const wk = weekKey(now); return [addDays(wk, -7 * (LIMITS.weeks - 1)), addDays(wk, 6)]; }

/* build a clean state from saved text (or an object). Anything unusable gives a fresh empty state; nothing here throws.
   Pass "now" to also drop habit ticks that are older than 12 weeks. */
export function parse(raw, now) {
  let o = raw;
  if (typeof raw === 'string') { if (raw.length > LIMITS.raw) return emptyState(); try { o = JSON.parse(raw); } catch (e) { return emptyState(); } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return emptyState();
  const seen = new Set(), n = typeof now === 'number' && Number.isFinite(now) ? now : undefined;
  const st = { v: 1, nextId: 1, trips: cleanTrips(own(o, 'trips'), seen, n === undefined ? 0 : n), accts: cleanAccts(own(o, 'accts'), seen), snaps: cleanSnaps(own(o, 'snaps')), habits: cleanHabits(own(o, 'habits'), seen, n), wishes: cleanWishes(own(o, 'wishes'), seen) };
  /* items that arrived without a usable id get one now */
  st.nextId = Math.min(1e9, Math.max(Math.floor(num(own(o, 'nextId'), 1, 1e9, 1)), 1 + Math.max(0, ...seen)));
  st.trips.forEach((t) => { if (!t.id) t.id = freshId(st, seen); t.pack.forEach((p) => { if (!p.id) p.id = freshId(st, seen); }); });
  st.accts.forEach((a) => { if (!a.id) a.id = freshId(st, seen); }); st.habits.forEach((h) => { if (!h.id) h.id = freshId(st, seen); }); st.wishes.forEach((w) => { if (!w.id) w.id = freshId(st, seen); });
  return st;
}
export function serialize(state, now) { return JSON.stringify(parse(state, now)); }
/* drop habit ticks older than 12 weeks; call whenever the sheet opens or draws. Returns true if anything was dropped. */
export function roll(state, now) {
  const w = windowKeys(now); let changed = false;
  state.habits.forEach((h) => { const keep = h.days.filter((k) => k >= w[0] && k <= w[1]); if (keep.length !== h.days.length) { h.days = keep; changed = true; } });
  return changed;
}

/* ---------- trips ---------- */
const findIn = (list, id) => (typeof id === 'number' ? list.find((x) => x.id === id) : undefined);
export function addTrip(state, name, now) {
  const nm = text(name, LIMITS.tripName); if (!nm || state.trips.length >= LIMITS.trips) return null;
  const t = { id: newId(state), name: nm, start: addDays(dayKey(now), 30), nights: 7, people: 1, budget: LINES.map(() => 0), pack: [] };
  state.trips.push(t); DEFAULT_PACK.forEach((p) => { t.pack.push({ id: newId(state), t: p, done: false }); }); return t;
}
export function renameTrip(state, id, name) { const t = findIn(state.trips, id), nm = text(name, LIMITS.tripName); if (!t || !nm) return false; t.name = nm; return true; }
export function deleteTrip(state, id) { const n = state.trips.length; state.trips = state.trips.filter((x) => x.id !== id); return state.trips.length < n; }
export function setStart(state, id, key) { const t = findIn(state.trips, id); if (!t || !validKey(key)) return false; t.start = key; return true; }
export function shiftStart(state, id, days) { const t = findIn(state.trips, id); if (!t || !Number.isFinite(days)) return false; const k = addDays(t.start, days); if (!validKey(k)) return false; t.start = k; return true; }
export function setNights(state, id, n) { const t = findIn(state.trips, id); if (!t) return false; t.nights = whole(n, 1, LIMITS.nights, t.nights); return true; }
export function bumpNights(state, id, dir) { const t = findIn(state.trips, id); return !!t && setNights(state, id, t.nights + (dir < 0 ? -1 : 1)); }
export function setPeople(state, id, n) { const t = findIn(state.trips, id); if (!t) return false; t.people = whole(n, 1, LIMITS.people, t.people); return true; }
export function bumpPeople(state, id, dir) { const t = findIn(state.trips, id); return !!t && setPeople(state, id, t.people + (dir < 0 ? -1 : 1)); }
export function setBudget(state, id, line, v) { const t = findIn(state.trips, id); if (!t || !Number.isInteger(line) || line < 0 || line >= LINES.length) return false; t.budget[line] = whole(v, 0, MAX_LINE, 0); return true; }
export function bumpBudget(state, id, line, dir) {
  const t = findIn(state.trips, id); if (!t || !Number.isInteger(line) || line < 0 || line >= LINES.length) return false;
  const cur = t.budget[line], nv = dir < 0 ? cur - stepFor(Math.max(0, cur - 1)) : cur + stepFor(cur); const out = whole(nv, 0, MAX_LINE, 0); if (out === cur) return false; t.budget[line] = out; return true;
}
/* total, per person and per night in whole dollars, and each line's share of the total (0 to 1; all zero when the total is zero) */
export function tripTotals(t) {
  const total = t.budget.reduce((a, b) => a + b, 0);
  return { total, perPerson: Math.round(total / Math.max(1, t.people)), perNight: Math.round(total / Math.max(1, t.nights)), shares: t.budget.map((b) => (total > 0 ? b / total : 0)) };
}
/* how far away the trip is: { days, phase: 'before' | 'today' | 'during' | 'last' | 'after', text } */
export function countdown(t, now) {
  const k = dayDiff(dayKey(now), t.start);
  if (k > 1) return { days: k, phase: 'before', text: 'in ' + k + ' days' };
  if (k === 1) return { days: 1, phase: 'before', text: 'tomorrow' };
  if (k === 0) return { days: 0, phase: 'today', text: 'starts today' };
  const s = -k; /* days since the start */
  if (s < t.nights) return { days: -s, phase: 'during', text: 'under way: night ' + (s + 1) + ' of ' + t.nights };
  if (s === t.nights) return { days: -s, phase: 'last', text: 'last day of the trip' };
  const ago = s - t.nights; return { days: -s, phase: 'after', text: ago === 1 ? 'finished yesterday' : 'finished ' + ago + ' days ago' };
}
export function addPack(state, id, tx) { const t = findIn(state.trips, id), s = text(tx, LIMITS.packText); if (!t || !s || t.pack.length >= LIMITS.packs) return null; const p = { id: newId(state), t: s, done: false }; t.pack.push(p); return p; }
export function togglePack(state, id, pid) { const t = findIn(state.trips, id), p = t && findIn(t.pack, pid); if (!p) return false; p.done = !p.done; return true; }
export function renamePack(state, id, pid, tx) { const t = findIn(state.trips, id), p = t && findIn(t.pack, pid), s = text(tx, LIMITS.packText); if (!p || !s) return false; p.t = s; return true; }
export function deletePack(state, id, pid) { const t = findIn(state.trips, id); if (!t) return false; const n = t.pack.length; t.pack = t.pack.filter((x) => x.id !== pid); return t.pack.length < n; }
export const packProgress = (t) => ({ done: t.pack.filter((p) => p.done).length, total: t.pack.length });

/* ---------- net worth ---------- */
export function addAccount(state, name, kind, bal) {
  const nm = text(name, LIMITS.acctName); if (!nm || state.accts.length >= LIMITS.accounts) return null;
  const a = { id: newId(state), name: nm, kind: KINDS.indexOf(kind) >= 0 ? kind : 'Cash', bal: whole(bal, 0, MAX_BAL, 0) }; state.accts.push(a); return a;
}
export function renameAccount(state, id, name) { const a = findIn(state.accts, id), nm = text(name, LIMITS.acctName); if (!a || !nm) return false; a.name = nm; return true; }
export function setBalance(state, id, v) { const a = findIn(state.accts, id); if (!a) return false; a.bal = whole(v, 0, MAX_BAL, 0); return true; }
export function setKind(state, id, kind) { const a = findIn(state.accts, id); if (!a || KINDS.indexOf(kind) < 0) return false; a.kind = kind; return true; }
export function cycleKind(state, id) { const a = findIn(state.accts, id); if (!a) return false; a.kind = KINDS[(Math.max(0, KINDS.indexOf(a.kind)) + 1) % KINDS.length]; return true; }
export function deleteAccount(state, id) { const n = state.accts.length; state.accts = state.accts.filter((x) => x.id !== id); return state.accts.length < n; }
/* assets (everything except Debt), debts, and net worth = assets - debts */
export function netWorth(state) {
  let assets = 0, debts = 0; state.accts.forEach((a) => { if (a.kind === 'Debt') debts += a.bal; else assets += a.bal; });
  return { assets, debts, net: assets - debts };
}
/* one row per kind, in KINDS order: dollars, and the share of all assets in whole percent (null for Debt) */
export function kindShares(state) {
  const nw = netWorth(state);
  return KINDS.map((kind) => { const total = state.accts.filter((a) => a.kind === kind).reduce((t, a) => t + a.bal, 0); return { kind, total, pct: kind === 'Debt' ? null : nw.assets > 0 ? Math.round(100 * total / nw.assets) : 0 }; });
}
/* store this month's numbers; the same calendar month is replaced, the newest 36 months are kept. Returns the snapshot, or null if there are no accounts. */
export function saveSnapshot(state, now) {
  if (!state.accts.length) return null; const nw = netWorth(state), m = monthKey(now), s = { m, assets: nw.assets, debts: nw.debts, net: nw.net };
  const i = state.snaps.findIndex((x) => x.m === m); if (i >= 0) state.snaps[i] = s; else state.snaps.push(s);
  state.snaps.sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0)); if (state.snaps.length > LIMITS.snaps) state.snaps = state.snaps.slice(-LIMITS.snaps); return s;
}
/* the newest saved month and how the numbers on screen compare with it: { m, last, diff } or null when nothing is saved */
export function snapshotChange(state) {
  if (!state.snaps.length) return null; const last = state.snaps[state.snaps.length - 1]; return { m: last.m, last: last.net, diff: netWorth(state).net - last.net };
}

/* ---------- habits ---------- */
export function addHabit(state, name) { const nm = text(name, LIMITS.habitName); if (!nm || state.habits.length >= LIMITS.habits) return null; const h = { id: newId(state), name: nm, days: [] }; state.habits.push(h); return h; }
export function renameHabit(state, id, name) { const h = findIn(state.habits, id), nm = text(name, LIMITS.habitName); if (!h || !nm) return false; h.name = nm; return true; }
export function deleteHabit(state, id) { const n = state.habits.length; state.habits = state.habits.filter((x) => x.id !== id); return state.habits.length < n; }
/* the seven day keys of this week, Monday first */
export function weekDays(now) { const wk = weekKey(now); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(wk, i)); }
/* tick or untick one day of the current week. Days still to come cannot be ticked. */
export function toggleDay(state, id, key, now) {
  const h = findIn(state.habits, id); if (!h || !validKey(key) || weekDays(now).indexOf(key) < 0 || key > dayKey(now)) return false;
  const i = h.days.indexOf(key); if (i >= 0) h.days.splice(i, 1); else { h.days.push(key); h.days.sort(); } return true;
}
/* days in a row up to today; a day not ticked yet today does not break the run */
export function habitStreak(h, now) {
  const set = new Set(h.days); let d = dayKey(now), n = 0; if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d) && n < 1000) { n++; d = addDays(d, -1); } return n;
}
export function weekTicks(h, now) { const w = weekDays(now); return h.days.filter((k) => w.indexOf(k) >= 0).length; }
/* ticks this week out of every box (habits x 7), in whole percent */
export function weekPercent(state, now) { if (!state.habits.length) return 0; return Math.round(100 * state.habits.reduce((t, h) => t + weekTicks(h, now), 0) / (state.habits.length * 7)); }

/* ---------- wish list ---------- */
export function addWish(state, name, target, price) {
  const nm = text(name, LIMITS.wishName); if (!nm || state.wishes.length >= LIMITS.wishes) return null;
  const w = { id: newId(state), name: nm, target: cents(target, 0, MAX_PRICE, 0), price: cents(price, 0, MAX_PRICE, 0) }; state.wishes.push(w); return w;
}
export function renameWish(state, id, name) { const w = findIn(state.wishes, id), nm = text(name, LIMITS.wishName); if (!w || !nm) return false; w.name = nm; return true; }
export function setTarget(state, id, v) { const w = findIn(state.wishes, id); if (!w) return false; w.target = cents(v, 0, MAX_PRICE, 0); return true; }
export function setPrice(state, id, v) { const w = findIn(state.wishes, id); if (!w) return false; w.price = cents(v, 0, MAX_PRICE, 0); return true; }
export function deleteWish(state, id) { const n = state.wishes.length; state.wishes = state.wishes.filter((x) => x.id !== id); return state.wishes.length < n; }
/* { kind: 'under' | 'over' | 'none', diff, pct, text }: "At or under target", "Over by $20 (20%)", or a nudge when a number is missing */
export function wishStatus(w) {
  if (!(w.target > 0)) return { kind: 'none', diff: 0, pct: 0, text: 'Set a target price' };
  if (!(w.price > 0)) return { kind: 'none', diff: 0, pct: 0, text: 'Add the price you saw' };
  if (w.price <= w.target) { const diff = Math.round((w.target - w.price) * 100) / 100; return { kind: 'under', diff, pct: 100 * diff / w.target, text: 'At or under target' }; }
  const diff = Math.round((w.price - w.target) * 100) / 100, pct = 100 * diff / w.target;
  return { kind: 'over', diff, pct, text: 'Over by ' + dollarsC(diff) + ' (' + pctText(pct) + '%)' };
}
/* best deals first: at or under target (biggest saving first), then over target (smallest gap first), then items still missing a number */
export function sortedWishes(state) {
  const rank = { under: 0, over: 1, none: 2 };
  return state.wishes.map((w) => ({ w, s: wishStatus(w) })).sort((a, b) => {
    if (rank[a.s.kind] !== rank[b.s.kind]) return rank[a.s.kind] - rank[b.s.kind];
    if (a.s.kind === 'under' && a.s.pct !== b.s.pct) return b.s.pct - a.s.pct;
    if (a.s.kind === 'over' && a.s.pct !== b.s.pct) return a.s.pct - b.s.pct;
    return a.w.name < b.w.name ? -1 : a.w.name > b.w.name ? 1 : a.w.id - b.w.id;
  }).map((x) => x.w);
}

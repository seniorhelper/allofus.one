/* allofus.one · the desk · app sheet: "Life" — trips, net worth, habits and a wish list.
   All rules and maths live in aou-desk-life.js (tested on its own). This file draws the tabs and passes taps to it.
   Everything is saved on this device only (localStorage). No network. Your own numbers; not financial advice. */
import * as L from './aou-desk-life.js';

export default function (desk) {
  const id = 'life';
  const TABS = [['trips', 'Trips'], ['net', 'Net worth'], ['habits', 'Habits'], ['wish', 'Wish list']];
  const LINE_COL = ['#8fc4ff', '#7ad0c8', '#ffcf7a', '#7dff5a', '#d49cff', '#ff9aa8'];
  const KIND_COL = ['#7ad0c8', '#8fc4ff', '#7dff5a', '#ffcf7a', '#d49cff', '#ff8a96'];
  const DAY3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const PAGE_ACCT = 6, PAGE_WISH = 6;
  const plainBtn = { bg: '#141a24', line: '#3a4456' };

  let st = L.parse(desk.store.get(id), Date.now());
  let tab = 'trips', sub = 'plan', tripId = 0, acctPage = 0, wishPage = 0, confirm = '', sheet = null, lastTick = 0, lastDay = '';
  const save = () => desk.store.set(id, L.serialize(st, Date.now()));
  const isOpen = () => !!(desk.S.sheets[id] && desk.S.sheets[id].open);
  const pages = (n, per) => Math.max(1, Math.ceil(n / per));
  const card = (g, x, y, w, h, col) => { desk.rr(g, x, y, w, h, 12); g.fillStyle = col || '#171d28'; g.fill(); };
  /* cut text with "…" so it fits a width at a given size (buttons squeeze text; this keeps it readable instead) */
  const fit = (g, s, w, size, weight) => { g.font = `${weight || 500} ${size}px ${desk.FF}`; if (g.measureText(s).width <= w) return s; let t = s; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t.trimEnd() + '…'; };
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const money = (t) => { const s = String(t).replace(/[^0-9.]/g, ''); if (s === '' || (s.match(/\./g) || []).length > 1) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const shortMoney = (v) => { let t = L.dollarsC(v); if (t.length > 9) t = L.dollars(v); if (t.length > 9) t = '$' + (v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : (v / 1e6).toFixed(1) + 'M'); return t; };
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '-' : '') + L.dollars(Math.abs(n));

  /* ---------- Trips ---------- */
  function drawTrips(p, g, now) {
    const trips = st.trips; if (!trips.some((t) => t.id === tripId)) tripId = trips.length ? trips[0].id : 0;
    trips.forEach((t, i) => desk.btn(p, 36 + i * 130, 96, 124, 44, fit(g, t.name, 104, 20, 700), id + ':trip', t.id, { on: t.id === tripId, size: 20 }));
    const full = trips.length >= L.LIMITS.trips;
    desk.btn(p, 826, 96, 162, 44, full ? 'Full (6)' : '+ New trip', full ? null : id + ':tadd', null, { size: 20 });
    const t = trips.find((x) => x.id === tripId);
    if (!t) { desk.label(g, 'No trips yet. Tap "+ New trip" to plan one.', 36, 200, 24, '#aab3c2', 'left', 500, 940); desk.label(g, 'You get a budget, a countdown and a packing list.', 36, 240, 20, '#7c8798', 'left', 500, 940); return; }
    const key = 't' + t.id, pk = L.packProgress(t);
    desk.btn(p, 36, 148, 390, 44, fit(g, t.name, 366, 22, 700), id + ':tname', null, { size: 22, bg: '#141a24', line: '#3a4456' });
    desk.btn(p, 434, 148, 100, 44, confirm === key ? 'Sure?' : 'Delete', id + ':tdel', null, { size: 20, bg: confirm === key ? '#5a2a30' : '#141a24', line: confirm === key ? '#ff8a96' : '#3a4456' });
    desk.btn(p, 560, 148, 200, 44, 'Plan & budget', id + ':tsub', 'plan', { on: sub === 'plan', size: 20 });
    desk.btn(p, 768, 148, 220, 44, 'Packing ' + pk.done + '/' + pk.total, id + ':tsub', 'pack', { on: sub === 'pack', size: 20 });
    if (sub === 'pack') { drawPack(p, g, t, pk); return; }
    /* left: dates, nights, travellers, countdown, totals */
    const stepRow = (y, name, val, act) => {
      desk.label(g, name, 36, y + 22, 20, '#aab3c2', 'left', 600, 84);
      desk.btn(p, 124, y, 48, 44, '−', id + ':' + act, -1, { size: 28 }); desk.btn(p, 176, y, 232, 44, val, id + ':' + act + 'T', null, Object.assign({ size: 20 }, plainBtn)); desk.btn(p, 412, y, 48, 44, '+', id + ':' + act, 1, { size: 28 });
    };
    stepRow(204, 'Starts', L.dateLabel(t.start), 'tstart'); stepRow(256, 'Nights', t.nights + (t.nights === 1 ? ' night' : ' nights'), 'tn'); stepRow(308, 'People', t.people + (t.people === 1 ? ' traveller' : ' travellers'), 'tp');
    const cd = L.countdown(t, now); card(g, 36, 364, 424, 56, '#1d2636');
    desk.label(g, cap1(cd.text), 248, 392, 28, cd.phase === 'after' ? '#aab3c2' : desk.accent(), 'center', 800, 400);
    desk.label(g, 'Back home ' + L.dateLabel(L.addDays(t.start, t.nights)), 36, 438, 20, '#aab3c2', 'left', 500, 424);
    const tt = L.tripTotals(t); card(g, 36, 456, 424, 164, '#1d2636');
    desk.label(g, 'Total', 54, 482, 22, '#aab3c2', 'left', 600, 140); desk.label(g, L.dollars(tt.total), 444, 482, 30, desk.accent(), 'right', 800, 260);
    desk.label(g, 'Per person', 54, 538, 22, '#aab3c2', 'left', 600, 160); desk.label(g, L.dollars(tt.perPerson), 444, 538, 24, '#ffffff', 'right', 700, 240);
    desk.label(g, 'Per night', 54, 586, 22, '#aab3c2', 'left', 600, 160); desk.label(g, L.dollars(tt.perNight), 444, 586, 24, '#ffffff', 'right', 700, 240);
    /* right: the six budget lines, then the stacked bar */
    desk.label(g, 'Budget. Tap an amount to type it.', 500, 214, 20, '#aab3c2', 'left', 600, 488);
    L.LINES.forEach((nm, i) => {
      const y = 236 + i * 48; desk.rr(g, 504, y + 15, 14, 14, 4); g.fillStyle = LINE_COL[i]; g.fill();
      desk.label(g, nm, 524, y + 22, 20, '#f1f4f9', 'left', 500, 156);
      desk.btn(p, 682, y, 44, 44, '−', id + ':tbud', [i, -1], { size: 28 }); desk.btn(p, 730, y, 172, 44, L.dollars(t.budget[i]), id + ':tbudT', i, Object.assign({ size: 22 }, plainBtn)); desk.btn(p, 906, y, 44, 44, '+', id + ':tbud', [i, 1], { size: 28 });
    });
    desk.rr(g, 504, 540, 456, 26, 8); g.fillStyle = '#222a38'; g.fill();
    if (tt.total > 0) {
      let x = 504; const last = tt.shares.reduce((a, s, i) => (s > 0 ? i : a), -1);
      tt.shares.forEach((s, i) => { if (s <= 0) return; const w = i === last ? 960 - x : Math.max(2, Math.round(456 * s)); g.fillStyle = LINE_COL[i]; g.fillRect(x, 540, Math.min(w, 960 - x), 26); x += w; });
      desk.label(g, 'Colours match the lines above.', 504, 592, 20, '#aab3c2', 'left', 500, 456);
    } else desk.label(g, 'Add amounts to see how the money splits.', 504, 592, 20, '#aab3c2', 'left', 500, 456);
  }
  function drawPack(p, g, t, pk) {
    const full = t.pack.length >= L.LIMITS.packs;
    desk.btn(p, 36, 204, 260, 44, full ? 'List is full (15)' : '+ Add item', full ? null : id + ':padd', null, { size: 20 });
    desk.label(g, pk.done + ' of ' + pk.total + ' packed or done', 312, 226, 22, pk.total && pk.done === pk.total ? '#7dff5a' : '#ffffff', 'left', 700, 400);
    if (!t.pack.length) desk.label(g, 'Nothing on the list. Tap + Add item.', 36, 290, 22, '#aab3c2', 'left', 500, 900);
    t.pack.forEach((it, i) => {
      const x0 = i < 8 ? 36 : 520, y = 258 + (i % 8) * 46;
      desk.btn(p, x0, y, 44, 44, it.done ? '✓' : '', id + ':ptick', it.id, { on: it.done, size: 26, bg: '#141a24', line: '#3a4456' });
      desk.btn(p, x0 + 48, y, 372, 44, fit(g, it.t, 350, 20, 500), id + ':pname', it.id, { size: 20, bold: false, bg: '#171d28', fg: it.done ? '#7c8798' : '#ffffff' });
      desk.btn(p, x0 + 424, y, 44, 44, '✕', id + ':pdel', it.id, { size: 22 });
    });
  }

  /* ---------- Net worth ---------- */
  function drawNet(p, g, now) {
    const n = st.accts.length, pg = Math.min(acctPage, pages(n, PAGE_ACCT) - 1); acctPage = pg;
    if (!n) desk.label(g, 'No accounts yet. Add your first one below.', 36, 126, 22, '#aab3c2', 'left', 500, 520);
    st.accts.slice(pg * PAGE_ACCT, pg * PAGE_ACCT + PAGE_ACCT).forEach((a, i) => {
      const y = 100 + i * 56, key = 'a' + a.id, debt = a.kind === 'Debt';
      desk.btn(p, 36, y, 178, 44, fit(g, a.name, 160, 20, 500), id + ':aname', a.id, { size: 20, bold: false, bg: '#171d28' });
      desk.btn(p, 220, y, 140, 44, fit(g, a.kind, 122, 20, 500), id + ':akind', a.id, { size: 20, bold: false, bg: '#141a24', line: KIND_COL[Math.max(0, L.KINDS.indexOf(a.kind))] });
      desk.btn(p, 366, y, 130, 44, (debt ? '-' : '') + shortMoney(a.bal), id + ':abal', a.id, Object.assign({ size: 20, fg: debt ? '#ff8a96' : '#ffffff' }, plainBtn));
      desk.btn(p, 502, y, 66, 44, confirm === key ? 'Sure?' : '✕', id + ':adel', a.id, { size: 20, bg: confirm === key ? '#5a2a30' : '#222a38', line: confirm === key ? '#ff8a96' : undefined });
    });
    desk.btn(p, 36, 440, 64, 44, '‹', id + ':apage', -1, { size: 28 }); desk.btn(p, 504, 440, 64, 44, '›', id + ':apage', 1, { size: 28 });
    desk.label(g, 'Page ' + (pg + 1) + ' of ' + pages(n, PAGE_ACCT) + '  ·  ' + n + ' of ' + L.LIMITS.accounts + ' accounts', 302, 462, 20, '#aab3c2', 'center', 500, 390);
    const full = n >= L.LIMITS.accounts;
    desk.btn(p, 36, 492, 532, 48, full ? 'Account list is full (12)' : '+ Add account', full ? null : id + ':aadd', null, { size: 24 });
    desk.label(g, 'Tap a name, kind or amount to change it.', 36, 566, 20, '#aab3c2', 'left', 500, 532);
    desk.label(g, 'Your own numbers. Not financial advice.', 36, 602, 20, '#ffcf7a', 'left', 600, 532);
    /* right: totals, share by kind, save, history */
    const nw = L.netWorth(st); card(g, 584, 96, 404, 100, '#1d2636');
    desk.label(g, 'Assets', 600, 118, 20, '#aab3c2', 'left', 600, 150); desk.label(g, L.dollars(nw.assets), 972, 118, 20, '#ffffff', 'right', 700, 220);
    desk.label(g, 'Debts', 600, 146, 20, '#aab3c2', 'left', 600, 150); desk.label(g, nw.debts ? '-' + L.dollars(nw.debts) : '$0', 972, 146, 20, nw.debts ? '#ff8a96' : '#ffffff', 'right', 700, 220);
    desk.label(g, 'Net worth', 600, 176, 24, '#ffffff', 'left', 700, 150); desk.label(g, L.dollars(nw.net), 972, 176, 26, nw.net < 0 ? '#ff8a96' : desk.accent(), 'right', 800, 240);
    const ks = L.kindShares(st), top = Math.max(1, ...ks.map((k) => k.total));
    ks.forEach((k, i) => {
      const y = 206 + i * 34; desk.label(g, k.kind, 600, y + 10, 20, '#f1f4f9', 'left', 600, 150);
      desk.label(g, shortMoney(k.total) + (k.pct === null ? '' : ' · ' + k.pct + '%'), 972, y + 10, 20, k.kind === 'Debt' && k.total ? '#ff8a96' : '#aab3c2', 'right', 500, 262);
      desk.rr(g, 600, y + 22, 372, 8, 4); g.fillStyle = '#222a38'; g.fill();
      if (k.total > 0) { desk.rr(g, 600, y + 22, Math.max(8, Math.round(372 * k.total / top)), 8, 4); g.fillStyle = KIND_COL[i]; g.fill(); }
    });
    desk.btn(p, 584, 418, 404, 46, n ? 'Save this month (' + L.monthLabel(L.monthKey(now)) + ')' : 'Add an account to save', n ? id + ':asave' : null, null, { size: 20 });
    card(g, 584, 472, 404, 148, '#131924');
    const sc = L.snapshotChange(st);
    if (!sc) desk.label(g, 'No months saved yet.', 600, 492, 20, '#aab3c2', 'left', 500, 372);
    else desk.label(g, (sc.diff === 0 ? 'No change since ' : 'Since ' ) + L.monthLabel(sc.m) + (sc.diff === 0 ? '' : ': ' + signed(sc.diff)), 600, 492, 20, sc.diff > 0 ? '#7dff5a' : sc.diff < 0 ? '#ff8a96' : '#aab3c2', 'left', 700, 372);
    const sn = st.snaps;
    if (sn.length) {
      const px = 612, py = 516, pw = 348, ph = 62; let lo = Math.min(...sn.map((s) => s.net)), hi = Math.max(...sn.map((s) => s.net)); if (hi === lo) { hi += 1; lo -= 1; }
      const X = (i) => px + (sn.length > 1 ? (pw * i) / (sn.length - 1) : pw / 2), Y = (v) => py + ph - (ph * (v - lo)) / (hi - lo);
      g.lineWidth = 1; g.strokeStyle = '#252e3d'; g.beginPath(); g.moveTo(px, py + ph); g.lineTo(px + pw, py + ph); g.stroke();
      g.strokeStyle = desk.accent(); g.lineWidth = 3; g.beginPath(); sn.forEach((s, i) => { if (i) g.lineTo(X(i), Y(s.net)); else g.moveTo(X(i), Y(s.net)); }); g.stroke();
      g.fillStyle = desk.accent(); sn.forEach((s, i) => { g.beginPath(); g.arc(X(i), Y(s.net), i === sn.length - 1 ? 6 : 4, 0, Math.PI * 2); g.fill(); });
      desk.label(g, L.monthLabel(sn[0].m), 600, 602, 20, '#aab3c2', 'left', 500, 160); if (sn.length > 1) desk.label(g, L.monthLabel(sn[sn.length - 1].m), 972, 602, 20, '#aab3c2', 'right', 500, 160);
    }
  }

  /* ---------- Habits ---------- */
  function drawHabits(p, g, now) {
    const days = L.weekDays(now), today = L.dayKey(now), hs = st.habits;
    desk.label(g, 'Habit', 36, 112, 20, '#aab3c2', 'left', 600, 200);
    days.forEach((k, i) => desk.label(g, DAY3[i], 296 + i * 64 + 29, 112, 20, k === today ? desk.accent() : '#aab3c2', 'center', k === today ? 800 : 600, 60));
    desk.label(g, 'Streak', 800, 112, 20, '#aab3c2', 'center', 600, 100);
    if (!hs.length) desk.label(g, 'No habits yet. Tap + Add habit to start a streak.', 36, 190, 22, '#aab3c2', 'left', 500, 900);
    hs.forEach((h, i) => {
      const y = 128 + i * 52, key = 'h' + h.id, s = L.habitStreak(h, now), set = new Set(h.days);
      desk.btn(p, 36, y, 250, 44, fit(g, h.name, 232, 20, 500), id + ':hname', h.id, { size: 20, bold: false, bg: '#171d28' });
      days.forEach((k, j) => {
        const on = set.has(k), future = k > today;
        desk.btn(p, 296 + j * 64, y, 58, 44, on ? '✓' : '', future ? null : id + ':hday', [h.id, j], { on, size: 26, bg: future ? '#0e1219' : '#141a24', line: k === today ? desk.accent() : (future ? '#222a38' : '#3a4456') });
      });
      desk.label(g, s + (s === 1 ? ' day' : ' days'), 800, y + 22, 22, s > 0 ? desk.accent() : '#7c8798', 'center', 700, 100);
      desk.btn(p, 870, y, 76, 44, confirm === key ? 'Sure?' : '✕', id + ':hdel', h.id, { size: 20, bg: confirm === key ? '#5a2a30' : '#222a38', line: confirm === key ? '#ff8a96' : undefined });
    });
    const full = hs.length >= L.LIMITS.habits, pct = L.weekPercent(st, now);
    desk.btn(p, 36, 552, 250, 48, full ? 'Full (8 habits)' : '+ Add habit', full ? null : id + ':hadd', null, { size: 22 });
    desk.label(g, 'This week: ' + pct + '% ticked', 300, 566, 22, '#ffffff', 'left', 700, 420);
    desk.rr(g, 300, 584, 414, 14, 7); g.fillStyle = '#222a38'; g.fill(); if (pct > 0) { desk.rr(g, 300, 584, Math.max(14, Math.round(414 * pct / 100)), 14, 7); g.fillStyle = desk.accent(); g.fill(); }
    desk.label(g, 'A new week starts every Monday. 12 weeks are kept.', 36, 614, 20, '#aab3c2', 'left', 500, 900);
  }

  /* ---------- Wish list ---------- */
  function drawWish(p, g) {
    const list = L.sortedWishes(st), n = list.length, pg = Math.min(wishPage, pages(n, PAGE_WISH) - 1); wishPage = pg;
    const fullW = n >= L.LIMITS.wishes;
    desk.btn(p, 36, 92, 220, 44, fullW ? 'Full (20)' : '+ Add item', fullW ? null : id + ':wadd', null, { size: 20 });
    desk.label(g, 'Target', 394, 114, 20, '#aab3c2', 'center', 600, 110); desk.label(g, 'Price seen', 524, 114, 20, '#aab3c2', 'center', 600, 110); desk.label(g, 'Status. Best deals first.', 598, 114, 20, '#aab3c2', 'left', 600, 390);
    if (!n) desk.label(g, 'Nothing here yet. Add something you are watching.', 36, 190, 22, '#aab3c2', 'left', 500, 900);
    list.slice(pg * PAGE_WISH, pg * PAGE_WISH + PAGE_WISH).forEach((w, i) => {
      const y = 146 + i * 52, s = L.wishStatus(w), key = 'w' + w.id, under = s.kind === 'under', bg = under ? '#16301f' : '#171d28';
      card(g, 36, y, 952, 44, bg);
      desk.btn(p, 36, y, 290, 44, fit(g, w.name, 272, 20, 500), id + ':wname', w.id, { size: 20, bold: false, bg, line: under ? '#7dff5a' : undefined });
      desk.btn(p, 332, y, 124, 44, w.target > 0 ? shortMoney(w.target) : 'Tap to set', id + ':wtarget', w.id, Object.assign({ size: 20, fg: w.target > 0 ? '#ffffff' : '#7c8798' }, plainBtn));
      desk.btn(p, 462, y, 124, 44, w.price > 0 ? shortMoney(w.price) : 'Tap to set', id + ':wprice', w.id, Object.assign({ size: 20, fg: w.price > 0 ? '#ffffff' : '#7c8798' }, plainBtn));
      desk.label(g, s.text, 598, y + 22, 22, under ? '#7dff5a' : s.kind === 'over' ? '#ffcf7a' : '#aab3c2', 'left', under ? 800 : 600, 304);
      desk.btn(p, 912, y, 76, 44, confirm === key ? 'Sure?' : '✕', id + ':wdel', w.id, { size: 20, bg: confirm === key ? '#5a2a30' : '#222a38', line: confirm === key ? '#ff8a96' : undefined });
    });
    desk.btn(p, 36, 458, 64, 44, '‹', id + ':wpage', -1, { size: 28 }); desk.btn(p, 924, 458, 64, 44, '›', id + ':wpage', 1, { size: 28 });
    desk.label(g, 'Page ' + (pg + 1) + ' of ' + pages(n, PAGE_WISH) + '  ·  ' + n + ' of ' + L.LIMITS.wishes + ' items', 512, 480, 20, '#aab3c2', 'center', 500, 760);
    /* reserved slot: shows nothing live, has no button and makes no requests */
    desk.rr(g, 36, 512, 952, 108, 14); g.fillStyle = '#141a24'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#3a4456'; if (g.setLineDash) g.setLineDash([10, 8]); g.stroke(); if (g.setLineDash) g.setLineDash([]);
    desk.label(g, 'Automatic deal finder: coming later.', 60, 546, 24, '#aab3c2', 'left', 700, 700); desk.label(g, 'Not active', 964, 546, 20, '#7c8798', 'right', 600, 160);
    desk.label(g, 'This slot is reserved for a consent-based shopping helper.', 60, 586, 20, '#7c8798', 'left', 500, 900);
  }

  desk.onFrame((t) => { /* a new day while the sheet is open: redraw so the week and countdown stay right */
    if (t - lastTick < 5000 && t >= lastTick) return; lastTick = t;
    const d = L.dayKey(Date.now()); if (d !== lastDay) { lastDay = d; if (isOpen()) desk.redraw(sheet); }
  });

  const ask = (title, initial, max, cb) => desk.askText(title, initial, max, (t) => { cb(t); });
  const find = (list, v) => list.find((x) => x.id === v);

  sheet = desk.addSheet({
    id, title: 'Life', W: 1024, H: 640, w: 1.0, h: 0.625, home: { a: 0.95, e: 0.02, r: 1.6, k: 1 }, open: false,
    draw(p, g) {
      const now = Date.now(); lastDay = L.dayKey(now); if (L.roll(st, now)) save();
      desk.base(p, 'Life');
      TABS.forEach(([k, n], i) => desk.btn(p, 404 + i * 148, 30, 140, 52, n, id + ':tab', k, { on: tab === k, size: 22 }));
      if (tab === 'trips') drawTrips(p, g, now); else if (tab === 'net') drawNet(p, g, now); else if (tab === 'habits') drawHabits(p, g, now); else drawWish(p, g);
    },
    act(name, arg) {
      const now = Date.now(); L.roll(st, now);
      if (!/del$/.test(name) && confirm) confirm = '';
      const done = () => { save(); desk.redraw(sheet); };
      const num = (v) => Number.isInteger(v);
      const dir = (v) => (typeof v === 'number' && v < 0 ? -1 : 1);
      const t = find(st.trips, tripId);
      switch (name) {
        case 'tab': if (TABS.some((x) => x[0] === arg)) { tab = arg; desk.redraw(sheet); } return;
        /* trips */
        case 'trip': if (num(arg) && find(st.trips, arg)) { tripId = arg; sub = 'plan'; desk.redraw(sheet); } return;
        case 'tadd': ask('Trip name', '', L.LIMITS.tripName, (nm) => { const x = L.addTrip(st, nm, Date.now()); if (x) { tripId = x.id; sub = 'plan'; done(); } else desk.say(nm ? 'The trip list is full' : 'Type a name for the trip'); }); return;
        case 'tname': if (t) ask('Trip name', t.name, L.LIMITS.tripName, (nm) => { if (L.renameTrip(st, t.id, nm)) done(); }); return;
        case 'tdel': if (!t) return; if (confirm !== 't' + t.id) { confirm = 't' + t.id; desk.redraw(sheet); return; } confirm = ''; L.deleteTrip(st, t.id); tripId = 0; done(); return;
        case 'tsub': if (arg === 'plan' || arg === 'pack') { sub = arg; desk.redraw(sheet); } return;
        case 'tstart': if (t && num(arg) && L.shiftStart(st, t.id, dir(arg))) done(); return;
        case 'tstartT': if (t) ask('Start date, like 12/23/2026', '', 20, (x) => { const k = L.parseDateInput(x, Date.now()); if (k && L.setStart(st, t.id, k)) done(); else if (x) desk.say('Try a date like 12/23/2026'); }); return;
        case 'tn': if (t && num(arg) && L.bumpNights(st, t.id, arg)) done(); return;
        case 'tnT': if (t) ask('Number of nights (1 to ' + L.LIMITS.nights + ')', String(t.nights), 3, (x) => { const v = money(x); if (v === null) { desk.say('Type a number'); return; } L.setNights(st, t.id, v); done(); }); return;
        case 'tp': if (t && num(arg) && L.bumpPeople(st, t.id, arg)) done(); return;
        case 'tpT': if (t) ask('Number of travellers (1 to ' + L.LIMITS.people + ')', String(t.people), 2, (x) => { const v = money(x); if (v === null) { desk.say('Type a number'); return; } L.setPeople(st, t.id, v); done(); }); return;
        case 'tbud': if (t && Array.isArray(arg) && num(arg[0]) && num(arg[1]) && L.bumpBudget(st, t.id, arg[0], arg[1])) done(); return;
        case 'tbudT': if (t && num(arg) && arg >= 0 && arg < L.LINES.length) ask(L.LINES[arg] + ' in dollars', String(t.budget[arg]), 10, (x) => { const v = money(x); if (v === null) { desk.say('Type a number'); return; } L.setBudget(st, t.id, arg, v); done(); }); return;
        case 'padd': if (t) ask('Add to the list', '', L.LIMITS.packText, (x) => { if (!x) return; if (L.addPack(st, t.id, x)) done(); else desk.say('The list is full (15)'); }); return;
        case 'ptick': if (t && num(arg) && L.togglePack(st, t.id, arg)) done(); return;
        case 'pname': if (t && num(arg)) { const it = find(t.pack, arg); if (it) ask('Item', it.t, L.LIMITS.packText, (x) => { if (L.renamePack(st, t.id, arg, x)) done(); }); } return;
        case 'pdel': if (t && num(arg) && L.deletePack(st, t.id, arg)) done(); return;
        /* net worth */
        case 'apage': acctPage = Math.max(0, Math.min(pages(st.accts.length, PAGE_ACCT) - 1, acctPage + dir(arg))); desk.redraw(sheet); return;
        case 'aadd': ask('Account name', '', L.LIMITS.acctName, (nm) => { if (!nm) return; ask('Balance in dollars', '', 12, (v) => { const a = L.addAccount(st, nm, 'Cash', money(v) || 0); if (a) { acctPage = pages(st.accts.length, PAGE_ACCT) - 1; done(); } else desk.say('The account list is full'); }); }); return;
        case 'aname': if (num(arg)) { const a = find(st.accts, arg); if (a) ask('Account name', a.name, L.LIMITS.acctName, (x) => { if (L.renameAccount(st, arg, x)) done(); }); } return;
        case 'akind': if (num(arg) && L.cycleKind(st, arg)) done(); return;
        case 'abal': if (num(arg)) { const a = find(st.accts, arg); if (a) ask('Balance in dollars', String(a.bal), 12, (x) => { const v = money(x); if (v === null) { desk.say('Type a number'); return; } L.setBalance(st, arg, v); done(); }); } return;
        case 'adel': if (!num(arg) || !find(st.accts, arg)) return; if (confirm !== 'a' + arg) { confirm = 'a' + arg; desk.redraw(sheet); return; } confirm = ''; L.deleteAccount(st, arg); done(); return;
        case 'asave': { const s = L.saveSnapshot(st, Date.now()); if (s) { desk.say('Saved ' + L.monthLabel(s.m)); done(); } else desk.say('Add an account first'); return; }
        /* habits */
        case 'hadd': ask('Habit name', '', L.LIMITS.habitName, (nm) => { if (!nm) return; if (L.addHabit(st, nm)) done(); else desk.say('The habit list is full'); }); return;
        case 'hname': if (num(arg)) { const h = find(st.habits, arg); if (h) ask('Habit name', h.name, L.LIMITS.habitName, (x) => { if (L.renameHabit(st, arg, x)) done(); }); } return;
        case 'hday': if (Array.isArray(arg) && num(arg[0]) && num(arg[1]) && arg[1] >= 0 && arg[1] < 7 && L.toggleDay(st, arg[0], L.weekDays(now)[arg[1]], now)) done(); return;
        case 'hdel': if (!num(arg) || !find(st.habits, arg)) return; if (confirm !== 'h' + arg) { confirm = 'h' + arg; desk.redraw(sheet); return; } confirm = ''; L.deleteHabit(st, arg); done(); return;
        /* wish list */
        case 'wpage': wishPage = Math.max(0, Math.min(pages(st.wishes.length, PAGE_WISH) - 1, wishPage + dir(arg))); desk.redraw(sheet); return;
        case 'wadd': ask('What are you watching?', '', L.LIMITS.wishName, (nm) => { if (!nm) return; ask('Target price in dollars', '', 10, (tg) => { ask('Price you last saw (or leave empty)', '', 10, (pr) => { if (L.addWish(st, nm, money(tg) || 0, money(pr) || 0)) done(); else desk.say('The wish list is full'); }); }); }); return;
        case 'wname': if (num(arg)) { const w = find(st.wishes, arg); if (w) ask('Item name', w.name, L.LIMITS.wishName, (x) => { if (L.renameWish(st, arg, x)) done(); }); } return;
        case 'wtarget': if (num(arg)) { const w = find(st.wishes, arg); if (w) ask('Target price in dollars', w.target ? String(w.target) : '', 10, (x) => { const v = money(x); if (v === null) { desk.say('Type a number'); return; } L.setTarget(st, arg, v); done(); }); } return;
        case 'wprice': if (num(arg)) { const w = find(st.wishes, arg); if (w) ask('Price you last saw', w.price ? String(w.price) : '', 10, (x) => { const v = money(x); if (v === null) { desk.say('Type a number'); return; } L.setPrice(st, arg, v); done(); }); } return;
        case 'wdel': if (!num(arg) || !find(st.wishes, arg)) return; if (confirm !== 'w' + arg) { confirm = 'w' + arg; desk.redraw(sheet); return; } confirm = ''; L.deleteWish(st, arg); done(); return;
      }
    },
  });
}

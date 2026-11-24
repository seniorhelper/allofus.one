/* allofus.one · the desk · app sheet: "Planner" — today's top 3, a small deal pipeline, reminders and the weekly numbers.
   All rules and maths live in aou-desk-plan.js (tested on its own). This file draws the tabs and passes taps to it.
   Everything is saved on this device only (localStorage). No network, no notifications API: reminders only sound while the page is open.
   Planning aid only; the forecast uses stage chances that are assumptions, and the sheet says so. */
import * as P from './aou-desk-plan.js';

export default function (desk) {
  const id = 'plan';
  const TABS = [['today', 'Today'], ['pipe', 'Pipeline'], ['rem', 'Reminders'], ['week', 'Week']];
  const PICK_LABEL = { m15: 'In 15 minutes', h1: 'In 1 hour', tonight: 'Tonight, 6 pm', tomorrow: 'Tomorrow, 9 am', week: 'Next Monday, 9 am' };
  const SHUT = ['Review what got done', 'Plan tomorrow\'s top 3', 'Clear the desk'];
  const STAGE_COL = ['#8fc4ff', '#7ad0c8', '#ffcf7a', '#7dff5a', '#8a93a3'];
  const PAGE = 6; /* rows per page in the Pipeline and Reminders lists */
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let st = P.parse(desk.store.get(id), Date.now());
  let tab = 'today', dealPage = 0, remPage = 0, sel = 0, confirmId = 0, sheet = null, lastTick = 0, lastMinute = 0;
  const announced = new Set(); /* reminder ids already announced this session */
  const save = () => desk.store.set(id, P.serialize(st));
  const isOpen = () => !!(desk.S.sheets[id] && desk.S.sheets[id].open);
  const pages = (n) => Math.max(1, Math.ceil(n / PAGE));
  const hm = (d) => { const h = d.getHours(); return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };
  function whenText(due, now) {
    if (due <= now) return 'Due now';
    const mins = Math.ceil((due - now) / 60000); if (mins < 60) return 'In ' + mins + ' min';
    const d = new Date(due), k = P.dayKey(due), t = P.dayKey(now);
    if (k === t) return 'Today ' + hm(d); if (k === P.addDays(t, 1)) return 'Tomorrow ' + hm(d);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + hm(d);
  }
  const fmtMetric = (i, v) => { const m = P.METRICS[i]; return m.unit === '$' ? P.dollars(v) : m.unit === 'h' ? v + ' h' : String(v); };
  const card = (g, x, y, w, h, col) => { desk.rr(g, x, y, w, h, 12); g.fillStyle = col || '#171d28'; g.fill(); };
  const plainBtn = { bg: '#141a24', line: '#3a4456' };

  /* ---------- Today: rows 140-324 (priorities), 380-552 (shutdown), 590 (note) ---------- */
  function drawToday(p, g, now) {
    desk.label(g, 'Top 3 for today', 36, 118, 24, '#ffffff', 'left', 700);
    st.today.top.forEach((x, i) => {
      const y = 140 + i * 64;
      desk.btn(p, 36, y, 56, 56, x.done ? '✓' : '', id + ':tick', i, { on: x.done, size: 30, bg: '#141a24', line: '#3a4456' });
      desk.btn(p, 100, y, 640, 56, x.t || 'Tap to type a priority', id + ':type', i, { size: 22, bold: false, bg: '#171d28', fg: x.t ? (x.done ? '#7c8798' : '#ffffff') : '#7c8798' });
    });
    const s = P.streakNow(st, now); card(g, 760, 140, 228, 184, '#1d2636');
    desk.label(g, 'Streak', 874, 168, 22, '#aab3c2', 'center', 600); desk.label(g, String(s), 874, 232, 64, desk.accent(), 'center', 800, 200);
    desk.label(g, s === 1 ? 'day, all 3 done' : 'days, all 3 done', 874, 292, 20, '#aab3c2', 'center', 500, 210);
    desk.label(g, 'Shut down for the day', 36, 358, 24, '#ffffff', 'left', 700);
    st.today.shut.forEach((on, i) => desk.btn(p, 36, 380 + i * 60, 704, 52, (on ? '✓  ' : '○  ') + SHUT[i], id + ':shut', i, { on, size: 22, bold: false, bg: '#171d28' }));
    const all = st.today.shut.every(Boolean);
    desk.label(g, all ? 'Day closed. Well done.' : 'Tick these off when you finish for the day.', 36, 590, 20, all ? '#7dff5a' : '#aab3c2', 'left', 500, 700);
  }

  /* ---------- Pipeline: list rows 130-472, pager 480-524, add 534-582; right panel 100-574 ---------- */
  function drawPipe(p, g) {
    const n = st.deals.length, pg = Math.min(dealPage, pages(n) - 1); dealPage = pg;
    desk.label(g, 'Deals', 36, 112, 24, '#ffffff', 'left', 700); desk.label(g, 'Tap a value to change it', 620, 112, 20, '#aab3c2', 'right');
    if (!n) desk.label(g, 'No deals yet. Add your first one below.', 36, 160, 22, '#aab3c2', 'left', 500, 580);
    st.deals.slice(pg * PAGE, pg * PAGE + PAGE).forEach((d, i) => {
      const y = 130 + i * 58; card(g, 36, y, 584, 52); desk.label(g, d.name, 46, y + 26, 20, '#f1f4f9', 'left', 600, 206);
      desk.btn(p, 258, y + 4, 112, 44, P.dollars(d.value), id + ':value', d.id, Object.assign({ size: 20 }, plainBtn));
      if (confirmId === d.id) { desk.btn(p, 378, y + 4, 164, 44, 'Yes, delete', id + ':delyes', d.id, { size: 20, bg: '#5a2a30', line: '#ff8a96' }); desk.btn(p, 550, y + 4, 64, 44, 'No', id + ':delno', null, { size: 20 }); }
      else {
        desk.btn(p, 378, y + 4, 44, 44, '‹', id + ':stage', [d.id, -1], { size: 28 });
        desk.label(g, P.STAGES[d.stage], 462, y + 26, 20, STAGE_COL[d.stage], 'center', 700, 80);
        desk.btn(p, 504, y + 4, 44, 44, '›', id + ':stage', [d.id, 1], { size: 28 }); desk.btn(p, 556, y + 4, 58, 44, '✕', id + ':del', d.id, { size: 22 });
      }
    });
    desk.btn(p, 36, 480, 64, 44, '‹', id + ':page', -1, { size: 28 }); desk.btn(p, 556, 480, 64, 44, '›', id + ':page', 1, { size: 28 });
    desk.label(g, 'Page ' + (pg + 1) + ' of ' + pages(n) + '  ·  ' + n + ' of ' + P.LIMITS.deals + ' deals', 328, 502, 20, '#aab3c2', 'center', 500, 440);
    desk.btn(p, 36, 534, 584, 48, n >= P.LIMITS.deals ? 'Deal list is full (40)' : '+ Add deal', n >= P.LIMITS.deals ? null : id + ':add', null, { size: 24 });
    /* right: per stage totals with bars, rows 134-410 */
    const tot = P.stageTotals(st), top = Math.max(1, ...tot.map((t) => t.value));
    desk.label(g, 'Value by stage', 640, 112, 24, '#ffffff', 'left', 700);
    tot.forEach((t, i) => {
      const y = 134 + i * 56; desk.label(g, t.stage + ' · ' + t.count, 640, y + 12, 20, '#f1f4f9', 'left', 600, 170); desk.label(g, P.dollars(t.value), 988, y + 12, 20, '#ffffff', 'right', 700, 170);
      desk.rr(g, 640, y + 28, 348, 14, 7); g.fillStyle = '#222a38'; g.fill();
      if (t.value > 0) { const w = Math.max(14, Math.round(348 * t.value / top)); desk.rr(g, 640, y + 28, w, 14, 7); g.fillStyle = STAGE_COL[i]; g.fill(); }
    });
    card(g, 640, 424, 348, 150, '#1d2636');
    desk.label(g, 'Still open', 654, 446, 20, '#aab3c2', 'left', 500); desk.label(g, P.dollars(P.openValue(st)), 974, 446, 22, '#ffffff', 'right', 700, 190);
    desk.label(g, 'Forecast', 654, 478, 22, '#aab3c2', 'left', 600); desk.label(g, P.dollars(P.forecast(st)), 974, 478, 26, desk.accent(), 'right', 800, 190);
    g.font = `500 20px ${desk.FF}`; desk.L.wrap('Assumed chance to close: ' + P.STAGES.map((s, i) => s + ' ' + P.PROB[i] + '%').join(', ') + '.', 320, (s) => g.measureText(s).width, 3).forEach((ln, k) => desk.label(g, ln, 654, 512 + k * 24, 20, '#ffcf7a', 'left', 500, 322));
  }

  /* ---------- Reminders: list rows 130-496, pager 504-548; right picks 134-446, notes 480-592 ---------- */
  function drawRem(p, g, now) {
    const n = st.rem.length, pg = Math.min(remPage, pages(n) - 1); remPage = pg;
    desk.label(g, 'Reminders (' + n + ' of ' + P.LIMITS.reminders + ')', 36, 112, 24, '#ffffff', 'left', 700);
    if (!n) desk.label(g, 'Nothing set. Tap a time on the right.', 36, 160, 22, '#aab3c2', 'left', 500, 580);
    st.rem.slice(pg * PAGE, pg * PAGE + PAGE).forEach((r, i) => {
      const y = 130 + i * 62, due = P.isDue(r, now); card(g, 36, y, 584, 56, due ? '#3a2229' : '#171d28');
      desk.label(g, r.text, 48, y + 17, 20, '#ffffff', 'left', 600, 460); desk.label(g, whenText(r.due, now), 48, y + 41, 20, due ? '#ff8a96' : '#aab3c2', 'left', due ? 700 : 500, 460);
      desk.btn(p, 516, y + 6, 98, 44, due ? 'Dismiss' : 'Remove', id + ':rdel', r.id, { size: 20, bg: due ? '#5a2a30' : '#141a24', line: due ? '#ff8a96' : '#3a4456' });
    });
    if (n > PAGE) { desk.btn(p, 36, 504, 64, 44, '‹', id + ':rpage', -1, { size: 28 }); desk.btn(p, 556, 504, 64, 44, '›', id + ':rpage', 1, { size: 28 }); desk.label(g, 'Page ' + (pg + 1) + ' of ' + pages(n), 328, 526, 20, '#aab3c2', 'center', 500, 440); }
    desk.label(g, 'Add a reminder', 640, 112, 24, '#ffffff', 'left', 700);
    P.PICKS.forEach((k, i) => desk.btn(p, 640, 134 + i * 64, 348, 56, PICK_LABEL[k], n >= P.LIMITS.reminders ? null : id + ':radd', k, { size: 22 }));
    g.font = `500 20px ${desk.FF}`; const msg = n >= P.LIMITS.reminders ? 'The list is full (20). Remove one first.' : 'Tap a time, then type what to remember.';
    desk.L.wrap(msg, 340, (s) => g.measureText(s).width, 2).forEach((ln, k) => desk.label(g, ln, 640, 480 + k * 26, 20, '#f1f4f9', 'left', 500, 348));
    desk.L.wrap('You get a sound and a message only while this page is open.', 340, (s) => g.measureText(s).width, 3).forEach((ln, k) => desk.label(g, ln, 640, 544 + k * 26, 20, '#ffcf7a', 'left', 500, 348));
  }

  /* ---------- Week: rows 130-514, hint 560; right chart 134-440, summary 462-530 ---------- */
  function drawWeek(p, g, now) {
    const wk = P.weekKey(now), d0 = new Date(+wk.slice(0, 4), +wk.slice(5, 7) - 1, +wk.slice(8, 10));
    desk.label(g, 'This week (from Mon ' + d0.getDate() + ' ' + MON[d0.getMonth()] + ')', 36, 112, 22, '#ffffff', 'left', 700, 580);
    P.METRICS.forEach((m, i) => {
      const y = 130 + i * 56, c = P.compare(st, now, i);
      desk.btn(p, 36, y, 150, 48, m.label, id + ':pick', i, { on: sel === i, size: 20 });
      desk.btn(p, 194, y, 52, 48, '−', id + ':bump', [i, -1], { size: 30 }); desk.btn(p, 252, y, 120, 48, fmtMetric(i, c.now), id + ':num', i, Object.assign({ size: 22 }, plainBtn)); desk.btn(p, 380, y, 52, 48, '+', id + ':bump', [i, 1], { size: 30 });
      const arrow = c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : c.trend === 'same' ? '＝' : '';
      desk.label(g, c.last === null ? 'last: none' : 'last: ' + fmtMetric(i, c.last), 444, y + 24, 20, '#aab3c2', 'left', 500, 130);
      if (arrow) desk.label(g, arrow, 600, y + 24, 26, c.trend === 'up' ? '#7dff5a' : c.trend === 'down' ? '#ff8a96' : '#aab3c2', 'center', 700);
    });
    desk.label(g, 'A new week starts every Monday. 12 weeks are kept.', 36, 560, 20, '#aab3c2', 'left', 500, 584);
    /* chart for the picked number */
    const m = P.METRICS[sel], s = P.series(st, now, sel), vals = s.filter((v) => v !== null), hi = Math.max(1, ...vals);
    desk.label(g, m.label + ', last 12 weeks', 640, 112, 22, '#ffffff', 'left', 700, 348);
    card(g, 640, 134, 348, 306, '#131924');
    desk.label(g, 'Top: ' + fmtMetric(sel, hi), 976, 154, 20, '#aab3c2', 'right', 500, 320);
    const px = 662, py = 176, pw = 304, ph = 220, X = (i) => px + (pw * i) / 11, Y = (v) => py + ph - (ph * v) / hi;
    g.lineWidth = 1; g.strokeStyle = '#252e3d'; [0, 0.5, 1].forEach((f) => { g.beginPath(); g.moveTo(px, py + ph - ph * f); g.lineTo(px + pw, py + ph - ph * f); g.stroke(); });
    g.strokeStyle = desk.accent(); g.lineWidth = 3; g.beginPath(); let on = false; s.forEach((v, i) => { if (v === null) { on = false; return; } if (on) g.lineTo(X(i), Y(v)); else { g.moveTo(X(i), Y(v)); on = true; } }); g.stroke();
    g.fillStyle = desk.accent(); s.forEach((v, i) => { if (v === null) return; g.beginPath(); g.arc(X(i), Y(v), i === 11 ? 6 : 4, 0, Math.PI * 2); g.fill(); });
    desk.label(g, '12 weeks ago', 662, 420, 20, '#aab3c2', 'left', 500, 150); desk.label(g, 'now', 966, 420, 20, '#aab3c2', 'right', 500, 80);
    const c = P.compare(st, now, sel); card(g, 640, 456, 348, 84, '#1d2636');
    desk.label(g, 'This week  ' + fmtMetric(sel, c.now), 654, 482, 22, '#ffffff', 'left', 700, 320); desk.label(g, c.last === null ? 'Last week  none' : 'Last week  ' + fmtMetric(sel, c.last), 654, 514, 20, '#aab3c2', 'left', 500, 320);
  }

  /* ---------- reminders that come due: checked about once a second, only talks once per reminder ---------- */
  desk.onFrame((tNow) => {
    if (tNow - lastTick < 1000 && tNow >= lastTick) return; lastTick = tNow;
    const now = Date.now(); let redo = false;
    if (P.rollDay(st, now)) { save(); redo = true; }
    const due = P.dueNow(st, now).filter((r) => !announced.has(r.id));
    if (due.length) {
      due.forEach((r) => announced.add(r.id));
      desk.say('Reminder: ' + due[0].text + (due.length > 1 ? ' (+' + (due.length - 1) + ' more)' : ''), 6000); desk.beep(660, 0.14, 0.03); desk.beep(880, 0.18, 0.03, 0.18); redo = true;
    }
    if (!redo && tab === 'rem' && now - lastMinute > 15000) { lastMinute = now; redo = true; } /* keep "in 14 min" fresh */
    if (redo && isOpen()) desk.redraw(sheet);
  });

  const ask = (title, initial, max, cb) => desk.askText(title, initial, max, (t) => { cb(t); });
  const money = (t) => { const s = String(t).replace(/[^0-9.]/g, ''); return s === '' ? null : Number(s); };

  sheet = desk.addSheet({
    id, title: 'Planner', W: 1024, H: 640, w: 1.0, h: 0.625, home: { a: -0.45, e: 0.02, r: 1.6, k: 1 }, open: false,
    draw(p, g) {
      const now = Date.now(); if (P.rollDay(st, now)) save();
      desk.base(p, 'Planner');
      TABS.forEach(([k, n], i) => desk.btn(p, 404 + i * 148, 30, 140, 52, n, id + ':tab', k, { on: tab === k, size: 22 }));
      if (tab === 'today') drawToday(p, g, now); else if (tab === 'pipe') drawPipe(p, g); else if (tab === 'rem') drawRem(p, g, now); else drawWeek(p, g, now);
    },
    act(name, arg) {
      const now = Date.now(); P.rollDay(st, now);
      const done = () => { save(); desk.redraw(sheet); };
      const num = (v) => Number.isInteger(v);
      switch (name) {
        case 'tab': if (TABS.some((t) => t[0] === arg)) { tab = arg; confirmId = 0; desk.redraw(sheet); } return;
        case 'tick': if (num(arg) && P.toggleTop(st, arg, now)) done(); else if (num(arg)) desk.say('Type a priority first'); return;
        case 'type': if (!num(arg) || arg < 0 || arg > 2) return; ask('Priority ' + (arg + 1), st.today.top[arg].t, P.LIMITS.topText, (t) => { P.setTop(st, arg, t); done(); }); return;
        case 'shut': if (num(arg) && P.toggleShut(st, arg)) done(); return;
        case 'page': dealPage = Math.max(0, Math.min(pages(st.deals.length) - 1, dealPage + (arg < 0 ? -1 : 1))); confirmId = 0; desk.redraw(sheet); return;
        case 'add': ask('Deal name', '', P.LIMITS.name, (nm) => { if (!nm) return; ask('Value in dollars', '', 12, (v) => { const d = P.addDeal(st, nm, money(v) || 0); if (d) { dealPage = pages(st.deals.length) - 1; done(); } else desk.say('The deal list is full'); }); }); return;
        case 'value': if (!num(arg)) return; ask('Value in dollars', String((st.deals.find((d) => d.id === arg) || {}).value || 0), 12, (v) => { const x = money(v); if (x === null) { desk.say('Type a number'); return; } P.setDealValue(st, arg, x); done(); }); return;
        case 'stage': if (Array.isArray(arg) && P.moveDeal(st, arg[0], arg[1])) done(); return;
        case 'del': if (num(arg)) { confirmId = arg; desk.redraw(sheet); } return;
        case 'delno': confirmId = 0; desk.redraw(sheet); return;
        case 'delyes': if (num(arg) && confirmId === arg) { P.deleteDeal(st, arg); confirmId = 0; done(); } return;
        case 'radd': if (P.PICKS.indexOf(arg) < 0) return; try { desk.sound(); } catch (e) { } ask(PICK_LABEL[arg] + ': remind me to…', '', P.LIMITS.remText, (t) => { if (!t) return; const r = P.addReminder(st, t, arg, Date.now()); if (r) { remPage = pages(st.rem.length) - 1; done(); } else desk.say('The reminder list is full'); }); return;
        case 'rdel': if (num(arg) && P.dismissReminder(st, arg)) { announced.delete(arg); done(); } return;
        case 'rpage': remPage = Math.max(0, Math.min(pages(st.rem.length) - 1, remPage + (arg < 0 ? -1 : 1))); desk.redraw(sheet); return;
        case 'pick': if (num(arg) && arg >= 0 && arg < P.METRICS.length) { sel = arg; desk.redraw(sheet); } return;
        case 'bump': if (Array.isArray(arg) && P.bumpMetric(st, now, arg[0], arg[1])) { sel = arg[0]; done(); } return;
        case 'num': if (!num(arg) || arg < 0 || arg >= P.METRICS.length) return; ask(P.METRICS[arg].label + ' this week', String(P.compare(st, now, arg).now), 12, (t) => { const x = money(t); if (x === null) { desk.say('Type a number'); return; } P.setMetric(st, Date.now(), arg, x); sel = arg; done(); }); return;
      }
    },
  });
}

/* allofus.one · the desk · app sheet: "Money tools" — calculators with live charts for money, property and tax planning.
   All the maths lives in aou-desk-calc.js (tested on its own). This file only draws the form, the results and the chart. */
import * as C from './aou-desk-calc.js';

export default function (desk) {
  const id = 'tools';
  const MODES = [['finance', 'Money'], ['realestate', 'Property'], ['tax', 'Tax']];
  const byId = {}; C.TOOLS.forEach((t) => { byId[t.id] = t; });
  const st = { mode: 'finance', tool: 'loan', vals: {} };
  const dflt = (t) => { const o = {}; t.inputs.forEach((i) => { o[i.key] = i.dflt; }); return o; };
  C.TOOLS.forEach((t) => { st.vals[t.id] = dflt(t); });
  /* saved numbers are re-clamped to each input's own range; unknown tools and keys are dropped */
  try {
    const raw = JSON.parse(desk.store.get(id) || 'null');
    if (raw && typeof raw === 'object') {
      if (MODES.some((m) => m[0] === raw.mode)) st.mode = raw.mode; if (typeof raw.tool === 'string' && byId[raw.tool] && byId[raw.tool].mode === st.mode) st.tool = raw.tool; else st.tool = C.TOOLS.find((t) => t.mode === st.mode).id;
      C.TOOLS.forEach((t) => { const v = raw.vals && typeof raw.vals === 'object' ? raw.vals[t.id] : null; if (v && typeof v === 'object') t.inputs.forEach((i) => { st.vals[t.id][i.key] = C.num(v[i.key], i.min, i.max, i.dflt); }); });
    }
  } catch (e) { }
  const save = () => desk.store.set(id, JSON.stringify(st));
  const short = (n) => { const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? Math.round(n / 1e3) + 'k' : a >= 100 ? String(Math.round(n)) : String(Math.round(n * 100) / 100); };
  const show = (i, v) => (i.unit === '$' ? C.money(v) : short(v) + (i.unit ? (i.unit === '%' ? '%' : ' ' + i.unit) : ''));
  const COLS = ['', '#8fc4ff', '#7dff5a'];
  let sheet = null;

  function chart(g, c, x, y, w, h) {
    desk.rr(g, x, y, w, h, 12); g.fillStyle = '#131924'; g.fill(); if (!c || !c.series || !c.series.length || !c.x.length) { desk.label(g, 'No chart for this tool', x + w / 2, y + h / 2, 20, '#7c8798', 'center'); return; }
    let lo = 0, hi = 0; c.series.forEach((s) => s.values.forEach((v) => { if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } })); if (hi === lo) hi = lo + 1;
    const ticks = C.niceTicks(lo, hi, 4), t0 = ticks[0], t1 = ticks[ticks.length - 1], px = x + 62, py = y + 14, pw = w - 76, ph = h - 62, Y = (v) => py + ph - ((v - t0) / (t1 - t0 || 1)) * ph;
    g.lineWidth = 1; ticks.forEach((t) => { g.strokeStyle = t === 0 ? '#5b6678' : '#252e3d'; g.beginPath(); g.moveTo(px, Y(t)); g.lineTo(px + pw, Y(t)); g.stroke(); desk.label(g, short(t), px - 8, Y(t), 16, '#aab3c2', 'right'); });
    const n = c.x.length;
    if (c.type === 'bar') {
      const gw = pw / n, bw = Math.min(46, (gw - 10) / c.series.length);
      c.series.forEach((s, si) => { g.fillStyle = COLS[si] || desk.accent(); s.values.forEach((v, i) => { if (!Number.isFinite(v)) return; const bx = px + gw * i + (gw - bw * c.series.length) / 2 + si * bw, y0 = Y(0), y1 = Y(v); g.fillRect(bx, Math.min(y0, y1), bw - 3, Math.max(2, Math.abs(y1 - y0))); }); });
      c.x.forEach((lab, i) => desk.label(g, String(lab), px + gw * i + gw / 2, py + ph + 16, 15, '#aab3c2', 'center', 500, gw - 4));
    } else {
      c.series.forEach((s, si) => { g.strokeStyle = COLS[si] || desk.accent(); g.lineWidth = 3; g.beginPath(); let on = false; s.values.forEach((v, i) => { if (!Number.isFinite(v)) return; const X = px + (n > 1 ? (i / (n - 1)) * pw : pw / 2); if (on) g.lineTo(X, Y(v)); else { g.moveTo(X, Y(v)); on = true; } }); g.stroke(); });
      [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i) => desk.label(g, typeof c.x[i] === 'number' ? short(c.x[i]) : String(c.x[i]), px + (n > 1 ? (i / (n - 1)) * pw : pw / 2), py + ph + 16, 15, '#aab3c2', 'center'));
    }
    let lx = px; c.series.forEach((s, si) => { g.fillStyle = COLS[si] || desk.accent(); g.fillRect(lx, y + h - 20, 14, 10); desk.label(g, s.name, lx + 20, y + h - 14, 15, '#e6eaf1'); g.font = `500 15px ${desk.FF}`; lx += 34 + g.measureText(s.name).width; });
  }

  sheet = desk.addSheet({
    id, title: 'Money tools', W: 1024, H: 640, w: 1.0, h: 0.625, home: { a: -1.72, e: -0.02, r: 1.05, k: 1 }, open: false,
    draw(p, g) {
      desk.base(p, 'Money tools'); const t = byId[st.tool], vals = st.vals[t.id];
      MODES.forEach(([m, n], i) => desk.btn(p, 560 + i * 150, 30, 140, 52, n, id + ':mode', m, { on: st.mode === m, size: 24 }));
      const list = C.TOOLS.filter((x) => x.mode === st.mode); list.forEach((x, i) => desk.btn(p, 36, 104 + i * 54, 250, 46, x.title, id + ':tool', x.id, { on: x.id === t.id, size: x.title.length > 22 ? 16 : 19 }));
      const rows = t.inputs.length, rh = Math.min(52, Math.floor(486 / rows)), bh = Math.min(42, rh - 4), fs = rh < 40 ? 17 : 20;
      t.inputs.forEach((inp, i) => {
        const y = 104 + i * rh; desk.label(g, inp.label, 304, y + bh / 2, fs, '#f1f4f9', 'left', 500, 168);
        desk.btn(p, 478, y, 40, bh, '−', id + ':step', [inp.key, -1], { size: 26 }); desk.btn(p, 522, y, 108, bh, show(inp, vals[inp.key]), id + ':type', inp.key, { size: fs, bg: '#141a24', line: '#3a4456' }); desk.btn(p, 634, y, 40, bh, '+', id + ':step', [inp.key, 1], { size: 26 });
      });
      const out = t.run(vals), head = t.headline(out) || [];
      head.slice(0, 5).forEach((h, i) => { const y = 104 + i * 42; desk.rr(g, 692, y, 300, 38, 9); g.fillStyle = i === 0 ? '#1d2636' : '#171d28'; g.fill(); desk.label(g, String(h.label), 702, y + 19, 16, '#aab3c2', 'left', 500, 150); desk.label(g, String(h.value), 984, y + 19, i === 0 ? 21 : 18, i === 0 ? desk.accent() : '#ffffff', 'right', 700, 140); });
      chart(g, t.chart(out), 692, 322, 300, 248);
      desk.btn(p, 36, 580, 250, 42, 'Reset this tool', id + ':reset', null, { size: 19, bg: '#141a24', line: '#3a4456' });
      desk.label(g, C.DISCLAIMER, 304, 604, 16, '#ffcf7a', 'left', 500, 690);
    },
    act(name, arg) {
      const t = byId[st.tool], vals = st.vals[t.id];
      if (name === 'mode' && MODES.some((m) => m[0] === arg)) { st.mode = arg; st.tool = C.TOOLS.find((x) => x.mode === arg).id; }
      else if (name === 'tool' && byId[arg]) st.tool = arg;
      else if (name === 'step') { const inp = t.inputs.find((i) => i.key === arg[0]); if (inp) vals[inp.key] = C.num(Math.round((vals[inp.key] + arg[1] * inp.step) * 1e6) / 1e6, inp.min, inp.max, inp.dflt); }
      else if (name === 'reset') st.vals[t.id] = dflt(t);
      else if (name === 'type') { const inp = t.inputs.find((i) => i.key === arg); if (!inp) return; desk.askText(inp.label + ' (' + short(inp.min) + ' to ' + short(inp.max) + ')', String(vals[inp.key]), 14, (txt) => { const v = parseFloat(String(txt).replace(/[^0-9.\-]/g, '')); if (Number.isFinite(v)) { vals[inp.key] = C.num(v, inp.min, inp.max, inp.dflt); save(); desk.redraw(sheet); } else if (txt) desk.say('Type a number'); }); return; }
      save(); desk.redraw(sheet);
    },
  });
}

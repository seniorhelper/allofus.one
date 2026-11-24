/* allofus.one · the desk · app sheet: "Paper" — a notebook and vision board. Pencil, pen, marker, highlighter, eraser, flow-chart shapes with arrows,
   several pages and paper kinds. The drawing engine is aou-desk-ink.js (tested on its own); this file handles the tool bar and the pointer.
   While a line is being drawn only its newest piece is painted, so the headset is not asked to repaint the whole page every frame. */
import * as I from './aou-desk-ink.js';

export default function (desk) {
  const id = 'paper', TOP = 132, W = I.PAGE.W, H = I.PAGE.H;
  let doc = I.parse(desk.store.get(id) || ''), sheet = null, tool = 'pen', color = I.COLORS[0], linkFrom = null, saveAt = 0, full = false;
  const hist = I.makeHistory(40), cur = [null, null, null];
  const page = () => doc.pages[doc.page];
  const changed = () => { saveAt = performance.now() + 1500; };
  const redraw = () => { desk.redraw(sheet); };
  desk.onFrame((now) => { if (saveAt && now > saveAt) { saveAt = 0; const ok = desk.store.set(id, I.serialize(doc)); if (!ok && !full) { full = true; desk.say('This notebook is full. Erase or use fewer pages.'); } else if (ok) full = false; } });
  const NAMES = { pencil: 'Pencil', pen: 'Pen', marker: 'Marker', highlighter: 'Highlight', eraser: 'Eraser', hand: 'Move', link: 'Arrow' };
  const PAPER_NAMES = { plain: 'Plain', lined: 'Lined', grid: 'Grid', dots: 'Dots', legal: 'Legal pad', dark: 'Chalkboard' };
  const inkOn = (g, fn) => { g.save(); g.translate(0, TOP); g.beginPath(); g.rect(0, 0, W, H); g.clip(); fn(g); g.restore(); };

  function addShape(type) {
    desk.askText('Words for this shape (you can leave it empty)', '', I.LIMITS.text, (txt) => {
      hist.push(doc); const n = page().shapes.length, s = I.addShape(page(), type, 400 + (n % 5) * 32, 280 + (n % 5) * 32, type === 'note' ? 160 : 192, type === 'note' ? 160 : 96, txt || '', type === 'note' ? '#f2c230' : color);
      if (!s) desk.say('This page has all the shapes it can hold'); tool = 'hand'; changed(); redraw();
    });
  }
  function tidy() {
    const pg = page(), last = pg.strokes[pg.strokes.length - 1], r = last && I.recognize(last); if (!r || !r.type) { desk.say('Draw one shape or line first, then tap Tidy'); return; }
    hist.push(doc); pg.strokes.pop();
    if (r.type === 'line' || r.type === 'arrow') { const s = I.beginStroke(pg, 'pen', last.color, Math.max(3, last.size), r.x1, r.y1); I.addPoint(s, r.x2, r.y2); I.endStroke(pg, s); }
    else I.addShape(pg, r.type, r.x, r.y, Math.max(48, r.w), Math.max(48, r.h), '', last.color);
    changed(); redraw();
  }
  function print() {
    if (desk.presenting) { desk.say('Printing works from a laptop or phone for now', 5000); return; }
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; I.render(c.getContext('2d'), page(), c.width, c.height);
    let box = document.getElementById('dk-print'); if (!box) { box = document.createElement('div'); box.id = 'dk-print'; document.body.appendChild(box); const st = document.createElement('style'); st.textContent = '#dk-print{display:none}@media print{@page{size:landscape;margin:12mm}body>*:not(#dk-print){display:none!important}#dk-print{display:block}#dk-print img{width:100%;height:auto}}'; document.head.appendChild(st); }
    box.textContent = ''; const img = document.createElement('img'); img.alt = 'Page ' + (doc.page + 1) + ' from your desk notebook'; img.onload = () => window.print(); img.src = c.toDataURL('image/png'); box.appendChild(img);
  }

  sheet = desk.addSheet({
    id, title: 'Paper', W, H: TOP + H, w: 1.0, h: (TOP + H) / W, home: { a: 1.2, e: 0, r: 1.05, k: 1, flat: true }, open: true,
    draw(p, g) {
      desk.base(p); const b = (x, y, w, label, act, arg, on, size) => desk.btn(p, x, y, w, 50, label, id + ':' + act, arg, { on, size: size || 19 });
      ['pencil', 'pen', 'marker', 'highlighter', 'eraser', 'hand', 'link'].forEach((t, i) => b(10 + i * 90, 10, 84, NAMES[t], 'tool', t, tool === t, 18));
      b(644, 10, 70, 'Undo', 'undo', null, false, 18); b(718, 10, 70, 'Redo', 'redo', null, false, 18); b(792, 10, 62, 'Tidy', 'tidy', null, false, 17); b(858, 10, 62, 'Print', 'print', null, false, 17); b(924, 10, 90, desk.isFlat(id) ? 'Stand up' : 'Lay flat', 'flat', null, desk.isFlat(id), 16);
      I.COLORS.forEach((c, i) => { const x = 10 + i * 43; desk.rr(g, x, 70, 38, 50, 10); g.fillStyle = c; g.fill(); g.lineWidth = color === c ? 5 : 2; g.strokeStyle = color === c ? '#ffffff' : '#3a4456'; g.stroke(); p.regions.push({ x, y: 70, w: 38, h: 50, act: id + ':color', arg: i }); });
      [['box', 'Box'], ['round', 'Round'], ['diamond', 'Choice'], ['note', 'Sticky']].forEach(([t, n], i) => b(446 + i * 76, 70, 70, n, 'shape', t, false, 17));
      b(752, 70, 130, PAPER_NAMES[page().paper], 'paper', null, false, 17); b(888, 70, 36, '‹', 'page', -1, false, 26); desk.label(g, (doc.page + 1) + '/' + doc.pages.length, 949, 96, 19, '#ffffff', 'center', 700); b(974, 70, 40, doc.page === doc.pages.length - 1 ? '+' : '›', 'page', 1, false, 26);
      inkOn(g, (c) => I.render(c, page(), W, H));
      if (linkFrom) { g.fillStyle = 'rgba(14,18,25,0.85)'; g.fillRect(0, TOP, W, 40); desk.label(g, 'Now tap the shape the arrow should point to', W / 2, TOP + 20, 20, '#ffffff', 'center', 700); }
    },
    act(name, arg) {
      if (name === 'tool') { tool = arg; linkFrom = null; }
      else if (name === 'color' && I.COLORS[arg]) { color = I.COLORS[arg]; if (tool === 'eraser' || tool === 'hand' || tool === 'link') tool = 'pen'; }
      else if (name === 'undo') { if (!hist.undo(doc)) desk.say('Nothing to undo'); changed(); }
      else if (name === 'redo') { if (!hist.redo(doc)) desk.say('Nothing to redo'); changed(); }
      else if (name === 'tidy') { tidy(); return; }
      else if (name === 'print') { print(); return; }
      else if (name === 'flat') { desk.flat(id); }
      else if (name === 'shape') { addShape(arg); return; }
      else if (name === 'paper') { hist.push(doc); const k = I.PAPERS; I.setPaper(page(), k[(k.indexOf(page().paper) + 1) % k.length]); changed(); }
      else if (name === 'page') { if (arg > 0 && doc.page === doc.pages.length - 1) { if (I.addPage(doc, page().paper) < 0) desk.say('The notebook holds ' + I.LIMITS.pages + ' pages'); else { hist.clear(); changed(); } } else I.gotoPage(doc, doc.page + arg); linkFrom = null; }
      redraw();
    },
    /* the pointer on the page: i = which hand (2 = mouse or touch), down = pen on paper, end = pointer left the sheet */
    point(p, i, x, y, down, end) {
      const px = x, py = y - TOP, st = cur[i], pg = page();
      if (end || !down || py < 0) { if (st && st.stroke) { inkOn(p.g, (c) => I.drawSegment(c, st.stroke, st.from, true)); desk.touch(p); const r = I.endStroke(pg, st.stroke); if (r && r.ok === false && r.reason && r.reason !== 'empty') desk.say('This page is full. Start a new page.'); changed(); } cur[i] = null; return; }
      if (!st) {
        if (tool === 'eraser') { hist.push(doc); cur[i] = { erase: true }; }
        else if (tool === 'hand') { const s = I.shapeAt(pg, px, py); if (s) { hist.push(doc); cur[i] = { move: s.id, dx: px - s.x, dy: py - s.y }; } else cur[i] = { idle: true }; return; }
        else if (tool === 'link') { const s = I.shapeAt(pg, px, py); cur[i] = { idle: true }; if (!s) { linkFrom = null; redraw(); return; } if (!linkFrom) linkFrom = s.id; else { hist.push(doc); I.connect(pg, linkFrom, s.id, ''); linkFrom = null; changed(); } redraw(); return; }
        else { if (pg.strokes.length >= I.LIMITS.strokes) { cur[i] = { idle: true }; desk.say('This page is full. Start a new page.'); return; } hist.push(doc); cur[i] = { stroke: I.beginStroke(pg, tool, color, I.TOOLS[tool].size, px, py), from: 0 }; return; }
      }
      const s = cur[i];
      if (s.stroke) { if (I.addPoint(s.stroke, px, py)) { inkOn(p.g, (c) => { s.from = I.drawSegment(c, s.stroke, s.from, false); }); desk.touch(p); } }
      else if (s.erase) { if (I.eraseAt(pg, px, py, 18) || I.shapeAt(pg, px, py) && I.removeShape(pg, I.shapeAt(pg, px, py).id)) { changed(); redraw(); } }
      else if (s.move) { const sh = I.findShape(pg, s.move), ox = sh && sh.x, oy = sh && sh.y; if (sh && I.moveShape(pg, s.move, px - s.dx, py - s.dy) && (sh.x !== ox || sh.y !== oy)) { changed(); redraw(); } }
    },
  });
}

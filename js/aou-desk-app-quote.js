/* allofus.one · the desk · app sheet: "Quote" — one short line of encouragement at a time. The list is loaded from this site only.
   Older quotes are public domain with a checked source; lines by "The Desk" were written for this product. */
export default function (desk) {
  const id = 'quote'; let list = [], i = 0, nextAt = 0, sheet = null, state = 'loading';
  const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : '');
  try { const raw = JSON.parse(desk.store.get(id) || 'null'); if (raw && Number.isFinite(+raw.i)) i = Math.max(0, +raw.i | 0); } catch (e) { }
  const show = (n) => { if (!list.length) return; i = ((n % list.length) + list.length) % list.length; nextAt = performance.now() + 15 * 60000; desk.store.set(id, JSON.stringify({ i })); desk.redraw(sheet); };
  fetch('/desk/quotes.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('quotes')))).then((a) => {
    /* treat the file as untrusted: keep only short plain strings */
    list = (Array.isArray(a) ? a : []).slice(0, 400).map((x) => ({ q: str(x && x.q, 220), by: str(x && x.by, 60), work: str(x && x.work, 80), year: Number.isFinite(+(x && x.year)) ? (+x.year | 0) : 0 })).filter((x) => x.q && x.by);
    state = list.length ? 'ok' : 'none'; if (list.length) { if (!desk.store.get(id)) i = Math.floor(Date.now() / 86400000) % list.length; show(i); } else desk.redraw(sheet);
  }).catch(() => { state = 'none'; desk.redraw(sheet); });
  desk.onFrame((now) => { if (nextAt && now > nextAt && list.length && desk.S.sheets[id] && desk.S.sheets[id].open) show(i + 1); });
  sheet = desk.addSheet({
    id, title: 'Quote', W: 768, H: 288, w: 0.74, h: 0.2775, home: { a: 0, e: 0.6, r: 1.45, k: 1 }, open: true,
    draw(p, g) {
      desk.base(p); if (state !== 'ok') { desk.label(g, state === 'loading' ? 'Finding a good line…' : 'Quotes could not load. Check the connection.', 384, 144, 24, '#aab3c2', 'center'); return; }
      const x = list[i]; let size = 30; g.font = `600 ${size}px ${desk.FF}`; let lines = desk.L.wrap('“' + x.q + '”', 700, (s) => g.measureText(s).width, 9);
      if (lines.length > 4) { size = 24; g.font = `600 ${size}px ${desk.FF}`; lines = desk.L.wrap('“' + x.q + '”', 700, (s) => g.measureText(s).width, 6); }
      const lh = size + 8, y0 = 26 + (170 - lines.length * lh) / 2 + lh / 2; lines.forEach((ln, k) => desk.label(g, ln, 384, y0 + k * lh, size, '#ffffff', 'center', 600));
      const src = x.by + (x.work ? ', ' + x.work : '') + (x.year && x.work ? ' (' + x.year + ')' : ''); desk.label(g, '— ' + src, 36, 250, 20, desk.accent(), 'left', 700, 540);
      desk.btn(p, 596, 228, 64, 44, '‹', id + ':go', -1, { size: 28 }); desk.btn(p, 668, 228, 64, 44, '›', id + ':go', 1, { size: 28 });
    },
    act(name, arg) { if (name === 'go') show(i + (arg < 0 ? -1 : 1)); },
  });
}

/* allofus.one · the desk · ink engine (pure: no DOM, no timers, no randomness).
   Data model, geometry, drawing onto a 2D context that the caller passes in, undo, and safe save/load.
   Page space is canvas pixels, 1024 x 768. Drawing is incremental: a live stroke paints only its newest piece,
   and the whole page is redrawn (render) only on undo, erase, page change or load. Everything read from
   storage is validated and clamped in parse() before any other code sees it. */

export const PAGE = { W: 1024, H: 768 };
export const LIMITS = { pages: 12, strokes: 400, points: 600, shapes: 60, links: 80, text: 80 };
export const PAPERS = ['plain', 'lined', 'grid', 'dots', 'legal', 'dark'];
/* each tool: default size (px), alpha, and its line style (cap, join, dash). The eraser makes no ink; size is its radius * 2. */
export const TOOLS = {
  pencil: { size: 2, alpha: 0.78, cap: 'butt', join: 'round', dash: [] },
  pen: { size: 3, alpha: 1, cap: 'round', join: 'round', dash: [] },
  marker: { size: 10, alpha: 0.95, cap: 'round', join: 'round', dash: [] },
  highlighter: { size: 22, alpha: 0.35, cap: 'butt', join: 'round', dash: [] },
  eraser: { size: 24, alpha: 1, cap: 'round', join: 'round', dash: [] },
};
export const COLORS = ['#2b2f36', '#e03b3b', '#f08a24', '#f2c230', '#3aa655', '#1fa9a0', '#2f7de1', '#6a4fd6', '#d94fa3', '#f4f1e8'];
export const SHAPE_TYPES = ['box', 'round', 'diamond', 'ellipse', 'note', 'text'];

const INK_TOOLS = ['pencil', 'pen', 'marker', 'highlighter']; /* tools that leave a stroke; index = saved code */
const SNAP = 16, MIN_SHAPE = 32, CORNER = 20, MIN_DIST2 = 4, TOLERANCE = 1.2, MAX_TEXT = 6e6, GRID = 32;
const TEXT_COLOR = '#1d2430';

/* ---------- small safe helpers ---------- */
const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampInt = (v, a, b, d) => { v = fin(v, NaN); return Number.isNaN(v) ? d : Math.min(b, Math.max(a, Math.round(v))); };
const cleanText = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
const hexOr = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const pickOf = (v, list, d) => (list.includes(v) ? v : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function segDist2(px, py, ax, ay, bx, by) { /* squared distance from a point to a segment */
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qy = ay + t * dy - py; return qx * qx + qy * qy;
}

/* ---------- document model ---------- */
export function newPage(paper = 'lined') { return { paper: pickOf(paper, PAPERS, 'lined'), strokes: [], shapes: [], links: [] }; }
export function newDoc() { return { v: 1, page: 0, pages: [newPage('lined')] }; }

/* ---------- paper ---------- */
const PAPER_BG = { plain: '#faf8f1', lined: '#fbfaf3', grid: '#fbfbf7', dots: '#fbfaf3', legal: '#fff3a6', dark: '#1f2933' };
function rules(ctx, W, H, color, stepX, stepY, y0) { /* all rules in ONE path, one stroke */
  ctx.beginPath();
  if (stepY) for (let y = y0; y < H; y += stepY) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  if (stepX) for (let x = stepX; x < W; x += stepX) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  ctx.lineWidth = 1; ctx.strokeStyle = color; ctx.stroke();
}
function vline(ctx, x, H, color, width) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); }
export function drawPaper(ctx, W, H, kind) {
  const k = pickOf(kind, PAPERS, 'plain');
  ctx.save(); ctx.globalAlpha = 1; if (ctx.setLineDash) ctx.setLineDash([]);
  ctx.fillStyle = PAPER_BG[k]; ctx.fillRect(0, 0, W, H);
  if (k === 'lined') { rules(ctx, W, H, '#a9c3e8', 0, GRID, 96); vline(ctx, 96, H, '#e58f8f', 2); }
  else if (k === 'legal') { rules(ctx, W, H, '#7ea6cf', 0, GRID, 96); vline(ctx, 84, H, '#d8574f', 1.5); vline(ctx, 90, H, '#d8574f', 1.5); }
  else if (k === 'grid') rules(ctx, W, H, '#c5d3e6', GRID, GRID, GRID);
  else if (k === 'dots') { ctx.fillStyle = '#9aa7b8'; for (let y = GRID; y < H; y += GRID) for (let x = GRID; x < W; x += GRID) ctx.fillRect(x - 1, y - 1, 2, 2); }
  ctx.restore();
}

/* ---------- strokes ---------- */
export function beginStroke(page, tool, color, size, x, y) {
  const t = Object.keys(TOOLS).includes(tool) ? tool : 'pen';
  return { tool: t, color: hexOr(color, COLORS[0]), size: clampInt(size, 1, 40, TOOLS[t].size), pts: [clampInt(x, 0, PAGE.W, 0), clampInt(y, 0, PAGE.H, 0)] };
}
/* returns true when a point was added: ignores bad numbers, points closer than 2 px, and anything past the point cap */
export function addPoint(stroke, x, y) {
  const p = stroke.pts; x = fin(x, NaN); y = fin(y, NaN);
  if (Number.isNaN(x) || Number.isNaN(y) || p.length >= LIMITS.points * 2) return false;
  x = clampInt(x, 0, PAGE.W, 0); y = clampInt(y, 0, PAGE.H, 0);
  const dx = x - p[p.length - 2], dy = y - p[p.length - 1];
  if (dx * dx + dy * dy < MIN_DIST2) return false;
  p.push(x, y); return true;
}
/* Ramer-Douglas-Peucker on a flat [x0,y0,x1,y1,...] list. Endpoints are kept; every dropped point lies within eps of the result. */
export function simplify(pts, eps) {
  const n = pts.length >> 1; if (n < 3) return pts.slice();
  const keep = new Uint8Array(n), stack = [0, n - 1], e2 = eps * eps; keep[0] = keep[n - 1] = 1;
  while (stack.length) {
    const hi = stack.pop(), lo = stack.pop(); let best = -1, bd = e2;
    for (let i = lo + 1; i < hi; i++) { const d = segDist2(pts[2 * i], pts[2 * i + 1], pts[2 * lo], pts[2 * lo + 1], pts[2 * hi], pts[2 * hi + 1]); if (d > bd) { bd = d; best = i; } }
    if (best >= 0) { keep[best] = 1; stack.push(lo, best, best, hi); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]); return out;
}
/* finish a stroke: simplify it and store it on the page. Returns { ok: true, stroke } or { ok: false, reason: 'empty' | 'full' | 'eraser' }.
   A stroke with one point is a dot and is kept. */
export function endStroke(page, stroke) {
  if (!stroke || !Array.isArray(stroke.pts) || stroke.pts.length < 2) return { ok: false, reason: 'empty' };
  if (!INK_TOOLS.includes(stroke.tool)) return { ok: false, reason: 'eraser' };
  if (page.strokes.length >= LIMITS.strokes) return { ok: false, reason: 'full' };
  stroke.pts = simplify(stroke.pts, TOLERANCE); page.strokes.push(stroke); return { ok: true, stroke };
}

function inkStyle(ctx, s) {
  const t = TOOLS[s.tool];
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.size; ctx.globalAlpha = t.alpha;
  ctx.lineCap = t.cap; ctx.lineJoin = t.join; if (ctx.setLineDash) ctx.setLineDash(t.dash);
}
/* Midpoint smoothing: the path is moveTo(p0), then a quadratic curve for each point k (control p[k], ending at the midpoint of p[k] and p[k+1]),
   then one closing line to the last point. "Pieces" are numbered by k: curves are k = 1..n-2 and the closing line is piece n-1.
   drawSegment paints pieces from `from` onward and returns the next piece number to pass back in. While a stroke is live call it with last=false
   (it paints up to the newest midpoint; the half-segment tail is drawn later); when the pen lifts call it once with last=true.
   Painted piece by piece, the curves and lines are exactly the ones drawStroke paints in one go; only the beginPath/moveTo/stroke seams differ,
   and the curves join smoothly there (the tools whose ink is translucent use flat caps, so seams do not double up). */
export function drawSegment(ctx, stroke, from, last) {
  const p = stroke.pts, n = p.length >> 1; from = Math.max(0, from | 0);
  if (!INK_TOOLS.includes(stroke.tool) || n === 0) return from;
  if (n === 1) { /* a dot */
    if (!last) return 0;
    if (from === 0) { ctx.save(); inkStyle(ctx, stroke); ctx.beginPath(); ctx.arc(p[0], p[1], stroke.size / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    return 1;
  }
  let k = Math.max(1, from); const endK = last ? n - 1 : n - 2;
  if (k > endK) return k;
  ctx.save(); inkStyle(ctx, stroke); ctx.beginPath();
  if (k === 1) ctx.moveTo(p[0], p[1]); else ctx.moveTo((p[2 * k - 2] + p[2 * k]) / 2, (p[2 * k - 1] + p[2 * k + 1]) / 2);
  for (; k <= endK; k++) {
    if (k <= n - 2) ctx.quadraticCurveTo(p[2 * k], p[2 * k + 1], (p[2 * k] + p[2 * k + 2]) / 2, (p[2 * k + 1] + p[2 * k + 3]) / 2);
    else ctx.lineTo(p[2 * n - 2], p[2 * n - 1]);
  }
  ctx.stroke(); ctx.restore(); return k;
}
export function drawStroke(ctx, stroke) { drawSegment(ctx, stroke, 0, true); }
/* the box (page pixels) that a drawSegment call from `from` can touch, so the caller can upload only that part of a texture */
export function segmentBounds(stroke, from) {
  const p = stroke.pts, a = Math.max(0, ((from | 0) - 2)) * 2; if (p.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = Math.min(a, p.length - 2); i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  const pad = Math.ceil(stroke.size / 2) + 2; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  return { x: x0, y: y0, w: Math.min(PAGE.W, x1 + pad) - x0, h: Math.min(PAGE.H, y1 + pad) - y0 };
}

/* ---------- eraser ---------- */
/* removes every whole stroke whose path (including the straight run between two far-apart points) passes within `radius` of (x, y) */
export function eraseAt(page, x, y, radius) {
  x = fin(x, NaN); y = fin(y, NaN); if (Number.isNaN(x) || Number.isNaN(y)) return 0;
  const r2 = Math.pow(Math.min(200, Math.max(1, fin(radius, 8))), 2), before = page.strokes.length;
  page.strokes = page.strokes.filter((s) => {
    const p = s.pts, n = p.length >> 1;
    if (n === 1) return !(((p[0] - x) ** 2 + (p[1] - y) ** 2) <= r2);
    for (let i = 1; i < n; i++) if (segDist2(x, y, p[2 * i - 2], p[2 * i - 1], p[2 * i], p[2 * i + 1]) <= r2) return false;
    return true;
  });
  return before - page.strokes.length;
}

/* ---------- flow-chart shapes and links ---------- */
const snap = (v) => Math.round(v / SNAP) * SNAP;
function fitRect(x, y, w, h) { /* snap to the grid, then keep it on the page */
  w = Math.min(PAGE.W, Math.max(MIN_SHAPE, snap(fin(w, MIN_SHAPE)))); h = Math.min(PAGE.H, Math.max(MIN_SHAPE, snap(fin(h, MIN_SHAPE))));
  return { x: Math.min(PAGE.W - w, Math.max(0, snap(fin(x, 0)))), y: Math.min(PAGE.H - h, Math.max(0, snap(fin(y, 0)))), w, h };
}
export const findShape = (page, id) => page.shapes.find((s) => s.id === id) || null;
function newId(page) { let m = 0; for (const s of page.shapes) { const k = /^s(\d{1,6})$/.exec(s.id); if (k) m = Math.max(m, +k[1]); } return 's' + (m + 1); }
export function addShape(page, type, x, y, w, h, text, color) {
  if (!SHAPE_TYPES.includes(type) || page.shapes.length >= LIMITS.shapes) return null;
  const s = { id: newId(page), type, ...fitRect(x, y, w, h), text: cleanText(text, LIMITS.text), color: hexOr(color, COLORS[6]) };
  page.shapes.push(s); return s;
}
export function moveShape(page, id, x, y) { const s = findShape(page, id); if (!s) return false; const r = fitRect(x, y, s.w, s.h); s.x = r.x; s.y = r.y; return true; }
export function resizeShape(page, id, w, h) { const s = findShape(page, id); if (!s) return false; Object.assign(s, fitRect(s.x, s.y, w, h)); return true; }
export function setShapeText(page, id, text) { const s = findShape(page, id); if (!s) return false; s.text = cleanText(text, LIMITS.text); return true; }
/* the top-most shape under a point (later shapes sit on top), or null */
export function shapeAt(page, x, y) {
  for (let i = page.shapes.length - 1; i >= 0; i--) {
    const s = page.shapes[i], hw = s.w / 2, hh = s.h / 2, u = Math.abs(x - s.x - hw) / hw, v = Math.abs(y - s.y - hh) / hh;
    if (s.type === 'ellipse' ? u * u + v * v <= 1 : s.type === 'diamond' ? u + v <= 1 : u <= 1 && v <= 1) return s;
  }
  return null;
}
/* removing a shape removes every link that touches it */
export function removeShape(page, id) {
  const n = page.shapes.length; page.shapes = page.shapes.filter((s) => s.id !== id);
  page.links = page.links.filter((l) => l.from !== id && l.to !== id); return page.shapes.length < n;
}
/* an arrow from one shape to another: both must exist, no self-links, no repeats of the same direction, link cap enforced */
export function connect(page, fromId, toId, label) {
  if (fromId === toId || !findShape(page, fromId) || !findShape(page, toId) || page.links.length >= LIMITS.links) return null;
  if (page.links.some((l) => l.from === fromId && l.to === toId)) return null;
  const l = { from: fromId, to: toId, label: cleanText(label, LIMITS.text) }; page.links.push(l); return l;
}
/* distance from a shape's centre to its outline along the unit direction (dx, dy). Exact for box, diamond, ellipse and the rounded box. */
function edgeDist(s, dx, dy) {
  const hw = s.w / 2, hh = s.h / 2, ax = Math.abs(dx), ay = Math.abs(dy);
  if (s.type === 'ellipse') return 1 / Math.sqrt((ax * ax) / (hw * hw) + (ay * ay) / (hh * hh));
  if (s.type === 'diamond') return 1 / (ax / hw + ay / hh);
  let t = Math.min(ax > 1e-9 ? hw / ax : Infinity, ay > 1e-9 ? hh / ay : Infinity);
  if (s.type === 'round') { /* near a corner the outline is a circle of radius r: take the far root of the ray-circle equation */
    const r = Math.min(CORNER, hw, hh), cx = hw - r, cy = hh - r;
    if (ax * t > cx && ay * t > cy) { const b = ax * cx + ay * cy; t = b + Math.sqrt(Math.max(0, b * b - (cx * cx + cy * cy - r * r))); }
  }
  return t;
}
/* the arrow's two ends: on each shape's outline, along the line between the two centres. null if a shape is missing. */
export function linkPath(page, link) {
  const a = link && findShape(page, link.from), b = link && findShape(page, link.to); if (!a || !b) return null;
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  let dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy);
  if (d < 1e-6) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
  const ta = edgeDist(a, dx, dy), tb = edgeDist(b, -dx, -dy);
  return { x1: ax + dx * ta, y1: ay + dy * ta, x2: bx - dx * tb, y2: by - dy * tb };
}

function shapePath(ctx, s) {
  const { x, y, w, h } = s; ctx.beginPath();
  if (s.type === 'ellipse') { ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return; }
  if (s.type === 'diamond') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); return; }
  const r = s.type === 'round' ? Math.min(CORNER, w / 2, h / 2) : 0;
  if (!r) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); return; }
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r); ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); ctx.closePath();
}
function tint(hex, k) { const n = parseInt(hex.slice(1), 16); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * k).toString(16).padStart(2, '0')).join(''); }
function wrapText(ctx, text, maxW, px) { /* greedy word wrap; a word wider than the line is cut */
  const mw = (s) => (ctx.measureText ? ctx.measureText(s).width : s.length * px * 0.55), lines = []; let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (mw(w) > maxW && w.length > 1) { let cut = w.length - 1; while (cut > 1 && mw(w.slice(0, cut)) > maxW) cut--; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, cut)); w = w.slice(cut); }
    const t = cur ? cur + ' ' + w : w;
    if (!cur || mw(t) <= maxW) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur); return lines;
}
function drawLabel(ctx, text, cx, cy, aw, ah, color) { /* centred wrapped text; the font shrinks (20, 16, 13 px) until it fits */
  if (!text) return;
  let lines = [], size = 20;
  for (const f of [20, 16, 13]) { size = f; ctx.font = 'bold ' + f + 'px sans-serif'; lines = wrapText(ctx, text, aw, f); if (lines.length * f * 1.2 <= ah) break; }
  const lh = size * 1.2; lines = lines.slice(0, Math.max(1, Math.floor(ah / lh)));
  ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, cx, cy - ((lines.length - 1) * lh) / 2 + i * lh));
}
export function drawShape(ctx, s) {
  ctx.save(); if (ctx.setLineDash) ctx.setLineDash([]);
  if (s.type !== 'text') {
    shapePath(ctx, s); ctx.globalAlpha = 0.94; ctx.fillStyle = s.type === 'note' ? tint(s.color, 0.72) : '#fffdf5'; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = s.color; ctx.stroke();
  }
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const area = s.type === 'diamond' ? [s.w * 0.55, s.h * 0.55] : s.type === 'ellipse' ? [s.w * 0.7, s.h * 0.7] : s.type === 'round' ? [s.w - 28, s.h - 12] : [s.w - 16, s.h - 12];
  drawLabel(ctx, s.text, cx, cy, Math.max(8, area[0]), Math.max(8, area[1]), s.type === 'text' ? s.color : TEXT_COLOR);
  ctx.restore();
}
export function drawLink(ctx, page, link) {
  const q = linkPath(page, link); if (!q) return;
  const ink = page.paper === 'dark' ? '#e8e6df' : '#3a4150', ang = Math.atan2(q.y2 - q.y1, q.x2 - q.x1), head = 14, bx = q.x2 - Math.cos(ang) * head * 0.7, by = q.y2 - Math.sin(ang) * head * 0.7;
  ctx.save(); ctx.globalAlpha = 1; if (ctx.setLineDash) ctx.setLineDash([]);
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(q.x1, q.y1); ctx.lineTo(bx, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(q.x2, q.y2);
  ctx.lineTo(q.x2 - Math.cos(ang - 0.45) * head, q.y2 - Math.sin(ang - 0.45) * head); ctx.lineTo(q.x2 - Math.cos(ang + 0.45) * head, q.y2 - Math.sin(ang + 0.45) * head); ctx.closePath(); ctx.fill();
  if (link.label) {
    ctx.font = 'bold 14px sans-serif'; const mx = (q.x1 + q.x2) / 2, my = (q.y1 + q.y2) / 2, tw = ctx.measureText ? ctx.measureText(link.label).width : link.label.length * 8;
    ctx.fillStyle = page.paper === 'dark' ? '#1f2933' : '#fffdf5'; ctx.fillRect(mx - tw / 2 - 4, my - 10, tw + 8, 20);
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(link.label, mx, my);
  }
  ctx.restore();
}

/* ---------- shape recogniser ---------- */
function thin(p, minD) { /* drop points closer than minD to the last kept one (always keep the last point) */
  const q = [[p[0], p[1]]];
  for (let i = 2; i + 1 < p.length; i += 2) { const l = q[q.length - 1]; if (Math.hypot(p[i] - l[0], p[i + 1] - l[1]) >= minD) q.push([p[i], p[i + 1]]); }
  const e = [p[p.length - 2], p[p.length - 1]], l = q[q.length - 1];
  if (e[0] !== l[0] || e[1] !== l[1]) q.push(e); return q;
}
function resample(q, N) { /* N points evenly spaced along the path (the end point is left out so a closed loop does not repeat) */
  const d = [0]; for (let i = 1; i < q.length; i++) d.push(d[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const out = []; let j = 1;
  for (let k = 0; k < N; k++) {
    const t = (d[d.length - 1] * k) / N; while (j < q.length - 1 && d[j] < t) j++;
    const u = (t - d[j - 1]) / (d[j] - d[j - 1] || 1); out.push([q[j - 1][0] + (q[j][0] - q[j - 1][0]) * u, q[j - 1][1] + (q[j][1] - q[j - 1][1]) * u]);
  }
  return out;
}
/* A straight stroke is a line. A straight stroke that ends in a short hook back toward its start is an arrow. Otherwise null. */
function lineOrArrow(q, len) {
  const n = q.length; let a = 0, far = 0;
  for (let i = 1; i < n; i++) { const d = Math.hypot(q[i][0] - q[0][0], q[i][1] - q[0][1]); if (d > far) { far = d; a = i; } } /* a = the point farthest from the start */
  if (far < 30) return null;
  let shaft = 0, dev = 0;
  for (let i = 1; i <= a; i++) { shaft += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); dev = Math.max(dev, Math.sqrt(segDist2(q[i][0], q[i][1], q[0][0], q[0][1], q[a][0], q[a][1]))); }
  if (dev > Math.max(5, 0.07 * far) || shaft > 1.2 * far) return null; /* not straight enough */
  const tail = len - shaft, S = q[0], A = q[a], E = q[n - 1];
  if (a === n - 1 || tail < 0.08 * far) return { type: 'line', x1: S[0], y1: S[1], x2: A[0], y2: A[1] };
  const chord = Math.hypot(E[0] - A[0], E[1] - A[1]); if (chord < 0.1 * far || chord > 0.5 * far || tail > 1.4 * chord) return null;
  const cos = ((S[0] - A[0]) * (E[0] - A[0]) + (S[1] - A[1]) * (E[1] - A[1])) / (far * chord);
  return cos >= 0.42 ? { type: 'arrow', x1: S[0], y1: S[1], x2: A[0], y2: A[1] } : null; /* hook must point back within about 65 degrees */
}
/* Guess what a hand-drawn stroke was meant to be. Returns { type, x, y, w, h, x1, y1, x2, y2 } or null when unsure.
   line/arrow: x1,y1 is the start and x2,y2 the tip. box/ellipse/diamond: x,y,w,h is the bounding box (x1..y2 are its corners).
   Closed shapes: the path must nearly close, be about one loop long, then each of three outlines is scored by how far the path wanders
   from it in bounding-box units (0 = perfect). The best must score under 0.10 and beat the runner-up by 0.04, otherwise null. */
export function recognize(stroke) {
  const p = stroke && stroke.pts; if (!Array.isArray(p) || p.length < 12) return null;
  const q = thin(p, 5), n = q.length; if (n < 5) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, len = 0;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, q[i][0]); x1 = Math.max(x1, q[i][0]); y0 = Math.min(y0, q[i][1]); y1 = Math.max(y1, q[i][1]); if (i) len += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); }
  const bw = x1 - x0, bh = y1 - y0, diag = Math.hypot(bw, bh); if (len < 30 || diag < 24) return null;
  const R = Math.round, out = (type, a, b, c, d) => ({ type, x: R(x0), y: R(y0), w: R(bw), h: R(bh), x1: R(a), y1: R(b), x2: R(c), y2: R(d) });
  const ln = lineOrArrow(q, len); if (ln) return out(ln.type, ln.x1, ln.y1, ln.x2, ln.y2);
  if (Math.hypot(q[n - 1][0] - q[0][0], q[n - 1][1] - q[0][1]) > 0.25 * diag || bw < 20 || bh < 20) return null; /* must be closed and not paper-thin */
  const ratio = len / (2 * (bw + bh)); if (ratio < 0.65 || ratio > 1.4) return null; /* about one loop: a box is 1.0, an ellipse 0.79, a diamond 0.71, a double circle 1.6 */
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = resample(q, 48); let eE = 0, eB = 0, eD = 0;
  for (const [x, y] of r) { const u = Math.abs(x - cx) / (bw / 2), v = Math.abs(y - cy) / (bh / 2); eE += Math.abs(Math.hypot(u, v) - 1); eB += Math.abs(Math.max(u, v) - 1); eD += Math.abs(u + v - 1); }
  const s = [['ellipse', eE / 48], ['box', eB / 48], ['diamond', eD / 48]].sort((a, b) => a[1] - b[1]);
  if (s[0][1] > 0.1 || s[1][1] - s[0][1] < 0.04) return null;
  return out(s[0][0], x0, y0, x1, y1);
}

/* ---------- whole page ---------- */
export function render(ctx, page, W, H) {
  W = fin(W, PAGE.W) > 0 ? fin(W, PAGE.W) : PAGE.W; H = fin(H, PAGE.H) > 0 ? fin(H, PAGE.H) : PAGE.H;
  ctx.save();
  if ((W !== PAGE.W || H !== PAGE.H) && ctx.scale) ctx.scale(W / PAGE.W, H / PAGE.H); /* page space stays 1024 x 768 */
  drawPaper(ctx, PAGE.W, PAGE.H, page.paper);
  for (const s of page.strokes) drawStroke(ctx, s);
  for (const l of page.links) drawLink(ctx, page, l);
  for (const s of page.shapes) drawShape(ctx, s);
  ctx.restore();
}

/* ---------- pages ---------- */
export function addPage(doc, paper) { if (doc.pages.length >= LIMITS.pages) return -1; doc.pages.push(newPage(paper)); doc.page = doc.pages.length - 1; return doc.page; }
export function gotoPage(doc, i) { doc.page = clampInt(i, 0, doc.pages.length - 1, doc.page); return doc.page; }
export function removePage(doc, i) {
  if (doc.pages.length <= 1 || !Number.isInteger(i) || i < 0 || i >= doc.pages.length) return false;
  doc.pages.splice(i, 1); if (doc.page > i) doc.page--; if (doc.page >= doc.pages.length) doc.page = doc.pages.length - 1; return true;
}
export function setPaper(page, kind) { if (!PAPERS.includes(kind)) return false; page.paper = kind; return true; }

/* ---------- save format: points are delta-coded, zigzag, in base-64 digits (5 data bits + a "more" bit), so a typical point costs 2 characters ---------- */
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CODE = new Int8Array(128).fill(-1); for (let i = 0; i < 64; i++) CODE[DIGITS.charCodeAt(i)] = i;
function varint(d) { let z = d < 0 ? -2 * d - 1 : 2 * d, s = ''; while (z >= 32) { s += DIGITS[32 | (z & 31)]; z = Math.floor(z / 32); } return s + DIGITS[z]; }
function encodePts(pts) { let s = '', px = 0, py = 0; for (let i = 0; i + 1 < pts.length; i += 2) { s += varint(pts[i] - px) + varint(pts[i + 1] - py); px = pts[i]; py = pts[i + 1]; } return s; }
function decodePts(s) { /* null if the data is broken; stops at the point cap */
  const out = []; let x = 0, y = 0, v = 0, mul = 1, axis = 0;
  for (let i = 0; i < s.length && out.length < LIMITS.points * 2; i++) {
    const c = s.charCodeAt(i) < 128 ? CODE[s.charCodeAt(i)] : -1; if (c < 0) return null;
    v += (c & 31) * mul; if (c & 32) { mul *= 32; if (mul > 32 ** 4) return null; continue; }
    const d = v % 2 ? -(v + 1) / 2 : v / 2; v = 0; mul = 1;
    if (axis === 0) x = clampInt(x + d, 0, PAGE.W, 0); else { y = clampInt(y + d, 0, PAGE.H, 0); out.push(x, y); }
    axis ^= 1;
  }
  return mul === 1 && out.length >= 2 ? out : null;
}
function pageToArr(p) {
  return [p.paper,
    p.strokes.filter((s) => INK_TOOLS.includes(s.tool)).map((s) => [INK_TOOLS.indexOf(s.tool), hexOr(s.color, COLORS[0]).slice(1), s.size, encodePts(s.pts)]),
    p.shapes.map((s) => [s.id, SHAPE_TYPES.indexOf(s.type), s.x, s.y, s.w, s.h, s.text, hexOr(s.color, COLORS[6]).slice(1)]),
    p.links.map((l) => [l.from, l.to, l.label])];
}
function arrToPage(g) { /* validates and clamps one saved page; null if it is not a page at all */
  if (!Array.isArray(g)) return null;
  const page = newPage(pickOf(g[0], PAPERS, 'lined'));
  if (Array.isArray(g[1])) for (const s of g[1]) {
    if (page.strokes.length >= LIMITS.strokes) break;
    if (!Array.isArray(s) || !Number.isInteger(s[0]) || s[0] < 0 || s[0] >= INK_TOOLS.length || typeof s[3] !== 'string') continue;
    const pts = decodePts(s[3]); if (!pts) continue;
    const tool = INK_TOOLS[s[0]];
    page.strokes.push({ tool, color: hexOr('#' + s[1], COLORS[0]), size: clampInt(s[2], 1, 40, TOOLS[tool].size), pts });
  }
  const ids = new Set();
  if (Array.isArray(g[2])) for (const s of g[2]) {
    if (page.shapes.length >= LIMITS.shapes) break;
    if (!Array.isArray(s) || typeof s[0] !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(s[0]) || ids.has(s[0]) || !Number.isInteger(s[1]) || s[1] < 0 || s[1] >= SHAPE_TYPES.length) continue;
    const w = clampInt(s[4], 16, PAGE.W, MIN_SHAPE), h = clampInt(s[5], 16, PAGE.H, MIN_SHAPE);
    ids.add(s[0]);
    page.shapes.push({ id: s[0], type: SHAPE_TYPES[s[1]], x: clampInt(s[2], 0, PAGE.W - w, 0), y: clampInt(s[3], 0, PAGE.H - h, 0), w, h, text: cleanText(s[6], LIMITS.text), color: hexOr('#' + s[7], COLORS[6]) });
  }
  const seen = new Set();
  if (Array.isArray(g[3])) for (const l of g[3]) {
    if (page.links.length >= LIMITS.links) break;
    if (!Array.isArray(l) || typeof l[0] !== 'string' || typeof l[1] !== 'string' || l[0] === l[1] || !ids.has(l[0]) || !ids.has(l[1]) || seen.has(l[0] + '>' + l[1])) continue;
    seen.add(l[0] + '>' + l[1]); page.links.push({ from: l[0], to: l[1], label: cleanText(l[2], LIMITS.text) });
  }
  return page;
}
export function serialize(doc) {
  try { return JSON.stringify({ v: 1, p: doc.page, g: doc.pages.slice(0, LIMITS.pages).map(pageToArr) }); } catch (e) { return JSON.stringify({ v: 1, p: 0, g: [pageToArr(newPage('lined'))] }); }
}
/* never throws, never trusts its input; falls back to a fresh doc when nothing can be saved */
export function parse(text) {
  try {
    if (typeof text !== 'string' || text.length > MAX_TEXT) return newDoc();
    const raw = JSON.parse(text); if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.g)) return newDoc();
    const pages = []; for (const g of raw.g.slice(0, LIMITS.pages)) { const p = arrToPage(g); if (p) pages.push(p); }
    return pages.length ? { v: 1, page: clampInt(raw.p, 0, pages.length - 1, 0), pages } : newDoc();
  } catch (e) { return newDoc(); }
}
/* how many bytes the saved text takes (UTF-8), for a storage meter */
export function byteSize(doc) { const s = serialize(doc); let b = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b += c < 128 ? 1 : c < 2048 ? 2 : 3; } return b; }

/* ---------- undo: compact snapshots of one page ----------
   Call push(doc) BEFORE each change (stroke, erase, shape edit). Undo and redo put the page back exactly and jump to it.
   Page adds and removals shift page numbers, so call clear() after them. */
export function makeHistory(limit = 50) {
  const cap = clampInt(limit, 1, 500, 50); let past = [], future = [];
  const snapOf = (doc, i) => (doc.pages[i] ? { i, s: JSON.stringify(pageToArr(doc.pages[i])) } : null);
  const restore = (doc, e) => { const p = e.i < doc.pages.length ? arrToPage(JSON.parse(e.s)) : null; if (!p) return false; doc.pages[e.i] = p; doc.page = e.i; return true; };
  /* take the newest entry of `from`, put the current page on `to`, and restore the entry; entries equal to the current page (a change that did nothing) are skipped */
  const step = (doc, from, to) => {
    for (let e = from.pop(); e; e = from.pop()) {
      const cur = snapOf(doc, e.i); if (cur && cur.s === e.s) continue;
      if (!restore(doc, e)) return false; if (cur) to.push(cur); return true;
    }
    return false;
  };
  return {
    push(doc) {
      const e = snapOf(doc, doc.page); if (!e) return; future = [];
      const t = past[past.length - 1]; if (t && t.i === e.i && t.s === e.s) return;
      past.push(e); if (past.length > cap) past.shift();
    },
    undo(doc) { return step(doc, past, future); },
    redo(doc) { return step(doc, future, past); },
    canUndo: () => past.length > 0, canRedo: () => future.length > 0, clear() { past = []; future = []; },
  };
}

/* ---------- printing: fit the page onto real paper, landscape, in millimetres ---------- */
export function printLayout(W, H, paper = 'letter') {
  W = fin(W, PAGE.W); H = fin(H, PAGE.H); if (W <= 0) W = PAGE.W; if (H <= 0) H = PAGE.H;
  const a4 = paper === 'a4', pw = a4 ? 297 : 279.4, ph = a4 ? 210 : 215.9, m = 12.7;
  const scale = Math.min((pw - 2 * m) / W, (ph - 2 * m) / H), w = W * scale, h = H * scale;
  return { unit: 'mm', paper: a4 ? 'a4' : 'letter', paperW: pw, paperH: ph, margin: m, scale, w, h, x: (pw - w) / 2, y: (ph - h) / 2 };
}

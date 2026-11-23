/* ============================================================
   allofus.one · home kit (Nov 2026)
   The fun half of the home builder:
   · starter styles for a guided first build
   · yard pieces (benches, lanterns, trees ...) made from simple
     shapes, placed on a 1 m grid with a ghost preview, rotate,
     undo, colour + finish swatches. All pieces of a home bake
     into at most 4 meshes (matte / gloss / metal / glow), so a
     full yard costs 1 to 4 draw calls, not one per piece.
   · a grow-in effect + WebAudio chimes when a home is built
   · day / night preview, "Visit my house"
   · in the world: a light beam over your lot (or over open land),
     and a VR build pad: point the laser at the grid, pull the
     trigger to place. Nothing here moves the camera for you.
   Building still needs an account (adults 18+): unchanged.
   © 2026 allofus.one
   ============================================================ */
import { THREE, makeSprite, isMobile, SKIES } from './aou-engine.js';
import { groundY, terrainY } from './aou-terrain.js';
const T = THREE; const MOB = isMobile();
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- limits (also the validation rules for saved data) ---------- */
export const MAX_ITEMS = 60; export const YARD = { x: 15, z: 13 };
export const SWATCHES = ['#e25555', '#f2994a', '#f2c94c', '#4caf50', '#2d9cdb', '#9b51e0', '#f5f5f0', '#8d6e63'];
export const SWATCH_NAMES = ['Poppy red', 'Marigold', 'Sunbeam', 'Clover', 'Sky', 'Violet', 'Chalk', 'Walnut'];
export const FINISHES = [['Matte', 0.9, 0], ['Gloss', 0.22, 0], ['Metal', 0.35, 0.85]];
export const WALL_SWATCHES = ['#ffffff', '#f4e9d8', '#f7d9c4', '#f6c453', '#e07a5f', '#b7d3a8', '#9ec9e2', '#c9b6e4', '#8d99ae', '#3d405b'];

/* ---------- starter styles (original names; each is just a patch over the builder's own options) ---------- */
export const STARTERS = [
  ['meadow', '🌻', 'Meadow Cottage', 'Gable roof, warm brick, a garden out front', { shape: 'rect', w: 11, d: 9, floors: 1, wall: 'brick', wallColor: '#f7d9c4', roof: 'gable', roofMat: 'cedar', windows: 55, pool: 'none', garden: true, solar: false, fence: true, trees: 4 }],
  ['lanternloft', '🏮', 'Lantern Loft', 'Tall and narrow with a butterfly roof', { shape: 'rect', w: 8, d: 10, floors: 3, wall: 'stucco', wallColor: '#f4e9d8', roof: 'butterfly', roofMat: 'aluminum', windows: 80, pool: 'none', garden: false, solar: true, fence: false, trees: 2 }],
  ['cedarcabin', '🌲', 'Cedar Cabin', 'Wood siding, shake roof, room for a fire ring', { shape: 'L', w: 13, d: 10, floors: 1, wall: 'wood', wallColor: '#ffffff', roof: 'gable', roofMat: 'cedar', windows: 40, pool: 'none', garden: true, solar: false, fence: false, trees: 6 }],
  ['sunstone', '☀️', 'Sunstone Villa', 'Wide and sunny, clay tile and a lagoon pool', { shape: 'rect', w: 16, d: 12, floors: 2, wall: 'stucco', wallColor: '#f6c453', roof: 'hip', roofMat: 'clay', windows: 60, pool: 'lagoon', fish: 'koi', garden: true, solar: true, fence: true, trees: 4 }],
  ['roundkeep', '🧱', 'Round Keep', 'A stone tower under a copper dome', { shape: 'tower', w: 10, d: 10, floors: 3, wall: 'stone', wallColor: '#ffffff', roof: 'dome', roofMat: 'copper', windows: 50, pool: 'round', fish: 'none', garden: false, solar: false, fence: false, trees: 3 }],
  ['skybox', '🧊', 'Skyline Box', 'Flat roof, big glass, living green on top', { shape: 'U', w: 15, d: 12, floors: 2, wall: 'concrete', wallColor: '#ffffff', roof: 'garden', roofMat: 'green', windows: 100, pool: 'rect', fish: 'none', garden: false, solar: true, fence: false, trees: 2 }],
];

/* ---------- yard pieces: [shape, a, b, c, x, y, z, colour, ry, rx, rz]
   b = box(w,h,d) · c = cylinder(rTop,h,rBottom) · s = sphere(r, yScale, zScale) · k = cone(r,h)
   colour: a number, 'A' = the swatch you picked, 'G' = glows at night ---------- */
const WOOD = 0x9a6b3f, DARK = 0x3b3f46, STONE = 0x9a968c, LEAF = 0x4f9a3c, PINE = 0x2f6b3a, WHITE = 0xf1eee6, SOIL = 0x4a3424;
export const DECOR = {
  bench: ['🪑', 'Garden bench', [['b', 1.8, 0.1, 0.5, 0, 0.5, 0, WOOD], ['b', 1.8, 0.5, 0.08, 0, 0.85, 0.23, 'A'], ['b', 0.1, 0.5, 0.45, -0.8, 0.25, 0, DARK], ['b', 0.1, 0.5, 0.45, 0.8, 0.25, 0, DARK]]],
  table: ['🧺', 'Picnic table', [['b', 1.8, 0.1, 0.9, 0, 0.78, 0, WOOD], ['b', 1.8, 0.08, 0.3, 0, 0.45, 0.75, 'A'], ['b', 1.8, 0.08, 0.3, 0, 0.45, -0.75, 'A'], ['b', 0.1, 0.78, 1.7, -0.7, 0.39, 0, DARK], ['b', 0.1, 0.78, 1.7, 0.7, 0.39, 0, DARK]]],
  lounger: ['🏖️', 'Sun lounger', [['b', 0.7, 0.12, 1.5, 0, 0.35, 0.2, 'A'], ['b', 0.7, 0.12, 0.8, 0, 0.58, -0.8, 'A', 0, -0.7], ['b', 0.6, 0.3, 0.1, 0, 0.15, 0.8, WHITE], ['b', 0.6, 0.3, 0.1, 0, 0.15, -0.4, WHITE]]],
  firepit: ['🔥', 'Fire ring', [['c', 0.75, 0.35, 0.8, 0, 0.17, 0, STONE], ['c', 0.55, 0.36, 0.55, 0, 0.18, 0, 0x2a2a2a], ['b', 0.7, 0.14, 0.14, 0, 0.42, 0, WOOD, 0.6], ['b', 0.7, 0.14, 0.14, 0, 0.42, 0, WOOD, -0.6], ['k', 0.26, 0.7, 0, 0, 0.8, 0, 'G']]],
  lantern: ['🏮', 'Lantern post', [['c', 0.06, 2.4, 0.09, 0, 1.2, 0, DARK], ['b', 0.5, 0.06, 0.06, 0.2, 2.35, 0, DARK], ['b', 0.28, 0.36, 0.28, 0.42, 2.1, 0, 'G'], ['k', 0.24, 0.16, 0, 0.42, 2.36, 0, 'A']]],
  planter: ['🌷', 'Planter box', [['b', 1.6, 0.5, 0.6, 0, 0.25, 0, WOOD], ['b', 1.45, 0.06, 0.45, 0, 0.5, 0, SOIL], ['s', 0.2, 1, 1, -0.3, 0.6, 0, LEAF], ['s', 0.2, 1, 1, 0.3, 0.6, 0, LEAF], ['s', 0.16, 1, 1, -0.6, 0.7, 0, 'A'], ['s', 0.16, 1, 1, 0, 0.72, 0, 'A'], ['s', 0.16, 1, 1, 0.6, 0.7, 0, 'A']]],
  pot: ['🪴', 'Big flower pot', [['c', 0.42, 0.6, 0.3, 0, 0.3, 0, 0xc8693a], ['s', 0.45, 0.9, 1, 0, 0.95, 0, LEAF], ['s', 0.13, 1, 1, 0.25, 1.2, 0.2, 'A'], ['s', 0.13, 1, 1, -0.28, 1.1, 0.1, 'A'], ['s', 0.13, 1, 1, 0, 1.3, -0.25, 'A']]],
  topiary: ['🌳', 'Topiary', [['c', 0.3, 0.4, 0.24, 0, 0.2, 0, 'A'], ['c', 0.05, 1.3, 0.05, 0, 1.0, 0, WOOD], ['s', 0.5, 1, 1, 0, 1.3, 0, LEAF], ['s', 0.32, 1, 1, 0, 2.0, 0, LEAF]]],
  pine: ['🌲', 'Pine tree', [['c', 0.12, 0.8, 0.16, 0, 0.4, 0, WOOD], ['k', 1.1, 1.4, 0, 0, 1.4, 0, PINE], ['k', 0.85, 1.2, 0, 0, 2.2, 0, PINE], ['k', 0.55, 1.0, 0, 0, 2.95, 0, PINE]]],
  tree: ['🌳', 'Shade tree', [['c', 0.16, 1.8, 0.22, 0, 0.9, 0, WOOD], ['s', 1.2, 0.9, 1, 0, 2.7, 0, LEAF], ['s', 0.9, 0.9, 1, 0.7, 2.3, 0, 0x5aa646], ['s', 0.85, 0.9, 1, -0.6, 2.4, 0.3, 0x478c36]]],
  rocks: ['🪨', 'Rock cluster', [['s', 0.55, 0.7, 1, 0, 0.3, 0, STONE], ['s', 0.35, 0.7, 1, 0.6, 0.2, 0.2, 0x87837a], ['s', 0.28, 0.7, 1, -0.3, 0.15, 0.5, 0xa8a49b]]],
  birdbath: ['🐦', 'Bird bath', [['c', 0.3, 0.1, 0.36, 0, 0.05, 0, WHITE], ['c', 0.09, 0.7, 0.12, 0, 0.45, 0, WHITE], ['c', 0.5, 0.14, 0.2, 0, 0.87, 0, 'A'], ['c', 0.42, 0.03, 0.42, 0, 0.945, 0, 0x6fc3e8]]],
  arch: ['⛩️', 'Garden arch', [['b', 0.14, 2.4, 0.14, -0.8, 1.2, 0, WHITE], ['b', 0.14, 2.4, 0.14, 0.8, 1.2, 0, WHITE], ['b', 1.9, 0.14, 0.3, 0, 2.45, 0, 'A'], ['s', 0.22, 1, 1, -0.6, 2.6, 0, LEAF], ['s', 0.22, 1, 1, 0, 2.66, 0, LEAF], ['s', 0.22, 1, 1, 0.6, 2.6, 0, LEAF]]],
  stones: ['🥏', 'Stepping stones', [['c', 0.32, 0.06, 0.32, 0.1, 0.04, -1.2, STONE], ['c', 0.3, 0.06, 0.3, -0.12, 0.04, -0.4, 0xa8a49b], ['c', 0.32, 0.06, 0.32, 0.12, 0.04, 0.4, STONE], ['c', 0.3, 0.06, 0.3, -0.1, 0.04, 1.2, 0xa8a49b]]],
  swing: ['🎠', 'Swing set', [['b', 0.08, 2.4, 0.08, -1.1, 1.15, 0.4, WHITE, 0, 0.18], ['b', 0.08, 2.4, 0.08, -1.1, 1.15, -0.4, WHITE, 0, -0.18], ['b', 0.08, 2.4, 0.08, 1.1, 1.15, 0.4, WHITE, 0, 0.18], ['b', 0.08, 2.4, 0.08, 1.1, 1.15, -0.4, WHITE, 0, -0.18], ['b', 2.4, 0.1, 0.1, 0, 2.3, 0, 'A'], ['b', 0.03, 1.6, 0.03, -0.25, 1.5, 0, DARK], ['b', 0.03, 1.6, 0.03, 0.25, 1.5, 0, DARK], ['b', 0.6, 0.06, 0.25, 0, 0.7, 0, WOOD]]],
  sandbox: ['🏝️', 'Sandbox', [['b', 1.9, 0.22, 0.14, 0, 0.11, 0.88, WOOD], ['b', 1.9, 0.22, 0.14, 0, 0.11, -0.88, WOOD], ['b', 0.14, 0.22, 1.9, 0.88, 0.11, 0, WOOD], ['b', 0.14, 0.22, 1.9, -0.88, 0.11, 0, WOOD], ['b', 1.65, 0.1, 1.65, 0, 0.08, 0, 0xe6d3a1], ['c', 0.12, 0.2, 0.09, 0.4, 0.23, 0.3, 'A']]],
  flag: ['🚩', 'Banner pole', [['c', 0.04, 3.2, 0.05, 0, 1.6, 0, WHITE], ['b', 0.9, 0.55, 0.03, 0.5, 2.8, 0, 'A'], ['s', 0.08, 1, 1, 0, 3.25, 0, 0xffd23f]]],
  pethouse: ['🐾', 'Pet house', [['b', 0.9, 0.7, 1.1, 0, 0.35, 0, 'A'], ['b', 0.66, 0.06, 1.25, -0.24, 0.9, 0, 0x5b4636, 0, 0, 0.7], ['b', 0.66, 0.06, 1.25, 0.24, 0.9, 0, 0x5b4636, 0, 0, -0.7], ['b', 0.36, 0.42, 0.03, 0, 0.23, -0.56, 0x1f2937]]],
  scope: ['🔭', 'Star scope', [['b', 0.05, 1.15, 0.05, 0.22, 0.55, 0.13, DARK, 0, 0.2, -0.36], ['b', 0.05, 1.15, 0.05, -0.22, 0.55, 0.13, DARK, 0, 0.2, 0.36], ['b', 0.05, 1.15, 0.05, 0, 0.55, -0.26, DARK, 0, -0.4, 0], ['c', 0.1, 0.95, 0.07, 0, 1.3, 0, 'A', 0, 0.9], ['c', 0.05, 0.2, 0.05, 0, 1.03, 0.36, DARK, 0, 0.9]]],
};
export const DECOR_KEYS = Object.keys(DECOR);

/* saved data is somebody's input: keep only known pieces on the grid, in range, capped */
export function cleanItems(list) {
  const out = []; if (!Array.isArray(list)) return out; const seen = new Set();
  for (const it of list) { if (!Array.isArray(it) || !DECOR[it[0]]) continue; const x = Math.round(+it[1]), z = Math.round(+it[2]); if (!(Math.abs(x) <= YARD.x) || !(Math.abs(z) <= YARD.z)) continue; const k = x + ',' + z; if (seen.has(k)) continue; seen.add(k);
    out.push([it[0], x, z, ((+it[3] | 0) % 4 + 4) % 4, Math.min(SWATCHES.length - 1, Math.max(0, +it[4] | 0)), Math.min(FINISHES.length - 1, Math.max(0, +it[5] | 0))]); if (out.length >= MAX_ITEMS) break; }
  return out;
}
/* may a piece stand here? boxes = the home's own footprint boxes [x, z, halfW, halfD] */
export function canPlace(items, boxes, x, z, skip = -1) {
  if (Math.abs(x) > YARD.x || Math.abs(z) > YARD.z) return false;
  for (const b of (boxes || [])) if (Math.abs(x - b[0]) < b[2] + 0.4 && Math.abs(z - b[1]) < b[3] + 0.4) return false;
  for (let i = 0; i < items.length; i++) if (i !== skip && items[i][1] === x && items[i][2] === z) return false;
  return true;
}

/* ---------- baking: every piece of a yard into 1 to 4 meshes ---------- */
const _m = new T.Matrix4(), _im = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _c = new T.Color();
const SEG = MOB ? 8 : 12;
function partGeo(sh, a, b, c) { return sh === 'b' ? new T.BoxGeometry(a, b, c) : sh === 'c' ? new T.CylinderGeometry(a, c, b, SEG) : sh === 's' ? new T.SphereGeometry(a, SEG, Math.max(6, SEG - 4)) : new T.ConeGeometry(a, b, SEG); }
function pushPart(acc, part, accent) {
  const [sh, a, b, c, x = 0, y = 0, z = 0, col, ry = 0, rx = 0, rz = 0] = part; const g0 = partGeo(sh, a, b, c); const g = g0.index ? g0.toNonIndexed() : g0;
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(1, sh === 's' ? (b || 1) : 1, sh === 's' ? (c || 1) : 1); _m.compose(_p, _q, _s).premultiply(_im); g.applyMatrix4(_m);
  _c.set(col === 'A' ? accent : col === 'G' ? 0xffc46b : col); const P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let i = 0; i < P.length; i += 3) { acc.pos.push(P[i], P[i + 1], P[i + 2]); acc.nor.push(N[i], N[i + 1], N[i + 2]); acc.col.push(_c.r, _c.g, _c.b); }
  g0.dispose(); if (g !== g0) g.dispose();
}
const matCache = {};
const decorMat = (fin) => matCache[fin] || (matCache[fin] = fin === 'glow' ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshStandardMaterial({ vertexColors: true, roughness: FINISHES[fin][1], metalness: FINISHES[fin][2] }));
/* items → Group('aou-decor') holding up to four meshes. opts.yAt(x, z) lifts a piece onto sloped ground. */
export function buildDecor(items, opts = {}) {
  const list = opts.trusted ? items : cleanItems(items); const g = new T.Group(); g.name = 'aou-decor'; g.userData.items = list; if (!list.length) return g;
  const acc = {}; const bucket = (k) => acc[k] || (acc[k] = { pos: [], nor: [], col: [] });
  for (const [type, x, z, rot, ci, fi] of list) {
    let y = 0; if (opts.yAt) { try { y = Math.max(-8, Math.min(4, +opts.yAt(x, z) || 0)); } catch (e) { y = 0; } }
    _e.set(0, rot * Math.PI / 2, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(1, 1, 1); _im.compose(_p, _q, _s);
    for (const part of DECOR[type][2]) pushPart(bucket(part[7] === 'G' ? 'glow' : part[7] === 'A' ? fi : 0), part, SWATCHES[ci]);
  }
  for (const [k, a] of Object.entries(acc)) { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(a.pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(a.nor, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(a.col, 3)); geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, decorMat(k === 'glow' ? 'glow' : +k)); mesh.castShadow = !MOB && k !== 'glow'; mesh.receiveShadow = k !== 'glow'; mesh.userData.decor = k; g.add(mesh); }
  return g;
}

/* ---------- sound: tiny WebAudio synth, started only by a tap or click ---------- */
let AC = null;
export const sfx = {
  get muted() { try { return localStorage.getItem('aou_build_mute') === '1'; } catch (e) { return false; } },
  set muted(v) { try { localStorage.setItem('aou_build_mute', v ? '1' : '0'); } catch (e) { } },
  ctx() { if (this.muted) return null; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return null; } return AC; },
  note(freq, at = 0, dur = 0.22, type = 'triangle', vol = 0.1) { const a = this.ctx(); if (!a) return; try { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq; const t = a.currentTime + at; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.03); } catch (e) { } },
  place() { this.note(523, 0, 0.12, 'sine', 0.12); this.note(784, 0.05, 0.2, 'triangle', 0.1); },
  rotate() { this.note(660, 0, 0.07, 'square', 0.035); },
  undo() { this.note(494, 0, 0.1, 'sine', 0.09); this.note(392, 0.06, 0.16, 'sine', 0.09); },
  nope() { this.note(180, 0, 0.12, 'sawtooth', 0.04); },
  pick() { this.note(880, 0, 0.06, 'sine', 0.06); },
  grow() { [523, 587, 659, 784, 880, 1047].forEach((f, i) => this.note(f, i * 0.2, 0.3, 'triangle', 0.09)); [523, 659, 784, 1047].forEach((f) => this.note(f, 1.3, 1.1, 'sine', 0.06)); },
};

/* ---------- grow-in: a home rises piece by piece, lowest first. Returns tick(seconds) → true while running ---------- */
const outBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export function growIn(group, total = 1.5) {
  const kids = group.children.filter(o => !o.isLight).map(o => ({ o, s: o.scale.clone(), y: o.position.y })).sort((a, b) => a.y - b.y); const n = Math.max(1, kids.length); const dur = 0.45; let t0 = null;
  kids.forEach(k => k.o.scale.setScalar(0.0001));
  /* a ring of sparks that rides up with the walls: one Points object, removed when done */
  const N = 70, pos = new Float32Array(N * 3), seed = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; seed.push([Math.cos(a) * (7 + (i % 5)), Math.sin(a) * (6 + (i % 4)), (i % 7) / 7]); }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); const pts = new T.Points(pg, new T.PointsMaterial({ color: 0xffe08a, size: 0.9, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending })); pts.frustumCulled = false; group.add(pts);
  return (t) => { if (t0 === null) t0 = t; const e = t - t0; let live = false;
    kids.forEach((k, i) => { const d = (i / n) * (total - dur); const x = Math.max(0, Math.min(1, (e - d) / dur)); if (x < 1) live = true; const v = x <= 0 ? 0.0001 : outBack(x); k.o.scale.set(k.s.x * v, k.s.y * v, k.s.z * v); });
    const u = Math.min(1, e / (total + 0.5)); for (let i = 0; i < N; i++) { const sd = seed[i]; pos[i * 3] = sd[0] * (1 - u * 0.3); pos[i * 3 + 1] = 0.2 + u * (5 + sd[2] * 9); pos[i * 3 + 2] = sd[1] * (1 - u * 0.3); } pg.attributes.position.needsUpdate = true; pts.material.opacity = 0.95 * (1 - u);
    if (!live && u >= 1) { kids.forEach(k => k.o.scale.copy(k.s)); group.remove(pts); pg.dispose(); pts.material.dispose(); return false; } return true; };
}
export function growInWorld(app, group) { const tick = growIn(group, 1.6); const f = (dt, t) => { if (!group.parent || !tick(t)) app.updaters = app.updaters.filter(q => q !== f); }; app.onUpdate(f); sfx.grow(); }

/* small pictures of each piece for the palette: drawn once with a throwaway renderer, then kept as images */
let THUMBS = null;
function pieceThumbs() { if (THUMBS) return THUMBS; THUMBS = {}; try { const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(88, 88, false); r.outputColorSpace = T.SRGBColorSpace; const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x8899aa, 1.3)); const d = new T.DirectionalLight(0xffffff, 1.5); d.position.set(3, 6, 4); sc.add(d); const cam = new T.PerspectiveCamera(30, 1, 0.1, 60); const box = new T.Box3(), c = new T.Vector3(), sz = new T.Vector3();
  for (const k of DECOR_KEYS) { const g = buildDecor([[k, 0, 0, 0, 4, 0]], { trusted: true }); sc.add(g); box.setFromObject(g); box.getCenter(c); box.getSize(sz); const dist = Math.max(sz.x, sz.y, sz.z, 0.8) * 0.5 / Math.tan(Math.PI / 12) * 1.2; cam.position.set(c.x + dist * 0.6, c.y + dist * 0.45, c.z - dist * 0.66); cam.lookAt(c); r.render(sc, cam); THUMBS[k] = r.domElement.toDataURL('image/png'); sc.remove(g); g.traverse(o => o.geometry && o.geometry.dispose()); }
  r.dispose(); try { r.forceContextLoss(); } catch (e) { } } catch (e) { console.warn('piece pictures', e); } return THUMBS; }
/* the 1 m grid drawn over a yard (one LineSegments) */
function gridLines(color = 0xffffff, opacity = 0.35) { const v = []; for (let x = -YARD.x - 0.5; x <= YARD.x + 0.5; x++) v.push(x, 0, -YARD.z - 0.5, x, 0, YARD.z + 0.5); for (let z = -YARD.z - 0.5; z <= YARD.z + 0.5; z++) v.push(-YARD.x - 0.5, 0, z, YARD.x + 0.5, 0, z); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); const l = new T.LineSegments(g, new T.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); l.position.y = 0.06; return l; }
/* a see-through copy of one piece, tinted green (fits) or red (blocked) */
function makeGhost() { const g = new T.Group(); const mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false }); const ring = new T.Mesh(new T.RingGeometry(0.62, 0.74, 28), new T.MeshBasicMaterial({ color: 0x7cff6b, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring); let body = null, key = '';
  g.userData.set = (type, rot, ci, fi, ok) => { const k = [type, rot, ci, fi].join('|'); if (k !== key) { key = k; if (body) { g.remove(body); body.traverse(o => o.geometry && o.geometry.dispose()); } body = buildDecor([[type, 0, 0, rot, ci, fi]], { trusted: true }); body.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = false; } }); g.add(body); } mat.color.set(ok ? 0xffffff : 0xff6b6b); ring.material.color.set(ok ? 0x7cff6b : 0xff4f79); };
  return g; }

/* ============================================================
   builder add-on (screen): Decorate tab, guided first build,
   day / night, visit. ctx comes from aou-build.js openBuilder.
   ============================================================ */
export function enhanceBuilder(ctx) {
  const { m, spec, app, cv, sc, cam } = ctx; spec.items = cleanItems(spec.items);
  const st = { type: 'bench', rot: 0, ci: 4, fi: 0, tool: 'place', on: false, night: false, boxes: [], decor: null, grow: null, hist: [], hover: null, wizard: null };
  const grid = gridLines(); grid.visible = false; sc.add(grid); const ghost = makeGhost(); ghost.visible = false; sc.add(ghost);
  const hemi = sc.children.find(o => o.isHemisphereLight), sun = sc.children.find(o => o.isDirectionalLight), gnd = sc.children.find(o => o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry');
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), v2 = new T.Vector2(), hit = new T.Vector3();
  const cell = (e) => { const rc = cv.getBoundingClientRect(); v2.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(v2, cam); if (!ray.ray.intersectPlane(plane, hit)) return null; return [Math.round(hit.x), Math.round(hit.z)]; };
  const count = () => { const el = $('#hk-count', m); if (el) el.textContent = spec.items.length + ' / ' + MAX_ITEMS + ' pieces'; const u = $('#hk-undo', m); if (u) u.disabled = !st.hist.length; };
  const redecor = () => { const house = ctx.house(); if (!house) return; const old = house.getObjectByName('aou-decor'); if (old) { house.remove(old); old.traverse(o => o.geometry && o.geometry.dispose()); } house.add(buildDecor(spec.items, { trusted: true })); count(); };
  const push = () => { st.hist.push(JSON.stringify(spec.items)); if (st.hist.length > 60) st.hist.shift(); };
  const undo = () => { if (!st.hist.length) { sfx.nope(); return; } spec.items = JSON.parse(st.hist.pop()); redecor(); sfx.undo(); };
  const rotate = () => { st.rot = (st.rot + 1) % 4; sfx.rotate(); refreshGhost(); };
  const refreshGhost = () => { if (!st.on || !st.hover || st.tool !== 'place') { ghost.visible = false; return; } const [x, z] = st.hover; const ok = spec.items.length < MAX_ITEMS && canPlace(spec.items, st.boxes, x, z); ghost.userData.set(st.type, st.rot, st.ci, st.fi, ok); ghost.position.set(x, 0, z); ghost.visible = true; };
  const act = (c) => { if (!c) return; const [x, z] = c;
    if (st.tool === 'erase') { const i = spec.items.findIndex(it => it[1] === x && it[2] === z); if (i < 0) { sfx.nope(); return; } push(); spec.items.splice(i, 1); redecor(); sfx.undo(); return; }
    if (spec.items.length >= MAX_ITEMS) { app.toast('That is the most pieces one yard can hold (' + MAX_ITEMS + ').', 2600); sfx.nope(); return; }
    if (!canPlace(spec.items, st.boxes, x, z)) { sfx.nope(); return; }
    push(); spec.items.push([st.type, x, z, st.rot, st.ci, st.fi]); redecor(); sfx.place(); refreshGhost(); if (st.wizard) st.wizard.placed(); };
  /* the canvas keeps its own drag-to-spin; a press that barely moves is a placement */
  let down = null;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointermove', (e) => { if (!st.on) return; st.hover = cell(e); refreshGhost(); });
  cv.addEventListener('pointerleave', () => { st.hover = null; refreshGhost(); });
  cv.addEventListener('pointerup', (e) => { if (!st.on || !down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved < 7) { st.hover = cell(e); act(st.hover); } });
  const onKey = (e) => { if (!cv.isConnected) { removeEventListener('keydown', onKey, true); return; } if (!st.on || (e.target.closest && e.target.closest('input,textarea,select'))) return; if (e.code === 'KeyR') { e.preventDefault(); e.stopPropagation(); rotate(); } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); undo(); } };
  addEventListener('keydown', onKey, true);
  const setOn = (on) => { st.on = on; grid.visible = on; m._noSpin = on; if (!on) ghost.visible = false; cv.style.cursor = on ? 'crosshair' : 'grab'; if (on) ctx.view(0.5, 0.95, 50); };
  const setNight = (on) => { st.night = on; if (hemi) hemi.intensity = on ? 0.3 : 1.1; if (sun) { sun.intensity = on ? 0.25 : 1.6; sun.color.set(on ? 0x9db4ff : 0xffffff); } if (gnd) gnd.material.color.set(on ? 0x2f4a36 : 0x7fb069); cv.style.background = on ? 'linear-gradient(#0b1030,#1b2450 60%,#22344a)' : ''; grid.material.opacity = on ? 0.5 : 0.35; const b = $('#hk-night', m); if (b) b.textContent = on ? '☀️ Day' : '🌙 Night'; };

  /* extra buttons under the preview */
  const row = $('.hb-view .lt-row', m);
  if (row) { row.insertAdjacentHTML('beforeend', `<button class="lt-btn" id="hk-night">🌙 Night</button><button class="lt-btn" id="hk-visit">🚶 Visit my house</button><button class="lt-btn" id="hk-guide">✨ Guided build</button><button class="lt-btn" id="hk-mute" aria-label="Sound on or off">${sfx.muted ? '🔇' : '🔊'}</button>`);
    $('#hk-night', m).onclick = () => setNight(!st.night); $('#hk-visit', m).onclick = () => ctx.visit(); $('#hk-guide', m).onclick = () => wizard(); $('#hk-mute', m).onclick = (e) => { sfx.muted = !sfx.muted; e.currentTarget.textContent = sfx.muted ? '🔇' : '🔊'; sfx.pick(); }; }

  const paletteHTML = (keys = DECOR_KEYS) => `<div class="hk-pal">${keys.map(k => `<button data-hk="${k}" class="${k === st.type ? 'on' : ''}" title="${esc(DECOR[k][1])}">${pieceThumbs()[k] ? `<img src="${pieceThumbs()[k]}" alt="" width="44" height="44">` : `<span>${DECOR[k][0]}</span>`}<small>${esc(DECOR[k][1])}</small></button>`).join('')}</div>`;
  const swHTML = () => `<div class="hk-sw" role="group" aria-label="Piece colour">${SWATCHES.map((c, i) => `<button data-sw="${i}" class="${i === st.ci ? 'on' : ''}" style="background:${c}" title="${SWATCH_NAMES[i]}" aria-label="${SWATCH_NAMES[i]}"></button>`).join('')}</div>`;
  const wallSwHTML = () => `<div class="hk-sw" role="group" aria-label="Wall colour">${WALL_SWATCHES.map((c) => `<button data-wsw="${c}" class="${String(spec.wallColor).toLowerCase() === c ? 'on' : ''}" style="background:${c}" aria-label="Wall colour ${c}"></button>`).join('')}</div>`;
  const wirePalette = (P) => { $$('[data-hk]', P).forEach(b => b.onclick = () => { st.type = b.dataset.hk; st.tool = 'place'; $$('[data-hk]', P).forEach(x => x.classList.toggle('on', x === b)); $$('[data-tool]', P).forEach(x => x.classList.toggle('on', x.dataset.tool === 'place')); sfx.pick(); refreshGhost(); });
    $$('[data-sw]', P).forEach(b => b.onclick = () => { st.ci = +b.dataset.sw; $$('[data-sw]', P).forEach(x => x.classList.toggle('on', x === b)); sfx.pick(); refreshGhost(); });
    $$('[data-wsw]', P).forEach(b => b.onclick = () => { spec.wallColor = b.dataset.wsw; $$('[data-wsw]', P).forEach(x => x.classList.toggle('on', x === b)); sfx.pick(); ctx.rebuild(); }); };
  const panel = () => `<p class="muted2">Pick a piece, then tap the grass in the picture to set it down. It snaps to a 1 metre grid. <b>R</b> turns it, <b>Ctrl+Z</b> undoes.</p>
    <div class="hk-tools"><button data-tool="place" class="on">➕ Place</button><button data-tool="erase">🧽 Erase</button><button id="hk-rot">⟳ Turn</button><button id="hk-undo">↶ Undo</button><button id="hk-clear">Clear all</button></div>
    ${paletteHTML()}<p class="aou-lbl">Colour</p>${swHTML()}<p class="aou-lbl">Finish</p><div class="aou-chips" id="hk-fin">${FINISHES.map((f, i) => `<button data-fin="${i}" class="${i === st.fi ? 'on' : ''}">${f[0]}</button>`).join('')}</div><p class="muted2" id="hk-count"></p>`;
  const wirePanel = (P) => { wirePalette(P); $$('[data-tool]', P).forEach(b => b.onclick = () => { st.tool = b.dataset.tool; $$('[data-tool]', P).forEach(x => x.classList.toggle('on', x === b)); refreshGhost(); });
    $('#hk-rot', P).onclick = rotate; $('#hk-undo', P).onclick = undo; $('#hk-clear', P).onclick = () => { if (!spec.items.length) return; push(); spec.items = []; redecor(); sfx.undo(); };
    $$('[data-fin]', P).forEach(b => b.onclick = () => { st.fi = +b.dataset.fin; $$('[data-fin]', P).forEach(x => x.classList.toggle('on', x === b)); sfx.pick(); refreshGhost(); }); count(); };

  /* ---- the guided first build: pick a starter → watch it rise → make it yours ---- */
  function wizard() {
    const host = $('.hb-ctl', m); if (!host) return; let ov = $('.hk-wiz', host); if (ov) ov.remove(); ov = document.createElement('div'); ov.className = 'hk-wiz'; host.appendChild(ov); host.scrollTop = 0; let pick = STARTERS[0][0], placedN = 0;
    const dots = (n) => `<div class="hk-dots" aria-label="Step ${n} of 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
    const done = () => { st.wizard = null; ov.remove(); setOn(false); ctx.setTab('Shape'); };
    const apply = (id) => { const s = STARTERS.find(x => x[0] === id); if (!s) return; pick = id; Object.assign(spec, s[4]); ctx.rebuild(); };
    const step1 = () => { setOn(false); ov.innerHTML = `${dots(1)}<h3>Pick a starter home</h3><p class="muted2">Six to start from. You can change every part of it later.</p><div class="hk-starters">${STARTERS.map(([id, ic, n, d]) => `<button data-st="${id}" class="${id === pick ? 'on' : ''}"><span>${ic}</span><b>${esc(n)}</b><small>${esc(d)}</small></button>`).join('')}</div><div class="lt-row"><button class="lt-btn holo" id="hk-go">🏗️ Build it on my lot</button><button class="lt-btn" id="hk-skip">Skip the guide</button></div>`;
      $$('[data-st]', ov).forEach(b => b.onclick = () => { $$('[data-st]', ov).forEach(x => x.classList.toggle('on', x === b)); sfx.pick(); apply(b.dataset.st); }); $('#hk-go', ov).onclick = step2; $('#hk-skip', ov).onclick = done; apply(pick); };
    const step2 = () => { ov.innerHTML = `${dots(2)}<h3>Up it goes</h3><p class="muted2">Watch the picture: your home is rising from the ground, lowest parts first.</p><div class="hk-rise"><i></i></div>`; ctx.view(0.7, 0.42, 44); grow(); setTimeout(() => { if (ov.isConnected) step3(); }, 2500); };
    const step3 = () => { st.wizard = { placed: () => { placedN++; const el = $('#hk-wz-n', ov); if (el) el.textContent = placedN === 1 ? 'Nice. Add a few more, or save.' : placedN + ' pieces placed.'; } }; setOn(true);
      ov.innerHTML = `${dots(3)}<h3>Make it yours</h3><p class="aou-lbl">Wall colour</p>${wallSwHTML()}<p class="aou-lbl">Add something to the yard</p><p class="muted2" id="hk-wz-n">Pick a piece, then tap the grass in the picture.</p>${paletteHTML(['bench', 'lantern', 'firepit', 'pine', 'planter', 'swing', 'arch', 'flag'])}<p class="aou-lbl">Piece colour</p>${swHTML()}<div class="hk-tools"><button id="hk-rot">⟳ Turn</button><button id="hk-undo">↶ Undo</button></div><div class="lt-row"><button class="lt-btn holo" id="hk-wsave">💾 Save + build</button><button class="lt-btn" id="hk-more">All options</button></div>`;
      wirePalette(ov); $('#hk-rot', ov).onclick = rotate; $('#hk-undo', ov).onclick = undo; $('#hk-more', ov).onclick = () => { done(); ctx.setTab('Decorate'); }; $('#hk-wsave', ov).onclick = async () => { const ok = await ctx.save(); if (ok) step4(); }; count(); };
    const step4 = () => { st.wizard = null; setOn(false); ov.innerHTML = `<h3>🎉 Your home is built</h3><p class="muted2">It is standing on your lot right now, at the address under the picture. A gold beam marks it in the world.</p><div class="lt-row"><button class="lt-btn holo" id="hk-v2">🚶 Visit my house</button><button class="lt-btn" id="hk-keep">Keep building</button></div>`; $('#hk-v2', ov).onclick = () => ctx.visit(); $('#hk-keep', ov).onclick = () => { done(); ctx.setTab('Decorate'); }; };
    step1();
  }
  const grow = () => { const house = ctx.house(); if (!house) return; st.grow = growIn(house, 1.5); sfx.grow(); };

  const api = {
    panel, st, cam, calls: () => ctx.r.info.render.calls, items: () => spec.items, add: (type, x, z) => { if (!DECOR[type] || spec.items.length >= MAX_ITEMS || !canPlace(spec.items, st.boxes, x, z)) return false; push(); spec.items.push([type, x, z, st.rot, st.ci, st.fi]); redecor(); return true; },
    onRender(tab, P) { if ($('.hk-wiz', m)) return; setOn(tab === 'Decorate'); if (tab === 'Decorate') wirePanel(P); if (tab === 'Walls') { P.insertAdjacentHTML('beforeend', `<p class="aou-lbl">Quick colours</p>${wallSwHTML()}`); wirePalette(P); } },
    onRebuild(H) { st.boxes = (H && H.boxes) || []; st.grow = null; count(); refreshGhost(); },
    tick(t) { if (st.grow && !st.grow(t)) st.grow = null; if (ghost.visible) { const k = 1 + 0.08 * Math.sin(t * 6); ghost.children[0].scale.set(k, k, 1); } },
    onSaved() { grow(); }, wizard, setNight, grow,
  };
  injectCSS();
  if (ctx.first) setTimeout(() => { if (cv.isConnected) wizard(); }, 60);
  return api;
}

/* ============================================================
   in the world: places, the beam over your lot, the VR build pad
   ============================================================ */
export function initHomeKit(app, W, UI, B) {
  const getMe = () => UI.getMe && UI.getMe(); const LAND = { x: 12, z: 214 };
  const myClaim = () => { const me = getMe(); const h = me && me.home; return (h && h.lot && W.claims && W.claims.get(h.lot)) || null; };
  const faceOf = (c) => { const lot = W.lots && W.lots.get(c.id); return lot ? lot.face : 0; };
  const frontOf = (c, d = 14) => { const f = faceOf(c); return { x: c.x + Math.sin(f) * d, z: c.z + Math.cos(f) * d, face: f }; };
  const presenting = () => !!((app.renderer && app.renderer.xr && app.renderer.xr.isPresenting) || (app._xrSim && app._xrSim.on));
  const landSpot = () => { let best = null, bd = 1e9; try { for (const l of W.lots.values()) { if (W.claims.has(l.id)) continue; const d = Math.hypot(l.x - LAND.x, l.z - LAND.z); if (d < bd) { bd = d; best = l; } } } catch (e) { } return best && bd < 400 ? { x: best.x + Math.sin(best.face) * 11, z: best.z + Math.cos(best.face) * 11 } : LAND; };
  const visit = () => { const c = myClaim(); if (!c) { B.openBuilder(); return; } UI.close && UI.close(); const p = frontOf(c); app.travel({ id: '_myhome', name: 'your home', icon: '🏡', x: p.x, z: p.z, keys: '', say: 'Home. The builder is under 🏗️ Build.' }, 'port'); };
  const toLand = () => { const s = landSpot(); app.travel({ id: '_land', name: 'open land', icon: '🌍', x: s.x, z: s.z + 4, keys: '', say: 'Green stakes = open land. Tap one to claim it.' }, 'port'); };
  app.addPlace({ id: 'build-house', name: '🏗️ Build my house', icon: '🏗️', cat: 'Homes', keys: 'builder build design decorate home house yard furniture', fn: () => B.openBuilder() });
  app.addPlace({ id: 'my-home', name: '🏡 Visit my house', icon: '🏡', cat: 'Homes', keys: 'my home house lot address', fn: visit });
  app.addPlace({ id: 'open-land', name: '🌍 Open land · claim a lot', icon: '🌍', cat: 'Homes', keys: 'claim land lot stake free', fn: toLand });
  app.addPlace({ id: 'directory', name: '📒 Directory · every home', icon: '📒', cat: 'Homes', keys: 'directory address phone book homes', fn: () => B.openDirectory('homes') });

  /* the landmark: one soft beam + one label. Over your home when you have one, over the open land when you do not. */
  let beam = null, label = null, at = '';
  const placeBeam = () => { const c = myClaim(); const ls = c ? null : landSpot(); const key = c ? 'home:' + c.id : 'land:' + Math.round(ls.x) + ',' + Math.round(ls.z); if (key === at && beam) return; at = key;
    if (!beam) { const geo = new T.CylinderGeometry(0.7, 1.1, 70, 20, 1, true); geo.translate(0, 35, 0); beam = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false })); beam.userData.isSign = false; beam.renderOrder = 3; app.scene.add(beam); app.onUpdate((dt, t) => { if (beam.visible) beam.material.opacity = 0.17 + 0.07 * Math.sin(t * 1.8); }); }
    if (label) { app.scene.remove(label); try { label.material.map && label.material.map.dispose(); label.material.dispose(); } catch (e) { } }
    const x = c ? c.x : ls.x, z = c ? c.z : ls.z, y = c ? terrainY(x, z) : groundY(x, z); beam.position.set(x, y, z); beam.material.color.set(c ? 0xffd23f : 0x7cff6b);
    label = makeSprite(c ? '🏡 Your home · tap 🏗️ Build to change it' : '🏗️ Build your house here · free land', { scale: 5, accent: c ? '#ffd23f' : '#7cff6b' }); label.position.set(x, y + (c ? 16 : 5.5), z); app.scene.add(label); };
  setTimeout(() => { try { placeBeam(); } catch (e) { console.warn('home beam', e); } setInterval(() => { try { placeBeam(); } catch (e) { } }, 4000); }, 4200);

  /* ---------------- VR build pad ---------------- */
  let kit = null;
  const vrStop = (save) => { if (!kit) return; const k = kit; kit = null; const api = app._xrApi; try { api && api.screens.remove(k.pad); api && api.screens.remove(k.panel); } catch (e) { } app.updaters = app.updaters.filter(q => q !== k.tick); app.scene.remove(k.root); app.scene.remove(k.panel); k.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); try { k.panel.material.map.dispose(); k.panel.material.dispose(); k.panel.geometry.dispose(); } catch (e) { } if (k.hidden) k.hidden.visible = true; if (!save) { k.me.home.build = k.orig; if (k.styled) { try { W.chunks.rebuildAt(k.c.x, k.c.z); } catch (e) { } } } };
  const vrStart = () => { const me = getMe(); if (kit) return; const api = app._xrApi; if (!api) return;
    if (!me) { app.toast('🏗️ Building needs a free account (adults 18+). Join on a screen first, then come back in VR.', 6500); return; }
    const c = myClaim(); if (!c) { app.toast('🌍 First claim a lot: these green stakes are open land. Claiming is done on a screen for now.', 6500); try { api.closeAll(); } catch (e) { } const s = landSpot(); app.player.position.set(s.x, groundY(s.x, s.z + 4), s.z + 4); return; }
    try { api.closeAll(); } catch (e) { } const fr = frontOf(c, 15); app.player.position.set(fr.x, groundY(fr.x, fr.z), fr.z);
    let tries = 0; const begin = () => { if (!W.lots.get(c.id) && tries++ < 20) { setTimeout(begin, 250); return; } const f = frontOf(c, 15); app.player.position.set(f.x, groundY(f.x, f.z), f.z); open(me, c, f.face, api); }; begin(); };
  function open(me, c, face, api) {
    const DEFAULT = B.DEFAULT_SPEC; const orig = me.home.build ? JSON.parse(JSON.stringify(me.home.build)) : null; const spec = Object.assign(DEFAULT(), me.home.build || {}); spec.items = cleanItems(spec.items);
    const st = { type: 'bench', rot: 0, ci: 4, fi: 0, erase: false, hist: [], hover: null, style: -1, msg: 'Point at the grid and pull the trigger.' };
    const root = new T.Group(); const y0 = terrainY(c.x, c.z); root.position.set(c.x, y0, c.z); root.rotation.y = face + Math.PI; app.scene.add(root);
    const yAt = (lx, lz) => { const ry = root.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry); return terrainY(c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs) - y0; };
    const PW = YARD.x * 2 + 1, PD = YARD.z * 2 + 1; const pad = new T.Mesh(new T.PlaneGeometry(PW, PD), new T.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide })); pad.rotation.x = -Math.PI / 2; /* the lowest of: the yard corners, and the ground the player is standing on (so the laser always reaches it) */ let padY = app.player.position.y - y0; for (let sx = -1; sx <= 1; sx++) for (let sz = -1; sz <= 1; sz++) padY = Math.min(padY, yAt(sx * YARD.x * 0.8, sz * YARD.z * 0.8)); padY = Math.max(-8, Math.min(0, padY)); pad.position.y = padY + 0.3; pad.userData.isSign = false; pad.userData.floor = true; root.add(pad);
    const grid = gridLines(0x7cf8ff, 0.7); grid.position.y = padY + 0.32; root.add(grid); const ghost = makeGhost(); ghost.visible = false; root.add(ghost); let preview = null;
    /* the live home's own yard pieces hide while the pad shows the working copy */
    let hidden = null; app.scene.traverse(o => { if (!hidden && o.userData && o.userData.lot === c.id) hidden = o.getObjectByName('aou-decor') || null; }); if (hidden) hidden.visible = false;
    const boxes = () => { let b = []; app.scene.traverse(o => { if (o.userData && o.userData.lot === c.id && o.userData.boxes) b = o.userData.boxes; }); return b; };
    const redecor = () => { if (preview) { root.remove(preview); preview.traverse(o => o.geometry && o.geometry.dispose()); } preview = buildDecor(spec.items, { trusted: true, yAt }); root.add(preview); };
    const cellOf = (u, v) => [Math.round((u - 0.5) * PW), Math.round((0.5 - v) * PD)];
    const refresh = () => { if (!st.hover || st.erase) { ghost.visible = false; return; } const [x, z] = st.hover; ghost.userData.set(st.type, st.rot, st.ci, st.fi, spec.items.length < MAX_ITEMS && canPlace(spec.items, boxes(), x, z)); ghost.position.set(x, Math.max(padY, yAt(x, z)) + 0.3, z); ghost.visible = true; };
    const say = (s) => { st.msg = s; draw(); };
    api.screens.add(pad, { hover: (u, v) => { st.hover = cellOf(u, v); refresh(); }, down: (u, v) => { const [x, z] = st.hover = cellOf(u, v);
      if (st.erase) { const i = spec.items.findIndex(it => it[1] === x && it[2] === z); if (i >= 0) { st.hist.push(JSON.stringify(spec.items)); spec.items.splice(i, 1); redecor(); sfx.undo(); say('Removed. ' + spec.items.length + ' of ' + MAX_ITEMS + ' pieces.'); } else sfx.nope(); return; }
      if (spec.items.length >= MAX_ITEMS || !canPlace(spec.items, boxes(), x, z)) { sfx.nope(); say(spec.items.length >= MAX_ITEMS ? 'The yard is full (' + MAX_ITEMS + ').' : 'Something is in the way there.'); return; }
      st.hist.push(JSON.stringify(spec.items)); spec.items.push([st.type, x, z, st.rot, st.ci, st.fi]); redecor(); sfx.place(); say(DECOR[st.type][1] + ' placed. ' + spec.items.length + ' of ' + MAX_ITEMS + '.'); refresh(); } });
    /* one panel, one draw call: a 3 × 4 grid of buttons painted on a canvas; the laser's texture coordinate picks the cell */
    const cvs = document.createElement('canvas'); cvs.width = 1024; cvs.height = 820; const g2 = cvs.getContext('2d'); const tex = new T.CanvasTexture(cvs); tex.colorSpace = T.SRGBColorSpace;
    const BTN = [['◀ Piece', () => step(-1)], ['', null], ['Piece ▶', () => step(1)], ['⟳ Turn', () => { st.rot = (st.rot + 1) % 4; sfx.rotate(); refresh(); }], ['🎨 Colour', () => { st.ci = (st.ci + 1) % SWATCHES.length; sfx.pick(); refresh(); }], ['✨ Finish', () => { st.fi = (st.fi + 1) % FINISHES.length; sfx.pick(); refresh(); }], ['↶ Undo', () => { if (st.hist.length) { spec.items = JSON.parse(st.hist.pop()); redecor(); sfx.undo(); say('Undone.'); } else sfx.nope(); }], ['🧽 Erase', () => { st.erase = !st.erase; sfx.pick(); refresh(); say(st.erase ? 'Erase is on: point at a piece and pull the trigger.' : 'Placing.'); }], ['🏠 Next style', () => style()], ['🌙 Day / night', () => { const night = !app.isNight; try { app.setSky(night ? SKIES.night : SKIES.day, { night }); } catch (e) { } say(night ? 'Night look.' : 'Day look.'); }], ['💾 Save', () => save()], ['✕ Done', () => { vrStop(false); app.toast('Build pad closed. Unsaved changes were dropped.', 3000); }]];
    const step = (d) => { const i = (DECOR_KEYS.indexOf(st.type) + d + DECOR_KEYS.length) % DECOR_KEYS.length; st.type = DECOR_KEYS[i]; st.erase = false; sfx.pick(); refresh(); draw(); };
    function draw() { g2.fillStyle = 'rgba(6,14,40,0.94)'; g2.fillRect(0, 0, 1024, 820); g2.strokeStyle = '#38f0ff'; g2.lineWidth = 6; g2.strokeRect(3, 3, 1018, 814); g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillStyle = '#ffd23f'; g2.font = 'bold 46px Poppins, Arial'; g2.fillText('🏗️ Build my house', 512, 44); g2.fillStyle = '#e2e8f0'; g2.font = '600 30px Poppins, Arial'; g2.fillText(st.msg.slice(0, 60), 512, 98);
      BTN.forEach(([lb], i) => { const cx = i % 3, cy = Math.floor(i / 3); const x = 16 + cx * 336, y = 140 + cy * 168, w = 320, h = 152; const mid = i === 1; g2.fillStyle = mid ? '#0b1b4a' : (i === 7 && st.erase) ? '#7f1d1d' : i === 10 ? '#14532d' : '#12224f'; g2.beginPath(); g2.roundRect(x, y, w, h, 22); g2.fill(); g2.strokeStyle = mid ? SWATCHES[st.ci] : '#7cf8ff'; g2.lineWidth = mid ? 8 : 3; g2.stroke(); g2.fillStyle = '#fff';
        if (mid) { g2.font = 'bold 54px Poppins, Arial'; g2.fillText(DECOR[st.type][0], x + w / 2, y + 52); g2.font = 'bold 30px Poppins, Arial'; g2.fillText(DECOR[st.type][1], x + w / 2, y + 110); } else { g2.font = 'bold 40px Poppins, Arial'; g2.fillText(i === 5 ? '✨ ' + FINISHES[st.fi][0] : lb, x + w / 2, y + h / 2); } }); tex.needsUpdate = true; }
    const panel = new T.Mesh(new T.PlaneGeometry(1.25, 1.0), new T.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false })); panel.renderOrder = 996; panel.userData.isSign = false; app.scene.add(panel);
    api.screens.add(panel, { down: (u, v) => { const px = u * 1024, py = (1 - v) * 820; if (py < 140) return; const cx = Math.min(2, Math.floor((px - 16) / 336)), cy = Math.min(3, Math.floor((py - 140) / 168)); const b = BTN[cy * 3 + cx]; if (b && b[1]) { try { b[1](); } catch (e) { console.warn('build pad', e); } if (kit) draw(); } } });
    /* the panel parks to your left, 1.7 m ahead, low enough for a seat; it re-parks only if you move away from it */
    const _v = new T.Vector3(), _d = new T.Vector3(); const park = () => { const cam = presenting() ? app.renderer.xr.getCamera() : app.camera; cam.getWorldPosition(_v); cam.getWorldDirection(_d); _d.y = 0; if (_d.lengthSq() < 0.01) _d.set(0, 0, -1); _d.normalize(); const rx = -_d.z, rz = _d.x; panel.position.set(_v.x + _d.x * 1.7 - rx * 0.95, _v.y - 0.28, _v.z + _d.z * 1.7 - rz * 0.95); panel.lookAt(_v.x, _v.y - 0.1, _v.z); };
    let last = 0; const tick = (dt, t) => { if (t - last < 0.7) return; last = t; const cam = presenting() ? app.renderer.xr.getCamera() : app.camera; cam.getWorldPosition(_v); if (Math.hypot(_v.x - panel.position.x, _v.z - panel.position.z) > 3.4) park(); };
    const style = () => { st.style = (st.style + 1) % STARTERS.length; const s = STARTERS[st.style]; Object.assign(spec, s[4]); me.home.build = JSON.parse(JSON.stringify(spec)); me.home.build.items = []; kit.styled = true; W._growLot = c.id; try { W.chunks.rebuildAt(c.x, c.z); } catch (e) { } say(s[2] + '. Save keeps it.'); };
    const save = async () => { me.home.build = JSON.parse(JSON.stringify(spec)); try { await UI.DB.saveMe(me); } catch (e) { say('Could not save. Try again.'); sfx.nope(); return; } W._growLot = c.id; vrStop(true); try { W.chunks.rebuildAt(c.x, c.z); } catch (e) { } app.toast('🏡 Saved. Your home is built.', 3500); };
    kit = { root, pad, panel, tick, hidden, me, c, orig, styled: false, spec, st, cellOf, draw }; redecor(); draw(); park(); app.onUpdate(tick); sfx.pick();
    app.toast('🏗️ Build pad is open. Point at the grid and pull the trigger to place. The panel is on your left.', 5000);
  }
  /* rows for the VR menu's first page (aou-plus.js sets W.vrExtra just after this runs) */
  setTimeout(() => { try { W.vrExtra = W.vrExtra || []; W.vrExtra.unshift(['🏗️ Build my house', () => B.openBuilder()], ['🏡 Visit my house', visit]); } catch (e) { } }, 0);
  return { visit, toLand, vrStart, vrStop, presenting, kit: () => kit };
}

function injectCSS() { if (document.getElementById('hk-css')) return; const s = document.createElement('style'); s.id = 'hk-css'; s.textContent = `
.hk-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;margin:8px 0}
.hk-pal button{display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid #e2e8f0;background:#fff;border-radius:12px;padding:6px 4px;cursor:pointer;font-family:Poppins,Arial;min-height:64px;color:#0f172a}
.hk-pal button span{font-size:24px;line-height:1}.hk-pal button img{width:44px;height:44px;display:block}.hk-pal button small{font-size:11px;font-weight:700;line-height:1.15;text-align:center}
.hk-pal button.on{border-color:#6366f1;background:#eef2ff;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
.hk-sw{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 8px}.hk-sw button{width:34px;height:34px;border-radius:50%;border:2px solid #cbd5e1;cursor:pointer;padding:0}
.hk-sw button.on{outline:3px solid #0f172a;outline-offset:2px}
.hk-tools{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.hk-tools button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 12px;font:700 13px Poppins,Arial;cursor:pointer;min-height:40px;color:#0f172a}
.hk-tools button.on{background:#0f172a;color:#fff;border-color:#0f172a}.hk-tools button:disabled{opacity:.45;cursor:default}
.hk-wiz{background:#fff;padding:4px 6px 12px 2px}.hb-ctl:has(.hk-wiz)>:not(.hk-wiz){display:none}
.hk-wiz h3{margin:6px 0 4px;font:800 20px Poppins,Arial;color:#0f172a}
.hk-dots{display:flex;gap:6px;margin:2px 0 6px}.hk-dots i{width:34px;height:6px;border-radius:3px;background:#e2e8f0}.hk-dots i.on{background:#6366f1}
.hk-starters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
.hk-starters button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px;cursor:pointer;font-family:Poppins,Arial;color:#0f172a}
.hk-starters button span{font-size:28px;line-height:1}.hk-starters button b{font-size:14px}.hk-starters button small{font-size:12px;color:#475569;line-height:1.25}
.hk-starters button.on{border-color:#6366f1;background:#eef2ff;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
.hk-rise{height:10px;border-radius:5px;background:#e2e8f0;overflow:hidden;margin:14px 0}.hk-rise i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6366f1,#ffd23f);animation:hkRise 2.3s ease-out forwards}
@keyframes hkRise{to{width:100%}}
@media (prefers-reduced-motion:reduce){.hk-rise i{animation:none;width:100%}}
`; document.head.appendChild(s); }

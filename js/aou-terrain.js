/* ============================================================
   allofus.one · terrain + endless roads
   One deterministic world: everyone sees the same hills, roads
   and lots. The hub (|x|,|z| < ~420) is hand-built; beyond it
   chunks stream in around you forever (roads every 400 m,
   claimable lots along every road, biomes, landmarks).
   ============================================================ */
import { THREE, isMobile, makeSign } from './aou-engine.js';

/* ---------- noise ---------- */
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); const u = sm(xf), v = sm(zf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, z, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const seeded = (seed) => { let s = (Math.floor(seed * 9973) % 2147483647 + 2147483647) % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };

/* ---------- world plan (hub) ---------- */
export const GRID = 400;            // a road every 400 m, both ways, forever
export const ROAD_W = 12;
export const HUB = 430;             // hand-built area half size
export const SEA = 0;               // sea level
export const OCEAN = { x: -300, z: 330, r: 168 };   // the bay (beach + dive)
export const LAKE = { x: 112, z: 104, r: 22 };      // Zach's backyard lake
export const POOL = { x: -258, z: -24, r: 15 };     // waterfall plunge pool
export const CLIFF_X = -276;                        // west cliffs rise past here
export const ORBIT = { x: -20000, z: -20000 };      // Orbit Garden (space), teleport only
export const FLATS = [];            // {x,z,r,y,soft} or {x1,z1,x2,z2,y,soft}
export const PATHS = [];            // life paths: {pts:[[x,z]...], w}
export const STATE = { diving: false, dive: 0, space: false, season: 'winter' };
/* v4: Coburn's mountain (ski lift + ski run + mountain mansion on top) */
export const MTN = { x: 330, z: 330, r: 100, h: 66, top: 60 };

export function addFlat(f) { FLATS.push(Object.assign({ y: 0, soft: 10 }, f)); }

/* ---------- height ---------- */
function oceanDepth(x, z) { const d = Math.hypot(x - OCEAN.x, z - OCEAN.z) * (1 + 0.08 * Math.sin(Math.atan2(z - OCEAN.z, x - OCEAN.x) * 3)); if (d > 205) return null; if (d > 168) return -1.2 + 1.9 * smooth(168, 205, d); return -1.2 - 15 * smooth(150, 30, d) - 1.5 * smooth(168, 140, d); }
function bowl(x, z, c, depth) { const d = Math.hypot(x - c.x, z - c.z); if (d > c.r + 7) return null; return -depth * smooth(c.r + 6, c.r * 0.35, d) + 0.25 * smooth(c.r, c.r + 7, d); }
export function isDesert(x, z) { if (Math.abs(x) < HUB && Math.abs(z) < HUB) return x > 195 && z < 140 && z > -330 ? 1 : 0; return smooth(0.56, 0.66, fbm(x / 1400 + 31, z / 1400 - 7, 2)); }
export function isSnow(x, z) { const dm = Math.hypot(x - MTN.x, z - MTN.z); if (dm < MTN.r + 10) return STATE.season === 'summer' ? 0 : smooth(MTN.r + 10, MTN.r * 0.55, dm); if (Math.abs(x) < HUB + 200 && Math.abs(z) < HUB + 200) return 0; return smooth(0.62, 0.72, fbm(x / 1700 - 51, z / 1700 + 12, 2)); }

/* raw terrain before roads / flats */
function rawH(x, z) {
  if (Math.abs(x - ORBIT.x) < 600 && Math.abs(z - ORBIT.z) < 600) return 0;
  const r = Math.max(Math.abs(x), Math.abs(z));
  const out = smooth(HUB - 60, HUB + 260, r);
  let h = (fbm(x / 170, z / 170) - 0.5) * (5 + 18 * out) + (fbm(x / 48, z / 48, 3) - 0.5) * (1.2 + 2 * out);
  if (out > 0) { const m = Math.pow(Math.abs(fbm(x / 520 + 9, z / 520 - 3, 3) - 0.5) * 2, 2.2); h += m * 70 * out * (1 - isDesert(x, z) * 0.6); }
  const ds = isDesert(x, z); if (ds > 0) h = h * (1 - ds * 0.4) + ds * (Math.abs(Math.sin(x / 23 + Math.sin(z / 41) * 2)) * 2.6 + fbm(x / 90, z / 90) * 3);
  // west cliffs + waterfall
  if (x < CLIFF_X + 6 && Math.abs(z + 20) < 210 && r < HUB + 40) { const k = smooth(CLIFF_X + 4, CLIFF_X - 14, x) * smooth(210, 150, Math.abs(z + 20)); h = h * (1 - k) + k * (42 + fbm(x / 30, z / 30) * 8); }
  { const dm = Math.hypot(x - MTN.x, z - MTN.z); if (dm < MTN.r) { const k = smooth(MTN.r, 0, dm); h = h * (1 - k) + MTN.h * Math.pow(k, 1.35) + (fbm(x / 26, z / 26, 2) - 0.5) * 5 * k * (1 - k); } }
  const oc = oceanDepth(x, z); if (oc !== null) { const d = Math.hypot(x - OCEAN.x, z - OCEAN.z); const k = smooth(210, 175, d); h = h * (1 - k) + oc * k; }
  for (const [c, dp] of [[LAKE, 5.5], [POOL, 4.5]]) { const b = bowl(x, z, c, dp); if (b !== null) { const d = Math.hypot(x - c.x, z - c.z); const k = smooth(c.r + 7, c.r, d); h = h * (1 - k) + b * k; } }
  return h;
}
/* distance to the nearest grid road + the road's level there */
export function roadInfo(x, z) {
  const gx = Math.round(x / GRID) * GRID, gz = Math.round(z / GRID) * GRID; const dx = Math.abs(x - gx), dz = Math.abs(z - gz);
  if (dx < dz) return { d: dx, axis: 'z', cx: gx, cz: z }; return { d: dz, axis: 'x', cx: x, cz: gz };
}
function roadLevel(px, pz) { const h = rawH(px, pz) * 0.5 + (rawH(px + 18, pz + 18) + rawH(px - 18, pz - 18)) * 0.25; return Math.max(h, 1.1); }
export function terrainY(x, z) {
  let h = rawH(x, z);
  // life paths: gently leveled so they are always walkable
  for (const p of PATHS) { if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue; const d = p.dist(x, z); if (d < p.w + 6) { const k = smooth(p.w + 6, p.w * 0.5, d); h = h * (1 - k * 0.75) + Math.max(p.level(x, z), 0.3) * k * 0.75; } }
  for (const f of FLATS) { let d; if (f.r !== undefined) d = Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r); else { const ex = Math.max(f.x1 - x, 0, x - f.x2), ez = Math.max(f.z1 - z, 0, z - f.z2); d = Math.hypot(ex, ez); } if (d < f.soft) { const k = smooth(f.soft, 0, d); h = h * (1 - k) + f.y * k; } }
  const R = roadInfo(x, z); if (R.d < ROAD_W / 2 + 12 && rawH(R.cx, R.cz) > 0.6) { const lv = roadLevel(R.cx, R.cz); const k = smooth(ROAD_W / 2 + 12, ROAD_W / 2 + 1, R.d); h = h * (1 - k) + lv * k; }
  return h;
}
export function bridgeAt(x, z) { const R = roadInfo(x, z); if (R.d > ROAD_W / 2 + 0.6) return null; const t = rawH(R.cx, R.cz); if (t > 0.6) return null; return 1.4; }

/* water the player can swim in: polygons registered by the world */
export const WATERS = [];
export function waterAt(x, z) { if (bridgeAt(x, z) !== null) return null; for (const w of WATERS) { const d = Math.hypot(x - w.x, z - w.z); if (d < w.r) return w; } return null; }

/* where the player stands (the engine calls this every frame) */
/* v3 upper floors: rectangles you can stand on when the player is on that level (mansion office, roof deck). */
export const DECKS = []; // { level, y, x1, z1, x2, z2 }
export function addDeck(d) { DECKS.push(d); return d; }
export function groundY(x, z) {
  const lv = (globalThis.WVM_APP && globalThis.WVM_APP.level) || 0; if (lv) { for (const d of DECKS) if (d.level === lv && x >= d.x1 && x <= d.x2 && z >= d.z1 && z <= d.z2) return d.y; }
  const b = bridgeAt(x, z); if (b !== null) return Math.max(b, terrainY(x, z));
  const t = terrainY(x, z); const w = waterAt(x, z);
  if (w && t < w.y - 0.3) { if (STATE.diving && w.dive) return Math.max(t + 1.0, w.y - 0.6 - STATE.dive * (w.y - t)); return Math.max(t, w.y - 1.1); }
  return t;
}

/* ---------- colors ---------- */
const C = { grass: new THREE.Color(0x5f9e3c), grass2: new THREE.Color(0x86b84a), dry: new THREE.Color(0xa9b25a), sand: new THREE.Color(0xe8d3a0), wet: new THREE.Color(0xc2ab7a), rock: new THREE.Color(0x8b8378), rock2: new THREE.Color(0x6e675f), desert: new THREE.Color(0xe0a868), desert2: new THREE.Color(0xc9824e), sea: new THREE.Color(0x3f8f8a), snow: new THREE.Color(0xf4f7fb), space: new THREE.Color(0x9aa3b8) };
const tmp = new THREE.Color();
function colorAt(x, z, h, slope, out) {
  if (Math.abs(x - ORBIT.x) < 600 && Math.abs(z - ORBIT.z) < 600) return out.copy(C.space);
  const n = fbm(x / 35, z / 35, 2);
  out.copy(C.grass).lerp(C.grass2, n); out.lerp(C.dry, smooth(0.6, 0.85, fbm(x / 260 + 4, z / 260, 2)) * 0.6);
  const ds = isDesert(x, z); if (ds > 0) { tmp.copy(C.desert).lerp(C.desert2, n); out.lerp(tmp, ds); }
  const sn = isSnow(x, z); if (sn > 0 && h > 18) out.lerp(C.snow, sn * smooth(18, 34, h));
  if (h < 1.4) { const k = smooth(1.4, 0.2, h); out.lerp(h < -0.4 ? C.wet : C.sand, k); if (h < -1.5) out.lerp(C.sea, smooth(-1.5, -9, h) * 0.55); }
  if (slope > 0.55) { tmp.copy(C.rock).lerp(C.rock2, n); out.lerp(tmp, smooth(0.55, 1.1, slope)); }
  return out;
}

/* ---------- textures ---------- */
function detailTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 5000; i++) { const v = 170 + Math.random() * 85 | 0; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1; const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 5); g.stroke(); } for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
export function roadTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#3b3f46'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 1800; i++) { const v = 50 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},.6)`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); } g.fillStyle = '#e9edf2'; g.fillRect(4, 0, 4, 256); g.fillRect(120, 0, 4, 256); g.fillStyle = '#ffd23f'; g.fillRect(61, 20, 6, 100); g.fillRect(61, 148, 6, 100); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

/* ---------- the ground you see: one mesh that follows you ---------- */
export class Ground {
  constructor(app) {
    this.app = app; const mob = isMobile(); this.size = mob ? 820 : 1040; this.seg = mob ? 136 : 208;
    const geo = this.geo = new THREE.PlaneGeometry(this.size, this.size, this.seg, this.seg); geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const tex = detailTex(); tex.repeat.set(this.size / 6, this.size / 6);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.receiveShadow = true; this.mesh.userData.noCollide = true; this.mesh.userData.noCull = true; this.mesh.userData.ground = true; this.mesh.frustumCulled = false;
    app.scene.add(this.mesh); this.cx = 1e9; this.cz = 1e9; this.rebuild(app.player.position.x, app.player.position.z);
    app.onUpdate(() => { const p = app.player.position; if (Math.abs(p.x - this.cx) > 70 || Math.abs(p.z - this.cz) > 70) this.rebuild(p.x, p.z); });
  }
  rebuild(px, pz) {
    const step = this.size / this.seg; const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step; this.cx = cx; this.cz = cz;
    const pos = this.geo.attributes.position, col = this.geo.attributes.color, n = this.seg + 1; const half = this.size / 2; const col3 = new THREE.Color();
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = cx - half + i * step, z = cz - half + j * step; H[j * n + i] = terrainY(x, z); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, x = cx - half + i * step, z = cz - half + j * step, h = H[k];
      const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)], hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i]; const slope = Math.hypot(hx, hz) / (2 * step);
      pos.setXYZ(k, x, h, z); colorAt(x, z, h, slope, col3); col.setXYZ(k, col3.r, col3.g, col3.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
  }
}

/* ---------- endless chunks: roads, lots, trees, rocks, landmarks ---------- */
export const CHUNK = 200;
const roadMat = (() => { let m = null; return () => m || (m = new THREE.MeshStandardMaterial({ map: roadTex(), roughness: 0.85, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); })();
function ribbon(x1, z1, x2, z2, w, yOff, mat, step = 4) {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.ceil(len / step)); const dx = (x2 - x1) / len, dz = (z2 - z1) / len; const nx = -dz, nz = dx;
  const pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= n; i++) { const t = i / n, cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t; for (let s = 0; s < 2; s++) { const sg = s ? 1 : -1, x = cx + nx * w / 2 * sg, z = cz + nz * w / 2 * sg; const b = bridgeAt(cx, cz); const y = (b !== null ? b + 0.02 : terrainY(x, z)) + yOff; const k = i * 2 + s; pos.set([x, y, z], k * 3); uv.set([s, t * len / (w * 2)], k * 2); } if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.noCollide = true; return m;
}
export { ribbon };

export class Chunks {
  constructor(app, kit) {
    this.app = app; this.kit = kit; this.live = new Map(); this.R = 1; this.claims = new Map();
    app.onUpdate(() => this._tick());
  }
  key(i, j) { return i + ',' + j; }
  _tick() { const p = this.app.player.position; const ci = Math.floor(p.x / CHUNK), cj = Math.floor(p.z / CHUNK); if (ci === this._ci && cj === this._cj) return; this._ci = ci; this._cj = cj; const want = new Set(); for (let dj = -this.R; dj <= this.R; dj++) for (let di = -this.R; di <= this.R; di++) want.add(this.key(ci + di, cj + dj)); for (const [k, c] of this.live) if (!want.has(k)) this._drop(k, c); const q = [...want].filter(k => !this.live.has(k)); q.sort((a, b) => { const [ai, aj] = a.split(',').map(Number), [bi, bj] = b.split(',').map(Number); return (Math.abs(ai - ci) + Math.abs(aj - cj)) - (Math.abs(bi - ci) + Math.abs(bj - cj)); }); for (const k of q) { this.live.set(k, { pending: true }); } this._queue = q; this._pump(); }
  _pump() { if (this._pumping) return; this._pumping = true; const go = () => { const k = (this._queue || []).shift(); if (!k) { this._pumping = false; return; } const c = this.live.get(k); if (c && c.pending) { try { this.live.set(k, this._build(k)); } catch (e) { console.error('chunk', k, e); this.live.set(k, { group: null, obs: [] }); } } setTimeout(go, 16); }; go(); }
  _drop(k, c) { if (c.group) { this.app.scene.remove(c.group); c.group.traverse(o => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); }); } if (c.obs && c.obs.length) { const s = new Set(c.obs); this.app.obstacles = this.app.obstacles.filter(o => !s.has(o)); } if (c.acts && c.acts.length) { const s = new Set(c.acts); this.app.interactables = (this.app.interactables || []).filter(o => !s.has(o)); } if (c.spots && c.spots.length) { const s = new Set(c.spots); this.app.hotspots = this.app.hotspots.filter(o => !s.has(o)); } this.live.delete(k); }
  rebuildAt(x, z) { const k = this.key(Math.floor(x / CHUNK), Math.floor(z / CHUNK)); const c = this.live.get(k); if (c && !c.pending) { this._drop(k, c); this.live.set(k, { pending: true }); (this._queue = this._queue || []).unshift(k); this._pump(); } }
  _build(k) {
    const [i, j] = k.split(',').map(Number); const x0 = i * CHUNK, z0 = j * CHUNK, x1 = x0 + CHUNK, z1 = z0 + CHUNK;
    const g = new THREE.Group(); g.userData.noCollide = true; const obs = [], acts = [], spots = []; const R = seeded(i * 7919 + j * 104729 + 17);
    if (Math.abs(x0 - ORBIT.x) < 1000 && Math.abs(z0 - ORBIT.z) < 1000) { this.app.scene.add(g); return { group: g, obs, acts, spots }; }
    // roads crossing this chunk
    for (let gx = Math.ceil(x0 / GRID) * GRID; gx < x1; gx += GRID) g.add(ribbon(gx, z0, gx, z1, ROAD_W, 0.07, roadMat()));
    for (let gz = Math.ceil(z0 / GRID) * GRID; gz < z1; gz += GRID) { const r = ribbon(x0, gz, x1, gz, ROAD_W, 0.08, roadMat()); g.add(r); }
    const inHub = (x, z) => Math.abs(x) < HUB && Math.abs(z) < HUB;
    const ctx = { g, obs, acts, spots, R, x0, z0, x1, z1, inHub, chunks: this };
    if (this.kit && this.kit.decorate) this.kit.decorate(ctx);
    this.app.scene.add(g); return { group: g, obs, acts, spots };
  }
}

/* helper: is (x,z) clear of roads, water, paths and flats (for scattering props) */
export function openGround(x, z, pad = 4) {
  if (roadInfo(x, z).d < ROAD_W / 2 + pad + 2) return false; if (waterAt(x, z)) return false; const t = terrainY(x, z); if (t < 0.6) return false;
  for (const p of PATHS) { if (x < p.minx - 10 || x > p.maxx + 10 || z < p.minz - 10 || z > p.maxz + 10) continue; if (p.dist(x, z) < p.w + pad) return false; }
  for (const f of FLATS) { if (f.noProps === false) continue; if (f.r !== undefined) { if (Math.hypot(x - f.x, z - f.z) < f.r + pad) return false; } else if (x > f.x1 - pad && x < f.x2 + pad && z > f.z1 - pad && z < f.z2 + pad) return false; }
  return true;
}
/* a life path from points: builds dist() + level() fast lookups */
export function makePath(pts, w = 3.2) {
  const P = { pts, w, minx: 1e9, maxx: -1e9, minz: 1e9, maxz: -1e9 };
  for (const [x, z] of pts) { P.minx = Math.min(P.minx, x - w - 8); P.maxx = Math.max(P.maxx, x + w + 8); P.minz = Math.min(P.minz, z - w - 8); P.maxz = Math.max(P.maxz, z + w + 8); }
  P.dist = (x, z) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz; let t = l2 ? ((x - ax) * vx + (z - az) * vz) / l2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(x - ax - vx * t, z - az - vz * t); if (d < best) best = d; } return best; };
  P.level = (x, z) => rawH(x, z) * 0.4 + 0.4;
  PATHS.push(P); return P;
}
export const _rawH = rawH;
/* one mesh for a whole winding path (pts: [{x,z}], off = sideways offset for edge lines) */
export function ribbonPath(pts, w, yOff, mat, off = 0) {
  const n = pts.length; if (n < 2) return null; const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = []; let acc = 0;
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz, nz = dx; if (i) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    for (let s = 0; s < 2; s++) { const sg = s ? 1 : -1; const x = pts[i].x + nx * (off + sg * w / 2), z = pts[i].z + nz * (off + sg * w / 2); const y = terrainY(x, z) + yOff; const k = i * 2 + s; pos.set([x, y, z], k * 3); uv.set([s, acc / (w * 2)], k * 2); }
    if (i < n - 1) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.noCollide = true; return m;
}

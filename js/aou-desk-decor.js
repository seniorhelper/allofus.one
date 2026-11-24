/* allofus.one · the desk · decor: potted plants and a soft ground mist, all built in code (no images, no models, no textures).
   Pure builders: nothing runs at import. three.js comes in as T.
   Each plant is two meshes (foliage + stems, pot + soil), vertex colours only, no transparency, no shadows, no per-frame work.
   Size budget: at most 3,500 triangles per plant. The mist is one draw call (at most 48 soft sprites). */

/* ---------- plant list ---------- */
export const PLANTS = [
  { id: 'fern', name: 'Fern', floor: false },
  { id: 'pothos', name: 'Pothos', floor: false },
  { id: 'bonsai', name: 'Bonsai', floor: false },
  { id: 'aloe', name: 'Aloe', floor: false },
  { id: 'bamboo', name: 'Lucky bamboo', floor: false },
  { id: 'monstera', name: 'Monstera', floor: true },
  { id: 'snake', name: 'Snake plant', floor: true },
  { id: 'fiddle', name: 'Fiddle-leaf fig', floor: true },
  { id: 'peace', name: 'Peace lily', floor: true },
  { id: 'palm', name: 'Parlor palm', floor: true },
];

/* ---------- small maths ---------- */
const PI = Math.PI, GA = 2.399963229728653; /* golden angle in radians */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rad = (d) => d * PI / 180;
function rngOf(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
/* colours: hex in, linear rgb out (vertex colours are not colour-converted by three) */
const lin = (hex) => [Math.pow(((hex >> 16) & 255) / 255, 2.2), Math.pow(((hex >> 8) & 255) / 255, 2.2), Math.pow((hex & 255) / 255, 2.2)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/* ---------- geometry accumulator (this is the merge helper: everything for one mesh goes into one of these) ---------- */
const acc = () => ({ p: [], c: [], i: [], n: 0 });
function vert(A, x, y, z, c) { A.p.push(x, y, z); A.c.push(c[0], c[1], c[2]); return A.n++; }
const tri = (A, a, b, c) => { A.i.push(a, b, c); };
/* triangle whose front faces the hint direction (so shading is consistent for loose pieces) */
function triFace(A, a, b, c, hx, hy, hz) {
  const p = A.p, ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
  const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az, vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * hx + ny * hy + nz * hz >= 0) A.i.push(a, b, c); else A.i.push(a, c, b);
}
function toGeometry(T, A) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(A.c, 3));
  g.setIndex(new T.BufferAttribute(A.n > 65000 ? new Uint32Array(A.i) : new Uint16Array(A.i), 1));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/* ---------- vector helpers on plain arrays ---------- */
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* A curved line with a frame at each step. Heading az (about Y), pitch above horizontal, droop bends the pitch down along the length,
   curl swings the heading, twist rolls the frame. Returns points P, tangents Tn, sides S (horizontal, to the right), normals N (up-ish). */
function spine(x, y, z, az, pitch, len, n, droop, curl, twist) {
  const P = [], Tn = [], S = [], N = [], ds = len / n; let cx = x, cy = y, cz = z;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = az + curl * t, p = pitch - droop * t * t, cp = Math.cos(p);
    const tn = [cp * Math.sin(a), Math.sin(p), cp * Math.cos(a)], sd = [Math.cos(a), 0, -Math.sin(a)], nn = crs(tn, sd), w = twist * t, cw = Math.cos(w), sw = Math.sin(w);
    P.push([cx, cy, cz]); Tn.push(tn);
    S.push([sd[0] * cw + nn[0] * sw, sd[1] * cw + nn[1] * sw, sd[2] * cw + nn[2] * sw]);
    N.push([nn[0] * cw - sd[0] * sw, nn[1] * cw - sd[1] * sw, nn[2] * cw - sd[2] * sw]);
    /* step to the next point using the mid-step heading, so the curve is smooth */
    const t2 = (i + 0.5) / n, a2 = az + curl * t2, p2 = pitch - droop * t2 * t2, cp2 = Math.cos(p2);
    cx += cp2 * Math.sin(a2) * ds; cy += Math.sin(p2) * ds; cz += cp2 * Math.cos(a2) * ds;
  }
  return { P, Tn, S, N };
}

const X3 = [-1, 0, 1], X5 = [-1, -0.14, 0, 0.14, 1], X5M = [-1, -0.8, 0, 0.8, 1];

/* One leaf blade. Cross-section columns xs run left to right (-1..1 of the half width); the middle column is the midrib.
   The blade folds up along the midrib (fold), tapers by prof(t), droops, curls, twists and can have wavy edges (rip) and lobe notches (nick).
   Colours: dark near the stalk, lighter at the edge, a pale midrib line. */
function leaf(A, o) {
  const rows = o.rows || 10, xs = o.xs || X3, K = xs.length, sp = spine(o.x, o.y, o.z, o.az, o.pitch, o.len, rows, o.droop || 0, o.curl || 0, o.twist || 0);
  const fold = o.fold === undefined ? 0.18 : o.fold, rip = o.rip || 0, ph = o.ph || 0, back = o.back || 0, c = o.c, jit = o.j || 1, base0 = o.dark === undefined ? 0.55 : o.dark;
  const first = A.n;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, pf = o.prof(t), tone = lerp(base0, 1, sm(0, 0.5, t)) * jit, P = sp.P[i], S = sp.S[i], N = sp.N[i], Tn = sp.Tn[i];
    const tc = c.tip ? t : 0;
    for (let j = 0; j < K; j++) {
      const x = xs[j], ax = Math.abs(x), side = x < 0 ? -1 : 1;
      const w = o.wid * pf * (o.nick && ax > 0.5 ? o.nick(i, side) : 1), off = x * w;
      const up = fold * w * ax + (rip ? rip * w * ax * Math.sin(t * (o.rf || 9) + ph + (x < 0 ? 1.9 : 0)) : 0);
      const bk = back ? back * o.len * Math.pow(Math.max(0, 1 - t / 0.3), 2) * ax : 0;
      let col = ax > 0.95 ? c.edge : x === 0 ? c.rib : c.body;
      if (tc) col = mix(col, c.tip, tc * 0.7);
      col = mul(col, tone * (0.94 + 0.12 * ((i * 7 + j * 13 + (o.ph ? Math.floor(o.ph * 5) : 0)) % 5) / 4));
      vert(A, P[0] + S[0] * off + N[0] * up - Tn[0] * bk, P[1] + S[1] * off + N[1] * up - Tn[1] * bk, P[2] + S[2] * off + N[2] * up - Tn[2] * bk, col);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < K - 1; j++) {
    const a = first + i * K + j, b = a + 1, an = a + K, bn = b + K;
    tri(A, a, an, bn); tri(A, a, bn, b);
  }
  return sp;
}

/* a tapered tube along points pts with radii rs; colour from col(t) */
function tube(A, pts, rs, sides, col) {
  const m = pts.length, first = A.n; let u = null;
  for (let i = 0; i < m; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    if (!u) { const ax = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; u = nrm(crs(t, ax)); } else { const d = dot(u, t); u = nrm([u[0] - t[0] * d, u[1] - t[1] * d, u[2] - t[2] * d]); }
    const v = crs(t, u), c = col(i / (m - 1));
    for (let k = 0; k < sides; k++) { const f = k / sides * PI * 2, cf = Math.cos(f) * rs[i], sf = Math.sin(f) * rs[i]; vert(A, pts[i][0] + u[0] * cf + v[0] * sf, pts[i][1] + u[1] * cf + v[1] * sf, pts[i][2] + u[2] * cf + v[2] * sf, c); }
  }
  for (let i = 0; i < m - 1; i++) for (let k = 0; k < sides; k++) {
    const a = first + i * sides + k, b = first + i * sides + (k + 1) % sides, an = a + sides, bn = first + (i + 1) * sides + (k + 1) % sides;
    tri(A, a, b, an); tri(A, b, bn, an);
  }
}
const bez = (p0, p1, p2, n) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; o.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]]); } return o; };
const tipDir = (pts) => { const a = pts[pts.length - 2], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; return { az: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
const taper = (n, r0, r1) => { const o = []; for (let i = 0; i < n; i++) o.push(lerp(r0, r1, i / (n - 1))); return o; };

/* a small flat diamond leaf (used for bonsai and for the frond pinnae) */
function diamond(A, bx, by, bz, d, len, wid, c0, c1, hint) {
  const wv = nrm(crs(d, hint)), mx = bx + d[0] * len * 0.38, my = by + d[1] * len * 0.38, mz = bz + d[2] * len * 0.38;
  const a = vert(A, bx, by, bz, c0), l = vert(A, mx + wv[0] * wid, my + wv[1] * wid, mz + wv[2] * wid, mix(c0, c1, 0.5)), r = vert(A, mx - wv[0] * wid, my - wv[1] * wid, mz - wv[2] * wid, mix(c0, c1, 0.5)), t = vert(A, bx + d[0] * len, by + d[1] * len, bz + d[2] * len, c1);
  triFace(A, a, l, r, hint[0], hint[1], hint[2]); triFace(A, l, t, r, hint[0], hint[1], hint[2]);
}

/* A fern or palm frond: a flat rachis ribbon with pairs of narrow pinnae (diamonds), shorter toward the tip and drooping at their ends. */
function frond(A, o) {
  const n = o.pairs, sp = spine(o.x, o.y, o.z, o.az, o.pitch, o.len, n, o.droop, o.curl || 0, o.twist || 0), rc = o.rachis, f0 = A.n;
  for (let i = 0; i <= n; i++) { const P = sp.P[i], S = sp.S[i], w = lerp(0.0032, 0.0012, i / n) * (o.thick || 1), c = mul(rc, lerp(0.75, 1.1, i / n)); vert(A, P[0] - S[0] * w, P[1] - S[1] * w, P[2] - S[2] * w, c); vert(A, P[0] + S[0] * w, P[1] + S[1] * w, P[2] + S[2] * w, c); }
  for (let i = 0; i < n; i++) { const a = f0 + i * 2; triFace(A, a, a + 1, a + 2, sp.N[i][0], sp.N[i][1], sp.N[i][2]); triFace(A, a + 1, a + 3, a + 2, sp.N[i][0], sp.N[i][1], sp.N[i][2]); }
  for (let i = 1; i <= n; i++) {
    const t = i / n, P = sp.P[i], S = sp.S[i], N = sp.N[i], Tn = sp.Tn[i];
    const pl = o.pLen * Math.pow(1 - Math.pow(t, 1.7), 0.8) * (0.5 + 0.5 * Math.min(1, t / 0.28)) * (0.9 + 0.2 * o.r());
    if (pl < 0.004) continue;
    for (let s = -1; s <= 1; s += 2) {
      const ca = Math.cos(o.pAng), sa = Math.sin(o.pAng) * s, dr = o.pDroop + (o.r() - 0.5) * 0.2;
      const d = nrm([Tn[0] * ca + S[0] * sa - N[0] * dr, Tn[1] * ca + S[1] * sa - N[1] * dr, Tn[2] * ca + S[2] * sa - N[2] * dr]);
      const g = mix(o.dark, o.light, 0.15 + 0.85 * t);
      diamond(A, P[0], P[1], P[2], d, pl, pl * o.pWid, mul(g, 0.8), mul(g, 1.12), N);
    }
  }
}

/* ---------- pots ---------- */
function revolve(A, prof, seg, colAt) {
  const first = A.n, m = prof.length;
  for (let j = 0; j < m; j++) for (let k = 0; k < seg; k++) { const f = k / seg * PI * 2; vert(A, Math.cos(f) * prof[j][0], prof[j][1], Math.sin(f) * prof[j][0], colAt(j, k, prof[j][1])); }
  for (let j = 0; j < m - 1; j++) for (let k = 0; k < seg; k++) { const a = first + j * seg + k, b = first + j * seg + (k + 1) % seg, an = a + seg, bn = b + seg; tri(A, a, an, b); tri(A, b, an, bn); }
}
/* pot with rim, saucer, soil mound and a scatter of bark chips. Returns the soil height. */
function makePot(A, R, o) {
  const seg = 14, h = o.h, rt = o.rt, rb = o.rb, rim = o.rimT || 0.012, rimH = o.rimH || 0.03, col = o.color, glaze = !!o.glaze;
  const prof = [[rb * 0.78, 0], [rb, 0.01], [lerp(rb, rt, 0.5) + 0.003, h * 0.5], [rt, h - rimH], [rt + rim, h - rimH + 0.004], [rt + rim, h], [rt - 0.005, h], [rt - 0.012, h - 0.02]];
  revolve(A, prof, seg, (j, k, y) => { let c = mul(col, lerp(0.78, 1.05, y / h) * (0.96 + 0.08 * ((k * 5 + j) % 3) / 2)); if (!glaze && j >= 4 && j <= 5) c = mix(c, [0.62, 0.55, 0.48], 0.35); if (j === 7) c = mul(c, 0.55); return c; });
  const rs = rb * 1.28 + 0.012, sc = o.saucer || mul(col, 0.85);
  revolve(A, [[0.01, 0.0], [rs - 0.012, 0.0], [rs, 0.016], [rs - 0.007, 0.016], [rb * 0.9, 0.007]], seg, (j) => (j > 3 ? mul(sc, 0.6) : sc));
  const sy = h - 0.026, sr = rt - 0.013, soil = lin(0x3a2a1f), f0 = A.n;
  vert(A, 0, sy + 0.007, 0, soil);
  for (let k = 0; k < seg; k++) { const f = k / seg * PI * 2, r1 = sr * 0.55; vert(A, Math.cos(f) * r1, sy + 0.003 + R() * 0.004, Math.sin(f) * r1, mul(soil, 0.85 + R() * 0.3)); }
  for (let k = 0; k < seg; k++) { const f = k / seg * PI * 2; vert(A, Math.cos(f) * sr, sy, Math.sin(f) * sr, mul(soil, 0.75 + R() * 0.2)); }
  for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; tri(A, f0, f0 + 1 + k, f0 + 1 + k2); const a = f0 + 1 + k, b = f0 + 1 + k2, an = a + seg, bn = b + seg; tri(A, a, an, b); tri(A, b, an, bn); }
  const chips = o.chips === undefined ? 16 : o.chips, chipCol = o.pebble ? lin(0xb8b2a4) : lin(0x6a4a30);
  for (let i = 0; i < chips; i++) {
    const f = R() * PI * 2, r = Math.sqrt(R()) * sr * 0.9, x = Math.cos(f) * r, z = Math.sin(f) * r, y = sy + 0.007 * (1 - r / sr) + 0.003, a = R() * PI * 2, L = 0.012 + R() * 0.012, tn = lerp(0.7, 1.25, R());
    const d = [Math.cos(a), 0.05, Math.sin(a)], wv = [-Math.sin(a), 0, Math.cos(a)], c = mul(chipCol, tn);
    const v0 = vert(A, x - d[0] * L * 0.5, y, z - d[2] * L * 0.5, c), v1 = vert(A, x + wv[0] * L * 0.35, y + 0.002, z + wv[2] * L * 0.35, c), v2 = vert(A, x + d[0] * L * 0.5, y, z + d[2] * L * 0.5, c), v3 = vert(A, x - wv[0] * L * 0.35, y + 0.002, z - wv[2] * L * 0.35, c);
    triFace(A, v0, v1, v2, 0, 1, 0); triFace(A, v0, v2, v3, 0, 1, 0);
  }
  return sy;
}
const TERRA = lin(0xb4623b), TERRA2 = lin(0xc47a4d);
const GLAZE = { white: lin(0xe8e4da), char: lin(0x34383d), sage: lin(0x8da08a), blush: lin(0xd6b3a6), navy: lin(0x2f4358), sand: lin(0xcdbd9f) };

/* leaf outline helpers */
const lanceP = (a, b) => (t) => Math.pow(Math.max(0, Math.sin(PI * Math.pow(t, a))), b);
const jitterCol = (R, c, k) => mul(c, 1 + (R() - 0.5) * k);

/* ---------- the plants ---------- */
const BUILD = {
  monstera(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.15, rb: 0.11, h: 0.27, color: R() < 0.5 ? TERRA : GLAZE.char, glaze: false });
    const n = 13;
    for (let i = 0; i < n; i++) {
      const age = i / (n - 1), az = i * GA + (R() - 0.5) * 0.3, ca = Math.cos(az), sa = Math.sin(az);
      const reach = 0.08 + 0.22 * (1 - age) * (0.55 + 0.45 * R()) + 0.04, tipH = sy + 0.42 + 0.5 * (0.35 * (1 - age) + 0.65 * (age * 0.6 + 0.4 * R()));
      const r0 = 0.02 + 0.03 * R(), p0 = [ca * r0, sy, sa * r0], p2 = [ca * reach, tipH, sa * reach], p1 = [ca * reach * 0.12, tipH + 0.05, sa * reach * 0.12];
      const pts = bez(p0, p1, p2, 6), pd = pts[pts.length - 1], td = tipDir(pts);
      const young = age * age, stem = mix(lin(0x4f8a45), lin(0x8fb25a), young);
      tube(F, pts, taper(7, 0.0075, 0.0042), 5, (t) => mix(mul(stem, 0.8), stem, t));
      const len = (0.4 - 0.1 * age) * (0.88 + 0.24 * R()), body = mix(lin(0x1d5428), lin(0x4f9a3f), young * 0.8);
      leaf(F, {
        x: pd[0], y: pd[1], z: pd[2], az: td.az + (R() - 0.5) * 0.5, pitch: rad(-8 - 22 * (1 - age)) + (R() - 0.5) * 0.25, len, wid: len * 0.46, rows: 12, xs: X5, droop: 0.7 + R() * 0.7, curl: (R() - 0.5) * 0.5, twist: (R() - 0.5) * 0.5, fold: 0.1 + 0.08 * R(), back: 0.2, rip: 0.03, ph: R() * 6,
        prof: (t) => Math.pow(Math.max(0, Math.sin(PI * Math.pow(t, 0.62))), 0.8) + 0.22 * Math.pow(Math.max(0, 1 - t / 0.2), 2),
        nick: (i, s) => { const k = i % 2 === 1 && i >= 3 && i <= 10 ? 0.5 + 0.12 * ((i * 3 + (s > 0 ? 1 : 0)) % 3) : 1; return k; },
        c: { body, edge: mul(body, 1.28), rib: mix(body, lin(0xd2e6b0), 0.55), tip: mul(body, 1.1) }, j: 0.9 + 0.2 * R(),
      });
    }
  },

  snake(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.15, rb: 0.115, h: 0.25, color: R() < 0.5 ? GLAZE.char : GLAZE.white, glaze: true, pebble: true });
    const n = 14;
    for (let i = 0; i < n; i++) {
      const az = i * GA + (R() - 0.5) * 0.3, rr = 0.015 + 0.075 * Math.sqrt((i + 0.5) / n) * (0.7 + 0.3 * R()), lean = rad(4 + 22 * (rr / 0.09) * (0.5 + R() * 0.7));
      const tall = 0.6 + 0.4 * (1 - rr / 0.1) * (0.6 + 0.4 * R()), len = 0.95 * tall, ph = R() * 6, dk = lin(0x1c4a2b), lt = lin(0x5c9763), yel = lin(0xcfc866);
      leaf(F, {
        x: Math.cos(az) * rr, y: sy, z: Math.sin(az) * rr, az, pitch: rad(90) - lean, len, wid: 0.036 + 0.02 * R(), rows: 14, xs: X5M, droop: 0.15 + 0.45 * R(), curl: (R() - 0.5) * 0.7, twist: (R() - 0.5) * 1.6, fold: 0.3, ph, dark: 0.7,
        prof: (t) => (t < 0.25 ? lerp(0.55, 1, sm(0, 0.25, t)) : Math.pow(Math.max(0, 1 - (t - 0.25) / 0.75), 0.75)),
        c: { body: mix(dk, lt, 0.5), edge: yel, rib: mix(dk, lt, 0.65), tip: mix(dk, lt, 0.35) }, j: 0.92 + 0.16 * R(),
        stripe: ph,
      });
    }
    /* banding: darken alternate stripes along each blade by tone, done on the colour buffer below */
    const c = F.c, per = 15 * 5; /* rows (14+1) x 5 columns */
    for (let b = 0; b < n; b++) {
      const base = b * per, ph = (b * 1.7) % 6;
      for (let r = 0; r <= 14; r++) { const band = 0.78 + 0.22 * Math.sin(r / 14 * 33 + ph) ; for (let k = 0; k < 5; k++) { const vi = (base + r * 5 + k) * 3; if (k === 0 || k === 4) continue; c[vi] *= band; c[vi + 1] *= band; c[vi + 2] *= band; } }
    }
  },

  fern(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.088, rb: 0.065, h: 0.12, color: R() < 0.5 ? TERRA2 : GLAZE.sage, glaze: false });
    const n = 17;
    for (let i = 0; i < n; i++) {
      const age = i / (n - 1), az = i * GA + (R() - 0.5) * 0.3, r0 = 0.01 + 0.02 * R(), lt = mix(lin(0x2f7a35), lin(0x6dba4a), age * 0.7 + R() * 0.15);
      frond(F, {
        x: Math.cos(az) * r0, y: sy, z: Math.sin(az) * r0, az, pitch: rad(70 - 38 * (1 - age)) + (R() - 0.5) * 0.2, len: (0.2 + 0.1 * (1 - age * 0.5)) * (0.85 + 0.3 * R()), pairs: 18, droop: 1.3 + R() * 0.7, curl: (R() - 0.5) * 0.6, twist: (R() - 0.5) * 0.4,
        pLen: 0.062, pWid: 0.24, pAng: 1.15, pDroop: 0.45, rachis: lin(0x4a6f35), dark: mul(lt, 0.6), light: lt, r: R,
      });
    }
  },

  fiddle(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.17, rb: 0.125, h: 0.28, color: R() < 0.5 ? GLAZE.sage : GLAZE.sand, glaze: true });
    const lean = (R() - 0.5) * 0.1, top = [lean, sy + 0.92, (R() - 0.5) * 0.06], pts = bez([0, sy, 0], [-lean * 1.5, sy + 0.5, 0.02], top, 10);
    tube(F, pts, taper(11, 0.017, 0.0075), 6, (t) => mix(lin(0x6e5a44), lin(0x8a7a5a), t));
    const n = 19;
    for (let i = 0; i < n; i++) {
      const f = lerp(0.32, 1, i / (n - 1)), k = f * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(k)), q = k - a, p = [lerp(pts[a][0], pts[a + 1][0], q), lerp(pts[a][1], pts[a + 1][1], q), lerp(pts[a][2], pts[a + 1][2], q)];
      const az = i * GA + (R() - 0.5) * 0.25, len = lerp(0.34, 0.2, f) * (0.88 + 0.24 * R()), body = mix(lin(0x2a6630), lin(0x4d8f3a), f * f * 0.6 + R() * 0.1);
      leaf(F, {
        x: p[0] + Math.sin(az) * 0.012, y: p[1], z: p[2] + Math.cos(az) * 0.012, az, pitch: rad(8 + 48 * f * f + 14 * R()), len, wid: len * 0.32, rows: 12, xs: X5, droop: lerp(0.9, 0.35, f) + 0.2 * R(), curl: (R() - 0.5) * 0.5, twist: (R() - 0.5) * 0.6, fold: 0.22, rip: 0.08, rf: 11, ph: R() * 6, dark: 0.7,
        prof: (t) => Math.pow(Math.max(0, Math.sin(PI * Math.pow(t, 1.25))), 0.85) * (1 - 0.3 * Math.exp(-Math.pow((t - 0.3) / 0.11, 2))) + 0.05 * (1 - t),
        c: { body, edge: mul(body, 1.22), rib: mix(body, lin(0xdfe6b0), 0.6), tip: mul(body, 1.1) }, j: 0.92 + 0.16 * R(),
      });
    }
  },

  pothos(F, Pm, R) {
    const h = 0.13, sy = makePot(Pm, R, { rt: 0.085, rb: 0.066, h, color: R() < 0.5 ? GLAZE.white : GLAZE.blush, glaze: true }), rt = 0.085;
    const yellow = lin(0xc9c24a), green = lin(0x2f7a38), nv = 8, m = 9;
    for (let v = 0; v < nv; v++) {
      const th0 = v * GA + (R() - 0.5) * 0.4, D = 0.1 + 0.2 * R(), ph = R() * 6, pts = [];
      for (let j = 0; j <= m; j++) {
        const u = j / m, th = th0 + 0.3 * Math.sin(u * 5 + ph) * u, r0 = rt * (0.2 + 0.85 * sm(0, 0.35, u)) + 0.02 + 0.03 * Math.max(0, u - 0.35);
        const raw = 0.05 * Math.sin(PI * sm(0, 0.4, u)) - D * Math.pow(sm(0.4, 1, u), 1.2), y0 = h + raw, y = Math.max(0.034, y0), r = r0 + (y - y0) * 0.9;
        pts.push([Math.cos(th) * r, v === 0 && j < 3 ? Math.max(y, sy + 0.02 * j) : y, Math.sin(th) * r]);
      }
      tube(F, pts, taper(m + 1, 0.0028, 0.0016), 4, () => lin(0x5c7a3a));
      for (let j = 2; j <= m; j++) {
        const u = j / m, p = pts[j], ax = Math.atan2(p[0], p[2]), sd = (j + v) % 2 ? 1 : -1, size = (0.052 + 0.014 * R()) * (1 - 0.35 * u) , vr = R() < 0.55 ? 0.15 + 0.5 * R() : 0.0;
        const body = mix(green, yellow, vr * 0.8);
        leaf(F, {
          x: p[0], y: p[1] + 0.003, z: p[2], az: ax + sd * (0.5 + 0.5 * R()), pitch: rad(-20 - 30 * R()), len: size, wid: size * 0.46, rows: 5, xs: X3, droop: 0.5, curl: sd * 0.3, twist: sd * 0.3, fold: 0.15, back: 0.22, ph: R() * 6,
          prof: (t) => Math.pow(Math.max(0, Math.sin(PI * Math.pow(t, 0.7))), 0.75) + 0.25 * Math.pow(Math.max(0, 1 - t / 0.2), 2),
          c: { body, edge: mul(mix(body, yellow, 0.2), 1.15), rib: mix(body, lin(0xe5ee9a), 0.45), tip: mul(body, 1.1) }, j: 0.9 + 0.2 * R(),
        });
      }
    }
    /* an upright bunch in the middle */
    for (let i = 0; i < 6; i++) {
      const az = i * GA, r0 = 0.015 + 0.02 * R(), top = [Math.cos(az) * (r0 + 0.02), h + 0.1 + 0.07 * R(), Math.sin(az) * (r0 + 0.02)], pts = bez([Math.cos(az) * r0, sy, Math.sin(az) * r0], [Math.cos(az) * r0, h + 0.03, Math.sin(az) * r0], top, 4);
      tube(F, pts, taper(5, 0.0026, 0.0018), 4, () => lin(0x5c7a3a));
      leaf(F, { x: top[0], y: top[1], z: top[2], az, pitch: rad(40), len: 0.07, wid: 0.032, rows: 5, xs: X3, droop: 0.7, fold: 0.15, back: 0.22, ph: R() * 6, prof: (t) => Math.pow(Math.max(0, Math.sin(PI * Math.pow(t, 0.7))), 0.75) + 0.25 * Math.pow(Math.max(0, 1 - t / 0.2), 2), c: { body: green, edge: mul(green, 1.2), rib: mix(green, lin(0xe5ee9a), 0.45) }, j: 1 });
    }
  },

  bonsai(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.115, rb: 0.092, h: 0.05, rimT: 0.008, rimH: 0.015, color: R() < 0.5 ? GLAZE.navy : lin(0x6d4a38), glaze: true, chips: 10, pebble: true });
    const bark = lin(0x4a3a2c), bk2 = lin(0x6c5842);
    const trunk = bez([0.008, sy, 0], [0.07, sy + 0.12, 0.03], [-0.02, sy + 0.2, 0.01], 9);
    tube(F, trunk, taper(10, 0.0155, 0.0055), 6, (t) => mix(bark, bk2, t));
    const at = (f) => { const k = f * 9, a = Math.min(8, Math.floor(k)), q = k - a; return [lerp(trunk[a][0], trunk[a + 1][0], q), lerp(trunk[a][1], trunk[a + 1][1], q), lerp(trunk[a][2], trunk[a + 1][2], q)]; };
    const pads = [{ p: trunk[9], r: [0.058, 0.02, 0.05] }];
    [[0.45, 0.7, 0.11], [0.62, 3.0, 0.1], [0.75, 4.6, 0.085], [0.3, 2.1, 0.085]].forEach(([f, a, d], i) => {
      const s = at(f), e = [s[0] + Math.cos(a) * d, s[1] + 0.03 + 0.025 * i * 0.3, s[2] + Math.sin(a) * d];
      tube(F, bez(s, [s[0] + Math.cos(a) * d * 0.5, s[1] - 0.005, s[2] + Math.sin(a) * d * 0.5], e, 4), taper(5, 0.0065, 0.003), 5, (t) => mix(bark, bk2, t));
      pads.push({ p: [e[0], e[1] + 0.012, e[2]], r: [0.05 - i * 0.004, 0.017, 0.045 - i * 0.004] });
    });
    pads.forEach((pd, pi) => {
      const cnt = pi === 0 ? 85 : 70;
      for (let i = 0; i < cnt; i++) {
        const u = R() * 2 - 1, v = R() * 2 - 1, w = R() * 2 - 1, l = Math.hypot(u, v, w) || 1, k = Math.pow(R(), 0.35), ex = u / l * k, ey = v / l * k, ez = w / l * k;
        const y01 = (ey + 1) / 2, a = R() * PI * 2, tilt = (R() - 0.5) * 0.9, d = nrm([Math.cos(a) * Math.cos(tilt), Math.sin(tilt) + 0.15, Math.sin(a) * Math.cos(tilt)]);
        const c1 = mix(lin(0x1f4d28), lin(0x58963f), y01 * 0.75 + R() * 0.25);
        diamond(F, pd.p[0] + ex * pd.r[0], pd.p[1] + ey * pd.r[1], pd.p[2] + ez * pd.r[2], d, 0.022 + 0.008 * R(), 0.0085, mul(c1, 0.7), c1, [0, 1, 0]);
      }
    });
  },

  aloe(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.078, rb: 0.057, h: 0.1, color: TERRA, glaze: false });
    const rosette = (cx, cz, scale, count) => {
      for (let i = 0; i < count; i++) {
        const age = i / (count - 1), az = i * GA + (R() - 0.5) * 0.2, len = (0.2 + 0.1 * (0.5 + 0.5 * R())) * scale * (1 - 0.15 * age), rr = 0.006 * scale + 0.01 * scale * (1 - age);
        const body = mix(lin(0x5f8d6c), lin(0x86ae82), R() * 0.6), dk = mul(body, 0.8);
        leaf(F, {
          x: cx + Math.cos(az) * rr, y: sy, z: cz + Math.sin(az) * rr, az, pitch: rad(80 - 52 * (1 - age) * (0.7 + 0.3 * R())), len, wid: 0.021 * scale, rows: 7, xs: X3, droop: 0.1 + 0.45 * (1 - age), curl: (R() - 0.5) * 0.4, twist: (R() - 0.5) * 0.4, fold: 0.6, dark: 0.7,
          prof: (t) => (t < 0.15 ? lerp(0.7, 1, t / 0.15) : Math.pow(Math.max(0, 1 - (t - 0.15) / 0.85), 0.9)),
          c: { body: dk, edge: mix(body, lin(0xc9d9a6), 0.4), rib: body, tip: body }, j: 0.92 + 0.16 * R(),
        });
      }
    };
    rosette(0, 0, 1, 16);
    for (let i = 0; i < 3; i++) { const a = 0.6 + i * 2.1, rr = 0.047; rosette(Math.cos(a) * rr, Math.sin(a) * rr, 0.42, 6); }
  },

  bamboo(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.062, rb: 0.056, h: 0.11, rimT: 0.006, rimH: 0.012, color: GLAZE.white, glaze: true, chips: 22, pebble: true });
    const cnt = 5;
    for (let i = 0; i < cnt; i++) {
      const a = i * GA, rr = i === 0 ? 0.004 : 0.018 + 0.012 * R(), H = (0.15 + 0.09 * R()) * (i === 0 ? 1.15 : 1), x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr, lx = (R() - 0.5) * 0.035, lz = (R() - 0.5) * 0.035, nseg = 12;
      const pts = bez([x0, sy, z0], [x0 + lx * 0.4, sy + H * 0.55, z0 + lz * 0.4], [x0 + lx, sy + H, z0 + lz], nseg), rs = [], nodes = [0.3, 0.55, 0.8];
      for (let j = 0; j <= nseg; j++) { const t = j / nseg; let b = 1; nodes.forEach((nt) => { b += 0.3 * Math.exp(-Math.pow((t - nt) / 0.035, 2)); }); rs.push(0.0062 * b * (1 - 0.15 * t)); }
      tube(F, pts, rs, 6, (t) => { let k = 0; nodes.forEach((nt) => { k = Math.max(k, Math.exp(-Math.pow((t - nt) / 0.04, 2))); }); return mix(lin(0x7aae45), lin(0xc4c868), k * 0.7); });
      const top = pts[nseg];
      for (let l = 0; l < 4; l++) {
        const az = l * 1.9 + R(), len = 0.11 + 0.04 * R();
        leaf(F, { x: top[0], y: top[1] - 0.012, z: top[2], az, pitch: rad(48 + 14 * R()), len, wid: 0.0125, rows: 5, xs: X3, droop: 1.0 + 0.5 * R(), fold: 0.3, curl: (R() - 0.5) * 0.5, prof: lanceP(0.8, 0.9), c: { body: lin(0x3f8a3a), edge: lin(0x5ea64a), rib: lin(0x9ccf70), tip: lin(0x4f9a44) }, j: 0.9 + 0.2 * R() });
      }
    }
  },

  peace(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.15, rb: 0.11, h: 0.24, color: R() < 0.5 ? TERRA : GLAZE.white, glaze: false });
    const n = 15;
    for (let i = 0; i < n; i++) {
      const age = i / (n - 1), az = i * GA + (R() - 0.5) * 0.3, ca = Math.cos(az), sa = Math.sin(az);
      const reach = 0.08 + 0.2 * (1 - age) * (0.6 + 0.4 * R()), tipH = sy + 0.26 + 0.28 * (0.4 * (1 - age) + 0.6 * R() * (0.4 + age)), r0 = 0.015 + 0.025 * R();
      const pts = bez([ca * r0, sy, sa * r0], [ca * reach * 0.2, tipH + 0.02, sa * reach * 0.2], [ca * reach, tipH, sa * reach], 5), pd = pts[5], td = tipDir(pts);
      tube(F, pts, taper(6, 0.0045, 0.003), 5, (t) => mix(lin(0x3a6a34), lin(0x5f9444), t));
      const len = (0.27 - 0.05 * age) * (0.85 + 0.3 * R()), body = mix(lin(0x1b4d26), lin(0x3c8238), age * 0.7);
      leaf(F, {
        x: pd[0], y: pd[1], z: pd[2], az: td.az + (R() - 0.5) * 0.3, pitch: rad(2 + 10 * R()), len, wid: len * 0.19, rows: 9, xs: X5, droop: 0.6 + 0.6 * R(), curl: (R() - 0.5) * 0.4, twist: (R() - 0.5) * 0.4, fold: 0.15, rip: 0.07, rf: 13, ph: R() * 6, dark: 0.7,
        prof: lanceP(0.85, 0.8), c: { body, edge: mul(body, 1.18), rib: mix(body, lin(0xa8cc88), 0.5), tip: mul(body, 1.08) }, j: 0.92 + 0.16 * R(),
      });
    }
    for (let i = 0; i < 3; i++) {
      const az = 0.8 + i * 2.2 + R() * 0.4, ca = Math.cos(az), sa = Math.sin(az), H = sy + 0.62 + 0.14 * R(), lx = 0.06 * (R() + 0.3), r0 = 0.02;
      const pts = bez([ca * r0, sy, sa * r0], [ca * lx * 0.4, sy + (H - sy) * 0.6, sa * lx * 0.4], [ca * lx, H, sa * lx], 6);
      tube(F, pts, taper(7, 0.0034, 0.0026), 5, () => lin(0x4f8240));
      const td = tipDir(pts), sp = pts[6];
      leaf(F, { x: sp[0], y: sp[1] - 0.005, z: sp[2], az, pitch: rad(70), len: 0.15, wid: 0.045, rows: 6, xs: X3, droop: 1.0, fold: 0.22, ph: R() * 6, prof: lanceP(0.75, 0.75), c: { body: lin(0xf0f1e6), edge: lin(0xfbfbf4), rib: lin(0xb7cc9c), tip: lin(0xf6f6ee) }, j: 1, dark: 0.85 });
      tube(F, [[sp[0], sp[1] - 0.004, sp[2]], [sp[0] + ca * 0.008, sp[1] + 0.03, sp[2] + sa * 0.008], [sp[0] + ca * 0.018, sp[1] + 0.058, sp[2] + sa * 0.018]], [0.0042, 0.0042, 0.0028], 5, (t) => mix(lin(0xe8dca0), lin(0xf0e6b0), t));
      void td;
    }
  },

  palm(F, Pm, R) {
    const sy = makePot(Pm, R, { rt: 0.16, rb: 0.12, h: 0.26, color: R() < 0.5 ? GLAZE.char : TERRA2, glaze: false });
    const n = 9;
    for (let i = 0; i < n; i++) {
      const age = i / (n - 1), az = i * GA + (R() - 0.5) * 0.3, ca = Math.cos(az), sa = Math.sin(az), r0 = 0.012 + 0.04 * R(), H = sy + 0.55 + 0.28 * (0.5 + 0.5 * R()) * (0.7 + 0.3 * age), out = 0.04 + 0.16 * (1 - age) * (0.5 + 0.5 * R());
      const pts = bez([ca * r0, sy, sa * r0], [ca * (r0 + out * 0.3), sy + (H - sy) * 0.6, sa * (r0 + out * 0.3)], [ca * (r0 + out), H, sa * (r0 + out)], 8), top = pts[8], td = tipDir(pts);
      tube(F, pts, taper(9, 0.0068, 0.0042), 5, (t) => mix(lin(0x7aa04a), lin(0x4a7a36), t));
      const lt = mix(lin(0x2f7a3a), lin(0x58a84a), age * 0.6 + R() * 0.2);
      frond(F, {
        x: top[0], y: top[1], z: top[2], az: az + (R() - 0.5) * 0.4, pitch: Math.max(0.5, td.pitch * 0.8), len: 0.52 + 0.14 * R(), pairs: 15, droop: 1.9 + 0.6 * R(), curl: (R() - 0.5) * 0.6, twist: 0,
        pLen: 0.19, pWid: 0.1, pAng: 1.1, pDroop: 0.5, rachis: lin(0x3f7a38), dark: mul(lt, 0.62), light: lt, r: R, thick: 1.6,
      });
    }
  },
};

/* sizes are checked by the build test: desk plants 0.25-0.45 m, floor plants 0.9-1.5 m */
export function makePlant(T, id, seed) {
  const build = BUILD[id], meta = PLANTS.find((p) => p.id === id);
  if (!build || !meta) return null;
  const R = rngOf((seed | 0) * 7919 + hashStr(id)), F = acc(), Pm = acc();
  build(F, Pm, R);
  const matF = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.6, metalness: 0 });
  const matP = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.7, metalness: 0 });
  const g = new T.Group(); g.name = 'plant-' + id;
  const foliage = new T.Mesh(toGeometry(T, F), matF), pot = new T.Mesh(toGeometry(T, Pm), matP);
  foliage.name = 'foliage'; pot.name = 'pot'; g.add(foliage); g.add(pot);
  foliage.castShadow = false; foliage.receiveShadow = false; pot.castShadow = false; pot.receiveShadow = false;
  g.userData = { id, floor: meta.floor, mats: [matF, matP], tris: (F.i.length + Pm.i.length) / 3 };
  return g;
}

/* ---------- mist ---------- */
const MIST_VERT = `
attribute vec4 aA; attribute vec4 aB;
uniform float uTime; uniform vec3 uBox;
varying vec2 vUv; varying float vAlpha;
void main(){
  float f = fract(aA.x + uTime * aB.x);
  float x = (f - 0.5) * uBox.x;
  float z = (aA.y - 0.5) * uBox.z + 0.06 * sin(uTime * 0.11 * aB.x * 90.0 + aA.z);
  float breathe = 0.65 + 0.35 * sin(uTime * (0.18 + aB.z * 0.2) + aA.z * 3.0);
  float y = uBox.y * (aB.y * 0.7 + 0.1 * sin(uTime * 0.13 + aA.z * 2.0));
  float edge = smoothstep(0.0, 0.14, f) * smoothstep(1.0, 0.86, f);
  vAlpha = aB.w * breathe * edge;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
  mv.xy += position.xy * aA.w;
  gl_Position = projectionMatrix * mv;
}`;
const MIST_FRAG = `
uniform vec3 uColor; uniform float uLevel;
varying vec2 vUv; varying float vAlpha;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, d);
  a *= a;
  float al = a * vAlpha * uLevel;
  if (al < 0.002) discard;
  gl_FragColor = vec4(uColor, al);
}`;
export function makeMist(T, opts) {
  const o = opts || {}, width = +o.width > 0 ? +o.width : 2, depth = +o.depth > 0 ? +o.depth : 2, height = +o.height > 0 ? +o.height : 0.4, count = Math.max(1, Math.min(48, o.count | 0 || 22));
  const color = new T.Color(o.color === undefined ? 0xdde8f0 : o.color), R = rngOf(o.seed === undefined ? 4242 : o.seed | 0);
  const quad = new T.PlaneGeometry(1, 1), geo = new T.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv); geo.instanceCount = count;
  const a = new Float32Array(count * 4), b = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    a[i * 4] = R(); a[i * 4 + 1] = (i + R() * 0.8) / count; a[i * 4 + 2] = R() * 6.28; a[i * 4 + 3] = 0.7 + 0.5 * R(); /* size 0.7 to 1.2 m: fewer, larger, softer */
    b[i * 4] = 0.0035 + 0.006 * R(); b[i * 4 + 1] = R(); b[i * 4 + 2] = R(); b[i * 4 + 3] = 0.09 + 0.07 * R(); /* peak alpha 0.09 to 0.16 */
  }
  geo.setAttribute('aA', new T.InstancedBufferAttribute(a, 4)); geo.setAttribute('aB', new T.InstancedBufferAttribute(b, 4));
  const mat = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uBox: { value: new T.Vector3(width, height, depth) }, uColor: { value: color }, uLevel: { value: 1 } }, vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false, depthTest: true, side: T.DoubleSide });
  const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.name = 'mist'; mesh.renderOrder = 5;
  const object = new T.Object3D(); object.name = 'mist-root'; object.add(mesh);
  return {
    object, count,
    update(timeMs) { mat.uniforms.uTime.value = (+timeMs || 0) * 0.001; },
    /* 0 hides it; 1 is the full (still faint) look */
    setLevel(v) { const k = clamp(+v || 0, 0, 1); mat.uniforms.uLevel.value = k; object.visible = k > 0; },
    resize(w, d, h) { mat.uniforms.uBox.value.set(w, h, d); },
  };
}

/* ---------- clean-up ---------- */
export function disposeGroup(obj) {
  if (!obj) return;
  obj.traverse((n) => {
    if (n.geometry && n.geometry.dispose) n.geometry.dispose();
    const m = n.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { if (x && x.dispose) x.dispose(); });
  });
}

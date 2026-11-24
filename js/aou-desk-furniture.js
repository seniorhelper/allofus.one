/* allofus.one · the desk · furniture: a leather couch and armchair, a floor lamp, a rug, a bookshelf and a side table, all built in code
   (no images, no models, no textures). Pure builders: nothing runs at import. three.js comes in as T.
   Every piece stands on y = 0, in real metres, with its front toward +z. At most 2 draw calls and 2,500 triangles per piece,
   MeshStandardMaterial with vertex colours, no transparency, no shadows, no per-frame work.
   group.userData = { id, mats: [every material], glow?: the lamp shade material (the caller may dim it) }. */

export const FURNITURE = [
  { id: 'couch', name: 'Leather couch' },
  { id: 'armchair', name: 'Armchair' },
  { id: 'lamp', name: 'Floor lamp' },
  { id: 'rug', name: 'Woven rug' },
  { id: 'shelf', name: 'Bookshelf' },
  { id: 'sidetable', name: 'Side table' },
];

/* ---------- small maths ---------- */
const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rngOf(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
/* colours: hex in, linear rgb out (vertex colours are not colour-converted by three) */
const lin = (hex) => [Math.pow(((hex >> 16) & 255) / 255, 2.2), Math.pow(((hex >> 8) & 255) / 255, 2.2), Math.pow((hex & 255) / 255, 2.2)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/* ---------- geometry accumulator (the merge helper: everything for one mesh goes into one of these) ---------- */
const acc = () => ({ p: [], c: [], i: [], n: 0 });
function vert(A, x, y, z, c) { A.p.push(x, y, z); A.c.push(c[0], c[1], c[2]); return A.n++; }
const tri = (A, a, b, c) => { A.i.push(a, b, c); };
/* triangle whose front faces the hint direction */
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
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ---------- rounded box: a welded grid on each face, corners and edges rounded by radius r.
   o.h half sizes, o.c centre, o.r radius, o.mid extra stations across each axis' flat part (for cushion bulge),
   o.rs 1 or 2 stations in each rounded zone, o.skip faces to leave out ('-y', '+z', ...), o.tilt turns it about x,
   o.bulge pushes the + side of axis o.ba (default y) out like a stuffed cushion, o.col(x, y, z, e, seam) gives the colour:
   e = how far along the round (0 flat .. 1 at the fold), seam = 1 on the ring where the flat part ends. ---------- */
function stations(h, r, mid, rs) {
  const inner = h - r, pos = [inner]; if (rs !== 1) pos.push(inner + r * 0.45); pos.push(h);
  const out = []; for (let i = pos.length - 1; i >= 0; i--) out.push(-pos[i]);
  for (let k = 1; k <= mid; k++) out.push(-inner + 2 * inner * k / (mid + 1));
  for (let i = 0; i < pos.length; i++) out.push(pos[i]);
  return out;
}
function rbox(A, o) {
  const H = o.h, mid = o.mid || [0, 0, 0], rs = o.rs || [2, 2, 2], skip = o.skip || '', c = o.c, tilt = o.tilt || 0;
  const R = Math.min(o.r, H[0] * 0.98, H[1] * 0.98, H[2] * 0.98), inn = [H[0] - R, H[1] - R, H[2] - R];
  const L = [0, 1, 2].map((i) => stations(H[i], R, mid[i], rs[i]));
  const ba = o.ba === undefined ? 1 : o.ba, b1 = (ba + 1) % 3, b2 = (ba + 2) % 3, bulge = o.bulge || 0, ct = Math.cos(tilt), st = Math.sin(tilt);
  const map = new Map(), q = [0, 0, 0];
  const get = (ix, iy, iz) => {
    const key = (ix * 64 + iy) * 64 + iz, hit = map.get(key); if (hit !== undefined) return hit;
    const id = [ix, iy, iz], p = [0, 0, 0], u = [0, 0, 0];
    for (let a = 0; a < 3; a++) { const v = L[a][id[a]], cl = clamp(v, -inn[a], inn[a]); q[a] = v - cl; p[a] = cl; u[a] = Math.abs(q[a]) / R; }
    const len = Math.hypot(q[0], q[1], q[2]) || 1; for (let a = 0; a < 3; a++) p[a] += q[a] / len * R;
    if (bulge) { const w = p[ba] > 0 ? p[ba] / H[ba] : 0; p[ba] += bulge * w * (1 - (p[b1] / H[b1]) * (p[b1] / H[b1])) * (1 - (p[b2] / H[b2]) * (p[b2] / H[b2])); }
    const s = u.slice().sort((x, y) => y - x), e = s[1], seam = (Math.abs(Math.abs(L[0][ix]) - inn[0]) < 1e-9 || Math.abs(Math.abs(L[1][iy]) - inn[1]) < 1e-9 || Math.abs(Math.abs(L[2][iz]) - inn[2]) < 1e-9) ? 1 : 0;
    const col = o.col ? o.col(p[0], p[1], p[2], e, seam) : [0.5, 0.5, 0.5];
    const y1 = p[1] * ct - p[2] * st, z1 = p[1] * st + p[2] * ct;
    const vi = vert(A, p[0] + c[0], y1 + c[1], z1 + c[2], col); map.set(key, vi); return vi;
  };
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, d = (a + 2) % 3;
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      if (skip.indexOf((sgn > 0 ? '+' : '-') + 'xyz'[a]) >= 0) continue;
      const ia = sgn > 0 ? L[a].length - 1 : 0, id = [0, 0, 0]; id[a] = ia;
      const vi = (ib, ic) => { id[b] = ib; id[d] = ic; return get(id[0], id[1], id[2]); };
      for (let ib = 0; ib < L[b].length - 1; ib++) for (let ic = 0; ic < L[d].length - 1; ic++) {
        const v00 = vi(ib, ic), v10 = vi(ib + 1, ic), v11 = vi(ib + 1, ic + 1), v01 = vi(ib, ic + 1);
        if (sgn > 0) { tri(A, v00, v10, v11); tri(A, v00, v11, v01); } else { tri(A, v00, v11, v10); tri(A, v00, v01, v11); }
      }
    }
  }
}

/* a turned shape: profile [[r, y], ...] from the bottom centre up and over, col(r, y, ang) colour, wave/pleat add a gentle fluting */
function lathe(A, o) {
  const seg = o.seg || 12, rings = [], c = o.c || [0, 0, 0], wave = o.wave || 0, pl = o.pleat || 12;
  for (let i = 0; i < o.prof.length; i++) {
    const r = o.prof[i][0], y = o.prof[i][1], ring = [];
    for (let k = 0; k < seg; k++) { const f = k / seg * PI * 2, rr = r * (1 + wave * Math.cos(f * pl)); ring.push(vert(A, c[0] + Math.cos(f) * rr, c[1] + y, c[2] + Math.sin(f) * rr, o.col(r, y, f))); }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = rings[i][k], a1 = rings[i][(k + 1) % seg], b = rings[i + 1][k], b1 = rings[i + 1][(k + 1) % seg];
    tri(A, a, b, a1); tri(A, a1, b, b1);
  }
}
/* a straight tapered tube from p0 to p1 */
function tube(A, p0, p1, r0, r1, seg, col) {
  const t = nrm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]), ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = nrm(crs(t, ref)), v = crs(t, u), r = [[], []];
  for (let e = 0; e < 2; e++) {
    const p = e ? p1 : p0, rad = e ? r1 : r0, cc = col(e);
    for (let k = 0; k < seg; k++) { const f = k / seg * PI * 2, cf = Math.cos(f) * rad, sf = Math.sin(f) * rad; r[e].push(vert(A, p[0] + u[0] * cf + v[0] * sf, p[1] + u[1] * cf + v[1] * sf, p[2] + u[2] * cf + v[2] * sf, cc)); }
  }
  for (let k = 0; k < seg; k++) { const a = r[0][k], a1 = r[0][(k + 1) % seg], b = r[1][k], b1 = r[1][(k + 1) % seg]; tri(A, a, a1, b); tri(A, a1, b1, b); }
}
/* a plain box with flat faces, optionally leaning (about z) from its base; col(ny, vy) where vy is 0 at the bottom and 1 at the top */
function box(A, c, s, col, o) {
  o = o || {}; const lean = o.lean || 0, cl = Math.cos(lean), sl = Math.sin(lean), skip = o.skip || '', hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2;
  const P = (x, y, z) => { const yy = y + hy, xx = x * cl - yy * sl, y2 = x * sl + yy * cl; return [c[0] + xx, c[1] + y2, c[2] + z]; };
  const faces = [['+x', [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz], [1, 0, 0]], ['-x', [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz], [-1, 0, 0]],
    ['+y', [-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [0, 1, 0]], ['-y', [-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [0, -1, 0]],
    ['+z', [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [0, 0, 1]], ['-z', [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [0, 0, -1]]];
  for (const f of faces) {
    if (skip.indexOf(f[0]) >= 0) continue;
    const ids = [];
    for (let k = 1; k <= 4; k++) { const q = f[k], w = P(q[0], q[1], q[2]); ids.push(vert(A, w[0], w[1], w[2], col(f[5], (q[1] + hy) / s[1]))); }
    const nx = f[5][0] * cl - f[5][1] * sl, ny = f[5][0] * sl + f[5][1] * cl, nz = f[5][2];
    triFace(A, ids[0], ids[1], ids[2], nx, ny, nz); triFace(A, ids[0], ids[2], ids[3], nx, ny, nz);
  }
}

/* ---------- material helper ---------- */
function stdMat(T, o) { return new T.MeshStandardMaterial(Object.assign({ vertexColors: true, color: 0xffffff, metalness: 0 }, o)); }
function mesh(T, A, mat, name) { const m = new T.Mesh(toGeometry(T, A), mat); m.name = name; m.castShadow = false; m.receiveShadow = false; return m; }

/* ---------- the sofa: three seats for the couch, one for the armchair ---------- */
const LEATHER = lin(0x5c3822), LEATHER_HI = lin(0x8f6340), LEATHER_LO = lin(0x321c10), WALNUT = lin(0x3a2a1e), BUTTON = lin(0x2c180d);
function sofa(A, W, seats, rng, o) {
  const D = o.D, aw = o.aw, legH = 0.13, innerW = W - 2 * aw, cw = innerW / seats;
  const jit = () => 0.97 + rng() * 0.06;
  /* leather: lighter worn edges, darker seams where the flat part ends, soft creases across the cushions */
  const leather = (wearK) => (x, y, z, e, seam) => {
    let k = 0.95 * jit(); const wear = sm(0.25, 1, e) * wearK; let c = mix(LEATHER, LEATHER_HI, wear);
    const crease = Math.max(0, Math.sin(x * 34 + z * 6) * Math.sin(z * 22 + y * 9 + 1)); k *= 1 - 0.16 * crease;
    if (seam) c = mix(c, LEATHER_LO, 0.55);
    return mul(c, k);
  };
  const armCol = leather(0.5), baseCol = leather(0.2);
  const wood = () => WALNUT;
  /* legs: tapered, turned, in dark wood */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lathe(A, { c: [sx * (W / 2 - 0.09), 0, sz * (D / 2 - 0.1)], seg: 7, prof: [[0.016, 0], [0.03, legH + 0.01], [0, legH + 0.01]], col: wood });
  /* base, back frame and rolled arms */
  rbox(A, { c: [0, legH + 0.09, 0], h: [W / 2 - 0.005, 0.09, D / 2 - 0.01], r: 0.03, rs: [1, 1, 1], skip: '-y', col: baseCol });
  rbox(A, { c: [0, 0.5, -D / 2 + 0.09], h: [innerW / 2 + 0.02, 0.21, 0.09], r: 0.04, rs: [1, 1, 1], skip: '-y', col: baseCol });
  for (const sx of [-1, 1]) rbox(A, { c: [sx * (W / 2 - aw / 2), legH + 0.255, 0], h: [aw / 2 - 0.004, 0.255, D / 2 - 0.01], r: 0.07, rs: [1, 2, 2], skip: '-y', bulge: 0.012, col: armCol });
  /* seat cushions with a stuffed bulge */
  const sd = 0.3, szc = D / 2 - 0.02 - sd, seatY = legH + 0.18 + 0.08;
  for (let i = 0; i < seats; i++) {
    const x = -innerW / 2 + cw * (i + 0.5);
    rbox(A, { c: [x, seatY, szc], h: [cw / 2 - 0.006, 0.08, sd], r: 0.06, mid: [1, 0, 1], rs: [2, 1, 2], skip: '-y', bulge: 0.03, col: leather(0.75) });
  }
  /* back cushions leaning back, with two tufted buttons each */
  const tl = -0.2, by = seatY + 0.08 + 0.2, bz = -0.2;
  for (let i = 0; i < seats; i++) {
    const x = -innerW / 2 + cw * (i + 0.5), hxw = cw / 2 - 0.006, bt = [[-cw * 0.2, 0.02], [cw * 0.2, 0.02]];
    const col = (px, py, pz, e, seam) => { let c = leather(0.7)(px, py, pz, e, seam); for (const b of bt) { const d = Math.hypot(px - b[0], py - b[1]); if (d < 0.08 && pz > 0) c = mul(c, 1 - 0.4 * (1 - d / 0.08)); } return c; };
    rbox(A, { c: [x, by, bz], h: [hxw, 0.22, 0.085], r: 0.06, mid: [1, 1, 0], rs: [2, 2, 1], skip: '-y -z', tilt: tl, bulge: 0.035, ba: 2, col });
    for (const b of bt) {
      const surf = 0.085 + 0.035 * (1 - (b[0] / hxw) * (b[0] / hxw)) * (1 - (b[1] / 0.22) * (b[1] / 0.22)), ct = Math.cos(tl), st = Math.sin(tl);
      const px = x + b[0], py = by + b[1] * ct - surf * st, pz = bz + b[1] * st + surf * ct;
      tube(A, [px, py, pz], [px, py + 0.012 * -st, pz + 0.012 * ct], 0.016, 0.008, 6, () => BUTTON);
    }
  }
}

/* ---------- the pieces ---------- */
function buildCouch(T, rng) {
  const A = acc(); sofa(A, 2.0, 3, rng, { D: 0.92, aw: 0.17 });
  const mat = stdMat(T, { roughness: 0.45 });
  return { meshes: [mesh(T, A, mat, 'couch')], mats: [mat] };
}
function buildArmchair(T, rng) {
  const A = acc(); sofa(A, 1.0, 1, rng, { D: 0.88, aw: 0.16 });
  const mat = stdMat(T, { roughness: 0.45 });
  return { meshes: [mesh(T, A, mat, 'armchair')], mats: [mat] };
}
function buildLamp(T) {
  const brass = lin(0xc9a86a), brassDk = lin(0x8d7440), A = acc();
  lathe(A, { c: [0, 0, 0], seg: 14, col: (r, y) => mix(brassDk, brass, sm(0, 1.4, y)),
    prof: [[0, 0], [0.15, 0], [0.152, 0.01], [0.14, 0.022], [0.06, 0.034], [0.02, 0.055], [0.012, 0.07], [0.012, 0.45], [0.021, 0.47], [0.021, 0.49], [0.012, 0.5], [0.012, 1.36], [0.022, 1.38], [0.022, 1.4], [0, 1.41]] });
  const metal = stdMat(T, { roughness: 0.45, metalness: 0.35 });
  const S = acc(), cream = lin(0xf0dcb6);
  lathe(S, { c: [0, 0, 0], seg: 32, wave: 0.012, pleat: 24, col: (r, y) => mul(cream, lerp(1, 0.86, sm(1.28, 1.58, y))),
    prof: [[0.245, 1.27], [0.24, 1.3], [0.175, 1.58], [0.17, 1.6]] });
  const shade = stdMat(T, { roughness: 0.9, side: T.DoubleSide, emissive: 0xffc888, emissiveIntensity: 1 });
  return { meshes: [mesh(T, A, metal, 'lamp-stem'), mesh(T, S, shade, 'lamp-shade')], mats: [metal, shade], glow: shade };
}
function buildRug(T, rng) {
  const A = acc(), HX = 1.4, HZ = 1.0, Y = 0.006;
  const NAVY = lin(0x2e3b4e), CREAM = lin(0xe3d3b0), TEAL = lin(0x3f6f73), RUST = lin(0xa4583f), FIELD = lin(0x8f5a48), FIELD2 = lin(0x9a6450);
  const poly = (pts, col, y) => { const ids = pts.map((p) => vert(A, p[0], y === undefined ? Y : y, p[1], col)); for (let i = 1; i < ids.length - 1; i++) triFace(A, ids[0], ids[i], ids[i + 1], 0, 1, 0); };
  const ring = (a, b, col, y) => {
    const ox = HX - a, oz = HZ - a, ix = HX - b, iz = HZ - b;
    poly([[-ox, -oz], [ox, -oz], [ix, -iz], [-ix, -iz]], col, y); poly([[ox, -oz], [ox, oz], [ix, iz], [ix, -iz]], col, y);
    poly([[ox, oz], [-ox, oz], [-ix, iz], [ix, iz]], col, y); poly([[-ox, oz], [-ox, -oz], [-ix, -iz], [-ix, iz]], col, y);
  };
  ring(0, 0.03, NAVY); ring(0.2, 0.23, NAVY); ring(0.23, 0.26, CREAM);
  /* woven stripes in the field (they run across the rug and swap two close tones) */
  const fx0 = -(HX - 0.26), fx1 = HX - 0.26, fz = HZ - 0.26, nS = 56, sw = (fx1 - fx0) / nS;
  for (let i = 0; i < nS; i++) { const x0 = fx0 + i * sw, x1 = x0 + sw, c = mul(i % 2 ? FIELD : FIELD2, 0.96 + rng() * 0.08); poly([[x0, -fz], [x1, -fz], [x1, fz], [x0, fz]], c); }
  /* border: sawtooth cells, teal and cream, with rust corner squares */
  const cell = (x0, x1, a, b, along) => {
    const xm = (x0 + x1) / 2, P = (u, v) => (along === 'x' ? [u, v] : [v, u]);
    poly([P(x0, a), P(x1, a), P(xm, b)], TEAL); poly([P(x0, a), P(xm, b), P(x0, b)], CREAM); poly([P(x1, a), P(x1, b), P(xm, b)], CREAM);
  };
  const bx = HX - 0.2, bz = HZ - 0.2, nx = Math.round(2 * bx / 0.1), nz = Math.round(2 * bz / 0.1);
  for (let i = 0; i < nx; i++) {
    const x0 = -bx + (2 * bx) * i / nx, x1 = -bx + (2 * bx) * (i + 1) / nx;
    cell(x0, x1, -HZ + 0.03, -HZ + 0.2, 'x'); cell(x0, x1, HZ - 0.03, HZ - 0.2, 'x');
  }
  for (let i = 0; i < nz; i++) {
    const z0 = -bz + (2 * bz) * i / nz, z1 = -bz + (2 * bz) * (i + 1) / nz;
    cell(z0, z1, -HX + 0.03, -HX + 0.2, 'z'); cell(z0, z1, HX - 0.03, HX - 0.2, 'z');
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) poly([[sx * (HX - 0.03), sz * (HZ - 0.03)], [sx * (HX - 0.2), sz * (HZ - 0.03)], [sx * (HX - 0.2), sz * (HZ - 0.2)], [sx * (HX - 0.03), sz * (HZ - 0.2)]], RUST);
  /* medallion: nested diamonds sitting a hair above the stripes */
  const dia = (r0, r1, col) => {
    const sx = 0.85, V = [[0, -1], [1, 0], [0, 1], [-1, 0]], Q = (k, r) => [V[k][0] * r * sx, V[k][1] * r];
    if (r0 <= 0) { poly([Q(0, r1), Q(1, r1), Q(2, r1), Q(3, r1)], col, Y + 0.0015); return; }
    for (let k = 0; k < 4; k++) { const k1 = (k + 1) % 4; poly([Q(k, r1), Q(k1, r1), Q(k1, r0), Q(k, r0)], col, Y + 0.0015); }
  };
  dia(0.5, 0.62, CREAM); dia(0.38, 0.5, TEAL); dia(0.28, 0.38, RUST); dia(0, 0.28, CREAM);
  /* tassels at the two short ends */
  const nf = 32, fw = (2 * HZ - 0.06) / nf;
  for (const sx of [-1, 1]) for (let i = 0; i < nf; i++) { const z0 = -HZ + 0.03 + i * fw; poly([[sx * HX, z0 + fw * 0.15], [sx * (HX + 0.06), z0 + fw * 0.2], [sx * (HX + 0.06), z0 + fw * 0.8], [sx * HX, z0 + fw * 0.85]], i % 2 ? CREAM : mul(CREAM, 0.88)); }
  const mat = stdMat(T, { roughness: 1 });
  return { meshes: [mesh(T, A, mat, 'rug')], mats: [mat] };
}
function buildShelf(T, rng) {
  const A = acc(), W = 1.2, H = 0.9, Dp = 0.3, t = 0.022, OAK = lin(0xa77c52), OAK2 = lin(0x8a6440);
  const wood = (ny, vy) => mul(mix(OAK, OAK2, (rng() * 0.5) + 0.2 * vy), ny[1] > 0.5 ? 1.08 : 0.92);
  const board = (cx, cy, cz, sx, sy, sz) => box(A, [cx, cy - sy / 2, cz], [sx, sy, sz], wood, { skip: '-y' });
  board(-(W / 2 - t / 2), H / 2, 0, t, H, Dp); board(W / 2 - t / 2, H / 2, 0, t, H, Dp);
  board(0, H - t / 2, 0, W + 0.03, t, Dp + 0.02); board(0, 0.06 + t / 2, 0, W - 2 * t, t, Dp - 0.01); board(0, 0.03, 0.01, W - 2 * t, 0.06, Dp - 0.04);
  box(A, [0, 0.035, -Dp / 2 + 0.006], [W - 2 * t, H - 0.07, 0.012], () => mul(OAK2, 0.7), { skip: '-z -y' });
  const s1 = 0.06 + t + 0.27, s2 = s1 + t + 0.27, base = [0.06 + t, s1 + t, s2 + t];
  board(0, s1 + t / 2, 0, W - 2 * t, t, Dp - 0.01); board(0, s2 + t / 2, 0, W - 2 * t, t, Dp - 0.01);
  /* books: a row per compartment, varied heights, widths, colours, some leaning, one flat stack */
  const SPINES = [0x7a2f2a, 0x2f4a6b, 0x3d5a45, 0xb08a3e, 0x5c3b66, 0x2d2d3a, 0x8b5a2b, 0x4a6670, 0xa04a3a, 0xd8cdb0, 0x3a5f8a, 0x6e7d3e].map(lin);
  for (let row = 0; row < 3; row++) {
    const room = row === 2 ? 0.2 : 0.26, max = W - 2 * t - 0.04;
    let x = -max / 2 + (row === 1 ? 0.08 : 0), end = max / 2 - (row === 0 ? 0.12 : 0.04);
    while (x < end - 0.03) {
      const w = 0.02 + rng() * 0.03, h = Math.min(room, 0.15 + rng() * 0.11), d = 0.17 + rng() * 0.06, c = SPINES[(rng() * SPINES.length) | 0], c2 = mul(c, 1.35);
      if (x + w > end) break;
      const lean = (row === 1 && x > end - 0.18 && rng() < 0.7) ? 0.22 : 0;
      const colr = (n, vy) => (n[2] > 0.5 ? mul(c, 0.8 + 0.2 * vy * (rng() * 0.1 + 0.95)) : n[1] > 0.5 ? mul(c, 1.25) : mul(c, 0.7));
      box(A, [x + w / 2, base[row], -Dp / 2 + 0.03 + d / 2 - 0.02], [w, h, d], colr, { skip: '-y -z -x', lean });
      /* a pale label on the spine of every other book */
      if (rng() < 0.55 && !lean) {
        const zf = -Dp / 2 + 0.03 + d - 0.02 + 0.0008, y0 = base[row] + h * 0.55, y1 = base[row] + h * 0.8, a = vert(A, x + 0.004, y0, zf, c2), b = vert(A, x + w - 0.004, y0, zf, c2), cc = vert(A, x + w - 0.004, y1, zf, c2), dd = vert(A, x + 0.004, y1, zf, c2);
        triFace(A, a, b, cc, 0, 0, 1); triFace(A, a, cc, dd, 0, 0, 1);
      }
      x += w + 0.002 + (rng() < 0.12 ? 0.03 : 0);
    }
  }
  /* a short flat stack on the top shelf's end */
  for (let i = 0; i < 3; i++) { const c = SPINES[(i * 4 + 1) % SPINES.length]; box(A, [W / 2 - 0.22, H + i * 0.026, 0.0], [0.24 - i * 0.02, 0.026, 0.17], (n) => (n[1] > 0.5 ? mul(c, 1.2) : mul(c, 0.8)), { skip: '-y' }); }
  const mat = stdMat(T, { roughness: 0.72 });
  return { meshes: [mesh(T, A, mat, 'shelf')], mats: [mat] };
}
function buildSideTable(T, rng) {
  const A = acc(), OAK = lin(0xa77c52), OAK2 = lin(0x7f5a3a), grain = (f) => mul(mix(OAK, OAK2, 0.5 + 0.5 * Math.sin(f * 7) * 0.5 + rng() * 0.08), 1);
  lathe(A, { c: [0, 0, 0], seg: 24, col: (r, y, f) => grain(f), prof: [[0, 0.49], [0.255, 0.49], [0.27, 0.5], [0.27, 0.52], [0.255, 0.532], [0, 0.532]] });
  lathe(A, { c: [0, 0, 0], seg: 18, col: (r, y, f) => mul(grain(f), 0.9), prof: [[0, 0.18], [0.17, 0.18], [0.17, 0.2], [0, 0.2]] });
  for (let k = 0; k < 3; k++) {
    const f = k / 3 * PI * 2 + 0.5, cs = Math.cos(f), sn = Math.sin(f);
    tube(A, [cs * 0.15, 0.495, sn * 0.15], [cs * 0.2, 0, sn * 0.2], 0.017, 0.011, 6, (e) => (e ? mul(OAK2, 0.8) : OAK2));
  }
  /* a mug with coffee, handle toward +x */
  const mx = 0.07, my = 0.532, MUG = lin(0x3f7f86), CUP = lin(0x2f6a70), COF = lin(0x3b2415);
  lathe(A, { c: [mx, my, 0.03], seg: 14, col: (r, y) => (y > 0.07 && r < 0.039 ? COF : mul(MUG, 0.9 + 0.1 * (y / 0.09))),
    prof: [[0, 0], [0.036, 0], [0.04, 0.01], [0.042, 0.09], [0.038, 0.09], [0.038, 0.076], [0, 0.076]] });
  tube(A, [mx + 0.041, my + 0.07, 0.03], [mx + 0.066, my + 0.058, 0.03], 0.006, 0.006, 5, () => CUP); tube(A, [mx + 0.066, my + 0.058, 0.03], [mx + 0.043, my + 0.02, 0.03], 0.006, 0.006, 5, () => CUP);
  const mat = stdMat(T, { roughness: 0.55 });
  return { meshes: [mesh(T, A, mat, 'sidetable')], mats: [mat] };
}

/* ---------- entry points ---------- */
const BUILD = { couch: buildCouch, armchair: buildArmchair, lamp: buildLamp, rug: buildRug, shelf: buildShelf, sidetable: buildSideTable };
export function makeFurniture(T, id, seed) {
  const fn = BUILD[id]; if (!fn) return null;
  const rng = rngOf(((seed | 0) * 7919) ^ hashStr(id)), r = fn(T, rng), g = new T.Group();
  g.name = 'furniture-' + id; r.meshes.forEach((m) => g.add(m));
  g.userData = { id, mats: r.mats }; if (r.glow) g.userData.glow = r.glow;
  return g;
}
export function disposeGroup(g) {
  if (!g) return;
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
}

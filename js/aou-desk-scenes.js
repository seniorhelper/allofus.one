/* allofus.one · the desk · scenes: two calm surroundings to sit inside, all built in code (no images, no models, no textures).
   makeScene(T, id) -> { object, update(timeMs), light: [skyHex, groundHex, hemiIntensity, sunHex, sunIntensity], mats }.
   The seat is at the origin, the floor at y = 0, the scene reaches at least 12 m all round. Budgets per scene: 6 draw calls, 12,000 triangles.
   Shaders are tiny: no loops, no textures, a few sines. update() does no allocation.
   mats: every material has a .color (a white T.Color the shader multiplies by), so desk.dim(material) can dim shader materials too. */

export const SCENES = [
  { id: 'beach', name: 'Evening beach' },
  { id: 'float', name: 'Space float' },
];

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rngOf(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lin = (hex) => [Math.pow(((hex >> 16) & 255) / 255, 2.2), Math.pow(((hex >> 8) & 255) / 255, 2.2), Math.pow((hex & 255) / 255, 2.2)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

const acc = () => ({ p: [], c: [], i: [], n: 0 });
function vert(A, x, y, z, c) { A.p.push(x, y, z); A.c.push(c[0], c[1], c[2]); return A.n++; }
const tri = (A, a, b, c) => { A.i.push(a, b, c); };
function toGeometry(T, A) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(A.c, 3));
  g.setIndex(new T.BufferAttribute(A.n > 65000 ? new Uint32Array(A.i) : new Uint16Array(A.i), 1));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/* a shader material with a white .color wired in as the uTint uniform, so desk.dim() works on it */
function shaderMat(T, o) {
  const color = new T.Color(1, 1, 1); o.uniforms.uTint = { value: color };
  const m = new T.ShaderMaterial(o); m.color = color; m.fog = false; return m;
}
const COLORSPACE = '\n#include <colorspace_fragment>\n';
const DOME_VERT = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/* ====================================================================================================
   BEACH: warm late-afternoon, a low sun over a calm sea, pale dunes, a few distant palms and rocks
   ==================================================================================================== */
const SEA_Y = -0.12, LAND_R = 32;
/* height of the sand: flat under the seat (r < 2.2), soft dunes farther out, sloping down to the sea in front (-z) */
function sandH(x, z) {
  const r = Math.hypot(x, z), zz = z + 1.5 * Math.sin(x * 0.12 + 0.5);
  const dunes = Math.sin(x * 0.19 + 1.3) * 0.5 + Math.sin(z * 0.23 - 0.7) * 0.4 + Math.sin((x + z) * 0.11) * 0.7 + Math.sin(x * 0.07 - z * 0.13) * 0.6;
  const amp = sm(2.2, 18, r) * (0.55 + 0.45 * sm(-2, 10, z)) * sm(-12, -4, zz) * (1 - 0.7 * sm(26, 32, r));
  return dunes * amp * 0.9 - 0.5 * (1 - sm(-16, -7, zz));
}

function blob(A, cx, cy, cz, sx, sy, sz, rng, col) {
  const rings = 6, seg = 9, first = A.n, ph = rng() * 6, ph2 = rng() * 6;
  for (let i = 0; i <= rings; i++) {
    const v = i / rings, th = v * PI, y = Math.cos(th), rr = Math.sin(th);
    for (let k = 0; k < seg; k++) {
      const f = k / seg * PI * 2, bump = 1 + 0.18 * Math.sin(f * 3 + ph + v * 4) + 0.1 * Math.sin(f * 5 + ph2);
      vert(A, cx + Math.cos(f) * rr * sx * bump, cy + y * sy * (y < 0 ? 0.5 : 1), cz + Math.sin(f) * rr * sz * bump, col(y));
    }
  }
  for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) {
    const a = first + i * seg + k, a1 = first + i * seg + (k + 1) % seg, b = a + seg, b1 = first + (i + 1) * seg + (k + 1) % seg;
    tri(A, a, a1, b); tri(A, a1, b1, b);
  }
}
function palm(A, x, z, rng, haze, hz) {
  const y0 = sandH(x, z) - 0.2, h = 6.5 + rng() * 2.5, lean = (rng() - 0.5) * 1.6, az = rng() * 6.28, TR = lin(0x6c5c47), LF = lin(0x4d6250), LF2 = lin(0x61765d);
  const top = [x + Math.cos(az) * lean, y0 + h, z + Math.sin(az) * lean];
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([lerp(x, top[0], t * t), y0 + h * t, lerp(z, top[2], t * t)]); }
  const first = A.n, seg = 6;
  for (let i = 0; i <= 8; i++) {
    const r = lerp(0.2, 0.08, i / 8), c = mix(mul(TR, lerp(0.85, 1.1, i / 8)), haze, hz);
    for (let k = 0; k < seg; k++) { const f = k / seg * PI * 2; vert(A, pts[i][0] + Math.cos(f) * r, pts[i][1], pts[i][2] + Math.sin(f) * r, c); }
  }
  for (let i = 0; i < 8; i++) for (let k = 0; k < seg; k++) { const a = first + i * seg + k, a1 = first + i * seg + (k + 1) % seg, b = a + seg, b1 = first + (i + 1) * seg + (k + 1) % seg; tri(A, a, b, a1); tri(A, a1, b, b1); }
  const n = 8, rows = 6;
  for (let fr = 0; fr < n; fr++) {
    const a = fr / n * PI * 2 + rng() * 0.4, L = 3.2 + rng() * 1.0, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, f0 = A.n;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, hh = L * t, up = 1.6 * L * t * (1 - t * 1.05) * 0.55, w = 0.55 * Math.sin(PI * Math.pow(t, 0.7)) + 0.03, c = mix(mix(LF, LF2, fr % 2 ? t : 1 - t), haze, hz);
      const cx = top[0] + dx * hh, cy = top[1] + up, cz = top[2] + dz * hh;
      vert(A, cx - px * w, cy - w * 0.3, cz - pz * w, c); vert(A, cx + px * w, cy - w * 0.3, cz + pz * w, c);
    }
    for (let i = 0; i < rows; i++) { const q = f0 + i * 2; tri(A, q, q + 2, q + 1); tri(A, q + 1, q + 2, q + 3); }
  }
}

function makeBeach(T) {
  const rng = rngOf(2026), obj = new T.Group(); obj.name = 'scene-beach';
  const SUN = (() => { const x = -0.28, y = 0.15, z = -0.95, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  const HOR = lin(0xf0c8a0), ZEN = lin(0x7f9fc0), LOW = lin(0xcfae8e), SUNC = lin(0xffe0b0), GLOW = lin(0xe8a870);

  /* sky: gradient, soft glow around a low sun, a small warm disc (the colour is capped so nothing is pure white) */
  const sky = shaderMat(T, {
    side: T.BackSide, depthWrite: false,
    uniforms: { uSun: { value: new T.Vector3(SUN[0], SUN[1], SUN[2]) }, uHor: { value: new T.Color().setRGB(HOR[0], HOR[1], HOR[2]) }, uZen: { value: new T.Color().setRGB(ZEN[0], ZEN[1], ZEN[2]) }, uLow: { value: new T.Color().setRGB(LOW[0], LOW[1], LOW[2]) }, uSunC: { value: new T.Color().setRGB(SUNC[0], SUNC[1], SUNC[2]) }, uGlow: { value: new T.Color().setRGB(GLOW[0], GLOW[1], GLOW[2]) } },
    vertexShader: DOME_VERT,
    fragmentShader: 'varying vec3 vP; uniform vec3 uSun, uHor, uZen, uLow, uSunC, uGlow, uTint; void main(){ vec3 d = normalize(vP); float h = d.y;'
      + ' vec3 c = mix(uHor, uZen, pow(smoothstep(0.0, 0.9, h), 0.55)); c = mix(c, uLow, 1.0 - smoothstep(-0.25, 0.0, h));'
      + ' float s = max(dot(d, uSun), 0.0); c += uGlow * (pow(s, 6.0) * 0.3 + pow(s, 40.0) * 0.45); c = mix(c, uSunC, smoothstep(0.99925, 0.9996, s));'
      + ' c = min(c * uTint, vec3(0.86)); gl_FragColor = vec4(c, 1.0);' + COLORSPACE + '}',
  });
  const dome = new T.Mesh(new T.SphereGeometry(50, 32, 16), sky); dome.position.y = 1.2; dome.renderOrder = -10; dome.frustumCulled = false; obj.add(dome);

  /* sea: a big flat disc with a slow shimmer (three sines), a glitter path toward the sun, and distance haze matching the sky's horizon */
  const sunXZ = [SUN[0] / Math.hypot(SUN[0], SUN[2]), SUN[2] / Math.hypot(SUN[0], SUN[2])];
  const sea = shaderMat(T, {
    uniforms: { uTime: { value: 0 }, uSunXZ: { value: new T.Vector2(sunXZ[0], sunXZ[1]) }, uHor: { value: new T.Color().setRGB(HOR[0], HOR[1], HOR[2]) }, uGlow: { value: new T.Color().setRGB(GLOW[0], GLOW[1], GLOW[2]) }, uShal: { value: new T.Color().setRGB(...lin(0x7fb4aa)) }, uDeep: { value: new T.Color().setRGB(...lin(0x4a8590)) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying vec3 vW; uniform float uTime; uniform vec2 uSunXZ; uniform vec3 uHor, uGlow, uShal, uDeep, uTint; void main(){ vec3 p = vW; float dist = length(p.xz);'
      + ' float w = sin(p.x * 0.7 + uTime * 0.55) + sin(p.z * 0.9 - uTime * 0.45) + sin((p.x - p.z) * 0.4 + uTime * 0.3);'
      + ' vec3 c = mix(uShal, uDeep, smoothstep(-10.0, -30.0, p.z)); c *= 1.0 + 0.035 * w;'
      + ' float path = pow(max(dot(normalize(p.xz), uSunXZ), 0.0), 24.0); c += uGlow * smoothstep(1.1, 2.8, w) * (0.07 + 0.3 * path);'
      + ' float fog = max(1.0 - exp(-dist * 0.06), smoothstep(30.0, 46.0, dist)); c = mix(c, uHor, fog);'
      + ' c = min(c * uTint, vec3(0.86)); gl_FragColor = vec4(c, 1.0);' + COLORSPACE + '}',
  });
  const sg = new T.CircleGeometry(48, 32); sg.rotateX(-PI / 2);
  const seaMesh = new T.Mesh(sg, sea); seaMesh.position.y = SEA_Y; seaMesh.frustumCulled = false; obj.add(seaMesh);

  /* land: sand on a polar grid (fine near the seat), plus rocks and palms in the same mesh */
  const A = acc(), NR = 34, NA = 72, SAND = lin(0xd9c4a0), WET = lin(0xb39c7c), HAZE = HOR;
  const col = (x, z, h) => {
    const r = Math.hypot(x, z), wet = 1 - sm(-0.1, 0.03, h);
    let c = mix(SAND, WET, wet * 0.8); c = mul(c, 0.96 + 0.05 * Math.sin(x * 0.9 + Math.sin(z * 0.4) * 2));
    return mix(c, HAZE, 0.78 * sm(14, LAND_R, r));
  };
  const c0 = vert(A, 0, 0, 0, col(0, 0, 0)), ring = [];
  for (let i = 1; i <= NR; i++) {
    const r = LAND_R * Math.pow(i / NR, 1.7), row = [];
    for (let k = 0; k < NA; k++) { const f = k / NA * PI * 2, x = Math.sin(f) * r, z = -Math.cos(f) * r, h = sandH(x, z); row.push(vert(A, x, h, z, col(x, z, h))); }
    ring.push(row);
  }
  for (let k = 0; k < NA; k++) tri(A, c0, ring[0][(k + 1) % NA], ring[0][k]);
  for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NA; k++) {
    const a = ring[i][k], a1 = ring[i][(k + 1) % NA], b = ring[i + 1][k], b1 = ring[i + 1][(k + 1) % NA];
    tri(A, a, a1, b); tri(A, a1, b1, b);
  }
  const ROCK = lin(0x8d8372);
  const rocks = [[-8, -7.6, 0.9], [-6.2, -8.4, 0.5], [9.5, -8, 0.8], [13, -6.2, 0.5], [-16, -3, 0.7], [19, 1, 0.9], [-11, 12, 0.6], [4, 17, 0.8]];
  for (const [x, z, s] of rocks) { const h = sandH(x, z), hz = 0.75 * sm(14, LAND_R, Math.hypot(x, z)); blob(A, x, h + s * 0.25, z, s * 1.2, s * 0.8, s, rng, (yy) => mix(mul(ROCK, 0.85 + 0.15 * yy), HAZE, hz)); }
  const palms = [[-24, -5], [-21, 4], [22, -4], [19, 7], [-9, 23], [8, 25], [-2, 27]];
  for (const [x, z] of palms) palm(A, x, z, rng, HAZE, 0.5 + 0.2 * rng());
  const landMat = new T.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 1, metalness: 0, side: T.DoubleSide });
  const land = new T.Mesh(toGeometry(T, A), landMat); land.frustumCulled = false; obj.add(land);

  const mats = [sky, sea, landMat];
  return {
    object: obj, mats, light: [0xffd8b8, 0xb89a74, 0.95, 0xffc088, 1.1],
    update(timeMs) { sea.uniforms.uTime.value = timeMs * 0.001; sea.uniformsNeedUpdate = true; },
  };
}

/* ====================================================================================================
   FLOAT: space float, an indigo-to-teal dome, a glowing horizon band, slow stars, a few drifting nebula puffs
   ==================================================================================================== */
function makeFloat(T) {
  const rng = rngOf(77), obj = new T.Group(); obj.name = 'scene-float';
  const C = (hex) => { const l = lin(hex); return new T.Color().setRGB(l[0], l[1], l[2]); };
  const sky = shaderMat(T, {
    side: T.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uHor: { value: C(0x2c6e78) }, uZen: { value: C(0x1f1d54) }, uLow: { value: C(0x1a2a5a) }, uBand: { value: C(0x2f8f86) } },
    vertexShader: DOME_VERT,
    fragmentShader: 'varying vec3 vP; uniform float uTime; uniform vec3 uHor, uZen, uLow, uBand, uTint; void main(){ vec3 d = normalize(vP); float h = d.y;'
      + ' vec3 far = mix(uLow, uZen, step(0.0, h)); vec3 c = mix(uHor, far, pow(smoothstep(0.0, 1.0, abs(h)), 0.7));'
      + ' c += uBand * exp(-h * h * 60.0) * (0.8 + 0.2 * sin(uTime * 0.17));'
      + ' c = min(c * uTint, vec3(0.8)); gl_FragColor = vec4(c, 1.0);' + COLORSPACE + '}',
  });
  const dome = new T.Mesh(new T.SphereGeometry(50, 32, 16), sky); dome.position.y = 1.2; dome.renderOrder = -10; dome.frustumCulled = false; obj.add(dome);

  /* a faint, large disc far below, brighter in the middle with soft rings, so there is a sense of depth under the feet */
  const A = acc(), RINGS = 7, SEG = 36, R = 35, CEN = lin(0x2f6479), EDGE = lin(0x1a2a5a);
  const c0 = vert(A, 0, -30, 0, CEN), rows = [];
  for (let i = 1; i <= RINGS; i++) {
    const r = R * i / RINGS, t = i / RINGS, k = 1 + 0.07 * (i % 2 ? 1 : -1) * (1 - t), c = mul(mix(CEN, EDGE, Math.pow(t, 0.6)), k), row = [];
    for (let s = 0; s < SEG; s++) { const f = s / SEG * PI * 2; row.push(vert(A, Math.cos(f) * r, -30, Math.sin(f) * r, c)); }
    rows.push(row);
  }
  for (let s = 0; s < SEG; s++) tri(A, c0, rows[0][s], rows[0][(s + 1) % SEG]);
  for (let i = 0; i < RINGS - 1; i++) for (let s = 0; s < SEG; s++) { const a = rows[i][s], a1 = rows[i][(s + 1) % SEG], b = rows[i + 1][s], b1 = rows[i + 1][(s + 1) % SEG]; tri(A, a, b, a1); tri(A, a1, b, b1); }
  const floorMat = new T.MeshBasicMaterial({ vertexColors: true, color: 0xffffff, side: T.DoubleSide });
  const floor = new T.Mesh(toGeometry(T, A), floorMat); floor.frustumCulled = false; obj.add(floor);

  /* about 400 stars: one Points draw call, positions seeded, size and twinkle phase per star */
  const N = 400, pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), sz = new Float32Array(N), ph = new Float32Array(N);
  const cool = lin(0xbfd4ff), warm = lin(0xffe2b8);
  for (let i = 0; i < N; i++) {
    const y = rng() * 2 - 1, f = rng() * PI * 2, rr = Math.sqrt(1 - y * y), d = 44;
    pos[i * 3] = Math.cos(f) * rr * d; pos[i * 3 + 1] = y * d + 1.2; pos[i * 3 + 2] = Math.sin(f) * rr * d;
    const c = mul(mix(cool, warm, rng() < 0.25 ? rng() : 0), 0.45 + rng() * 0.55); cl[i * 3] = c[0]; cl[i * 3 + 1] = c[1]; cl[i * 3 + 2] = c[2];
    sz[i] = 2 + Math.pow(rng(), 3) * 4; ph[i] = rng();
  }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('aC', new T.BufferAttribute(cl, 3)); sg.setAttribute('aS', new T.BufferAttribute(sz, 1)); sg.setAttribute('aPh', new T.BufferAttribute(ph, 1));
  sg.computeBoundingSphere();
  const stars = shaderMat(T, {
    blending: T.AdditiveBlending, depthWrite: false, transparent: true,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: 'attribute float aS; attribute float aPh; attribute vec3 aC; uniform float uTime, uPx; varying vec3 vC; void main(){'
      + ' float tw = 0.6 + 0.4 * sin(uTime * (0.35 + aPh * 0.3) + aPh * 40.0); vC = aC * tw; gl_PointSize = aS * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; uniform vec3 uTint; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.1, 1.0, r); gl_FragColor = vec4(vC * a * 0.8 * uTint, 1.0);' + COLORSPACE + '}',
  });
  const pts = new T.Points(sg, stars); pts.frustumCulled = false; obj.add(pts);

  /* nebula puffs: four big soft quads facing the seat, low alpha, drifting slowly in the vertex shader (the only transparency here) */
  const P = [[-28, 14, -26, 0x4b8f9c, 0.16, 34], [30, 22, -18, 0x7a5aa8, 0.14, 38], [6, 8, 34, 0x3d6fb0, 0.13, 40], [-24, 28, 24, 0x9a6aa0, 0.1, 30]];
  const pp = [], uv = [], pc = [], pd = [], pa = [], idx = [];
  P.forEach((q, i) => {
    const cx = q[0], cy = q[1] + 1.2, cz = q[2], n = [-cx, -cy + 1.2, -cz], nl = Math.hypot(n[0], n[1], n[2]); n[0] /= nl; n[1] /= nl; n[2] /= nl;
    let rx = n[2], rz = -n[0]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const ux = n[1] * rz, uy = n[2] * rx - n[0] * rz, uz = -n[1] * rx, ul = Math.hypot(ux, uy, uz) || 1, s = q[5] / 2, col = lin(q[3]), ang = rng() * 6.28;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], b = pp.length / 3;
    for (const [a, c2] of corners) {
      pp.push(cx + rx * a * s + (ux / ul) * c2 * s * 0.7, cy + (uy / ul) * c2 * s * 0.7, cz + rz * a * s + (uz / ul) * c2 * s * 0.7);
      uv.push(a * 0.5 + 0.5, c2 * 0.5 + 0.5); pc.push(col[0], col[1], col[2]); pd.push(Math.cos(ang) * 4, 1.5, Math.sin(ang) * 4, i * 1.7); pa.push(q[4]);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const pg = new T.BufferGeometry();
  pg.setAttribute('position', new T.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); pg.setAttribute('aC', new T.Float32BufferAttribute(pc, 3));
  pg.setAttribute('aDr', new T.Float32BufferAttribute((() => { const o = []; for (let i = 0; i < pd.length; i += 4) o.push(pd[i], pd[i + 1], pd[i + 2]); return o; })(), 3));
  pg.setAttribute('aPh', new T.Float32BufferAttribute((() => { const o = []; for (let i = 3; i < pd.length; i += 4) o.push(pd[i]); return o; })(), 1));
  pg.setAttribute('aA', new T.Float32BufferAttribute(pa, 1)); pg.setIndex(idx); pg.computeBoundingSphere();
  const puffs = shaderMat(T, {
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'attribute vec3 aC; attribute vec3 aDr; attribute float aPh; attribute float aA; uniform float uTime; varying vec2 vUv; varying vec3 vC; varying float vA; varying float vPh; void main(){'
      + ' vUv = uv; vC = aC; vA = aA; vPh = aPh; vec3 p = position + aDr * sin(uTime * 0.05 + aPh); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vC; varying float vA; varying float vPh; uniform float uTime; uniform vec3 uTint; void main(){'
      + ' vec2 q = vUv * 2.0 - 1.0; float r = length(q) + sin(vUv.x * 6.0 + vPh) * sin(vUv.y * 5.0 - vPh * 1.3) * 0.14;'
      + ' float a = (1.0 - smoothstep(0.0, 1.0, r)); a = a * a * vA * (0.85 + 0.15 * sin(uTime * 0.2 + vPh)); gl_FragColor = vec4(vC * uTint, a);' + COLORSPACE + '}',
  });
  const puff = new T.Mesh(pg, puffs); puff.frustumCulled = false; puff.renderOrder = -5; obj.add(puff);

  const mats = [sky, floorMat, stars, puffs];
  return {
    object: obj, mats, light: [0x7088c8, 0x24305a, 0.55, 0x9fc8d8, 0.5],
    update(timeMs) {
      const t = timeMs * 0.001;
      sky.uniforms.uTime.value = t; stars.uniforms.uTime.value = t; puffs.uniforms.uTime.value = t;
      sky.uniformsNeedUpdate = true; stars.uniformsNeedUpdate = true; puffs.uniformsNeedUpdate = true;
    },
  };
}

export function makeScene(T, id) {
  if (id === 'beach') return makeBeach(T);
  if (id === 'float') return makeFloat(T);
  return null;
}

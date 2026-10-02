/* ============================================================
   allofus.one · living garden (v4, Oct 2026)
   Flowers that grow, open and sway: Colorado blue columbine,
   moth orchids, giant alliums, sunflowers, tulips, lupines and
   bird of paradise, including giant "fantasy" sizes. Hummingbirds
   that hover, sip and dart between them. Tap any of them to learn.
   © 2026 allofus.one
   ============================================================ */
import { THREE, makeSprite, isMobile } from './aou-engine.js';
const T = THREE; const MOB = isMobile();
const MS = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.6, side: T.DoubleSide, ...o });

export const FLORA = {
  columbine: ['Colorado blue columbine', 'Aquilegia coerulea', 'Colorado\'s state flower since 1899. The long backward spurs hold nectar that hummingbirds and hawkmoths reach with long tongues.'],
  orchid: ['Moth orchid', 'Phalaenopsis', 'Named for flowers that look like moths in flight. A single spike can bloom for two to three months.'],
  allium: ['Giant allium', 'Allium giganteum', 'An ornamental onion: hundreds of tiny star flowers make one purple globe. Bees love it.'],
  sunflower: ['Sunflower', 'Helianthus annuus', 'Young sunflowers track the sun across the sky. The seed spiral follows the golden angle, about 137.5 degrees.'],
  tulip: ['Tulip', 'Tulipa', 'Tulips keep growing a little after they are cut, and their petals close at night.'],
  lupine: ['Lupine', 'Lupinus', 'Lupines pull nitrogen from the air into the soil, feeding the plants around them.'],
  paradise: ['Bird of paradise', 'Strelitzia reginae', 'The flower is shaped like a bird\'s head. Sunbirds land on it and get dusted with pollen.'],
};
export const HUMMER = ['Ruby-throated hummingbird', 'Archilochus colubris', 'Wings beat about 50 times a second, and it can fly backward. Some cross the Gulf of Mexico nonstop each spring.'];

function petal(w, h, curl = 0.3) { const sh = new T.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(w, h * 0.25, w * 0.8, h * 0.85, 0, h); sh.bezierCurveTo(-w * 0.8, h * 0.85, -w, h * 0.25, 0, 0); const g = new T.ShapeGeometry(sh, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.pow(y / h, 2) * curl * h); } g.computeVertexNormals(); return g; }

/* one flower = stem + leaves + head. Returns a group with userData.grow(k) and userData.sway(t) */
export function makeFlower(kind, size = 1, seed = 1) {
  const g = new T.Group(); const head = new T.Group(); g.add(head); const petals = [];
  const stemH = { columbine: 0.9, orchid: 0.7, allium: 1.3, sunflower: 2.2, tulip: 0.6, lupine: 0.8, paradise: 1.0 }[kind] * size;
  const stemM = MS(0x3f8a3a, { roughness: 0.8 });
  const stemCurve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(0.05 * size, stemH * 0.4, 0), new T.Vector3(kind === 'orchid' ? 0.35 * size : -0.03 * size, stemH * 0.85, 0), new T.Vector3(kind === 'orchid' ? 0.55 * size : 0, stemH, kind === 'columbine' ? 0.08 * size : 0)]);
  const stem = new T.Mesh(new T.TubeGeometry(stemCurve, 10, 0.025 * size * (kind === 'sunflower' ? 2 : 1), 5), stemM); g.add(stem); head.position.copy(stemCurve.getPoint(1));
  for (let i = 0; i < 2; i++) { const lf = new T.Mesh(petal(0.12 * size, 0.42 * size, 0.2), MS(0x4caf50)); lf.position.set(0, stemH * (0.2 + i * 0.18), 0); lf.rotation.set(-1.1, i * 2.6 + seed, 0.3); g.add(lf); }
  if (kind === 'columbine') { const blue = MS(0x5b8def), white = MS(0xffffff), yel = MS(0xffd23f, { emissive: 0x332200 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const sp = new T.Mesh(petal(0.08 * size, 0.24 * size, 0.15), blue); const piv = new T.Group(); piv.rotation.y = a; head.add(piv); piv.add(sp); sp.rotation.x = -1.2; petals.push([sp, -1.2, -0.25]); const spur = new T.Mesh(new T.ConeGeometry(0.018 * size, 0.2 * size, 6), blue); spur.position.set(0, 0.08 * size, -0.1 * size); spur.rotation.x = -2.4; piv.add(spur); const wp = new T.Mesh(petal(0.05 * size, 0.12 * size, 0.6), white); wp.rotation.x = -0.6; wp.position.z = 0.01; piv.add(wp); }
    for (let i = 0; i < 9; i++) { const st = new T.Mesh(new T.CylinderGeometry(0.004 * size, 0.004 * size, 0.08 * size, 3), yel); st.position.set((Math.random() - 0.5) * 0.03 * size, 0.04 * size, (Math.random() - 0.5) * 0.03 * size); head.add(st); } head.rotation.x = 0.5; }
  else if (kind === 'orchid') { const pink = MS(0xff6fb5), lip = MS(0xc2185b), white = MS(0xfff0f7);
    for (let b = 0; b < 4; b++) { const bl = new T.Group(); const t = 0.55 + b * 0.15; bl.position.copy(stemCurve.getPoint(Math.min(1, t))); bl.position.y -= 0.05 * size; g.add(bl); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const sp = new T.Mesh(petal(0.08 * size, (i % 2 ? 0.13 : 0.1) * size, 0.2), b % 2 ? white : pink); const piv = new T.Group(); piv.rotation.z = a; bl.add(piv); piv.add(sp); sp.rotation.x = 0.2; petals.push([sp, 1.4, 0.2]); } const l = new T.Mesh(new T.SphereGeometry(0.03 * size, 8, 6), lip); l.scale.set(1, 1.3, 0.7); bl.add(l); bl.rotation.y = Math.PI / 2; } }
  else if (kind === 'allium') { const pur = MS(0x9b4dff, { emissive: 0x1a0033 }); const ball = new T.Group(); head.add(ball); const N = MOB ? 40 : 90; for (let i = 0; i < N; i++) { const v = new T.Vector3().randomDirection().multiplyScalar(0.17 * size); const s = new T.Mesh(new T.OctahedronGeometry(0.03 * size, 0), pur); s.position.copy(v); ball.add(s); petals.push([s, 0, 0, true]); } }
  else if (kind === 'sunflower') { const yel = MS(0xffc107), brown = MS(0x5d3a1a, { roughness: 1 }); const disc = new T.Mesh(new T.CylinderGeometry(0.16 * size, 0.16 * size, 0.06 * size, 24), brown); disc.rotation.x = Math.PI / 2; head.add(disc); for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; const piv = new T.Group(); piv.rotation.z = a; head.add(piv); const sp = new T.Mesh(petal(0.05 * size, 0.2 * size, 0.1), yel); sp.position.y = 0.14 * size; piv.add(sp); petals.push([sp, 1.3, 0]); } head.rotation.x = -0.3; }
  else if (kind === 'tulip') { const col = MS([0xff3b5c, 0xffd23f, 0xff8a3d, 0xb08cff][seed % 4]); for (let i = 0; i < 6; i++) { const piv = new T.Group(); piv.rotation.y = i / 6 * Math.PI * 2; head.add(piv); const sp = new T.Mesh(petal(0.07 * size, 0.18 * size, -0.4), col); sp.position.z = 0.03 * size; piv.add(sp); petals.push([sp, 0, -0.35]); } }
  else if (kind === 'lupine') { const col = MS([0x6a5acd, 0xff69b4, 0xffffff][seed % 3]); for (let i = 0; i < 14; i++) { const s = new T.Mesh(new T.SphereGeometry(0.035 * size * (1 - i / 20), 6, 5), col); s.position.set(Math.cos(i * 2.4) * 0.05 * size, i * 0.035 * size, Math.sin(i * 2.4) * 0.05 * size); head.add(s); petals.push([s, 0, 0, true]); } }
  else if (kind === 'paradise') { const org = MS(0xff8a00, { emissive: 0x331100 }), blu = MS(0x2a3cff); const beak = new T.Mesh(new T.ConeGeometry(0.04 * size, 0.42 * size, 6), MS(0x2f6b3a)); beak.rotation.z = Math.PI / 2; head.add(beak); for (let i = 0; i < 4; i++) { const sp = new T.Mesh(petal(0.03 * size, 0.28 * size, 0.1), i === 3 ? blu : org); sp.position.x = -0.05 * size; sp.rotation.z = -0.2 - i * 0.18; head.add(sp); petals.push([sp, 0, 0.3]); } }
  g.traverse(o => { if (o.isMesh) o.castShadow = !MOB; });
  const ph = seed * 1.7;
  g.userData.kind = kind; g.userData.stemH = stemH; g.userData.grow = (k) => { const e = Math.min(1, Math.max(0, k)); g.scale.setScalar(0.02 + 0.98 * Math.min(1, e * 1.4)); const open = Math.min(1, Math.max(0, (e - 0.55) / 0.45)); for (const [m, closed, opened, pop] of petals) { if (pop) m.scale.setScalar(0.2 + 0.8 * open); else m.rotation.x = closed + (opened - closed) * open; } };
  g.userData.sway = (t, wind = 1) => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.05 * wind; g.rotation.x = Math.cos(t * 1.1 + ph) * 0.035 * wind; head.rotation.y = Math.sin(t * 0.7 + ph) * 0.2; };
  return g;
}

export function makeHummingbird() {
  const g = new T.Group(); const body = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), new T.MeshStandardMaterial({ color: 0x1f9d55, metalness: 0.6, roughness: 0.25 })); body.scale.set(0.8, 0.8, 1.6); g.add(body);
  const throat = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), new T.MeshStandardMaterial({ color: 0xe0115f, emissive: 0x550022, metalness: 0.7, roughness: 0.2 })); throat.position.set(0, -0.02, 0.06); g.add(throat);
  const beak = new T.Mesh(new T.CylinderGeometry(0.004, 0.006, 0.12, 5), new T.MeshStandardMaterial({ color: 0x111111 })); beak.rotation.x = Math.PI / 2; beak.position.z = 0.15; g.add(beak);
  const wingM = new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.45, side: T.DoubleSide, depthWrite: false }); const wings = [];
  for (const sx of [-1, 1]) { const w = new T.Mesh(new T.PlaneGeometry(0.16, 0.05), wingM); w.position.set(sx * 0.08, 0.03, 0); g.add(w); wings.push([w, sx]); }
  const tail = new T.Mesh(new T.ConeGeometry(0.03, 0.08, 4), body.material); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.11; g.add(tail);
  g.userData.flap = (t) => { for (const [w, sx] of wings) w.rotation.z = sx * Math.sin(t * 90) * 1.1; }; g.scale.setScalar(2.2); return g;
}

/* plant a whole bed: list of [kind, x, z, size]. Flowers regrow every few minutes so visitors see them bloom. */
export function plantGarden(app, parent, list, opts = {}) {
  const flowers = []; const base = new T.Vector3();
  list.forEach(([kind, x, z, size, y = 0], i) => { const f = makeFlower(kind, size || 1, i + 3); f.position.set(x, y, z); f.rotation.y = (i * 2.399) % (Math.PI * 2); parent.add(f); f.userData.born = -i * 0.35; flowers.push(f);
    const info = FLORA[kind]; app.addHotspot(f, { title: '🌸 ' + info[0], html: `<p><i>${info[1]}</i></p><p>${info[2]}</p>` }); });
  const birds = []; const nB = opts.birds ?? (MOB ? 2 : 4);
  for (let i = 0; i < nB && flowers.length; i++) { const b = makeHummingbird(); parent.add(b); const st = { b, from: new T.Vector3(), to: new T.Vector3(), k: 1, dur: 1, hover: 0, target: null }; birds.push(st); app.addHotspot(b, { title: '🐦 ' + HUMMER[0], html: `<p><i>${HUMMER[1]}</i></p><p>${HUMMER[2]}</p>` }); }
  let started = null;
  app.onUpdate((dt, t) => { if (started === null) started = t; const P = app.player.position; parent.getWorldPosition(base); if (Math.hypot(P.x - base.x, P.z - base.z) > (opts.range || 120)) return;
    for (const f of flowers) { const age = t - started + f.userData.born; if (age < 14 || !f.userData.done) { f.userData.grow(age / 12); if (age >= 14) f.userData.done = true; } f.userData.sway(t, opts.wind || 1); }
    for (const s of birds) { s.b.userData.flap(t); if (s.hover > 0) { s.hover -= dt; s.b.position.y += Math.sin(t * 9) * 0.002; continue; } s.k += dt / s.dur; if (s.k >= 1) { const f = flowers[Math.floor(Math.random() * flowers.length)]; s.from.copy(s.b.position); s.to.copy(f.position).add(new T.Vector3(0.2, f.userData.stemH * f.scale.y + 0.15, 0.25)); s.dur = 0.8 + Math.random() * 1.2; s.k = 0; s.hover = 0.6 + Math.random() * 1.6; }
      const k = Math.min(1, s.k); const e = k * k * (3 - 2 * k); s.b.position.lerpVectors(s.from, s.to, e); s.b.position.y += Math.sin(k * Math.PI) * 0.6; const dir = s.to.clone().sub(s.from); if (dir.lengthSq() > 0.001) s.b.rotation.y = Math.atan2(dir.x, dir.z); } });
  return { flowers, birds };
}

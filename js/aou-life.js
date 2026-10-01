/* ============================================================
   allofus.one · life
   The bay + reef you can dive, fish schools, a sunken ship,
   animals that wander, birds, a banner plane, balloons, seven
   hidden Light Seeds, ATVs, the people on the paths, live
   players, your status ring, and Lumi (the guide orb).
   ============================================================ */
import { THREE, isMobile, makeSprite, makePerson, animatePerson, buildCharacter, CHARACTERS, rand } from './aou-engine.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { M, glow, box, cyl, sph, plane, textPlane, waterMaterial, loadGLB, NEON, PINK, GOLD, MINT, VIOLET, ORANGE } from './aou-kit.js';
import { terrainY, groundY, seeded, STATE, OCEAN, LAKE, POOL, ORBIT, waterAt } from './aou-terrain.js';
import { MODES, LIFE_PATHS, ZONES } from './aou-world.js';
const T = THREE;

export function buildLife(W) {
  const { app } = W; const S = app.scene; const mob = isMobile();
  buildBay(W); buildSkyLife(W); buildAnimals(W); buildSeeds(W); buildATVs(W); buildResidents(W); buildRemote(W); buildMyRing(W); buildLumi(W);
}

/* ---------- THE BAY: water, beach, pier, reef, fish, shipwreck ---------- */
function buildBay(W) {
  const { app } = W; const S = app.scene; const { x: ox, z: oz } = OCEAN; const R = seeded(11);
  const sea = new T.Mesh(new T.CircleGeometry(214, 96), waterMaterial(0x1f8fc0, 0x0a3f6e, { double: true })); sea.rotation.x = -Math.PI / 2; sea.position.set(ox, 0, oz); sea.userData.noCollide = true; sea.userData.noOcclude = true; S.add(sea);
  const foamM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }); const foam = new T.Mesh(new T.RingGeometry(170, 174, 128), foamM); foam.rotation.x = -Math.PI / 2; foam.position.set(ox, 0.06, oz); foam.userData.noCollide = true; S.add(foam);
  app.onUpdate((dt, t) => { const k = 0.5 + 0.5 * Math.sin(t * 0.9); foam.scale.setScalar(1 + k * 0.02); foamM.opacity = 0.15 + 0.3 * (1 - k); });
  // beach life: umbrellas, towels, lifeguard tower, volleyball, sandcastle
  const bx = ZONES.beach.x, bz = ZONES.beach.z; const cols = [0xff4f79, 0xffd23f, 0x38b6ff, 0x7cff6b, 0xff8a3d];
  for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.16; const d = 186; const x = ox + Math.cos(a) * d * 1.02, z = oz - Math.sin(a) * d; if (Math.hypot(x - ox, z - oz) < 176) continue; const y = terrainY(x, z); const u = new T.Group(); u.position.set(x, y, z); S.add(u); cyl(0.05, 0.05, 2.6, M(0xffffff), 0, 1.3, 0, u, 6); const top = new T.Mesh(new T.ConeGeometry(1.8, 0.7, 12), M(cols[i % 5])); top.position.y = 2.7; u.add(top); const tw = box(1, 0.04, 2, M(cols[(i + 2) % 5]), 1.6, 0.03, 0.3, u); tw.rotation.y = 0.3; }
  { const x = bx - 8, z = bz - 4; const lg = new T.Group(); lg.position.set(x, terrainY(x, z), z); S.add(lg); for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.1, 0.1, 3, M(0xffffff), lx, 1.5, lz, lg, 6); box(2.6, 0.2, 2.6, M(0xffffff), 0, 3, 0, lg); box(2.4, 1.6, 2.4, M(0xff4f79), 0, 3.9, 0, lg); const rf = new T.Mesh(new T.ConeGeometry(2.2, 1, 4), M(0xffffff)); rf.rotation.y = Math.PI / 4; rf.position.y = 5.2; lg.add(rf); app.addObstacle(x, z, 1.6); }
  // pier into the bay, with buoys marking the dive zone
  const pa = Math.atan2(oz - bz, ox - bx); const pier = new T.Group(); pier.position.set(bx, 0, bz); pier.rotation.y = -pa + Math.PI / 2; S.add(pier); const plank = M(0xb98a5c, { roughness: 0.85 }); box(3.2, 0.25, 46, plank, 0, 1.3, 23, pier); for (let k = 0; k < 9; k++) for (const sx of [-1.4, 1.4]) cyl(0.18, 0.18, 6, M(0x6b4a2a), sx, -1.6, 2 + k * 5.5, pier, 6);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const b = sph(0.45, M(i % 2 ? 0xff4f79 : 0xffffff, { roughness: 0.4 }), ox + Math.cos(a) * 120, 0.2, oz + Math.sin(a) * 120, S, 10); app.onUpdate((dt, t) => { b.position.y = 0.15 + Math.sin(t * 1.6 + i) * 0.12; }); }
  const ds = makeSprite('🤿 Dive zone: swim out and tap Dive', { scale: 6, accent: '#2fe0c0' }); ds.position.set(ox + Math.cos(pa + Math.PI) * 120, 3.2, oz + Math.sin(pa + Math.PI) * 120); S.add(ds);
  W.sign(['🌊 THE BAY', 'Swim · dive the reef · find the shipwreck'], bx + 10, bz - 16, Math.PI * 0.25 + Math.PI, { width: 6, height: 2.4, accent: '#0d9488' });
  // REEF: coral, kelp, rocks on the sea floor
  const under = new T.Group(); under.userData.noCollide = true; S.add(under); W.under = under;
  const coralGeos = [new T.ConeGeometry(0.5, 1.6, 6), new T.SphereGeometry(0.7, 8, 6), new T.TorusGeometry(0.6, 0.2, 6, 12), new T.CylinderGeometry(0.15, 0.3, 2, 6)]; coralGeos[1].scale(1, 0.6, 1);
  const coralCols = [0xff6f91, 0xffb347, 0xb08cff, 0x38f0ff, 0xffe66d, 0xff4f79];
  coralGeos.forEach((geo, gi) => { const n = mob() ? 50 : 110; const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x111111 }), n); const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(), c = new T.Color(); for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, d = 20 + R() * 135; const x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d; const y = terrainY(x, z); e.set(R() * 0.5, R() * 6, R() * 0.5); q.setFromEuler(e); v.set(x, y + 0.3, z); sc.setScalar(0.6 + R() * 1.6); m4.compose(v, q, sc); im.setMatrixAt(i, m4); c.setHex(coralCols[(i + gi) % coralCols.length]); im.setColorAt(i, c); } im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; under.add(im); });
  const kelp = []; const km = M(0x2e8b57, { roughness: 0.8, side: T.DoubleSide }); for (let i = 0; i < (mob() ? 24 : 60); i++) { const a = R() * Math.PI * 2, d = 40 + R() * 110; const x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d; const y = terrainY(x, z); const h = Math.min(-y - 0.8, 4 + R() * 7); if (h < 2) continue; const k = new T.Mesh(new T.PlaneGeometry(0.5, h, 1, 6), km); k.geometry.translate(0, h / 2, 0); const p = k.geometry.attributes.position; for (let j = 0; j < p.count; j++) { const yy = p.getY(j); p.setX(j, p.getX(j) + Math.sin(yy * 0.8) * 0.25); } k.position.set(x, y, z); k.rotation.y = R() * 3; under.add(k); kelp.push([k, i]); }
  // the sunken ship + treasure
  const sx = ox - 22, sz = oz + 38, sy = terrainY(sx, sz); const ship = new T.Group(); ship.position.set(sx, sy + 0.6, sz); ship.rotation.set(0.12, 0.7, 0.18); under.add(ship); const wood = M(0x5a3a22, { roughness: 0.95 }); const hull = box(4.4, 2.6, 15, wood, 0, 1.2, 0, ship); const bow = new T.Mesh(new T.ConeGeometry(2.2, 4, 4), wood); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.65); bow.position.set(0, 1.2, 9.2); ship.add(bow); box(3.8, 0.2, 14, M(0x7a5a3a), 0, 2.5, 0, ship); const mast = cyl(0.2, 0.25, 9, wood, 0, 6, -1, ship, 8); mast.rotation.z = 0.5; box(4, 3, 0.1, M(0xd9cfb4, { side: T.DoubleSide, transparent: true, opacity: 0.6 }), 1.5, 7, -1, ship).rotation.z = 0.5;
  const chest = new T.Group(); chest.position.set(sx + 5, terrainY(sx + 5, sz + 3) + 0.4, sz + 3); under.add(chest); box(1.2, 0.7, 0.8, M(0x8a5f3a), 0, 0, 0, chest); const lid = box(1.2, 0.3, 0.8, M(0x8a5f3a), 0, 0.5, -0.3, chest); lid.rotation.x = -0.6; sph(0.3, glow(0xffd23f, 2.4), 0, 0.4, 0, chest, 10); W.chestPos = chest.position.clone();
  // fish schools + a turtle + a manta
  const fishGeo = new T.SphereGeometry(0.28, 8, 6); fishGeo.scale(0.55, 0.9, 1.6); const tailGeo = new T.ConeGeometry(0.22, 0.4, 4); tailGeo.rotateX(-Math.PI / 2); tailGeo.translate(0, 0, -0.55); const fishCols = [0xffb347, 0x38f0ff, 0xff6f91, 0xffe66d];
  const schools = []; for (let s = 0; s < (mob() ? 3 : 5); s++) { const n = mob() ? 18 : 30; const col = fishCols[s % 4]; const fm = new T.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.2, emissive: col, emissiveIntensity: 0.15 }); const a = new T.InstancedMesh(fishGeo, fm, n), b = new T.InstancedMesh(tailGeo, fm, n); a.frustumCulled = false; b.frustumCulled = false; under.add(a); under.add(b); const ang = R() * 6.28, d = 40 + R() * 90; schools.push({ a, b, n, cx: ox + Math.cos(ang) * d, cz: oz + Math.sin(ang) * d, r: 7 + R() * 9, depth: 3 + R() * 7, sp: 0.25 + R() * 0.25, off: [...Array(n)].map(() => [R() * 6.28, (R() - 0.5) * 3, (R() - 0.5) * 3]) }); }
  const turtle = new T.Group(); const sh = sph(0.9, M(0x5a7a3a, { roughness: 0.7 }), 0, 0, 0, turtle, 12); sh.scale.set(1, 0.45, 1.2); sph(0.3, M(0x8aa86a), 0, 0, 1.2, turtle, 8); for (const [fx, fz] of [[-0.9, 0.6], [0.9, 0.6], [-0.7, -0.8], [0.7, -0.8]]) { const f = box(0.7, 0.08, 0.3, M(0x8aa86a), fx, -0.05, fz, turtle); f.userData.flip = fx; } under.add(turtle);
  const manta = new T.Group(); const mm = new T.Mesh(new T.ConeGeometry(2.4, 3, 3), M(0x2a3a4a, { roughness: 0.6 })); mm.rotation.x = Math.PI / 2; mm.scale.set(1.6, 1, 0.12); manta.add(mm); under.add(manta);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1);
  // underwater view: fog, tint, bubbles
  const fx = document.createElement('div'); fx.id = 'aou-under'; document.getElementById('wvm-stage').appendChild(fx);
  const keep = { fogC: new T.Color(), near: 0, far: 0, bg: null, on: false };
  app.onUpdate((dt, t) => {
    const P = app.player.position; const near = Math.hypot(P.x - ox, P.z - oz) < 260; under.visible = near || Math.hypot(P.x - LAKE.x, P.z - LAKE.z) < 60;
    if (near) { for (const s of schools) { for (let i = 0; i < s.n; i++) { const [ph, dy, dr] = s.off[i]; const ang = t * s.sp + ph * 0.15 + i * 0.03; const r = s.r + dr; const x = s.cx + Math.cos(ang) * r, z = s.cz + Math.sin(ang) * r; const y = Math.max(terrainY(x, z) + 1, -s.depth + dy * 0.5 + Math.sin(t * 2 + i) * 0.2); e.set(0, -ang, Math.sin(t * 6 + i) * 0.15); q.setFromEuler(e); v.set(x, y, z); m4.compose(v, q, one); s.a.setMatrixAt(i, m4); e.set(0, -ang + Math.sin(t * 12 + i) * 0.35, 0); q.setFromEuler(e); m4.compose(v, q, one); s.b.setMatrixAt(i, m4); } s.a.instanceMatrix.needsUpdate = true; s.b.instanceMatrix.needsUpdate = true; }
      const ta = t * 0.05; turtle.position.set(ox + Math.cos(ta) * 70, -5 + Math.sin(t * 0.5), oz + Math.sin(ta) * 70); turtle.rotation.y = -ta; for (const c of turtle.children) if (c.userData.flip) c.rotation.z = Math.sin(t * 2) * 0.4 * Math.sign(c.userData.flip);
      const ma = -t * 0.07; manta.position.set(ox + Math.cos(ma) * 100, -8, oz + Math.sin(ma) * 100); manta.rotation.y = -ma + Math.PI; manta.rotation.z = Math.sin(t) * 0.2; mm.scale.x = 1.6 + Math.sin(t * 1.5) * 0.15;
      for (const [k, i] of kelp) k.rotation.z = Math.sin(t * 0.8 + i) * 0.12; }
    const cam = app.camera.getWorldPosition(v); const w = waterAt(cam.x, cam.z); const isUnder = !!w && cam.y < w.y - 0.15;
    if (isUnder !== keep.on) { keep.on = isUnder; const f = app.scene.fog; if (isUnder) { keep.fogC.copy(f.color); keep.near = f.near; keep.far = f.far; keep.bg = app.scene.background; f.color.setHex(0x1b6f8f); f.near = 1; f.far = 62; app.scene.background = new T.Color(0x1b6f8f); fx.classList.add('on'); } else { f.color.copy(keep.fogC); f.near = keep.near; f.far = keep.far; if (keep.bg) app.scene.background = keep.bg; fx.classList.remove('on'); } }
  });
  W.inBay = (x, z) => Math.hypot(x - ox, z - oz) < OCEAN.r;
}
const mob = () => isMobile();

/* ---------- SKY: birds, seagulls, banner plane, balloons ---------- */
function buildSkyLife(W) {
  const { app } = W; const S = app.scene;
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0.5, -1.2, 0.2, -0.2, 0, 0, -0.4, 0, 0, 0.5, 1.2, 0.2, -0.2, 0, 0, -0.4]), 3)); bg.computeVertexNormals();
  const flocks = [{ n: 26, col: 0x2a2a35, cx: 0, cz: -40, r: 90, h: 55, sp: 0.12 }, { n: 12, col: 0xffffff, cx: OCEAN.x, cz: OCEAN.z, r: 60, h: 24, sp: 0.18 }, { n: 16, col: 0x3a3a45, cx: -200, cz: -150, r: 70, h: 40, sp: 0.15 }];
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
  for (const F of flocks) { F.im = new T.InstancedMesh(bg, new T.MeshStandardMaterial({ color: F.col, side: T.DoubleSide, roughness: 0.8 }), F.n); F.im.frustumCulled = false; S.add(F.im); F.off = [...Array(F.n)].map((_, i) => [Math.random() * 6.28, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14]); }
  app.onUpdate((dt, t) => { const P = app.player.position; for (const F of flocks) { if (Math.hypot(P.x - F.cx, P.z - F.cz) > 500) { F.im.visible = false; continue; } F.im.visible = true; for (let i = 0; i < F.n; i++) { const [ph, dy, dr] = F.off[i]; const a = t * F.sp + ph * 0.08; const r = F.r + dr + Math.sin(t * 0.3 + ph) * 12; v.set(F.cx + Math.cos(a) * r, F.h + dy + Math.sin(t * 0.7 + ph) * 3, F.cz + Math.sin(a) * r); e.set(0, -a, 0); q.setFromEuler(e); const flap = 0.4 + Math.abs(Math.sin(t * 9 + ph * 3)) * 0.9; sc.set(1, flap, 1); m4.compose(v, q, sc); F.im.setMatrixAt(i, m4); } F.im.instanceMatrix.needsUpdate = true; } });
  // banner plane
  const pl = new T.Group(); const body = M(0xf4f6f8, { metalness: 0.5, roughness: 0.3 }); const fus = cyl(0.7, 0.4, 7, body, 0, 0, 0, pl, 12); fus.rotation.x = Math.PI / 2; box(10, 0.15, 1.6, M(0xff4f79), 0, 0.2, 0.6, pl); box(3.4, 0.12, 1, M(0xff4f79), 0, 0.3, -3.2, pl); box(0.12, 1.4, 1, M(0xff4f79), 0, 0.9, -3.2, pl); const prop = box(0.1, 2.4, 0.2, M(0x222222), 0, 0, 3.6, pl); const banner = textPlane(['ALL OF US · ONE 🌍  allofus.one'], 24, 3, { bg: '#ffffff', fg: '#1a1a1a', accent: '#ff4f79', font: 'bold 90px Poppins, Arial', double: true }); banner.rotation.y = Math.PI / 2; banner.position.set(0, 0, -20); pl.add(banner); const rope = box(0.04, 0.04, 6, M(0x333333), 0, 0, -6.5, pl); S.add(pl);
  app.onUpdate((dt, t) => { const a = t * 0.045; pl.position.set(Math.cos(a) * 380, 105 + Math.sin(t * 0.2) * 6, Math.sin(a) * 380); pl.rotation.set(0, -a + Math.PI, -0.18); prop.rotation.z += dt * 40; banner.rotation.x = Math.sin(t * 3) * 0.06; });
  // hot-air balloons
  const stripe = (c1, c2) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 32, 0, 32, 64); } const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx; };
  [['#ff4f79', '#ffd23f', 120, -140, 90], ['#38b6ff', '#ffffff', -150, 60, 110], ['#7cff6b', '#b08cff', 160, 160, 80]].forEach(([a, b, x, z, h], i) => { const g = new T.Group(); const env = sph(6, M(0xffffff, { map: stripe(a, b), roughness: 0.6 }), 0, 8, 0, g, 24); env.scale.y = 1.2; box(2, 1.4, 2, M(0x8a5f3a), 0, -0.6, 0, g); for (const [rx, rz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) box(0.04, 3.2, 0.04, M(0x333333), rx, 1.2, rz, g); S.add(g); app.onUpdate((dt, t) => { const k = t * 0.01 + i * 2; g.position.set(x + Math.cos(k) * 40, h + Math.sin(t * 0.3 + i) * 4, z + Math.sin(k) * 40); }); });
}

/* ---------- ANIMALS (rigged GLB, wandering) ---------- */
async function buildAnimals(W) {
  const { app } = W; const S = app.scene;
  const SPEC = [['deer', 1.7, 1.4, [[-150, -150, 40], [-220, 40, 30]], 3], ['fox', 0.75, 2.4, [[-170, -210, 35]], 2], ['horse', 2.2, 2.0, [[-110, -80, 32]], 2], ['alpaca', 1.8, 1.2, [[-100, -70, 30]], 2], ['husky', 0.95, 2.2, [[-12, 70, 18]], 1]];
  const all = [];
  for (const [kind, height, speed, areas, count] of SPEC) {
    let gl; try { gl = await loadGLB('/models/animal-' + kind + '.glb'); } catch (e) { console.warn('animal', kind, e); continue; }
    const bb = new T.Box3().setFromObject(gl.scene); const s = height / Math.max(0.01, bb.max.y - bb.min.y);
    for (let i = 0; i < count; i++) {
      const area = areas[i % areas.length]; const m = SkeletonUtils.clone(gl.scene); m.scale.setScalar(s); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); const g = new T.Group(); g.add(m); S.add(g);
      const mixer = new T.AnimationMixer(m); const clip = (n) => gl.animations.find(a => a.name === n); const acts = {}; for (const n of ['Walk', 'Idle', 'Eating', 'Gallop']) { const c = clip(n); if (c) acts[n] = mixer.clipAction(c); }
      const x = area[0] + rand(-area[2], area[2]) * 0.5, z = area[1] + rand(-area[2], area[2]) * 0.5; g.position.set(x, terrainY(x, z), z);
      const A = { g, mixer, acts, cur: null, area, speed, tgt: null, wait: rand(0, 4), kind }; play(A, 'Idle'); all.push(A);
      app.addHotspot(g, { title: { deer: '🦌 A deer', fox: '🦊 A fox', horse: '🐴 A horse', alpaca: '🦙 An alpaca', husky: '🐕 A husky' }[kind], html: '<p>' + { deer: 'Quiet, curious, and faster than you.', fox: 'Clever little fox. It knows where the Light Seeds are. It is not telling.', horse: 'Free to roam. Like everyone here.', alpaca: 'Hums when it is happy. It is always humming.', husky: 'First Street\'s good dog. Belongs to everybody.' }[kind] + '</p>' });
    }
  }
  function play(A, n) { const a = A.acts[n] || A.acts.Idle; if (!a || A.cur === a) return; a.reset().fadeIn(0.3).play(); if (A.cur) A.cur.fadeOut(0.3); A.cur = a; }
  app.onUpdate((dt) => { const P = app.player.position; for (const A of all) { const g = A.g; const far = Math.hypot(g.position.x - P.x, g.position.z - P.z) > 160; g.visible = !far; if (far) continue; A.mixer.update(Math.min(dt, 0.05));
    if (A.wait > 0) { A.wait -= dt; if (A.wait <= 0) { const [ax, az, r] = A.area; A.tgt = [ax + rand(-r, r), az + rand(-r, r)]; play(A, 'Walk'); } continue; }
    if (!A.tgt) { A.wait = 1; continue; } const dx = A.tgt[0] - g.position.x, dz = A.tgt[1] - g.position.z, d = Math.hypot(dx, dz); if (d < 0.6 || waterAt(A.tgt[0], A.tgt[1])) { A.tgt = null; A.wait = rand(3, 9); play(A, Math.random() < 0.5 && A.acts.Eating ? 'Eating' : 'Idle'); continue; }
    const st = Math.min(d, A.speed * dt); const nx = g.position.x + dx / d * st, nz = g.position.z + dz / d * st; g.position.set(nx, terrainY(nx, nz), nz); const want = Math.atan2(dx, dz); let da = want - g.rotation.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; g.rotation.y += da * Math.min(1, dt * 4); } });
}

/* ---------- LIGHT SEEDS (7 hidden) ---------- */
function buildSeeds(W) {
  const { app } = W; const S = app.scene; const key = 'aou_seeds'; let got = []; try { got = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { }
  const H = W.house; const scr = H.screen.position;
  const LIST = [
    ['falls', 'Behind the waterfall', -271.5, POOL.z - 6, null],
    ['wreck', 'In the sunken ship\'s treasure chest', W.chestPos ? W.chestPos.x : OCEAN.x - 17, W.chestPos ? W.chestPos.z : OCEAN.z + 41, W.chestPos ? W.chestPos.y + 0.8 : -12],
    ['orbit', 'At the edge of Orbit Garden', ORBIT.x + 52, ORBIT.z - 12, 1.2],
    ['temple', 'Behind the desert temple altar', ZONES.desert.x, ZONES.desert.z - 5, null],
    ['movie', 'Backstage of Zach\'s movie screen', scr.x + Math.sin(H.screen.rotation.y + Math.PI) * 2.5, scr.z + Math.cos(H.screen.rotation.y + Math.PI) * 2.5, null],
    ['hands', 'In the middle of Many Hands', ZONES.art.x + 26, ZONES.art.z - 6, null],
    ['mile', 'Down Unity Road, past the last house', 8, 640, null],
  ];
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'); const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.4, 'rgba(255,210,63,.45)'); gr.addColorStop(1, 'rgba(255,210,63,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  for (const [id, hint, x, z, y0] of LIST) { const g = new T.Group(); const y = y0 !== null ? y0 : terrainY(x, z) + 1.2; g.position.set(x, y, z); const core = new T.Mesh(new T.OctahedronGeometry(0.35, 0), glow(0xffd23f, 3)); g.add(core); const s = new T.Sprite(new T.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); s.scale.set(2.6, 2.6, 1); g.add(s); S.add(g); const seed = { id, hint, g, core, y, x, z, got: got.includes(id) }; g.visible = !seed.got; W.seeds.push(seed); }
  app.onUpdate((dt, t) => { const P = app.player.position; for (const s of W.seeds) { if (s.got) continue; s.core.rotation.y += dt * 2; s.g.position.y = s.y + Math.sin(t * 2 + s.x) * 0.2; const d = Math.hypot(P.x - s.x, P.z - s.z); if (d < 2.2 && Math.abs((P.y + 1) - s.y) < 3.2) { s.got = true; s.g.visible = false; got.push(s.id); try { localStorage.setItem(key, JSON.stringify(got)); } catch (e) { } const n = got.length; app.buzz(80); if (n >= LIST.length) { app.celebrate('🌟'); app.popup('🌟 Lightkeeper', '<p>You found all <b>7 Light Seeds</b>. You walked every kind of path to get here: water, sky, sand, art and the long road. That is the whole point.</p>', []); } else app.toast('✨ Light Seed ' + n + ' of ' + LIST.length + ' found: ' + s.hint, 4200); W.api.onSeed && W.api.onSeed(n, LIST.length); } } });
  W.seedHints = () => W.seeds.map(s => (s.got ? '✅ ' : '◻️ ') + (s.got ? s.hint : '???')).join('<br>'); W.seedCount = () => got.length;
}

/* ---------- ATVs ---------- */
function makeATV(color = 0xff8a3d) {
  const g = new T.Group(); const paint = M(color, { metalness: 0.5, roughness: 0.35 }), black = M(0x1b1d22, { roughness: 0.8 }), chrome = M(0xdfe5ec, { metalness: 0.9, roughness: 0.2 });
  box(1.3, 0.35, 2.2, black, 0, 0.75, 0, g); const tank = box(0.9, 0.35, 0.9, paint, 0, 1.08, 0.35, g); const seat = box(0.7, 0.18, 1, black, 0, 1.1, -0.45, g); const fend = [[0.75, 0.85], [-0.75, 0.85], [0.75, -0.75], [-0.75, -0.75]];
  for (const [fx, fz] of fend) { const f = box(0.55, 0.12, 0.9, paint, fx * 0.95, 1.15, fz, g); f.rotation.x = fz > 0 ? 0.15 : -0.15; }
  box(1.1, 0.08, 0.5, chrome, 0, 1.25, 1.15, g); box(1.1, 0.08, 0.5, chrome, 0, 1.25, -1.15, g);
  const bar = cyl(0.04, 0.04, 1.1, chrome, 0, 1.55, 0.75, g, 6); bar.rotation.z = Math.PI / 2; cyl(0.04, 0.04, 0.5, chrome, 0, 1.3, 0.7, g, 6);
  for (const sx of [-0.25, 0.25]) sph(0.1, glow(0xffffcc, 1.5), sx, 1.0, 1.15, g, 8);
  const wheels = []; for (const [fx, fz] of fend) { const w = new T.Group(); w.position.set(fx, 0.42, fz); const tire = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.36, 14), black); tire.rotation.z = Math.PI / 2; w.add(tire); const rim = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.38, 10), chrome); rim.rotation.z = Math.PI / 2; w.add(rim); for (let k = 0; k < 6; k++) { const n = box(0.4, 0.06, 0.12, black, 0, 0, 0, null); n.position.set(0, Math.cos(k) * 0.42, Math.sin(k) * 0.42); n.rotation.x = k; w.add(n); } g.add(w); wheels.push(w); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.userData.wheels = wheels; return g;
}
function buildATVs(W) {
  const { app } = W; const cols = [0xff8a3d, 0x38b6ff, 0x7cff6b, 0xff4f79];
  (W.atvSpot || []).forEach(([x, z, ry], i) => { const atv = makeATV(cols[i % cols.length]); atv.position.set(x, terrainY(x, z), z); atv.rotation.y = ry; app.scene.add(atv); W.atvs.push(atv);
    const it = { x, z, r: 4, label: '🏍️ Hop on the ATV', fn: (a) => { if (a.vehicle) return; a.driveCart(atv, { speed: 2.7, seatY: 0.95, roofY: 3.2, label: '🏍️ ATV! Hills welcome, cliffs not. TURBO for a boost. Tap the button to hop off.', park: (v) => { v.m.position.y = terrainY(v.m.position.x, v.m.position.z); } }); } };
    app.interactables = app.interactables || []; app.interactables.push(it);
    app.onUpdate((dt) => { if (!(app.vehicle && app.vehicle.m === atv)) { it.x = atv.position.x; it.z = atv.position.z; it.r = 4; } else it.r = -1; const driving = app.vehicle && app.vehicle.m === atv; if (driving && app.moving) for (const w of atv.userData.wheels) w.rotation.x += dt * 14; if (driving) { const p = atv.position; const f = terrainY(p.x + Math.sin(atv.rotation.y) * 1, p.z + Math.cos(atv.rotation.y) * 1), b = terrainY(p.x - Math.sin(atv.rotation.y) * 1, p.z - Math.cos(atv.rotation.y) * 1); atv.rotation.x = -Math.atan2(f - b, 2) ; } });
  });
}

/* ---------- PEOPLE ON THE PATHS (demo residents, clearly labeled) ---------- */
export const DEMO_PEOPLE = [
  ['Maya', 'business', 'hanging', 'Austin, US', 'Bakery owner opening a second shop. Loves sourdough and spreadsheets.', ['Small business', 'Food access'], 'A co-founder who loves mornings', 'Bakes bread for the shelter every Friday', 0xff8a3d],
  ['Kofi', 'causes', 'exploring', 'Accra, GH', 'Builds solar kits for schools. Drums on weekends.', ['Clean energy', 'Education'], 'Engineers and donors for 40 school kits', 'Has taught 300 kids to solder', 0x38b6ff],
  ['Ana', 'creativity', 'working', 'Lisbon, PT', 'Muralist. Painting a wall in every country she visits.', ['Public art', 'Mental health'], 'Walls to paint and stories to put on them', 'Painted in 23 countries', 0xb08cff],
  ['Ravi', 'learning', 'hanging', 'Pune, IN', 'Teaching code to grandparents. Also learning Spanish badly.', ['Digital literacy'], 'Study buddies for Spanish', 'His oldest student is 91', 0x7cff6b],
  ['Lena', 'wellness', 'home', 'Oslo, NO', 'Trail runner and yoga teacher. Morning person, sorry.', ['Mental health', 'Outdoors'], 'People to run the Wellness path with', 'Ran across Norway', 0x2fe0c0],
  ['Tomás', 'adventure', 'exploring', 'Mendoza, AR', 'Mountain guide. Has seen the Andes from every side.', ['Conservation'], 'Climbing partners, photographers', 'Summited Aconcagua twice', 0xffd23f],
  ['Aiko', 'creativity', 'hanging', 'Osaka, JP', 'Makes music from city sounds.', ['Music education'], 'Vocalists for an album about trains', 'Recorded 1,000 train doors', 0xff4f79],
  ['Samir', 'business', 'working', 'Dubai, AE', 'Logistics nerd. Gets things where they need to go.', ['Disaster relief'], 'Help routing supplies to relief groups', 'Moved 2M meals in 2025', 0x38f0ff],
  ['Grace', 'causes', 'hanging', 'Nairobi, KE', 'Runs a girls\' coding club.', ['Girls in STEM'], 'Mentors, laptops, mentors', 'Club alumni now teach the club', 0xffd23f],
  ['Lucas', 'explore', 'exploring', 'Florianópolis, BR', 'Surf instructor and ocean cleanup diver.', ['Ocean health'], 'Divers for weekend reef cleanups', 'Pulled 2 tons of net out of the bay', 0x2fe0c0],
  ['Mei', 'learning', 'working', 'Taipei, TW', 'Data scientist teaching stats with board games.', ['Open education'], 'Game designers', 'Invented a dice game about probability', 0x38b6ff],
  ['Jonah', 'wellness', 'hanging', 'Denver, US', 'Grief counselor. Walks the Wellness path daily.', ['Mental health'], 'Walking buddies', 'Hosts a free Sunday walk-and-talk', 0x7cff6b],
  ['Fatima', 'business', 'exploring', 'Casablanca, MA', 'Sells hand-woven rugs worldwide.', ['Fair trade'], 'A web store partner', 'Works with 40 weavers', 0xff8a3d],
  ['Diego', 'adventure', 'hanging', 'Oaxaca, MX', 'Cyclist riding from Mexico to Patagonia.', ['Road safety'], 'Places to sleep on the route', '9,000 km so far', 0xffd23f],
  ['Priya', 'causes', 'working', 'London, UK', 'Climate policy researcher.', ['Climate'], 'Co-authors and data', 'Testified to Parliament twice', 0xff4f79],
  ['Noah', 'explore', 'hanging', 'Auckland, NZ', 'Sailor. Collecting stories from every port.', ['Ocean health'], 'Crew for a Pacific crossing', 'Sailed 30,000 nautical miles', 0x38f0ff],
  ['Zara', 'creativity', 'dnd', 'Toronto, CA', 'Novelist on deadline. Please wave quietly.', ['Literacy'], 'Beta readers (after the deadline)', 'Wrote 3 novels in 3 years', 0xb08cff],
  ['Elijah', 'learning', 'hanging', 'Atlanta, US', 'High school physics teacher. Launches rockets.', ['STEM education'], 'Rocket club sponsors', '200 student launches', 0x38b6ff],
  ['Ines', 'wellness', 'exploring', 'Madrid, ES', 'Plant-based chef and community gardener.', ['Food access'], 'Gardeners and cooks', 'Feeds 80 neighbors every Saturday', 0x7cff6b],
  ['Kwame', 'adventure', 'working', 'Kumasi, GH', 'Wildlife photographer.', ['Conservation'], 'Editors for a photo book', 'Photographed 400 bird species', 0xff8a3d],
  ['Sofia', 'explore', 'hanging', 'Athens, GR', 'Marine biologist. Talks to octopuses.', ['Ocean health'], 'Volunteers for reef surveys', 'Named 12 octopuses', 0x2fe0c0],
];
function buildResidents(W) {
  const { app } = W; const S = app.scene; const R = seeded(5); const hair = [0x1a1a1a, 0x4a2e15, 0xd9b36c, 0xb5432b, 0x9a9a9a]; const skin = [0xf1c27d, 0xe0ac7e, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac];
  const used = {}; DEMO_PEOPLE.forEach((d, i) => {
    const [name, path, mode, city, bio, causes, looking, attractor, color] = d; const P = LIFE_PATHS.find(p => p.id === path); if (!P || !P.spots || !P.spots.length) return;
    const k = used[path] = (used[path] || 0) + 1; const spot = P.spots[Math.min(P.spots.length - 1, 2 + k * 3)]; const side = k % 2 ? 1 : -1; const x = spot.x + spot.nx * 4.4 * side, z = spot.z + spot.nz * 4.4 * side;
    const prof = { id: 'demo-' + name.toLowerCase().replace(/[^a-z]/g, ''), demo: true, name, path, paths: [path], mode, city, bio, causes, looking, attractor, color, stats: { connections: 12 + Math.floor(R() * 300), goals: 2 + Math.floor(R() * 9), paths: 1 + Math.floor(R() * 3) } };
    const person = makePerson({ age: 'adult', shirt: color, hair: hair[i % hair.length], skin: skin[i % skin.length], dress: i % 3 === 1, hairStyle: ['short', 'long', 'bun', 'curly', 'short'][i % 5] });
    const g = new T.Group(); g.add(person); g.position.set(x, terrainY(x, z), z); g.rotation.y = Math.atan2(-spot.nx * side, -spot.nz * side); S.add(g);
    const ring = ringMesh(MODES[mode].color); g.add(ring); const tag = makeSprite(MODES[mode].icon + ' ' + name + ' · ' + P.icon, { scale: 3.2, accent: MODES[mode].css }); tag.position.y = 2.75; g.add(tag);
    const R0 = { prof, g, person, ring, tag, walk: i % 4 === 0, phase: R() * 6, spot, P, base: [x, z] }; W.residents.push(R0);
    app.addHotspot(g, { fn: () => W.api.openProfile(prof) });
  });
  app.onUpdate((dt, t) => { const PP = app.player.position; for (const r of W.residents) { const g = r.g; const far = Math.hypot(g.position.x - PP.x, g.position.z - PP.z) > 140; if (far) continue; r.ring.material.emissiveIntensity = 1.2 + Math.sin(t * 3 + r.phase) * 0.5;
      if (r.walk && r.P.curve) { const L = 0.18 + 0.12 * Math.sin(r.phase); const u = (Math.sin(t * 0.03 + r.phase) * 0.5 + 0.5) * 0.7 + 0.25; const p = r.P.curve.getPointAt(Math.min(0.99, u)); const p2 = r.P.curve.getPointAt(Math.min(0.995, u + 0.004)); const dir = Math.cos(t * 0.03 + r.phase) > 0 ? 1 : -1; const x = p.x + 1.4, z = p.z; g.position.set(x, terrainY(x, z), z); g.rotation.y = Math.atan2((p2.x - p.x) * dir, (p2.z - p.z) * dir); animatePerson(r.person, t, 0.9); }
      else { animatePerson(r.person, t, 0); const dx = PP.x - g.position.x, dz = PP.z - g.position.z; if (dx * dx + dz * dz < 64) { const want = Math.atan2(dx, dz); let da = want - g.rotation.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; g.rotation.y += da * Math.min(1, dt * 3); } } } });
  // real people (live mode): stand on the path they chose, even when they are offline
  W.placeProfile = (prof) => { if (!prof || !prof.paths || !prof.paths.length) return; if (W.residents.find(r => r.prof.id === prof.id)) return; const P = LIFE_PATHS.find(p => p.id === prof.paths[0]); if (!P || !P.spots) return; const k = used[P.id] = (used[P.id] || 0) + 1; const spot = P.spots[(2 + k * 2) % P.spots.length]; const side = k % 2 ? 1 : -1; const x = spot.x + spot.nx * 4.4 * side, z = spot.z + spot.nz * 4.4 * side; const look = (prof.avatar && prof.avatar.look) || {}; const person = makePerson({ age: 'adult', shirt: look.shirt || 0x38f0ff, hair: look.hair || 0x4a2e15, skin: look.skin || 0xe0ac7e }); const g = new T.Group(); g.add(person); g.position.set(x, terrainY(x, z), z); S.add(g); const mode = MODES[prof.mode] || MODES.hanging; const ring = ringMesh(mode.color); g.add(ring); const tag = makeSprite(mode.icon + ' ' + (prof.name || 'Someone') + ' · ' + P.icon, { scale: 3.2, accent: mode.css }); tag.position.y = 2.75; g.add(tag); W.residents.push({ prof, g, person, ring, tag, walk: false, phase: Math.random() * 6, spot, P }); app.addHotspot(g, { fn: () => W.api.openProfile(prof) }); };
}
export function ringMesh(color) { const m = new T.Mesh(new T.TorusGeometry(0.62, 0.07, 8, 40), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.3 })); m.rotation.x = Math.PI / 2; m.position.y = 0.08; m.userData.noCollide = true; m.userData.noOcclude = true; return m; }

/* ---------- LIVE PLAYERS (Supabase presence) ---------- */
function buildRemote(W) {
  const { app } = W; const S = app.scene;
  W.remoteUpsert = (id, d) => { let r = W.remote.get(id);
    if (!r) { r = { id, g: new T.Group(), tgt: new T.Vector3(d.x, 0, d.z), yaw: d.yaw || 0, body: null, mode: d.mode || 'hanging', prof: d.profile || { id, name: d.name || 'Someone' } }; r.g.position.set(d.x, groundY(d.x, d.z), d.z); S.add(r.g); r.ring = ringMesh((MODES[r.mode] || MODES.hanging).color); r.g.add(r.ring); r.tag = makeSprite((MODES[r.mode] || MODES.hanging).icon + ' ' + (r.prof.name || 'Someone'), { scale: 3.2, accent: (MODES[r.mode] || MODES.hanging).css }); r.tag.position.y = 2.8; r.g.add(r.tag); W.remote.set(id, r); app.addHotspot(r.g, { fn: () => W.api.openProfile(r.prof) });
      const av = (d.profile && d.profile.avatar) || {}; const ch = CHARACTERS.find(c => c.id === av.ch) || CHARACTERS[0]; buildCharacter(ch, av.look || {}, null).then(m => { if (!W.remote.has(id)) return; r.body = m; r.g.add(m); }).catch(() => { r.body = makePerson({}); r.g.add(r.body); }); }
    if (d.x !== undefined) r.tgt.set(d.x, 0, d.z); if (d.yaw !== undefined) r.yaw = d.yaw; r.moving = !!d.moving; r.seen = app.t; if (d.profile) r.prof = d.profile;
    if (d.mode && d.mode !== r.mode) { r.mode = d.mode; const M2 = MODES[r.mode] || MODES.hanging; r.ring.material.color.setHex(M2.color); r.ring.material.emissive.setHex(M2.color); r.g.remove(r.tag); r.tag = makeSprite(M2.icon + ' ' + (r.prof.name || 'Someone'), { scale: 3.2, accent: M2.css }); r.tag.position.y = 2.8; r.g.add(r.tag); }
    return r; };
  W.remoteRemove = (id) => { const r = W.remote.get(id); if (!r) return; S.remove(r.g); app.hotspots = app.hotspots.filter(h => h !== r.g); W.remote.delete(id); };
  app.onUpdate((dt, t) => { for (const r of W.remote.values()) { const g = r.g; g.position.x += (r.tgt.x - g.position.x) * Math.min(1, dt * 6); g.position.z += (r.tgt.z - g.position.z) * Math.min(1, dt * 6); g.position.y = groundY(g.position.x, g.position.z); let da = r.yaw - g.rotation.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; g.rotation.y += da * Math.min(1, dt * 6); if (r.body) animatePerson(r.body, t, r.moving ? 1 : 0); if (app.t - (r.seen || 0) > 30) W.remoteRemove(r.id); } });
}

/* ---------- YOUR STATUS RING ---------- */
function buildMyRing(W) { const { app } = W; const ring = ringMesh(MODES.hanging.color); app.player.add(ring); W.myRing = ring; W.setMyMode = (mode) => { const M2 = MODES[mode] || MODES.hanging; ring.material.color.setHex(M2.color); ring.material.emissive.setHex(M2.color); }; app.onUpdate((dt, t) => { ring.visible = !app.vehicle && !(STATE.dive > 0.1); ring.material.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.5; ring.rotation.z += dt * 0.6; }); }

/* ---------- LUMI: the guide orb that floats by your shoulder ---------- */
function buildLumi(W) {
  const { app } = W; const S = app.scene; const g = new T.Group(); S.add(g); W.lumi = g;
  const core = sph(0.32, new T.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffd88a, emissiveIntensity: 2.2, roughness: 0.2 }), 0, 0, 0, g, 20);
  const c = document.createElement('canvas'); c.width = c.height = 128; const q = c.getContext('2d'); const gr = q.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,190,.9)'); gr.addColorStop(0.35, 'rgba(255,200,90,.35)'); gr.addColorStop(1, 'rgba(255,200,90,0)'); q.fillStyle = gr; q.fillRect(0, 0, 128, 128); const halo = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); halo.scale.set(1.9, 1.9, 1); g.add(halo);
  const eyes = new T.Group(); g.add(eyes); for (const sx of [-0.1, 0.1]) { const e = sph(0.045, new T.MeshBasicMaterial({ color: 0x3a2a10 }), sx, 0.04, 0.3, eyes, 8); e.scale.y = 1.4; }
  const sparks = []; for (let i = 0; i < 6; i++) { const s = sph(0.04, glow(0xffffff, 3), 0, 0, 0, g, 6); sparks.push(s); }
  const pos = new T.Vector3(); g.position.copy(app.player.position).add(new T.Vector3(1.2, 2.4, 0));
  app.onUpdate((dt, t) => { const P = app.player.position; const yaw = app.yaw; pos.set(P.x + Math.cos(yaw) * 1.3 - Math.sin(yaw) * 0.4, P.y + 2.4 + Math.sin(t * 2) * 0.12, P.z - Math.sin(yaw) * 1.3 - Math.cos(yaw) * 0.4); g.position.lerp(pos, Math.min(1, dt * 3)); const cam = app.camera.getWorldPosition(new T.Vector3()); eyes.lookAt(cam.x, eyes.getWorldPosition(new T.Vector3()).y, cam.z); eyes.rotation.x = 0; sparks.forEach((s, i) => { const a = t * 1.6 + i; s.position.set(Math.cos(a) * 0.55, Math.sin(a * 1.3) * 0.25, Math.sin(a) * 0.55); }); core.scale.setScalar(1 + Math.sin(t * 4) * 0.04); });
  app.addHotspot(g, { fn: () => W.api.openLumi() });
}

/* ============================================================
   allofus.one · the world
   Hub layout (meters, north = −z):
     Gateway arch (0,165) → Zach's place (44,105) on the right →
     Central Plaza (0,0) with The One monument + teleporters.
     7 life paths radiate from the plaza, each to its district:
       Business → City (north)        Learning → Library (NE)
       Wellness → Waterfall (west)    Adventure → Desert (east)
       Causes → Starport + Orbit      Creativity → Art Garden (NW)
       Explore → Beach + Ocean (SW)
   Past the hub, roads keep going forever in every direction.
   ============================================================ */
import { THREE, isMobile, makeSprite, makeSign, makeEarth, SKIES, rand, pick } from './aou-engine.js';
import { M, glow, basic, glass, box, cyl, sph, plane, textPlane, waterMaterial, tickWater, paintArt, ART, instanceKit, stamp, NEON, PINK, GOLD, MINT, VIOLET, ORANGE, SKY } from './aou-kit.js';
import { terrainY, groundY, ribbonPath, Ground, Chunks, addFlat, makePath, openGround, ribbon, roadInfo, waterAt, isDesert, isSnow, seeded, fbm, smooth, WATERS, PATHS, STATE, OCEAN, LAKE, POOL, CLIFF_X, ORBIT, GRID, ROAD_W, HUB, CHUNK, bridgeAt } from './aou-terrain.js';
import { buildZachHouse, buildHome, STYLES, SKINS } from './aou-house.js';
const T = THREE;

export const MODES = {
  home: { label: 'Home', icon: '🏠', color: 0xffd23f, css: '#ffd23f', desc: 'At my place. My I\'M HOME sign is lit. Knock!' },
  hanging: { label: 'Hanging', icon: '🟢', color: 0x7cff6b, css: '#4ade80', desc: 'Open to chat, waves and group hangs.' },
  working: { label: 'Working', icon: '💼', color: 0x38b6ff, css: '#38b6ff', desc: 'Collab invites only. Casual chats wait in a pile.' },
  exploring: { label: 'Exploring', icon: '🧭', color: 0xff8a3d, css: '#ff8a3d', desc: 'Out roaming the paths. Wave hi.' },
  dnd: { label: 'Do Not Disturb', icon: '🌙', color: 0x9aa3b8, css: '#9aa3b8', desc: 'Visible, but not reachable right now.' },
};
export const LIFE_PATHS = [
  { id: 'business', name: 'Business', icon: '💼', color: 0xffd23f, css: '#e0a800', to: 'The City', pts: [[18, -40], [40, -80], [52, -140], [38, -168]] },
  { id: 'learning', name: 'Learning', icon: '📚', color: 0x38b6ff, css: '#2f86ff', to: 'Library of Everything', pts: [[34, -26], [80, -50], [150, -110], [196, -172]] },
  { id: 'wellness', name: 'Wellness', icon: '🌿', color: 0x7cff6b, css: '#22a35a', to: 'The Waterfall', pts: [[-42, -14], [-90, -30], [-160, -40], [-236, -30]] },
  { id: 'adventure', name: 'Adventure', icon: '🏜️', color: 0xff8a3d, css: '#e8671e', to: 'The Desert', pts: [[44, 8], [90, 12], [160, -6], [214, -24]] },
  { id: 'causes', name: 'Causes', icon: '❤️', color: 0xff4f79, css: '#e11d48', to: 'Starport + Orbit Garden', pts: [[38, 24], [76, 40], [160, 92], [206, 186]] },
  { id: 'creativity', name: 'Creativity', icon: '🎨', color: 0xb08cff, css: '#7c3aed', to: 'The Art Garden', pts: [[-30, -34], [-60, -70], [-120, -140], [-160, -180]] },
  { id: 'explore', name: 'Explore', icon: '🌊', color: 0x2fe0c0, css: '#0d9488', to: 'The Beach + Ocean', pts: [[-34, 30], [-70, 70], [-130, 150], [-168, 206]] },
];
export const ZONES = {
  gate: { x: 0, z: 165 }, plaza: { x: 0, z: 0 }, house: { x: 44, z: 105 }, city: { x: 0, z: -250 }, library: { x: 214, z: -190 }, falls: { x: -248, z: -24 }, desert: { x: 262, z: -70 }, beach: { x: -178, z: 222 }, starport: { x: 226, z: 214 }, art: { x: -178, z: -198 }, orbit: { x: ORBIT.x, z: ORBIT.z },
};

export async function buildWorld(app, api) {
  const S = app.scene; const mob = isMobile();
  const W = { app, api, residents: [], lots: new Map(), claims: new Map(), remote: new Map(), seeds: [], atvs: [] };

  /* ---------- water you can swim in ---------- */
  const regWater = (c, y, dive) => { const w = { x: c.x, z: c.z, r: c.r, y, dive }; WATERS.push(w); app.addWater({ x: c.x, z: c.z, r: c.r, y }); return w; };
  regWater({ x: OCEAN.x, z: OCEAN.z, r: OCEAN.r - 2 }, 0, true); regWater({ x: LAKE.x, z: LAKE.z, r: LAKE.r - 2 }, 0.15, true); regWater({ x: POOL.x, z: POOL.z, r: POOL.r - 1 }, 0.2, true);

  /* ---------- flat ground for plazas, lots, districts ---------- */
  addFlat({ x: 0, z: 165, r: 34, y: 0.6 }); addFlat({ x: 0, z: 0, r: 46, y: 0.6, soft: 14 }); addFlat({ x1: 22, z1: 84, x2: 86, z2: 134, y: 0.6 });
  addFlat({ x1: -150, z1: -345, x2: 150, z2: -150, y: 0.6, soft: 18 }); addFlat({ x: 214, z: -190, r: 30, y: 0.8 }); addFlat({ x: 226, z: 214, r: 40, y: 0.8 }); addFlat({ x: -178, z: -198, r: 42, y: 0.8 }); addFlat({ x: 262, z: -70, r: 34, y: 1.2 }); addFlat({ x: -236, z: -30, r: 12, y: 0.8 });
  const FIRST = [[-30, 122, 'bungalow'], [-30, 90, 'treehouse'], [-30, 58, 'space'], [32, 66, 'loft'], [-68, 112, 'mansion'], [-36, 150, 'beach']];
  for (const [x, z] of FIRST) addFlat({ x, z, r: 12, y: 0.6 });
  for (const P of LIFE_PATHS) { const pts = [[0, 0], ...P.pts]; P.path = makePath(pts, 3.2); }

  /* ---------- ground + endless chunks ---------- */
  const ground = W.ground = new Ground(app);
  const kits = {}; const loadKits = Promise.all([['birch1', '/models/tree-birch-1.glb', 9], ['birch2', '/models/tree-birch-2.glb', 10], ['maple1', '/models/tree-maple-1.glb', 9], ['maple2', '/models/tree-maple-2.glb', 11], ['bush', '/models/bush-large.glb', 1.6], ['bushf', '/models/bush-flowers.glb', 1.3], ['flowers', '/models/flowers-1.glb', 0.6]].map(([k, u, h]) => instanceKit(u, h).then(v => { kits[k] = v; }).catch(e => console.warn('kit', k, e))));
  const proc = procKits();
  const chunks = W.chunks = new Chunks(app, { decorate: (c) => decorate(c, W, kits, proc) });
  loadKits.then(() => { for (const [k] of [...chunks.live]) { const [i, j] = k.split(',').map(Number); chunks.rebuildAt(i * CHUNK + 1, j * CHUNK + 1); } });

  /* ---------- hills: no walking up cliffs or through steep slopes ---------- */
  const blocked0 = app._blocked.bind(app);
  app._blocked = (nx, nz) => { if (blocked0(nx, nz)) return true; if (app.vehicle && false) return false; const P = app.player.position; const d = Math.hypot(nx - P.x, nz - P.z); if (d < 0.0001) return false; if (bridgeAt(nx, nz) !== null || roadInfo(nx, nz).d < ROAD_W / 2 + 1) return false; const w = waterAt(nx, nz); if (w) return false; const h0 = terrainY(P.x, P.z), h1 = terrainY(nx, nz); const slope = (h1 - h0) / d; return slope > (app.vehicle ? 1.1 : 0.85); };

  /* ---------- diving: swim under the surface and see the reef ---------- */
  const swim0 = app._swim.bind(app);
  app._swim = (dt) => { const p = app.player.position; const w = waterAt(p.x, p.z); const deep = w && w.dive && terrainY(p.x, p.z) < w.y - 2.4; if (!deep && STATE.diving) { STATE.diving = false; api.onDive && api.onDive(false); } STATE.dive += ((STATE.diving ? 1 : 0) - STATE.dive) * Math.min(1, dt * 1.6); if (STATE.dive > 0.04 && w) { const av = app.avatar; const S2 = app._sw || (app._sw = { on: false, k: 0 }); if (S2.on) { app._clipMats(av, null); S2.on = false; if (S2.ring) S2.ring.visible = false; } av.rotation.order = 'YXZ'; av.rotation.x = app.moving ? 1.25 : 0.4; av.position.y = Math.sin(app.t * 1.6) * 0.15; return; } swim0(dt); };
  W.canDive = () => { const p = app.player.position; const w = waterAt(p.x, p.z); return !!(w && w.dive && terrainY(p.x, p.z) < w.y - 2.4 && !app.vehicle); };
  W.setDive = (on) => { STATE.diving = !!on && W.canDive(); if (STATE.diving) app.toast('🤿 Diving! Steer with the stick or WASD. Tap ⬆️ Surface to come up.', 3200); return STATE.diving; };

  /* ---------- shared look ---------- */
  const paveTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 64) { g.fillStyle = `hsl(35,${10 + Math.random() * 8}%,${82 + Math.random() * 8}%)`; g.fillRect(x + ((y / 32) % 2) * 32 + 1, y + 1, 62, 30); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const disc = (x, z, r, mat, y = 0.05) => { const m = new T.Mesh(new T.CircleGeometry(r, 64), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, terrainY(x, z) + y, z); m.receiveShadow = true; m.userData.noCollide = true; S.add(m); return m; };
  const at = (x, z, obj, y = 0) => { obj.position.set(x, terrainY(x, z) + y, z); S.add(obj); return obj; };
  const sign = (lines, x, z, ry, o = {}) => { const s = makeSign(lines, Object.assign({ width: 6, height: 2.6, postHeight: 2.2 }, o)); s.rotation.y = ry; return at(x, z, s); };
  W.at = at; W.disc = disc; W.sign = sign;

  /* ---------- life paths: glowing trails you can walk ---------- */
  for (const P of LIFE_PATHS) {
    const pts = [[0, 0], ...P.pts]; const col = new T.Color(P.color); const trail = M(0xf3efe6, { roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); const edge = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z))); const N = Math.ceil(curve.getLength() / 6); const sp = curve.getSpacedPoints(N);
    { const out = sp.filter(v => Math.hypot(v.x, v.z) > 44); const dense = []; for (let i = 0; i < out.length - 1; i++) for (let k = 0; k < 2; k++) { const a = out[i], b = out[i + 1]; dense.push({ x: a.x + (b.x - a.x) * k / 2, z: a.z + (b.z - a.z) * k / 2 }); } if (out.length) dense.push(out[out.length - 1]); const m0 = ribbonPath(dense, 4.4, 0.1, trail); if (m0) S.add(m0); for (const s of [-1, 1]) { const e = ribbonPath(dense, 0.3, 0.13, edge, s * 2.35); if (e) S.add(e); } }
    P.curve = curve; P.spots = sp.filter(v => Math.hypot(v.x, v.z) > 52).map((v, i, arr) => { const nb = arr[Math.min(arr.length - 1, i + 1)], pv = arr[Math.max(0, i - 1)]; const dx = nb.x - pv.x, dz = nb.z - pv.z, l = Math.hypot(dx, dz) || 1; return { x: v.x, z: v.z, nx: -dz / l, nz: dx / l }; });
    const st = P.pts[0]; const ang = Math.atan2(st[0], st[1]);
    const s = makeSign([P.icon + ' ' + P.name.toUpperCase(), '→ ' + P.to], { width: 5.4, height: 2.2, postHeight: 2.2, accent: P.css, neon: true }); s.rotation.y = ang + Math.PI; at(st[0] * 1.05 + Math.cos(ang) * 4, st[1] * 1.05 - Math.sin(ang) * 4, s);
    const end = P.pts[P.pts.length - 1]; const arch = new T.Group(); for (const sx of [-1, 1]) cyl(0.2, 0.25, 5, glow(P.color, 1.1), sx * 3, 2.5, 0, arch, 10); const top = new T.Mesh(new T.TorusGeometry(3, 0.18, 8, 30, Math.PI), glow(P.color, 1.6)); top.position.y = 5; arch.add(top); const ln = P.pts[P.pts.length - 2]; arch.rotation.y = Math.atan2(end[0] - ln[0], end[1] - ln[1]); at(end[0], end[1], arch);
    app.addPlace({ id: 'path-' + P.id, name: P.icon + ' ' + P.name + ' path', icon: P.icon, x: st[0] * 1.3, z: st[1] * 1.3, cat: 'Life paths', keys: P.name + ' path ' + P.to, say: 'This is the ' + P.name + ' path. People who chose it stand along the trail. Tap anyone to say hi.' });
  }

  /* ---------- GATEWAY ---------- */
  { const gx = 0, gz = 170; const g = new T.Group(); const stone = M(0xf4f1ea, { roughness: 0.6 }), gold = M(0xc9a24a, { metalness: 0.8, roughness: 0.25 });
    for (const sx of [-1, 1]) { const py = new T.Group(); py.position.x = sx * 17; g.add(py); for (let k = 0; k < 4; k++) box(4 - k * 0.6, 4.2, 4 - k * 0.6, stone, 0, 2.1 + k * 4.2, 0, py).castShadow = true; for (let k = 0; k < 4; k++) box(4.1 - k * 0.6, 0.25, 4.1 - k * 0.6, gold, 0, 4.2 + k * 4.2, 0, py); const ring = new T.Mesh(new T.TorusGeometry(1.4, 0.16, 10, 32), glow(NEON, 2)); ring.position.set(0, 19.5, 0); py.add(ring); app.onUpdate((dt) => { ring.rotation.y += dt * 1.2; }); app.addBox(sx * 17, gz, 2.2, 2.2); }
    const beam = box(38, 2.6, 2.4, stone, 0, 15.5, 0, g); beam.castShadow = true; box(38.2, 0.3, 2.5, gold, 0, 14.1, 0, g); box(38.2, 0.3, 2.5, gold, 0, 16.9, 0, g);
    const t1 = textPlane(['ALL OF US · ONE'], 30, 2.2, { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', accent: '#c9a24a', font: 'bold 150px Georgia, serif', border: null, glow: false }); t1.position.set(0, 15.5, 1.25); g.add(t1); const t2 = t1.clone(); t2.rotation.y = Math.PI; t2.position.z = -1.25; g.add(t2);
    const wel = textPlane(['Welcome home 🌍'], 14, 1.6, { bg: 'rgba(255,255,255,0.0)', fg: '#ffffff', accent: '#38f0ff', font: 'bold 110px Poppins, Arial', border: null, glow: true }); wel.position.set(0, 19.6, 0); g.add(wel);
    at(gx, gz, g); disc(0, 165, 30, M(0xffffff, { map: (() => { const t = paveTex.clone(); t.needsUpdate = true; t.repeat.set(10, 10); return t; })(), roughness: 0.8 }), 0.04);
    const hint = sign(['👋 Start here', 'Walk up the road · Zach\'s place is first on the right · Plaza ahead'], 9, 150, Math.PI, { width: 7, height: 2.4, accent: '#38f0ff' });
    app.addPlace({ id: 'gate', name: '🌍 The Gateway', icon: '🌍', x: 0, z: 158, cat: 'Places', keys: 'start entrance gate arrival spawn welcome', say: 'Welcome home. All of us. One.' });
  }

  /* ---------- ZACH'S PLACE (first on the right) ---------- */
  const house = W.house = buildZachHouse(app, ZONES.house.x, ZONES.house.z, api);
  { // front walk from the road + a little sign
    const wm = M(0xffffff, { map: (() => { const t = paveTex.clone(); t.needsUpdate = true; t.repeat.set(1, 6); return t; })() });
    S.add(ribbon(6, 105, 30, 105, 3.2, 0.1, wm, 2)); sign(['🏛️ ZACH\'S PLACE', 'eco · deco · come on in'], 22, 96, -Math.PI / 2, { width: 5, height: 2, accent: '#ffd23f' });
    app.addPlace({ id: 'zach', name: '🏛️ Zach\'s place', icon: '🏛️', x: 24, z: 105, yaw: -Math.PI / 2, cat: 'Homes', keys: 'zach house home founder eco smart home observatory projector movie lake garden solar', say: 'Zach\'s place. Smart-home ideas everywhere: tap the green badges to learn how they work.' });
    app.addPlace({ id: 'movie', name: '🍿 Backyard movie night', icon: '🍿', x: house.chairs[1].position.x - 2, z: house.chairs[1].position.z, cat: 'Fun', keys: 'movie projector cartoon screen watch backyard', say: 'Sit down and the show starts.' });
  }
  // the lake behind Zach's place
  { const lk = new T.Mesh(new T.CircleGeometry(LAKE.r + 1, 64), waterMaterial(0x2a9fd6, 0x0b4f80)); lk.rotation.x = -Math.PI / 2; lk.position.set(LAKE.x, 0.15, LAKE.z); lk.userData.noCollide = true; S.add(lk); const dock = new T.Group(); box(2.4, 0.2, 12, M(0x8a5f3a, { roughness: 0.85 }), 0, 0.6, 0, dock); for (const z of [-5, 0, 5]) for (const sx of [-1, 1]) cyl(0.12, 0.12, 2.4, M(0x5a3a22), sx * 1.1, -0.3, z, dock, 6); dock.rotation.y = -0.9; dock.position.set(LAKE.x - LAKE.r + 4, 0, LAKE.z + 9); S.add(dock); }

  /* ---------- FIRST STREET: neighbors in every home style ---------- */
  const NEIGHBORS = ['Maya', 'Kofi', 'Ana', 'Ravi', 'Lena', 'Tomás'];
  FIRST.forEach(([x, z, style], i) => { const H = buildHome(style, { accent: [NEON, PINK, MINT, GOLD, VIOLET, ORANGE][i] }); const ry = x < 0 ? Math.PI / 2 : -Math.PI / 2; H.group.rotation.y = ry; at(x, z, H.group); for (const [lx, lz, hw, hd] of H.boxes) { const c = Math.cos(ry), s = Math.sin(ry); app.addBox(x + lx * c + lz * s, z - lx * s + lz * c, Math.abs(hw * c) + Math.abs(hd * s), Math.abs(hw * s) + Math.abs(hd * c)); } const st = STYLES.find(q => q[0] === style); const pl = makeSprite(st[1] + ' ' + NEIGHBORS[i] + '\'s ' + st[2], { scale: 3.4, accent: '#ffd23f' }); pl.position.set(x + (x < 0 ? 9 : -9), terrainY(x, z) + 3.4, z); S.add(pl); });
  app.addPlace({ id: 'first-street', name: '🏡 First Street homes', icon: '🏡', x: -12, z: 90, cat: 'Homes', keys: 'homes houses neighbors styles treehouse space villa loft mansion bungalow beach', say: 'Every home style you can build. Claim land past the gate and build yours.' });
  // neighborhood one: open lots down Unity Road south of the gate
  W.neighborhood = (x, z) => Math.abs(x) < 60 && z > 196 && z < 392;

  /* ---------- CENTRAL PLAZA + THE ONE ---------- */
  { const pv = paveTex.clone(); pv.needsUpdate = true; pv.repeat.set(16, 16); disc(0, 0, 46, M(0xffffff, { map: pv, roughness: 0.75 }), 0.04);
    const rings = [12, 20, 30, 40]; rings.forEach((r, i) => { const m = new T.Mesh(new T.RingGeometry(r - 0.25, r + 0.25, 96), glow([GOLD, NEON, MINT, PINK][i], 0.7)); m.rotation.x = -Math.PI / 2; m.position.y = terrainY(0, 0) + 0.07; m.userData.noCollide = true; S.add(m); });
    const one = new T.Group(); at(0, 0, one); const fount = new T.Mesh(new T.RingGeometry(5.2, 9, 64), waterMaterial(0x38d8ff, 0x0b6fb0)); fount.rotation.x = -Math.PI / 2; fount.position.y = 0.45; one.add(fount); const lip = new T.Mesh(new T.TorusGeometry(9.1, 0.35, 8, 64), M(0xf4f1ea, { roughness: 0.5 })); lip.rotation.x = -Math.PI / 2; lip.position.y = 0.4; one.add(lip); cyl(5.2, 5.6, 0.9, M(0xf4f1ea), 0, 0.45, 0, one, 40); app.addObstacle(0, 0, 9.6);
    LIFE_PATHS.forEach((P, i) => { const a = i / LIFE_PATHS.length * Math.PI * 2; const cv = new T.CatmullRomCurve3([new T.Vector3(Math.cos(a) * 4.4, 0.9, Math.sin(a) * 4.4), new T.Vector3(Math.cos(a) * 5.8, 7, Math.sin(a) * 5.8), new T.Vector3(Math.cos(a) * 2.2, 13, Math.sin(a) * 2.2), new T.Vector3(0, 15.2, 0)]); const arc = new T.Mesh(new T.TubeGeometry(cv, 40, 0.32, 10), new T.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.25 })); arc.castShadow = true; one.add(arc); });
    const earth = makeEarth(2.6, { clouds: true }); earth.position.y = 18; one.add(earth); const halo = new T.Mesh(new T.TorusGeometry(3.6, 0.08, 8, 64), glow(0xffffff, 2)); halo.position.y = 18; halo.rotation.x = Math.PI / 2.4; one.add(halo);
    const jets = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const j = new T.Mesh(new T.CylinderGeometry(0.06, 0.16, 1, 6, 1, true), new T.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.55, depthWrite: false })); j.position.set(Math.cos(a) * 7, 0.5, Math.sin(a) * 7); j.userData.noCollide = true; one.add(j); jets.push([j, i]); }
    app.onUpdate((dt, t) => { earth.rotation.y += dt * 0.15; halo.rotation.z += dt * 0.4; for (const [j, i] of jets) { const h = 2.2 + Math.sin(t * 2 + i * 0.9) * 1.2; j.scale.y = h; j.position.y = 0.5 + h / 2; } });
    app.addHotspot(one, { title: '🌍 The One', html: '<p>Seven paths, one world. Every arc is a life path (Business, Learning, Wellness, Adventure, Causes, Creativity, Explore), and they all meet at the same planet.</p><p>Pick your paths on your LIFEboard and your avatar shows up along those trails for others to find.</p>', actions: [{ label: '🏠 Open my LIFEboard', fn: () => api.openLifeboard('paths'), primary: true }] });
    // mode signpost
    const ms = new T.Group(); at(-14, 30, ms); box(0.25, 3.2, 0.25, M(0x2a1a10), 0, 1.6, 0, ms); const mtex = textPlane(['STATUS RINGS', '🏠 Home  🟢 Hanging  💼 Working', '🧭 Exploring  🌙 Do Not Disturb'], 6, 2.6, { bg: 'rgba(5,11,28,.92)', fg: '#fff', accent: '#7cff6b', font: 'bold 64px Poppins, Arial' }); mtex.position.set(0, 3.9, 0.15); ms.add(mtex); ms.rotation.y = Math.PI - 0.4; app.addHotspot(ms, { fn: () => api.openModes() }); app.addInteractable(-14, 30, 4, '🟢 Change my status ring', () => api.openModes());
    // Global Match board
    const mb = new T.Group(); at(16, 30, mb); mb.rotation.y = Math.PI + 0.4; for (const sx of [-2.6, 2.6]) box(0.25, 4.4, 0.25, M(0x2a1a10), sx, 2.2, 0, mb); const board = textPlane(['🤝 GLOBAL MATCH', 'I HAVE  ↔  I NEED', 'items · services · tap to post'], 5.4, 3.2, { bg: '#fffaf0', fg: '#1a1a1a', accent: '#ff4f79', font: 'bold 72px Poppins, Arial' }); board.position.set(0, 3, 0.14); mb.add(board); app.addHotspot(mb, { fn: () => api.openMatch() }); app.addInteractable(16, 30, 4.5, '🤝 Open Global Match', () => api.openMatch());
    // town square chat kiosk
    const tk = new T.Group(); at(-20, -26, tk); cyl(1.4, 1.6, 0.4, M(0xf4f1ea), 0, 0.2, 0, tk, 24); const tkc = cyl(0.25, 0.25, 3, M(0x1d2433), 0, 1.7, 0, tk, 10); const bub = sph(1.1, glow(0x7cff6b, 0.6), 0, 3.8, 0, tk, 16); bub.scale.set(1.3, 1, 0.5); const tkt = textPlane(['💬'], 1.2, 1.2, { bg: 'rgba(0,0,0,0)', border: null, font: 'bold 400px Arial' }); tkt.position.set(0, 3.8, 0.6); tk.add(tkt); app.addHotspot(tk, { fn: () => api.openRoom('town-square') }); app.addInteractable(-20, -26, 4, '💬 Join Town Square chat', () => api.openRoom('town-square')); app.addObstacle(-20, -26, 1.6);
    // benches
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; app.addBench(Math.cos(a) * 24, Math.sin(a) * 24, -a + Math.PI / 2, { say: 'Sit. Breathe. Look who is around. 🌍' }); }
    app.addPlace({ id: 'plaza', name: '🌍 Central Plaza', icon: '🌍', x: 0, z: 14, cat: 'Places', top: true, keys: 'plaza center middle monument the one teleport portals fountain', say: 'Central Plaza. All seven life paths start here. The portals ring the plaza.' });
  }

  /* ---------- TELEPORTERS around the plaza ---------- */
  const PORTALS = [['🏙️ The City', ZONES.city.x + 8, ZONES.city.z + 60, 0x38b6ff], ['📚 Library', ZONES.library.x - 18, ZONES.library.z + 20, 0x38b6ff], ['🌿 Waterfall', ZONES.falls.x + 30, ZONES.falls.z, 0x7cff6b], ['🏜️ Desert', ZONES.desert.x - 30, ZONES.desert.z + 20, 0xff8a3d], ['🚀 Starport', ZONES.starport.x - 24, ZONES.starport.z - 24, 0xff4f79], ['🎨 Art Garden', ZONES.art.x + 26, ZONES.art.z + 26, 0xb08cff], ['🌊 Beach', ZONES.beach.x + 12, ZONES.beach.z - 22, 0x2fe0c0], ['🏛️ Zach\'s', 24, 112, 0xffd23f]];
  PORTALS.forEach(([label, tx, tz, col], i) => { const a = i / PORTALS.length * Math.PI * 2 + Math.PI / 8; const px = Math.cos(a) * 36, pz = Math.sin(a) * 36; const to = new T.Vector3(tx, groundY(tx, tz), tz); app.addPortal(px, pz, to, { label, color: col, rot: -a + Math.PI / 2, yaw: Math.atan2(-tx, -tz) }); });
  // return portals in each district
  for (const [label, x, z] of [['🌍 Plaza', ZONES.city.x + 26, ZONES.city.z + 70], ['🌍 Plaza', ZONES.library.x - 30, ZONES.library.z + 8], ['🌍 Plaza', ZONES.falls.x + 44, ZONES.falls.z + 14], ['🌍 Plaza', ZONES.desert.x - 38, ZONES.desert.z + 8], ['🌍 Plaza', ZONES.starport.x - 36, ZONES.starport.z - 10], ['🌍 Plaza', ZONES.art.x + 38, ZONES.art.z + 12], ['🌍 Plaza', ZONES.beach.x + 24, ZONES.beach.z - 30]]) app.addPortal(x, z, new T.Vector3(0, 0.6, 30), { label, color: 0xffffff, yaw: 0 });

  /* ---------- districts ---------- */
  buildCity(W); buildLibrary(W); buildFalls(W); buildDesert(W); buildStarport(W); buildArtGarden(W);
  app.addPlace({ id: 'city', name: '🏙️ The City', icon: '🏙️', x: 0, z: -170, cat: 'Places', keys: 'city towers business work collab neon downtown', say: 'The City. Business path ends here: Collab Tower is straight ahead.' });
  app.addPlace({ id: 'library', name: '📚 Library of Everything', icon: '📚', x: ZONES.library.x - 14, z: ZONES.library.z + 24, cat: 'Places', keys: 'library learning books learn study school', say: 'Free learning from the best open sources on Earth.' });
  app.addPlace({ id: 'falls', name: '🌿 The Waterfall', icon: '🌿', x: ZONES.falls.x + 22, z: ZONES.falls.z + 6, yaw: -Math.PI / 2, cat: 'Places', keys: 'waterfall cliffs wellness swim pool atv nature', say: 'The Waterfall. Swim in the pool. Something glows behind the falls…' });
  app.addPlace({ id: 'desert', name: '🏜️ The Desert', icon: '🏜️', x: ZONES.desert.x - 20, z: ZONES.desert.z + 14, cat: 'Places', keys: 'desert ruins mesa canyon atv adventure sand cactus', say: 'The Desert. Grab the ATV and go.' });
  app.addPlace({ id: 'starport', name: '🚀 Starport', icon: '🚀', x: ZONES.starport.x - 16, z: ZONES.starport.z - 16, cat: 'Places', keys: 'space rocket starport orbit causes launch', say: 'Starport. The ring by the rocket beams you to Orbit Garden.' });
  app.addPlace({ id: 'art', name: '🎨 Art Garden', icon: '🎨', x: ZONES.art.x + 18, z: ZONES.art.z + 18, cat: 'Places', keys: 'art garden sculpture creativity wish lanterns gallery', say: 'The Art Garden. Make a wish at the lantern wall.' });
  app.addPlace({ id: 'beach', name: '🌊 Beach + Ocean', icon: '🌊', x: ZONES.beach.x + 6, z: ZONES.beach.z - 10, cat: 'Places', keys: 'beach ocean swim dive underwater fish reef shipwreck', say: 'Swim out past the buoys and tap 🤿 Dive. The reef is down there.' });

  /* ---------- map ---------- */
  app.setMap((g, P) => { g.fillStyle = '#4f8a3a'; g.fillRect(0, 0, 4000, 4000); }, { cx: 0, cz: 0, size: 1000, scale: 0.5, title: 'allofus.one · the hub (roads go on forever)' });

  /* ---------- daylight helpers ---------- */
  W.isNight = () => !!app.isNight;
  app.onUpdate((dt) => { tickWater(dt, app.isNight); const night = !!app.isNight; if (W._lampMat) W._lampMat.emissiveIntensity += ((night ? 2.6 : 0.15) - W._lampMat.emissiveIntensity) * Math.min(1, dt * 2); });

  return W;
}

/* ============================================================
   procedural kits for the endless land (instanced, cheap)
   ============================================================ */
function procKits() {
  const rockGeo = new T.IcosahedronGeometry(1, 1); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.75 + 0.5 * Math.abs(Math.sin(x * 3.1 + y * 2.3 + z * 4.7)); p.setXYZ(i, x * k, y * k * 0.7, z * k); } rockGeo.computeVertexNormals(); rockGeo.translate(0, 0.35, 0); }
  const rock = { parts: [{ geo: rockGeo, mat: M(0x8b8378, { roughness: 0.95, flatShading: true }) }] };
  const cact = (() => { const gs = []; const body = new T.CylinderGeometry(0.45, 0.55, 5, 8); body.translate(0, 2.5, 0); gs.push(body); for (const [s, y, h] of [[1, 2.2, 1.8], [-1, 3, 1.4]]) { const arm = new T.CylinderGeometry(0.3, 0.32, h, 8); arm.translate(s * 1.1, y + h / 2, 0); gs.push(arm); const el = new T.CylinderGeometry(0.3, 0.3, 1.1, 8); el.rotateZ(Math.PI / 2); el.translate(s * 0.6, y, 0); gs.push(el); } return { parts: gs.map(geo => ({ geo, mat: M(0x3f8a3a, { roughness: 0.7, flatShading: true }) })) }; })();
  const palm = (() => { const tr = new T.CylinderGeometry(0.22, 0.38, 9, 8); tr.translate(0, 4.5, 0); const leaves = []; for (let i = 0; i < 7; i++) { const l = new T.ConeGeometry(0.6, 4.6, 4); l.rotateZ(Math.PI / 2 + 0.5); l.translate(2.1, 8.6, 0); l.rotateY(i / 7 * Math.PI * 2); leaves.push(l); } return { parts: [{ geo: tr, mat: M(0x9a7a52, { roughness: 0.9 }) }, ...leaves.map(geo => ({ geo, mat: M(0x3fa34a, { roughness: 0.7, side: T.DoubleSide }) }))] }; })();
  const pine = (() => { const tr = new T.CylinderGeometry(0.25, 0.35, 3, 6); tr.translate(0, 1.5, 0); const parts = [{ geo: tr, mat: M(0x5a3a22) }]; for (let i = 0; i < 3; i++) { const c = new T.ConeGeometry(2.6 - i * 0.6, 3.6, 8); c.translate(0, 3.6 + i * 2.1, 0); parts.push({ geo: c, mat: M(0x2e6b3a, { roughness: 0.85, flatShading: true }) }); } return { parts }; })();
  const lampPole = new T.CylinderGeometry(0.1, 0.14, 7, 6); lampPole.translate(0, 3.5, 0); const lampHead = new T.BoxGeometry(1.4, 0.25, 0.5); lampHead.translate(0.6, 7, 0);
  const lampMat = new T.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd88a, emissiveIntensity: 0.2 });
  const lamp = { parts: [{ geo: lampPole, mat: M(0x3b3f46, { metalness: 0.7, roughness: 0.4 }) }, { geo: lampHead, mat: lampMat }] };
  const stake = (() => { const p = new T.CylinderGeometry(0.08, 0.08, 1.6, 6); p.translate(0, 0.8, 0); const b = new T.BoxGeometry(1.6, 0.9, 0.08); b.translate(0, 1.7, 0); return { parts: [{ geo: p, mat: M(0x8a5f3a) }, { geo: b, mat: M(0x7cff6b, { emissive: 0x2a8a2a, emissiveIntensity: 0.4 }) }] }; })();
  return { rock, cact, palm, pine, lamp, lampMat, stake };
}

/* chunk decoration (runs for every chunk, hub included; hand-built areas are protected by FLATS/paths) */
const LANDMARKS = ['cube', 'crystals', 'henge', 'door', 'booth', 'mushrooms', 'windmill', 'arch', 'head', 'marker', 'balloon'];
function decorate(c, W, kits, P) {
  const { g, obs, acts, spots, R, x0, z0, x1, z1, inHub } = c; const app = W.app;
  if (!W._lampMat) W._lampMat = P.lampMat;
  const trees = { birch1: [], birch2: [], maple1: [], maple2: [], pine: [], palm: [], cact: [], rock: [], bush: [], bushf: [], flowers: [] };
  const N = inHub(x0 + 100, z0 + 100) ? 26 : 46;
  for (let n = 0; n < N; n++) {
    const x = x0 + R() * CHUNK, z = z0 + R() * CHUNK; if (!openGround(x, z, 3)) continue; if (roadInfo(x, z).d < 42) continue; if (Math.hypot(x, z) < 60) continue; if (W.neighborhood && W.neighborhood(x, z) && Math.abs(x) < 50) continue;
    const y = terrainY(x, z); const ds = isDesert(x, z), sn = isSnow(x, z); const nearSea = Math.hypot(x - OCEAN.x, z - OCEAN.z) < 240; const ry = R() * 6.28, s = 0.8 + R() * 0.5;
    let k; if (ds > 0.5) k = R() < 0.55 ? 'cact' : 'rock'; else if (nearSea) k = R() < 0.6 ? 'palm' : 'rock'; else if (sn > 0.5 || y > 26) k = R() < 0.75 ? 'pine' : 'rock'; else { const q = R(); k = q < 0.16 ? 'birch1' : q < 0.3 ? 'birch2' : q < 0.44 ? 'maple1' : q < 0.56 ? 'maple2' : q < 0.68 ? 'pine' : q < 0.78 ? 'rock' : q < 0.88 ? 'bush' : q < 0.95 ? 'bushf' : 'flowers'; }
    trees[k].push({ x, y: y - 0.1, z, ry, s: k === 'rock' ? 0.6 + R() * 1.6 : s });
    if (!['bush', 'bushf', 'flowers'].includes(k)) { const ob = { x, z, r: k === 'rock' ? 0.9 * s : 0.7 }; app.obstacles.push(ob); obs.push(ob); }
  }
  for (const k of Object.keys(trees)) { const kit = kits[k] || P[k]; if (kit) stamp(kit, trees[k], g); }
  // street lamps + lots along every road in this chunk
  const lamps = [], stakes = [];
  const roadLines = []; for (let gx = Math.ceil(x0 / GRID) * GRID; gx < x1; gx += GRID) roadLines.push(['z', gx]); for (let gz = Math.ceil(z0 / GRID) * GRID; gz < z1; gz += GRID) roadLines.push(['x', gz]);
  for (const [ax, v] of roadLines) {
    for (let t = 0; t < CHUNK; t += 36) {
      const along = (ax === 'z' ? z0 : x0) + t + 18; const nearX = Math.abs(along - Math.round(along / GRID) * GRID) < 30; if (nearX) continue;
      for (const side of [-1, 1]) {
        const lx = ax === 'z' ? v + side * 7.5 : along, lz = ax === 'z' ? along : v + side * 7.5; if (bridgeAt(ax === 'z' ? v : along, ax === 'z' ? along : v) !== null) continue;
        if ((t / 36) % 2 === 0 && !waterAt(lx, lz)) lamps.push({ x: lx, y: terrainY(lx, lz), z: lz, ry: ax === 'z' ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
        const cx = ax === 'z' ? v + side * 26 : along, cz = ax === 'z' ? along : v + side * 26;
        const hubOk = !inHub(cx, cz) || (W.neighborhood && W.neighborhood(cx, cz)); if (!hubOk) continue; if (waterAt(cx, cz) || terrainY(cx, cz) < 0.8) continue; const sl = Math.abs(terrainY(cx + 10, cz) - terrainY(cx - 10, cz)) + Math.abs(terrainY(cx, cz + 10) - terrainY(cx, cz - 10)); if (sl > 9) continue;
        const id = Math.round(cx) + '_' + Math.round(cz); const face = ax === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0); const lot = { id, x: cx, z: cz, face, road: ax + ':' + v }; W.lots.set(id, lot);
        const claim = W.claims.get(id);
        if (claim) { const H = (W.buildCustom && W.buildCustom(claim)) || buildHome(claim.style || 'deco', { skin: claim.skin }); H.group.rotation.y = face + Math.PI; H.group.position.set(cx, terrainY(cx, cz), cz); g.add(H.group); const ry = H.group.rotation.y; for (const [bx, bz, hw, hd] of H.boxes) { const cs = Math.cos(ry), sn = Math.sin(ry); const ob = { x: cx + bx * cs + bz * sn, z: cz - bx * sn + bz * cs, hw: Math.abs(hw * cs) + Math.abs(hd * sn), hd: Math.abs(hw * sn) + Math.abs(hd * cs) }; app.obstacles.push(ob); obs.push(ob); } const nm = makeSprite('🏡 ' + (claim.name || 'Home'), { scale: 3.4, accent: '#ffd23f' }); nm.position.set(cx + Math.sin(face) * 12, terrainY(cx, cz) + 3.2, cz + Math.cos(face) * 12); g.add(nm); const it = { x: cx + Math.sin(face) * 12, z: cz + Math.cos(face) * 12, r: 5, label: '🏡 ' + (claim.name || 'Home') + ': visit', fn: () => W.api.visitHome(claim, lot) }; app.interactables = app.interactables || []; app.interactables.push(it); acts.push(it); }
        else { const sx = cx + Math.sin(face) * 11, sz = cz + Math.cos(face) * 11; stakes.push({ x: sx, y: terrainY(sx, sz), z: sz, ry: face }); const it = { x: sx, z: sz, r: 4.5, label: '🌍 Open land: claim it', fn: () => W.api.claimLot(lot) }; app.interactables = app.interactables || []; app.interactables.push(it); acts.push(it); }
      }
    }
  }
  stamp(P.lamp, lamps, g); stamp(P.stake, stakes, g);
  // one strange landmark in most chunks outside the hub
  const mid = [x0 + 100, z0 + 100]; if (!inHub(mid[0], mid[1]) && R() < 0.55) { for (let tries = 0; tries < 8; tries++) { const x = x0 + 30 + R() * 140, z = z0 + 30 + R() * 140; if (!openGround(x, z, 10)) continue; landmark(LANDMARKS[Math.floor(R() * LANDMARKS.length)], x, z, c, W, R); break; } }
}

function landmark(kind, x, z, c, W, R) {
  const app = W.app; const y = terrainY(x, z); const g = new T.Group(); g.position.set(x, y, z); c.g.add(g); const ob = (r) => { const o = { x, z, r }; app.obstacles.push(o); c.obs.push(o); };
  const hot = (data) => { app.addHotspot(g, data); c.spots.push(g); };
  const dist = Math.round(Math.hypot(x, z));
  if (kind === 'cube') { const m = new T.MeshStandardMaterial({ color: 0x38f0ff, emissive: 0x1a6f8a, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.1 }); const cb = box(4, 4, 4, m, 0, 7, 0, g); app.onUpdate((dt, t) => { cb.rotation.x += dt * 0.3; cb.rotation.y += dt * 0.5; cb.position.y = 7 + Math.sin(t) * 0.8; }); hot({ title: '🧊 The Floating Cube', html: '<p>Nobody knows who put it here. It hums a little. It is ' + dist + ' m from the Plaza.</p>' }); }
  else if (kind === 'crystals') { for (let i = 0; i < 9; i++) { const cr = new T.Mesh(new T.OctahedronGeometry(0.8 + R() * 1.4, 0), new T.MeshStandardMaterial({ color: [0xb08cff, 0x38f0ff, 0xff4f79][i % 3], emissive: [0x5a3aa8, 0x1a6f8a, 0x8a1f3a][i % 3], emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.15 })); cr.scale.y = 2 + R() * 2; cr.position.set((R() - 0.5) * 6, 1.5, (R() - 0.5) * 6); cr.rotation.z = (R() - 0.5) * 0.6; g.add(cr); } ob(4); hot({ title: '💎 Crystal Bloom', html: '<p>Crystals that grow toward whoever is looking at them. Probably.</p>' }); }
  else if (kind === 'henge') { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const s = box(1.2, 4 + R() * 1.5, 0.8, M(0x8b8378, { flatShading: true, roughness: 1 }), Math.cos(a) * 7, 2.2, Math.sin(a) * 7, g); s.rotation.y = -a; const o = { x: x + Math.cos(a) * 7, z: z + Math.sin(a) * 7, r: 0.9 }; app.obstacles.push(o); c.obs.push(o); } hot({ title: '🗿 Circle of Stones', html: '<p>Stand in the middle at night. The stars line up with the gaps.</p>' }); }
  else if (kind === 'door') { box(0.3, 4, 0.3, M(0xffffff), -1.2, 2, 0, g); box(0.3, 4, 0.3, M(0xffffff), 1.2, 2, 0, g); box(2.7, 0.3, 0.3, M(0xffffff), 0, 4.1, 0, g); const d = plane(2.1, 3.8, new T.MeshBasicMaterial({ color: 0xb08cff, transparent: true, opacity: 0.55, side: T.DoubleSide }), g); d.position.y = 2; app.onUpdate((dt, t) => { d.material.opacity = 0.35 + Math.sin(t * 2) * 0.2; }); const it = { x, z, r: 3, label: '🚪 Step through the lone door', fn: (a) => { a.fade.classList.add('on'); a.fade.textContent = '✨ Back to the Plaza'; setTimeout(() => { a.player.position.set(0, 0.6, 30); a.yaw = Math.PI; setTimeout(() => a.fade.classList.remove('on'), 250); }, 380); } }; app.interactables.push(it); c.acts.push(it); }
  else if (kind === 'booth') { box(1.6, 3, 1.6, M(0xc81e2a, { roughness: 0.5 }), 0, 1.5, 0, g); box(1.3, 2, 0.05, glass(), 0, 1.7, 0.81, g); ob(1.4); hot({ title: '☎️ A ringing phone booth', html: '<p>You pick up. A voice says: <i>"Someone, somewhere, needs exactly what you have. Check Global Match."</i> Click.</p>', actions: [{ label: '🤝 Open Global Match', fn: () => W.api.openMatch(), primary: true }] }); }
  else if (kind === 'mushrooms') { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const mx = Math.cos(a) * 5, mz = Math.sin(a) * 5; cyl(0.2, 0.3, 1.4, M(0xf4f1ea), mx, 0.7, mz, g, 8); const cap = sph(0.8, new T.MeshStandardMaterial({ color: 0xff4f79, emissive: 0xff4f79, emissiveIntensity: 0.35 }), mx, 1.5, mz, g, 12); cap.scale.y = 0.55; } hot({ title: '🍄 Fairy ring', html: '<p>Mushrooms in a perfect circle. They glow brighter when two friends stand inside together.</p>' }); }
  else if (kind === 'windmill') { cyl(1.4, 2.4, 12, M(0xf4f1ea), 0, 6, 0, g, 12); const hub = new T.Group(); hub.position.set(0, 11, 2.1); g.add(hub); for (let i = 0; i < 4; i++) { const arm = new T.Group(); arm.rotation.z = i * Math.PI / 2; box(1.2, 6, 0.1, M(0x8a5f3a), 0, 3.4, 0, arm); hub.add(arm); } app.onUpdate((dt) => { hub.rotation.z += dt * 0.8; }); ob(2.6); }
  else if (kind === 'arch') { const st = M(0xd9c9a8, { roughness: 1, flatShading: true }); for (const sx of [-3, 3]) box(1.4, 6, 1.4, st, sx, 3, 0, g); const top = new T.Mesh(new T.TorusGeometry(3, 0.7, 6, 12, Math.PI), st); top.position.y = 6; g.add(top); for (const sx of [-3, 3]) { const o = { x: x + sx, z, r: 1.1 }; app.obstacles.push(o); c.obs.push(o); } hot({ title: '🏛️ Old arch', html: '<p>Older than the roads. The roads politely go around it.</p>' }); }
  else if (kind === 'head') { const hd = box(3, 4.6, 3, M(0x7a7368, { flatShading: true, roughness: 1 }), 0, 2.3, 0, g); box(1.2, 1.8, 0.8, M(0x6a6358, { flatShading: true }), 0, 2.6, 1.7, g); ob(2.4); hot({ title: '🗿 The Listener', html: '<p>A giant stone head facing the Plaza, ' + dist + ' m away. Locals say it is listening for kindness.</p>' }); }
  else if (kind === 'balloon') { const b = sph(4, new T.MeshStandardMaterial({ color: [0xff4f79, 0xffd23f, 0x38b6ff][Math.floor(R() * 3)], roughness: 0.6 }), 0, 26, 0, g, 18); b.scale.y = 1.2; box(1.6, 1.2, 1.6, M(0x8a5f3a), 0, 19.5, 0, g); app.onUpdate((dt, t) => { g.position.y = y + Math.sin(t * 0.4 + x) * 2; }); }
  else { const s = makeSign(['📍 ' + dist + ' m from the Plaza', 'The road goes on. So can you.'], { width: 5, height: 2, postHeight: 2 }); g.add(s); }
}

/* ============================================================
   DISTRICTS
   ============================================================ */
function windowTex(seed, hue) { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = `hsl(${hue},22%,18%)`; g.fillRect(0, 0, 128, 256); const R = seeded(seed); for (let y = 6; y < 256; y += 16) for (let x = 6; x < 128; x += 14) { const on = R() < 0.55; g.fillStyle = on ? `hsl(${40 + R() * 20},90%,${65 + R() * 20}%)` : `hsl(${hue},30%,${26 + R() * 10}%)`; g.fillRect(x, y, 9, 10); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; }
function buildCity(W) {
  const { app } = W; const S = app.scene; const R = seeded(42); const mats = [0, 1, 2, 3].map(i => { const tx = windowTex(i + 3, [215, 260, 190, 330][i]); return new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.35 }); });
  const neon = [NEON, PINK, VIOLET, GOLD, MINT];
  for (let bx = -140; bx <= 140; bx += 28) for (let bz = -330; bz <= -160; bz += 30) {
    if (Math.abs(bx) < 22) continue; if (bz > -190 && Math.abs(bx) < 70) continue; if (Math.hypot(bx - 0, bz + 250) < 34) continue; if (R() < 0.18) continue;
    const w = 12 + R() * 8, d = 12 + R() * 8, h = 18 + R() * R() * 90; const m = mats[Math.floor(R() * 4)]; const tw = new T.Mesh(new T.BoxGeometry(w, h, d), m); const y = terrainY(bx, bz); tw.position.set(bx, y + h / 2, bz); tw.castShadow = true; tw.receiveShadow = true; S.add(tw); const uv = tw.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 10, uv.getY(i) * h / 20); app.addBox(bx, bz, w / 2 + 0.4, d / 2 + 0.4);
    const nc = neon[Math.floor(R() * neon.length)]; const rim = new T.Mesh(new T.BoxGeometry(w + 0.3, 0.35, d + 0.3), glow(nc, 1.8)); rim.position.set(bx, y + h + 0.1, bz); S.add(rim); if (R() < 0.4) { const ant = cyl(0.12, 0.12, 8, M(0x9aa3ad, { metalness: 0.8 }), bx, y + h + 4, bz, S, 6); const bl = sph(0.35, glow(0xff4f79, 2.5), bx, y + h + 8.2, bz, S, 8); app.onUpdate((dt, t) => { bl.visible = Math.sin(t * 3 + bx) > 0; }); }
  }
  // Collab Tower (the city's heart) — Working mode lounge
  const cx = 0, cz = -250; const tw = new T.Group(); tw.position.set(cx, terrainY(cx, cz), cz); S.add(tw); const glM = new T.MeshPhysicalMaterial({ color: 0x9fd0ff, metalness: 0.4, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 2 });
  for (let i = 0; i < 6; i++) { const f = new T.Mesh(new T.CylinderGeometry(10 - i * 1.2, 10.5 - i * 1.2, 14, 8), glM); f.position.y = 7 + i * 14; f.rotation.y = i * 0.2; tw.add(f); const band = new T.Mesh(new T.TorusGeometry(10.4 - i * 1.2, 0.2, 6, 8), glow(NEON, 1.6)); band.rotation.x = Math.PI / 2; band.position.y = 14 + i * 14; band.rotation.z = i * 0.2; tw.add(band); }
  const spire = cyl(0.2, 1.2, 24, M(0xe9edf2, { metalness: 0.9, roughness: 0.2 }), 0, 96, 0, tw, 10); const beacon = sph(1, glow(0xffd23f, 3), 0, 108, 0, tw, 12); app.addObstacle(cx, cz, 11);
  const ct = textPlane(['🧑‍💻 COLLAB TOWER', 'Working mode lounge · start a collab room'], 12, 2.6, { bg: 'rgba(5,11,28,.92)', fg: '#fff', accent: '#38b6ff', font: 'bold 76px Poppins, Arial' }); ct.position.set(0, 5, 11.2); tw.add(ct);
  app.addInteractable(cx, cz + 14, 6, '🧑‍💻 Open collab rooms', () => W.api.openCollab()); app.addHotspot(tw, { fn: () => W.api.openCollab() });
  // hologram billboards
  const holos = [['WAVE · CONNECT · BUILD', '#38f0ff'], ['YOUR FEED. YOUR RULES.', '#ff4f79'], ['I HAVE ↔ I NEED', '#ffd23f'], ['ALL OF US · ONE', '#7cff6b']];
  holos.forEach(([txt, col], i) => { const hx = (i % 2 ? 1 : -1) * 34, hz = -205 - i * 28; const p = textPlane([txt], 18, 3.4, { bg: 'rgba(0,0,0,0)', fg: col, accent: col, font: 'bold 120px Poppins, Arial', border: null, glow: true, double: true }); p.material.blending = T.AdditiveBlending; p.material.depthWrite = false; p.position.set(hx, terrainY(hx, hz) + 22 + i * 4, hz); p.rotation.y = i % 2 ? -Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3; S.add(p); app.onUpdate((dt, t) => { p.material.opacity = 0.75 + Math.sin(t * 4 + i) * 0.2; }); });
  // drones zipping between towers
  const dr = []; for (let i = 0; i < 10; i++) { const d = new T.Group(); box(0.8, 0.2, 0.8, M(0x222831, { metalness: 0.7 }), 0, 0, 0, d); sph(0.15, glow([NEON, PINK, GOLD][i % 3], 3), 0, -0.15, 0, d, 6); S.add(d); dr.push([d, i]); }
  app.onUpdate((dt, t) => { for (const [d, i] of dr) { const a = t * (0.15 + i * 0.02) + i; d.position.set(Math.cos(a) * (40 + i * 7), 30 + i * 4 + Math.sin(t + i) * 2, -250 + Math.sin(a) * (50 + i * 3)); } });
  // public watch-party theater (city) — a wall screen
  app.addScreen(-60, terrainY(-60, -178) + 8, -178, Math.PI / 4, 'fAJfDP3b5_U', { w: 14, h: 7.9, title: 'City Watch Party', accent: '#ff4f79', line2: 'Walk up & tap to watch together' });
}
function buildLibrary(W) {
  const { app } = W; const S = app.scene; const { x, z } = ZONES.library; const g = new T.Group(); g.position.set(x, terrainY(x, z), z); S.add(g);
  cyl(14, 15, 1, M(0xf4f1ea), 0, 0.5, 0, g, 40); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; cyl(0.55, 0.65, 10, M(0xffffff, { roughness: 0.4 }), Math.cos(a) * 12, 5.5, Math.sin(a) * 12, g, 14); }
  const dome = new T.Mesh(new T.SphereGeometry(13, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xbfe6ff, metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.35, envMapIntensity: 2, depthWrite: false })); dome.position.y = 10.5; g.add(dome); box(26, 0.5, 26, M(0xc9a24a, { metalness: 0.8 }), 0, 10.4, 0, g).scale.set(1, 1, 1);
  const bookCols = [0xff4f79, 0x38b6ff, 0xffd23f, 0x7cff6b, 0xb08cff, 0xff8a3d]; const books = []; for (let i = 0; i < 36; i++) { const b = box(0.9, 1.3, 0.25, M(bookCols[i % 6], { roughness: 0.6 }), 0, 0, 0, g); books.push([b, i]); }
  app.onUpdate((dt, t) => { for (const [b, i] of books) { const a = t * 0.25 + i / 36 * Math.PI * 2; const r = 6 + (i % 3) * 1.6; b.position.set(Math.cos(a) * r, 4 + (i % 4) * 1.4 + Math.sin(t + i) * 0.3, Math.sin(a) * r); b.rotation.y = -a; b.rotation.z = Math.sin(t + i) * 0.3; } });
  app.addObstacle(x, z, 3); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; app.addObstacle(x + Math.cos(a) * 12, z + Math.sin(a) * 12, 0.8); }
  const open = (a) => a.popup('📚 Library of Everything', '<p>Free, world-class learning. Pick a door:</p>', [{ label: '🎓 Khan Academy', href: 'https://www.khanacademy.org/', newTab: true, primary: true }, { label: '🏛️ MIT OpenCourseWare', href: 'https://ocw.mit.edu/', newTab: true }, { label: '📖 Wikipedia', href: 'https://www.wikipedia.org/', newTab: true }, { label: '🌐 Learn a language (Duolingo)', href: 'https://www.duolingo.com/', newTab: true }]);
  app.addHotspot(g, { fn: open }); app.addInteractable(x, z + 4, 6, '📚 Open the Library', open);
}
function buildFalls(W) {
  const { app } = W; const S = app.scene; const top = 44; const fx = CLIFF_X - 7, fz = POOL.z;
  // the falls: a scrolling-water curtain from the cliff top into the pool
  const fallMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { t: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ', fragmentShader: 'uniform float t; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} void main(){ vec2 p=vec2(vUv.x*14.0, vUv.y*6.0+t*3.2); float s=n(p)*0.6+n(p*2.3+3.0)*0.4; float edge=smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x); vec3 c=mix(vec3(0.55,0.8,0.95),vec3(1.0),smoothstep(0.45,0.85,s)); gl_FragColor=vec4(c,(0.55+0.4*s)*edge); }' });
  const fg0 = new T.Group(); fg0.position.set(-278.5, 22.5, fz); fg0.rotation.z = 0.41; S.add(fg0); const fall = new T.Mesh(new T.PlaneGeometry(13, 49, 1, 1), fallMat); fall.rotation.y = Math.PI / 2; fall.userData.noCollide = true; fall.userData.noOcclude = true; fg0.add(fall);
  const crest = new T.Mesh(new T.BoxGeometry(2, 0.6, 13), new T.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0x7fc8ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 })); crest.position.set(-288.5, top + 0.4, fz); S.add(crest);
  const pool = new T.Mesh(new T.CircleGeometry(POOL.r + 1, 48), waterMaterial(0x3fc6c8, 0x0b6f80)); pool.rotation.x = -Math.PI / 2; pool.position.set(POOL.x, 0.2, POOL.z); pool.userData.noCollide = true; S.add(pool);
  const mist = []; const mt = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'); const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  for (let i = 0; i < 26; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: mt, transparent: true, opacity: 0.5, depthWrite: false })); s.userData.i = i; S.add(s); mist.push(s); }
  app.onUpdate((dt, t) => { fallMat.uniforms.t.value = t; for (const s of mist) { const i = s.userData.i, k = (t * 0.35 + i / 26) % 1; s.position.set(-268 + Math.sin(i * 7.1) * 4 * k, 0.6 + k * 7, fz + Math.cos(i * 3.3) * 6 * k); const sc = 2 + k * 5; s.scale.set(sc, sc, 1); s.material.opacity = 0.45 * (1 - k); } });
  // dress the cliff face with big rocks
  const rg = new T.IcosahedronGeometry(1, 1); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.8 + 0.4 * Math.abs(Math.sin(p.getX(i) * 4 + p.getY(i) * 3)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } rg.computeVertexNormals(); }
  const R = seeded(7); const list = []; for (let zz = -220; zz < 180; zz += 7) { if (Math.abs(zz - fz) < 9) continue; const xx = CLIFF_X - 4 - R() * 8; list.push({ x: xx, y: terrainY(xx, zz) - 2, z: zz, ry: R() * 6, s: 3 + R() * 4 }); }
  stamp({ parts: [{ geo: rg, mat: M(0x8b8378, { flatShading: true, roughness: 1 }) }] }, list, S);
  // viewpoint deck + ATV trail
  W.sign(['🌿 THE WATERFALL', 'Swim the pool · Wellness path ends here'], ZONES.falls.x + 24, ZONES.falls.z + 12, -Math.PI / 2, { width: 6, height: 2.4, accent: '#22a35a' });
  W.atvSpot = W.atvSpot || []; W.atvSpot.push([-206, 46, 0.4]);
}
function buildDesert(W) {
  const { app } = W; const S = app.scene; const R = seeded(99);
  const strata = [0xc9824e, 0xe0a868, 0xb5653a, 0xd99a5e, 0xa8562e];
  for (const [mx, mz, r, h] of [[330, -150, 26, 34], [360, 30, 18, 24], [250, -250, 22, 30], [395, -80, 14, 40]]) { const g = new T.Group(); g.position.set(mx, terrainY(mx, mz) - 1, mz); S.add(g); let y = 0; for (let k = 0; y < h; k++) { const hh = 3 + R() * 4; const rr = r * (1 - y / h * 0.25); const m = new T.Mesh(new T.CylinderGeometry(rr * 0.97, rr, hh, 9), M(strata[k % strata.length], { flatShading: true, roughness: 1 })); m.position.y = y + hh / 2; m.rotation.y = R(); m.castShadow = true; g.add(m); y += hh; } app.addObstacle(mx, mz, r + 1); }
  // the ruins: Temple of Many Hands
  const { x, z } = ZONES.desert; const g = new T.Group(); g.position.set(x, terrainY(x, z), z); S.add(g); const st = M(0xd9c9a8, { roughness: 1, flatShading: true });
  box(30, 0.8, 22, st, 0, 0.4, 0, g); for (let i = 0; i < 12; i++) { const side = i < 6 ? -1 : 1; const px = -12.5 + (i % 6) * 5; const hh = 4 + (R() < 0.35 ? -R() * 3 : 3 + R() * 2); cyl(0.9, 1, hh, st, px, 0.8 + hh / 2, side * 9, g, 10); app.addObstacle(x + px, z + side * 9, 1.1); }
  for (const sx of [-8, 0, 8]) { const a = new T.Mesh(new T.TorusGeometry(2.6, 0.6, 6, 12, Math.PI), st); a.position.set(sx, 6.4, -9); g.add(a); }
  const altar = box(3, 1.4, 3, st, 0, 1.5, 0, g); const flame = sph(0.6, glow(0xff8a3d, 2.5), 0, 2.8, 0, g, 10); app.onUpdate((dt, t) => { flame.scale.setScalar(1 + Math.sin(t * 9) * 0.12); }); app.addObstacle(x, z, 2.2);
  app.addHotspot(g, { title: '🏜️ Temple of Many Hands', html: '<p>Twelve columns, one roof that is not there anymore. Legend says it was built by strangers who met on the Adventure path and decided to make something that would outlast them.</p>' });
  // tumbleweeds
  const tw = []; for (let i = 0; i < 5; i++) { const t0 = new T.Mesh(new T.IcosahedronGeometry(0.8, 1), new T.MeshStandardMaterial({ color: 0x9a7a52, wireframe: true })); S.add(t0); tw.push([t0, i]); }
  app.onUpdate((dt, t) => { for (const [m, i] of tw) { const k = (t * 0.02 + i * 0.21) % 1; const px = 210 + k * 200, pz = -120 + i * 30 + Math.sin(t * 0.5 + i) * 6; m.position.set(px, terrainY(px, pz) + 0.8 + Math.abs(Math.sin(t * 3 + i)) * 0.6, pz); m.rotation.z -= dt * 3; } });
  W.sign(['🏜️ THE DESERT', 'Adventure path · ruins · ATV trails'], x - 22, z + 18, -Math.PI / 2 - 0.4, { width: 6, height: 2.4, accent: '#e8671e' });
  W.atvSpot = W.atvSpot || []; W.atvSpot.push([x - 24, z + 26, -1.2]);
}
function buildStarport(W) {
  const { app, api } = W; const S = app.scene; const { x, z } = ZONES.starport; const g = new T.Group(); g.position.set(x, terrainY(x, z), z); S.add(g);
  cyl(18, 19, 0.6, M(0x3b3f46, { metalness: 0.5, roughness: 0.6 }), 0, 0.3, 0, g, 48); const ringM = glow(0xff4f79, 1.4); for (const r of [8, 14]) { const m = new T.Mesh(new T.RingGeometry(r - 0.3, r + 0.3, 64), ringM); m.rotation.x = -Math.PI / 2; m.position.y = 0.62; g.add(m); }
  const rk = new T.Group(); rk.position.set(6, 0.6, 6); g.add(rk); const body = M(0xf4f6f8, { metalness: 0.6, roughness: 0.3 }); cyl(2, 2, 22, body, 0, 12, 0, rk, 24); const nose = new T.Mesh(new T.ConeGeometry(2, 6, 24), M(0xff4f79, { metalness: 0.4 })); nose.position.y = 26; rk.add(nose); for (let i = 0; i < 4; i++) { const f = box(0.25, 6, 3.4, M(0xff4f79), 0, 3.5, 0, null); const arm = new T.Group(); arm.rotation.y = i * Math.PI / 2; f.position.set(0, 3.5, 2.6); arm.add(f); rk.add(arm); } const win = sph(0.9, glow(0x9fd0ff, 1), 0, 18, 1.85, rk, 14); win.scale.z = 0.3; const tx = textPlane(['ALL OF US'], 3.6, 9, { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', accent: '#ff4f79', font: 'bold 150px Poppins, Arial', border: null, glow: false }); tx.position.set(0, 12, 2.05); rk.add(tx); app.addObstacle(x + 6, z + 6, 3.6);
  const steam = []; const stt = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'); const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })(); for (let i = 0; i < 16; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: stt, transparent: true, opacity: 0.4, depthWrite: false })); s.userData.i = i; g.add(s); steam.push(s); }
  app.onUpdate((dt, t) => { for (const s of steam) { const i = s.userData.i, k = (t * 0.25 + i / 16) % 1; s.position.set(6 + Math.cos(i * 2.4) * (2 + k * 6), 0.8 + k * 3, 6 + Math.sin(i * 2.4) * (2 + k * 6)); const sc = 1.5 + k * 4; s.scale.set(sc, sc, 1); s.material.opacity = 0.4 * (1 - k); } });
  W.sign(['🚀 STARPORT', 'Causes path · the ring beams you to Orbit Garden'], x - 20, z - 20, Math.PI * 0.75, { width: 6, height: 2.4, accent: '#e11d48' });
  // the beam-up ring → Orbit Garden
  app.addPortal(x - 8, z - 8, new T.Vector3(ORBIT.x, 0.2, ORBIT.z + 30), { label: '🪐 Orbit Garden', color: 0xff4f79, yaw: Math.PI });
  // ORBIT GARDEN (space platform, teleport only)
  const O = new T.Group(); O.position.set(ORBIT.x, 0, ORBIT.z); S.add(O); O.visible = false; W.orbit = O;
  cyl(62, 60, 1.2, M(0xe9edf2, { metalness: 0.7, roughness: 0.25 }), 0, -0.6, 0, O, 64); const edge = new T.Mesh(new T.TorusGeometry(62, 0.6, 8, 96), glow(0x38f0ff, 2)); edge.rotation.x = Math.PI / 2; O.add(edge); const rail = new T.Mesh(new T.TorusGeometry(60.5, 0.15, 6, 96), glow(0xffffff, 1)); rail.rotation.x = Math.PI / 2; rail.position.y = 1.1; O.add(rail);
  const gd = new T.Mesh(new T.SphereGeometry(20, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.18, roughness: 0.04, metalness: 0.1, depthWrite: false })); O.add(gd); cyl(19, 19, 0.3, M(0x4d8a2e), 0, 0.15, 0, O, 48);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const tr = new T.Group(); tr.position.set(Math.cos(a) * 12, 0, Math.sin(a) * 12); cyl(0.3, 0.4, 3, M(0x6b4a2a), 0, 1.5, 0, tr, 8); sph(2, M([0x3f8a3a, 0x66bb6a, 0x2e7d32][i % 3]), 0, 4, 0, tr, 10); O.add(tr); }
  const earth = makeEarth(420, { clouds: true }); earth.position.set(0, -520, -260); O.add(earth); app.onUpdate((dt) => { if (O.visible) earth.rotation.y += dt * 0.01; });
  const starsG = new T.BufferGeometry(); const sp = new Float32Array(3000 * 3); for (let i = 0; i < 3000; i++) { const v = new T.Vector3().randomDirection().multiplyScalar(1600); if (v.y < -200) v.y = -v.y; sp.set([v.x, v.y, v.z], i * 3); } starsG.setAttribute('position', new T.BufferAttribute(sp, 3)); const stars = new T.Points(starsG, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })); O.add(stars);
  const plaque = textPlane(['THE OVERVIEW EFFECT', 'Astronauts who see Earth from space say the borders disappear.', 'One planet. All of us.'], 14, 3.4, { bg: 'rgba(5,11,28,.9)', fg: '#fff', accent: '#38f0ff', font: 'bold 56px Poppins, Arial' }); plaque.position.set(0, 3.2, -40); O.add(plaque);
  W.orbitKeep = { poly: Array.from({ length: 40 }, (_, i) => [ORBIT.x + Math.cos(i / 40 * Math.PI * 2) * 58, ORBIT.z + Math.sin(i / 40 * Math.PI * 2) * 58]), keepIn: true, level: 7 }; app.obstacles.push(W.orbitKeep);
  app.addPortal(ORBIT.x, ORBIT.z + 44, new T.Vector3(x - 14, groundY(x - 14, z - 14) , z - 14), { label: '🌍 Back to Earth', color: 0x38f0ff, yaw: Math.PI * 0.75 });
  app.addPlace({ id: 'orbit', name: '🪐 Orbit Garden', icon: '🪐', x: ORBIT.x, z: ORBIT.z + 30, cat: 'Places', keys: 'space orbit garden earth stars overview', walk: false, say: 'Orbit Garden. Look down. That is everyone.' });
  // space mode switch
  let was = false; const prevSky = { url: null };
  app.onUpdate(() => { const P = app.player.position; const inSpace = Math.abs(P.x - ORBIT.x) < 700 && Math.abs(P.z - ORBIT.z) < 700; if (inSpace === was) return; was = inSpace; STATE.space = inSpace; O.visible = inSpace; W.ground.mesh.visible = !inSpace; app.level = inSpace ? 7 : 0; if (inSpace) { prevSky.url = app.skyUrl; app.setSky(SKIES.night, { night: true }); app.scene.fog.near = 400; app.scene.fog.far = 3000; app.toast('🪐 Orbit Garden. Look down. That is all of us.', 4000); } else { app.setSky(prevSky.url || SKIES.day); app.scene.fog.near = app.opts.fogNear; app.scene.fog.far = app.opts.fogFar; } });
}
function buildArtGarden(W) {
  const { app, api } = W; const S = app.scene; const { x, z } = ZONES.art;
  // Unity Knot — an iridescent torus knot
  const knotMat = new T.ShaderMaterial({ uniforms: { t: { value: 0 } }, vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ', fragmentShader: 'uniform float t; varying vec3 vN; varying vec3 vP; void main(){ float f=pow(1.0-abs(vN.z),1.5); vec3 c=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+dot(vP,vec3(0.15))+t*0.15)); gl_FragColor=vec4(mix(c*0.7,vec3(1.0),f*0.6),1.0);} ' });
  const knot = new T.Mesh(new T.TorusKnotGeometry(4, 1.1, 160, 20, 2, 3), knotMat); knot.position.set(x, terrainY(x, z) + 8, z); knot.castShadow = true; S.add(knot); cyl(2.4, 3, 2, M(0xf4f1ea), x, terrainY(x, z) + 1, z, S, 24); app.addObstacle(x, z, 3.2);
  app.onUpdate((dt, t) => { knotMat.uniforms.t.value = t; knot.rotation.y += dt * 0.25; knot.rotation.x = Math.sin(t * 0.3) * 0.3; });
  app.addHotspot(knot, { title: '🎨 Unity Knot', html: '<p>One continuous line that loops through itself again and again and never breaks. Painted in code, every color at once.</p>' });
  // Many Hands: 12 pillars that light up as you pass
  const ph = []; const cols = [0xff4f79, 0xff8a3d, 0xffd23f, 0x7cff6b, 0x2fe0c0, 0x38b6ff, 0xb08cff]; const mx = x + 26, mz = z - 6; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const px = mx + Math.cos(a) * 9, pz = mz + Math.sin(a) * 9; const m = new T.MeshStandardMaterial({ color: cols[i % 7], emissive: cols[i % 7], emissiveIntensity: 0.1, roughness: 0.3 }); const p = cyl(0.6, 0.6, 6, m, px, terrainY(px, pz) + 3, pz, S, 12); app.addObstacle(px, pz, 0.8); ph.push([m, px, pz]); }
  app.onUpdate((dt) => { const P = app.player.position; for (const [m, px, pz] of ph) { const d = Math.hypot(P.x - px, P.z - pz); m.emissiveIntensity += ((d < 7 ? 2.2 : 0.1) - m.emissiveIntensity) * Math.min(1, dt * 3); } });
  W.sign(['🖐️ MANY HANDS', 'Walk the circle. Every color is someone.'], mx, mz + 13, Math.PI, { width: 5.2, height: 2.2, accent: '#7c3aed' });
  // Particle Tree
  const N = mob() ? 1800 : 4200; const pg = new T.BufferGeometry(); const pp = new Float32Array(N * 3), pc = new Float32Array(N * 3); const R = seeded(3); const tc = new T.Color(); for (let i = 0; i < N; i++) { const trunk = i < N * 0.2; let px, py, pz; if (trunk) { py = R() * 7; const r = 0.6 * (1 - py / 9); const a = R() * 6.28; px = Math.cos(a) * r; pz = Math.sin(a) * r; tc.setHSL(0.08, 0.6, 0.35 + R() * 0.2); } else { const v = new T.Vector3().randomDirection().multiplyScalar(Math.cbrt(R()) * 5.5); px = v.x; py = 10 + v.y * 0.8; pz = v.z; tc.setHSL(R() < 0.5 ? 0.9 : 0.55 + R() * 0.25, 0.85, 0.6); } pp.set([px, py, pz], i * 3); pc.set([tc.r, tc.g, tc.b], i * 3); }
  pg.setAttribute('position', new T.BufferAttribute(pp, 3)); pg.setAttribute('color', new T.BufferAttribute(pc, 3)); const ptree = new T.Points(pg, new T.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending })); const tx = x - 22, tz = z + 10; ptree.position.set(tx, terrainY(tx, tz), tz); S.add(ptree); app.addObstacle(tx, tz, 1.2); app.onUpdate((dt) => { ptree.rotation.y += dt * 0.12; });
  // Mirror sphere
  const ms = sph(3.2, new T.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.04, envMapIntensity: 1.6 }), x + 4, terrainY(x + 4, z + 26) + 3.4, z + 26, S, 48); app.addObstacle(x + 4, z + 26, 3.4); app.addHotspot(ms, { title: '🔮 The Mirror', html: '<p>Everyone who walks by is in it. That is the whole sculpture.</p>' });
  // Zach's paintings on a curved outdoor wall
  for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const px = x - 4 + Math.sin(a) * 30, pz = z - 26 - Math.cos(a) * 6; const fg = new T.Group(); fg.position.set(px, terrainY(px, pz) + 3.4, pz); fg.rotation.y = -a * 0.6; S.add(fg); box(4.4, 3.4, 0.25, M(0xc9a24a, { metalness: 0.7, roughness: 0.3 }), 0, 0, 0, fg); const it = ART[(i * 3) % ART.length]; const m = new T.MeshBasicMaterial({ color: 0xffffff }); setTimeout(() => { m.map = paintArt(it[1], 40 + i, it[2]); m.needsUpdate = true; }, 1200 + i * 200); const cv = plane(4, 3, m, fg); cv.position.z = 0.14; box(0.2, 3.4, 0.2, M(0x2a1a10), 0, -3.4, -0.1, fg); app.addHotspot(fg, { title: '“' + it[0] + '”', html: '<p>After the original canvas by <b>Zachary Tye Wennstedt</b>.</p>', actions: [{ label: '🎨 See the real paintings & prints', href: 'https://fineartamerica.com/profiles/zach-wennstedt', newTab: true, primary: true }] }); app.addObstacle(px, pz, 2); }
  // Wish lanterns
  const ww = new T.Group(); const wx = x + 20, wz = z + 22; ww.position.set(wx, terrainY(wx, wz), wz); S.add(ww); box(8, 3.4, 0.5, M(0x8a5f3a, { roughness: 0.9 }), 0, 1.7, 0, ww); const wt = textPlane(['🏮 WISH WALL', 'tap to send a wish into the sky'], 7.4, 2.2, { bg: '#fffaf0', fg: '#1a1a1a', accent: '#ff8a3d', font: 'bold 74px Poppins, Arial' }); wt.position.set(0, 1.9, 0.27); ww.add(wt); ww.rotation.y = -Math.PI * 0.8; app.addBox(wx, wz, 4.2, 1.5);
  W.lanterns = []; W.sendLantern = (text, ox = wx, oz = wz) => { const l = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 0.8, 10, 1, true), new T.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a3d, emissiveIntensity: 1.6, transparent: true, opacity: 0.9, side: T.DoubleSide })); l.add(body); if (text) { const s = makeSprite('🏮 ' + text.slice(0, 40), { scale: 3.4, accent: '#ff8a3d' }); s.position.y = 1.4; l.add(s); } l.position.set(ox + (Math.random() - 0.5) * 3, terrainY(ox, oz) + 2, oz + (Math.random() - 0.5) * 3); S.add(l); W.lanterns.push({ l, t0: app.t, sx: Math.random() - 0.5 }); if (W.lanterns.length > 40) { const o = W.lanterns.shift(); S.remove(o.l); } };
  app.onUpdate((dt) => { for (const L of W.lanterns) { L.l.position.y += dt * 1.4; L.l.position.x += L.sx * dt * 0.6; } });
  const wish = () => api.makeWish(); app.addHotspot(ww, { fn: wish }); app.addInteractable(wx, wz, 5, '🏮 Make a wish', wish);
  W.sign(['🎨 THE ART GARDEN', 'Creativity path · sculptures · wish wall'], x + 30, z + 30, Math.PI * 0.75, { width: 6, height: 2.4, accent: '#7c3aed' });
}
const mob = () => isMobile();

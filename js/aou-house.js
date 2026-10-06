/* ============================================================
   allofus.one · homes
   · Zach's place: modern art-deco eco home, first lot past the
     gate. Living grass roof, hempcrete walls, rain-to-RO water,
     aquaponics garden + fish pond, geothermal, solar + wind,
     observatory, backyard lake + projector movie night.
   · Home styles anyone can claim on any empty lot.
   ============================================================ */
import { THREE, makeSprite, makeEarth, isMobile , realTex } from './aou-engine.js';
import { M, glow, basic, glass, box, cyl, sph, plane, textPlane, waterMaterial, paintArt, ART, FAA, GOLD, NEON, PINK, MINT, VIOLET, ORANGE } from './aou-kit.js';
import { terrainY } from './aou-terrain.js';
const T = THREE;

/* ---------- textures ---------- */
function hempTex(base = '#efe6d2') { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { g.strokeStyle = `rgba(${120 + Math.random() * 60 | 0},${100 + Math.random() * 50 | 0},${60 + Math.random() * 40 | 0},${0.12 + Math.random() * 0.2})`; g.lineWidth = 0.6 + Math.random(); const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * 6.28, l = 2 + Math.random() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(4, 2); t.colorSpace = T.SRGBColorSpace; return t; }
function grassRoofTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#4d8a2e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 6000; i++) { g.strokeStyle = `hsl(${88 + Math.random() * 30},${45 + Math.random() * 30}%,${24 + Math.random() * 26}%)`; const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 5); g.stroke(); } for (let i = 0; i < 120; i++) { g.fillStyle = ['#ffd23f', '#ffffff', '#ff7ab8', '#b08cff'][i % 4]; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1.4, 0, 6.28); g.fill(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(5, 3); t.colorSpace = T.SRGBColorSpace; return t; }
function solarTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 128, 192); gr.addColorStop(0, '#1b3f8f'); gr.addColorStop(1, '#0a1f52'); g.fillStyle = gr; g.fillRect(0, 0, 128, 192); g.strokeStyle = 'rgba(190,215,255,.55)'; g.lineWidth = 2; for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 192); g.stroke(); } for (let y = 0; y <= 192; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); } const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function woodTex(a = '#b98a5c', b = '#8a5f3a') { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); for (let y = 0; y < 256; y += 32) { g.fillStyle = (y / 32) % 2 ? a : b; g.fillRect(0, y, 256, 32); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, y, 256, 2); for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(60,35,15,.18)'; g.beginPath(); const yy = y + Math.random() * 32; g.moveTo(0, yy); g.bezierCurveTo(80, yy + 4, 170, yy - 4, 256, yy); g.stroke(); } } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; }
export { woodTex };

/* ---------- learn cards (eco features) ---------- */
export const LEARN = {
  roof: { title: '🌱 Living grass roof', html: '<p>A green roof is a real meadow on top of the house: soil, plants, flowers. It soaks up rain, keeps the house cooler in summer and warmer in winter, feeds bees, and can double a roof membrane\'s life.</p>', links: [['EPA: green roofs', 'https://www.epa.gov/heatislands/using-green-roofs-reduce-heat-islands']] },
  water: { title: '💧 Rain to drinking water', html: '<p>Gutters catch rain into a storage tank. A filter train (sediment → carbon → reverse osmosis → UV) turns it into water clean enough to drink and shower with. One inch of rain on a 2,000 sq ft roof is about 1,200 gallons.</p><p class="muted">Check your local rules before drinking harvested rain.</p>', links: [['EPA: Soak Up the Rain', 'https://www.epa.gov/soakuptherain']] },
  aqua: { title: '🐟 Aquaponics garden', html: '<p>Fish live in the pond. Their waste feeds bacteria that turn it into plant food. A pump sends that water through the garden beds, the plants clean it, and it flows back to the fish. Vegetables and fish, almost no fertilizer, a fraction of the water.</p>', links: [['USDA: aquaponics', 'https://www.nal.usda.gov/farms-and-agricultural-production-systems/aquaponics']] },
  hemp: { title: '🧱 Hempcrete walls', html: '<p>Hempcrete is hemp hurd mixed with lime. It is breathable, mold-resistant, fireproof-ish, insulates well, and keeps pulling carbon out of the air as it cures. No wood studs needed for the infill, no drywall dust.</p>', links: [['US Hemp Building Association', 'https://ushba.org/']] },
  geo: { title: '🌡️ Geothermal heat pump', html: '<p>A few feet down, the earth stays around 50–60°F all year. Loops of pipe carry fluid through the ground, and a heat pump moves that heat into the house in winter and out of it in summer. Typically 3–5 units of heat for every unit of electricity.</p>', links: [['energy.gov: geothermal heat pumps', 'https://www.energy.gov/energysaver/geothermal-heat-pumps']] },
  sun: { title: '☀️ Solar + wind', html: '<p>Solar panels on the roof and a small wind turbine in the yard share the work: sun by day, wind often at night and in winter. A home battery smooths it out so the lights stay on when the grid blinks.</p>', links: [['energy.gov: home solar', 'https://www.energy.gov/energysaver/homeowners-guide-going-solar'], ['energy.gov: small wind', 'https://www.energy.gov/eere/wind/distributed-wind'], ['NREL: renewable energy', 'https://www.nrel.gov/research/learning.html']] },
};
export function learn(app, key) { const L = LEARN[key]; app.popup(L.title, L.html + '<p style="margin-top:10px"><b>Learn more:</b></p>', L.links.map(([label, href], i) => ({ label: '🔗 ' + label, href, newTab: true, primary: i === 0 }))); }
function learnBadge(app, parent, key, x, y, z, label) { const s = makeSprite(label, { scale: 3.2, accent: '#7cff6b' }); s.position.set(x, y, z); parent.add(s); app.addHotspot(s, { fn: (a) => learn(a, key) }); return s; }

/* ---------- skins (home owners can swap) ---------- */
export const SKINS = {
  'Deco Cream': { wall: '#efe6d2', trim: 0xc9a24a, accent: 0x38f0ff, base: 0xd8d2c4 },
  'Midnight Gold': { wall: '#2a2d3a', trim: 0xffd23f, accent: 0xff4f79, base: 0x1c1e28 },
  'Desert Clay': { wall: '#d9a679', trim: 0x7a4a2a, accent: 0xffb347, base: 0xb98a5c },
  'Ocean Glass': { wall: '#dff3f7', trim: 0x2f86ff, accent: 0x38f0ff, base: 0xbfe3ea },
  'Forest Moss': { wall: '#cfd8c0', trim: 0x2f5a3a, accent: 0x7cff6b, base: 0x9fae8a },
};

/* ============================================================
   ZACH'S PLACE
   ============================================================ */
export function buildZachHouse(app, X, Z, api) {
  const y0 = terrainY(X, Z) + 0.05; const g = new T.Group(); g.position.set(X, y0, Z); app.scene.add(g); g.userData.noCollide = true;
  const W = 26, D = 16, H = 5.2, th = 0.5; const hw = W / 2, hd = D / 2;
  const wallMat = M(0xffffff, { map: hempTex(SKINS['Deco Cream'].wall), roughness: 0.92 }); const trim = M(0xc9a24a, { metalness: 0.75, roughness: 0.28 }); const dark = M(0x1d2433, { metalness: 0.4, roughness: 0.4 });
  const mats = { wall: wallMat, trim };
  // slab + floor
  box(W + 3, 0.5, D + 3, M(0xd8d2c4, { roughness: 0.5 }), 0, -0.1, 0, g).receiveShadow = true;
  const fl = box(W - 0.6, 0.06, D - 0.6, M(0xffffff, { map: (() => { const t = woodTex('#c79a6b', '#a77b52'); t.repeat.set(6, 4); return t; })(), roughness: 0.55 }), 0, 0.17, 0, g); fl.receiveShadow = true; fl.userData.noOcclude = true;
  const upper = new T.Group(); g.add(upper); // hidden when you step inside (cutaway)
  // walls: front (−x) and back (+x) have doorway gaps at z∈[−2.6, 2.6]
  const wall = (w, h, d, x, y, z, p = g) => { const m = box(w, h, d, wallMat, x, y, z, p); m.castShadow = true; m.receiveShadow = true; return m; };
  const gap = 2.7;
  for (const sx of [-1, 1]) { for (const sz of [-1, 1]) { const len = hd - gap; wall(th, H, len, sx * hw, H / 2 + 0.15, sz * (gap + len / 2)); app.addBox(X + sx * hw, Z + sz * (gap + len / 2), th / 2 + 0.25, len / 2 + 0.2); } wall(th, 1.2, gap * 2, sx * hw, H - 0.45, 0); }
  for (const sz of [-1, 1]) { wall(W, H, th, 0, H / 2 + 0.15, sz * hd); app.addBox(X, Z + sz * hd, hw + 0.2, th / 2 + 0.25); }
  // big windows (glass inserts on long walls)
  const gl = glass(); for (const sz of [-1, 1]) for (const wx of [-8, -2.5, 3, 8.5]) { const w = box(3.6, 3, 0.12, gl, wx, 2.7, sz * (hd + 0.02), g); w.userData.noOcclude = true; box(3.9, 0.14, 0.3, trim, wx, 1.15, sz * (hd + 0.05), g); }
  // art-deco front: gold-capped fins, stepped tower over the door, sunburst
  for (const fz of [-7.2, -5.2, 5.2, 7.2]) { const f = box(0.5, H + 1.4, 0.5, wallMat, -hw - 0.3, (H + 1.4) / 2, fz, upper); f.castShadow = true; box(0.6, 0.35, 0.6, trim, -hw - 0.3, H + 1.55, fz, upper); }
  for (let i = 0; i < 4; i++) { const w = 7.2 - i * 1.5; const b = box(1.2, 0.9, w, wallMat, -hw - 0.1, H + 0.45 + i * 0.9, 0, upper); b.castShadow = true; box(1.25, 0.12, w + 0.05, trim, -hw - 0.1, H + 0.9 + i * 0.9, 0, upper); }
  const sun = new T.Group(); sun.position.set(-hw - 0.75, H + 1.6, 0); sun.rotation.y = -Math.PI / 2; upper.add(sun); for (let i = 0; i < 9; i++) { const a = Math.PI * (i / 8); const r = box(0.12, 1.6, 0.04, trim, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0, sun); r.rotation.z = a - Math.PI / 2; }
  // curved deco corner (south-west)
  const cc = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, H + 0.6, 24, 1, false, Math.PI, Math.PI / 2), wallMat); cc.position.set(-hw + 0.2, (H + 0.6) / 2, hd - 0.2); g.add(cc); for (let k = 0; k < 3; k++) { const band = new T.Mesh(new T.TorusGeometry(1.62, 0.05, 6, 24, Math.PI / 2), trim); band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI; band.position.set(-hw + 0.2, 1.4 + k * 1.4, hd - 0.2); g.add(band); }
  // sliding glass doors (front + back), open as you walk up
  const doors = []; for (const sx of [-1, 1]) { const pair = []; for (const sz of [-1, 1]) { const p = box(0.1, 3.4, gap, glass(), sx * hw, 1.85, sz * gap / 2, g); p.userData.noOcclude = true; const fr = box(0.16, 3.5, 0.12, trim, sx * hw, 1.85, sz * gap / 2 + sz * (gap / 2 - 0.06), g); pair.push([p, fr, sz]); } doors.push({ sx, pair, k: 0 }); box(0.6, 0.18, gap * 2 + 0.6, trim, sx * (hw + 0.05), 3.65, 0, g); }
  // roof: living grass roof + solar on the south half + gutters
  const roof = box(W + 1.6, 0.45, D + 1.6, M(0x6b6155, { roughness: 0.8 }), 0, H + 0.38, 0, upper); roof.castShadow = true;
  const sod = box(W + 1.2, 0.25, D * 0.55, M(0xffffff, { map: grassRoofTex(), roughness: 1 }), 0, H + 0.72, -D * 0.2, upper); sod.receiveShadow = true;
  const bush = M(0x3f7d2b, { roughness: 0.9 }), bloom = [M(0xffd23f), M(0xff7ab8), M(0xffffff)]; for (let i = 0; i < 26; i++) { const bx = -hw + 1 + Math.random() * (W - 2), bz = -hd + 0.6 + Math.random() * (D * 0.5); sph(0.35 + Math.random() * 0.4, bush, bx, H + 0.9, bz, upper, 8); if (i % 2) sph(0.12, bloom[i % 3], bx + 0.2, H + 1.25, bz, upper, 6); }
  const st = solarTex(); const pm = M(0xffffff, { map: st, metalness: 0.6, roughness: 0.22, envMapIntensity: 1.5 }); for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { const p = box(2.8, 0.08, 1.8, pm, -9 + c * 3.4, H + 1.15 + r * 0.05, 2.4 + r * 2.4, upper); p.rotation.x = -0.32; cyl(0.05, 0.05, 0.8, dark, -9 + c * 3.4, H + 0.85, 2.4 + r * 2.4 + 0.5, upper, 6); }
  for (const sz of [-1, 1]) box(W + 1.8, 0.18, 0.25, M(0x9aa3ad, { metalness: 0.7, roughness: 0.3 }), 0, H + 0.6, sz * (hd + 0.85), upper);
  cyl(0.12, 0.12, H + 0.5, M(0x9aa3ad, { metalness: 0.7 }), hw + 0.85, (H + 0.5) / 2, -hd - 0.85, g, 8);
  // observatory dome (north-east roof corner) with a telescope peeking out
  const obs = new T.Group(); obs.position.set(hw - 3.4, H + 0.6, -hd + 3.4); upper.add(obs); cyl(2.4, 2.5, 1.4, wallMat, 0, 0.7, 0, obs, 28); box(0.2, 0.2, 0.2, trim, 0, 1.45, 0, obs);
  const dome = new T.Group(); dome.position.y = 1.4; obs.add(dome); const dm = M(0xe9edf2, { metalness: 0.85, roughness: 0.22 }); const dg = new T.Mesh(new T.SphereGeometry(2.45, 28, 14, 0.35, Math.PI * 2 - 0.7, 0, Math.PI / 2), dm); dome.add(dg); dg.castShadow = true;
  const tele = cyl(0.22, 0.32, 3, M(0x222831, { metalness: 0.6 }), 0, 1.3, 0, dome, 14); tele.rotation.z = -0.9; tele.position.x = 0.9; const lens = sph(0.24, glow(0x9fd0ff, 1), 2.05, 2.15, 0, dome, 10);
  app.onUpdate((dt) => { dome.rotation.y += dt * 0.06; });
  // "I'M HOME" neon + door lantern
  const home = textPlane(["I'M HOME"], 4.6, 1.1, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', accent: '#ff4f79', font: 'bold 150px Poppins, Segoe UI, Arial', border: null, glow: true }); home.rotation.y = -Math.PI / 2; home.position.set(-hw - 0.9, H + 4.4, 0); upper.add(home); const homeGlow = new T.PointLight(0xff4f79, 0, 14); homeGlow.position.set(-hw - 2, H + 3.5, 0); g.add(homeGlow);
  // equalizer + NOW PLAYING on the front wall (left of the door)
  const eq = new T.Group(); eq.position.set(-hw - 0.32, 1.2, -4.6); eq.rotation.y = -Math.PI / 2; g.add(eq); box(3.4, 2.5, 0.12, dark, 0, 0.9, -0.02, eq); const bars = []; const barCols = [0x38f0ff, 0x7cff6b, 0xffd23f, 0xff8a3d, 0xff4f79, 0xb08cff]; for (let i = 0; i < 12; i++) { const b = box(0.2, 1, 0.08, glow(barCols[i % 6], 1.6), -1.45 + i * 0.265, 0.1, 0.06, eq); b.geometry.translate(0, 0.5, 0); bars.push(b); }
  const np = textPlane(['NOW PLAYING', 'tap to listen'], 3.4, 0.7, { bg: 'rgba(5,11,28,0.92)', fg: '#ffffff', accent: '#ffd23f', font: 'bold 70px Poppins, Arial' }); np.position.set(0, 2.45, 0.08); eq.add(np);
  const music = { on: false }; app.onUpdate((dt, t) => { const k = music.on ? 1 : 0.18; for (let i = 0; i < bars.length; i++) { const v = 0.15 + k * (0.55 + 0.45 * Math.sin(t * (5 + i * 0.7) + i * 1.7) * Math.sin(t * 2.3 + i)); bars[i].scale.y = Math.max(0.08, Math.abs(v) * 1.6); } });
  const playSong = () => api.nowPlaying('fAJfDP3b5_U', 'Now playing at Zach\'s', music);
  app.addHotspot(eq, { fn: playSong }); app.addInteractable(X - hw - 3, Z - 4.6, 4, '🎵 Now Playing at Zach\'s', playSong);
  // learn badges
  learnBadge(app, g, 'roof', -4, H + 3.2, -3, '🌱 Living roof');
  learnBadge(app, g, 'sun', 2, H + 3.4, 4, '☀️ Solar + wind');
  learnBadge(app, g, 'hemp', -hw - 1.5, 3.4, 6.5, '🧱 Hempcrete');
  // inside: art, kitchen, couch, globe table, LIFEboard screen, portal to Zach's site
  const art = [ART[0], ART[1], ART[3], ART[13], ART[17], ART[10]];
  const hang = (item, i, x, z, ry) => { const fg = new T.Group(); fg.position.set(x, 2.8, z); fg.rotation.y = ry; g.add(fg); box(2.9, 2.2, 0.08, M([0x2a1a10, 0xc9a24a, 0x111111][i % 3], { metalness: i % 3 === 1 ? 0.7 : 0.1 }), 0, 0, 0, fg); const m = new T.MeshBasicMaterial({ color: 0xffffff }); setTimeout(() => { m.map = paintArt(item[1], i + 3, item[2]); m.needsUpdate = true; }, 400 + i * 180); const cv = plane(2.6, 1.9, m, fg); cv.position.z = 0.05; app.addHotspot(fg, { title: '“' + item[0] + '”', html: '<p>After the original canvas by <b>Zachary Tye Wennstedt</b>. What hangs here is a digital study; the real paint has texture you can feel.</p>', actions: [{ label: '🎨 See the real paintings & prints', href: FAA, newTab: true, primary: true }] }); };
  hang(art[0], 0, -6, -hd + 0.35, 0); hang(art[1], 1, -1, -hd + 0.35, 0); hang(art[2], 2, 4, -hd + 0.35, 0); hang(art[3], 3, -6, hd - 0.35, Math.PI); hang(art[4], 4, -1, hd - 0.35, Math.PI); hang(art[5], 5, 9.5, hd - 0.35, Math.PI);
  // kitchen island + smart fridge
  box(4.5, 1, 1.4, M(0xf4f1ea, { roughness: 0.35 }), 7, 0.65, -3.5, g); box(4.7, 0.1, 1.6, M(0x222831, { metalness: 0.3, roughness: 0.15 }), 7, 1.2, -3.5, g); app.addBox(X + 7, Z - 3.5, 2.4, 0.8);
  const fr = box(1.4, 2.6, 1, M(0xdfe5ec, { metalness: 0.8, roughness: 0.2 }), 11.8, 1.45, -6.6, g); const frs = plane(0.7, 0.9, glow(0x38f0ff, 0.8), g); frs.position.set(11.8, 1.8, -6.08); app.addHotspot(fr, { title: '🧊 Smart fridge', html: '<p>It tracks what is inside, suggests meals from what is about to expire, and orders staples from the garden first, the store second. It also runs on sunshine.</p>' });
  // couch (yes, the one from Global Match)
  const couch = new T.Group(); couch.position.set(-3, 0.2, 4.5); g.add(couch); const cm = M(0x2f6bff, { roughness: 0.85 }); box(5, 0.7, 1.8, cm, 0, 0.35, 0, couch); box(5, 1.1, 0.4, cm, 0, 0.9, 0.7, couch); box(0.4, 0.9, 1.8, cm, -2.5, 0.6, 0, couch); box(0.4, 0.9, 1.8, cm, 2.5, 0.6, 0, couch); couch.rotation.y = Math.PI; app.addBox(X - 3, Z + 4.5, 2.7, 1);
  app.addHotspot(couch, { title: '🛋️ The match couch', html: '<p>Someone had a couch. Someone needed a couch. <b>WE HAVE A MATCH.</b> That is Global Match: I Have ↔ I Need, for items and services.</p>', actions: [{ label: '🤝 Open Global Match', fn: () => api.openMatch(), primary: true }] });
  // hologram globe table
  cyl(1.2, 1.2, 0.12, M(0x111827, { metalness: 0.6 }), -3, 0.8, -1.2, g); cyl(0.15, 0.3, 0.7, M(0x111827), -3, 0.4, -1.2, g); app.addObstacle(X - 3, Z - 1.2, 1.3); const holo = makeEarth(0.7, { clouds: false }); holo.position.set(-3, 1.9, -1.2); g.add(holo); const holoBeam = new T.Mesh(new T.CylinderGeometry(0.75, 1.1, 1.1, 20, 1, true), new T.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false })); holoBeam.position.set(-3, 1.4, -1.2); g.add(holoBeam); app.onUpdate((dt) => { holo.rotation.y += dt * 0.4; });
  // LIFEboard wall screen (inside, back wall)
  const lb = new T.Group(); lb.position.set(hw - 0.35, 2.7, -5); lb.rotation.y = -Math.PI / 2; g.add(lb); box(4.6, 2.7, 0.1, dark, 0, 0, 0, lb); const lbs = textPlane(['🏠 LIFEboard', 'goals · vision · wellness · connections'], 4.3, 2.4, { bg: '#071233', fg: '#ffffff', accent: '#7cff6b', font: 'bold 92px Poppins, Arial' }); lbs.position.z = 0.06; lb.add(lbs); app.addHotspot(lb, { fn: () => api.openLifeboard('goals') }); app.addInteractable(X + hw - 2.5, Z - 5, 3.2, '🏠 Open my LIFEboard', () => api.openLifeboard('goals'));
  // portal frame → Zach's personal site
  const pf = new T.Group(); pf.position.set(hw - 0.35, 0.2, 5.5); pf.rotation.y = -Math.PI / 2; g.add(pf); const ring = new T.Mesh(new T.TorusGeometry(1.25, 0.12, 10, 36), glow(0xffd23f, 1.8)); ring.position.y = 1.9; ring.scale.y = 1.35; pf.add(ring); const disc = new T.Mesh(new T.CircleGeometry(1.2, 32), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25 })); disc.position.y = 1.9; disc.scale.y = 1.35; pf.add(disc); const pl = textPlane(['zacharytyewennstedt.com'], 2.8, 0.45, { bg: 'rgba(5,11,28,.85)', fg: '#fff', accent: '#ffd23f', font: 'bold 64px Poppins, Arial' }); pl.position.set(0, 3.9, 0.02); pf.add(pl); app.onUpdate((dt, t) => { disc.material.opacity = 0.18 + Math.sin(t * 3) * 0.08; });
  app.addHotspot(pf, { title: '🚪 Zach\'s door', html: '<p>Founder of allofus.one. Painter, poet, builder of websites and of big ideas. Step through to meet him.</p>', actions: [{ label: '✨ Visit zacharytyewennstedt.com', href: 'https://zacharytyewennstedt.com/', newTab: true, primary: true }] });
  // plants
  for (const [px, pz] of [[-11.6, -6.6], [-11.6, 6.6], [11.6, 6.6]]) { cyl(0.45, 0.35, 0.8, M(0xc9a24a, { metalness: 0.5 }), px, 0.6, pz, g, 12); sph(0.8, M(0x3f8a3a), px, 1.6, pz, g, 10); }
  // sconces + interior light
  const inLight = new T.PointLight(0xffe6c4, 0, 22, 1.6); inLight.position.set(0, 4.4, 0); g.add(inLight);

  /* ---------- outside: mailbox, garden + aquaponics pond, RO tank, geothermal, wind, lake, projector ---------- */
  const W2 = (lx, lz) => [X + lx, Z + lz];
  // mailbox at the road
  const mb = new T.Group(); const [mx, mz] = W2(-hw - 7.5, 9); mb.position.set(mx, terrainY(mx, mz), mz); app.scene.add(mb); cyl(0.08, 0.08, 1.2, M(0x2a1a10), 0, 0.6, 0, mb, 8); const mbody = box(0.55, 0.5, 1, M(0x2f6bff, { metalness: 0.5, roughness: 0.3 }), 0, 1.3, 0, mb); const flag = box(0.04, 0.4, 0.14, M(0xff4f79), 0.32, 1.5, 0.3, mb); const lbl = textPlane(['ZACH'], 0.9, 0.3, { bg: '#ffffff', fg: '#111', accent: '#c9a24a', font: 'bold 90px Georgia' }); lbl.position.set(-0.29, 1.3, 0); lbl.rotation.y = -Math.PI / 2; mb.add(lbl);
  const openMail = () => api.mailbox(); app.addHotspot(mb, { fn: openMail }); globalThis.AOU_MAILBOX = { g: mb, x: mx, z: mz, open: openMail }; app.addInteractable(mx, mz, 3.5, '📬 Zach\'s mailbox: say hi', openMail); app.onUpdate((dt, t) => { flag.rotation.z = Math.sin(t * 2) * 0.15; });
  // garden beds + aquaponics fish pond (south side)
  const pondX = -4, pondZ = hd + 9; const [gpx, gpz] = W2(pondX, pondZ); const pond = new T.Mesh(new T.CircleGeometry(3.4, 40), waterMaterial(0x2fb3a3, 0x0b5a6e)); pond.rotation.x = -Math.PI / 2; pond.position.set(pondX, 0.22, pondZ); g.add(pond); const rim = new T.Mesh(new T.TorusGeometry(3.5, 0.28, 8, 40), M(0x8b8378, { roughness: 0.9 })); rim.rotation.x = -Math.PI / 2; rim.position.set(pondX, 0.2, pondZ); g.add(rim); app.addObstacle(gpx, gpz, 3.8);
  const koi = []; for (let i = 0; i < 6; i++) { const k = new T.Group(); const b = new T.Mesh(new T.SphereGeometry(0.18, 10, 6), M(i % 2 ? 0xff7a2a : 0xffffff, { roughness: 0.4 })); b.scale.set(1, 0.45, 2.2); k.add(b); const tail = new T.Mesh(new T.ConeGeometry(0.12, 0.3, 4), M(0xff7a2a)); tail.rotation.x = Math.PI / 2; tail.position.z = -0.45; k.add(tail); k.position.y = 0.08; g.add(k); koi.push([k, i]); }
  app.onUpdate((dt, t) => { for (const [k, i] of koi) { const a = t * (0.35 + i * 0.05) + i * 1.05; const r = 1.2 + (i % 3) * 0.6; k.position.x = pondX + Math.cos(a) * r; k.position.z = pondZ + Math.sin(a) * r; k.rotation.y = -a; k.children[1].rotation.y = Math.sin(t * 8 + i) * 0.4; } });
  const bedM = M(0x8a5f3a, { map: realTex('wood', 2) }), soil = M(0x3b2a1a, { roughness: 1 }); const veg = [M(0x4caf50), M(0x8bc34a), M(0xe53935), M(0xffa000)];
  for (let b = 0; b < 3; b++) { const bx = 3 + b * 3.2, bz = hd + 8; box(2.4, 0.7, 4.6, bedM, bx, 0.35, bz, g); box(2.2, 0.1, 4.4, soil, bx, 0.72, bz, g); for (let r = 0; r < 8; r++) sph(0.22 + (r % 3) * 0.06, veg[(r + b) % 4], bx + (r % 2 ? 0.5 : -0.5), 0.9, bz - 1.8 + r * 0.5, g, 7); app.addBox(X + bx, Z + bz, 1.3, 2.4); }
  const pipe = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(pondX + 3.3, 0.3, pondZ), new T.Vector3(0.5, 0.9, pondZ - 0.5), new T.Vector3(3, 1, hd + 8)]), 20, 0.07, 6), M(0x9aa3ad, { metalness: 0.7 })); g.add(pipe);
  learnBadge(app, g, 'aqua', 1.5, 3.4, hd + 9, '🐟 Aquaponics');
  // rain → RO tank (north-east corner)
  const tank = new T.Group(); tank.position.set(hw + 2.4, 0, -hd - 1.6); g.add(tank); cyl(1.2, 1.2, 3, M(0xbfd3df, { metalness: 0.5, roughness: 0.3 }), 0, 1.5, 0, tank, 20); for (let k = 0; k < 3; k++) cyl(0.18, 0.18, 1.1, M(0xffffff, { roughness: 0.3 }), 1.6, 0.6 + k * 0.05, -0.6 + k * 0.6, tank, 10); const ro = textPlane(['RAIN → RO', 'DRINK · SHOWER'], 1.9, 0.8, { bg: '#ffffff', fg: '#0b3f8a', accent: '#38b6ff', font: 'bold 80px Poppins, Arial' }); ro.position.set(0, 1.9, 1.22); tank.add(ro); app.addObstacle(X + hw + 2.4, Z - hd - 1.6, 1.6);
  learnBadge(app, tank, 'water', 0, 4.2, 0, '💧 Rain → water');
  // geothermal: heat pump + glass cutaway of the ground loop
  const geo = new T.Group(); geo.position.set(hw + 3.2, 0, 4); g.add(geo); box(1.4, 1.2, 1, M(0xe9edf2, { metalness: 0.6, roughness: 0.3 }), 0, 0.6, 0, geo); const fan = new T.Mesh(new T.CircleGeometry(0.4, 20), M(0x222831)); fan.position.set(0, 0.7, 0.51); geo.add(fan);
  const cut = box(3, 2.4, 2, new T.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }), 2.6, -0.9, 0, geo); cut.userData.noOcclude = true; const loopMat = new T.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff8a3d, emissiveIntensity: 1.2 }); const loop = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(1.5, 0.1, 0), new T.Vector3(1.6, -1.9, 0), new T.Vector3(2.6, -2.0, 0.2), new T.Vector3(3.6, -1.9, 0), new T.Vector3(3.7, 0.1, 0)]), 30, 0.09, 8), loopMat); geo.add(loop); app.addObstacle(X + hw + 4, Z + 4, 2.2);
  app.onUpdate((dt, t) => { fan.rotation.z += dt * 6; loopMat.emissive.setHSL(0.05 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.6)), 0.9, 0.5); });
  learnBadge(app, geo, 'geo', 2, 3.2, 0, '🌡️ Geothermal');
  // wind turbine
  const wt = new T.Group(); const [wx, wz] = W2(hw + 10, -hd - 6); wt.position.set(wx, terrainY(wx, wz), wz); app.scene.add(wt); cyl(0.18, 0.32, 12, M(0xf4f6f8, { roughness: 0.35 }), 0, 6, 0, wt, 12); const hub = new T.Group(); hub.position.set(0, 12.2, 0.5); wt.add(hub); sph(0.4, M(0xffffff), 0, 0, 0, hub, 12); box(0.5, 0.5, 1.4, M(0xffffff), 0, 0, -0.6, wt).position.y = 12.2; for (let i = 0; i < 3; i++) { const b = box(0.32, 4.6, 0.08, M(0xffffff, { roughness: 0.3 }), 0, 2.3, 0, null); const arm = new T.Group(); arm.rotation.z = i * Math.PI * 2 / 3; arm.add(b); hub.add(arm); } app.addObstacle(wx, wz, 0.8); app.onUpdate((dt) => { hub.rotation.z += dt * 1.6; });
  // backyard: lawn chairs facing the projector screen, lake behind it
  const [sx, sz] = [X + 40, Z + 18]; const screen = new T.Group(); screen.position.set(sx, terrainY(sx, sz), sz); screen.rotation.y = -Math.PI / 2 - 0.35; app.scene.add(screen);
  for (const px of [-4.4, 4.4]) cyl(0.12, 0.12, 6.2, M(0x2a1a10), px, 3.1, 0, screen, 8); const scrM = new T.MeshBasicMaterial({ color: 0xf2f2f0 }); const scr = plane(8.4, 4.7, scrM, screen); scr.position.set(0, 3.7, 0.05); box(8.7, 5, 0.08, M(0x111111), 0, 3.7, -0.02, screen); scr.userData.noOcclude = true;
  const chairs = []; const rot = screen.rotation.y; const fx = Math.sin(rot), fz = Math.cos(rot); // screen faces (fx,fz)
  for (let i = 0; i < 3; i++) { const ox = sx + fx * 11 + Math.cos(rot) * (i - 1) * 2.4, oz = sz + fz * 11 - Math.sin(rot) * (i - 1) * 2.4; const c = new T.Group(); c.position.set(ox, terrainY(ox, oz), oz); c.rotation.y = rot + Math.PI; app.scene.add(c); const cm2 = M([0xff8a3d, 0x38b6ff, 0x7cff6b][i], { roughness: 0.7 }); box(0.9, 0.12, 1.2, cm2, 0, 0.45, 0, c); const back = box(0.9, 1, 0.12, cm2, 0, 0.9, -0.6, c); back.rotation.x = -0.35; for (const lx of [-0.4, 0.4]) for (const lz of [-0.5, 0.5]) cyl(0.03, 0.03, 0.45, M(0x9aa3ad), lx, 0.22, lz, c, 6); chairs.push(c); }
  // projector on a little table, with a beam you can see at night
  const pj = new T.Group(); const pjx = sx + fx * 15, pjz = sz + fz * 15; pj.position.set(pjx, terrainY(pjx, pjz), pjz); pj.rotation.y = rot + Math.PI; app.scene.add(pj); cyl(0.5, 0.5, 0.06, M(0x8a5f3a), 0, 0.9, 0, pj, 16); cyl(0.06, 0.06, 0.9, M(0x2a1a10), 0, 0.45, 0, pj, 6); box(0.6, 0.3, 0.5, M(0x222831, { metalness: 0.5 }), 0, 1.08, 0, pj); const lensP = sph(0.09, glow(0xffffff, 2), 0, 1.08, 0.26, pj, 8);
  const beamGeo = new T.ConeGeometry(4.8, 15, 4, 1, true); beamGeo.rotateY(Math.PI / 4); beamGeo.translate(0, -7.5, 0); beamGeo.rotateX(-Math.PI / 2); const beamMat = new T.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); const beam = new T.Mesh(beamGeo, beamMat); beam.position.set(0, 1.08, 0.3); beam.scale.set(1, 0.6, 1); beam.userData.noOcclude = true; beam.userData.noCollide = true; pj.add(beam);
  const movie = { on: false }; const flick = [0xbfd8ff, 0xffe0b8, 0xd8ffd0, 0xffd0e8];
  app.onUpdate((dt, t) => { const night = api.isNight(); beamMat.opacity += (((night || movie.on) ? 0.09 : 0.0) - beamMat.opacity) * Math.min(1, dt * 2); if (movie.on || night) { const k = Math.floor(t * 3) % flick.length; scrM.color.setHex(flick[k]).multiplyScalar(0.85 + Math.sin(t * 23) * 0.06 + 0.1); } else scrM.color.setHex(0xf2f2f0); homeGlow.intensity = night ? 3 : 0.6; inLight.intensity = night ? 2.4 : 0.6; });
  const watch = () => api.watchMovie({ videoId: '_GE6zf_hH48', title: 'Backyard movie night at Zach\'s', chair: chairs[1], screen, movie });
  app.addHotspot(screen, { fn: watch }); app.addInteractable(chairs[1].position.x, chairs[1].position.z, 6, '🍿 Watch the backyard movie?', watch);
  const scrSign = textPlane(['🍿 BACKYARD MOVIE NIGHT', 'walk up & sit down'], 6, 1, { bg: 'rgba(5,11,28,.9)', fg: '#fff', accent: '#ffd23f', font: 'bold 70px Poppins, Arial' }); scrSign.position.set(0, 6.7, 0.05); screen.add(scrSign);
  app.addObstacle(sx, sz, 1.2);

  // cutaway: hide roof + upper deco while you are inside, and slide the doors
  const inside = { on: false };
  app.onUpdate((dt) => { const P = app.player.position; const lx = P.x - X, lz = P.z - Z; const inn = Math.abs(lx) < hw - 0.2 && Math.abs(lz) < hd - 0.2 && P.y < y0 + 4; if (inn !== inside.on) { inside.on = inn; upper.visible = !inn; } for (const d of doors) { const near = Math.hypot(lx - d.sx * hw, lz) < 6; d.k += ((near ? 1 : 0) - d.k) * Math.min(1, dt * 4); for (const [p, f, s] of d.pair) { p.position.z = s * (gap / 2 + d.k * (gap - 0.2)); f.position.z = s * (gap / 2 + gap / 2 - 0.06 + d.k * (gap - 0.2)); } } });

  return { group: g, mats, setSkin: (name) => applySkin(mats, name), hw, hd, upper, music, movie, screen, chairs };
}
function applySkin(mats, name) { const s = SKINS[name]; if (!s) return; const old = mats.wall.map; mats.wall.map = hempTex(s.wall); mats.wall.needsUpdate = true; if (old) old.dispose(); mats.trim.color.setHex(s.trim); if (mats.accent) mats.accent.color.setHex(s.accent); }

/* ============================================================
   HOME STYLES — what you can build on a claimed lot
   Each returns { group, boxes: [[lx,lz,hw,hd]] } in lot space.
   ============================================================ */
export const STYLES = [
  ['deco', '🏛️', 'Eco Deco', 'Living roof, hempcrete, gold trim'],
  ['bungalow', '🏡', 'Bungalow', 'Cozy porch, gabled roof'],
  ['beach', '🏖️', 'Beach Villa', 'White stucco, blue shutters, deck'],
  ['treehouse', '🌳', 'Treehouse', 'Up in a giant tree, rope bridge'],
  ['space', '🛸', 'Space Villa', 'Glass dome, neon ring, landing legs'],
  ['loft', '🏙️', 'Loft Apartment', 'Three-story glass and steel'],
  ['mansion', '🏰', 'Cliffside Mansion', 'Two wings, columns, a pool'],
];
export function buildHome(style, opts = {}) {
  const g = new T.Group(); const boxes = []; const s = opts.skin ? SKINS[opts.skin] : null; const acc = opts.accent || (s ? s.accent : 0x38f0ff);
  const wallM = M(0xffffff, { map: hempTex(s ? s.wall : '#efe6d2'), roughness: 0.9 }); const trim = M(s ? s.trim : 0xc9a24a, { metalness: 0.6, roughness: 0.3 }); const gl = glass();
  const door = (x, z, ry = 0, p = g) => { const d = box(1.4, 2.4, 0.12, M(0x5a3a22, { map: realTex('wood', 2) }), x, 1.3, z, p); d.rotation.y = ry; return d; };
  if (style === 'bungalow') { box(10, 3.6, 8, wallM, 0, 1.9, 0, g); boxes.push([0, 0, 5.1, 4.1]); const rf = new T.Mesh(new T.ConeGeometry(7.6, 3, 4), M(0x8a3a2a, { roughness: 0.8 })); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.82); rf.position.y = 5.2; g.add(rf); box(10, 0.2, 3, M(0x8a5f3a, { map: realTex('wood', 2) }), 0, 0.4, -5.4, g); for (const px of [-4.5, 4.5]) cyl(0.12, 0.12, 3, M(0xffffff), px, 1.9, -6.6, g, 8); door(0, -4.05); for (const wx of [-3, 3]) box(1.6, 1.3, 0.1, gl, wx, 2.2, -4.06, g); cyl(0.4, 0.4, 2.6, M(0x8a3a2a), 3, 6, 1.5, g, 8); }
  else if (style === 'beach') { box(12, 4, 8, M(0xffffff, { roughness: 0.6 }), 0, 2.1, 0, g); boxes.push([0, 0, 6.1, 4.1]); box(12.6, 0.4, 8.6, M(0xd9e8f0), 0, 4.3, 0, g); box(13, 0.25, 4, M(0xc79a6b, { map: realTex('wood', 2) }), 0, 0.45, -6, g); for (const wx of [-4, 0, 4]) { box(1.6, 1.8, 0.1, gl, wx, 2.4, -4.06, g); for (const sx of [-1.05, 1.05]) box(0.5, 1.9, 0.08, M(0x2f86ff), wx + sx, 2.4, -4.1, g); } const um = new T.Mesh(new T.ConeGeometry(1.8, 0.8, 10), M(0xff8a3d)); um.position.set(4.5, 2.8, -6.5); g.add(um); cyl(0.05, 0.05, 2.6, M(0xffffff), 4.5, 1.6, -6.5, g, 6); door(-5, -4.05); }
  else if (style === 'treehouse') { cyl(1.4, 2.2, 9, M(0x6b4a2a, { roughness: 0.95 }), 0, 4.5, 0, g, 12); boxes.push([0, 0, 2, 2]); for (let i = 0; i < 4; i++) sph(4.2 - i * 0.4, M([0x3f8a3a, 0x4caf50, 0x2e7d32, 0x66bb6a][i]), Math.sin(i * 1.7) * 2.6, 11 + i * 0.9, Math.cos(i * 1.7) * 2.6, g, 12); const deck = box(7, 0.3, 7, M(0x8a5f3a, { map: realTex('wood', 2) }), 0, 6.5, 0, g); deck.userData.noOcclude = true; const hut = box(4.5, 3, 4.5, M(0xb98a5c, { map: realTex('wood', 2) }), 0, 8.2, 0, g); const hr = new T.Mesh(new T.ConeGeometry(3.8, 2.2, 4), M(0x6b8a3a)); hr.rotation.y = Math.PI / 4; hr.position.y = 10.8; g.add(hr); for (let i = 0; i < 9; i++) box(0.9, 0.08, 0.3, M(0x8a5f3a), 2.2, 0.6 + i * 0.68, 1.6, g); for (let i = 0; i < 12; i++) { const l = new T.Mesh(new T.SphereGeometry(0.12, 6, 4), glow([0xffd23f, 0xff4f79, 0x38f0ff][i % 3], 1.6)); const a = i / 12 * Math.PI * 2; l.position.set(Math.cos(a) * 3.3, 6.9, Math.sin(a) * 3.3); g.add(l); } }
  else if (style === 'space') { const dm = new T.Mesh(new T.SphereGeometry(5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.2, clearcoat: 1, depthWrite: false })); dm.position.y = 1.4; g.add(dm); cyl(5.2, 5.4, 1.4, M(0xe9edf2, { metalness: 0.8, roughness: 0.25 }), 0, 0.7, 0, g, 32); boxes.push([0, 0, 5, 5]); const ring = new T.Mesh(new T.TorusGeometry(5.6, 0.18, 10, 48), glow(acc, 2)); ring.rotation.x = Math.PI / 2; ring.position.y = 1.5; g.add(ring); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const leg = cyl(0.15, 0.25, 2.4, M(0x9aa3ad, { metalness: 0.8 }), Math.cos(a) * 5.6, 0.5, Math.sin(a) * 5.6, g, 8); leg.rotation.z = Math.cos(a) * 0.4; leg.rotation.x = -Math.sin(a) * 0.4; } sph(1.4, M(0x3f8a3a), 0, 2.3, 0, g, 12); const ant = cyl(0.05, 0.05, 3, M(0xffffff), 0, 7.4, 0, g, 6); sph(0.2, glow(0xff4f79, 2), 0, 9, 0, g, 8); }
  else if (style === 'loft') { const steel = M(0x5a6472, { metalness: 0.8, roughness: 0.3 }); for (let f = 0; f < 3; f++) { box(9, 3.6, 8, f === 0 ? wallM : gl, 0, 1.9 + f * 3.8, 0, g).userData.noOcclude = f > 0; box(9.4, 0.25, 8.4, steel, 0, 3.8 + f * 3.8, 0, g); } boxes.push([0, 0, 4.6, 4.1]); for (const [x, z] of [[-4.5, -4], [4.5, -4], [-4.5, 4], [4.5, 4]]) box(0.3, 11.6, 0.3, steel, x, 5.8, z, g); const sign = new T.Mesh(new T.BoxGeometry(5, 0.6, 0.1), glow(acc, 1.8)); sign.position.set(0, 3.2, -4.12); g.add(sign); door(0, -4.06); for (let i = 0; i < 6; i++) sph(0.4, M(0x4caf50), -3.5 + i * 1.4, 12.1, -3.2, g, 8); }
  else if (style === 'mansion') { box(16, 7, 10, wallM, 0, 3.6, 0, g); for (const sx of [-1, 1]) box(7, 5.4, 9, wallM, sx * 11, 2.8, 2, g); boxes.push([0, 0, 8.1, 5.1], [-11, 2, 3.6, 4.6], [11, 2, 3.6, 4.6]); box(17, 0.6, 11, trim, 0, 7.4, 0, g); for (let i = 0; i < 6; i++) cyl(0.35, 0.4, 6.8, M(0xffffff, { roughness: 0.4 }), -6.5 + i * 2.6, 3.5, -6, g, 14); box(16, 0.5, 2.6, M(0xffffff), 0, 7, -6.2, g); door(0, -5.06); const pool = new T.Mesh(new T.PlaneGeometry(8, 4), waterMaterial(0x38d8ff, 0x0b6fb0)); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.25, 9.5); g.add(pool); box(8.8, 0.3, 4.8, M(0xf4f1ea), 0, 0.12, 9.5, g); for (let w = 0; w < 5; w++) for (let f = 0; f < 2; f++) box(1.4, 1.8, 0.1, gl, -6 + w * 3, 2.2 + f * 3, -5.06, g); }
  else { /* deco */ box(12, 4.4, 9, wallM, 0, 2.3, 0, g); boxes.push([0, 0, 6.1, 4.6]); box(12.6, 0.35, 9.6, trim, 0, 4.6, 0, g); const sod = box(12, 0.25, 9, M(0xffffff, { map: grassRoofTex() }), 0, 4.9, 0, g); for (let i = 0; i < 3; i++) { const b = box(1, 0.8, 4 - i, wallM, -6.2, 5 + i * 0.8, 0, g); } for (const wz of [-3, 3]) box(0.1, 2.4, 2.4, gl, -6.06, 2.4, wz, g); door(-6.07, 0, Math.PI / 2); for (let c = 0; c < 3; c++) { const p = box(2.4, 0.06, 1.6, M(0xffffff, { map: solarTex(), metalness: 0.6, roughness: 0.25 }), -3 + c * 3, 5.4, 2.6, g); p.rotation.x = -0.3; } }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, boxes };
}

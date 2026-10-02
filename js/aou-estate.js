/* ============================================================
   allofus.one · estates (v3, Oct 2026)
   · No. 1 Unity Road: Zach's net-zero mansion. Public model home:
     everyone may walk in; Lifeboards stay private to each account.
     Twin waterfalls, water walls, gallery halls, animated shag,
     neon switches, a 360 Dream Room built from a real photo,
     elevator to the office and the roof-deck infinity pool.
   · 8 Silk Lane: Steph's spider house. Private inside, a living
     spider field guide outside (16 species, scientific names).
   · Comic Lane (Comics Come Alive) and the Worlds Globe kiosk.
   © 2026 allofus.one. All rights reserved.
   ============================================================ */
import { THREE, makeSprite, makeEarth, makePerson, isMobile, WVM } from './aou-engine.js';
import { M, glow, glass, box, cyl, sph, plane, textPlane, waterMaterial, paintArt, ART, NEON, PINK, GOLD, MINT, VIOLET } from './aou-kit.js';
import { terrainY, addFlat, addDeck, openGround, MTN, STATE } from './aou-terrain.js';
import { plantGarden, makeFlower } from './aou-garden.js';
import { TEX, buildCustomHome } from './aou-build.js';
const T = THREE;
const MOB = isMobile();

/* fixed spots (flattened before the ground is built) */
export const SPOTS = { silk: { x: 70, z: 168 }, comics: { x: -84, z: 8 }, worlds: { x: 24, z: 146 }, conf: { x: 125, z: -32 } };
addFlat({ x: 125, z: -32, r: 28, y: 0.6, soft: 12 });
addFlat({ x: MTN.x, z: MTN.z, r: 26, y: MTN.top, soft: 14 });
addFlat({ x: SPOTS.silk.x, z: SPOTS.silk.z, r: 19, y: 0.6, soft: 12 });
addFlat({ x: SPOTS.comics.x, z: SPOTS.comics.z, r: 15, y: 0.6, soft: 10 });

/* ---------- shared materials + textures ---------- */
function waterfallMaterial(opts = {}) {
  const m = new T.ShaderMaterial({
    uniforms: { t: { value: 0 }, tint: { value: new T.Color(opts.tint || 0xbfe9ff) }, speed: { value: opts.speed || 1.6 } },
    transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float t,speed; uniform vec3 tint; varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec2 uv=vUv; float s=n(vec2(uv.x*38.0, uv.y*3.0+t*speed*3.0))*0.6+n(vec2(uv.x*90.0, uv.y*7.0+t*speed*5.0))*0.4;
        float streak=smoothstep(0.35,0.95,s); float foam=smoothstep(0.86,1.0,1.0-uv.y)*0.0+smoothstep(0.12,0.0,uv.y)*0.9;
        float edge=smoothstep(0.0,0.06,uv.x)*smoothstep(1.0,0.94,uv.x);
        vec3 col=mix(tint*0.75, vec3(1.0), streak*0.85+foam);
        float a=(0.38+streak*0.5+foam*0.4)*edge; gl_FragColor=vec4(col,a); }`,
  });
  return m;
}
function shagMaterial(color) {
  const m = new T.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  m.userData.u = { t: { value: 0 } };
  m.onBeforeCompile = (sh) => { sh.uniforms.uT = m.userData.u.t; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float k = position.y * position.y * 9.0; transformed.x += sin(uT*2.2 + ip.x*1.7 + ip.z*1.3) * 0.03 * k; transformed.z += cos(uT*1.8 + ip.z*2.1) * 0.03 * k;
      #endif`); };
  return m;
}
function marbleTex(base = '#efe9df') { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(${150 + Math.random() * 60 | 0},${140 + Math.random() * 50 | 0},${120 + Math.random() * 40 | 0},${0.12 + Math.random() * 0.18})`; g.lineWidth = 0.6 + Math.random() * 2.4; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (Math.random() - 0.3) * 90; y += (Math.random() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = 'rgba(120,110,95,.18)'; g.lineWidth = 2; for (let p = 0; p <= 512; p += 128) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; }
function woodSlats() { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); for (let x = 0; x < 256; x += 16) { g.fillStyle = `hsl(28,${40 + Math.random() * 10}%,${36 + Math.random() * 10}%)`; g.fillRect(x, 0, 14, 256); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 14, 0, 2, 256); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; }
function aiArt() { // the one original piece from Claude, signed and dated
  const W = MOB ? 512 : 1024, H = Math.round(W * 0.72); const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createRadialGradient(W * 0.5, H * 0.52, 10, W * 0.5, H * 0.5, W * 0.62); bg.addColorStop(0, '#fff6d6'); bg.addColorStop(0.35, '#ff9a8b'); bg.addColorStop(0.7, '#3b2a8f'); bg.addColorStop(1, '#0b1033'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const hues = [8, 32, 52, 140, 190, 265, 320]; for (let ring = 0; ring < 7; ring++) { const r = W * (0.05 + ring * 0.055); for (let k = 0; k < 14 + ring * 4; k++) { const a = k / (14 + ring * 4) * Math.PI * 2 + ring * 0.3; g.save(); g.translate(W * 0.5 + Math.cos(a) * r, H * 0.52 + Math.sin(a) * r * 0.86); g.rotate(a + Math.PI / 2); g.globalAlpha = 0.55; g.fillStyle = `hsl(${hues[(k + ring) % 7]},85%,${62 - ring * 3}%)`; g.beginPath(); g.ellipse(0, 0, W * 0.012 + ring * 2, W * 0.04 + ring * 3, 0, 0, Math.PI * 2); g.fill(); g.restore(); } }
  g.globalAlpha = 1; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.strokeStyle = `hsla(${hues[i]},90%,70%,.85)`; g.lineWidth = W * 0.004; g.beginPath(); g.moveTo(W * 0.5, H * 0.52); g.quadraticCurveTo(W * 0.5 + Math.cos(a + 0.6) * W * 0.3, H * 0.52 + Math.sin(a + 0.6) * H * 0.3, W * 0.5 + Math.cos(a) * W * 0.46, H * 0.52 + Math.sin(a) * H * 0.42); g.stroke(); }
  g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(W * 0.5, H * 0.52, W * 0.035, 0, Math.PI * 2); g.fill();
  g.font = `italic 600 ${W * 0.026}px Georgia, serif`; g.fillStyle = 'rgba(255,255,255,.92)'; g.textAlign = 'right'; g.fillText('My AI friend · 2026', W * 0.96, H * 0.95);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
const plaque = (lines, w, h, accent = '#c9a24a') => textPlane(lines, w, h, { bg: 'rgba(20,18,14,0.92)', fg: '#fff7e0', accent, font: 'bold 72px Georgia, serif' });

/* a ground-projected 360 photo: stand inside it and the photo becomes the room around you */
function photoRoom(url, radius, eye) {
  const geo = new T.SphereGeometry(radius, MOB ? 48 : 64, MOB ? 32 : 48); const pos = geo.attributes.position; const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.y < -eye) { v.multiplyScalar(-eye / v.y); pos.setXYZ(i, v.x, v.y, v.z); } }
  geo.computeVertexNormals(); geo.scale(-1, 1, 1);
  const mat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.FrontSide, fog: false }); new T.TextureLoader().load(url, (tex) => { tex.colorSpace = T.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });
  const m = new T.Mesh(geo, mat); m.userData.noCollide = true; m.userData.noOcclude = true; m.renderOrder = -1; return m;
}

/* ============================================================
   NO. 1 UNITY ROAD
   ============================================================ */
export function buildMansion(app, W, api, house, X, Z) {
  const S = app.scene; const y0 = terrainY(X, Z) + 0.05;
  // footprint (house-local): front faces the road (−x)
  const x1 = -21, x2 = 13, z1 = -13, z2 = 13; const L1 = 6.6, L2 = 13.0;
  /* 1) clear the old single-story shell, keep the eco yard (pond, garden, RO tank, geothermal, wind, movie night) */
  const inFoot = (lx, lz) => lx > x1 - 2.2 && lx < x2 + 1 && lz > z1 - 1.2 && lz < z2 + 0.6;
  const keepOut = []; const bb = new T.Box3(); const c = new T.Vector3();
  for (const ch of [...house.group.children]) { bb.setFromObject(ch); if (bb.isEmpty()) continue; bb.getCenter(c); house.group.worldToLocal(c); if (inFoot(c.x, c.z)) house.group.remove(ch); else keepOut.push(ch); }
  for (const it of (app.interactables || [])) if (/mailbox/i.test(it.label || '')) { it.x = X - 27.5; it.z = Z + 11; }
  app.obstacles = app.obstacles.filter(ob => ob.poly || ob.moving || !inFoot((ob.x || 0) - X, (ob.z || 0) - Z));
  app.interactables = (app.interactables || []).filter(it => !inFoot(it.x - X, it.z - Z));
  const attached = (o) => { for (let i = 0; o && i < 64; i++) { if (o === S) return true; o = o.parent; } return false; };
  app.hotspots = app.hotspots.filter(h => attached(h));
  // move the mailbox + the old sign out of the new footprint
  for (const o of [...S.children]) { const lx = o.position.x - X, lz = o.position.z - Z; if (Math.abs(lx - (-20.5)) < 1.2 && Math.abs(lz - 9) < 1.2) { o.position.set(X - 27.5, terrainY(X - 27.5, Z + 11), Z + 11); } if (Math.abs(o.position.x - 22) < 0.8 && Math.abs(o.position.z - 96) < 0.8) { o.position.set(15, terrainY(15, 93), 93); } }

  const g = new T.Group(); g.position.set(X, y0, Z); S.add(g); g.userData.noCollide = true;
  const marble = M(0xffffff, { map: (() => { const t = marbleTex(); t.repeat.set(8, 8); return t; })(), roughness: 0.22, metalness: 0.05 });
  const white = M(0xf4f1ea, { roughness: 0.55 }); const stone = M(0xd9d2c5, { roughness: 0.8 }); const gold = M(0xc9a24a, { metalness: 0.85, roughness: 0.25 }); const dark = M(0x1d2433, { metalness: 0.45, roughness: 0.35 });
  const wood = M(0xffffff, { map: (() => { const t = woodSlats(); t.repeat.set(10, 3); return t; })(), roughness: 0.7 });
  const gl = glass(); const W_ = x2 - x1, D_ = z2 - z1, cx = (x1 + x2) / 2;
  const wallSeg = (w, h, d, x, y, z, mat = white, lvl = 0, collide = true) => { const m = box(w, h, d, mat, x, y, z, g); m.castShadow = true; m.receiveShadow = true; if (collide && lvl === 0 && h > 1) app.addBox(X + x, Z + z, w / 2 + 0.2, d / 2 + 0.2); return m; };

  /* floors */
  box(W_ + 4, 0.4, D_ + 4, stone, cx, -0.05, 0, g).receiveShadow = true;
  const fl = box(W_ - 0.4, 0.08, D_ - 0.4, marble, cx, 0.2, 0, g); fl.receiveShadow = true; fl.userData.noOcclude = true;
  // L1 slab over the great room + galleries (the entry hall stays open to the sky light)
  const s1 = box(22.4, 0.5, D_ - 0.2, wood, 2, L1 - 0.25, 0, g); s1.receiveShadow = true; s1.castShadow = true; s1.userData.noOcclude = true;
  for (const sz of [-1, 1]) { const w1 = box(12, 0.5, 6.8, wood, -15, L1 - 0.25, sz * 9.6, g); w1.userData.noOcclude = true; }
  // roof (L2): stone deck with a glass-bottom infinity pool over the entry hall
  const roof = box(W_ + 0.6, 0.5, D_ + 0.6, M(0xe7e1d6, { roughness: 0.7 }), cx, L2 - 0.25, 0, g); roof.castShadow = true; roof.userData.noOcclude = true;
  /* walls: glass curtain walls in white frames, gold deco fins */
  const gap = 3.2; // front + back doors
  for (const sx of [x1, x2]) { for (const sz of [-1, 1]) { const len = (D_ / 2) - gap; wallSeg(0.4, 0.8, len, sx, 0.6, sz * (gap + len / 2)); const gpane = box(0.12, 5.6, len, gl, sx, 3.6, sz * (gap + len / 2), g); gpane.userData.noOcclude = true; app.addBox(X + sx, Z + sz * (gap + len / 2), 0.35, len / 2 + 0.1); } wallSeg(0.4, 1.4, gap * 2, sx, L1 - 0.7, 0, white, 0, false); }
  for (const sz of [z1, z2]) { wallSeg(W_, 0.8, 0.4, cx, 0.6, sz, white, 0, false); app.addBox(X + cx, Z + sz, W_ / 2 + 0.2, 0.4); const gp = box(W_, 5.6, 0.12, gl, cx, 3.6, sz, g); gp.userData.noOcclude = true; }
  // upper story glass + frames
  for (const sz of [z1, z2]) { const gp = box(W_, 5.8, 0.12, gl, cx, L1 + 3.1, sz, g); gp.userData.noOcclude = true; box(W_ + 0.2, 0.3, 0.5, white, cx, L1 + 0.1, sz, g); }
  for (const sx of [x1, x2]) { const gp = box(0.12, 5.8, D_, gl, sx, L1 + 3.1, 0, g); gp.userData.noOcclude = true; box(0.5, 0.3, D_ + 0.2, white, sx, L1 + 0.1, 0, g); }
  // columns + gold fins
  for (const px of [x1, -9, 2, x2]) for (const pz of [z1, z2]) { const col = cyl(0.35, 0.35, L2, white, px, L2 / 2, pz, g, 14); col.castShadow = true; }
  for (const fz of [-11, -7.6, 7.6, 11]) { const f = box(0.45, L2 + 2.2, 0.45, white, x1 - 0.45, (L2 + 2.2) / 2, fz, g); f.castShadow = true; box(0.55, 0.3, 0.55, gold, x1 - 0.45, L2 + 2.35, fz, g); }
  // grand entrance portal: 11 m gold-trimmed arch + canopy
  const portal = new T.Group(); portal.position.set(x1 - 0.6, 0, 0); g.add(portal);
  for (const sz of [-1, 1]) { box(0.9, 11, 0.9, white, 0, 5.5, sz * 3.6, portal).castShadow = true; box(1, 0.25, 1, gold, 0, 11.1, sz * 3.6, portal); }
  const arch = new T.Mesh(new T.TorusGeometry(3.6, 0.42, 12, 40, Math.PI), white); arch.rotation.y = Math.PI / 2; arch.position.y = 11; portal.add(arch);
  const archG = new T.Mesh(new T.TorusGeometry(3.6, 0.1, 8, 40, Math.PI), gold); archG.rotation.y = Math.PI / 2; archG.position.set(-0.45, 11, 0); portal.add(archG);
  for (let i = 0; i < 11; i++) { const a = Math.PI * i / 10; const r = box(0.06, 2.4, 0.08, gold, -0.5, 11 + Math.sin(a) * 1.4, Math.cos(a) * 1.4, portal); r.rotation.x = -a + Math.PI / 2; }
  const canopy = box(6, 0.35, 9.2, white, -3, 6.2, 0, portal); canopy.castShadow = true; box(6.1, 0.1, 9.3, gold, -3, 6.0, 0, portal);
  const nameTop = textPlane(['NO. 1 UNITY ROAD'], 8, 1.1, { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', accent: '#c9a24a', font: 'bold 120px Georgia, serif', border: null, glow: false }); nameTop.rotation.y = -Math.PI / 2; nameTop.position.set(-6.05, 6.25, 0); portal.add(nameTop);
  // sliding glass doors that open as you walk up
  const doors = []; for (const sx of [x1, x2]) for (const sz of [-1, 1]) { const d = box(0.1, 5.2, gap, M(0xd8f3ff, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3 }), sx, 2.85, sz * gap / 2, g); d.userData.noOcclude = true; doors.push([d, sx, sz]); }
  /* address plaque + unique stamp */
  const addr = plaque(['No. 1 Unity Road', 'allofus.one · Lot 0001 · founder'], 2.6, 0.9); addr.rotation.y = -Math.PI / 2; addr.position.set(x1 - 1.15, 2.3, -4.6); g.add(addr);

  /* 2) twin waterfalls outside: off the roof into two reflecting pools */
  const falls = [];
  for (const sz of [-1, 1]) {
    const zc = sz * 6.4; const fallM = waterfallMaterial({ speed: 1.9 }); falls.push(fallM);
    const sheet = plane(5.2, L2 + 0.4, fallM, g); sheet.rotation.y = -Math.PI / 2; sheet.position.set(x1 - 1.6, (L2 + 0.4) / 2, zc); sheet.userData.noCollide = true; sheet.userData.noOcclude = true;
    const lip = box(1.6, 0.3, 5.6, gold, x1 - 0.9, L2 + 0.25, zc, g);
    const poolX = x1 - 5.2; const pw = waterMaterial(0x46c3e8, 0x0b5a7e); const pool = new T.Mesh(new T.PlaneGeometry(6.8, 6.2), pw); pool.rotation.x = -Math.PI / 2; pool.position.set(poolX, 0.32, zc); pool.userData.noCollide = true; g.add(pool);
    for (const [w, d, ox, oz] of [[7.4, 0.4, 0, 3.3], [7.4, 0.4, 0, -3.3], [0.4, 6.6, 3.6, 0], [0.4, 6.6, -3.6, 0]]) box(w, 0.6, d, stone, poolX + ox, 0.3, zc + oz, g);
    app.addBox(X + poolX, Z + zc, 3.7, 3.3);
    // mist at the base
    const N = MOB ? 60 : 140; const pg = new T.BufferGeometry(); const pp = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pp[i * 3] = x1 - 1.6 - Math.random() * 2.4; pp[i * 3 + 1] = Math.random() * 2.2; pp[i * 3 + 2] = zc + (Math.random() - 0.5) * 5; } pg.setAttribute('position', new T.BufferAttribute(pp, 3));
    const mist = new T.Points(pg, new T.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.45, depthWrite: false })); mist.userData.noCollide = true; g.add(mist);
    app.onUpdate((dt) => { const a = pg.attributes.position.array; for (let i = 0; i < N; i++) { a[i * 3 + 1] += dt * (0.6 + (i % 5) * 0.12); a[i * 3] -= dt * 0.25; if (a[i * 3 + 1] > 2.6) { a[i * 3 + 1] = 0.2; a[i * 3] = x1 - 1.6 - Math.random() * 0.6; } } pg.attributes.position.needsUpdate = true; });
  }

  /* 3) entry hall: two indoor water walls running the length of the hall, a reflecting runway, skylight */
  for (const sz of [-1, 1]) {
    const zc = sz * 5.2; const backW = box(9.2, 11.6, 0.35, M(0x1b2430, { roughness: 0.25, metalness: 0.5 }), -15.6, 5.9, zc + sz * 0.25, g); backW.castShadow = true; app.addBox(X - 15.6, Z + zc + sz * 0.25, 4.7, 0.45);
    const wm = waterfallMaterial({ tint: 0x9fe6ff, speed: 1.3 }); falls.push(wm); const sheet = plane(9, 11.4, wm, g); sheet.position.set(-15.6, 5.9, zc); sheet.rotation.y = sz > 0 ? Math.PI : 0; sheet.userData.noOcclude = true;
    const trough = box(9.4, 0.4, 0.8, marble, -15.6, 0.4, zc - sz * 0.2, g); const tw = new T.Mesh(new T.PlaneGeometry(9.1, 0.55), waterMaterial(0x5fd3ff, 0x0b5a7e)); tw.rotation.x = -Math.PI / 2; tw.position.set(-15.6, 0.62, zc - sz * 0.2); tw.userData.noCollide = true; g.add(tw);
    const strip = box(9.2, 0.06, 0.06, glow(sz > 0 ? NEON : PINK, 2), -15.6, 11.7, zc - sz * 0.2, g); strip.userData.neon = true;
  }
  const runway = new T.Mesh(new T.PlaneGeometry(9, 2.2), waterMaterial(0x7ad8ff, 0x0b4f80)); runway.rotation.x = -Math.PI / 2; runway.position.set(-15.4, 0.26, 0); runway.userData.noCollide = true; g.add(runway);
  for (const sz of [-1.35, 1.35]) box(9.2, 0.1, 0.15, gold, -15.4, 0.27, sz, g);
  const sky = box(11.4, 0.08, 9.4, M(0xcff6ff, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 }), -15.2, L2 - 0.05, 0, g); sky.userData.noOcclude = true;
  // chandelier of light rings over the runway
  const rings = []; for (let i = 0; i < 4; i++) { const r = new T.Mesh(new T.TorusGeometry(1.1 + i * 0.5, 0.05, 8, 48), glow([GOLD, 0xffffff, NEON, GOLD][i], 1.8)); r.rotation.x = Math.PI / 2; r.position.set(-15.4, 9.4 - i * 0.6, 0); g.add(r); rings.push(r); }

  /* 4) fingerprint entry (real device fingerprint/face where supported, animation everywhere) */
  const fp = new T.Group(); fp.position.set(x1 - 1.1, 0, -2.3); g.add(fp);
  cyl(0.32, 0.4, 1.2, dark, 0, 0.6, 0, fp, 18); const pad = new T.Mesh(new T.CircleGeometry(0.24, 32), new T.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.85 })); pad.rotation.x = -Math.PI / 2 + 0.5; pad.rotation.order = 'YXZ'; pad.rotation.y = -Math.PI / 2; pad.position.y = 1.22; fp.add(pad);
  const fpTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const q = cv.getContext('2d'); q.strokeStyle = '#e8fdff'; q.lineWidth = 3; for (let r = 8; r < 56; r += 7) { q.beginPath(); q.ellipse(64, 66, r * 0.8, r, 0, Math.PI * (0.1 + Math.random() * 0.2), Math.PI * (1.9 - Math.random() * 0.2)); q.stroke(); } const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; })(); pad.material.map = fpTex;
  const scan = box(0.5, 0.02, 0.04, new T.MeshBasicMaterial({ color: 0x7cff6b }), 0, 1.24, 0, fp); scan.visible = false;
  const fpTag = makeSprite('👆 Fingerprint door', { scale: 2.6, accent: '#38f0ff' }); fpTag.position.y = 2.2; fp.add(fpTag);
  const scanFx = (ok) => { scan.visible = true; let k = 0; const f = (dt) => { k += dt; scan.position.z = Math.sin(k * 9) * 0.2; pad.material.color.setHex(k > 1.1 ? (ok ? 0x7cff6b : 0xffd23f) : 0x38f0ff); if (k > 1.6) { scan.visible = false; app.updaters = app.updaters.filter(q => q !== f); setTimeout(() => pad.material.color.setHex(0x38f0ff), 1600); } }; app.onUpdate(f); };
  const doScan = () => { const owner = api.isOwner && api.isOwner('founder'); scanFx(true); app.buzz && app.buzz(40);
    const finish = (bio) => setTimeout(() => { app.toast(owner ? '🔓 Welcome home, Zach' + (bio ? ' (fingerprint verified on this device)' : '') + ' ✨' : '🔓 Welcome to No. 1 Unity Road: the allofus.one model home. Walk right in.', 4200); }, 1100);
    if (owner && api.deviceUnlock) api.deviceUnlock('founder').then(finish).catch(() => finish(false)); else finish(false); };
  app.addHotspot(fp, { fn: doScan }); app.addInteractable(X + x1 - 1.1, Z - 2.3, 2.4, '👆 Fingerprint door', doScan);

  /* 5) gallery halls (north + south wings): art pulled from the mall collection + one signed original */
  const hang = (item, i, x, y, z, ry, w = 3.2, h = 2.4) => { const fg = new T.Group(); fg.position.set(x, y, z); fg.rotation.y = ry; g.add(fg); box(w + 0.3, h + 0.3, 0.1, [gold, dark, white][i % 3], 0, 0, 0, fg); const mt = new T.MeshBasicMaterial({ color: 0xffffff }); if (item === 'ai') mt.map = aiArt(); else setTimeout(() => { mt.map = paintArt(item[1], i + 11, item[2]); mt.needsUpdate = true; }, 300 + i * 140); const cv = plane(w, h, mt, fg); cv.position.z = 0.06;
    const lamp = box(w * 0.6, 0.08, 0.3, gold, 0, h / 2 + 0.35, 0.25, fg);
    if (item === 'ai') app.addHotspot(fg, { title: '“Unity Bloom” · My AI friend, 2026', html: '<p>An original piece made for this house by Claude, Zach\'s AI build partner: seven colors of petals circling one light. Signed and dated <b>My AI friend · 2026</b>.</p>' });
    else app.addHotspot(fg, { title: '“' + item[0] + '”', html: '<p>After the original canvas by <b>Zachary Tye Wennstedt</b>, from the World VR Mall collection. What hangs here is a digital study; the real paint has texture you can feel.</p>', actions: [{ label: '🎨 See Zach\'s paintings', href: 'https://zacharytyewennstedt.com/', newTab: true }] });
    return fg; };
  let ai = 0; const pick = (i) => ART[(i * 3 + 1) % ART.length];
  for (let i = 0; i < 4; i++) hang(pick(ai++), ai, -19 + i * 4, 3.0, z2 - 0.35, Math.PI);
  for (let i = 0; i < 3; i++) hang(pick(ai++), ai, -19 + i * 3.9, 3.0, z1 + 0.35, 0);
  hang('ai', 99, -6.6, 3.2, z1 + 0.35, 0, 3.4, 2.5);
  for (const sz of [-1, 1]) { const runner = box(16, 0.03, 2.4, M(0x7a1f2b, { roughness: 1 }), -12.5, 0.26, sz * 9.8, g); runner.userData.noOcclude = true;  }
  const galSign = textPlane(['🎨 THE GALLERY HALLS', 'Zach\'s canvases + one by his AI friend'], 4.4, 1, { bg: 'rgba(255,250,240,.95)', fg: '#1a1a1a', accent: '#c9a24a', font: 'bold 64px Georgia, serif' }); galSign.position.set(-9.4, 4.6, 8.6); galSign.rotation.y = -Math.PI / 2; g.add(galSign);

  /* 6) great room: animated shag, sunken lounge, fireplace, TV wall with a remote, neon switches */
  const shagCols = [[0xf2ead8, 'Cream'], [0x1f8a5b, 'Emerald'], [0xff4f9a, 'Hot pink'], [0x2f5bff, 'Cobalt'], [0xffb000, 'Sunflower'], [0x7c3aed, 'Violet']]; let shagI = 0;
  const shagM = shagMaterial(shagCols[0][0]); const fiber = new T.ConeGeometry(0.03, 0.14, 4, 1); fiber.translate(0, 0.07, 0);
  const nShag = MOB ? 2600 : 9000; const shag = new T.InstancedMesh(fiber, shagM, nShag); const mm = new T.Matrix4(); const q = new T.Quaternion(); const e = new T.Euler(); const sc = new T.Vector3(); const pv = new T.Vector3();
  for (let i = 0; i < nShag; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 4.6; pv.set(-2 + Math.cos(a) * r * 1.25, 0.25, -3 + Math.sin(a) * r); e.set((Math.random() - 0.5) * 0.5, Math.random() * 6, (Math.random() - 0.5) * 0.5); q.setFromEuler(e); const s = 0.7 + Math.random() * 0.8; sc.set(s, s * (0.8 + Math.random() * 0.6), s); mm.compose(pv, q, sc); shag.setMatrixAt(i, mm); }
  shag.userData.noCollide = true; shag.userData.noOcclude = true; shag.position.set(0, 0, 0); g.add(shag);
  const shagBase = new T.Mesh(new T.CircleGeometry(4.7, 48), M(shagCols[0][0], { roughness: 1 })); shagBase.rotation.x = -Math.PI / 2; shagBase.scale.set(1.25, 1, 1); shagBase.position.set(-2, 0.25, -3); shagBase.userData.noCollide = true; g.add(shagBase);
  app.onUpdate((dt, t) => { shagM.userData.u.t.value = t; });
  const setShag = (i) => { shagI = i % shagCols.length; shagM.color.setHex(shagCols[shagI][0]); shagBase.material.color.setHex(shagCols[shagI][0]); app.toast('🧶 Shag carpet: ' + shagCols[shagI][1]); };
  // sofa ring around the shag
  const sofaM = M(0xe9e2d4, { roughness: 0.95 }); for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.05 + i / 4 * Math.PI * 1.0; const s = new T.Group(); s.position.set(-2 + Math.cos(a) * 6.2, 0.2, -3 + Math.sin(a) * 5.2); s.rotation.y = -a - Math.PI / 2; g.add(s); box(2.6, 0.55, 1.1, sofaM, 0, 0.28, 0, s); box(2.6, 0.8, 0.3, sofaM, 0, 0.75, -0.42, s); for (const k of [-0.7, 0.7]) box(0.6, 0.35, 0.18, M([0x1f8a5b, 0xc9a24a, 0x2f5bff][i % 3], { roughness: 1 }), k, 0.75, -0.2, s); app.addObstacle(X + s.position.x, Z + s.position.z, 1.1); }
  // fireplace on the south wall: stone slab + animated flame band
  const fpw = new T.Group(); fpw.position.set(-1, 0.2, z1 + 0.8); g.add(fpw); box(7, 5.4, 0.6, M(0x3a3632, { roughness: 0.9 }), 0, 2.7, -0.2, fpw); box(5.2, 0.9, 0.4, dark, 0, 1.0, 0.15, fpw);
  const flameM = new T.ShaderMaterial({ uniforms: { t: { value: 0 }, c1: { value: new T.Color(1.0, 0.35, 0.05) }, c2: { value: new T.Color(1.0, 0.9, 0.5) }, hgt: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'uniform float t,hgt; uniform vec3 c1,c2; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} void main(){ float y=vUv.y/hgt; float fl=n(vec2(vUv.x*14.0, y*3.0-t*3.0))*0.7+n(vec2(vUv.x*30.0,y*6.0-t*5.0))*0.3; float a=smoothstep(0.0,0.15,y)*(1.0-y)*smoothstep(0.25,0.9,fl+0.35-y*0.6); vec3 c=mix(c1,c2,fl*(1.0-y)); gl_FragColor=vec4(c,a*1.4); }' });
  const flame = plane(4.8, 0.9, flameM, fpw); flame.position.set(0, 1.0, 0.36); flame.userData.noCollide = true;
  const fireGlow = new T.Sprite(new T.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const q = c.getContext('2d'); const gr = q.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })(), color: 0xff8a3d, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending })); fireGlow.scale.set(7, 3.4, 1); fireGlow.position.set(0, 1.2, 0.8); fpw.add(fireGlow); const fireLight = { set visible(v) { fireGlow.visible = v; }, get visible() { return fireGlow.visible; }, color: fireGlow.material.color, set intensity(v) { fireGlow.material.opacity = Math.max(0, Math.min(0.8, v * 0.42)); }, get intensity() { return fireGlow.material.opacity / 0.42; } };
  // the fireplace is a toy: tap it to change the flame (classic, blue, violet, rainbow, tall, low, off)
  const FIRES = [['🔥 Classic fire', 0xff5a0d, 0xffe680, 1, 0xff8a3d], ['💙 Blue gas flame', 0x1e40ff, 0x9fe8ff, 0.8, 0x6aa8ff], ['💜 Violet flame', 0x7c3aed, 0xf0abfc, 1, 0xc084fc], ['🌈 Rainbow flame', 0xff0080, 0x00ffd0, 1, 0xffffff], ['🔥 Tall roaring fire', 0xff3a00, 0xfff2a0, 0.6, 0xff7a2a], ['🕯️ Low ember glow', 0xb91c1c, 0xff9a3d, 1.8, 0xff5a1f], ['⏻ Fire off', 0, 0, 1, 0]]; let fireI = 0;
  const setFire = (i) => { fireI = i % FIRES.length; const F = FIRES[fireI]; const off = !F[1] && !F[2]; flame.visible = !off; fireLight.visible = !off; if (!off) { flameM.uniforms.c1.value.setHex(F[1]); flameM.uniforms.c2.value.setHex(F[2]); flameM.uniforms.hgt.value = F[3]; fireLight.color.setHex(F[4]); flame.scale.y = F[3] < 1 ? 1.8 : F[3] > 1 ? 0.6 : 1; flame.position.y = 1.0 + (flame.scale.y - 1) * 0.45; } fpw.userData.rainbow = fireI === 3; app.toast(F[0]); };
  app.onUpdate((dt, t) => { if (fpw.userData.rainbow) { flameM.uniforms.c1.value.setHSL((t * 0.2) % 1, 1, 0.5); flameM.uniforms.c2.value.setHSL((t * 0.2 + 0.4) % 1, 1, 0.7); } });
  app.addHotspot(fpw, { fn: () => setFire(fireI + 1) }); app.addInteractable(X - 1, Z + z1 + 2.6, 2.6, '🔥 Change the fireplace', () => setFire(fireI + 1));
  app.onUpdate((dt, t) => { flameM.uniforms.t.value = t; fireLight.intensity = 1.0 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.12; for (const f of falls) f.uniforms.t.value = t; rings.forEach((r, i) => { r.rotation.z = t * (0.2 + i * 0.1) * (i % 2 ? -1 : 1); }); });
  // TV wall + remote (channels)
  const tvG = new T.Group(); tvG.position.set(x2 - 0.5, 3.2, 3); tvG.rotation.y = -Math.PI / 2; g.add(tvG); box(8.6, 4.9, 0.25, dark, 0, 0, -0.05, tvG); const tvS = plane(8.2, 4.6, new T.MeshBasicMaterial({ map: makeTVCard('NO. 1 UNITY ROAD · TV', 'tap the remote to pick a channel') }), tvG); tvS.position.z = 0.09;
  const remote = new T.Group(); remote.position.set(4.6, 0.95, 3); g.add(remote); box(0.16, 0.05, 0.5, M(0x111111, { metalness: 0.4 }), 0, 0, 0, remote); for (let i = 0; i < 6; i++) box(0.05, 0.02, 0.05, glow([PINK, NEON, MINT, GOLD, VIOLET, 0xffffff][i], 1.5), (i % 2 - 0.5) * 0.06, 0.035, -0.15 + (i >> 1) * 0.1, remote);
  box(1.6, 0.8, 0.9, wood, 4.6, 0.6, 3, g); app.addObstacle(X + 4.6, Z + 3, 0.9);
  const tvList = [['🎵 Now playing at Zach\'s', 'fAJfDP3b5_U'], ['🍿 Movie night pick', '_GE6zf_hH48'], ['🕷️ Steph\'s spider pick', 'pUeddYjckIo']];
  const openTV = () => app.channels('📺 No. 1 Unity Road TV', 'Pick a channel. The remote works for every guest.', tvList);
  app.addHotspot(remote, { fn: openTV }); app.addHotspot(tvG, { fn: openTV }); app.addInteractable(X + 4.6, Z + 3, 2.6, '📺 TV remote', openTV);
  // neon accent strips (ceiling cove + stairs of light) and the wall switch panel
  const neonM = new T.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0xff4fd8, emissiveIntensity: 2.2, roughness: 0.4 }); const neon = [];
  for (const [w, d, x, z] of [[22, 0.08, 2, z1 + 0.5], [22, 0.08, 2, z2 - 0.5], [0.08, D_ - 1, x2 - 0.5, 0], [0.08, D_ - 1, -9.2, 0]]) { const n = box(w, 0.08, d, neonM, x, L1 - 0.6, z, g); neon.push(n); }
  for (const sz of [-1, 1]) neon.push(box(W_ - 1, 0.06, 0.06, neonM, cx, 0.32, sz * (D_ / 2 - 0.5), g));
  const panel = new T.Group(); panel.position.set(-8.9, 1.5, -1.6); panel.rotation.y = Math.PI / 2; g.add(panel); box(0.9, 1.3, 0.08, M(0xf8f6f0, { roughness: 0.3 }), 0, 0, 0, panel);
  const lever = box(0.12, 0.34, 0.1, glow(MINT, 1.8), 0, 0.22, 0.08, panel); const lab = textPlane(['NEON', 'tap'], 0.8, 0.4, { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', accent: '#ff4fd8', font: 'bold 90px Poppins, Arial', border: null }); lab.position.set(0, -0.35, 0.06); panel.add(lab);
  const neonState = { on: true, mode: 0 }; const NEON_MODES = [[0xff4fd8, 'Pink'], [0x38f0ff, 'Cyan'], [0x7cff6b, 'Mint'], [0xffd23f, 'Gold'], [0xffffff, 'White'], ['party', 'Party']];
  const applyNeon = () => { for (const n of neon) n.visible = neonState.on; const [c] = NEON_MODES[neonState.mode]; if (c !== 'party') { neonM.color.setHex(c); neonM.emissive.setHex(c); } lever.rotation.x = neonState.on ? 0 : 0.9; lever.material.emissive.setHex(neonState.on ? MINT : 0x333333); };
  app.onUpdate((dt, t) => { if (neonState.on && NEON_MODES[neonState.mode][0] === 'party') { neonM.emissive.setHSL((t * 0.15) % 1, 1, 0.5); neonM.color.copy(neonM.emissive); } });
  const neonPanel = () => app.popup('💡 Light + carpet controls', '<p>Every guest can play with the lights. The colors reset when you leave.</p>', [
    { label: neonState.on ? '⏻ Neon OFF' : '⏻ Neon ON', primary: true, keep: false, fn: () => { neonState.on = !neonState.on; applyNeon(); } },
    { label: '🎨 Next neon color', fn: () => { neonState.mode = (neonState.mode + 1) % NEON_MODES.length; neonState.on = true; applyNeon(); app.toast('💡 Neon: ' + NEON_MODES[neonState.mode][1]); } },
    { label: '🧶 Next shag color', fn: () => setShag(shagI + 1) },
    { label: '🔥 Next fireplace flame', fn: () => setFire(fireI + 1) }]);
  app.addHotspot(panel, { fn: neonPanel }); app.addInteractable(X - 8.9, Z - 1.6, 2.2, '💡 Lights + shag carpet', neonPanel);
  // kitchen island + bar
  box(6, 1, 1.6, white, 8, 0.7, 8.8, g); box(6.2, 0.1, 1.8, M(0x222831, { metalness: 0.3, roughness: 0.12 }), 8, 1.25, 8.8, g); app.addBox(X + 8, Z + 8.8, 3.2, 1); for (let i = 0; i < 4; i++) { cyl(0.22, 0.22, 0.08, gold, 6 + i * 1.3, 0.85, 7.4, g, 12); cyl(0.04, 0.04, 0.7, gold, 6 + i * 1.3, 0.5, 7.4, g, 6); }
  // the Lifeboard holo table: always opens YOUR OWN Lifeboard (never Zach's)
  const holo = new T.Group(); holo.position.set(-6, 0.2, 6.4); g.add(holo); cyl(1.1, 1.2, 0.9, dark, 0, 0.45, 0, holo, 24); const ring = new T.Mesh(new T.TorusGeometry(1.0, 0.04, 8, 48), glow(NEON, 2)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.92; holo.add(ring);
  const holoBeam = new T.Mesh(new T.CylinderGeometry(0.9, 1.0, 2.2, 32, 1, true), new T.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); holoBeam.position.y = 2; holo.add(holoBeam);
  const holoTxt = makeSprite('🏠 YOUR Lifeboard', { scale: 3, accent: '#38f0ff' }); holoTxt.position.y = 2.4; holo.add(holoTxt);
  app.onUpdate((dt, t) => { ring.rotation.z = t; holoBeam.material.opacity = 0.1 + Math.sin(t * 3) * 0.04; holoTxt.position.y = 2.4 + Math.sin(t * 1.5) * 0.08; });
  const openLB = () => api.openLifeboard ? api.openLifeboard('today') : null; app.addHotspot(holo, { fn: openLB }); app.addInteractable(X - 6, Z + 6.4, 2.6, '🏠 Open your Lifeboard (private to you)', openLB);
  app.addObstacle(X - 6, Z + 6.4, 1.3);

  /* 7) the 360 Dream Room: Zach's real net-zero photo becomes a room you stand inside */
  const DR = { x: 7.6, z: -8.6, r: 4.2 };
  const drWall = new T.Mesh(new T.CylinderGeometry(DR.r + 0.15, DR.r + 0.15, 6.1, 48, 1, true, Math.PI * 0.12, Math.PI * 1.76), M(0xf7f4ee, { roughness: 0.4, side: T.DoubleSide })); drWall.position.set(DR.x, 3.25, DR.z); drWall.rotation.y = Math.PI / 2 + Math.PI; g.add(drWall);
  const drNeon = new T.Mesh(new T.TorusGeometry(DR.r + 0.2, 0.05, 8, 64), glow(GOLD, 2)); drNeon.rotation.x = Math.PI / 2; drNeon.position.set(DR.x, 6.2, DR.z); g.add(drNeon);
  const drSign = makeSprite('🌀 360 DREAM ROOM · step inside', { scale: 3.6, accent: '#ffd23f' }); drSign.position.set(DR.x - DR.r - 0.4, 4.8, DR.z); g.add(drSign);
  const sphere = photoRoom(MOB ? '/images/net-zero-mansion-360-2048x1024.webp' : '/images/net-zero-mansion-360-4096x2048.webp', DR.r - 0.1, 1.55); sphere.position.set(DR.x, 0.26 + 1.55, DR.z); sphere.visible = false; g.add(sphere);
  // ring of wall around the dream room (doorway faces the lounge)
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.42) continue; app.addObstacle(X + DR.x + Math.cos(a) * (DR.r + 0.1), Z + DR.z + Math.sin(a) * (DR.r + 0.1), 0.55); }
  const dream = { on: false, prevDist: 5 };
  app.onUpdate(() => { const P = app.player.position; const inside = !app.level && Math.hypot(P.x - (X + DR.x), P.z - (Z + DR.z)) < DR.r - 0.8; if (inside !== dream.on) { dream.on = inside; sphere.visible = inside; if (inside) { dream.prevDist = app.targetDist; app.targetDist = 0.01; app.toast('🌀 You are standing inside Zach\'s net-zero dream home. Look around. Walk out the doorway to return.', 5200); } else { app.targetDist = Math.max(4, dream.prevDist || 5); } } });
  // living photo wall: the same photo as a giant window on the back wall
  const pwTex = new T.TextureLoader().load('/images/net-zero-mansion-360-2048x1024.webp', (t) => { t.colorSpace = T.SRGBColorSpace; t.repeat.set(0.34, 0.62); t.offset.set(0.33, 0.2); }); pwTex.wrapS = pwTex.wrapT = T.ClampToEdgeWrapping;
  const pw = plane(10.5, 5.4, new T.MeshBasicMaterial({ map: pwTex }), g); pw.position.set(1.5, 3.3, z2 - 0.45); pw.rotation.y = Math.PI; box(10.9, 5.8, 0.12, gold, 1.5, 3.3, z2 - 0.35, g);
  app.onUpdate(() => { const P = app.player.position; if (pwTex.image) pwTex.offset.x = 0.33 + THREE.MathUtils.clamp((P.x - (X + 1.5)) * 0.004, -0.05, 0.05); });
  app.addHotspot(pw, { title: '🖼️ The living photo wall', html: '<p>A window into the net-zero dream home. Walk past it and the view shifts with you. Step into the <b>360 Dream Room</b> to stand inside the whole photo.</p>' });

  /* 8) elevator: lobby ↔ office (L1) ↔ roof deck + infinity pool (L2) */
  const EL = { x: 11.2, z: 10.6 };
  cyl(1.35, 1.35, L2 + 1.4, M(0xcff6ff, { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, depthWrite: false }), EL.x, (L2 + 1.4) / 2, EL.z, g, 28).userData.noOcclude = true;
  for (const yy of [0.25, L1, L2 + 1.3]) { const rr = new T.Mesh(new T.TorusGeometry(1.38, 0.07, 8, 32), gold); rr.rotation.x = Math.PI / 2; rr.position.set(EL.x, yy, EL.z); g.add(rr); }
  const cab = new T.Group(); cab.position.set(EL.x, 0.25, EL.z); g.add(cab); cyl(1.15, 1.15, 0.12, gold, 0, 0, 0, cab, 24); cyl(1.15, 1.15, 0.08, gold, 0, 2.8, 0, cab, 24); 
  const elTag = makeSprite('🛗 Elevator', { scale: 2.4, accent: '#ffd23f' }); elTag.position.set(EL.x, 3.4, EL.z - 1.6); g.add(elTag);
  const FLOORS = [[0, '🏛️ Lobby + gallery', 0.25, -2, 6], [1, '💼 Office (business chats)', L1, 6, 2], [2, '🏊 Roof deck + infinity pool', L2, -4, 6]];
  const ride = (lv) => { const F = FLOORS[lv]; app.fade.classList.add('on'); app.fade.textContent = '🛗 ' + F[1]; const startY = cab.position.y; let k = 0; const f = (dt) => { k = Math.min(1, k + dt * 1.2); cab.position.y = startY + (F[2] - startY) * k; if (k >= 1) app.updaters = app.updaters.filter(q => q !== f); }; app.onUpdate(f);
    setTimeout(() => { app.level = lv; const px = X + F[3], pz = Z + F[4]; app.player.position.set(px, y0 + F[2], pz); setTimeout(() => app.fade.classList.remove('on'), 320); app.toast(lv === 1 ? '💼 The office. Tap the screen to open a business chat room.' : lv === 2 ? '🏊 Roof deck. The pool is real water: walk in and swim.' : '🏛️ Back in the lobby.', 3600); }, 420); };
  const elevator = () => app.popup('🛗 Elevator', '<p>Pick a floor.</p>', FLOORS.map(([lv, label]) => ({ label: (app.level === lv ? '● ' : '') + label, primary: app.level !== lv && lv === 1, fn: () => ride(lv) })));
  app.addHotspot(cab, { fn: elevator }); app.addInteractable(X + EL.x, Z + EL.z - 0.4, 2.6, '🛗 Elevator: office + roof', elevator);
  // decks you can stand on
  addDeck({ level: 1, y: y0 + L1, x1: X - 8.7, x2: X + x2 - 0.6, z1: Z + z1 + 0.6, z2: Z + z2 - 0.6 });
  addDeck({ level: 2, y: y0 + L2, x1: X + x1 + 0.6, x2: X + x2 - 0.6, z1: Z + z1 + 0.6, z2: Z + z2 - 0.6 });
  app.addPoly([[X - 8.7, Z + z1 + 0.6], [X + x2 - 0.6, Z + z1 + 0.6], [X + x2 - 0.6, Z + z2 - 0.6], [X - 8.7, Z + z2 - 0.6]], { keepIn: true, level: 1 });
  app.addPoly([[X + x1 + 0.6, Z + z1 + 0.6], [X + 1.4, Z + z1 + 0.6], [X + 1.4, Z + 6.6], [X + x2 - 0.6, Z + 6.6], [X + x2 - 0.6, Z + z2 - 0.6], [X + x1 + 0.6, Z + z2 - 0.6]], { keepIn: true, level: 2 });
  /* office (L1) */
  const off = new T.Group(); off.position.y = L1; g.add(off);
  box(4.4, 0.1, 2, M(0x2a1a10, { roughness: 0.5 }), 4, 1.05, -2, off); for (const sx of [-1.9, 1.9]) box(0.12, 1.0, 1.8, gold, 4 + sx, 0.5, -2, off);
  const confScr = new T.Group(); confScr.position.set(x2 - 0.4, 2.9, -2); confScr.rotation.y = -Math.PI / 2; off.add(confScr); box(7, 3.9, 0.15, dark, 0, 0, 0, confScr); const cs = plane(6.7, 3.6, new T.MeshBasicMaterial({ map: makeTVCard('💼 BUSINESS ROOM', 'tap to open a private chat room') }), confScr); cs.position.z = 0.09;
  const bizChat = () => { if (api.openRoom) api.openRoom('office-zach', '💼 Zach\'s office'); else if (api.openCollab) api.openCollab(); };
  app.addHotspot(confScr, { fn: bizChat }); app.addInteractable(X + 4, Z - 2, 3, '💼 Business chat room', bizChat);
  for (let i = 0; i < 6; i++) { const ch = new T.Group(); ch.position.set(1.6 + (i % 3) * 2.4, 0, i < 3 ? -4.6 : 0.6); off.add(ch); cyl(0.32, 0.32, 0.12, M(0x111827), 0, 0.55, 0, ch, 14); box(0.6, 0.6, 0.08, M(0x111827), 0, 0.9, i < 3 ? -0.28 : 0.28, ch); }
  hang(ART[5], 41, -2.5, L1 + 3, z1 + 0.4, 0); hang(ART[9], 42, -2.5, L1 + 3, z2 - 0.4, Math.PI);
  const offSign = makeSprite('💼 THE OFFICE · come in, let\'s talk', { scale: 3.6, accent: '#ffd23f' }); offSign.position.set(0, L1 + 4.6, 0); g.add(offSign);
  /* roof deck (L2): infinity pool you can swim in, telescope, garden + neon notice sign */
  const deck = new T.Group(); deck.position.y = L2; g.add(deck);
  const poolW = new T.Mesh(new T.PlaneGeometry(10.6, 8.8), waterMaterial(0x38c8f0, 0x0a5a8a)); poolW.rotation.x = -Math.PI / 2; poolW.position.set(-14.7, 0.75, 0); poolW.userData.noCollide = true; deck.add(poolW);
  for (const [w, d, ox, oz] of [[11, 0.3, 0, 4.55], [11, 0.3, 0, -4.55], [0.3, 9.4, 5.45, 0]]) box(w, 0.8, d, marble, -14.7 + ox, 0.4, oz, deck);
  app.addWater({ poly: [[X - 20, Z - 4.4], [X - 9.4, Z - 4.4], [X - 9.4, Z + 4.4], [X - 20, Z + 4.4]], y: y0 + L2 + 0.75, level: 2 });
  const tel = cyl(0.18, 0.28, 2.4, M(0x222831, { metalness: 0.6 }), -4, 1.6, -9, deck, 14); tel.rotation.z = -0.8; cyl(0.06, 0.08, 1.2, M(0x888888), -3.7, 0.6, -9, deck, 8);
  app.addHotspot(tel, { title: '🔭 Roof telescope', html: '<p>On a clear night you can find the Moon, Jupiter\'s four big moons and Saturn\'s rings with a small backyard telescope. Try the night sky (🌙) and look up.</p>', actions: [{ label: '🌙 Night sky', fn: () => api.setNight && api.setNight(true) }] });
  for (let i = 0; i < 8; i++) sph(0.45 + Math.random() * 0.35, M(0x3f7d2b, { roughness: 0.9 }), -8 + (i % 4) * 2.4, 0.45, 11.6, deck, 10);
  const notice = { text: 'WELCOME HOME · ALL OF US', color: '#ff4fd8' }; let noticeMesh = null;
  const drawNotice = () => { if (noticeMesh) g.remove(noticeMesh); noticeMesh = textPlane([notice.text], 14, 1.6, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', accent: notice.color, font: 'bold 120px Poppins, Arial', border: null, glow: true }); noticeMesh.rotation.y = -Math.PI / 2; noticeMesh.position.set(x1 - 0.3, L2 + 1.6, 0); g.add(noticeMesh); };
  drawNotice();
  learnSpot(app, g, '☀️ Roof garden + solar', 0, L2 + 2.2, 9, '<p>A planted roof cools the house below and holds rainwater. Solar glass on the skylight makes power while lighting the hall.</p>');
  learnSpot(app, g, '💧 The waterfalls recycle', x1 - 4, 4, -9.6, '<p>Both front waterfalls and the hall water walls run on one recirculating loop fed by roof rainwater. Pumps on solar power, the pools are the reservoir.</p>');

  /* 9) doors slide open as you approach; level resets when you travel */
  app.onUpdate((dt) => { const P = app.player.position; for (const [d, sx, sz] of doors) { const near = !app.level && Math.hypot(P.x - (X + sx), P.z - Z) < 4.2; const tgt = sz * (gap / 2 + (near ? gap * 0.9 : 0)); d.position.z += (tgt - d.position.z) * Math.min(1, dt * 5); } });
  
  /* 10) backyard rocket: walk up to the pad and it launches (fireworks at the top, back on the pad 30 s later) */
  const RK = { x: X + 32, z: Z - 4 }; const pad2 = new T.Group(); pad2.position.set(RK.x, terrainY(RK.x, RK.z) + 0.05, RK.z); S.add(pad2);
  cyl(3.2, 3.6, 0.5, M(0x9aa3ad, { metalness: 0.5, roughness: 0.5 }), 0, 0.25, 0, pad2, 32); const padRing = new T.Mesh(new T.RingGeometry(2.4, 2.7, 48), new T.MeshBasicMaterial({ color: 0xffd23f, side: T.DoubleSide })); padRing.rotation.x = -Math.PI / 2; padRing.position.y = 0.52; pad2.add(padRing);
  for (const a of [0, 2.1, 4.2]) { const tw = box(0.3, 9, 0.3, M(0xd1d5db, { metalness: 0.6 }), Math.cos(a) * 2.9, 4.5, Math.sin(a) * 2.9, pad2); tw.castShadow = true; }
  const rocket = new T.Group(); rocket.position.y = 0.5; pad2.add(rocket); const rw = M(0xf8fafc, { metalness: 0.3, roughness: 0.35 });
  cyl(0.8, 0.9, 6, rw, 0, 3.4, 0, rocket, 24).castShadow = true; const nose = new T.Mesh(new T.ConeGeometry(0.8, 2, 24), M(0xe11d48, { metalness: 0.3, roughness: 0.4 })); nose.position.y = 7.4; rocket.add(nose);
  for (let i = 0; i < 4; i++) { const f = box(0.12, 1.6, 1.2, M(0xe11d48), 0, 1.2, 0, rocket); f.rotation.y = i * Math.PI / 2; f.translateZ(0.95); }
  const win = new T.Mesh(new T.CircleGeometry(0.32, 20), new T.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.8, metalness: 0.6 })); win.position.set(0, 5, 0.86); rocket.add(win);
  const rLabel = textPlane(['ALL OF US · ONE'], 2.4, 0.5, { bg: 'rgba(0,0,0,0)', fg: '#1e3a8a', accent: '#1e3a8a', font: 'bold 90px Poppins, Arial', border: null }); rLabel.rotation.z = Math.PI / 2; rLabel.position.set(0.82, 3.4, 0); rLabel.rotation.y = Math.PI / 2; rocket.add(rLabel);
  const fireC = new T.Mesh(new T.ConeGeometry(0.75, 3.2, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); fireC.rotation.x = Math.PI; fireC.position.y = -1.3; fireC.visible = false; rocket.add(fireC);
  const smokeTex = (() => { const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const q2 = c2.getContext('2d'); const gr = q2.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q2.fillStyle = gr; q2.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c2); })();
  const puffs = []; for (let i = 0; i < (MOB ? 24 : 48); i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); sp.userData.noCollide = true; S.add(sp); puffs.push({ sp, life: 0 }); }
  const cdSprite = makeSprite('🚀 Walk onto the pad to launch', { scale: 4, accent: '#ffd23f' }); cdSprite.position.set(0, 11, 0); pad2.add(cdSprite);
  const RS = { phase: 'ready', k: 0, cool: 0, pi: 0 }; const BURST = ['#ff4f79', '#38f0ff', '#ffd23f', '#7cff6b', '#b08cff'];
  const burst = (pos) => { for (let i = 0; i < 40; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ color: new T.Color(BURST[i % 5]), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.scale.setScalar(1.6); sp.position.copy(pos); S.add(sp); const v = new T.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 8); let life = 0; const f = (dt) => { life += dt; v.y -= 6 * dt; sp.position.addScaledVector(v, dt); sp.material.opacity = Math.max(0, 1 - life / 2.2); if (life > 2.2) { S.remove(sp); sp.material.dispose(); app.updaters = app.updaters.filter(q => q !== f); } }; app.onUpdate(f); } };
  app.onUpdate((dt, t) => { const P = app.player.position; const d = Math.hypot(P.x - RK.x, P.z - RK.z); RS.cool -= dt;
    if (RS.phase === 'ready' && d < 7 && RS.cool <= 0 && !app.level) { RS.phase = 'count'; RS.k = 3.99; app.toast('🚀 Launch sequence started! Stand back…', 2400); }
    if (RS.phase === 'count') { RS.k -= dt; const n = Math.ceil(RS.k); if (cdSprite.userData.n !== n) { cdSprite.userData.n = n; pad2.remove(cdSprite.userData.s || cdSprite); const s2 = makeSprite(n > 0 ? '🚀 ' + n + '…' : '🚀 LIFTOFF!', { scale: 5, accent: n > 0 ? '#ffd23f' : '#ff4f79' }); s2.position.set(0, 11, 0); pad2.add(s2); cdSprite.userData.s = s2; cdSprite.visible = false; } if (RS.k <= 0) { RS.phase = 'fly'; RS.k = 0; fireC.visible = true; app.buzz && app.buzz(200); } }
    if (RS.phase === 'fly') { RS.k += dt; rocket.position.y = 0.5 + Math.pow(RS.k, 2.2) * 2.4; rocket.rotation.y += dt * 0.6; fireC.scale.y = 0.8 + Math.random() * 0.5;
      const pf = puffs[RS.pi++ % puffs.length]; pf.life = 0; pf.sp.position.set(RK.x + (Math.random() - 0.5), pad2.position.y + rocket.position.y - 1.6, RK.z + (Math.random() - 0.5)); pf.sp.scale.setScalar(1.5);
      if (rocket.position.y > 150) { burst(new T.Vector3(RK.x, pad2.position.y + 150, RK.z)); RS.phase = 'away'; RS.k = 0; fireC.visible = false; rocket.visible = false; app.toast('🎆 She made it! Back on the pad in 30 seconds.', 3200); } }
    if (RS.phase === 'away') { RS.k += dt; if (RS.k > 30) { RS.phase = 'ready'; RS.cool = 8; rocket.visible = true; rocket.position.y = 0.5; rocket.rotation.y = 0; if (cdSprite.userData.s) { pad2.remove(cdSprite.userData.s); cdSprite.userData.s = null; cdSprite.userData.n = null; } cdSprite.visible = true; } }
    for (const p of puffs) { if (p.sp.material.opacity <= 0 && p.life > 0.1) continue; p.life += dt; p.sp.material.opacity = Math.max(0, 0.75 - p.life * 0.35); p.sp.scale.setScalar(1.5 + p.life * 3); p.sp.position.y += dt * 0.6; } });
  app.addObstacle(RK.x, RK.z, 1.2);
  app.addPlace({ id: 'rocket', name: '🚀 Backyard rocket', icon: '🚀', x: RK.x - 9, z: RK.z + 4, cat: 'Fun', keys: 'rocket launch space backyard fireworks', say: 'Walk onto the pad and stand back.' });
  app.addPlace({ id: 'mansion', name: '🏛️ No. 1 Unity Road (Zach\'s)', icon: '🏛️', x: X + x1 - 9, z: Z, yaw: -Math.PI / 2, cat: 'Homes', keys: 'zach mansion house home founder waterfall gallery dream room 360 office elevator pool shag neon model home', say: 'No. 1 Unity Road. Walk right in: it is the allofus.one model home.' });
  app.addPlace({ id: 'dream-room', name: '🌀 360 Dream Room', icon: '🌀', x: X + DR.x - DR.r - 2, z: Z + DR.z, yaw: Math.PI / 2, cat: 'Fun', keys: '360 panorama photo dream room showroom illusion', say: 'Walk through the doorway and stand in the middle.' });
  try { mansionV4(app, W, api, g, X, Z, y0, { x1, x2, z1, z2, L1, L2 }); } catch (e) { console.error('mansion v4', e); }
  return { group: g, setNotice: (t, c) => { notice.text = String(t || '').slice(0, 40) || notice.text; if (c) notice.color = c; drawNotice(); }, notice, dream, setShag, neonState, applyNeon };
}
function makeTVCard(a, b) { const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1024, 576); gr.addColorStop(0, '#0b1033'); gr.addColorStop(1, '#3b0d4a'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 576); g.fillStyle = '#fff'; g.font = 'bold 64px Poppins, Arial'; g.textAlign = 'center'; g.fillText(a, 512, 270); g.fillStyle = '#38f0ff'; g.font = '600 40px Poppins, Arial'; g.fillText(b, 512, 340); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
function learnSpot(app, parent, label, x, y, z, html) { const s = makeSprite(label, { scale: 3.2, accent: '#7cff6b' }); s.position.set(x, y, z); parent.add(s); app.addHotspot(s, { title: label, html }); }

/* ============================================================
   8 SILK LANE · Steph's spider house
   ============================================================ */
export const SPIDERS = [
  ['Southern black widow', 'Latrodectus mactans', 'body about 1.3 cm (female)', 'Southeastern United States', 'The red hourglass is on the belly. Black widows are shy and bite only when pressed against skin.', 'widow'],
  ['Goliath birdeater', 'Theraphosa blondi', 'leg span up to about 28 cm', 'Rainforests of northern South America', 'The heaviest spider on Earth. Despite the name it mostly eats insects, worms and frogs.', 'tarantula'],
  ['Peacock spider', 'Maratus volans', 'about 5 mm', 'Australia', 'Males raise a rainbow fan and dance to win a mate. Tiny, harmless and famous online.', 'peacock'],
  ['Bold jumping spider', 'Phidippus audax', 'about 1 to 1.5 cm', 'North America', 'Sees in color and can jump many times its body length. Its fangs shine metallic green.', 'jumper'],
  ['Diving bell spider', 'Argyroneta aquatica', 'about 1 cm', 'Europe and northern Asia', 'The only spider that lives almost entirely underwater, inside a silk bubble of air it builds.', 'diver'],
  ['Yellow garden spider', 'Argiope aurantia', 'female body about 2 to 2.8 cm', 'North America', 'Weaves a bold zigzag (a stabilimentum) through the middle of its web.', 'argiope'],
  ['Golden silk orb-weaver', 'Trichonephila clavipes', 'female body about 2.5 to 4 cm', 'The Americas', 'Its silk shines gold in sunlight and its webs can stretch over a meter across.', 'golden'],
  ['Brown recluse', 'Loxosceles reclusa', 'about 6 to 20 mm', 'Central and southern United States', 'Has six eyes in three pairs and a violin shape on its back. Leave it alone and it leaves you alone.', 'recluse'],
  ['Carolina wolf spider', 'Hogna carolinensis', 'up to about 3.5 cm', 'North America', 'Moms carry their egg sac, then dozens of babies ride on their back.', 'wolf'],
  ['Mexican redknee tarantula', 'Brachypelma hamorii', 'leg span about 13 to 14 cm', 'Pacific coast of Mexico', 'Females can live 20 to 30 years. Gentle and slow, with bright orange knees.', 'redknee'],
  ['Darwin\'s bark spider', 'Caerostris darwini', 'female body about 2 cm', 'Madagascar', 'Spins one of the toughest biological materials known and webs that cross whole rivers.', 'bark'],
  ['Giant huntsman', 'Heteropoda maxima', 'leg span up to about 30 cm', 'Laos', 'Holds the record for the widest leg span of any spider. Fast, flat and shy.', 'huntsman'],
  ['Goldenrod crab spider', 'Misumena vatia', 'female about 1 cm', 'North America and Europe', 'Can slowly change color between white and yellow to match the flower it hunts on.', 'crab'],
  ['Ogre-faced spider', 'Deinopis spinosa', 'body about 2 cm', 'Southeastern United States', 'Huge eyes for night vision. It holds a silk net in its front legs and casts it over prey.', 'ogre'],
  ['Sydney funnel-web', 'Atrax robustus', 'about 1.5 to 3.5 cm', 'Eastern Australia', 'Dangerous, but an antivenom introduced in 1981 has made deaths from its bite a thing of the past.', 'funnel'],
  ['Mirror spider', 'Thwaitesia argentiopunctata', 'about 5 mm', 'Australia', 'Silver plates on its abdomen flash like a disco ball and can shrink when it is alarmed.', 'mirror'],
];
const SP_LOOK = { widow: [0x0b0b0b, 0x0b0b0b, 0.32, 'hour'], tarantula: [0x6b4a2b, 0x5a3a20, 0.95, 'hairy'], peacock: [0x2a2a2a, 0x1f8aff, 0.2, 'fan'], jumper: [0x111111, 0x111111, 0.26, 'dots'], diver: [0x5a4632, 0x8a8f99, 0.26, 'bubble'], argiope: [0x222222, 0xffd23f, 0.45, 'stripes'], golden: [0x3a2a10, 0xe0b030, 0.5, 'long'], recluse: [0x8a6a44, 0x9a7a54, 0.3, ''], wolf: [0x5a4632, 0x6b543c, 0.45, 'babies'], redknee: [0x1a1410, 0x241a14, 0.75, 'knees'], bark: [0x5a4a3a, 0x7a6a5a, 0.34, ''], huntsman: [0x8a6a44, 0x7a5a38, 0.85, 'long'], crab: [0xfff3a0, 0xfff7c8, 0.28, 'crab'], ogre: [0x7a5a3a, 0x6a4a2a, 0.36, 'eyes'], funnel: [0x161616, 0x161616, 0.45, ''], mirror: [0x6a7a6a, 0xd8e2ea, 0.24, 'mirror'] };
function makeSpider(kind, size = 1) {
  const L = SP_LOOK[kind] || SP_LOOK.widow; const g = new T.Group(); const s = L[2] * size; const bm = M(L[0], { roughness: kind === 'mirror' ? 0.1 : 0.7, metalness: kind === 'mirror' ? 0.9 : 0.05 }); const am = M(L[1], { roughness: kind === 'mirror' ? 0.05 : 0.6, metalness: kind === 'mirror' ? 1 : 0.05 });
  const ceph = sph(s * 0.45, bm, 0, s * 0.55, s * 0.35, g, 12); ceph.scale.set(1, 0.75, 1.1);
  const abd = sph(s * 0.62, am, 0, s * 0.62, -s * 0.55, g, 14); abd.scale.set(1, 0.85, 1.25);
  if (L[3] === 'hour') { const hg = new T.Mesh(new T.ConeGeometry(s * 0.12, s * 0.2, 3), glow(0xff1a1a, 1.4)); hg.position.set(0, s * 0.18, -s * 0.55); hg.rotation.x = Math.PI / 2; g.add(hg); const hg2 = hg.clone(); hg2.rotation.x = -Math.PI / 2; hg2.position.z = -s * 0.75; g.add(hg2); }
  if (L[3] === 'fan') { const fan = new T.Mesh(new T.CircleGeometry(s * 0.7, 20, 0, Math.PI), new T.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0x3355ff, emissiveIntensity: 0.6, side: T.DoubleSide })); fan.position.set(0, s * 0.9, -s * 0.7); fan.rotation.x = -0.4; g.add(fan); }
  if (L[3] === 'stripes') for (let i = 0; i < 3; i++) { const st = new T.Mesh(new T.TorusGeometry(s * 0.5 - i * s * 0.06, s * 0.04, 6, 18), M(0x111111)); st.rotation.y = Math.PI / 2; st.position.set(0, s * 0.62, -s * (0.35 + i * 0.2)); g.add(st); }
  if (L[3] === 'dots') for (const sx of [-1, 0, 1]) sph(s * 0.08, glow(0xffffff, 0.4), sx * s * 0.2, s * 1.02, -s * 0.6, g, 6);
  if (L[3] === 'knees') g.userData.knee = M(0xff6a1f);
  if (L[3] === 'eyes') for (const sx of [-1, 1]) sph(s * 0.14, glow(0x111111, 0.2), sx * s * 0.14, s * 0.62, s * 0.72, g, 8);
  if (L[3] === 'bubble') { const b = sph(s * 0.95, new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0, metalness: 0.5 }), 0, s * 0.6, 0, g, 14); b.userData.noCollide = true; }
  const legLen = (L[3] === 'long' ? 1.9 : L[3] === 'crab' ? 1.2 : 1.35) * s; const legM = bm; const legs = [];
  for (let i = 0; i < 8; i++) { const side = i < 4 ? 1 : -1; const k = i % 4; const root = new T.Group(); root.position.set(side * s * 0.32, s * 0.55, s * (0.55 - k * 0.22)); root.rotation.y = side * (Math.PI / 2 + (k - 1.5) * 0.45); g.add(root);
    const up = cyl(s * 0.06, s * 0.05, legLen * 0.6, legM, 0, 0, 0, root, 5); up.rotation.z = -side * 0; up.geometry.translate(0, legLen * 0.3, 0); up.rotation.x = 0; up.position.set(0, 0, 0); root.userData.up = up; up.rotation.z = 0;
    const thigh = new T.Group(); thigh.rotation.x = 0.9; root.add(thigh); thigh.add(up); const knee = new T.Group(); knee.position.y = legLen * 0.6; thigh.add(knee);
    const lo = cyl(s * 0.045, s * 0.02, legLen * 0.75, g.userData.knee && k < 3 ? g.userData.knee : legM, 0, 0, 0, knee, 5); lo.geometry.translate(0, legLen * 0.375, 0); knee.rotation.x = 2.1; legs.push([thigh, knee, i]); }
  g.userData.legs = legs; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function animSpider(sp, t, moving) { const legs = sp.userData.legs; for (const [th, kn, i] of legs) { const ph = t * 12 + (i % 2) * Math.PI + (i >> 2) * Math.PI * 0.5; th.rotation.x = 0.9 + (moving ? Math.sin(ph) * 0.25 : 0); kn.rotation.x = 2.1 + (moving ? Math.cos(ph) * 0.18 : 0); } }

export function buildSpiderHouse(app, W, api) {
  const S = app.scene; const { x: X, z: Z } = SPOTS.silk; const y0 = terrainY(X, Z) + 0.05; const g = new T.Group(); g.position.set(X, y0, Z); S.add(g); g.userData.noCollide = true;
  const char = M(0x1b1b1f, { roughness: 0.6, metalness: 0.2 }); const red = glow(0xc8102e, 0.9); const silk = new T.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.75 });
  const w = 16, d = 12, h = 7; const hw = w / 2, hd = d / 2; // front faces −z (toward the gate road)
  box(w + 2, 0.4, d + 2, M(0x2a2a30, { roughness: 0.9 }), 0, -0.05, 0, g);
  // walls (back + sides solid, front glass with a giant web), door at front center
  const solid = (W2, H2, D2, x, y, z) => { const m = box(W2, H2, D2, char, x, y, z, g); m.castShadow = true; app.addBox(X + x, Z + z, W2 / 2 + 0.2, D2 / 2 + 0.2); return m; };
  solid(w, h, 0.4, 0, h / 2, hd); solid(0.4, h, d, -hw, h / 2, 0); solid(0.4, h, d, hw, h / 2, 0);
  for (const sx of [-1, 1]) { const seg = box(hw - 1.5, h, 0.3, M(0x2a3040, { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.4 }), sx * (hw + 1.5) / 2, h / 2, -hd, g); seg.userData.noOcclude = true; app.addBox(X + sx * (hw + 1.5) / 2, Z - hd, (hw - 1.5) / 2 + 0.2, 0.4); }
  box(3, 1.2, 0.35, char, 0, h - 0.6, -hd, g); // over the door
  const door = box(2.9, h - 1.2, 0.12, M(0x0e0e12, { metalness: 0.6, roughness: 0.3 }), 0, (h - 1.2) / 2, -hd, g); const lockOb = app.addMovingObstacle(1.7); lockOb.x = X; lockOb.z = Z - hd;
  // angled roof + red ridge light
  const roof = new T.Mesh(new T.CylinderGeometry(0.01, hw * 1.25, 3.4, 4, 1), char); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, d / w); roof.position.y = h + 1.7; roof.castShadow = true; g.add(roof);
  box(w * 0.9, 0.06, 0.06, red, 0, h + 0.05, -hd - 0.05, g);
  // giant web across the front glass
  const web = new T.Group(); web.position.set(0, h * 0.55, -hd - 0.2); g.add(web); const R = 5.2; const spokes = 16; const pts = [];
  for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; pts.push(0, 0, 0, Math.cos(a) * R, Math.sin(a) * R * 0.62, 0); }
  for (let r = 0.6; r < R; r += 0.45) for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2, b = (i + 1) / spokes * Math.PI * 2; const rr = r + Math.sin(i * 1.7 + r) * 0.08; pts.push(Math.cos(a) * rr, Math.sin(a) * rr * 0.62, 0, Math.cos(b) * rr, Math.sin(b) * rr * 0.62, 0); }
  const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); web.add(new T.LineSegments(wg, silk));
  // the roof sculpture: a huge black widow with a glowing hourglass, legs moving
  const big = makeSpider('widow', 7); big.position.set(0, h + 0.6, 0.5); big.rotation.y = Math.PI; g.add(big);
  app.onUpdate((dt, t) => { animSpider(big, t * 0.25, true); big.position.y = h + 0.6 + Math.sin(t * 0.8) * 0.05; });
  // address + owner sign
  const sign = textPlane(['8 SILK LANE', 'Steph\'s place · spiders welcome 🕷️'], 5.2, 1.5, { bg: 'rgba(12,12,16,.94)', fg: '#ffffff', accent: '#ff1a3c', font: 'bold 74px Poppins, Arial' }); sign.position.set(-hw - 1.6, 2.4, -hd - 1.2); sign.rotation.y = 0.35; g.add(sign); for (const sx of [-2.2, 2.2]) cyl(0.08, 0.08, 2.4, char, -hw - 1.6 + sx * 0.94, 1.2, -hd - 1.2 + sx * 0.34, g, 6);
  // private door: fingerprint for the owner only
  const fpp = new T.Group(); fpp.position.set(2.2, 0, -hd - 1.1); g.add(fpp); cyl(0.28, 0.34, 1.1, char, 0, 0.55, 0, fpp, 14); const fpd = new T.Mesh(new T.CircleGeometry(0.2, 24), new T.MeshBasicMaterial({ color: 0xff1a3c })); fpd.rotation.x = -Math.PI / 2 + 0.5; fpd.position.y = 1.12; fpp.add(fpd);
  const tryDoor = () => { const owner = api.isOwner && api.isOwner('silk'); fpd.material.color.setHex(0x38f0ff); setTimeout(() => fpd.material.color.setHex(owner ? 0x7cff6b : 0xff1a3c), 900);
    const go = (bio) => { if (owner) { lockOb.off = true; door.visible = false; app.toast('🔓 Welcome home, Steph' + (bio ? ' (fingerprint verified)' : '') + ' 🕷️', 3600); } else app.toast('🔒 8 Silk Lane is a private home. The whole yard is a spider field guide: tap any spider to learn about it.', 4200); };
    if (owner && api.deviceUnlock) api.deviceUnlock('silk').then(go).catch(() => go(false)); else setTimeout(() => go(false), 900); };
  app.addHotspot(fpp, { fn: tryDoor }); app.addInteractable(X + 2.2, Z - hd - 1.1, 2.4, '👆 Steph\'s fingerprint door', tryDoor);
  // inside (owner only): her TV, terrariums, web hammock
  app.addScreen(X, y0 + 3, Z + hd - 0.4, Math.PI, 'pUeddYjckIo', { w: 6, h: 3.4, title: 'Steph\'s spider TV', accent: '#ff1a3c', radius: 3 });
  for (let i = 0; i < 3; i++) { const tx = -5 + i * 5; const tb = box(2.4, 1.4, 1.2, M(0xcff6ff, { transparent: true, opacity: 0.25, roughness: 0.05 }), tx, 1.5, hd - 1.6, g); tb.userData.noOcclude = true; box(2.5, 0.8, 1.3, char, tx, 0.4, hd - 1.6, g); const mini = makeSpider(['peacock', 'jumper', 'redknee'][i], 0.9); mini.position.set(tx, 0.85, hd - 1.6); g.add(mini); app.addHotspot(tb, { fn: () => spiderCard(app, SPIDERS.find(s => s[5] === ['peacock', 'jumper', 'redknee'][i])) }); }
  const ham = new T.Group(); ham.position.set(-4.5, 2.6, -1); g.add(ham); const hpts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; hpts.push(0, 0, 0, Math.cos(a) * 1.8, 0, Math.sin(a) * 1.2); } const hgeo = new T.BufferGeometry(); hgeo.setAttribute('position', new T.Float32BufferAttribute(hpts, 3)); ham.add(new T.LineSegments(hgeo, silk));

  /* the yard: 16 species roaming, on the walls and the roof. Tap any spider to learn. */
  const roam = []; const yardR = 15;
  SPIDERS.forEach((sp, i) => { const kind = sp[5]; const size = { tarantula: 1.25, redknee: 1.1, huntsman: 1.2, golden: 1.0, peacock: 1.4, mirror: 1.4 }[kind] || 1; const m = makeSpider(kind, size * 1.6); const a = i / SPIDERS.length * Math.PI * 2; const r = 12 + (i % 3) * 2; m.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r); g.add(m);
    const tag = makeSprite('🕷️ ' + sp[0], { scale: 2.6, accent: '#ff1a3c' }); tag.position.y = 2.2; tag.visible = false; m.add(tag); const st = { m, a, r, sp: 0.15 + (i % 4) * 0.05, dir: i % 2 ? 1 : -1, tag, pause: 0 };
    roam.push(st); app.addHotspot(m, { fn: () => spiderCard(app, sp) }); });
  // a few climbing the walls
  for (const [kind, x, y, z, ry] of [['golden', -hw - 0.25, 4.2, 2, -Math.PI / 2], ['argiope', hw + 0.25, 3.4, -2, Math.PI / 2], ['crab', 3, 5.2, hd + 0.25, 0], ['jumper', -3, 2.6, hd + 0.25, 0]]) { const m = makeSpider(kind, 1.6); m.position.set(x, y, z); m.rotation.set(-Math.PI / 2, 0, 0); const wrap = new T.Group(); wrap.rotation.y = ry; wrap.position.set(x, 0, z); m.position.set(0, y, 0); wrap.add(m); g.add(wrap); const sp = SPIDERS.find(s => s[5] === kind); app.addHotspot(m, { fn: () => spiderCard(app, sp) }); roam.push({ m, wall: true, y0: y, ph: Math.random() * 6 }); }
  app.onUpdate((dt, t) => { const P = app.player.position; for (const s of roam) { if (s.wall) { s.m.position.y = s.y0 + Math.sin(t * 0.4 + s.ph) * 0.8; animSpider(s.m, t, true); continue; } const near = Math.hypot(P.x - (X + s.m.position.x), P.z - (Z + s.m.position.z)) < 5; s.tag.visible = near; if (near) { animSpider(s.m, t, false); s.m.lookAt(P.x, y0 + 0.05, P.z); continue; } s.a += dt * s.sp * s.dir / s.r * 6; const nx = Math.cos(s.a) * s.r, nz = Math.sin(s.a) * s.r; s.m.lookAt(X + nx, y0 + 0.05, Z + nz); s.m.position.set(nx, 0.05, nz); animSpider(s.m, t, true); } });

  /* backyard: pool + a spider-shaped projector throwing her video onto a web screen */
  const pz = hd + 8; const pool = new T.Mesh(new T.PlaneGeometry(10, 5), waterMaterial(0x2fb3a3, 0x0b4f6e)); pool.rotation.x = -Math.PI / 2; pool.position.set(-2, 0.3, pz); pool.userData.noCollide = true; g.add(pool); for (const [ww, dd, ox, oz] of [[10.6, 0.3, 0, 2.65], [10.6, 0.3, 0, -2.65], [0.3, 5.6, 5.15, 0], [0.3, 5.6, -5.15, 0]]) box(ww, 0.5, dd, M(0x2a2a30), -2 + ox, 0.25, pz + oz, g); app.addBox(X - 2, Z + pz, 5.3, 2.8);
  const scr = new T.Group(); scr.position.set(8.5, 0, pz + 1); scr.rotation.y = -Math.PI / 2 - 0.3; g.add(scr); for (const sx of [-3.2, 3.2]) cyl(0.1, 0.1, 5, char, sx, 2.5, 0, scr, 6); const scrM = new T.MeshBasicMaterial({ color: 0xf2f2f2 }); const sc = plane(6, 3.4, scrM, scr); sc.position.set(0, 3, 0.05); const sw = new T.Group(); sw.position.set(0, 3, 0.07); scr.add(sw); const swp = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; swp.push(0, 0, 0, Math.cos(a) * 3, Math.sin(a) * 1.7, 0); } const swg = new T.BufferGeometry(); swg.setAttribute('position', new T.Float32BufferAttribute(swp, 3)); sw.add(new T.LineSegments(swg, new T.LineBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.35 })));
  const projector = makeSpider('widow', 3.2); projector.position.set(-3.5, 0.2, pz - 6); g.add(projector); const lens = sph(0.18, glow(0xffffff, 2), 0, 0.9, 0.9, projector, 10);
  g.updateMatrixWorld(true); projector.lookAt(X + scr.position.x, y0 + 0.2, Z + scr.position.z);
  const beamM = new T.MeshBasicMaterial({ color: 0xffe6f0, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false }); const beamG = new T.ConeGeometry(2.6, 12, 4, 1, true); beamG.rotateX(-Math.PI / 2); beamG.translate(0, 0, 6); const beam = new T.Mesh(beamG, beamM); beam.position.set(0, 0.9, 0.9); projector.add(beam); beam.userData.noCollide = true;
  app.onUpdate((dt, t) => { animSpider(projector, t * 0.3, false); beamM.opacity += ((api.isNight && api.isNight() ? 0.08 : 0.02) - beamM.opacity) * Math.min(1, dt * 2); scrM.color.setHSL(0, 0, 0.9 + Math.sin(t * 6) * 0.03); });
  const watch = () => app.video('pUeddYjckIo', '🕷️ Spider movie night at 8 Silk Lane', true); app.addHotspot(scr, { fn: watch }); app.addHotspot(projector, { fn: watch }); app.addInteractable(X + 4, Z + pz, 5, '🕷️ Spider movie night', watch);
  /* the field guide kiosk + donate */
  const kiosk = new T.Group(); kiosk.position.set(-9.5, 0, -hd - 3.5); kiosk.rotation.y = 0.5; g.add(kiosk); box(0.3, 3, 0.3, char, 0, 1.5, 0, kiosk); const kp = textPlane(['🕷️ SPIDER FIELD GUIDE', '16 species · quiz · how to help'], 4, 1.8, { bg: '#fff8f0', fg: '#1a1a1a', accent: '#c8102e', font: 'bold 64px Poppins, Arial' }); kp.position.set(0, 3, 0.2); kiosk.add(kp);
  const guide = () => spiderGuide(app); app.addHotspot(kiosk, { fn: guide }); app.addInteractable(X - 9.5, Z - hd - 3.5, 3, '🕷️ Spider field guide + quiz', guide);
  app.addPlace({ id: 'silk', name: '🕷️ 8 Silk Lane (Steph\'s)', icon: '🕷️', x: X - 4, z: Z - hd - 6, yaw: 0, cat: 'Homes', keys: 'steph spider spiders house black widow tarantula field guide learn science arachnid', say: '8 Silk Lane. Private inside, but the whole yard is a spider field guide. Tap any spider.' });
  return { group: g, unlock: () => { lockOb.off = true; door.visible = false; } };
}
export function spiderCard(app, sp) { if (!sp) return; app.popup('🕷️ ' + sp[0], `<p style="margin:0 0 6px"><i style="font-size:17px">${sp[1]}</i></p><p><b>Size:</b> ${sp[2]}<br><b>Lives in:</b> ${sp[3]}</p><p>${sp[4]}</p><p style="font-size:12.5px;color:#64748b">Admire spiders from a distance and never handle wild ones. Most spiders are harmless to people and great at eating pests.</p>`, [{ label: '🔎 Look it up', href: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(sp[1].replace(/ /g, '_')), newTab: true }, { label: '🕷️ Full field guide', fn: () => setTimeout(() => spiderGuide(app), 120) }]); }
export function spiderGuide(app) {
  const rows = SPIDERS.map(s => `<li><b>${s[0]}</b> · <i>${s[1]}</i><br><small>${s[2]} · ${s[3]}</small></li>`).join('');
  const qi = Math.floor(Math.random() * SPIDERS.length); const q = SPIDERS[qi]; const opts = [q, ...SPIDERS.filter(s => s !== q).sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5);
  app.popup('🕷️ Spider field guide', `<p><b>Quick quiz:</b> which spider is <i>${q[1]}</i>?</p><div id="sq" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${opts.map(o => `<button class="wvm-btn" data-a="${o === q ? 1 : 0}">${o[0]}</button>`).join('')}</div><ol style="padding-left:18px;max-height:42vh;overflow:auto">${rows}</ol><p><b>Help spiders and the people who study them:</b> the American Arachnological Society funds student research, and the Xerces Society protects invertebrates and their habitats.</p>`,
    [{ label: '❤️ Donate: American Arachnological Society', href: 'https://www.americanarachnology.org/society/donate/', newTab: true }, { label: '🦋 Xerces Society', href: 'https://xerces.org/', newTab: true }]);
  setTimeout(() => { const box2 = document.getElementById('sq'); if (!box2) return; box2.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === '1') { b.style.background = '#16a34a'; b.style.color = '#fff'; app.celebrate && app.celebrate('🕷️'); } else { b.style.background = '#e11d48'; b.style.color = '#fff'; } }; }, 50);
}

/* ============================================================
   COMIC LANE (Comics Come Alive) + the Worlds Globe kiosk
   ============================================================ */
function comicPanel(word, line, bg) { const c = document.createElement('canvas'); c.width = 768; c.height = 540; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 768, 540); g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 540; y += 14) for (let x = (y / 14 % 2) * 7; x < 768; x += 14) { g.beginPath(); g.arc(x, y, 3, 0, 6.28); g.fill(); }
  g.save(); g.translate(384, 230); g.fillStyle = '#ffd23f'; g.strokeStyle = '#111'; g.lineWidth = 8; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 150 : 230; g.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.8); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#e11d48'; g.font = 'bold 120px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeText(word, 0, 0); g.fillText(word, 0, 0); g.restore();
  g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.roundRect(40, 420, 688, 90, 24); g.fill(); g.stroke(); g.fillStyle = '#111'; g.font = 'bold 38px Comic Sans MS, Comic Neue, Arial'; g.textAlign = 'center'; g.fillText(line, 384, 478); g.strokeStyle = '#111'; g.lineWidth = 14; g.strokeRect(7, 7, 754, 526);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
export function buildComicLane(app, W, api) {
  const S = app.scene; const { x: X, z: Z } = SPOTS.comics; const y0 = terrainY(X, Z) + 0.05; const g = new T.Group(); g.position.set(X, y0, Z); S.add(g); g.userData.noCollide = true;
  const panels = [['KAPOW!', 'Captain Kapow says: be kind today!', '#38b6ff', 'https://comicscomealive.com/animated-comics/'], ['KABLAM!', 'Daily Funnies: five strips, fresh ink', '#ff8a3d', 'https://comicscomealive.com/newspaper-comics/'], ['ZOOM!', 'Fly the VR comics: 27 paths to the moon', '#7cff6b', 'https://comicscomealive.com/vr-comics/'], ['BOOM!', 'Make your own 3-panel comic', '#ff4fd8', 'https://comicscomealive.com/make-your-own-comic/']];
  panels.forEach(([word, line, bg, url], i) => { const a = -0.9 + i * 0.6; const p = new T.Group(); p.position.set(Math.sin(a) * 9, 0, Math.cos(a) * 9); p.rotation.y = a + Math.PI; g.add(p); for (const sx of [-2.6, 2.6]) cyl(0.12, 0.12, 4, M(0x111111), sx, 2, 0, p, 6); const m = plane(5.6, 3.9, new T.MeshBasicMaterial({ map: comicPanel(word, line, bg) }), p); m.position.set(0, 3.6, 0.05); box(5.9, 4.2, 0.08, M(0x111111), 0, 3.6, -0.02, p);
    app.addHotspot(p, { title: '💥 ' + word + ' · Comics Come Alive', html: '<p>' + line + '. Free, family-friendly and original, from comicscomealive.com.</p>', actions: [{ label: '📖 Open it', href: url, newTab: true }] }); });
  // big billboard with the real Comics Come Alive art
  const bb = new T.Group(); bb.position.set(0, 0, -11); g.add(bb); for (const sx of [-4.6, 4.6]) cyl(0.18, 0.18, 7, M(0x111111), sx, 3.5, 0, bb, 8); const bm = new T.MeshBasicMaterial({ color: 0xffffff }); new T.TextureLoader().load('/images/comics-come-alive-billboard.webp', (t) => { t.colorSpace = T.SRGBColorSpace; bm.map = t; bm.needsUpdate = true; }); const bp = plane(9.6, 5.04, bm, bb); bp.position.set(0, 5, 0.06); box(9.9, 5.3, 0.1, M(0xffd23f), 0, 5, -0.02, bb);
  app.addHotspot(bb, { title: '📚 Comics Come Alive', html: '<p>Animated comics, Sunday funnies, bedtime stories, a 3D princess castle, Kapow\'s Dojo and a comic maker. Free for families, no account needed.</p>', actions: [{ label: '🦸 Visit comicscomealive.com', href: 'https://comicscomealive.com/', newTab: true }] });
  // Captain Kapow himself, cape flapping
  const kap = makePerson({ age: 'adult', shirt: 0x2f6bff, pants: 0xe11d48, hair: 0x1a1a1a, skin: 0xe0ac7e, hairStyle: 'spiky' }); kap.position.set(0, 0, -2); g.add(kap); const cape = new T.Mesh(new T.PlaneGeometry(1, 1.4, 4, 6), M(0xe11d48, { side: T.DoubleSide })); cape.position.set(0, 1.35, -0.32); kap.add(cape); kap.scale.setScalar(1.6);
  const ktag = makeSprite('🦸 Captain Kapow · tap me', { scale: 3, accent: '#ffd23f' }); ktag.position.set(0, 4.2, -2); g.add(ktag);
  app.onUpdate((dt, t) => { cape.rotation.x = 0.25 + Math.sin(t * 3) * 0.12; kap.rotation.y = Math.sin(t * 0.5) * 0.4; });
  const kapow = () => { app.celebrate && app.celebrate('💥'); app.popup('🦸 Captain Kapow', '<p>“Every hero starts by being kind to one person. KAPOW!”</p>', [{ label: '🦸 Meet the whole crew', href: 'https://comicscomealive.com/', newTab: true }, { label: '🌙 Bedtime stories', href: 'https://comicscomealive.com/bedtime-stories/', newTab: true }]); };
  app.addHotspot(kap, { fn: kapow }); app.addInteractable(X, Z - 2, 3, '🦸 Captain Kapow', kapow); app.addObstacle(X, Z - 2, 0.9);
  const arch = new T.Group(); arch.position.set(0, 0, 9.5); g.add(arch); const words = ['C', 'O', 'M', 'I', 'C', ' ', 'L', 'A', 'N', 'E']; const archT = textPlane(['💥 COMIC LANE 💥'], 9, 1.4, { bg: '#ffd23f', fg: '#111', accent: '#e11d48', font: 'bold 120px Impact, Arial Black, sans-serif' }); archT.position.y = 5.6; archT.rotation.y = Math.PI; arch.add(archT); for (const sx of [-4.6, 4.6]) cyl(0.25, 0.25, 6, M(0xe11d48), sx, 3, 0, arch, 10);
  app.addPlace({ id: 'comics', name: '💥 Comic Lane', icon: '💥', x: X, z: Z + 12, yaw: Math.PI, cat: 'Fun', keys: 'comics comic lane captain kapow cartoons kids family comicscomealive funnies', say: 'Comic Lane. Tap any panel to jump into Comics Come Alive.' });
}
export function buildWorldsKiosk(app, W, api) {
  const S = app.scene; const { x: X, z: Z } = SPOTS.worlds; const g = new T.Group(); g.position.set(X, terrainY(X, Z) + 0.05, Z); S.add(g);
  cyl(1.6, 1.9, 0.6, M(0x111827, { metalness: 0.6, roughness: 0.3 }), 0, 0.3, 0, g, 32); const ring = new T.Mesh(new T.TorusGeometry(1.75, 0.05, 8, 64), glow(NEON, 2)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.62; g.add(ring);
  const earth = makeEarth(1.3, { clouds: false }); earth.position.y = 2.6; g.add(earth); const orbit = new T.Group(); orbit.position.y = 2.6; g.add(orbit);
  const cols = [0x38f0ff, 0xff4f79, 0xffd23f, 0x7cff6b, 0xb08cff, 0xff8a3d, 0xffffff]; for (let i = 0; i < 7; i++) { const s = sph(0.12, glow(cols[i], 2), 0, 0, 0, orbit, 8); s.userData.a = i / 7 * Math.PI * 2; s.userData.tilt = (i % 3 - 1) * 0.5; }
  const tag = makeSprite('🌐 ALL OUR WORLDS · tap to travel', { scale: 3.6, accent: '#38f0ff' }); tag.position.y = 4.6; g.add(tag);
  app.onUpdate((dt, t) => { earth.rotation.y += dt * 0.3; orbit.children.forEach((s, i) => { const a = s.userData.a + t * (0.5 + i * 0.05); s.position.set(Math.cos(a) * 2, Math.sin(a * 1.3) * 0.6 + s.userData.tilt, Math.sin(a) * 2); }); });
  const open = () => api.openWorlds && api.openWorlds(); app.addHotspot(g, { fn: open }); app.addInteractable(X, Z, 3.4, '🌐 All our worlds: travel', open); app.addObstacle(X, Z, 1.9);
  app.addPlace({ id: 'worlds', name: '🌐 Worlds Globe', icon: '🌐', x: X - 3, z: Z + 3, cat: 'Places', keys: 'worlds portal directory mall comics vr galaxy flight adventure dimension travel', say: 'The Worlds Globe. Spin it and jump to any of our worlds.' });
}

/* boot: called from index after the world is built */
export function buildEstates(app, W, api) {
  // upper floors: the hill/slope checks only apply on the ground
  const engineBlocked = WVM.prototype._blocked; const worldBlocked = app._blocked; app._blocked = (x, z) => app.level ? engineBlocked.call(app, x, z) : worldBlocked(x, z);
  const travel0 = app.travel.bind(app); app.travel = (pl, mode) => { if (app.level) app.level = 0; return travel0(pl, mode); };
  const out = {};
  try { out.mansion = buildMansion(app, W, api, W.house, 44, 105); } catch (e) { console.error('mansion', e); }
  try { out.silk = buildSpiderHouse(app, W, api); } catch (e) { console.error('silk', e); }
  try { buildComicLane(app, W, api); } catch (e) { console.error('comics', e); }
  try { buildWorldsKiosk(app, W, api); } catch (e) { console.error('worlds', e); }
  try { out.coburn = buildCoburn(app, W, api); } catch (e) { console.error('coburn', e); }
  try { out.conf = buildConference(app, W, api); W.confScreen = out.conf; } catch (e) { console.error('conference', e); }
  return out;
}

/* ============================================================
   v4 · No. 1 Unity Road grows: orchid rotunda, sky wing,
   slate + solar gable, living flower beds, hummingbirds
   ============================================================ */
function slateMat(rx, ry) { const t = TEX.slate().clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new T.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 }); }
function mansionV4(app, W, api, g, X, Z, y0, F) {
  const { x1, x2, z1, z2, L1, L2 } = F; const white = M(0xf4f1ea, { roughness: 0.55 }); const gold = M(0xc9a24a, { metalness: 0.85, roughness: 0.25 });
  /* slate gable roof with solar on the south slope, over the east wing */
  const rw = x2 - 1.6, rd = 6.6 - z1; const rcx = (1.6 + x2) / 2, rcz = (z1 + 6.6) / 2; const rh = 4.2; const sm = slateMat(rw / 2.2, rd / 2.2);
  for (const sx of [-1, 1]) { const len = Math.hypot(rw / 2, rh); const p = box(len + 0.4, 0.22, rd + 0.8, sx > 0 ? sm : sm, rcx + sx * rw / 4, L2 + rh / 2, rcz, g); p.rotation.z = -sx * Math.atan2(rh, rw / 2); p.castShadow = true; }
  for (const sz of [-1, 1]) { const sh = new T.Shape(); sh.moveTo(-rw / 2, 0); sh.lineTo(rw / 2, 0); sh.lineTo(0, rh); sh.closePath(); const tri = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshStandardMaterial({ color: 0xf4f1ea, side: T.DoubleSide })); tri.position.set(rcx, L2, rcz + sz * rd / 2); g.add(tri); }
  box(0.3, 0.3, rd + 1, gold, rcx, L2 + rh + 0.12, rcz, g);
  const sol = new T.MeshStandardMaterial({ map: TEX.solar(), metalness: 0.6, roughness: 0.2 }); const ang = Math.atan2(rh, rw / 2);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { const pnl = box(1.7, 0.06, 2.4, sol, 0, 0, 0, g); const along = 0.9 + r * 2; pnl.position.set(rcx - rw / 2 + 0.6 + Math.cos(ang) * along, L2 + 0.25 + Math.sin(ang) * along, rcz - rd / 2 + 1.8 + c * 2.9); pnl.rotation.z = ang; }
  learnSpot(app, g, '🪨 Slate + solar roof', rcx, L2 + rh + 2.2, rcz, '<p>Natural slate can last more than 100 years, sheds snow and never needs paint. The south slope carries solar panels; together they make the roof a power plant that outlives the house.</p>');
  /* sky wing: a glass lounge cantilevered out over the backyard at an angle */
  const sky = new T.Group(); sky.position.set(x2 + 5, L2 + 2.3, -1.5); sky.rotation.y = -0.38; g.add(sky);
  box(17, 0.5, 7.4, white, 0, -2.2, 0, sky).castShadow = true; box(17, 0.4, 7.4, white, 0, 2.3, 0, sky).castShadow = true;
  const sg = box(16.6, 4.2, 7, M(0xbfefff, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.3 }), 0, 0, 0, sky); sg.userData.noOcclude = true;
  for (const sx of [-8.3, 0, 8.3]) for (const sz of [-3.5, 3.5]) box(0.25, 4.4, 0.25, gold, sx, 0, sz, sky);
  const glowStrip = box(17, 0.08, 0.08, glow(NEON, 2), 0, -2.5, 3.7, sky); const glowStrip2 = box(17, 0.08, 0.08, glow(NEON, 2), 0, -2.5, -3.7, sky);
  for (const sz of [-2.6, 2.6]) { const leg = cyl(0.3, 0.42, L2 + 2, white, 0, 0, 0, g, 12); leg.position.set(x2 + 11.5, (L2 + 2) / 2 - 1, -4.6 + sz); leg.rotation.z = 0.16; leg.castShadow = true; }
  const skyTag = makeSprite('🛋️ The sky lounge', { scale: 3, accent: '#38f0ff' }); skyTag.position.set(x2 + 5, L2 + 6, -1.5); g.add(skyTag);
  app.addHotspot(sky, { title: '🛋️ The sky lounge', html: '<p>A glass room cantilevered out over the backyard at an angle, so the house turns toward the sunset and the lake. Steel trusses inside the floor carry it with no posts underneath the far end.</p>' });
  /* the orchid rotunda: a glass conservatory with a slate cone roof, giant flowers and hummingbirds */
  const ro = { x: -17, z: z2 + 4.8, r: 4.6, h: 9 }; const rt = new T.Group(); rt.position.set(ro.x, 0, ro.z); g.add(rt);
  cyl(ro.r + 0.4, ro.r + 0.5, 0.4, M(0xd9d2c5, { roughness: 0.8 }), 0, 0.2, 0, rt, 40);
  const panes = new T.Mesh(new T.CylinderGeometry(ro.r, ro.r, ro.h, 40, 1, true, Math.PI * 0.16, Math.PI * 1.68), M(0xcff6ff, { transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0.3, side: T.DoubleSide, depthWrite: false })); panes.position.y = ro.h / 2 + 0.4; panes.rotation.y = -Math.PI / 2; panes.userData.noOcclude = true; rt.add(panes);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.5) continue; const mul = cyl(0.09, 0.09, ro.h, gold, Math.cos(a) * ro.r, ro.h / 2 + 0.4, Math.sin(a) * ro.r, rt, 6); app.addObstacle(X + ro.x + Math.cos(a) * ro.r, Z + ro.z + Math.sin(a) * ro.r, 0.75); }
  const cone = new T.Mesh(new T.ConeGeometry(ro.r + 0.7, 4.2, 40, 1), slateMat(10, 3)); cone.position.y = ro.h + 0.4 + 2.1; cone.castShadow = true; rt.add(cone); const fin = new T.Mesh(new T.SphereGeometry(0.4, 16, 12), new T.MeshStandardMaterial({ color: 0x6fb39b, metalness: 0.7, roughness: 0.3 })); fin.position.y = ro.h + 4.8; rt.add(fin);
  const bed = new T.Mesh(new T.TorusGeometry(ro.r - 1.2, 0.5, 8, 40), M(0x5a3a22, { roughness: 1 })); bed.rotation.x = Math.PI / 2; bed.position.y = 0.6; rt.add(bed);
  const rlist = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.45) continue; const k = ['orchid', 'orchid', 'paradise', 'columbine'][i % 4]; rlist.push([k, Math.cos(a) * (ro.r - 1.2), Math.sin(a) * (ro.r - 1.2), k === 'columbine' ? 3.2 : k === 'orchid' ? 2.6 : 2.2, 0.8]); }
  rlist.push(['columbine', 0, 0, 4.4, 0.4]); plantGarden(app, rt, rlist, { birds: 3, range: 90, wind: 0.4 });
  const rTag = makeSprite('🌸 Orchid rotunda · walk in', { scale: 3.2, accent: '#ff6fb5' }); rTag.position.set(0, ro.h + 6.4, 0); rt.add(rTag);
  app.addPlace({ id: 'rotunda', name: '🌸 Orchid rotunda', icon: '🌸', x: X + ro.x - ro.r - 3, z: Z + ro.z, yaw: Math.PI / 2, cat: 'Fun', keys: 'flowers orchid columbine garden hummingbird conservatory', say: 'Giant flowers that grow while you watch, and hummingbirds. Tap any of them.' });
  /* living flower beds out front: giant Colorado columbines along the walk, hummingbirds included */
  for (const sz of [-1, 1]) { const fb = new T.Group(); fb.position.set(x1 - 10.5, 0.2, sz * 6.5); g.add(fb); box(2.4, 0.4, 7.5, M(0x5a3a22, { roughness: 1 }), 0, 0.2, 0, fb); const L = []; for (let i = 0; i < 7; i++) L.push([['columbine', 'allium', 'columbine', 'lupine', 'columbine', 'tulip', 'sunflower'][i], (i % 2 - 0.5) * 0.9, -3.2 + i * 1.05, [3.4, 2.4, 2.8, 1.8, 3.8, 1.4, 1.6][i], 0.4]); plantGarden(app, fb, L, { birds: sz > 0 ? 2 : 1, range: 110 }); app.addBox(X + x1 - 10.5, Z + sz * 6.5, 1.3, 3.9); }
  /* roof garden flowers */
  const rg = new T.Group(); rg.position.set(-6, L2 + 0.25, 10.8); g.add(rg); plantGarden(app, rg, [['sunflower', -3, 0, 1.2], ['lupine', -1.5, 0.4, 1.4], ['tulip', 0, -0.2, 1.4], ['columbine', 1.5, 0.3, 1.8], ['allium', 3, 0, 1.4]], { birds: 1, range: 60 });
}

/* ============================================================
   COBURN'S MOUNTAIN · ski lift, ski run game, summit mansion,
   seasons switch (winter snow ↔ summer green)
   ============================================================ */
export function buildCoburn(app, W, api) {
  const S = app.scene; const TOP = { x: MTN.x, z: MTN.z }; const base = { x: MTN.x + 16, z: MTN.z - 108 }, top = { x: MTN.x + 16, z: MTN.z - 26 };
  const ty = (x, z) => terrainY(x, z);
  /* summit mansion */
  const g = new T.Group(); const gy = ty(TOP.x, TOP.z) + 0.05; g.position.set(TOP.x, gy, TOP.z); S.add(g); g.userData.noCollide = true;
  const wood = new T.MeshStandardMaterial({ map: (() => { const t = TEX.wood().clone(); t.needsUpdate = true; t.repeat.set(6, 2); return t; })(), roughness: 0.7 }); const stone = new T.MeshStandardMaterial({ map: (() => { const t = TEX.stone().clone(); t.needsUpdate = true; t.repeat.set(4, 2); return t; })() }); const gls = M(0xcff6ff, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.3 }); const dark = M(0x1d2433, { metalness: 0.5, roughness: 0.3 });
  const vol = (w, h, d, x, y, z, m) => { const b = box(w, h, d, m, x, y, z, g); b.castShadow = true; b.receiveShadow = true; return b; };
  vol(28, 5, 14, 0, 2.5, 4, stone); app.addBox(TOP.x, TOP.z + 4, 14.3, 7.3);
  const up = vol(22, 4.6, 12, 4, 7.3, 1, wood); const glsUp = box(22.2, 3.4, 12.2, gls, 4, 7.3, 1, g); glsUp.userData.noOcclude = true;
  vol(14, 4, 10, -6, 11.6, 3, gls).userData.noOcclude = true; box(15, 0.4, 11, dark, -6, 13.8, 3, g);
  box(30, 0.5, 16, dark, 0, 9.85, 3, g); box(24, 0.5, 14, dark, 4, 0.2, -8, g);
  for (let i = 0; i < 6; i++) box(0.12, 4, 0.12, M(0xffd23f, { metalness: 0.8 }), -11 + i * 4.4, 7.3, -5, g);
  const cSign = textPlane(['COBURN\'S PLACE', '1 Summit Way'], 9, 2, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', accent: '#38f0ff', font: 'bold 110px Poppins, Arial', border: null, glow: true }); cSign.position.set(0, 10.8, -5.3); cSign.rotation.y = Math.PI; g.add(cSign);
  // the big rectangular pool, real water, with a coin dive game
  const pool = { x: 0, z: -16, w: 22, d: 8 }; const pw = new T.Mesh(new T.PlaneGeometry(pool.w, pool.d), waterMaterial(0x38c8f0, 0x0a4a7a)); pw.rotation.x = -Math.PI / 2; pw.position.set(pool.x, 0.55, pool.z); pw.userData.noCollide = true; g.add(pw);
  for (const [w, d, ox, oz] of [[pool.w + 1, 0.5, 0, pool.d / 2 + 0.25], [pool.w + 1, 0.5, 0, -pool.d / 2 - 0.25], [0.5, pool.d, pool.w / 2 + 0.25, 0], [0.5, pool.d, -pool.w / 2 - 0.25, 0]]) box(w, 0.45, d, stone, pool.x + ox, 0.22, pool.z + oz, g);
  app.addWater({ poly: [[TOP.x - pool.w / 2, TOP.z + pool.z - pool.d / 2], [TOP.x + pool.w / 2, TOP.z + pool.z - pool.d / 2], [TOP.x + pool.w / 2, TOP.z + pool.z + pool.d / 2], [TOP.x - pool.w / 2, TOP.z + pool.z + pool.d / 2]], y: gy + 0.55 });
  const coins = []; const coinM = new T.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.9, roughness: 0.2, emissive: 0x332200 }); for (let i = 0; i < 12; i++) { const c = new T.Mesh(new T.TorusGeometry(0.35, 0.09, 8, 20), coinM); c.position.set(pool.x - pool.w / 2 + 1.5 + (i % 6) * 3.6, 0.6, pool.z - 2 + Math.floor(i / 6) * 4); g.add(c); coins.push(c); }
  let got = 0; app.onUpdate((dt, t) => { const P = app.player.position; for (const c of coins) { if (!c.visible) continue; c.rotation.y += dt * 2; c.position.y = 0.6 + Math.sin(t * 2 + c.position.x) * 0.1; if (Math.hypot(P.x - (TOP.x + c.position.x), P.z - (TOP.z + c.position.z)) < 1.1) { c.visible = false; got++; app.buzz && app.buzz(30); app.toast('🪙 ' + got + ' / ' + coins.length + ' pool coins'); if (got === coins.length) { app.celebrate && app.celebrate('🏆'); app.toast('🏆 All 12 pool coins! They respawn in 30 seconds.', 4000); setTimeout(() => { got = 0; coins.forEach(q => q.visible = true); }, 30000); } } } });
  const tv = app.addScreen(TOP.x + 4, gy + 7.3, TOP.z - 5.15, Math.PI, 'fAJfDP3b5_U', { w: 10, h: 3, title: 'Coburn\'s big screen', accent: '#38f0ff', radius: 8 });
  const games = () => app.popup('🎮 Coburn\'s game wall', '<p>Pick a game. Every one of these is a real world you can play in your browser.</p>', [{ label: '🧭 Virtual Reality Adventure', href: 'https://virtualrealityadventure.com/', newTab: true }, { label: '✈️ VR Flying Simulator', href: 'https://vrflyingsimulator.com/', newTab: true }, { label: '🪐 The VR Galaxy', href: 'https://thevrgalaxy.com/', newTab: true }, { label: '🌀 Another Dimension VR', href: 'https://anotherdimensionvr.com/', newTab: true }, { label: '💥 Comics Come Alive', href: 'https://comicscomealive.com/', newTab: true }]);
  const gw = new T.Group(); gw.position.set(-10, 1.6, -3.1); g.add(gw); box(4, 2.4, 0.2, dark, 0, 0, 0, gw); const gwt = textPlane(['🎮 GAME WALL', 'tap to play'], 3.8, 2.2, { bg: '#0b1033', fg: '#fff', accent: '#ff4fd8', font: 'bold 80px Poppins, Arial' }); gwt.position.z = -0.12; gwt.rotation.y = Math.PI; gw.add(gwt); app.addHotspot(gw, { fn: games }); app.addInteractable(TOP.x - 10, TOP.z - 4.5, 3, '🎮 Coburn\'s game wall', games);
  /* seasons */
  const run = { mesh: null }; const snowM = new T.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.6 }); const grassM = new T.MeshStandardMaterial({ color: 0x5f9e3a, roughness: 0.95 });
  const setSeason = (sz) => { STATE.season = sz; try { for (let dx = -120; dx <= 120; dx += 60) for (let dz = -120; dz <= 120; dz += 60) W.chunks.rebuildAt(MTN.x + dx, MTN.z + dz); } catch (e) { } if (run.mesh) run.mesh.material = sz === 'summer' ? grassM : snowM; app.toast(sz === 'summer' ? '☀️ Summer on the mountain: the run turns into a grass slide.' : '❄️ Winter on the mountain: fresh powder!', 3600); };
  const seasonKiosk = (x, z) => { const k = new T.Group(); k.position.set(x, ty(x, z), z); S.add(k); box(0.25, 2.6, 0.25, dark, 0, 1.3, 0, k); const t = makeSprite('❄️ / ☀️ Seasons', { scale: 2.6, accent: '#ffffff' }); t.position.y = 3; k.add(t); const f = () => setSeason(STATE.season === 'summer' ? 'winter' : 'summer'); app.addHotspot(k, { fn: f }); app.addInteractable(x, z, 2.6, '❄️ Switch season (winter ↔ summer)', f); };
  seasonKiosk(TOP.x - 14, TOP.z - 22); seasonKiosk(base.x - 8, base.z + 2);
  /* ski run */
  const pts = [[top.x - 8, top.z - 4], [top.x - 24, top.z - 18], [top.x - 4, top.z - 36], [top.x - 26, top.z - 54], [top.x - 6, top.z - 70], [base.x - 10, base.z + 6]].map(([x, z]) => new T.Vector3(x, 0, z));
  const curve = new T.CatmullRomCurve3(pts); const N = 220; const half = 7; const pos = []; const uv = []; const idx = [];
  for (let i = 0; i <= N; i++) { const k = i / N; const p = curve.getPointAt(k); const tg = curve.getTangentAt(k); const nx = -tg.z, nz = tg.x; for (const sd of [-1, 1]) { const x = p.x + nx * half * sd, z = p.z + nz * half * sd; pos.push(x, ty(x, z) + 0.12, z); uv.push(sd > 0 ? 1 : 0, k * 20); } if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals(); run.mesh = new T.Mesh(rg, STATE.season === 'summer' ? grassM : snowM); run.mesh.receiveShadow = true; run.mesh.userData.noCollide = true; S.add(run.mesh);
  const gates = []; for (let i = 1; i <= 9; i++) { const k = i / 10.5; const p = curve.getPointAt(k), tg = curve.getTangentAt(k); const nx = -tg.z, nz = tg.x; const off = (i % 2 ? 1 : -1) * 2.6; const col = i % 2 ? 0xe11d48 : 0x2563eb; const gx = p.x + nx * off, gz = p.z + nz * off; for (const sd of [-1.6, 1.6]) { const pole = cyl(0.06, 0.06, 1.8, glow(col, 0.6), gx + nx * sd, ty(gx + nx * sd, gz + nz * sd) + 0.9, gz + nz * sd, S, 6); pole.userData.noCollide = true; } gates.push({ k, off, hit: false }); }
  for (let i = 0; i < 46; i++) { const k = (i + 0.5) / 46; const p = curve.getPointAt(k), tg = curve.getTangentAt(k); const nx = -tg.z, nz = tg.x; const sd = (i % 2 ? 1 : -1) * (half + 2 + (i % 3) * 1.5); const x = p.x + nx * sd, z = p.z + nz * sd; const tr = new T.Mesh(new T.ConeGeometry(1.3, 4.5, 8), M(0x1f5c3a, { roughness: 0.9 })); tr.position.set(x, ty(x, z) + 2.3, z); tr.userData.noCollide = true; S.add(tr); }
  const sCoins = []; for (let i = 0; i < 24; i++) { const k = 0.04 + i / 25; const p = curve.getPointAt(k), tg = curve.getTangentAt(k); const off = Math.sin(i * 0.9) * 4; const x = p.x - tg.z * off, z = p.z + tg.x * off; const c = new T.Mesh(new T.TorusGeometry(0.4, 0.1, 8, 18), coinM); c.position.set(x, ty(x, z) + 1.2, z); c.userData.noCollide = true; S.add(c); sCoins.push({ c, k, off }); }
  const best = () => { try { return JSON.parse(localStorage.getItem('aou_ski_best') || 'null'); } catch (e) { return null; } };
  const hud = document.createElement('div'); hud.id = 'ski-hud'; hud.innerHTML = '<div class="sk-top"><b id="sk-t">0.0 s</b><span id="sk-s">0 pts</span></div><div class="sk-btns"><button id="sk-l" aria-label="Steer left">◀</button><button id="sk-r" aria-label="Steer right">▶</button></div>'; hud.style.display = 'none'; (document.getElementById('wvm-stage') || document.body).appendChild(hud);
  const st = document.createElement('style'); st.textContent = '#ski-hud{position:absolute;inset:0;pointer-events:none;z-index:40;font-family:Poppins,Arial}#ski-hud .sk-top{position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;gap:14px;background:rgba(255,255,255,.94);padding:8px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-weight:900;color:#0f172a}#ski-hud .sk-btns{position:absolute;bottom:26px;left:0;right:0;display:flex;justify-content:space-between;padding:0 18px}#ski-hud .sk-btns button{pointer-events:auto;width:84px;height:84px;border-radius:50%;border:0;background:rgba(255,255,255,.9);font-size:30px;box-shadow:0 8px 24px rgba(0,0,0,.3);touch-action:none}'; document.head.appendChild(st);
  const ski = { on: false, k: 0, u: 0, v: 0, steer: 0, t0: 0, pts: 0 }; const keys = new Set();
  addEventListener('keydown', (e) => { if (!ski.on) return; keys.add(e.key.toLowerCase()); }); addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  const hold = (id, v) => { const b = hud.querySelector(id); b.onpointerdown = () => { ski.steer = v; }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => { if (ski.steer === v) ski.steer = 0; }; }; hold('#sk-l', -1); hold('#sk-r', 1);
  const skis = new T.Group(); for (const sx of [-0.16, 0.16]) box(0.1, 0.04, 1.7, M(0xe11d48), sx, 0.03, 0.2, skis); skis.visible = false; app.player.add(skis);
  const startSki = () => { if (ski.on) return; ski.on = true; ski.k = 0; ski.u = 0; ski.v = 3; ski.t0 = app.t; ski.pts = 0; gates.forEach(q => q.hit = false); sCoins.forEach(q => q.c.visible = true); hud.style.display = ''; skis.visible = true; app.toast('⛷️ GO! Steer with A/D, the arrow keys or the ◀ ▶ buttons. Pass through the flag gates.', 3800);
    app.ride = { pos: () => { const dt = Math.min(0.05, app._skiDt || 0.016); const tg = curve.getTangentAt(Math.min(0.999, ski.k)); const p = curve.getPointAt(Math.min(0.999, ski.k)); const steer = ski.steer || (keys.has('a') || keys.has('arrowleft') ? -1 : keys.has('d') || keys.has('arrowright') ? 1 : 0); ski.u = Math.max(-half + 0.8, Math.min(half - 0.8, ski.u + steer * dt * 7)); const ahead = curve.getPointAt(Math.min(1, ski.k + 0.01)); const drop = (ty(p.x, p.z) - ty(ahead.x, ahead.z)) / (curve.getLength() * 0.01); ski.v = Math.max(5, Math.min(28, ski.v + (drop * 14 - Math.abs(steer) * 1.5 - 0.6) * dt)); ski.k += ski.v * dt / curve.getLength();
        const nx = -tg.z, nz = tg.x; const x = p.x + nx * ski.u, z = p.z + nz * ski.u; app.ride.yaw = Math.atan2(tg.x, tg.z); if (app.avatar) app.avatar.rotation.z = -steer * 0.25;
        for (const gt of gates) if (!gt.hit && ski.k > gt.k) { gt.hit = true; if (Math.abs(ski.u - gt.off) < 1.7) { ski.pts += 100; app.toast('🚩 Gate! +100', 900); } else { ski.t0 -= 3; app.toast('❌ Missed a gate: +3 s', 900); } }
        for (const sc of sCoins) if (sc.c.visible && Math.abs(sc.k - ski.k) < 0.006 && Math.abs(sc.off - ski.u) < 1.4) { sc.c.visible = false; ski.pts += 10; }
        hud.querySelector('#sk-t').textContent = (app.t - ski.t0).toFixed(1) + ' s'; hud.querySelector('#sk-s').textContent = ski.pts + ' pts';
        if (ski.k >= 0.995 && !ski.ending) { ski.ending = true; setTimeout(() => { ski.ending = false; endSki(); }, 0); } return new T.Vector3(x, ty(x, z) + 0.15, z); }, yaw: 0 }; };
  const endSki = () => { if (!ski.on) return; ski.on = false; const time = app.t - ski.t0; const b = best(); const score = Math.round(ski.pts + Math.max(0, 600 - time * 10)); const nb = !b || score > b.score; if (nb) localStorage.setItem('aou_ski_best', JSON.stringify({ score, time: +time.toFixed(1) })); app.ride = null; hud.style.display = 'none'; skis.visible = false; if (app.avatar) app.avatar.rotation.z = 0; const end = curve.getPointAt(1); app.player.position.set(end.x - 6, ty(end.x - 6, end.z), end.z); app.celebrate && app.celebrate(nb ? '🏆' : '⛷️'); app.popup('⛷️ Run complete', `<p><b>${time.toFixed(1)} s</b> · ${ski.pts} gate + coin points · score <b>${score}</b></p><p>${nb ? '🏆 New personal best!' : 'Best: ' + b.score + ' (' + b.time + ' s)'}</p>`, [{ label: '🚡 Ride the lift back up', primary: true, fn: rideLift }]); };
  app.onUpdate((dt) => { app._skiDt = dt; for (const sc of sCoins) sc.c.rotation.y += dt * 3; });
  /* chairlift */
  const L = new T.Vector3(base.x, 0, base.z), U = new T.Vector3(top.x, 0, top.z); const len = L.distanceTo(U); const towers = Math.ceil(len / 16);
  const cab = (k) => { const x = L.x + (U.x - L.x) * k, z = L.z + (U.z - L.z) * k; const h = ty(L.x, L.z) + 10 + (ty(U.x, U.z) + 10 - ty(L.x, L.z) - 10) * k; return new T.Vector3(x, Math.max(h, ty(x, z) + 7), z); };
  for (let i = 0; i <= towers; i++) { const k = i / towers; const p = cab(k); const tw = cyl(0.3, 0.45, p.y - ty(p.x, p.z) + 1, M(0x9aa3ad, { metalness: 0.6 }), p.x, (p.y + ty(p.x, p.z)) / 2 + 0.5, p.z, S, 10); tw.userData.noCollide = true; const arm = box(5, 0.25, 0.3, M(0x9aa3ad, { metalness: 0.6 }), p.x, p.y + 0.9, p.z, S); arm.rotation.y = Math.atan2(U.x - L.x, U.z - L.z) + Math.PI / 2; }
  for (const sd of [-2, 2]) { const cg = new T.BufferGeometry().setFromPoints([...Array(41)].map((_, i) => { const p = cab(i / 40); return new T.Vector3(p.x + sd, p.y + 0.9, p.z); })); S.add(new T.Line(cg, new T.LineBasicMaterial({ color: 0x222222 }))); }
  const chairs = []; for (let i = 0; i < 12; i++) { const c = new T.Group(); box(1.4, 0.12, 0.6, M(0x2563eb), 0, -1.6, 0, c); box(1.4, 0.6, 0.1, M(0x2563eb), 0, -1.3, -0.3, c); box(0.06, 1.7, 0.06, M(0x444444), 0, -0.8, 0, c); S.add(c); chairs.push({ c, k: i / 12, dir: i % 2 ? 1 : -1 }); }
  app.onUpdate((dt) => { for (const ch of chairs) { ch.k = (ch.k + dt * 0.02) % 1; const k = ch.dir > 0 ? ch.k : 1 - ch.k; const p = cab(k); ch.c.position.set(p.x + ch.dir * 2, p.y + 0.9, p.z); ch.c.rotation.y = Math.atan2(U.x - L.x, U.z - L.z) + (ch.dir > 0 ? 0 : Math.PI); } });
  const rideLift = () => { if (app.ride) return; const yaw = Math.atan2(U.x - L.x, U.z - L.z); const t0 = app.t, dur = 26; if (app.avatar) { const { sitPerson } = window.AOU_ENGINE || {}; } app.toast('🚡 Up we go. Enjoy the view.', 3000); try { window.AOU_SIT && window.AOU_SIT(app.avatar, true); } catch (e) { }
    app.ride = { pos: (t) => { const k = Math.min(1, (t - t0) / dur); const p = cab(k); return new T.Vector3(p.x + 2, p.y - 1.75, p.z); }, yaw, until: t0 + dur, done: () => { try { window.AOU_SIT && window.AOU_SIT(app.avatar, false); } catch (e) { } app.player.position.set(top.x - 4, ty(top.x - 4, top.z + 3), top.z + 3); app.toast('🏔️ Summit! Coburn\'s Place is up the hill. The ⛷️ start gate is right here.', 4200); } }; };
  const station = (p, label, fn, tagTxt) => { const s = new T.Group(); s.position.set(p.x, ty(p.x, p.z), p.z); S.add(s); box(6, 0.3, 4, dark, 0, 3.4, 0, s); for (const sx of [-2.8, 2.8]) box(0.25, 3.4, 0.25, dark, sx, 1.7, 1.8, s); const t = makeSprite(tagTxt, { scale: 3.2, accent: '#38f0ff' }); t.position.y = 5; s.add(t); app.addHotspot(s, { fn }); app.addInteractable(p.x, p.z, 4, label, fn); };
  station(base, '🚡 Ride the ski lift up', rideLift, '🚡 SKI LIFT · up to Coburn\'s');
  station({ x: top.x - 8, z: top.z - 2 }, '⛷️ Start the ski run', startSki, '⛷️ START GATE · tap to ski');
  app.addPlace({ id: 'ski', name: '🚡 Ski lift (base)', icon: '🚡', x: base.x - 4, z: base.z - 6, cat: 'Fun', keys: 'ski lift chairlift mountain snow coburn', say: 'Ride the lift up to Coburn\'s Place.' });
  app.addPlace({ id: 'coburn', name: '🏔️ Coburn\'s Place', icon: '🏔️', x: TOP.x, z: TOP.z - 24, yaw: 0, cat: 'Homes', keys: 'coburn mountain mansion pool ski summit games', say: 'Coburn\'s Place: pool coins, the game wall and the ski run.' });
  return { setSeason, startSki, rideLift };
}

/* ============================================================
   CONFERENCE CENTER · 72 seats, a 26 m screen, podium, voice
   ============================================================ */
export function buildConference(app, W, api) {
  const S = app.scene; const { x: X, z: Z } = SPOTS.conf; const y0 = terrainY(X, Z) + 0.05; const g = new T.Group(); g.position.set(X, y0, Z); g.rotation.y = 0; S.add(g); g.userData.noCollide = true;
  const w = 46, d = 34, h = 15; const hw = w / 2, hd = d / 2; const white = M(0xf4f1ea, { roughness: 0.5 }); const dark = M(0x111827, { metalness: 0.4, roughness: 0.4 }); const gold = M(0xc9a24a, { metalness: 0.85, roughness: 0.25 });
  box(w + 4, 0.4, d + 4, M(0xd9d2c5), 0, 0, 0, g); const fl = box(w - 0.4, 0.06, d - 0.4, M(0x2a2f45, { roughness: 0.9 }), 0, 0.23, 0, g); fl.userData.noOcclude = true;
  // walls: front (−x, faces the plaza) glass with a wide entrance
  const gap = 5; for (const sz of [-1, 1]) { const len = hd - gap; const gp = box(0.2, h, len, M(0xcff6ff, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.3, depthWrite: false }), -hw, h / 2, sz * (gap + len / 2), g); gp.userData.noOcclude = true; app.addBox(X - hw, Z + sz * (gap + len / 2), 0.4, len / 2); }
  const back = box(0.6, h, d, white, hw, h / 2, 0, g); app.addBox(X + hw, Z, 0.5, hd);
  for (const sz of [-1, 1]) { const sw = box(w, h, 0.6, white, 0, h / 2, sz * hd, g); sw.userData.noOcclude = true; app.addBox(X, Z + sz * hd, hw, 0.5); }
  const roof = box(w + 2, 0.8, d + 2, white, 0, h + 0.4, 0, g); roof.userData.noOcclude = true; for (let i = 0; i < 8; i++) box(w - 2, 0.1, 0.4, glow(i % 2 ? 0x38f0ff : 0xffffff, 1.2), 0, h - 0.4, -hd + 2 + i * 4.3, g);
  const name = textPlane(['ALL OF US · CONFERENCE CENTER'], 30, 2.2, { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', accent: '#c9a24a', font: 'bold 120px Poppins, Arial', border: null }); name.rotation.y = -Math.PI / 2; name.position.set(-hw - 0.35, h - 1.6, 0); g.add(name);
  // stage + giant screen on the back wall
  box(10, 1.2, 26, M(0x1f2937, { roughness: 0.6 }), hw - 6, 0.6, 0, g); app.addBox(X + hw - 6, Z, 5, 13);
  const sw2 = 26, sh2 = 14.6; const frame = box(0.4, sh2 + 0.6, sw2 + 0.6, dark, hw - 0.6, 8.3, 0, g);
  const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; const ctx = cv.getContext('2d'); const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; const scrM = new T.MeshBasicMaterial({ map: tex, toneMapped: false }); const scr = plane(sw2, sh2, scrM, g); scr.rotation.y = -Math.PI / 2; scr.position.set(hw - 0.85, 8.3, 0);
  const card = (lines, bg = ['#0b1033', '#3b0d4a']) => { const gr = ctx.createLinearGradient(0, 0, 1600, 900); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); ctx.fillStyle = gr; ctx.fillRect(0, 0, 1600, 900); ctx.textAlign = 'center'; lines.forEach((l, i) => { ctx.fillStyle = i ? '#a5f3fc' : '#ffffff'; ctx.font = (i ? '600 54px' : 'bold 96px') + ' Poppins, Arial'; ctx.fillText(String(l).slice(0, 48), 800, 380 + i * 90); }); tex.needsUpdate = true; };
  const image = (url) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1600, 900); const k = Math.min(1600 / im.width, 900 / im.height); ctx.drawImage(im, (1600 - im.width * k) / 2, (900 - im.height * k) / 2, im.width * k, im.height * k); tex.needsUpdate = true; }; im.src = url; };
  card(['ALL OF US · CONFERENCE CENTER', 'Walk to the podium and tap 📽️ Present']);
  // seats: 6 rows of 12, instanced
  const seatG = new T.BoxGeometry(0.9, 0.9, 0.9); const seats = new T.InstancedMesh(seatG, M(0x7c3aed, { roughness: 0.8 }), 72); const m4 = new T.Matrix4(); let n = 0; for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) { m4.makeTranslation(-hw + 8 + r * 3.2, 0.7, -hd + 5 + c * 2.2 + (c >= 6 ? 1.6 : 0)); seats.setMatrixAt(n++, m4); } seats.userData.noCollide = true; g.add(seats);
  const podium = new T.Group(); podium.position.set(hw - 9.5, 1.2, -8); g.add(podium); box(1.2, 1.4, 0.9, gold, 0, 0.7, 0, podium); const pt = makeSprite('📽️ Podium · tap to present', { scale: 3, accent: '#ffd23f' }); pt.position.y = 2.8; podium.add(pt);
  const present = () => api.openConference && api.openConference(); app.addHotspot(podium, { fn: present }); app.addHotspot(frame, { fn: present }); app.addInteractable(X + hw - 9.5, Z - 8, 3.4, '📽️ Present on the giant screen', present);
  const voiceSpot = new T.Group(); voiceSpot.position.set(-hw + 4, 0.25, hd - 4); g.add(voiceSpot); const vs = new T.Mesh(new T.CircleGeometry(1.8, 32), glow(0x7cff6b, 1)); vs.rotation.x = -Math.PI / 2; voiceSpot.add(vs); const vt = makeSprite('🎙️ Join conference voice', { scale: 2.8, accent: '#7cff6b' }); vt.position.y = 2.4; voiceSpot.add(vt); const joinV = () => api.joinVoice && api.joinVoice('conference'); app.addHotspot(voiceSpot, { fn: joinV }); app.addInteractable(X - hw + 4, Z + hd - 4, 2.6, '🎙️ Join conference voice chat', joinV);
  
  app.addPlace({ id: 'conference', name: '🎤 Conference Center', icon: '🎤', x: X - hw - 6, z: Z, yaw: Math.PI / 2, cat: 'Places', keys: 'conference center presentation stage screen meeting event pdf powerpoint voice business', say: 'The Conference Center. 72 seats, a 26 m screen. Tap the podium to present.' });
  const inside = () => { const P = app.player.position; return Math.abs(P.x - X) < hw && Math.abs(P.z - Z) < hd; };
  return { card, image, inside };
}

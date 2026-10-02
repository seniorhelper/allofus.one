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
import { terrainY, addFlat, addDeck, openGround } from './aou-terrain.js';
const T = THREE;
const MOB = isMobile();

/* fixed spots (flattened before the ground is built) */
export const SPOTS = { silk: { x: 70, z: 168 }, comics: { x: -84, z: 8 }, worlds: { x: 24, z: 146 } };
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
  for (const sz of [-1, 1]) { const runner = box(16, 0.03, 2.4, M(0x7a1f2b, { roughness: 1 }), -12.5, 0.26, sz * 9.8, g); runner.userData.noOcclude = true; for (let i = 0; i < 5; i++) { const sp = new T.PointLight(0xffe2b8, MOB ? 0 : 0.6, 6, 2); sp.position.set(-18 + i * 4.2, 5.5, sz * 10.5); g.add(sp); } }
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
  const fireLight = new T.PointLight(0xff8a3d, 1.2, 9, 2); fireLight.position.set(0, 1.4, 1.2); fpw.add(fireLight);
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
  const cab = new T.Group(); cab.position.set(EL.x, 0.25, EL.z); g.add(cab); cyl(1.15, 1.15, 0.12, gold, 0, 0, 0, cab, 24); cyl(1.15, 1.15, 0.08, gold, 0, 2.8, 0, cab, 24); const cabL = new T.PointLight(0xfff1d6, 0.6, 5); cabL.position.y = 2.4; cab.add(cabL);
  const elTag = makeSprite('🛗 Elevator', { scale: 2.4, accent: '#ffd23f' }); elTag.position.set(EL.x, 3.4, EL.z - 1.6); g.add(elTag);
  const FLOORS = [[0, '🏛️ Lobby + gallery', 0.25, -2, 6], [1, '💼 Office (business chats)', L1, 6, 2], [2, '🏊 Roof deck + infinity pool', L2, 6, -2]];
  const ride = (lv) => { const F = FLOORS[lv]; app.fade.classList.add('on'); app.fade.textContent = '🛗 ' + F[1]; const startY = cab.position.y; let k = 0; const f = (dt) => { k = Math.min(1, k + dt * 1.2); cab.position.y = startY + (F[2] - startY) * k; if (k >= 1) app.updaters = app.updaters.filter(q => q !== f); }; app.onUpdate(f);
    setTimeout(() => { app.level = lv; const px = X + F[3], pz = Z + F[4]; app.player.position.set(px, y0 + F[2], pz); setTimeout(() => app.fade.classList.remove('on'), 320); app.toast(lv === 1 ? '💼 The office. Tap the screen to open a business chat room.' : lv === 2 ? '🏊 Roof deck. The pool is real water: walk in and swim.' : '🏛️ Back in the lobby.', 3600); }, 420); };
  const elevator = () => app.popup('🛗 Elevator', '<p>Pick a floor.</p>', FLOORS.map(([lv, label]) => ({ label: (app.level === lv ? '● ' : '') + label, primary: app.level !== lv && lv === 1, fn: () => ride(lv) })));
  app.addHotspot(cab, { fn: elevator }); app.addInteractable(X + EL.x, Z + EL.z - 0.4, 2.6, '🛗 Elevator: office + roof', elevator);
  // decks you can stand on
  addDeck({ level: 1, y: y0 + L1, x1: X - 8.7, x2: X + x2 - 0.6, z1: Z + z1 + 0.6, z2: Z + z2 - 0.6 });
  addDeck({ level: 2, y: y0 + L2, x1: X + x1 + 0.6, x2: X + x2 - 0.6, z1: Z + z1 + 0.6, z2: Z + z2 - 0.6 });
  app.addPoly([[X - 8.7, Z + z1 + 0.6], [X + x2 - 0.6, Z + z1 + 0.6], [X + x2 - 0.6, Z + z2 - 0.6], [X - 8.7, Z + z2 - 0.6]], { keepIn: true, level: 1 });
  app.addPoly([[X + x1 + 0.6, Z + z1 + 0.6], [X + x2 - 0.6, Z + z1 + 0.6], [X + x2 - 0.6, Z + z2 - 0.6], [X + x1 + 0.6, Z + z2 - 0.6]], { keepIn: true, level: 2 });
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
  const tel = cyl(0.18, 0.28, 2.4, M(0x222831, { metalness: 0.6 }), 8, 1.6, -8, deck, 14); tel.rotation.z = -0.8; cyl(0.06, 0.08, 1.2, M(0x888888), 8.3, 0.6, -8, deck, 8);
  app.addHotspot(tel, { title: '🔭 Roof telescope', html: '<p>On a clear night you can find the Moon, Jupiter\'s four big moons and Saturn\'s rings with a small backyard telescope. Try the night sky (🌙) and look up.</p>', actions: [{ label: '🌙 Night sky', fn: () => api.setNight && api.setNight(true) }] });
  for (let i = 0; i < 10; i++) sph(0.5 + Math.random() * 0.4, M(0x3f7d2b, { roughness: 0.9 }), -4 + (i % 5) * 3.2, 0.5, 9 + (i > 4 ? 1.6 : 0), deck, 10);
  const notice = { text: 'WELCOME HOME · ALL OF US', color: '#ff4fd8' }; let noticeMesh = null;
  const drawNotice = () => { if (noticeMesh) g.remove(noticeMesh); noticeMesh = textPlane([notice.text], 14, 1.6, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', accent: notice.color, font: 'bold 120px Poppins, Arial', border: null, glow: true }); noticeMesh.rotation.y = -Math.PI / 2; noticeMesh.position.set(x1 - 0.3, L2 + 1.6, 0); g.add(noticeMesh); };
  drawNotice();
  learnSpot(app, g, '☀️ Roof garden + solar', 0, L2 + 2.2, 9, '<p>A planted roof cools the house below and holds rainwater. Solar glass on the skylight makes power while lighting the hall.</p>');
  learnSpot(app, g, '💧 The waterfalls recycle', x1 - 4, 4, -9.6, '<p>Both front waterfalls and the hall water walls run on one recirculating loop fed by roof rainwater. Pumps on solar power, the pools are the reservoir.</p>');

  /* 9) doors slide open as you approach; level resets when you travel */
  app.onUpdate((dt) => { const P = app.player.position; for (const [d, sx, sz] of doors) { const near = !app.level && Math.hypot(P.x - (X + sx), P.z - Z) < 4.2; const tgt = sz * (gap / 2 + (near ? gap * 0.9 : 0)); d.position.z += (tgt - d.position.z) * Math.min(1, dt * 5); } });
  const lights = []; for (const [x, y, z] of [[-15, 9, 0], [2, 4.8, 0], [2, L1 + 4.6, 0]]) { const L = new T.PointLight(0xfff1d6, MOB ? 0.5 : 0.9, 24, 1.6); L.position.set(x, y, z); g.add(L); lights.push(L); }
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
  return out;
}

/* allofus.one · the desk · a seated VR workspace: one desk, three panels, three rooms. Hands, controllers, mouse or touch.
   Everything is drawn in code (no downloaded art). Saved on this device only. Loaded by aou-desk-gate.js after the access code. */
import * as T from '/vendor/three/three.module.min.js';
import * as L from './aou-desk-logic.js';

const Q = new URLSearchParams(location.search);
const DEV = Q.get('dev') === '1', QA = Q.get('qa') === '1';
/* app modules: each adds one or more sheets to the desk through the small api object passed to its default export */
const APPS = ['./aou-desk-app-help.js', './aou-desk-app-calm.js', './aou-desk-app-tools.js'];
const $ = (id) => document.getElementById(id);
const r2 = (v) => Math.round(v * 100) / 100;

export async function start() {
  let S = L.load(localStorage);
  const host = $('dk-stage');
  const R = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.setSize(host.clientWidth, host.clientHeight);
  R.outputColorSpace = T.SRGBColorSpace; R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor');
  try { R.xr.setFoveation(0.6); } catch (e) { }
  host.appendChild(R.domElement); R.domElement.setAttribute('aria-label', 'Your desk in 3D. Use Text view for a plain list of everything on it.');
  const scene = new T.Scene(); const camera = new T.PerspectiveCamera(60, 1, 0.05, 120);
  const rig = new T.Group(); scene.add(rig);
  const hemi = new T.HemisphereLight(0xffffff, 0x6b6f78, 1.1); const sun = new T.DirectionalLight(0xffffff, 1.4); sun.position.set(1.5, 3, 1.2); scene.add(hemi, sun);

  /* ---------- drawn textures (seeded, so they look the same every visit) ---------- */
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, rep) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; } t.anisotropy = 4; return t; };
  function woodCanvas() {
    seed = 11; const c = cv(512, 512), g = c.getContext('2d'); g.fillStyle = '#9a6537'; g.fillRect(0, 0, 512, 512);
    for (let p = 0; p < 4; p++) { g.fillStyle = `rgba(${60 + rnd() * 50 | 0},${30 + rnd() * 24 | 0},10,${0.10 + rnd() * 0.12})`; g.fillRect(0, p * 128, 512, 128); }
    for (let i = 0; i < 520; i++) {
      const y0 = rnd() * 512, a = 2 + rnd() * 5, f = 0.004 + rnd() * 0.01, ph = rnd() * 6; g.strokeStyle = rnd() < 0.5 ? `rgba(58,30,10,${0.05 + rnd() * 0.16})` : `rgba(226,170,110,${0.04 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath();
      for (let x = 0; x <= 512; x += 16) { const y = y0 + Math.sin(x * f * 6.283 / 3.2 + ph) * a; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    for (let k = 0; k < 3; k++) { const x = rnd() * 512, y = rnd() * 512; for (let r = 16; r > 2; r -= 2.5) { g.strokeStyle = `rgba(48,24,8,${0.1 + (16 - r) * 0.012})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r * 2.1, r * 0.8, 0, 0, 6.283); g.stroke(); } }
    g.fillStyle = 'rgba(40,20,6,0.5)'; for (let p = 1; p < 4; p++) g.fillRect(0, p * 128 - 1, 512, 2);
    return c;
  }
  function metalCanvas() {
    seed = 23; const c = cv(512, 512), g = c.getContext('2d'); g.fillStyle = '#b4bac3'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5200; i++) { const y = rnd() * 512, x = rnd() * 512, w = 30 + rnd() * 220, l = rnd() < 0.5; g.fillStyle = l ? `rgba(255,255,255,${0.03 + rnd() * 0.06})` : `rgba(40,46,56,${0.03 + rnd() * 0.07})`; g.fillRect(x, y, w, 1); if (x + w > 512) g.fillRect(0, y, x + w - 512, 1); }
    return c;
  }
  function speckCanvas(base, n, dark) {
    seed = 31; const c = cv(256, 256), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${rnd() * 0.06})` : `rgba(0,0,0,${rnd() * dark})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
    return c;
  }
  function gradCanvas(stops, w = 8, h = 256) { const c = cv(w, h), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, w, h); return c; }
  function cityCanvas() {
    seed = 47; const c = cv(1024, 512), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#070b1c'); gr.addColorStop(0.7, '#1b2452'); gr.addColorStop(1, '#3a2a55'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`; g.fillRect(rnd() * 1024, rnd() * 260, 1.5, 1.5); }
    for (let layer = 0; layer < 2; layer++) {
      let x = -10; while (x < 1024) {
        const w = 34 + rnd() * 70, h = (layer ? 90 : 150) + rnd() * (layer ? 190 : 120); g.fillStyle = layer ? '#0a0e1c' : '#131a33'; g.fillRect(x, 512 - h, w, h);
        for (let wy = 512 - h + 10; wy < 500; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (rnd() < (layer ? 0.3 : 0.2)) { g.fillStyle = rnd() < 0.8 ? 'rgba(255,214,140,0.85)' : 'rgba(150,210,255,0.8)'; g.fillRect(wx, wy, 5, 7); }
        x += w + 2 + rnd() * 8;
      }
    }
    g.fillStyle = '#05070d'; for (let m = 1; m < 4; m++) g.fillRect(m * 256 - 5, 0, 10, 512); g.fillRect(0, 0, 1024, 8); g.fillRect(0, 504, 1024, 8);
    return c;
  }
  function skyCanvas() {
    seed = 59; const c = cv(1024, 512), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
    [[0, '#16254f'], [0.3, '#3b4f8f'], [0.44, '#e48a5c'], [0.5, '#ffd9a0'], [0.515, '#6f5a66'], [0.6, '#2c2f44'], [1, '#191b29']].forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 26; i++) { const x = rnd() * 1024, y = 120 + rnd() * 110, w = 60 + rnd() * 170, h = 6 + rnd() * 14; const cg = g.createRadialGradient(x, y, 1, x, y, w); cg.addColorStop(0, 'rgba(255,214,190,0.34)'); cg.addColorStop(1, 'rgba(255,214,190,0)'); g.save(); g.translate(0, y); g.scale(1, h / w); g.translate(0, -y); g.fillStyle = cg; g.fillRect(x - w, y - w, w * 2, w * 2); g.restore(); if (x - w < 0) { g.save(); g.translate(1024, y); g.scale(1, h / w); g.translate(0, -y); g.fillStyle = cg; g.fillRect(x - w, y - w, w * 2, w * 2); g.restore(); } }
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`; g.fillRect(rnd() * 1024, rnd() * 130, 1.4, 1.4); }
    return c;
  }
  function blobCanvas(inner) { const c = cv(128, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; }

  const TX = { wood: tex(woodCanvas(), true), metal: tex(metalCanvas(), true), floor: tex(speckCanvas('#8f949c', 5000, 0.08), true), wall: tex(gradCanvas([[0, '#d5d8dd'], [0.75, '#b3b8c0'], [1, '#8c9199']])), city: tex(cityCanvas()), sky: tex(skyCanvas()), shadow: tex(blobCanvas('rgba(0,0,0,0.55)')), glow: tex(blobCanvas('rgba(255,255,255,0.9)')) };
  TX.floor.repeat.set(6, 6);
  { const pm = new T.PMREMGenerator(R); const es = new T.Scene(); es.add(new T.Mesh(new T.SphereGeometry(20, 24, 12), new T.MeshBasicMaterial({ map: tex(gradCanvas([[0, '#ffffff'], [0.35, '#cfd6e2'], [0.5, '#7d8798'], [0.62, '#3a3f4a'], [1, '#20232a']])), side: T.BackSide })));
    const lamp = new T.Mesh(new T.BoxGeometry(8, 0.4, 3), new T.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(0, 9, -3); es.add(lamp); scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose(); }

  /* ---------- rooms ---------- */
  const box = new T.BoxGeometry(1, 1, 1), plane = new T.PlaneGeometry(1, 1);
  const rooms = {}; const M = (o) => new T.MeshStandardMaterial(o), B = (o) => new T.MeshBasicMaterial(o);
  const put = (parent, geo, mat, sx, sy, sz, x, y, z) => { const m = new T.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; };
  const dimmable = [];
  { const g = rooms.plain = new T.Group(); const fm = M({ map: TX.floor, roughness: 0.9, metalness: 0 }); const f = put(g, plane, fm, 9, 9, 1, 0, 0, 0); f.rotation.x = -Math.PI / 2;
    const wm = B({ map: TX.wall }); dimmable.push(wm); for (let i = 0; i < 4; i++) { const w = put(g, plane, wm, 9, 3.4, 1, 0, 1.7, 0); const a = i * Math.PI / 2; w.position.set(Math.sin(a) * -4.5, 1.7, Math.cos(a) * -4.5); w.rotation.y = a; }
    const cm = B({ color: 0xe9ebee }); dimmable.push(cm); const c = put(g, plane, cm, 9, 9, 1, 0, 3.4, 0); c.rotation.x = Math.PI / 2;
    const bm = B({ color: 0x6f747c }); dimmable.push(bm); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const b = put(g, box, bm, 9, 0.09, 0.02, Math.sin(a) * -4.49, 0.045, Math.cos(a) * -4.49); b.rotation.y = a; } }
  { const g = rooms.loft = new T.Group(); const fm = M({ map: TX.wood, color: 0x6b5a50, roughness: 0.55, metalness: 0 }); const f = put(g, plane, fm, 8, 8, 1, 0, 0, 0); f.rotation.x = -Math.PI / 2;
    const wm = B({ color: 0x1b1e27 }); dimmable.push(wm); [[0, 4, Math.PI], [-4, 0, Math.PI / 2], [4, 0, -Math.PI / 2]].forEach(([x, z, ry]) => { const w = put(g, plane, wm, 8, 3.2, 1, x, 1.6, z); w.rotation.y = ry; });
    const win = B({ map: TX.city }); dimmable.push(win); put(g, plane, win, 8, 3.2, 1, 0, 1.6, -4);
    const cm = B({ color: 0x11131a }); const c = put(g, plane, cm, 8, 8, 1, 0, 3.2, 0); c.rotation.x = Math.PI / 2;
    const beam = B({ color: 0x2a2018 }); for (let i = -1; i <= 1; i++) put(g, box, beam, 0.16, 0.2, 8, i * 2.4, 3.1, 0); }
  { const g = rooms.sky = new T.Group(); const dome = put(g, new T.SphereGeometry(60, 32, 16), B({ map: TX.sky, side: T.BackSide, fog: false }), 1, 1, 1, 0, 0, 0); dome.rotation.y = Math.PI; dimmable.push(dome.material);
    const pm = M({ map: TX.metal, color: 0x7b8088, roughness: 0.5, metalness: 0.6 }); const p = put(g, new T.CylinderGeometry(3, 3.1, 0.12, 48), pm, 1, 1, 1, 0, -0.06, 0);
    const rim = put(g, new T.TorusGeometry(3.02, 0.02, 6, 64), B({ color: 0xffc98a }), 1, 1, 1, 0, 0.01, 0); rim.rotation.x = Math.PI / 2; void p; }
  let starPts = null, starsAsked = false; const skyTurn = new T.Group(), skyTilt = new T.Group(), planetG = new T.Group();
  { const g = rooms.stars = new T.Group(); const dm = B({ map: tex(gradCanvas([[0, '#01020a'], [0.46, '#040816'], [0.5, '#0d1736'], [0.53, '#04060e'], [1, '#020308']])), side: T.BackSide }); put(g, new T.SphereGeometry(95, 24, 12), dm, 1, 1, 1, 0, 0, 0); dimmable.push(dm);
    put(g, new T.CylinderGeometry(3, 3.1, 0.12, 48), M({ map: TX.metal, color: 0x4a4f58, roughness: 0.45, metalness: 0.7 }), 1, 1, 1, 0, -0.06, 0); const rim = put(g, new T.TorusGeometry(3.02, 0.02, 6, 64), B({ color: 0x7fa8ff }), 1, 1, 1, 0, 0.01, 0); rim.rotation.x = Math.PI / 2;
    skyTilt.rotation.x = -50 * Math.PI / 180; skyTilt.add(skyTurn); g.add(skyTilt, planetG);
    seed = 83; const pc = cv(256, 128), pg = pc.getContext('2d'); for (let y = 0; y < 128; y += 2) { const t = y / 128, b = 0.5 + 0.5 * Math.sin(t * 34 + Math.sin(t * 9) * 2); pg.fillStyle = `rgb(${200 + b * 42 | 0},${150 + b * 52 | 0},${96 + b * 46 | 0})`; pg.fillRect(0, y, 256, 2); }
    for (let i = 0; i < 70; i++) { pg.fillStyle = `rgba(${rnd() < 0.5 ? '120,70,40' : '255,235,200'},${0.05 + rnd() * 0.12})`; pg.fillRect(rnd() * 256, rnd() * 128, 20 + rnd() * 90, 1 + rnd() * 2); }
    const gm = M({ map: tex(pc), roughness: 1, metalness: 0, envMapIntensity: 0 }); const gas = put(planetG, new T.SphereGeometry(1, 40, 20), gm, 7, 7, 7, -36, 27, -52); gas.rotation.z = 0.4;
    const rc = cv(256, 256), rg = rc.getContext('2d'); for (let r = 70; r < 126; r += 1.5) { rg.strokeStyle = `rgba(${225 + rnd() * 30 | 0},${200 + rnd() * 30 | 0},${160 + rnd() * 30 | 0},${(r > 96 && r < 101) ? 0.04 : 0.25 + rnd() * 0.5})`; rg.lineWidth = 1.6; rg.beginPath(); rg.arc(128, 128, r, 0, 6.283); rg.stroke(); }
    const ringM = B({ map: tex(rc), transparent: true, side: T.DoubleSide, depthWrite: false }); dimmable.push(ringM); const pr = put(planetG, plane, ringM, 30, 30, 1, -36, 27, -52); pr.rotation.set(-Math.PI / 2 + 0.32, 0, 0.4);
    seed = 91; const mc = cv(256, 128), mg = mc.getContext('2d'); mg.fillStyle = '#9a9ca3'; mg.fillRect(0, 0, 256, 128); for (let i = 0; i < 130; i++) { const x = rnd() * 256, y = rnd() * 128, r = 1 + rnd() * 9; mg.fillStyle = `rgba(60,62,70,${0.12 + rnd() * 0.25})`; mg.beginPath(); mg.arc(x, y, r, 0, 6.283); mg.fill(); mg.strokeStyle = 'rgba(230,232,240,0.25)'; mg.lineWidth = 1; mg.beginPath(); mg.arc(x, y, r, 3.6, 5.6); mg.stroke(); }
    put(planetG, new T.SphereGeometry(1, 32, 16), M({ map: tex(mc), roughness: 1, metalness: 0, envMapIntensity: 0 }), 2.1, 2.1, 2.1, 30, 20, -38); }
  async function loadStars() {
    if (starsAsked) return; starsAsked = true;
    try {
      const r = await fetch('/desk/stars.bin'); if (!r.ok) throw new Error('stars'); const f = new Float32Array(await r.arrayBuffer()), n = Math.min(5000, (f.length / 4) | 0); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n), c3 = [0, 0, 0];
      for (let i = 0; i < n; i++) { const ra = f[i * 4], dec = f[i * 4 + 1], mag = f[i * 4 + 2], cd = Math.cos(dec); if (!Number.isFinite(ra + dec + mag)) continue; pos[i * 3] = 80 * cd * Math.cos(ra); pos[i * 3 + 1] = 80 * Math.sin(dec); pos[i * 3 + 2] = -80 * cd * Math.sin(ra);
        L.starColor(f[i * 4 + 3], c3); const b = Math.max(0.13, Math.min(1, Math.pow(10, -0.22 * (mag - 1.5)))); col[i * 3] = c3[0] * b; col[i * 3 + 1] = c3[1] * b; col[i * 3 + 2] = c3[2] * b; siz[i] = Math.max(1.3, Math.min(7, 5.6 - 0.8 * mag)); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aC', new T.BufferAttribute(col, 3)); g.setAttribute('aS', new T.BufferAttribute(siz, 1));
      starPts = new T.Points(g, new T.ShaderMaterial({ uniforms: { uK: { value: 1 } }, blending: T.AdditiveBlending, depthWrite: false, transparent: true,
        vertexShader: 'attribute float aS; attribute vec3 aC; varying vec3 vC; uniform float uK; void main(){ vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uK; }',
        fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.2, 1.0, r); gl_FragColor = vec4(vC * a, 1.0);\n#include <colorspace_fragment>\n}' }));
      starPts.frustumCulled = false; skyTurn.add(starPts); applyRoom();
    } catch (e) { starsAsked = false; say('The stars could not load. Check the connection.'); }
  }
  rooms.real = new T.Group();
  Object.values(rooms).forEach((g) => { g.visible = false; rig.add(g); });
  const LIGHT = { plain: [0xffffff, 0x6b6f78, 1.15, 0xffffff, 1.3], loft: [0xffd9b0, 0x1a1c26, 0.55, 0xffc890, 0.9], sky: [0xffc9a0, 0x3a3550, 0.9, 0xffa868, 1.5], stars: [0xa9b8ff, 0x10121c, 0.5, 0xd5dcff, 0.9], real: [0xffffff, 0x777777, 1.1, 0xffffff, 1.2] };

  /* ---------- the desk ---------- */
  const desk = new T.Group(); rig.add(desk);
  const DM = {
    woodTop: M({ map: TX.wood, roughness: 0.42, metalness: 0, envMapIntensity: 0.5 }), woodLeg: M({ map: TX.wood, color: 0x8a6a52, roughness: 0.6, metalness: 0, envMapIntensity: 0.3 }),
    metalTop: M({ map: TX.metal, roughness: 0.32, metalness: 1, envMapIntensity: 1.2 }), metalLeg: M({ color: 0x23262c, roughness: 0.45, metalness: 0.8 }),
    neonTop: M({ color: 0x0a0b0e, roughness: 0.18, metalness: 0.35, envMapIntensity: 0.9 }), neonSide: M({ color: 0x101116, roughness: 0.5, metalness: 0.2 }), neonEdge: B({ color: 0x22e6ff }),
    steelTop: M({ color: 0xe3e7ec, roughness: 0.07, metalness: 1, envMapIntensity: 1.5 }), steelLeg: M({ color: 0xc4cad2, roughness: 0.16, metalness: 1, envMapIntensity: 1.2 }),
    blackTop: M({ color: 0x0c0d10, roughness: 0.85, metalness: 0.1, envMapIntensity: 1 }), blackLeg: M({ color: 0x15171b, roughness: 0.6, metalness: 0.3 }),
    glow: B({ map: TX.glow, color: 0x22e6ff, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false }), shadow: B({ map: TX.shadow, transparent: true, opacity: 0.8, depthWrite: false }),
  };
  let seat = L.seatFor(1.2, S.desk.hOff);
  const FRONT = -0.2;
  const ROUGH = { woodTop: [0.5, 0.12], metalTop: [0.36, 0.16], steelTop: [0.2, 0.05], blackTop: [0.85, 0.06], neonTop: [0.45, 0.1] };
  function buildDesk() {
    while (desk.children.length) desk.remove(desk.children[0]);
    for (const k in ROUGH) DM[k].roughness = ROUGH[k][S.desk.finish === 'gloss' ? 1 : 0];
    const tm = S.desk.style === 'black' ? DM.blackTop : DM.woodTop, lm = S.desk.style === 'black' ? DM.blackLeg : DM.woodLeg, mt = S.desk.style === 'steel' ? DM.steelTop : DM.metalTop, ml = S.desk.style === 'steel' ? DM.steelLeg : DM.metalLeg;
    const { style, w, d } = S.desk, top = seat.top, zc = FRONT - d / 2;
    TX.wood.repeat.set(Math.max(1, w / 1.3), Math.max(1, d / 0.8)); TX.metal.repeat.set(Math.max(1, w / 1.2), 1);
    const sh = put(desk, plane, DM.shadow, w * 1.5, d * 1.9, 1, 0, 0.004, zc); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
    if (style === 'wood' || style === 'black') {
      put(desk, box, tm, w, 0.045, d, 0, top - 0.0225, zc);
      put(desk, box, lm, w - 0.16, 0.09, 0.022, 0, top - 0.09, zc - d / 2 + 0.07); put(desk, box, lm, w - 0.16, 0.09, 0.022, 0, top - 0.09, zc + d / 2 - 0.07);
      [-1, 1].forEach((sx) => { put(desk, box, lm, 0.022, 0.09, d - 0.14, sx * (w / 2 - 0.07), top - 0.09, zc); [-1, 1].forEach((sz) => put(desk, box, lm, 0.06, top - 0.045, 0.06, sx * (w / 2 - 0.07), (top - 0.045) / 2, zc + sz * (d / 2 - 0.07))); });
    } else if (style === 'metal' || style === 'steel') {
      put(desk, box, mt, w, 0.022, d, 0, top - 0.011, zc);
      [-1, 1].forEach((sx) => { const x = sx * (w / 2 - 0.1), h = top - 0.022; put(desk, box, ml, 0.04, 0.04, d - 0.08, x, 0.02, zc); put(desk, box, ml, 0.04, 0.04, d - 0.08, x, h - 0.02, zc); [-1, 1].forEach((sz) => { const l = put(desk, box, ml, 0.04, h, 0.04, x, h / 2, zc + sz * (d / 2 - 0.16)); l.rotation.x = sz * 0.12; }); });
      put(desk, box, ml, w - 0.2, 0.03, 0.03, 0, top * 0.3, zc - d / 2 + 0.2);
    } else {
      put(desk, box, DM.neonTop, w, 0.05, d, 0, top - 0.025, zc); const e = 0.008, y = top - 0.025;
      put(desk, box, DM.neonEdge, w + e, e, e, 0, y, zc + d / 2 + e / 2); put(desk, box, DM.neonEdge, w + e, e, e, 0, y, zc - d / 2 - e / 2);
      [-1, 1].forEach((sx) => { put(desk, box, DM.neonEdge, e, e, d + e, sx * (w / 2 + e / 2), y, zc); put(desk, box, DM.neonSide, 0.05, top - 0.05, d - 0.1, sx * (w / 2 - 0.08), (top - 0.05) / 2, zc); put(desk, box, DM.neonEdge, e, e, d - 0.1, sx * (w / 2 - 0.08), 0.006, zc); });
      const gl = put(desk, plane, DM.glow, w * 1.25, d * 1.6, 1, 0, 0.008, zc); gl.rotation.x = -Math.PI / 2; gl.renderOrder = 2;
    }
  }
  const accent = () => ({ wood: '#f2b45e', metal: '#8fc4ff', steel: '#bfe0ff', black: '#e8ecf2' }[S.desk.style] || S.desk.neon);
  /* the move ball: grab it (pinch or trigger) and the whole desk follows your hand, always turned to face you */
  const ball = new T.Mesh(new T.SphereGeometry(0.04, 20, 14), M({ color: 0xffffff, roughness: 0.25, metalness: 0.2, emissive: 0x2a6cff, emissiveIntensity: 0.9 })); ball.visible = false; rig.add(ball);

  /* ---------- panels: each is one canvas, redrawn only when its content changes ---------- */
  const R0 = 0.97, ring = new T.Group(); rig.add(ring);
  const surfaces = [];
  function surface(name, W, H, w, h, parent) {
    const c = cv(W, H); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = T.LinearFilter;
    const mesh = new T.Mesh(plane, new T.MeshBasicMaterial({ map: t, alphaTest: 0.5, toneMapped: false })); mesh.scale.set(w, h, 1); parent.add(mesh);
    const s = { name, c, g: c.getContext('2d'), t, mesh, W, H, w, h, regions: [], dirty: true, inv: new T.Matrix4(), sc: 1, wx: 1, wy: 1, hx: 0, hy: 0, poke: [{ armed: false }, { armed: false }], draw: null, touch: true };
    surfaces.push(s); return s;
  }
  const P = { front: surface('front', 1024, 640, 1.0, 0.625, ring), left: surface('left', 640, 640, 0.62, 0.62, ring), right: surface('right', 640, 640, 0.62, 0.62, ring) };
  const A = 47 * Math.PI / 180;
  const cork = surface('cork', 640, 412, 0.62, 0.4, ring); void A;
  /* every board sits on a ball around the seat and always faces it; each has a grab bar above it (move, push, pull) with - and + to resize */
  const BRD = { front: P.front, left: P.left, right: P.right, cork }, grips = {};
  function placeBoards() { for (const n in BRD) { const p = BRD[n]; let b = S.boards[n] || S.sheets[n]; if (!b) { const a = apps[n]; if (!a) continue; const h = a.def.home || {}; b = S.sheets[n] = { a: h.a || 0, e: h.e === undefined ? 0.3 : h.e, r: h.r || 1, k: h.k || 1, open: !!a.def.open }; } const ce = Math.cos(b.e), r = b.r * R0; p.mesh.position.set(Math.sin(b.a) * ce * r, Math.sin(b.e) * r, -Math.cos(b.a) * ce * r); p.mesh.rotation.set(b.e, -b.a, 0, 'YXZ'); p.mesh.scale.set(p.w * b.k, p.h * b.k, 1); } }
  const apps = {}, posOf = (n) => S.boards[n] || S.sheets[n];
  function makeGrip(n) { const p = BRD[n], gs = surface('grip-' + n, 320, 56, 0.26, 0.0455, p.mesh); gs.mesh.scale.set(0.26 / p.w, 0.0455 / p.h, 1); gs.mesh.position.set(0, 0.5 + (0.0455 / 2 + 0.012) / p.h, 0); gs.grip = n; gs.mesh.visible = false; grips[n] = gs; return gs; }
  for (const n in BRD) makeGrip(n);
  const dock = surface('dock', 1024, 88, 1.0, 0.086, P.front.mesh); dock.mesh.scale.set(1, 0.086 / 0.625, 1); dock.mesh.position.set(0, 0.5 + (0.012 + 0.0455 + 0.014 + 0.043) / 0.625, 0); dock.mesh.visible = false;
  placeBoards();
  const strip = surface('strip', 512, 96, 0.5, 0.09375, P.front.mesh); strip.mesh.scale.set(0.5 / 1.0, 0.09375 / 0.625, 1); strip.mesh.position.set(0.5 - 0.25 - 0.022, 0.5 - 0.075 - 0.03, 0.002); strip.touch = false;
  const kb = surface('kb', 1000, 600, 0.56, 0.336, rig); kb.mesh.visible = false;
  const kbTop = surface('kbtop', 1000, 110, 0.56, 0.0616, kb.mesh); kbTop.mesh.scale.set(1, 0.0616 / 0.336, 1); kbTop.mesh.position.set(0, 0.5 + 0.11, 0);

  const FF = 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif';
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function base(p, title) {
    const g = p.g; g.clearRect(0, 0, p.W, p.H); p.regions.length = 0; rr(g, 3, 3, p.W - 6, p.H - 6, 30); g.fillStyle = '#0e1219'; g.fill(); g.lineWidth = 5; g.strokeStyle = accent(); g.stroke();
    if (title) { g.fillStyle = '#ffffff'; g.font = `700 38px ${FF}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(title, 36, 58); }
    return g;
  }
  function btn(p, x, y, w, h, label, act, arg, o = {}) {
    const g = p.g; rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.on ? accent() : (o.bg || '#222a38'); g.fill(); if (o.line) { g.lineWidth = 3; g.strokeStyle = o.line; g.stroke(); }
    g.fillStyle = o.on ? '#0b0d12' : (o.fg || '#f1f4f9'); g.font = `${o.bold === false ? 500 : 700} ${o.size || 26}px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2 + 1, w - 14);
    if (act) p.regions.push({ x, y, w, h, act, arg });
  }
  const label = (g, text, x, y, size = 24, col = '#aab3c2', align = 'left', weight = 500, maxW) => { g.fillStyle = col; g.font = `${weight} ${size}px ${FF}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(text, x, y, maxW); };

  let presenting = false, arOK = false, vrOK = false;
  const gripDraw = (gs) => { gs.draw = () => { const g = gs.g, ap = !!gs.app; g.clearRect(0, 0, 320, 56); gs.regions.length = 0; rr(g, 2, 2, 316, 52, 26); g.fillStyle = '#0e1219'; g.fill(); g.lineWidth = 3; g.strokeStyle = accent(); g.stroke();
    btn(gs, 8, 8, ap ? 46 : 56, 40, '−', 'bsize', [gs.grip, -1], { size: 30, r: 20 }); btn(gs, ap ? 58 : 256, 8, ap ? 46 : 56, 40, '+', 'bsize', [gs.grip, 1], { size: 30, r: 20 }); if (ap) btn(gs, 266, 8, 46, 40, '×', 'app.close', gs.grip, { size: 30, r: 20, bg: '#2a1f25', fg: '#ff9aa8' });
    const x0 = ap ? 110 : 70, x1 = ap ? 260 : 250; g.fillStyle = accent(); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((x0 + x1) / 2 - 40 + i * 16, 28, 4, 0, 6.283); g.fill(); } gs.regions.push({ x: x0, y: 2, w: x1 - x0, h: 52, act: 'grip', arg: gs.grip }); }; };
  Object.values(grips).forEach(gripDraw);
  /* the dock: one button per app sheet, above the front board */
  dock.draw = () => { const g = dock.g, ids = Object.keys(apps); g.clearRect(0, 0, 1024, 88); dock.regions.length = 0; if (!ids.length) return; rr(g, 2, 2, 1020, 84, 26); g.fillStyle = '#0e1219'; g.fill(); g.lineWidth = 3; g.strokeStyle = accent(); g.stroke(); const bw = Math.min(190, (1000 - (ids.length - 1) * 10) / ids.length), x0 = (1024 - (ids.length * bw + (ids.length - 1) * 10)) / 2; ids.forEach((id, i) => btn(dock, x0 + i * (bw + 10), 14, bw, 60, apps[id].def.title, 'app.toggle', id, { on: !!(S.sheets[id] && S.sheets[id].open), size: bw < 130 ? 20 : 24 })); };
  P.front.draw = () => {
    const p = P.front, g = base(p); const h = new Date().getHours(); const hi = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    label(g, hi + (S.name ? ', ' + S.name : ''), 36, 52, 38, '#ffffff', 'left', 700, 420); label(g, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), 36, 96, 24);
    btn(p, 36, 130, 170, 58, 'To-do', 'tab', 'today', { on: S.tab === 'today' }); btn(p, 218, 130, 170, 58, 'Timer', 'tab', 'focus', { on: S.tab === 'focus' });
    btn(p, 708, 130, 280, 58, S.focus ? 'Focus mode: on' : 'Focus mode: off', 'focus', null, { on: S.focus });
    if (S.tab === 'today') {
      const rows = S.todos.slice(0, 6); rows.forEach((t, i) => {
        const y = 206 + i * 52; rr(g, 36, y, 952, 46, 10); g.fillStyle = '#171d28'; g.fill();
        rr(g, 46, y + 7, 32, 32, 8); g.fillStyle = t.done ? accent() : '#0e1219'; g.fill(); g.lineWidth = 3; g.strokeStyle = t.done ? accent() : '#7c8798'; g.stroke();
        if (t.done) { g.strokeStyle = '#0b0d12'; g.lineWidth = 5; g.beginPath(); g.moveTo(53, y + 24); g.lineTo(60, y + 31); g.lineTo(72, y + 15); g.stroke(); }
        label(g, t.t, 94, y + 24, 26, t.done ? '#7c8798' : '#f1f4f9', 'left', 500, 800); p.regions.push({ x: 36, y, w: 880, h: 46, act: 'todo.toggle', arg: i });
        btn(p, 930, y + 3, 52, 40, '×', 'todo.del', i, { bg: '#2a1f25', fg: '#ff9aa8', size: 30 });
      });
      if (!rows.length) label(g, 'Nothing on the list. Add the one thing that matters today.', 40, 240, 26);
      if (S.todos.length > 6) label(g, '+' + (S.todos.length - 6) + ' more in Text view', 600, 547, 22, '#aab3c2');
      if (S.todos.length < L.LIMITS.todos) btn(p, 36, 522, 260, 50, '+ Add a to-do', 'todo.add', null, { line: accent(), bg: '#141a24' });
    } else {
      const left = L.timerLeft(S.timer, Date.now()), run = !!S.timer.endsAt;
      label(g, 'Focus timer', 40, 232, 30, '#ffffff', 'left', 700); label(g, 'Length ' + Math.round(S.timer.len / 60) + ' min. The live countdown is at the top right.', 40, 274, 24);
      btn(p, 36, 306, 300, 84, run ? 'Pause' : (left < S.timer.len && left > 0 ? 'Resume' : 'Start'), 'timer.toggle', null, { on: run, size: 34, line: accent() }); btn(p, 352, 306, 200, 84, 'Reset', 'timer.reset', null, { size: 30 });
      [5, 15, 25, 50].forEach((m, i) => btn(p, 36 + i * 142, 416, 130, 62, m + ' min', 'timer.set', m * 60, { on: S.timer.len === m * 60 }));
      btn(p, 36 + 4 * 142, 416, 150, 62, 'Custom', 'timer.custom', null, { on: ![5, 15, 25, 50].includes(S.timer.len / 60) });
      label(g, 'A soft chime plays when the time is up.', 40, 520, 22);
    }
    btn(p, 36, 580, 190, 44, 'Recenter', 'recenter', null, { size: 22 }); btn(p, 238, 580, 190, 44, S.sound ? 'Sound: on' : 'Sound: off', 'sound', null, { size: 22 });
    if (presenting) btn(p, 440, 580, 190, 44, 'Leave VR', 'xr', null, { size: 22 }); else if (vrOK) btn(p, 440, 580, 190, 44, 'Enter VR', 'xr', null, { size: 22, line: accent() });
    if (presenting) btn(p, 798, 580, 190, 44, 'Reset boards', 'boards.reset', null, { size: 22 }); else label(g, 'Saved on this device only', 988, 602, 20, '#7c8798', 'right');
    void h;
  };
  P.left.draw = () => {
    const p = P.left, g = base(p, 'Make it yours'); const k = S.desk;
    label(g, 'Desk', 36, 118, 22); [['wood', 'Wood'], ['metal', 'Metal'], ['steel', 'Steel'], ['black', 'Black'], ['neon', 'Neon']].forEach(([s, n], i) => btn(p, 36 + i * 115, 136, 107, 54, n, 'desk.style', s, { on: k.style === s, size: 23 }));
    btn(p, 404, 34, 200, 48, k.finish === 'gloss' ? 'Finish: gloss' : 'Finish: matte', 'desk.finish', null, { size: 22, on: k.finish === 'gloss' });
    const row = (y, name, val, act) => { label(g, name, 36, y + 24, 24, '#f1f4f9'); btn(p, 300, y, 70, 48, '−', act, -1, { size: 34 }); label(g, val, 448, y + 24, 24, '#ffffff', 'center', 700); btn(p, 526, y, 70, 48, '+', act, 1, { size: 34 }); };
    row(206, 'Width', k.w.toFixed(1) + ' m', 'desk.w'); row(262, 'Depth', k.d.toFixed(2) + ' m', 'desk.d'); row(318, 'Height', (k.hOff >= 0 ? '+' : '−') + Math.abs(Math.round(k.hOff * 100)) + ' cm', 'desk.h');
    label(g, 'Neon colour', 36, 398, 22); L.NEONS.forEach((c, i) => { rr(g, 190 + i * 84, 376, 68, 44, 12); g.fillStyle = c; g.fill(); if (k.neon === c) { g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke(); } p.regions.push({ x: 190 + i * 84, y: 376, w: 68, h: 44, act: 'neon', arg: i }); });
    label(g, 'Room', 36, 446, 22); const rs = [['plain', 'Plain'], ['loft', 'Loft'], ['sky', 'Sky'], ['stars', S.room === 'stars' ? (S.planets ? 'Stars ●' : 'Stars ○') : 'Stars']]; if (arOK) rs.push(['real', 'My room']);
    const bw = (568 - (rs.length - 1) * 10) / rs.length; rs.forEach(([id, n], i) => btn(p, 36 + i * (bw + 10), 462, bw, 52, n, 'room', id, { on: S.room === id, size: rs.length > 4 ? 20 : 22 }));
    label(g, 'Panels', 36, 546, 22); btn(p, 130, 524, 226, 46, 'Far · point', 'dist', 'far', { on: S.dist === 'far', size: 22 }); btn(p, 368, 524, 236, 46, 'Near · touch', 'dist', 'near', { on: S.dist === 'near', size: 22 });
    btn(p, 36, 582, 280, 42, S.name ? 'Name: ' + S.name : 'Set your name', 'name', null, { size: 21, bg: '#141a24', line: '#3a4456' });
    btn(p, 328, 582, 276, 42, S.cork ? 'Corkboard: on' : 'Corkboard: off', 'cork', null, { size: 21, on: S.cork });
  };
  P.right.draw = () => {
    const p = P.right, g = base(p); btn(p, 36, 30, 180, 56, 'Notes', 'rtab', 'notes', { on: S.rtab === 'notes' }); btn(p, 228, 30, 180, 56, 'Links', 'rtab', 'links', { on: S.rtab === 'links' });
    if (S.rtab === 'notes') {
      const cells = S.notes.slice(0, 8); cells.forEach((n, i) => {
        const x = 36 + (i % 3) * 194, y = 104 + ((i / 3) | 0) * 176, w = 180, h = 164; g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(((i * 37) % 5 - 2) * 0.008); g.translate(-w / 2, -h / 2);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(5, 7, w, h); g.fillStyle = L.NOTE_COLORS[n.c]; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, w, 20);
        g.fillStyle = '#20222a'; g.font = `600 21px ${FF}`; g.textAlign = 'left'; g.textBaseline = 'top'; L.wrap(n.t || 'Empty note', w - 20, (s) => g.measureText(s).width, 5).forEach((ln, k) => g.fillText(ln, 10, 28 + k * 24)); g.restore();
        p.regions.push({ x, y: y + 22, w, h: h - 22, act: 'note.edit', arg: i }); p.regions.push({ x: x + w - 46, y: y - 4, w: 46, h: 30, act: 'note.del', arg: i }); p.regions.push({ x, y: y - 4, w: 60, h: 30, act: 'note.color', arg: i });
        g.fillStyle = '#20222a'; g.font = `700 22px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×', x + w - 20, y + 11); g.beginPath(); g.arc(x + 18, y + 10, 7, 0, 6.283); g.fillStyle = L.NOTE_COLORS[(n.c + 1) % L.NOTE_COLORS.length]; g.fill(); g.lineWidth = 2; g.strokeStyle = '#20222a'; g.stroke();
      });
      if (S.notes.length < L.LIMITS.notes) { const i = cells.length, x = 36 + (i % 3) * 194, y = 104 + ((i / 3) | 0) * 176; btn(p, x, y, 180, 164, '+ New note', 'note.add', null, { bg: '#141a24', line: accent(), size: 24 }); }
    } else {
      S.links.forEach((l, i) => { const y = 104 + i * 58; rr(g, 36, y, 568, 50, 10); g.fillStyle = '#171d28'; g.fill(); label(g, l.label, 52, y + 25, 25, '#ffffff', 'left', 700, 230); label(g, L.hostOf(l.url), 300, y + 25, 21, '#aab3c2', 'left', 500, 220); p.regions.push({ x: 36, y, w: 500, h: 50, act: 'link.open', arg: i }); btn(p, 546, y + 4, 52, 42, '×', 'link.del', i, { bg: '#2a1f25', fg: '#ff9aa8', size: 30 }); });
      if (!S.links.length) label(g, 'Pin your sites and socials here.', 40, 130, 25);
      if (S.links.length < L.LIMITS.links) btn(p, 36, 104 + Math.max(1, S.links.length) * 58 + (S.links.length ? 0 : 10), 240, 50, '+ Add a link', 'link.add', null, { bg: '#141a24', line: accent() });
      label(g, presenting ? 'A link opens in the browser and pauses VR.' : 'A link opens in a new tab.', 36, 606, 20, '#7c8798');
      /* in the headset a link never leaves VR without asking first */
      if (presenting && pendLink !== null && S.links[pendLink]) { const l = S.links[pendLink]; p.regions.length = 0; rr(g, 30, 180, 580, 290, 22); g.fillStyle = '#0b0e14'; g.fill(); g.lineWidth = 4; g.strokeStyle = accent(); g.stroke(); label(g, 'Open ' + l.label + '?', 320, 232, 30, '#ffffff', 'center', 700, 540); label(g, L.hostOf(l.url), 320, 274, 22, '#aab3c2', 'center', 500, 540); label(g, 'This pauses VR and opens the browser.', 320, 312, 22, '#ffcf7a', 'center');
        btn(p, 60, 360, 250, 80, 'Stay here', 'link.stay', null, { size: 28, on: true }); btn(p, 330, 360, 250, 80, 'Open', 'link.go', null, { size: 28, line: accent() }); }
    }
  };
  const corkBg = (() => { seed = 71; const c = cv(640, 412), g = c.getContext('2d'); g.fillStyle = '#b98a57'; g.fillRect(0, 0, 640, 412); for (let i = 0; i < 5200; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(90,58,28,${0.08 + rnd() * 0.25})` : `rgba(235,200,150,${0.06 + rnd() * 0.2})`; const r = 1 + rnd() * 2.6; g.beginPath(); g.ellipse(rnd() * 640, rnd() * 412, r, r * (0.5 + rnd() * 0.6), rnd() * 3, 0, 6.283); g.fill(); } g.lineWidth = 18; g.strokeStyle = '#5a3d22'; g.strokeRect(9, 9, 622, 394); g.lineWidth = 3; g.strokeStyle = 'rgba(255,220,170,0.25)'; g.strokeRect(19, 19, 602, 374); return c; })();
  cork.draw = () => {
    const p = cork, g = p.g; p.regions.length = 0; g.clearRect(0, 0, p.W, p.H); g.drawImage(corkBg, 0, 0); const n = S.notes.slice(0, 8);
    n.forEach((nt, i) => { const x = 34 + (i % 4) * 146, y = 36 + ((i / 4) | 0) * 176, w = 134, h = 158; g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(((i * 53) % 7 - 3) * 0.012); g.translate(-w / 2, -h / 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(4, 6, w, h); g.fillStyle = L.NOTE_COLORS[nt.c]; g.fillRect(0, 0, w, h);
      g.fillStyle = '#20222a'; g.font = `600 18px ${FF}`; g.textAlign = 'left'; g.textBaseline = 'top'; L.wrap(nt.t || 'Empty note', w - 16, (s) => g.measureText(s).width, 6).forEach((ln, k) => g.fillText(ln, 8, 24 + k * 21));
      g.beginPath(); g.arc(w / 2, 10, 7, 0, 6.283); g.fillStyle = ['#e5484d', '#3b82f6', '#22a559', '#f59e0b'][i % 4]; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.stroke(); g.restore(); p.regions.push({ x, y, w, h, act: 'note.edit', arg: i }); });
    if (!n.length) label(g, 'Nothing pinned. Add a note on the right panel.', 320, 206, 22, '#3a2613', 'center', 700);
  };
  let stripMsg = '', stripUntil = 0, stripLast = '';
  strip.draw = () => {
    const g = strip.g; g.clearRect(0, 0, 512, 96); rr(g, 2, 2, 508, 92, 20); g.fillStyle = '#171d28'; g.fill();
    const now = Date.now(); const run = !!S.timer.endsAt, left = L.timerLeft(S.timer, now);
    if (stripMsg && now < stripUntil) { label(g, stripMsg, 256, 49, 26, '#ffffff', 'center', 700, 480); return; }
    label(g, new Date(now).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), 24, 49, 38, '#ffffff', 'left', 700);
    if (presenting && fpsNow) label(g, fpsNow + ' fps', 256, 82, 16, '#7c8798', 'center');
    label(g, L.mmss(left), 488, 49, 38, run ? accent() : '#7c8798', 'right', 700); label(g, run ? 'focus' : 'timer', 372, 52, 20, '#aab3c2', 'right');
  };
  const stripKey = () => { const now = Date.now(); return (stripMsg && now < stripUntil ? stripMsg : '') + '|' + ((now / 60000) | 0) + '|' + L.timerLeft(S.timer, now) + '|' + accent() + (presenting ? fpsNow : '') + (DEV ? statLine : ''); };
  function say(msg, ms = 3200) { stripMsg = msg; stripUntil = Date.now() + ms; const t = $('dk-toast'); if (t) { t.textContent = msg; t.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { t.hidden = true; }, ms); } }

  /* ---------- desk keyboard (headset typing) ---------- */
  const KROWS = ['1234567890', 'qwertyuiop', "asdfghjkl'", '^zxcvbnm,.', '-/:@_!?&+#']; let shift = false, edit = null, kbPos = null, fpsNow = 0; const HINT = 'Tap a note to write on it'; let pendLink = null;
  kb.draw = () => {
    const p = kb, g = p.g; g.clearRect(0, 0, p.W, p.H); p.regions.length = 0; rr(g, 2, 2, p.W - 4, p.H - 4, 26); g.fillStyle = '#0e1219'; g.fill(); g.lineWidth = 4; g.strokeStyle = accent(); g.stroke();
    KROWS.forEach((row, r) => [...row].forEach((ch, c) => { const isShift = ch === '^'; const k = isShift ? '⇧' : (shift ? ch.toUpperCase() : ch); btn(p, 8 + c * 90, 10 + r * 97, 84, 89, k, 'key', isShift ? 'SHIFT' : k, { size: 40, on: isShift && shift, bg: '#222a38' }); }));
    /* delete, clear and enter live in a tall column on the right, at the top, so they can never sit low */
    btn(p, 908, 10, 84, 186, '⌫', 'key', 'BACK', { size: 42, bg: '#3a2a12', fg: '#ffd27a', line: '#ffd27a' }); btn(p, 908, 204, 84, 89, 'Clear', 'key', 'CLEAR', { size: 22, bg: '#2a1f25', fg: '#ff9aa8' }); btn(p, 908, 301, 84, 289, 'Enter', 'key', 'DONE', { size: 24, on: true });
    btn(p, 8, 495, 188, 95, 'Cancel', 'key', 'CANCEL', { size: 30, bg: '#2a1f25', fg: '#ff9aa8' }); btn(p, 204, 495, 698, 95, 'space', 'key', 'SPACE', { size: 30 });
  };
  kbTop.draw = () => { const g = kbTop.g; g.clearRect(0, 0, 1000, 110); rr(g, 2, 2, 996, 106, 22); g.fillStyle = '#171d28'; g.fill(); if (!edit) return; label(g, edit.title, 24, 28, 22, '#aab3c2'); const t = edit.text + '▏'; g.font = `600 34px ${FF}`; let s = t; while (g.measureText(s).width > 950 && s.length > 2) s = s.slice(1); label(g, s, 24, 72, 34, '#ffffff', 'left', 600); };
  function askText(title, initial, max, cb) {
    if (presenting) { edit = { title, text: initial || '', max, cb }; shift = !initial; head.setFromMatrixPosition(camera.matrixWorld); rig.worldToLocal(head); (kbPos || (kbPos = new T.Vector3())).set(Math.max(-0.35, Math.min(0.35, head.x)), L.kbY(seat.top, head.y), head.z - L.KB.reach); kb.mesh.visible = true; kb.dirty = kbTop.dirty = true; layout(); return; }
    const dlg = $('dk-ask'); $('dk-ask-title').textContent = title; const inp = $('dk-ask-in'); inp.value = initial || ''; inp.maxLength = max;
    $('dk-ask-form').onsubmit = (e) => { e.preventDefault(); dlg.close(); cb(inp.value.trim()); }; $('dk-ask-no').onclick = () => dlg.close(); dlg.showModal(); inp.focus(); inp.select();
  }
  function key(k) {
    if (!edit) return; if (k === 'SHIFT') { shift = !shift; kb.dirty = true; return; }
    if (k === 'CANCEL' || k === 'DONE') { const e = edit; edit = null; kb.mesh.visible = false; if (k === 'DONE') e.cb(e.text.trim()); return; }
    edit.text = L.typeKey(edit.text, k, edit.max); kbTop.dirty = true; if (shift && k.length === 1) { shift = false; kb.dirty = true; }
  }
  addEventListener('keydown', (e) => { if (!edit) return; if (e.key === 'Enter') key('DONE'); else if (e.key === 'Escape') key('CANCEL'); else if (e.key === 'Backspace') key('BACK'); else if (e.key.length === 1) { edit.text = L.typeKey(edit.text, e.key, edit.max); kbTop.dirty = true; } else return; e.preventDefault(); });

  /* ---------- sound: one small graph, built once ---------- */
  let ac = null, osc = null, og = null;
  function audio() { if (ac || !S.sound) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); osc = ac.createOscillator(); og = ac.createGain(); og.gain.value = 0; osc.type = 'sine'; osc.connect(og); og.connect(ac.destination); osc.start(); } catch (e) { ac = null; } }
  function beep(f, len = 0.05, vol = 0.07, at = 0) { if (!ac || !S.sound) return; const t = ac.currentTime + at; osc.frequency.setValueAtTime(f, t); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(vol, t + 0.008); og.gain.linearRampToValueAtTime(0, t + len); }
  const chime = () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, 0.09, i * 0.34)); };

  /* ---------- actions ---------- */
  let saveT = 0; function commit(...dirty) { clearTimeout(saveT); saveT = setTimeout(() => L.save(localStorage, S), 250); (dirty.length ? dirty : [P.front, P.left, P.right]).forEach((p) => { p.dirty = true; }); if (!dirty.length || dirty.includes(P.right)) cork.dirty = true; sheet(); }
  const all = () => { commit(P.front, P.left, P.right, kb); for (const n in grips) grips[n].dirty = true; dock.dirty = true; for (const id in apps) apps[id].p.dirty = true; };
  function act(a, arg, src) {
    { const k = a.indexOf(':'); if (k > 0) { const app = apps[a.slice(0, k)]; audio(); beep(660); if (app && app.def.act) app.def.act(a.slice(k + 1), arg, src); return; } }
    audio(); beep(660);
    if (src && src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0]) { try { src.gamepad.hapticActuators[0].pulse(0.35, 25); } catch (e) { } }
    const k = S.desk;
    switch (a) {
      case 'tab': S.tab = arg; commit(P.front); break;
      case 'rtab': S.rtab = arg; pendLink = null; commit(P.right); break;
      case 'focus': S.focus = !S.focus; applyRoom(); commit(P.front); break;
      case 'sound': S.sound = !S.sound; audio(); commit(P.front); break;
      case 'todo.toggle': if (S.todos[arg]) { S.todos[arg].done = !S.todos[arg].done; commit(P.front); } break;
      case 'todo.del': S.todos.splice(arg, 1); commit(P.front); break;
      case 'todo.add': askText('New to-do', '', L.LIMITS.todoLen, (t) => { if (t && S.todos.length < L.LIMITS.todos) { S.todos.push({ t, done: false }); commit(P.front); } }); break;
      case 'timer.toggle': S.timer = S.timer.endsAt ? L.timerPause(S.timer, Date.now()) : L.timerStart(S.timer, Date.now()); commit(P.front); break;
      case 'timer.reset': S.timer = L.timerReset(S.timer); commit(P.front); break;
      case 'timer.set': S.timer = L.timerSet(S.timer, arg); commit(P.front); break;
      case 'timer.custom': askText('Timer length in minutes (1 to 120)', String(Math.round(S.timer.len / 60)), 3, (t) => { const m = parseInt(t, 10); if (m >= 1 && m <= 120) { S.timer = L.timerSet(S.timer, m * 60); commit(P.front); } else if (t) say('Type a number from 1 to 120'); }); break;
      case 'desk.finish': k.finish = k.finish === 'gloss' ? 'matte' : 'gloss'; buildDesk(); commit(P.left); break;
      case 'cork': S.cork = !S.cork; applyRoom(); commit(P.left, P.right); break;
      case 'desk.style': k.style = arg; DM.neonEdge.color.set(k.neon); DM.glow.color.set(k.neon); buildDesk(); all(); break;
      case 'desk.w': k.w = r2(Math.min(L.DESK.wMax, Math.max(L.DESK.wMin, k.w + arg * 0.1))); buildDesk(); layout(); commit(P.left); break;
      case 'desk.d': k.d = r2(Math.min(L.DESK.dMax, Math.max(L.DESK.dMin, k.d + arg * 0.05))); buildDesk(); layout(); commit(P.left); break;
      case 'desk.h': k.hOff = r2(Math.min(L.DESK.hOffMax, Math.max(L.DESK.hOffMin, k.hOff + arg * 0.01))); reseat(); commit(P.left); break;
      case 'neon': k.neon = L.NEONS[arg]; DM.neonEdge.color.set(k.neon); DM.glow.color.set(k.neon); all(); break;
      case 'room': setRoom(arg); break;
      case 'dist': S.dist = arg; layout(); commit(P.left); break;
      case 'name': askText('Your first name (shown on the desk only)', S.name, L.LIMITS.nameLen, (t) => { S.name = t; commit(P.front, P.left); }); break;
      case 'note.add': if (S.notes.length < L.LIMITS.notes) { S.notes.push({ t: '', c: S.notes.length % L.NOTE_COLORS.length }); commit(P.right); act('note.edit', S.notes.length - 1); } break;
      case 'note.edit': if (S.notes[arg]) askText('Sticky note', S.notes[arg].t === HINT ? '' : S.notes[arg].t, L.LIMITS.noteLen, (t) => { if (S.notes[arg]) { S.notes[arg].t = t; commit(P.right); } }); break;
      case 'note.del': S.notes.splice(arg, 1); commit(P.right); break;
      case 'note.color': if (S.notes[arg]) { S.notes[arg].c = (S.notes[arg].c + 1) % L.NOTE_COLORS.length; commit(P.right); } break;
      case 'link.add': askText('Web address (for example yoursite.com)', '', L.LIMITS.urlLen, (t) => { const url = L.safeUrl(t); if (!url) { if (t) say('That is not a web address'); return; } setTimeout(() => askText('Name for this link', L.hostOf(url), L.LIMITS.labelLen, (n) => { if (S.links.length < L.LIMITS.links) { S.links.push({ label: n || L.hostOf(url), url }); S.rtab = 'links'; commit(P.right); } }), 60); }); break;
      case 'link.del': S.links.splice(arg, 1); commit(P.right); break;
      case 'link.open': if (presenting) { pendLink = arg; commit(P.right); } else openLink(arg); break;
      case 'link.go': { const i = pendLink; pendLink = null; commit(P.right); if (i !== null) openLink(i); break; }
      case 'link.stay': pendLink = null; commit(P.right); break;
      case 'recenter': if (presenting) { recenterAt = performance.now() + 3000; say('Sit back. Look straight ahead.', 3000); } else { yaw = 0; pitch = PITCH0; } break;
      case 'xr': toggleXR(); break;
      case 'key': key(arg); break;
      case 'grip': break;
      case 'app.toggle': if (apps[arg] && S.sheets[arg]) { S.sheets[arg].open = !S.sheets[arg].open; applyRoom(); layout(); apps[arg].p.dirty = true; dock.dirty = true; commit(P.left); } break;
      case 'app.close': if (apps[arg] && S.sheets[arg]) { S.sheets[arg].open = false; applyRoom(); layout(); dock.dirty = true; commit(P.left); } break;
      case 'bsize': { const b = posOf(arg[0]); if (b) { b.k = r2(Math.min(L.BLIM.kMax, Math.max(L.BLIM.kMin, b.k + arg[1] * 0.1))); clearFix(arg[0]); commit(P.left); } break; }
      case 'boards.reset': S.boards = L.cleanBoards(null); for (const id in apps) { const o = S.sheets[id] && S.sheets[id].open; delete S.sheets[id]; placeBoards(); if (S.sheets[id]) S.sheets[id].open = !!o; } layout(); commit(P.front); say('Boards back to their places'); break;
    }
  }
  function openLink(i) {
    const l = S.links[i]; if (!l) return; const url = L.safeUrl(l.url); if (!url) return;
    if (presenting) { const a = $('dk-go-a'); a.href = url; a.textContent = 'Open ' + l.label; $('dk-go-host').textContent = L.hostOf(url); $('dk-go').hidden = false; const s = R.xr.getSession(); if (s) s.end().catch(() => { }); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /* ---------- rooms, seat, layout ---------- */
  function applyRoom() {
    Object.keys(rooms).forEach((id) => { rooms[id].visible = id === S.room; }); const l = LIGHT[S.room], f = S.focus ? 0.45 : 1;
    hemi.color.set(l[0]); hemi.groundColor.set(l[1]); hemi.intensity = l[2] * (S.focus ? 0.7 : 1); sun.color.set(l[3]); sun.intensity = l[4] * (S.focus ? 0.7 : 1);
    dimmable.forEach((m) => { if (m._c === undefined) m._c = m.color.getHex(); m.color.setHex(m._c).multiplyScalar(f); });
    scene.background = presenting && arSession ? null : (bg || (bg = new T.Color(0x0b0d12)));
    for (const n in grips) grips[n].mesh.visible = presenting;
    for (const id in apps) apps[id].p.mesh.visible = !!(S.sheets[id] && S.sheets[id].open) && !S.focus; dock.mesh.visible = Object.keys(apps).length > 0;
    P.left.mesh.visible = P.right.mesh.visible = !S.focus; cork.mesh.visible = S.cork && !S.focus; ball.visible = presenting; planetG.visible = S.planets;
    if (S.room === 'stars') { loadStars(); skyTurn.rotation.y = -Math.PI / 2 - L.siderealAngle(Date.now(), new Date().getTimezoneOffset()); } if (starPts) starPts.material.uniforms.uK.value = presenting ? 2.4 : R.getPixelRatio() * 1.15;
  }
  let bg = null, arSession = false;
  function setRoom(id) {
    if (!L.ROOMS.includes(id) || (id === 'real' && !arOK)) return;
    if (id === 'stars' && S.room === 'stars') { S.planets = !S.planets; applyRoom(); commit(P.left); say(S.planets ? 'Planets: on' : 'Planets: off'); return; }
    if (id === 'real' && presenting && !arSession) { say('My room needs a fresh start: leave VR, then enter again'); return; }
    S.room = id; applyRoom(); commit(P.left);
  }
  let resume = false;
  function layout() {
    placeBoards(); const near = S.dist === 'near', Rr = near ? 0.46 : 0.27 + S.desk.d, s = Rr / R0;
    /* the boards never dip into the desk: the ring rises until their lowest edge clears the desk top */
    ring.position.set(0, Math.max(seat.eye, seat.top + 0.03 + 0.4025 * s), 0); ring.scale.setScalar(s); ring.rotation.x = presenting ? gazeUp : 0;
    if (kbPos) kb.mesh.position.copy(kbPos); else kb.mesh.position.set(0, L.kbY(seat.top, seat.eye), -0.33); kb.mesh.rotation.set(-Math.PI / 2 + L.KB.tilt, 0, 0);
    ball.position.set(Math.min(S.desk.w / 2 - 0.12, 0.34), seat.top + 0.06, FRONT - 0.12);
    scene.updateMatrixWorld(true); surfaces.forEach((p) => { p.inv.copy(p.mesh.matrixWorld).invert(); const e = p.mesh.matrixWorld.elements; p.wx = Math.hypot(e[0], e[1], e[2]); p.wy = Math.hypot(e[4], e[5], e[6]); p.sc = Math.hypot(e[8], e[9], e[10]); });
  }
  /* a moved or resized board is nudged up until its lowest edge clears the desk top */
  const cnr = new T.Vector3();
  function clearFix(n) { const p = BRD[n], b = posOf(n); if (!p || !b) return; for (let k = 0; k < 5; k++) { layout(); let lo = 1e9; for (let c = 0; c < 2; c++) { cnr.set(c ? 0.5 : -0.5, -0.5, 0).applyMatrix4(p.mesh.matrixWorld); if (cnr.y < lo) lo = cnr.y; } const need = rig.position.y + seat.top + 0.03 - lo; if (need <= 0.001 || b.e >= L.BLIM.eMax) break; b.e = Math.min(L.BLIM.eMax, b.e + need / (b.r * R0 * ring.scale.x) + 0.01); } }
  function reseat(headY) { if (headY) seatHead = headY; seat = L.seatFor(seatHead, S.desk.hOff); buildDesk(); layout(); if (!presenting) camera.position.set(0, seat.eye + 0.1, 0.8); }
  let seatHead = 1.2;

  /* ---------- pointing: one flat test per surface, no objects made per frame ---------- */
  const O = new T.Vector3(), D = new T.Vector3(), lo = new T.Vector3(), ld = new T.Vector3(), tip = new T.Vector3(), tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(0, 0, 0, 'YXZ');
  function rayHit(o, d) {
    let best = null, bt = 1e9;
    for (let i = 0; i < surfaces.length; i++) {
      const p = surfaces[i]; if (!p.touch || !shown(p) || (edit && p !== kb && p !== kbTop)) continue; lo.copy(o).applyMatrix4(p.inv); ld.copy(d).transformDirection(p.inv); if (ld.z > -1e-4) continue; const t = -lo.z / ld.z; if (t < 0) continue;
      const x = lo.x + ld.x * t, y = lo.y + ld.y * t; if (x < -0.5 || x > 0.5 || y < -0.5 || y > 0.5) continue; const td = t * Math.sqrt((ld.x * p.wx) ** 2 + (ld.y * p.wy) ** 2 + (ld.z * p.sc) ** 2);
      if (td < bt) { bt = td; best = p; p.hx = (x + 0.5) * p.W; p.hy = (0.5 - y) * p.H; }
    }
    hitDist = bt; return best;
  }
  let hitDist = 0;
  const shown = (p) => p.mesh.visible && p.mesh.parent.visible !== false && ((p !== kb && p !== kbTop) || !!edit);
  function regionAt(p) { for (let i = p.regions.length - 1; i >= 0; i--) { const r = p.regions[i]; if (p.hx >= r.x && p.hx <= r.x + r.w && p.hy >= r.y && p.hy <= r.y + r.h) return r; } return null; }
  const hl = [0, 1, 2].map(() => { const m = new T.Mesh(plane, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false })); m.visible = false; m.renderOrder = 5; return m; });
  const hov = [null, null, null], hovP = [null, null, null];
  function setHover(i, p, r) {
    if (hov[i] === r) return; hov[i] = r; hovP[i] = r ? p : null; const m = hl[i]; if (!r) { m.visible = false; return; }
    if (m.parent !== p.mesh) p.mesh.add(m); m.position.set((r.x + r.w / 2) / p.W - 0.5, 0.5 - (r.y + r.h / 2) / p.H, 0.004 / p.sc); m.scale.set(r.w / p.W, r.h / p.H, 1); m.visible = true; beep(980, 0.02, 0.025);
  }

  /* flat screen: drag to look, click or tap to press */
  const PITCH0 = -0.13; let yaw = 0, pitch = PITCH0, down = null; const ndc = new T.Vector2(), rc = new T.Raycaster();
  const flatRay = (e) => { const b = R.domElement.getBoundingClientRect(); ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(ndc, camera); const p = rayHit(rc.ray.origin, rc.ray.direction); return p ? [p, regionAt(p)] : [null, null]; };
  R.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false, pt: null }; R.domElement.setPointerCapture(e.pointerId); if (!presenting) { const [p0, r0] = flatRay(e); if (p0 && p0.point && !r0) { down.pt = p0; p0.point(2, p0.hx, p0.hy, true, false); } } });
  R.domElement.addEventListener('pointermove', (e) => {
    if (presenting) return;
    if (down && down.pt) { const [p1, r1] = flatRay(e); if (p1 === down.pt && !r1) p1.point(2, p1.hx, p1.hy, true, false); return; }
    if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 8) down.moved = true; if (down.moved) { const k = camera.fov / 60 * 0.0042; yaw = Math.max(-1.6, Math.min(1.6, down.yaw + dx * k)); pitch = Math.max(-0.9, Math.min(0.6, down.pitch + dy * k)); setHover(2, null, null); return; } }
    const [p, r] = flatRay(e); setHover(2, p, r); R.domElement.style.cursor = r ? 'pointer' : 'grab';
  });
  R.domElement.addEventListener('pointerup', (e) => { const d = down; down = null; if (d && d.pt) { d.pt.point(2, 0, 0, false, true); return; } if (presenting || !d || d.moved) return; const [p, r] = flatRay(e); if (p && r) { act(r.act, r.arg); setHover(2, null, null); } });
  R.domElement.addEventListener('pointerleave', () => { if (!down) setHover(2, null, null); });

  /* headset: controllers and bare hands */
  let drag = null, grab = null, bdrag = null, gazeUp = 0, tipShown = false; const ballW = new T.Vector3(), bl = new T.Vector3();
  const reachOf = (o) => { head.setFromMatrixPosition(camera.matrixWorld); return Math.hypot(o.O.x - head.x, o.O.z - head.z); };
  function boardStart(i, o, name) { const b = posOf(name); if (!b) return; bl.copy(o.O).addScaledVector(o.D, o.hd || 1); ring.worldToLocal(bl); const len = Math.max(0.05, bl.length()); bdrag = { i, name, g0: o.hd || 1, r0: reachOf(o), da: b.a - Math.atan2(bl.x, -bl.z), de: b.e - Math.asin(Math.max(-1, Math.min(1, bl.y / len))), kr: b.r / (len / R0) }; audio(); beep(440, 0.08); }
  function boardStep(o) {
    const b = posOf(bdrag.name), g = Math.max(0.25, Math.min(3.5, bdrag.g0 + (reachOf(o) - bdrag.r0) * 3)); bl.copy(o.O).addScaledVector(o.D, g); ring.worldToLocal(bl); const len = bl.length(); if (len < 0.1) return;
    b.a = Math.max(-L.BLIM.a, Math.min(L.BLIM.a, Math.atan2(bl.x, -bl.z) + bdrag.da)); b.e = Math.max(L.BLIM.eMin, Math.min(L.BLIM.eMax, Math.asin(Math.max(-1, Math.min(1, bl.y / len))) + bdrag.de)); b.r = Math.max(L.BLIM.rMin, Math.min(L.BLIM.rMax, len / R0 * bdrag.kr)); placeBoards(); o.line.scale.z = g; o.line.visible = true; o.dot.visible = false;
  }
  function boardEnd() { const n = bdrag.name; bdrag = null; clearFix(n); layout(); commit(P.left); beep(660, 0.08); }
  function dragStep(o) {
    head.setFromMatrixPosition(camera.matrixWorld); const reach = Math.hypot(o.O.x - head.x, o.O.z - head.z), g = Math.max(0.05, Math.min(3.5, drag.g0 + (reach - drag.r0) * 3));
    const bx = o.O.x + o.D.x * g, bz = o.O.z + o.D.z * g, y = rig.rotation.y, sn = Math.sin(y), cs = Math.cos(y), lx = ball.position.x, lz = ball.position.z, zc = FRONT - S.desk.d / 2;
    const px = bx - (lx * cs + lz * sn), pz = bz - (-lx * sn + lz * cs), cx = px + zc * sn, cz = pz + zc * cs;
    if (Math.hypot(cx - head.x, cz - head.z) < 0.45) return; const f = L.faceHead(cx, cz, head.x, head.z, zc, y), ny = y + Math.atan2(Math.sin(f.yaw - y), Math.cos(f.yaw - y)) * 0.3;
    rig.rotation.y = ny; rig.position.x += (cx - zc * Math.sin(ny) - rig.position.x) * 0.5; rig.position.z += (cz - zc * Math.cos(ny) - rig.position.z) * 0.5;
    o.line.scale.z = g; o.line.visible = true; o.dot.visible = false;
  }
  const ctl = [0, 1].map((i) => {
    const c = R.xr.getController(i), h = R.xr.getHand(i); scene.add(c, h); const o = { c, h, src: null, isHand: false, on: false, near: false, O: new T.Vector3(), D: new T.Vector3(), ball: false, hold: 0, sel: false, free: false };
    const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, 0, -1)]), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); const dot = new T.Mesh(new T.SphereGeometry(0.006, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    line.visible = dot.visible = false; c.add(line); scene.add(dot); o.line = line; o.dot = dot;
    c.addEventListener('connected', (e) => { o.src = e.data; o.isHand = !!(e.data && e.data.hand); o.on = true; });
    c.addEventListener('disconnected', () => { o.src = null; o.on = false; o.ball = false; o.hold = 0; o.sel = false; if (drag && drag.i === i) { drag = null; layout(); } line.visible = dot.visible = false; setHover(i, null, null); });
    c.addEventListener('selectstart', () => {
      o.sel = true; o.free = false;
      if (o.ball && !drag) { head.setFromMatrixPosition(camera.matrixWorld); drag = { i, g0: Math.max(0.05, ballW.distanceTo(o.O)), r0: Math.hypot(o.O.x - head.x, o.O.z - head.z) }; audio(); beep(440, 0.08); return; }
      if (!o.near && hov[i] && hovP[i]) { const r = hov[i]; if (r.act === 'grip') { if (!bdrag && !drag && !grab) boardStart(i, o, r.arg); } else act(r.act, r.arg, o.src); } else if (!o.near && !edit && seated) { o.hold = performance.now(); o.free = true; }
    });
    c.addEventListener('selectend', () => { o.hold = 0; o.sel = false; if (bdrag && bdrag.i === i) boardEnd(); if (drag && drag.i === i) { drag = null; layout(); beep(660, 0.08); } });
    return o;
  });
  const JN = 25, joints = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.5, metalness: 0.1 }), JN * 2); joints.frustumCulled = false; joints.count = 0; scene.add(joints); joints.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const JS = new T.Vector3(), JNAMES = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip', 'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip', 'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
  function xrInput() {
    let n = 0; const now = performance.now(); ballW.setFromMatrixPosition(ball.matrixWorld);
    for (let i = 0; i < 2; i++) {
      const o = ctl[i]; let near = false, grabNear = false; o.pp = null;
      if (o.on && o.isHand && o.h.joints) {
        for (let j = 0; j < JN; j++) { const jt = o.h.joints[JNAMES[j]]; if (!jt || jt.visible === false) continue; const rad = Math.max(0.005, Math.min(0.012, (jt.jointRadius || 0.008) * 0.8)); tmpM.compose(jt.position, tmpQ.identity(), JS.setScalar(rad)); joints.setMatrixAt(n++, tmpM); }
        const it = o.h.joints['index-finger-tip'];
        if (it && it.visible !== false) {
          grabNear = it.position.distanceTo(ballW) < 0.075;
          for (let s = 0; s < surfaces.length; s++) {
            const p = surfaces[s]; if (drag || !p.touch || !shown(p) || (edit && p !== kb && p !== kbTop)) continue; tip.copy(it.position).applyMatrix4(p.inv); const z = tip.z * p.sc - 0.006, inside = tip.x > -0.5 && tip.x < 0.5 && tip.y > -0.5 && tip.y < 0.5;
            if (inside && z < 0.1 && z > L.POKE.deep) { near = true; p.hx = (tip.x + 0.5) * p.W; p.hy = (0.5 - tip.y) * p.H; const r = regionAt(p); setHover(i, p, r); if (L.pokeStep(p.poke[i], z, true) && r) act(r.act, r.arg, o.src); } else L.pokeStep(p.poke[i], z, false);
          }
        }
      }
      o.near = near; const live = o.on && o.c.visible !== false;
      if (!live) { o.line.visible = o.dot.visible = false; o.ball = false; o.hold = 0; setHover(i, null, null); continue; }
      tmpM.identity().extractRotation(o.c.matrixWorld); o.O.setFromMatrixPosition(o.c.matrixWorld); o.D.set(0, 0, -1).applyMatrix4(tmpM);
      if (grab) { setHover(i, null, null); o.ball = false; o.hold = 0; o.line.visible = o.dot.visible = false; continue; }
      if (bdrag) { setHover(i, null, null); o.ball = false; o.hold = 0; if (bdrag.i === i) boardStep(o); else o.line.visible = o.dot.visible = false; continue; }
      if (drag) { setHover(i, null, null); o.ball = false; if (drag.i === i) dragStep(o); else o.line.visible = o.dot.visible = false; continue; }
      if (near && !grabNear) { o.line.visible = o.dot.visible = false; o.ball = false; o.hold = 0; continue; }
      tip.copy(ballW).sub(o.O); const tb = tip.dot(o.D), miss = Math.sqrt(Math.max(0, tip.lengthSq() - tb * tb)); const p = grabNear ? null : rayHit(o.O, o.D);
      o.ball = !edit && (grabNear || (tb > 0 && miss < 0.05 + tb * 0.035 && (!p || tb < hitDist + 0.05)));
      if (o.ball) { setHover(i, null, null); o.hold = 0; o.line.scale.z = Math.max(0.02, tb); o.dot.position.copy(ballW); o.line.visible = !grabNear; o.dot.visible = true; }
      else if (p) { o.hold = 0; o.hd = hitDist; const rg = regionAt(p); setHover(i, p, rg); if (p.point && !rg) { o.pp = p; p.point(i, p.hx, p.hy, o.sel, false); } o.line.scale.z = hitDist; o.dot.position.copy(o.O).addScaledVector(o.D, hitDist); o.line.visible = o.dot.visible = true; }
      else { setHover(i, null, null); o.line.scale.z = 0.6; o.line.visible = !o.isHand; o.dot.visible = false; if (o.hold && now - o.hold > 1100) { o.hold = 0; placeSeat(); beep(520, 0.2); say('Desk brought to you'); } }
    }
    for (let i = 0; i < 2; i++) { const o = ctl[i]; if (o.ppWas && o.ppWas !== o.pp) o.ppWas.point(i, 0, 0, false, true); o.ppWas = o.pp; }
    /* two-hand grab: pinch both hands on nothing, then pull, push, lift or spread. The whole desk follows (2.5x), spreading the hands changes its width. */
    const a = ctl[0], b = ctl[1], both = a.sel && b.sel && a.on && b.on && !drag && !bdrag && !edit;
    if (both && (grab || (a.free && b.free))) {
      const mx = (a.O.x + b.O.x) / 2, my = (a.O.y + b.O.y) / 2, mz = (a.O.z + b.O.z) / 2, dist = Math.max(0.05, a.O.distanceTo(b.O));
      if (!grab) { grab = { mx, my, mz, dist, rx: rig.position.x, ry: rig.position.y, rz: rig.position.z, w: S.desk.w }; a.hold = b.hold = 0; beep(440, 0.08); }
      rig.position.set(grab.rx + (mx - grab.mx) * 2.5, Math.max(-0.45, Math.min(0.5, grab.ry + (my - grab.my) * 1.5)), grab.rz + (mz - grab.mz) * 2.5);
      const w = Math.min(L.DESK.wMax, Math.max(L.DESK.wMin, Math.round(grab.w * dist / grab.dist * 10) / 10)); if (w !== S.desk.w) { S.desk.w = w; buildDesk(); ball.position.x = Math.min(w / 2 - 0.12, 0.34); beep(880, 0.02, 0.03); }
    } else if (grab) { grab = null; layout(); commit(P.left); beep(660, 0.08); }
    ball.scale.setScalar(drag || grab || ctl[0].ball || ctl[1].ball ? 1.4 : 1);
    if (joints.count !== n || n) { joints.count = n; joints.instanceMatrix.needsUpdate = true; }
  }

  /* seat: placed once after tracking settles; never follows the head; recenter only when asked */
  let sessT0 = 0, seated = false, recenterAt = 0, still = 0; const head = new T.Vector3(), pHead = new T.Vector3(), pDir = new T.Vector3();
  function placeSeat() {
    /* in front of the face: the desk is aimed along where the head points, flattened to the floor (safe even when looking down) */
    head.setFromMatrixPosition(camera.matrixWorld); D.set(0, 0, -1).transformDirection(camera.matrixWorld); if (Math.hypot(D.x, D.z) > 0.25) rig.rotation.set(0, Math.atan2(-D.x, -D.z), 0);
    /* leaning back: the boards swing up to meet the eyes (never down into the desk) */
    gazeUp = Math.max(0, Math.min(0.6, Math.asin(Math.max(-1, Math.min(1, D.y))))); grab = null;
    rig.position.set(head.x, 0, head.z); kbPos = null; drag = null; bdrag = null; if (!tipShown) { tipShown = true; say('Pinch both hands and pull to move the desk', 7000); }
    reseat(Math.min(2.1, Math.max(0.8, head.y))); seated = true; rig.visible = true;
  }

  /* ---------- headset session ---------- */
  const stat = { n: 0, slow: 0, worst: 0, sum: 0, t0: 0, cpuMax: 0 }; let statLine = '';
  async function toggleXR() {
    const cur = R.xr.getSession(); if (cur) { cur.end().catch(() => { }); return; }
    if (!navigator.xr) { say('This browser has no VR mode. Open this page in a headset browser.'); return; }
    /* one see-through-capable session for every room (the rooms are closed boxes and domes that cover the real room), so changing rooms never leaves VR */
    const init = { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] }; audio(); let s = null;
    if (arOK) { try { s = await navigator.xr.requestSession('immersive-ar', init); arSession = true; } catch (e) { s = null; } }
    if (!s) { try { s = await navigator.xr.requestSession('immersive-vr', init); arSession = false; } catch (e) { say('VR could not start: ' + (e && e.name || 'error')); return; } }
    try { await R.xr.setSession(s); } catch (e) { say('VR could not start: ' + (e && e.name || 'error')); }
  }
  R.xr.addEventListener('sessionstart', () => {
    presenting = true; seated = false; still = 0; drag = null; rig.visible = false; sessT0 = performance.now(); Object.assign(stat, { n: 0, slow: 0, worst: 0, sum: 0, t0: sessT0, cpuMax: 0 }); setHover(2, null, null); $('dk-go').hidden = true; document.body.classList.add('dk-xr');
    try { const s = R.xr.getSession(); if (s && s.updateTargetFrameRate && s.supportedFrameRates && Array.from(s.supportedFrameRates).includes(72)) s.updateTargetFrameRate(72).catch(() => { }); } catch (e) { }
    applyRoom(); all();
  });
  R.xr.addEventListener('sessionend', () => {
    presenting = false; drag = null; grab = null; bdrag = null; gazeUp = 0; tipShown = false; kbPos = null; pendLink = null; rig.visible = true; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); ball.scale.setScalar(1); if (edit) key('CANCEL'); ctl.forEach((o, i) => { o.line.visible = o.dot.visible = false; setHover(i, null, null); }); joints.count = 0; document.body.classList.remove('dk-xr');
    if (stat.n > 30) { const secs = (performance.now() - stat.t0 - 3000) / 1000; const run = { when: new Date().toISOString(), secs: Math.round(secs), fps: +(stat.n / secs).toFixed(1), slow: stat.slow, worstMs: +stat.worst.toFixed(1), cpuMaxMs: +stat.cpuMax.toFixed(1), calls: lastCalls, tris: lastTris }; try { localStorage.setItem('aou_desk_lastrun', JSON.stringify(run)); } catch (e) { } }
    reseat(1.2); applyRoom(); resize(); all(); if (resume) { resume = false; }
  });

  /* ---------- text view: the same desk as a plain, keyboard-friendly list ---------- */
  const el = (tag, props, kids) => { const n = document.createElement(tag); if (props) for (const k in props) { if (k === 'on') for (const ev in props.on) n.addEventListener(ev, props.on[ev]); else if (k === 'text') n.textContent = props.text; else if (k in n) n[k] = props[k]; else n.setAttribute(k, props[k]); } (kids || []).forEach((c) => c && n.appendChild(c)); return n; };
  function sheet() {
    const box = $('dk-sheet-body'); if (!box || $('dk-sheet').hidden) return; if (box.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && !sheet.force) return; sheet.force = false; box.textContent = '';
    const sec = (title, kids) => box.appendChild(el('section', null, [el('h2', { text: title }), ...kids])); const b = (text, fn, cls) => el('button', { type: 'button', text, className: cls || '', on: { click: () => { sheet.force = true; fn(); } } });
    const adder = (ph, max, fn) => { const i = el('input', { type: 'text', placeholder: ph, maxLength: max, 'aria-label': ph }); return el('form', { className: 'dk-row', on: { submit: (e) => { e.preventDefault(); const v = i.value.trim(); if (v) { sheet.force = true; fn(v); } } } }, [i, el('button', { type: 'submit', text: 'Add' })]); };
    sec('To-do', [...S.todos.map((t, i) => el('div', { className: 'dk-row' }, [el('label', { className: 'dk-grow' }, [el('input', { type: 'checkbox', checked: t.done, on: { change: () => { sheet.force = true; act('todo.toggle', i); } } }), el('span', { text: ' ' + t.t })]), b('Remove', () => act('todo.del', i), 'dk-x')])),
      S.todos.length < L.LIMITS.todos ? adder('New to-do', L.LIMITS.todoLen, (v) => { S.todos.push({ t: v.slice(0, L.LIMITS.todoLen), done: false }); commit(P.front); }) : null]);
    const left = L.timerLeft(S.timer, Date.now());
    sec('Focus timer', [el('div', { className: 'dk-row' }, [el('strong', { text: L.mmss(left), id: 'dk-sheet-time' }), b(S.timer.endsAt ? 'Pause' : 'Start', () => act('timer.toggle')), b('Reset', () => act('timer.reset')), ...[5, 15, 25, 50].map((m) => b(m + ' min', () => act('timer.set', m * 60), S.timer.len === m * 60 ? 'dk-on' : '')), b('Custom', () => act('timer.custom'))])]);
    sec('Sticky notes', [...S.notes.map((n, i) => el('div', { className: 'dk-row' }, [el('textarea', { value: n.t, maxLength: L.LIMITS.noteLen, rows: 2, className: 'dk-grow', 'aria-label': 'Sticky note ' + (i + 1), style: 'background:' + L.NOTE_COLORS[n.c], on: { change: (e) => { n.t = e.target.value.slice(0, L.LIMITS.noteLen); commit(P.right); } } }), b('Colour', () => act('note.color', i)), b('Remove', () => act('note.del', i), 'dk-x')])),
      S.notes.length < L.LIMITS.notes ? b('+ New note', () => { S.notes.push({ t: '', c: S.notes.length % L.NOTE_COLORS.length }); commit(P.right); }) : null]);
    sec('Links', [...S.links.map((l, i) => el('div', { className: 'dk-row' }, [el('a', { href: L.safeUrl(l.url) || '#', target: '_blank', rel: 'noopener noreferrer', className: 'dk-grow', text: l.label + ' · ' + L.hostOf(l.url) }), b('Remove', () => act('link.del', i), 'dk-x')])),
      S.links.length < L.LIMITS.links ? adder('Web address, for example yoursite.com', L.LIMITS.urlLen, (v) => { const url = L.safeUrl(v); if (!url) { say('That is not a web address'); return; } S.links.push({ label: L.hostOf(url), url }); commit(P.right); }) : null]);
    const em = L.embedFor(S.embed);
    sec('Player (flat screen only)', [el('p', { className: 'dk-note', text: 'Paste a YouTube or Vimeo link. Web pages can not be shown inside the headset view, so this player is for the flat screen.' }), adder('YouTube or Vimeo link', L.LIMITS.urlLen, (v) => { if (!L.embedFor(v)) { say('Only YouTube and Vimeo links work here'); return; } S.embed = L.safeUrl(v); commit(); }),
      em ? el('iframe', { src: em.src, title: em.kind + ' player', loading: 'lazy', referrerPolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-presentation', allow: 'encrypted-media; picture-in-picture; fullscreen', className: 'dk-frame' }) : null, em ? b('Remove player', () => { S.embed = ''; commit(); }, 'dk-x') : null]);
    const k = S.desk; const sel = (lab, val, opts, fn) => el('label', { className: 'dk-row' }, [el('span', { text: lab, className: 'dk-lab' }), el('select', { on: { change: (e) => { sheet.force = true; fn(e.target.value); } } }, opts.map(([v, t]) => el('option', { value: v, text: t, selected: v === val })))]);
    const rng = (lab, val, min, max, step, fn) => el('label', { className: 'dk-row' }, [el('span', { text: lab, className: 'dk-lab' }), el('input', { type: 'range', min, max, step, value: val, className: 'dk-grow', on: { change: (e) => { sheet.force = true; fn(+e.target.value); } } })]);
    sec('Desk and room', [sel('Desk', k.style, [['wood', 'Wood'], ['metal', 'Brushed metal'], ['steel', 'Polished stainless steel'], ['black', 'Black'], ['neon', 'Black with neon edge']], (v) => act('desk.style', v)), sel('Finish', k.finish, [['matte', 'Matte'], ['gloss', 'Gloss']], (v) => { if (v !== k.finish) act('desk.finish'); }),
      rng('Width ' + k.w.toFixed(1) + ' m', k.w, L.DESK.wMin, L.DESK.wMax, 0.1, (v) => { k.w = r2(v); buildDesk(); commit(P.left); }), rng('Depth ' + k.d.toFixed(2) + ' m', k.d, L.DESK.dMin, L.DESK.dMax, 0.05, (v) => { k.d = r2(v); buildDesk(); layout(); commit(P.left); }), rng('Height ' + Math.round(k.hOff * 100) + ' cm', k.hOff, L.DESK.hOffMin, L.DESK.hOffMax, 0.01, (v) => { k.hOff = r2(v); reseat(); commit(P.left); }),
      sel('Neon colour', k.neon, L.NEONS.map((c, i) => [c, ['Cyan', 'Pink', 'Green', 'Amber', 'Violet'][i]]), (v) => act('neon', L.NEONS.indexOf(v))), sel('Room', S.room, [['plain', 'Plain'], ['loft', 'Night loft'], ['sky', 'Open sky'], ['stars', 'Real night sky']].concat(arOK ? [['real', 'My room (prototype)']] : []), (v) => act('room', v)),
      sel('Panels', S.dist, [['far', 'Far: point at them'], ['near', 'Near: touch them']], (v) => act('dist', v)), el('div', { className: 'dk-row' }, [b(S.focus ? 'Focus mode: on' : 'Focus mode: off', () => act('focus'), S.focus ? 'dk-on' : ''), b(S.sound ? 'Sound: on' : 'Sound: off', () => act('sound')), b(S.cork ? 'Corkboard: on' : 'Corkboard: off', () => act('cork'), S.cork ? 'dk-on' : ''), S.room === 'stars' ? b(S.planets ? 'Planets: on' : 'Planets: off', () => act('room', 'stars'), S.planets ? 'dk-on' : '') : null])]);
    let run = null; try { run = JSON.parse(localStorage.getItem('aou_desk_lastrun') || 'null'); } catch (e) { }
    sec('This device', [el('p', { className: 'dk-note', text: 'Everything here is saved in this browser only. Nothing is sent to a server. Clearing site data erases it.' }), el('p', { className: 'dk-note', text: 'Real night sky: 5,000 real star positions and colours from the HYG star database (CC BY-SA 4.0), turned to roughly what is overhead now at mid-northern latitudes. The planets are decoration.' }),
      run && typeof run === 'object' ? el('p', { className: 'dk-note', text: 'Last headset run: ' + Number(run.secs) + ' s, ' + Number(run.fps) + ' frames a second, ' + Number(run.slow) + ' slow frames, worst frame ' + Number(run.worstMs) + ' ms, ' + Number(run.calls) + ' draw calls, ' + Number(run.tris) + ' triangles.' }) : null,
      b('Erase everything on this desk', () => { if (confirm('Erase all notes, links and to-dos on this device?')) { S = L.defaults(); DM.neonEdge.color.set(S.desk.neon); DM.glow.color.set(S.desk.neon); reseat(); applyRoom(); all(); } }, 'dk-x')]);
  }
  $('dk-sheet-btn').addEventListener('click', () => { const s = $('dk-sheet'); s.hidden = !s.hidden; $('dk-sheet-btn').setAttribute('aria-expanded', String(!s.hidden)); sheet.force = true; sheet(); resize(); });
  $('dk-vr-btn').addEventListener('click', () => toggleXR()); $('dk-go-x').addEventListener('click', () => { $('dk-go').hidden = true; });

  /* ---------- apps: what a module may use ---------- */
  const frameHooks = [];
  const api = { T, L, FF, rr, btn, label, base, accent, say, askText, beep, commit: () => commit(P.left), get S() { return S; }, get presenting() { return presenting; }, get seat() { return seat; }, rig, ring, scene,
    sound: () => { audio(); return ac; }, onFrame: (fn) => { if (typeof fn === 'function' && frameHooks.length < 16) frameHooks.push(fn); }, redraw: (p) => { if (p) p.dirty = true; }, touch: (p) => { if (p) p.t.needsUpdate = true; },
    store: { get: (id) => { try { return L.SHEET_ID.test(id) ? localStorage.getItem('aou_desk_app_' + id) : null; } catch (e) { return null; } }, set: (id, text) => { try { if (L.SHEET_ID.test(id) && typeof text === 'string' && text.length < 1500000) { localStorage.setItem('aou_desk_app_' + id, text); return true; } } catch (e) { } return false; } },
    addSheet(def) {
      if (!def || !L.SHEET_ID.test(def.id) || apps[def.id] || BRD[def.id] || typeof def.draw !== 'function' || Object.keys(apps).length >= 12) return null;
      const p = surface(def.id, def.W | 0, def.H | 0, +def.w, +def.h, ring); BRD[def.id] = p; apps[def.id] = { def, p }; p.draw = () => def.draw(p, p.g); if (typeof def.point === 'function') p.point = (i, x, y, dn, end) => def.point(p, i, x, y, dn, end);
      const gs = makeGrip(def.id); gs.app = true; gripDraw(gs); placeBoards(); dock.dirty = true; return p;
    } };

  /* ---------- frame loop ---------- */
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h || presenting) return; R.setSize(w, h); camera.aspect = w / h; const want = (camera.aspect < 0.8 ? 40 : camera.aspect < 1.2 ? 52 : 64) * Math.PI / 180; camera.fov = Math.min(100, Math.max(52, 2 * Math.atan(Math.tan(want / 2) / camera.aspect) * 180 / Math.PI)); camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); new ResizeObserver(resize).observe(host);
  let fpsN = 0, fpsT = 0, last = performance.now(), lastCalls = 0, lastTris = 0, secT = 0, flatN = 0, flatSum = 0, flatWorst = 0, rang = false;
  function frame() {
    const t0 = performance.now(), dt = t0 - last; last = t0;
    if (presenting) {
      fpsN++; if (t0 - fpsT >= 1000) { fpsNow = Math.round(fpsN * 1000 / (t0 - fpsT)); fpsN = 0; fpsT = t0; }
      if (!seated) {
        /* wait until the head is tracked and holding still for about half a second, then place the desk once */
        const el = t0 - sessT0; head.setFromMatrixPosition(camera.matrixWorld); D.set(0, 0, -1).transformDirection(camera.matrixWorld);
        if (el > 600 && head.y > 0.3) { still = (head.distanceTo(pHead) < 0.005 && D.dot(pDir) > 0.9997 && Math.abs(D.y) < 0.55) ? still + 1 : 0; pHead.copy(head); pDir.copy(D); if (still > 30 || el > 6000) placeSeat(); } else if (el > 6000) placeSeat();
      }
      else { if (recenterAt && t0 > recenterAt) { recenterAt = 0; placeSeat(); } xrInput(); if (t0 - sessT0 > 3000) { stat.n++; stat.sum += dt; if (dt > 20) stat.slow++; if (dt > stat.worst) stat.worst = dt; } }
    } else { camera.rotation.set(pitch, yaw, 0, 'YXZ'); flatN++; flatSum += dt; if (dt > flatWorst) flatWorst = dt; }
    if (t0 - secT > 250) {
      secT = t0; const now = Date.now();
      if (L.timerDone(S.timer, now)) { if (!rang) { rang = true; S.timer = L.timerReset(S.timer); audio(); chime(); say('Time is up. Nice work.', 6000); commit(P.front); } } else rang = false;
      if (DEV && flatN + stat.n > 0) statLine = presenting ? ` ${stat.slow}s ${stat.worst.toFixed(0)}w` : '';
      const k = stripKey(); if (k !== stripLast) { stripLast = k; strip.dirty = true; const st = $('dk-sheet-time'); if (st) st.textContent = L.mmss(L.timerLeft(S.timer, now)); }
      if (DEV) { const d = $('dk-dev'); if (d) { d.hidden = false; d.textContent = presenting ? '' : `${(1000 * flatN / Math.max(1, flatSum)).toFixed(0)} fps · worst ${flatWorst.toFixed(1)} ms · ${lastCalls} calls · ${lastTris} tris`; } flatN = 0; flatSum = 0; flatWorst = 0; }
    }
    for (let i = 0; i < surfaces.length; i++) { const p = surfaces[i]; if (p.dirty && (shown(p) || p === kbTop || !presenting)) { p.dirty = false; p.draw(); p.t.needsUpdate = true; break; } }
    for (let i = 0; i < frameHooks.length; i++) frameHooks[i](t0, dt);
    R.render(scene, camera); lastCalls = R.info.render.calls; lastTris = R.info.render.triangles;
    if (presenting && seated) { const cpu = performance.now() - t0; if (cpu > stat.cpuMax && t0 - sessT0 > 3000) stat.cpuMax = cpu; }
  }

  /* ---------- start ---------- */
  DM.neonEdge.color.set(S.desk.neon); DM.glow.color.set(S.desk.neon);
  if (navigator.xr) { try { vrOK = await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) { } try { arOK = await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { } }
  if (S.room === 'real' && !arOK) S.room = 'plain';
  $('dk-vr-btn').hidden = !vrOK; $('dk-vr-none').hidden = vrOK;
  if (innerWidth < 760) { $('dk-sheet').hidden = false; $('dk-sheet-btn').setAttribute('aria-expanded', 'true'); }
  reseat(1.2); applyRoom(); resize(); sheet.force = true; sheet(); surfaces.forEach((p) => { p.draw(); p.t.needsUpdate = true; p.dirty = false; R.initTexture(p.t); }); Object.values(TX).forEach((t) => R.initTexture(t));
  { const vis = {}; Object.keys(rooms).forEach((id) => { vis[id] = rooms[id].visible; rooms[id].visible = true; }); const dk = S.desk.style; const extra = new T.Group(); [DM.woodTop, DM.woodLeg, DM.metalTop, DM.metalLeg, DM.steelTop, DM.steelLeg, DM.blackTop, DM.blackLeg, ball.material, DM.neonTop, DM.neonSide, DM.neonEdge, DM.glow].forEach((m) => put(extra, box, m, 0.01, 0.01, 0.01, 0, -5, 0)); scene.add(extra); kb.mesh.visible = true; joints.count = 1;
    try { await R.compileAsync(scene, camera); } catch (e) { } R.render(scene, camera); scene.remove(extra); kb.mesh.visible = false; joints.count = 0; Object.keys(rooms).forEach((id) => { rooms[id].visible = vis[id]; }); void dk; }
  for (const m of APPS) { try { const mod = await import(m); mod.default(api); } catch (e) { console.error('desk app did not load', m, e); } }
  surfaces.forEach((p) => { if (p.dirty && p.draw) { p.draw(); p.t.needsUpdate = true; p.dirty = false; R.initTexture(p.t); } }); applyRoom(); layout();
  R.setAnimationLoop(frame); $('dk-load').hidden = true; setTimeout(() => { const h = $('dk-hint'); if (h) h.hidden = true; }, 9000);
  if (QA) window.__desk = { get S() { return S; }, act, P, surfaces, stat, info: () => ({ calls: lastCalls, tris: lastTris, programs: R.info.programs.length, textures: R.info.memory.textures, geometries: R.info.memory.geometries }), look: (y, p) => { yaw = y; pitch = p; }, key, get edit() { return edit; },
    dragTest: (o3, d3, steps) => { const o = ctl[0]; scene.updateMatrixWorld(true); ballW.setFromMatrixPosition(ball.matrixWorld); o.O.set(o3[0], o3[1], o3[2]); o.D.set(d3[0], d3[1], d3[2]).normalize(); head.setFromMatrixPosition(camera.matrixWorld); const g0 = ballW.distanceTo(o.O); drag = { i: 0, g0, r0: Math.hypot(o.O.x - head.x, o.O.z - head.z) }; for (let k = 0; k < steps; k++) dragStep(o); drag = null; o.line.visible = false; layout(); ballW.setFromMatrixPosition(ball.matrixWorld); const c = new T.Vector3(0, 0, FRONT - S.desk.d / 2).applyMatrix4(rig.matrixWorld); return { want: [o.O.x + o.D.x * g0, o.O.z + o.D.z * g0], ball: [ballW.x, ballW.z], centre: [c.x, c.z], head: [head.x, head.z], yaw: rig.rotation.y }; },
    dbg: () => ({ presenting, arSession, seated, drag: !!drag, grab: !!grab, gazeUp: r2(gazeUp), lift: r2(rig.position.y), sel: ctl.map((o) => o.sel), free: ctl.map((o) => o.free), edit: !!edit, fps: fpsNow, room: S.room, head: head.toArray().map(r2), ball: ballW.toArray().map(r2), ballVisible: ball.visible, rig: [r2(rig.position.x), r2(rig.position.z), r2(rig.rotation.y)], top: r2(seat.top), ctl: ctl.map((o) => ({ on: o.on, hand: o.isHand, vis: o.c.visible, ball: o.ball, near: o.near, hold: !!o.hold, O: o.O.toArray().map(r2), D: o.D.toArray().map(r2) })) }),
    boardTest: (name, o3, d3, to3, steps) => { const o = ctl[0]; layout(); o.O.set(o3[0], o3[1], o3[2]); o.D.set(d3[0], d3[1], d3[2]).normalize(); const h = rayHit(o.O, o.D); o.hd = hitDist; const reg = h ? regionAt(h) : null; if (!h || !reg || reg.act !== 'grip') return { miss: h ? h.name : null, region: reg && reg.act }; boardStart(0, o, reg.arg); o.D.set(to3[0], to3[1], to3[2]).normalize(); for (let k = 0; k < (steps || 1); k++) boardStep(o); boardEnd(); o.line.visible = false; return { name: reg.arg, b: S.boards[reg.arg] }; },
    grips, BRD, clearFix, apps, dock, api,
    home: () => { rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); layout(); },
    sim: (headY) => { presenting = true; edit = null; reseat(headY || 1.18); applyRoom(); all(); return seat; }, unsim: () => { presenting = false; reseat(1.2); all(); },
    poke: (name, px, py, z) => { const p = surfaces.find((s) => s.name === name); p.hx = px; p.hy = py; const r = regionAt(p); const f = L.pokeStep(p.poke[0], z, true); if (f && r) act(r.act, r.arg); return { fired: f, region: r && r.act }; },
    ray: (o, d) => { const p = rayHit(new T.Vector3(...o), new T.Vector3(...d).normalize()); return p ? { name: p.name, x: Math.round(p.hx), y: Math.round(p.hy), dist: +hitDist.toFixed(3), region: (regionAt(p) || {}).act || null } : null; },
    eyeDist: () => { scene.updateMatrixWorld(true); const e = new T.Vector3(0, seat.eye, 0).applyMatrix4(rig.matrixWorld); const o = {}; surfaces.forEach((p) => { if (p.touch) o[p.name] = +p.mesh.getWorldPosition(new T.Vector3()).distanceTo(e).toFixed(3); }); return o; } };
}

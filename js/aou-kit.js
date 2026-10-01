/* ============================================================
   allofus.one · kit: materials, water, Zach's paintings, models
   ============================================================ */
import { THREE, isMobile, makeTextTexture } from './aou-engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const T = THREE;
export const M = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
export const glow = (c, i = 1.4) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
export const basic = (c, o = {}) => new T.MeshBasicMaterial({ color: c, ...o });
export const glass = () => new T.MeshPhysicalMaterial({ color: 0xbfefff, transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false });
export const NEON = 0x38f0ff, PINK = 0xff4f79, GOLD = 0xffd23f, MINT = 0x7cff6b, VIOLET = 0xb08cff, ORANGE = 0xff8a3d, SKY = 0x38b6ff;
export const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; };
export const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, parent, seg = 20) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; };
export const sph = (r, mat, x = 0, y = 0, z = 0, parent, seg = 20) => { const m = new T.Mesh(new T.SphereGeometry(r, seg, Math.max(8, seg * 0.7 | 0)), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; };
export const plane = (w, h, mat, parent) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); if (parent) parent.add(m); return m; };
export function textPlane(lines, w, h, opts = {}) { const tex = makeTextTexture(lines, Object.assign({ w: 1024, h: Math.round(1024 * h / w) }, opts)); const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, side: opts.double ? T.DoubleSide : T.FrontSide })); m.userData.noCollide = true; return m; }

/* water: the same living shader as the mall lakes (waves, fresnel sky, sun glints, foam) */
export const waterMats = [];
export function waterMaterial(color = 0x1f7fbf, deep = 0x0b3f6e, opts = {}) {
  const m = new T.ShaderMaterial({
    uniforms: { t: { value: 0 }, c1: { value: new T.Color(color) }, c2: { value: new T.Color(deep) }, sun: { value: new T.Vector3(-0.5, 0.4, -0.75).normalize() }, night: { value: 0 } },
    transparent: true, side: opts.double ? T.DoubleSide : T.FrontSide,
    vertexShader: `uniform float t; varying vec3 vP;
      void main(){ vec3 p=position; vP=(modelMatrix*vec4(p,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.0);}`,
    fragmentShader: `uniform float t,night; uniform vec3 c1,c2,sun; varying vec3 vP;
      float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
      float wav(vec2 p){return vn(p*0.55+vec2(t*0.35,t*0.22))*0.55+vn(p*1.7-vec2(t*0.5,-t*0.31))*0.3+vn(p*4.3+vec2(-t*0.8,t*0.6))*0.15;}
      void main(){ vec2 p=vP.xz; float e=0.18; float h0=wav(p);
      vec3 n=normalize(vec3((h0-wav(p+vec2(e,0.0)))*2.2,1.0,(h0-wav(p+vec2(0.0,e)))*2.2));
      vec3 v=normalize(cameraPosition-vP); bool under=cameraPosition.y<vP.y; if(under){n=-n;}
      float nv=max(dot(n,v),0.0); float fr=clamp(0.06+pow(1.0-nv,3.0)*0.94,0.0,1.0);
      vec3 r=reflect(-v,n); float up=clamp(r.y,0.0,1.0); vec3 sky=mix(vec3(0.80,0.90,0.98),vec3(0.26,0.52,0.88),pow(up,0.55)); sky=mix(sky,vec3(0.05,0.08,0.2),night);
      vec3 body=mix(c2,c1,0.35+0.65*h0); body=mix(body,c1*1.25,pow(nv,3.0)*0.35);
      vec3 col=mix(body,sky,fr*0.85);
      vec3 hh=normalize(sun+v); float nh=max(dot(n,hh),0.0); col+=vec3(1.0,0.95,0.82)*(pow(nh,220.0)*2.4+pow(nh,32.0)*0.18)*(1.0-night*0.85);
      float foam=smoothstep(0.78,0.9,vn(p*0.9+vec2(t*0.2,0.0))*0.6+h0*0.5); col=mix(col,vec3(1.0),foam*0.18);
      if(under){ col=mix(vec3(0.2,0.55,0.75),col,0.35)+vec3(0.25,0.3,0.2)*pow(h0,3.0); gl_FragColor=vec4(col,0.75); return; }
      gl_FragColor=vec4(col,mix(0.84,0.97,fr)); }`
  });
  m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; waterMats.push(m); return m;
}
export function tickWater(dt, night) { for (const m of waterMats) { m.uniforms.t.value += dt; m.uniforms.night.value += ((night ? 1 : 0) - m.uniforms.night.value) * Math.min(1, dt * 2); } }

/* Zach's paintings (digital studies of his real canvases) — from the mall gallery */
const rr0 = (R) => (a, b) => a + R() * (b - a);
export function paintArt(style, seed, pal) {
  const W = isMobile() ? 320 : 512, H = Math.round(W * 0.72); const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); let s = seed * 7919 + 13; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; const P = (i) => pal[i % pal.length]; const rr = (a, b) => a + R() * (b - a);
  const stroke = (x, y, len, ang, wd, col, al = 0.8) => { g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, len, wd, 0, 0, 6.28); g.fill(); g.globalAlpha = al * 0.35; g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(-len * 0.2, -wd * 0.35, len * 0.6, wd * 0.25, 0, 0, 6.28); g.fill(); g.restore(); };
  g.fillStyle = P(0); g.fillRect(0, 0, W, H);
  if (style === 'drips') { for (let x = 0; x < W; x += 3) { const k = x / W; const col = k < 0.45 ? P(1) : k < 0.62 ? P(2) : P(3); g.globalAlpha = 0.9; g.fillStyle = col; g.fillRect(x, 0, 4, H); } for (let i = 0; i < 260; i++) { const x = rr(0, W); g.globalAlpha = rr(0.25, 0.7); g.fillStyle = P(1 + Math.floor(R() * 4)); g.fillRect(x, rr(-20, H * 0.6), rr(1, 5), rr(40, H)); } for (let i = 0; i < 90; i++) stroke(rr(W * 0.4, W * 0.7), rr(0, H), rr(8, 30), rr(1.2, 1.9), rr(2, 6), P(4), 0.6); }
  else if (style === 'impasto') { for (let i = 0; i < 520; i++) stroke(rr(0, W), rr(0, H), rr(14, 60), rr(-0.5, 0.5), rr(4, 13), P(Math.floor(R() * pal.length)), rr(0.5, 0.9)); for (let i = 0; i < 40; i++) stroke(rr(0, W), rr(0, H), rr(10, 30), rr(-0.3, 0.3), rr(1.5, 4), '#ffffff', 0.5); }
  else if (style === 'tree') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P(1)); gr.addColorStop(0.55, P(2)); gr.addColorStop(1, P(0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let i = 0; i < 200; i++) stroke(rr(0, W), rr(0, H), rr(10, 50), rr(-0.4, 0.4), rr(2, 6), P(1 + Math.floor(R() * 2)), 0.35); g.lineCap = 'round'; const branch = (x, y, a, len, wd, d) => { if (d > 7 || len < 5) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.strokeStyle = P(3 + (d % 2)); g.globalAlpha = 0.9; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x2, y2); g.stroke(); const n = d < 2 ? 3 : 2; for (let i = 0; i < n; i++) branch(x2, y2, a + rr(-0.9, 0.9), len * rr(0.62, 0.8), wd * 0.66, d + 1); }; branch(W * 0.55, H * 0.98, -Math.PI / 2, H * 0.27, W * 0.03, 0); for (let i = 0; i < 70; i++) { g.strokeStyle = P(4); g.globalAlpha = 0.45; g.lineWidth = rr(0.6, 2); g.beginPath(); const y = rr(H * 0.1, H * 0.9); g.moveTo(rr(0, W * 0.3), y); g.bezierCurveTo(W * 0.3, y + rr(-60, 60), W * 0.7, y + rr(-60, 60), rr(W * 0.7, W), y + rr(-30, 30)); g.stroke(); } }
  else if (style === 'horizon') { const hz = H * rr(0.52, 0.64); for (let i = 0; i < 380; i++) stroke(rr(0, W), rr(0, hz), rr(16, 70), rr(-0.15, 0.15), rr(3, 10), P(1 + Math.floor(R() * 2)), rr(0.45, 0.9)); for (let i = 0; i < 380; i++) stroke(rr(0, W), rr(hz, H), rr(8, 40), rr(-0.1, 0.1), rr(2, 7), P(3 + Math.floor(R() * 2)), rr(0.5, 0.9)); for (let i = 0; i < 70; i++) stroke(rr(0, W), hz + rr(-4, 10), rr(6, 22), 0, rr(1, 3), '#ffffff', 0.7); }
  else if (style === 'peaks') { const gr = g.createLinearGradient(0, 0, 0, H * 0.7); gr.addColorStop(0, P(1)); gr.addColorStop(1, P(2)); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let i = 0; i < 120; i++) stroke(rr(0, W), rr(0, H * 0.5), rr(20, 80), rr(-0.2, 0.2), rr(3, 9), P(1 + Math.floor(R() * 2)), 0.3); for (let L = 0; L < 3; L++) { const base = H * (0.5 + L * 0.14); g.globalAlpha = 1; g.fillStyle = L === 2 ? P(0) : P(3); g.beginPath(); g.moveTo(0, H); let x = 0; const pts = []; while (x <= W) { const y = base - Math.abs(Math.sin(x * 0.012 * (L + 1) + seed)) * H * (0.34 - L * 0.09) - rr(0, 14); pts.push([x, y]); g.lineTo(x, y); x += rr(10, 26); } g.lineTo(W, H); g.fill(); if (L < 2) for (const [px, py] of pts) if (py < base - H * 0.12) stroke(px, py + 8, rr(8, 20), 1.2, rr(3, 7), P(4), 0.85); } }
  else if (style === 'pollock') { g.lineCap = 'round'; for (let k = 0; k < 26; k++) { g.strokeStyle = P(1 + (k % (pal.length - 1))); g.globalAlpha = rr(0.6, 1); g.lineWidth = rr(1.5, 7); g.beginPath(); let x = rr(W * 0.1, W * 0.9), y = rr(H * 0.1, H * 0.9); g.moveTo(x, y); for (let i = 0; i < 9; i++) { const nx = clamp(x + rr(-W * 0.35, W * 0.35), 10, W - 10), ny = clamp(y + rr(-H * 0.4, H * 0.4), 10, H - 10); g.bezierCurveTo(x + rr(-90, 90), y + rr(-90, 90), nx + rr(-90, 90), ny + rr(-90, 90), nx, ny); x = nx; y = ny; } g.stroke(); } for (let i = 0; i < 160; i++) { g.globalAlpha = 0.9; g.fillStyle = P(1 + Math.floor(R() * (pal.length - 1))); g.beginPath(); g.arc(rr(0, W), rr(0, H), rr(1, 5), 0, 6.28); g.fill(); } }
  else if (style === 'stripes') { let x = 0, i = 1; while (x < W) { const w = rr(W * 0.05, W * 0.16); for (let k = 0; k < 40; k++) stroke(x + rr(0, w), rr(0, H), rr(30, 120), Math.PI / 2 + rr(-0.06, 0.06), rr(4, w * 0.3), P(i), rr(0.4, 0.85)); x += w * 0.8; i++; } }
  else if (style === 'crescent') { for (let i = 0; i < 2600; i++) { g.globalAlpha = rr(0.3, 0.8); g.fillStyle = P(1 + Math.floor(R() * 3)); g.fillRect(rr(0, W), rr(0, H), rr(2, 7), rr(2, 7)); } g.globalAlpha = 0.75; g.strokeStyle = P(4); g.lineWidth = W * 0.05; g.lineCap = 'round'; g.beginPath(); g.arc(W * 0.55, H * 0.5, H * 0.3, 1.2, 4.6); g.stroke(); g.globalAlpha = 0.4; g.lineWidth = W * 0.02; g.strokeStyle = '#fff'; g.beginPath(); g.arc(W * 0.55, H * 0.5, H * 0.33, 1.5, 4.2); g.stroke(); }
  else { const cx = W * rr(0.4, 0.6), cy = H * rr(0.35, 0.5); for (let r = H * 0.9; r > 8; r -= 7) { for (let k = 0; k < 26; k++) { const a = R() * 6.28; stroke(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rr(10, 26), a + 1.57, rr(3, 8), r < H * 0.24 ? P(1) : r < H * 0.4 ? P(2) : P(3 + Math.floor(R() * 2)), 0.75); } } }
  g.globalAlpha = 0.06; for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? '#000' : '#fff'; g.fillRect(rr(0, W), rr(0, H), 2, 2); } g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (isMobile()) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } return t;
}
export const ART = [

  ['Pulling Away', 'drips', ['#1f4fd1', '#e5261a', '#ff9a1f', '#1f6fd8', '#ffe14d'], 1], ['Endless Sea', 'impasto', ['#0b3fae', '#1457d8', '#2f86ff', '#0a2a80', '#9fd0ff'], 1], ['Vibrant Life', 'tree', ['#14106a', '#b3160f', '#1a1fae', '#c9861a', '#ffb347'], 1], ['Tide', 'horizon', ['#d8301a', '#ff5a1f', '#ffb01f', '#1f5fb8', '#0e3f8a'], 1], ['Spirit Tree', 'tree', ['#c21807', '#ff3b14', '#e5261a', '#ffb01f', '#ffd98a'], 1], ['Heavens Rain', 'peaks', ['#2a1a8a', '#ff1f3a', '#3f6fff', '#ff6a1f', '#ffb37a'], 1],
  ['Divided Sky', 'peaks', ['#3a1410', '#8a1a14', '#c9442a', '#5a2a1a', '#f4f4f8'], 1], ['Crescent Dreams', 'crescent', ['#f2a81f', '#ffc83d', '#ffe08a', '#e58a1f', '#f6d9a8'], 1], ['Space', 'pollock', ['#15100f', '#ffffff', '#f2f2f2', '#d8d8d8'], 1], ['Bleeding Colors', 'stripes', ['#bfe3f2', '#3fa8d8', '#7ccf9a', '#f2dc3d', '#1f4fa8', '#b3261a'], 1], ['Calling Souls', 'sun', ['#1f3fb8', '#ffb01f', '#ff6a1f', '#d8261a', '#7a1fa8'], 1], ['Deep Waters', 'impasto', ['#1a3a8a', '#2f5fd8', '#e8e0d0', '#c9661a', '#6a3fa8'], 1],
  ['Dancing Lights', 'tree', ['#3a2a5a', '#6a4a8a', '#c9661a', '#ff8a1f', '#ffc83d'], 1], ['Misty Mountain', 'peaks', ['#2f5a3a', '#d8442a', '#f2a88a', '#7fb8c9', '#ffffff'], 1], ['Light Escaping', 'stripes', ['#101a3a', '#c9261a', '#f2c88a', '#1f6fa8', '#2f8a5a', '#e8e8f2'], 1], ['Evaporating Color', 'drips', ['#7a1fa8', '#e5261a', '#ff3b8a', '#3f2fd8', '#ff9a1f'], 1], ['Sea on Fire', 'horizon', ['#f2c81f', '#ffb01f', '#ff8a1f', '#2f7fd8', '#9fd0ff'], 1], ['Blue Heaven', 'peaks', ['#0a1f5a', '#0b3fd8', '#1f6fff', '#1a2a4a', '#ffffff'], 1],
  ['No Borders', 'sun', ['#0b1a3a', '#ffd23f', '#38f0ff', '#ff4f79', '#7cff6b'], 0], ['One Sky', 'horizon', ['#ff8a3d', '#ffd23f', '#ff4f79', '#38b6ff', '#0b3f8a'], 0], ['195', 'pollock', ['#f4f1ea', '#e5261a', '#1f4fd1', '#ffb01f', '#2f8a5a'], 0], ['Cloud City', 'impasto', ['#cfe6ff', '#ffffff', '#9fd0ff', '#ffd9e8', '#38f0ff'], 0], ['The Descent', 'drips', ['#0b1a3a', '#38f0ff', '#ffffff', '#b08cff', '#ffd23f'], 0], ['Pax', 'crescent', ['#07123a', '#1e2a6a', '#38f0ff', '#2f6bff', '#ffd23f'], 0],
];
export const FAA = 'https://fineartamerica.com/profiles/zach-wennstedt';
export const artSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* models: cached, and trees can be stamped out as instanced meshes (one draw call per part) */
const loader = new GLTFLoader(); const cache = new Map();
export function loadGLB(url) { if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, (g) => res(g), undefined, rej))); return cache.get(url); }
export async function instanceKit(url, scaleTo = null) {
  const g = await loadGLB(url); const parts = []; g.scene.updateMatrixWorld(true);
  const bb = new T.Box3().setFromObject(g.scene); const h = bb.max.y - bb.min.y; const s = scaleTo ? scaleTo / Math.max(0.001, h) : 1;
  g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.translate(0, -bb.min.y, 0); geo.scale(s, s, s); parts.push({ geo, mat: o.material }); } });
  return { parts, height: h * s };
}
export function stamp(kit, list, parent) { // list: [{x,y,z,ry,s}]
  if (!kit || !list.length) return []; const out = []; const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
  for (const p of kit.parts) { const im = new T.InstancedMesh(p.geo, p.mat, list.length); im.userData.sharedGeo = true; im.userData.noCollide = true; im.castShadow = true; im.receiveShadow = true;
    list.forEach((it, i) => { e.set(0, it.ry || 0, 0); q.setFromEuler(e); v.set(it.x, it.y, it.z); sc.setScalar(it.s || 1); m4.compose(v, q, sc); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere && im.computeBoundingSphere(); parent.add(im); out.push(im); }
  return out;
}

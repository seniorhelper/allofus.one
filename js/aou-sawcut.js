/* ============================================================
   allofus.one · the saw-cut VR arrival (v1 · Oct 21 2026, approved by Zach from the preview the same day)
   Plugged into the shared VR layer (js/aou-xr.js) through opts.arrival; it returns the handle the layer expects:
   { active, card, skip(), dismiss(), done(), k(), parts }.
     0–0.8 s  the world goes dark around you; a 3.25 m slab of brushed steel stands 2.6 m ahead, a gantry saw moves in
     0.8–4.6  the saw traces every outline of "Allofus.one": velocity-stretched sparks that fork and bounce, a white-hot kerf that
              cools to black, the campfire flame (aou-fire.js shader) licking at the cut, smoke
     4.7–5.6  the letters drop out (orange-hot cut faces), tip back and land face-up at your feet
     5.0–6.0  light pours through the cut name
     6.3–7.45 the beam drops around you, rings rise, a flash, and the world is back
   The name's outlines are baked below (Montserrat 900, metres), so the headset needs no font. No light is added (a new light recompiles
   every shader on the Quest): the glow is emissive and additive, the world's own sun and sky light the steel. Nothing is shadowed.
   prepareSawcut(app) builds and compiles everything on the 2D page; the arrival itself only shows it. Any button skips to the beam.
   ============================================================ */
import { THREE } from './aou-engine.js';
const T = THREE;
const GLYPHS = [[-283,163,-284,162,-291,162,-293,160,-303,159,-326,149,-347,131,-354,121,-364,98,-365,87,-367,85,-367,72,-368,71,-369,63,-400,62,-400,-8,-368,-9,-368,-158,-271,-159,-271,-155,-271,-9,-224,-9,-222,-6,-222,62,-273,63,-274,71,-272,72,-272,77,-268,84,-257,90,-243,90,-231,86,-228,87,-215,127,-212,131,-206,148,-206,153,-218,159,-223,159,-230,162,-240,162,-241,163],[-949,160,-950,-158,-853,-159,-852,158,-854,160],[-809,160,-809,-158,-714,-159,-713,160],[-1194,142,-1196,140,-1200,127,-1226,71,-1230,58,-1236,48,-1240,35,-1246,25,-1250,12,-1256,2,-1260,-11,-1266,-21,-1271,-34,-1276,-44,-1281,-57,-1286,-67,-1291,-79,-1296,-89,-1301,-102,-1306,-112,-1306,-115,-1321,-145,-1325,-158,-1224,-159,-1220,-154,-1216,-140,-1202,-107,-1095,-107,-1087,-108,-1087,-111,-1084,-115,-1076,-141,-1068,-159,-965,-159,-965,-153,-971,-142,-975,-130,-981,-120,-985,-107,-991,-97,-995,-84,-1001,-74,-1006,-61,-1011,-51,-1016,-38,-1021,-28,-1021,-25,-1026,-18,-1030,-5,-1036,5,-1040,18,-1046,28,-1050,41,-1056,51,-1056,54,-1066,74,-1066,77,-1070,84,-1070,87,-1076,97,-1076,100,-1094,141],[-558,80,-559,79,-571,79,-572,77,-588,76,-615,66,-632,56,-657,32,-669,15,-677,-5,-680,-24,-682,-25,-682,-58,-680,-59,-679,-72,-673,-89,-669,-95,-665,-105,-656,-117,-634,-137,-611,-150,-587,-159,-572,-160,-571,-162,-556,-162,-555,-163,-534,-163,-505,-159,-483,-152,-459,-139,-433,-114,-425,-104,-417,-87,-412,-74,-412,-68,-410,-59,-410,-24,-411,-22,-412,-9,-418,8,-421,11,-425,21,-435,35,-448,47,-460,57,-479,67,-503,76,-518,77,-519,79,-532,79,-534,80],[196,80,194,79,174,77,148,70,133,63,117,52,106,39,96,21,95,6,93,5,95,-18,103,-38,107,-44,120,-54,141,-64,155,-67,157,-69,220,-77,226,-80,229,-87,223,-94,218,-96,211,-96,210,-97,186,-97,184,-96,174,-96,173,-94,165,-94,164,-93,154,-92,130,-83,117,-76,90,-140,108,-149,138,-158,144,-158,153,-160,161,-160,163,-162,176,-162,177,-163,198,-163,216,-163,217,-162,227,-162,229,-160,237,-160,239,-159,250,-158,263,-153,270,-149,273,-149,293,-136,307,-121,314,-108,318,-94,318,-72,317,-71,315,-59,308,-45,293,-30,283,-26,280,-23,264,-17,247,-14,246,-13,198,-7,186,-3,183,1,183,5,188,10,194,13,198,13,200,14,224,14,226,13,236,13,237,12,244,12,246,10,257,9,283,-3,309,61,293,69,273,75,267,75,266,76,249,77,247,79,231,79,230,80],[589,80,588,79,577,79,575,77,559,76,539,69,514,54,491,34,483,22,470,-6,468,-18,467,-19,467,-28,466,-29,466,-52,467,-54,467,-64,468,-65,470,-75,474,-88,481,-102,493,-118,512,-136,528,-146,551,-156,555,-156,568,-160,575,-160,577,-162,591,-162,592,-163,612,-163,614,-162,628,-162,630,-160,642,-159,671,-149,684,-142,700,-130,712,-118,726,-97,735,-75,736,-64,738,-62,738,-48,739,-47,738,-21,731,5,723,19,713,34,691,54,668,67,665,67,650,75,638,76,637,77,630,77,628,79,617,79,615,80],[919,80,918,79,905,77,889,70,886,70,872,62,863,53,862,76,769,75,770,-159,867,-158,867,-36,872,-18,882,-7,897,-1,915,-3,919,-6,928,-16,931,-26,932,-159,1029,-158,1029,-6,1027,-5,1027,4,1026,5,1026,11,1023,17,1021,25,1014,39,1007,49,995,62,986,67,971,75,960,77,955,77,953,79,946,79,945,80],[1184,80,1183,79,1171,79,1170,77,1155,76,1124,63,1107,52,1087,32,1080,22,1076,12,1072,6,1066,-12,1064,-28,1063,-29,1063,-51,1064,-52,1066,-69,1070,-84,1080,-104,1087,-114,1105,-132,1127,-146,1142,-153,1155,-156,1161,-159,1175,-160,1177,-162,1193,-162,1194,-163,1221,-163,1223,-162,1243,-160,1244,-159,1250,-159,1256,-156,1264,-155,1287,-143,1297,-136,1308,-125,1297,-115,1257,-74,1247,-82,1233,-89,1220,-90,1218,-92,1198,-92,1197,-90,1185,-89,1177,-84,1165,-72,1162,-67,1162,-64,1323,-64,1325,-61,1325,-24,1324,-22,1324,-14,1315,14,1302,34,1276,59,1253,70,1240,75,1223,77,1221,79,1214,79,1213,80],[-195,76,-196,-69,-195,-71,-193,-89,-186,-111,-176,-128,-170,-135,-158,-146,-142,-155,-125,-160,-111,-162,-110,-163,-78,-162,-59,-156,-45,-149,-32,-137,-31,-159,61,-159,62,-28,62,75,-35,76,-36,-48,-37,-49,-37,-55,-43,-68,-52,-77,-65,-82,-79,-80,-85,-77,-94,-67,-97,-59,-97,-52,-99,-51,-99,75],[-1145,42,-1147,39,-1153,21,-1156,17,-1160,2,-1175,-32,-1147,-33,-1117,-32,-1117,-29,-1123,-18,-1124,-11,-1130,1,-1132,8,-1134,12],[1190,14,1180,12,1171,6,1162,-6,1159,-16,1204,-17,1234,-17,1235,-15,1232,-6,1225,4,1214,12,1204,14],[-554,4,-565,0,-572,-6,-580,-18,-583,-26,-583,-36,-584,-38,-583,-55,-579,-68,-566,-82,-554,-87,-538,-87,-522,-80,-511,-65,-508,-57,-508,-49,-507,-48,-508,-25,-517,-8,-526,0,-538,4],[594,4,581,-1,572,-11,566,-22,566,-28,564,-29,564,-54,570,-69,581,-82,594,-87,610,-87,624,-82,635,-69,640,-51,640,-31,635,-14,624,-1,610,4],[379,-53,360,-60,350,-67,342,-77,335,-95,335,-120,338,-130,344,-140,350,-147,362,-156,376,-162,385,-162,386,-163,403,-162,415,-159,423,-155,430,-149,440,-138,447,-121,447,-111,448,-110,447,-94,440,-77,430,-66,422,-60,403,-53]];
const TL = { cut0: 0.8, cut1: 4.6, pop0: 4.7, popStep: 0.075, back0: 5.0, back1: 6.0, beam0: 6.3, flash: 7.45, end: 8.3 };
const W = 3.25, H = 2.05, DEPTH = 0.2, TEXT_Y = 1.42, SZ = -2.6, FRONT = SZ + DEPTH / 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const rr = (a, b) => a + (b - a) * Math.random();

const FIRE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
/* the campfire flame from js/aou-fire.js, with a fade */
const FIRE_FS = `uniform float t; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform float uA; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.1 + vec2(1.7,9.2); a *= 0.5; } return v; }
void main(){ vec2 uv = vUv; float x = uv.x*2.0-1.0; float y = uv.y;
  float n = fbm(vec2(uv.x*3.0 + sin(t*0.7)*0.3, uv.y*4.0 - t*2.2)); float n2 = fbm(vec2(uv.x*6.0 + 3.1, uv.y*7.0 - t*3.4));
  float width = 1.0 - y*0.85; float shape = 1.0 - smoothstep(0.0, width, abs(x) + (n-0.5)*0.9*y);
  float tongue = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.55 + n2*0.45, 1.0, y));
  float f = clamp(shape * tongue * (0.6 + n*0.9), 0.0, 1.0);
  vec3 col = mix(c0, c1, smoothstep(0.15, 0.55, f)); col = mix(col, c2, smoothstep(0.6, 0.95, f) * (1.0 - y*0.6));
  float a = smoothstep(0.08, 0.5, f); if (a < 0.02) discard; gl_FragColor = vec4(col * (1.2 + f), a * uA); }`;
const STREAK_VS = `attribute vec3 iPos; attribute vec3 iVel; attribute float iHeat; uniform float uShutter; uniform float uWidth; varying vec2 vUv; varying float vHeat;
void main(){ vHeat = iHeat; vUv = uv; vec4 vp = viewMatrix * modelMatrix * vec4(iPos, 1.0); vec3 vv = (viewMatrix * modelMatrix * vec4(iVel, 0.0)).xyz;
  vec2 d = vv.xy - vp.xy * (vv.z / min(vp.z, -0.05)); float l = length(d); vec2 dir = l > 1e-5 ? d / l : vec2(0.0, 1.0); vec2 sd = vec2(-dir.y, dir.x);
  float L = max(uWidth * 1.6, length(vv) * uShutter); float w = iHeat > 0.0 ? uWidth : 0.0; vp.xy += -dir * position.y * L + sd * position.x * w; gl_Position = projectionMatrix * vp; }`;
const STREAK_FS = `uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uCold; varying vec2 vUv; varying float vHeat;
void main(){ if (vHeat <= 0.0) discard; float x = abs(vUv.x * 2.0 - 1.0); float a = (1.0 - x * x) * mix(1.0, 0.15, vUv.y);
  vec3 c = vHeat > 0.5 ? mix(uMid, uHot, (vHeat - 0.5) * 2.0) : mix(uCold, uMid, vHeat * 2.0); gl_FragColor = vec4(c * a * (0.5 + 2.6 * vHeat), 1.0); }`;
const HEAT = 'vec3 heatCol(float h){ return vec3(smoothstep(0.0, 0.35, h), smoothstep(0.25, 0.75, h), smoothstep(0.6, 1.0, h)) * (0.3 + 2.6 * h); }';
const KERF_VS = 'attribute float aS; attribute float aSide; varying float vS; varying float vSide; void main(){ vS = aS; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const KERF_FS = `uniform float uHead; uniform float uCool; uniform float uFade; uniform float uHot; varying float vS; varying float vSide; ${HEAT}
void main(){ float age = uHead - vS; if (age < 0.0 || uFade <= 0.0) discard; float h = clamp(exp(-age / uCool) + uHot, 0.0, 1.0); vec3 c = mix(vec3(0.012, 0.01, 0.01), heatCol(h), smoothstep(0.02, 0.4, h)); gl_FragColor = vec4(c, uFade); }`;
const GLOW_FS = `uniform float uHead; uniform float uCool; uniform float uFade; uniform float uHot; varying float vS; varying float vSide; ${HEAT}
void main(){ float age = uHead - vS; if (age < 0.0) discard; float h = clamp(exp(-age / uCool) + uHot, 0.0, 1.0); float x = 1.0 - abs(vSide); gl_FragColor = vec4(heatCol(h) * pow(h, 1.6) * x * x * 0.55 * uFade, 1.0); }`;
const SHAFT_VS = 'uniform float uLen; uniform float uSpread; varying float vZ; void main(){ vZ = clamp(position.z, 0.0, 1.0); vec3 p = position; p.xy *= 1.0 + vZ * uSpread; p.z = vZ * uLen; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }';
const SHAFT_FS = 'uniform float uI; uniform vec3 uCol; varying float vZ; void main(){ float a = pow(1.0 - vZ, 2.2) * uI; gl_FragColor = vec4(uCol * a, 1.0); }';
const BEAM_VS = 'varying vec3 vL; varying vec2 vUv; void main(){ vUv = uv; vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const BEAM_FS = `uniform float uT; uniform float uBottom; uniform float uI; uniform vec3 uCol; varying vec3 vL; varying vec2 vUv;
void main(){ float d = vL.y - uBottom; if (d < 0.0) discard; float head = exp(-d * 1.6) * 2.5; float st = 0.55 + 0.45 * sin(vUv.x * 120.0 + uT * 4.0) * sin(vUv.x * 37.0 - uT * 2.3 + vL.y * 0.6);
  float a = uI * (0.25 + 0.75 * st) * (1.0 + head) * smoothstep(0.0, 0.25, d); gl_FragColor = vec4(uCol * a, 1.0); }`;

class Streaks {
  constructor(N, o) {
    this.N = N; this.o = o; const base = new T.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
    const g = new T.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.h = new Float32Array(N); this.life = new Float32Array(N); this.max = new Float32Array(N); this.temp = new Float32Array(N);
    this.ap = new T.InstancedBufferAttribute(this.p, 3); this.av = new T.InstancedBufferAttribute(this.v, 3); this.ah = new T.InstancedBufferAttribute(this.h, 1);
    [this.ap, this.av, this.ah].forEach((a) => a.setUsage(T.DynamicDrawUsage)); g.setAttribute('iPos', this.ap); g.setAttribute('iVel', this.av); g.setAttribute('iHeat', this.ah); g.instanceCount = N;
    this.mat = new T.ShaderMaterial({ uniforms: { uShutter: { value: o.shutter }, uWidth: { value: o.width }, uHot: { value: new T.Color(o.hot) }, uMid: { value: new T.Color(o.mid) }, uCold: { value: new T.Color(o.cold) } }, vertexShader: STREAK_VS, fragmentShader: STREAK_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    this.mesh = new T.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.next = 0;
  }
  clear() { this.life.fill(0); this.h.fill(0); this.ah.needsUpdate = true; }
  spawn(x, y, z, vx, vy, vz, life, temp = 1) { const i = this.next; this.next = (this.next + 1) % this.N; const j = i * 3; this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z; this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz; this.life[i] = this.max[i] = life; this.temp[i] = temp; }
  step(dt) {
    const o = this.o, p = this.p, v = this.v; let any = false;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.h[i] = 0; continue; } any = true;
      this.life[i] -= dt; const j = i * 3; v[j + 1] += o.grav * dt; const dr = 1 - o.drag * dt; v[j] *= dr; v[j + 1] *= dr; v[j + 2] *= dr;
      if (o.wobble) v[j] += Math.sin(this.life[i] * 7 + i) * o.wobble * dt;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      if (p[j + 1] < 0.004 && v[j + 1] < 0) { p[j + 1] = 0.004; v[j + 1] *= -0.3; v[j] *= 0.6; v[j + 2] *= 0.6; this.life[i] *= 0.85; }
      if (p[j + 2] < FRONT && p[j + 2] > FRONT - DEPTH && Math.abs(p[j]) < W / 2 && p[j + 1] < H && v[j + 2] < 0) { p[j + 2] = FRONT; v[j + 2] *= -0.4; }
      if (p[j + 2] > -0.35 && Math.abs(p[j]) < 0.6) this.life[i] = 0; /* never through the viewer's face */
      const k = Math.max(0, this.life[i] / this.max[i]); this.h[i] = this.life[i] > 0 ? Math.max(0.02, Math.pow(k, 0.7) * this.temp[i]) : 0;
      if (o.fork && this.h[i] > 0.35 && Math.random() < dt * o.fork) { for (let c = 0; c < 3; c++) this.spawn(p[j], p[j + 1], p[j + 2], v[j] * 0.4 + rr(-1.4, 1.4), v[j + 1] * 0.4 + rr(-1.4, 1.4), v[j + 2] * 0.4 + rr(-1.4, 1.4), rr(0.08, 0.2), this.h[i]); }
    }
    if (any || this._any) { this.ap.needsUpdate = this.av.needsUpdate = this.ah.needsUpdate = true; } this._any = any;
  }
}

const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; return t; };
const radial = (stops) => canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; } return a / 2; };
const inside = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i].y > p.y) !== (P[j].y > p.y)) && (p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / (P[j].y - P[i].y) + P[i].x)) c = !c; } return c; };

let KIT = null;
/* everything is built once, on the 2D page, and compiled against the world's lights */
export function prepareSawcut(app) {
  if (KIT) return KIT;
  const K = KIT = { mats: [], geos: [] }; const keepM = (m) => { K.mats.push(m); m.fog = false; return m; };
  const root = K.root = new T.Group(); root.visible = false; root.userData.introDome = true; root.userData.noCull = true; root.position.set(0, -500, 0); /* parked under the world while it is not playing (it is compiled with visible = true) */
  const tl = new T.TextureLoader(); const tex = (n, rep, srgb = true) => { const t = tl.load('/textures/' + n + '.jpg'); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = T.SRGBColorSpace; return t; };
  const conc = tex('concrete', 0.45), concN = tex('concrete-n', 0.6, false), heat = tex('concrete', 3);
  const brushed = canvasTex(512, 128, (g) => { g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 512, 128); for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '40,40,40' : '200,200,200') + ',' + (0.08 + Math.random() * 0.25) + ')'; g.fillRect(Math.random() * 512, Math.random() * 128, 20 + Math.random() * 120, 1); } }, false); brushed.wrapS = brushed.wrapT = T.RepeatWrapping; brushed.repeat.set(1.2, 4);
  /* steel: the aou-xr.js plate recipe (brushed roughness, clearcoat) over the world's concrete as mill scale */
  const cap = K.cap = keepM(new T.MeshPhysicalMaterial({ color: 0xc8d0da, map: conc, metalness: 1, roughness: 0.36, roughnessMap: brushed, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 1.25 }));
  const side = K.side = keepM(new T.MeshPhysicalMaterial({ color: 0x5c626a, metalness: 1, roughness: 0.6, envMapIntensity: 0.7, emissive: 0xff4a0a, emissiveMap: heat, emissiveIntensity: 0 }));
  const floorM = keepM(new T.MeshStandardMaterial({ map: tex('concrete', 0.6), normalMap: concN, roughness: 0.88, envMapIntensity: 0.25, color: 0x8a8a8a }));
  const floor = new T.Mesh(new T.CircleGeometry(6, 48), floorM); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.003; root.add(floor);
  /* the name: baked outlines (mm) -> outer contours with their holes */
  const loops = GLYPHS.map((a) => { const P = []; for (let i = 0; i < a.length; i += 2) P.push(new T.Vector2(a[i] / 1000, a[i + 1] / 1000)); return P; });
  const info = loops.map((P) => ({ P, a: Math.abs(area(P)), x: P.reduce((m, p) => Math.min(m, p.x), 1e9) }));
  info.forEach((c) => { c.depth = info.filter((o) => o !== c && o.a > c.a && inside(c.P[0], o.P)).length; });
  const outers = info.filter((c) => c.depth % 2 === 0).sort((a, b) => a.x - b.x), holes = info.filter((c) => c.depth % 2 === 1);
  outers.forEach((o) => { o.holes = holes.filter((h) => inside(h.P[0], o.P)); });
  const stage = K.stage = new T.Group(); stage.position.set(0, TEXT_Y, SZ); root.add(stage);
  const ext = (shape) => { const g = new T.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, steps: 1 }); g.translate(0, 0, -DEPTH / 2); return g; };
  const slabShape = new T.Shape([new T.Vector2(-W / 2, -TEXT_Y), new T.Vector2(W / 2, -TEXT_Y), new T.Vector2(W / 2, H - TEXT_Y), new T.Vector2(-W / 2, H - TEXT_Y)]); outers.forEach((o) => slabShape.holes.push(new T.Path(o.P)));
  stage.add(new T.Mesh(ext(slabShape), [cap, side])); holes.forEach((h) => stage.add(new T.Mesh(ext(new T.Shape(h.P)), [cap, side])));
  K.pieces = outers.map((o, i) => { const sh = new T.Shape(o.P); o.holes.forEach((h) => sh.holes.push(new T.Path(h.P))); const g = ext(sh); g.computeBoundingBox(); const c = new T.Vector3(); g.boundingBox.getCenter(c); c.z = 0; g.translate(-c.x, -c.y, 0); const m = new T.Mesh(g, [cap, side]); m.position.copy(c); stage.add(m); return { m, home: c.clone(), i, P: o.P }; });
  /* the cut path and its kerf ribbons */
  const segs = []; let s = 0, pen = null; const kp = [], kn = [], ks = [], kd = [], ki = []; const order = []; outers.forEach((o) => { order.push(o.P); o.holes.sort((a, b) => a.x - b.x).forEach((h) => order.push(h.P)); });
  for (let P of order) {
    if (pen) { let bi = 0, bd = 1e9; P.forEach((p, i) => { const d = p.distanceTo(pen); if (d < bd) { bd = d; bi = i; } }); P = P.slice(bi).concat(P.slice(0, bi)); const len = bd * 0.4; segs.push({ a: pen, b: P[0], s0: s, s1: s + len, travel: true }); s += len; }
    const Q = P.concat([P[0]]), n = Q.length, base = kp.length / 3, sv = [];
    for (let i = 0; i < n; i++) { if (i) { const d = Q[i].distanceTo(Q[i - 1]); segs.push({ a: Q[i - 1], b: Q[i], s0: s, s1: s + d, travel: false }); s += d; } sv.push(s); }
    for (let i = 0; i < n; i++) { const p = Q[i], a = Q[(i - 1 + n - 1) % (n - 1)], b = Q[(i + 1) % (n - 1)]; const tg = new T.Vector2().subVectors(p, a).normalize().add(new T.Vector2().subVectors(b, p).normalize()).normalize(); const nm = new T.Vector2(-tg.y, tg.x); for (const sd of [-1, 1]) { kp.push(p.x, p.y, DEPTH / 2 + 0.0015); kn.push(nm.x * sd, nm.y * sd); ks.push(sv[i]); kd.push(sd); } if (i < n - 1) { const k = base + i * 2; ki.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    pen = Q[n - 1];
  }
  K.segs = segs; K.L = s; K.kerfU = { uHead: { value: -1 }, uCool: { value: 1 }, uFade: { value: 1 }, uHot: { value: 0 } };
  const ribbon = (w, fs, add) => { const pos = new Float32Array(kp.length); for (let i = 0; i < kp.length / 3; i++) { pos[i * 3] = kp[i * 3] + kn[i * 2] * w; pos[i * 3 + 1] = kp[i * 3 + 1] + kn[i * 2 + 1] * w; pos[i * 3 + 2] = kp[i * 3 + 2] + (add ? 0.002 : 0); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aS', new T.Float32BufferAttribute(ks, 1)); g.setAttribute('aSide', new T.Float32BufferAttribute(kd, 1)); g.setIndex(ki); const m = new T.Mesh(g, keepM(new T.ShaderMaterial({ uniforms: K.kerfU, vertexShader: KERF_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, side: T.DoubleSide }))); m.renderOrder = add ? 5 : 4; m.frustumCulled = false; stage.add(m); return m; };
  ribbon(0.0035, KERF_FS, false); ribbon(0.03, GLOW_FS, true);
  /* light behind the slab and shafts through the holes */
  K.back = new T.Mesh(new T.PlaneGeometry(W * 0.96, H * 0.9), keepM(new T.MeshBasicMaterial({ color: 0x000000, toneMapped: false }))); K.back.position.set(0, H / 2 - TEXT_Y, -DEPTH / 2 - 0.35); stage.add(K.back);
  K.shaftU = { uLen: { value: 1.7 }, uSpread: { value: 0.12 }, uI: { value: 0 }, uCol: { value: new T.Color(0.75, 0.97, 1.0) } };
  const shaftM = keepM(new T.ShaderMaterial({ uniforms: K.shaftU, vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  outers.forEach((o) => { const sh = new T.Shape(o.P); o.holes.forEach((h) => sh.holes.push(new T.Path(h.P))); const m = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }), shaftM); m.position.z = -DEPTH / 2 - 0.3; m.renderOrder = 7; m.frustumCulled = false; stage.add(m); });
  /* the gantry and the cutting head */
  const dark = keepM(new T.MeshStandardMaterial({ color: 0x23262b, metalness: 0.7, roughness: 0.45 })), yellow = keepM(new T.MeshStandardMaterial({ color: 0xe0a21a, metalness: 0.3, roughness: 0.5 })), chrome = keepM(new T.MeshPhysicalMaterial({ color: 0x9aa2ab, metalness: 1, roughness: 0.25 }));
  const gz = FRONT + 0.3, gy = 2.42; const rail = new T.Mesh(new T.BoxGeometry(W + 0.7, 0.12, 0.12), yellow); rail.position.set(0, gy, gz); root.add(rail);
  for (const sx of [-1, 1]) { const post = new T.Mesh(new T.BoxGeometry(0.1, gy, 0.1), yellow); post.position.set(sx * (W / 2 + 0.3), gy / 2, gz); root.add(post); }
  K.carriage = new T.Mesh(new T.BoxGeometry(0.22, 0.2, 0.2), dark); K.carriage.position.set(0, gy, gz + 0.04); root.add(K.carriage);
  K.arm = new T.Mesh(new T.BoxGeometry(0.05, 1, 0.05), chrome); root.add(K.arm);
  K.head = new T.Group(); root.add(K.head);
  const discTex = canvasTex(256, 256, (g, S) => { g.fillStyle = '#2b2b2d'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill(); for (let r = 20; r < 128; r += 1.5) { g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '160,160,165') + ',' + Math.random() * 0.35 + ')'; g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); } g.fillStyle = '#b8bcc4'; g.beginPath(); g.arc(128, 128, 40, 0, 7); g.fill(); g.fillStyle = '#1d4f9c'; g.beginPath(); g.arc(128, 128, 34, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(128, 128, 9, 0, 7); g.fill(); });
  const discCap = keepM(new T.MeshStandardMaterial({ map: discTex, metalness: 0.35, roughness: 0.6 }));
  K.disc = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.005, 72), [keepM(new T.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.7 })), discCap, discCap]); K.disc.position.set(0, 0, 0.09); K.head.add(K.disc);
  const guard = new T.Mesh(new T.CylinderGeometry(0.152, 0.152, 0.04, 40, 1, true, -Math.PI / 2, Math.PI), keepM(new T.MeshStandardMaterial({ color: 0x2f3237, metalness: 0.8, roughness: 0.4, side: T.DoubleSide }))); guard.position.set(0, 0, 0.09); K.head.add(guard);
  const motor = new T.Mesh(new T.CylinderGeometry(0.06, 0.065, 0.2, 24), dark); motor.position.set(0, 0.12, 0.11); K.head.add(motor);
  const swivel = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.1, 20), chrome); swivel.rotation.x = Math.PI / 2; swivel.position.set(0, 0, 0.26); K.head.add(swivel);
  /* particles, campfire flames, smoke, contact glow */
  K.sparks = new Streaks(2200, { shutter: 0.02, width: 0.005, grav: -9.8, drag: 0.5, fork: 0.9, hot: 0xfff2dc, mid: 0xff8c1f, cold: 0xbf1f05 }); root.add(K.sparks.mesh); K.mats.push(K.sparks.mat);
  K.embers = new Streaks(600, { shutter: 0.012, width: 0.009, grav: 0.55, drag: 1.4, wobble: 1.6, hot: 0xffe0a0, mid: 0xff8a3d, cold: 0xa02000 }); root.add(K.embers.mesh); K.mats.push(K.embers.mat);
  const fgeo = new T.PlaneGeometry(1, 1); fgeo.translate(0, 0.5, 0); K.flames = [];
  for (let i = 0; i < 24; i++) { const u = { t: { value: i * 1.7 }, c0: { value: new T.Color(0xff3b00) }, c1: { value: new T.Color(0xffa21f) }, c2: { value: new T.Color(0xfff6c8) }, uA: { value: 0 } }; const m = new T.Mesh(fgeo, keepM(new T.ShaderMaterial({ uniforms: u, vertexShader: FIRE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }))); m.visible = false; m.renderOrder = 8; m.frustumCulled = false; root.add(m); K.flames.push({ m, u, life: 0, max: 1, w: 0.1, h: 0.2 }); }
  const smokeT = canvasTex(128, 128, (g) => { for (let i = 0; i < 26; i++) { const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 16 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }); K.smoke = [];
  for (let i = 0; i < 40; i++) { const sp = new T.Sprite(keepM(new T.SpriteMaterial({ map: smokeT, color: 0x5c5650, transparent: true, opacity: 0, depthWrite: false }))); sp.visible = false; root.add(sp); K.smoke.push({ sp, life: 0, max: 1, vx: 0, vy: 0, s0: 0.1, s1: 0.5, op: 0.3 }); }
  K.glow = new T.Sprite(keepM(new T.SpriteMaterial({ map: radial([[0, 'rgba(255,250,235,1)'], [0.2, 'rgba(255,200,120,0.85)'], [0.5, 'rgba(255,110,30,0.25)'], [1, 'rgba(255,60,0,0)']]), blending: T.AdditiveBlending, depthWrite: false, transparent: true }))); K.glow.renderOrder = 9; root.add(K.glow);
  K.splash = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), keepM(new T.MeshBasicMaterial({ map: radial([[0, 'rgba(255,170,90,0.55)'], [0.4, 'rgba(255,110,40,0.18)'], [1, 'rgba(255,80,0,0)']]), blending: T.AdditiveBlending, depthWrite: false, transparent: true }))); K.splash.renderOrder = 3; root.add(K.splash); /* the cut's light on the steel (no real light: no recompile) */
  /* beam, rings and the flash */
  K.beamU = { uT: { value: 0 }, uBottom: { value: 60 }, uI: { value: 0 }, uCol: { value: new T.Color(0.55, 0.95, 1.0) } };
  K.beam = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 60, 64, 1, true), keepM(new T.ShaderMaterial({ uniforms: K.beamU, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }))); K.beam.geometry.translate(0, 30, 0); K.beam.frustumCulled = false; K.beam.renderOrder = 10; root.add(K.beam);
  K.rings = [0, 1, 2].map(() => { const r = new T.Mesh(new T.TorusGeometry(0.95, 0.012, 8, 96), keepM(new T.MeshBasicMaterial({ color: 0x8ff6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }))); r.rotation.x = Math.PI / 2; r.renderOrder = 11; root.add(r); return r; });
  K.flash = new T.Mesh(new T.SphereGeometry(0.4, 16, 8), keepM(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: T.BackSide, toneMapped: false }))); K.flash.renderOrder = 1000; K.flash.frustumCulled = false; K.flash.visible = false;
  /* a solid dark dome 7.5 m around you, drawn first: it writes depth, so the world behind it never shows through, whatever the engine's culler does with visibility */ K.veil = new T.Mesh(new T.SphereGeometry(7.5, 32, 16), keepM(new T.MeshBasicMaterial({ color: 0x030405, side: T.BackSide }))); K.veil.renderOrder = -10; K.veil.frustumCulled = false; root.add(K.veil);
  root.traverse((o) => { o.userData.introDome = true; o.userData.noCull = true; if (o.isMesh || o.isSprite) o.frustumCulled = false; });
  /* steel needs something to reflect: the world's own sunset sky (textures/sky-sunset-2k.jpg) as its reflection map, whatever the page's environment is */
  const metals = [cap, side, chrome, discCap]; tl.load('/textures/sky-sunset-2k.jpg', (eq) => { try { eq.mapping = T.EquirectangularReflectionMapping; eq.colorSpace = T.SRGBColorSpace; const pm = new T.PMREMGenerator(app.renderer); const env = pm.fromEquirectangular(eq).texture; pm.dispose(); metals.forEach((m) => { m.envMap = env; m.needsUpdate = true; }); const R = app.renderer; if (R.compileAsync && root.parent) { const v = root.visible; root.visible = true; R.compileAsync(root, app.camera, app.scene).then(() => { root.visible = v; }, () => { root.visible = v; }); } } catch (e) { } });
  /* compile now (2D page), against the world's lights, so the first VR frame does not stall */
  try { app.scene.add(root); root.visible = true; const R = app.renderer; const done = () => { root.visible = false; }; if (R.compileAsync) R.compileAsync(root, app.camera, app.scene).then(done, done); else { R.compile(root, app.camera, app.scene); done(); } } catch (e) { root.visible = false; }
  return K;
}

/* the arrival itself */
export function sawcutArrival(app, cfg = {}) {
  const K = prepareSawcut(app); const R = app.renderer, scene = app.scene; const root = K.root;
  let t = 0, done = false, started = false, fast = false, S = { ang: 0, acc: 0, fl: 0, sm: 0, popped: new Set(), landed: new Set(), world: false };
  if (cfg.short) t = TL.beam0 - 0.2;
  /* the world goes away for the cut (lights stay: hiding one changes the light count = a full recompile) */
  const hidden = []; const hideWorld = () => { for (const o of scene.children) { if (o === root || o.isLight || o === app.camera || o === app.rig || o === app.player || !o.visible || (cfg.keep && cfg.keep.includes(o))) continue; if (o.userData && o.userData.introDome) continue; o.visible = false; hidden.push(o); } };
  const showWorld = () => { hidden.splice(0).forEach((o) => { o.visible = true; }); };
  const bg0 = scene.background, fog0 = scene.fog; let hemi0 = null;
  const begin = () => {
    started = true; const xc = R.xr.isPresenting ? R.xr.getCamera() : app.camera; const P = new T.Vector3(), D = new T.Vector3(); xc.getWorldPosition(P); xc.getWorldDirection(D); D.y = 0; if (D.lengthSq() < 1e-6) D.set(0, 0, -1); D.normalize();
    root.position.set(P.x, app.player.position.y, P.z); root.rotation.set(0, Math.atan2(-D.x, -D.z), 0); root.visible = true; if (!root.parent) scene.add(root);
    K.flash.visible = true; try { app.camera.add(K.flash); } catch (e) { }
    if (!cfg.short) { hideWorld(); scene.background = new T.Color(0x030405); scene.fog = null; try { if (app.hemi) { hemi0 = app.hemi.intensity; app.hemi.intensity = Math.max(hemi0, 0.95); } } catch (e) { } }
    K.sparks.clear(); K.embers.clear(); K.flames.forEach((f) => { f.life = 0; f.m.visible = false; }); K.smoke.forEach((s) => { s.life = 0; s.sp.visible = false; });
    K.pieces.forEach((p) => { p.m.position.copy(p.home); p.m.rotation.set(0, 0, 0); p.m.visible = true; });
    [K.stage, K.carriage, K.arm, K.head].forEach((o) => (o.visible = true)); K.veil.visible = !cfg.short; K.stage.visible = !cfg.short;
    if (cfg.short) [K.carriage, K.arm, K.head].forEach((o) => (o.visible = false));
  };
  const W2 = (p, z = FRONT) => new T.Vector3(p.x, TEXT_Y + p.y, z);
  const pathAt = (s) => { const a = K.segs; if (s <= 0) return { p: a[0].a, seg: a[0] }; if (s >= K.L) return { p: a[a.length - 1].b, seg: a[a.length - 1] }; let lo = 0, hi = a.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].s1 < s) lo = mid + 1; else hi = mid; } const g = a[lo]; return { p: new T.Vector2().lerpVectors(g.a, g.b, (s - g.s0) / Math.max(1e-9, g.s1 - g.s0)), seg: g }; };
  const flame = (pos, w, h, life) => { const f = K.flames.find((x) => x.life <= 0); if (!f) return; f.life = f.max = life; f.w = w; f.h = h; f.m.position.copy(pos); f.m.visible = true; };
  const smoke = (pos, o) => { const s = K.smoke.find((x) => x.life <= 0); if (!s) return; Object.assign(s, { life: o.life, max: o.life, vx: rr(-0.05, 0.05), vy: o.vy, s0: o.s0, s1: o.s1, op: o.op }); s.sp.position.copy(pos); s.sp.material.color.set(o.col); s.sp.visible = true; };
  const hap = (a, ms) => { try { cfg.haptic && cfg.haptic(a, ms); } catch (e) { } };
  const camQ = new T.Quaternion(), rootQ = new T.Quaternion();
  const fx = (dt) => {
    if (done) return; if (!started) begin(); dt = Math.min(dt, 0.05); t += dt * (fast ? 3 : 1); /* zones that finish building during the cut appear late: keep the dark clean */ if (!cfg.short && !S.world && ((S.rh = (S.rh || 0) + 1) % 15) === 0) hideWorld();
    if (fast && t < TL.beam0) t = TL.beam0;
    /* the cutting head */
    const cutting = t >= TL.cut0 && t < TL.cut1; const u = clamp01((t - TL.cut0) / (TL.cut1 - TL.cut0)); const sNow = K.L * u;
    K.kerfU.uHead.value = t < TL.cut0 ? -1 : sNow; K.kerfU.uCool.value = K.L / (TL.cut1 - TL.cut0) * 0.45;
    const { p, seg } = pathAt(sNow); let hp = W2(p), lift = 0;
    if (t < TL.cut0) { const k = smooth(0.15, TL.cut0, t); hp = new T.Vector3(-W / 2 - 0.1, 2.15, FRONT).lerp(W2(K.segs[0].a), k); lift = 0.05 * (1 - smooth(TL.cut0 - 0.12, TL.cut0, t)); }
    else if (!cutting) { const k = smooth(TL.cut1, TL.cut1 + 0.6, t); hp = W2(K.segs[K.segs.length - 1].b).lerp(new T.Vector3(W / 2 + 0.1, 2.15, FRONT), k); lift = 0.06 * smooth(TL.cut1, TL.cut1 + 0.15, t); }
    else if (seg.travel) lift = 0.045;
    if (cutting) { const d = new T.Vector2().subVectors(seg.b, seg.a); if (d.lengthSq() > 1e-10) { let diff = Math.atan2(d.y, d.x) - S.ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); S.ang += diff * Math.min(1, dt * 22); } }
    K.head.position.set(hp.x, hp.y, hp.z + lift); K.head.rotation.set(0, 0, S.ang); K.disc.rotation.y += dt * (t > 0.4 ? 160 : 40);
    K.carriage.position.x = hp.x; const top = 2.32, bot = hp.y + 0.2; K.arm.position.set(hp.x, (top + bot) / 2, FRONT + 0.26 + lift); K.arm.scale.y = Math.max(0.05, top - bot);
    const biting = cutting && !seg.travel; const ca = Math.cos(S.ang), sa = Math.sin(S.ang); const cp = new T.Vector3(hp.x - 0.105 * ca, hp.y - 0.105 * sa, FRONT + 0.004);
    if (biting) {
      if (!S.cutHap) { S.cutHap = true; hap(0.35, 3600); }
      S.acc += 1000 * dt; while (S.acc >= 1) { S.acc -= 1; const sp = rr(2.5, 7.5), lat = rr(-0.13, 0.13), up = rr(-0.18, 0.1); const lx = -0.82 + rr(-0.1, 0.1), lz = 0.42 + rr(-0.1, 0.15); K.sparks.spawn(cp.x, cp.y, cp.z, (lx * ca - lat * sa) * sp, (lx * sa + lat * ca) * sp + up * sp, lz * sp, rr(0.12, 0.6), rr(0.85, 1)); }
      if (Math.random() < dt * 30) K.embers.spawn(cp.x, cp.y, cp.z + 0.01, rr(-0.2, 0.2), rr(0.1, 0.5), rr(0, 0.3), rr(0.8, 1.8), rr(0.5, 0.8));
      S.fl += dt; if (S.fl > 0.085) { S.fl = 0; flame(W2(pathAt(Math.max(0, sNow - rr(0.015, 0.05))).p, FRONT + 0.006), rr(0.09, 0.15), rr(0.14, 0.26), rr(0.5, 0.9)); }
      S.sm += dt; if (S.sm > 0.07) { S.sm = 0; smoke(cp.clone().add(new T.Vector3(0, 0.04, 0.03)), { life: 2.2, vy: 0.32, s0: 0.06, s1: 0.55, op: 0.22, col: 0x5c5650 }); }
    }
    K.glow.visible = biting; K.glow.position.copy(cp).add(new T.Vector3(0, 0, 0.01)); K.glow.scale.setScalar(rr(0.07, 0.12));
    K.splash.visible = biting; K.splash.position.copy(cp).setZ(FRONT + 0.002); K.splash.material.opacity = rr(0.7, 1);
    K.kerfU.uFade.value = 1 - smooth(TL.pop0 - 0.05, TL.pop0 + 0.35, t); K.kerfU.uHot.value = 0.12 * smooth(TL.cut1 - 0.2, TL.cut1, t) * (1 - smooth(TL.cut1, TL.pop0 + 0.4, t));
    const sh = t < TL.pop0 ? 1 : Math.exp(-(t - TL.pop0) / 0.85); K.side.emissiveIntensity = 3.2 * Math.pow(sh, 1.3) * (t > TL.cut0 ? 1 : 0); K.side.emissive.setRGB(0.5 + 0.5 * sh, 0.04 + 0.5 * sh * sh, 0.02 * sh);
    /* the letters drop out */
    for (const pc of K.pieces) {
      const tp = TL.pop0 + pc.i * TL.popStep; if (t < tp) continue; const k = t - tp, m = pc.m;
      if (!S.popped.has(pc.i)) { S.popped.add(pc.i); const low = pc.P.filter((q) => q.y < pc.home.y - 0.02); for (let n = 0; n < 3; n++) { const q = (low.length ? low : pc.P)[Math.floor(Math.random() * (low.length || pc.P.length))]; flame(W2(q, FRONT + 0.03), rr(0.14, 0.2), rr(0.32, 0.48), rr(0.8, 1.2)); } for (let n = 0; n < 40; n++) { const q = pc.P[Math.floor(Math.random() * pc.P.length)]; K.embers.spawn(q.x, TEXT_Y + q.y, FRONT + 0.02, rr(-0.3, 0.3), rr(0.2, 0.9), rr(0, 0.6), rr(0.8, 2.0), rr(0.55, 0.9)); K.sparks.spawn(q.x, TEXT_Y + q.y, FRONT + 0.02, rr(-0.8, 0.8), rr(-0.2, 1.2), rr(0.4, 1.6), rr(0.25, 0.6), 0.9); } }
      const push = smooth(0, 0.2, k) * 0.13, tf = Math.max(0, k - 0.2), y0 = pc.home.y, yRest = -TEXT_Y + DEPTH / 2, fallT = Math.sqrt(2 * (y0 - yRest) / 9.8);
      if (tf < fallT) { m.position.set(pc.home.x, y0 - 4.9 * tf * tf, push + 0.6 * tf); m.rotation.x = -Math.PI / 2 * Math.pow(tf / fallT, 1.4); }
      else { const b = tf - fallT; m.position.set(pc.home.x, yRest + Math.max(0, Math.sin(b * 14) * 0.03 * Math.exp(-b * 7)), push + 0.6 * fallT); m.rotation.x = -Math.PI / 2; if (!S.landed.has(pc.i)) { S.landed.add(pc.i); hap(0.6, 40); const wp = new T.Vector3(pc.home.x, 0.05, SZ + m.position.z); for (let n = 0; n < 2; n++) smoke(wp.clone().add(new T.Vector3(rr(-0.12, 0.12), 0, rr(-0.1, 0.1))), { life: 1.6, vy: 0.12, s0: 0.12, s1: 0.6, op: 0.28, col: 0x4a4642 }); } }
    }
    const bl = smooth(TL.back0, TL.back1, t) * (1 - smooth(TL.flash, TL.flash + 0.3, t)); K.back.material.color.setRGB(2.2 * bl, 3.0 * bl, 3.4 * bl); K.shaftU.uI.value = 0.3 * bl;
    /* the beam */
    const bk = smooth(TL.beam0, TL.flash, t); K.beamU.uT.value = t; K.beamU.uBottom.value = 4.2 - 4.4 * Math.pow(bk, 1.3) + 30 * smooth(TL.flash + 0.2, TL.end, t); K.beamU.uI.value = 0.7 * smooth(TL.beam0, TL.beam0 + 0.3, t) * (1 - smooth(TL.flash + 0.3, TL.end, t));
    if (t > TL.beam0 && !S.beamHap) { S.beamHap = true; hap(0.5, 900); }
    K.rings.forEach((r, i) => { const kk = (t - TL.beam0 - 0.25 - i * 0.28) / 1.1; r.visible = kk > 0 && kk < 1; if (r.visible) { r.position.set(0, kk * 3.2, 0); r.material.opacity = Math.sin(kk * Math.PI) * 0.9; } });
    const fl = t < TL.flash - 0.35 ? 0 : t < TL.flash ? smooth(TL.flash - 0.35, TL.flash, t) : 1 - smooth(TL.flash + 0.05, TL.flash + 0.75, t); K.flash.material.opacity = fl;
    if (t >= TL.flash && !S.world) { S.world = true; showWorld(); scene.background = bg0; scene.fog = fog0; try { if (app.hemi && hemi0 !== null) app.hemi.intensity = hemi0; } catch (e) { } [K.stage, K.carriage, K.arm, K.head, K.veil].forEach((o) => (o.visible = false)); K.sparks.clear(); K.embers.clear(); K.flames.forEach((f) => { f.life = 0; f.m.visible = false; }); K.smoke.forEach((s) => { s.life = 0; s.sp.visible = false; }); H.active = false; hap(0.8, 120); }
    K.sparks.step(dt); K.embers.step(dt);
    /* flames and smoke face the viewer */
    const xc = R.xr.isPresenting ? R.xr.getCamera() : app.camera; xc.getWorldQuaternion(camQ); root.getWorldQuaternion(rootQ).invert(); camQ.premultiply(rootQ);
    for (const f of K.flames) { if (f.life <= 0) { f.m.visible = false; continue; } f.life -= dt; const kk = 1 - f.life / f.max; const env = smooth(0, 0.15, kk) * (1 - smooth(0.55, 1, kk)); f.u.t.value += dt; f.u.uA.value = env; f.m.scale.set(f.w * (0.8 + 0.2 * env), f.h * (0.4 + 0.6 * env), 1); f.m.quaternion.copy(camQ); }
    for (const s of K.smoke) { if (s.life <= 0) { s.sp.visible = false; continue; } s.life -= dt; const kk = 1 - s.life / s.max; s.sp.position.x += s.vx * dt; s.sp.position.y += s.vy * dt; s.sp.scale.setScalar(s.s0 + (s.s1 - s.s0) * Math.sqrt(kk)); s.sp.material.opacity = s.op * smooth(0, 0.12, kk) * (1 - kk); }
    if (t >= TL.end) H.done();
  };
  const H = {
    active: true, card: false, parts: K,
    k: () => t,
    skip: () => { if (fast || done) return; fast = true; H.active = false; },
    dismiss: () => { },
    done: () => { if (done) return; done = true; H.active = false; app.updaters = app.updaters.filter((u2) => u2 !== fx); if (!S.world) { showWorld(); scene.background = bg0; scene.fog = fog0; try { if (app.hemi && hemi0 !== null) app.hemi.intensity = hemi0; } catch (e) { } } root.visible = false; root.position.y = -500; K.flash.visible = false; try { app.camera.remove(K.flash); } catch (e) { } try { cfg.vignette && cfg.vignette(0); } catch (e) { } if (cfg.onDone) try { cfg.onDone(); } catch (e) { } },
  };
  app.onUpdate(fx); return H;
}

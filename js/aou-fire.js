/* 🔥 REAL FIRE (Oct 2026): a procedural-noise flame instead of orange cones. Two crossed billboards run a
   fractal-noise shader (licking tongues, dark base, white-hot core, soft alpha edges), a flickering light
   warms everything around it, and a heat-shimmer disc sits above. Cheap: 2 planes + 1 light, no textures. */
import { THREE } from './aou-engine.js';
const T = THREE;
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FRAG = `uniform float t; uniform float h; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.1 + vec2(1.7,9.2); a *= 0.5; } return v; }
void main(){ vec2 uv = vUv; float x = uv.x*2.0-1.0; float y = uv.y;
  float n = fbm(vec2(uv.x*3.0 + sin(t*0.7)*0.3, uv.y*4.0 - t*2.2)); float n2 = fbm(vec2(uv.x*6.0 + 3.1, uv.y*7.0 - t*3.4));
  float width = 1.0 - y*0.85; float shape = 1.0 - smoothstep(0.0, width, abs(x) + (n-0.5)*0.9*y);
  float tongue = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.55 + n2*0.45, 1.0, y));
  float f = clamp(shape * tongue * (0.6 + n*0.9), 0.0, 1.0);
  vec3 col = mix(c0, c1, smoothstep(0.15, 0.55, f)); col = mix(col, c2, smoothstep(0.6, 0.95, f) * (1.0 - y*0.6));
  float a = smoothstep(0.08, 0.5, f); if (a < 0.02) discard; gl_FragColor = vec4(col * (1.2 + f), a); }`;
export function makeFire(opts = {}) {
  const h = opts.height || 2.2, w = opts.width || 1.6; const g = new T.Group(); g.userData.noOcclude = true;
  const u = { t: { value: Math.random() * 10 }, h: { value: h }, c0: { value: new T.Color(opts.base || 0xff3b00) }, c1: { value: new T.Color(opts.mid || 0xffa21f) }, c2: { value: new T.Color(opts.core || 0xfff6c8) } };
  const mat = new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
  const geo = new T.PlaneGeometry(w, h); const planes = [];
  for (let i = 0; i < 2; i++) { const m = new T.Mesh(geo, mat); m.position.y = h / 2; m.rotation.y = i * Math.PI / 2; m.frustumCulled = false; m.renderOrder = 5; m.userData.noOcclude = true; g.add(m); planes.push(m); }
  const light = new T.PointLight(0xff8a3d, opts.light ?? 2.4, opts.lightDist || 16, 1.6); light.position.y = h * 0.45; g.add(light);
  // heat shimmer: a faint distorted disc above the flame
  const sh = new T.Mesh(new T.PlaneGeometry(w * 0.9, h * 0.6), new T.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.06, depthWrite: false, blending: T.AdditiveBlending })); sh.position.y = h * 1.05; sh.userData.noOcclude = true; g.add(sh);
  // base coals
  const coals = new T.Mesh(new T.CircleGeometry(w * 0.42, 16), new T.MeshStandardMaterial({ color: 0x2a1006, emissive: 0xff4500, emissiveIntensity: 1.6, roughness: 1 })); coals.rotation.x = -Math.PI / 2; coals.position.y = 0.06; g.add(coals);
  let acc = 0; g.userData.update = (dt, t, cam) => { acc += dt; u.t.value += dt * (opts.speed || 1); const fl = 0.85 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 23.7) * 0.05 + Math.sin(t * 2.3) * 0.04; light.intensity = (opts.light ?? 2.4) * fl; coals.material.emissiveIntensity = 1.2 + fl * 0.6; sh.material.opacity = 0.04 + Math.sin(t * 5) * 0.02; sh.rotation.y = t * 0.3; if (cam) { const p = g.getWorldPosition(_p); const dx = cam.x - p.x, dz = cam.z - p.z; const a = Math.atan2(dx, dz); planes[0].rotation.y = a; planes[1].rotation.y = a + Math.PI / 2; } };
  g.userData.light = light; g.userData.setIntensity = (k) => { mat.opacity = k; light.intensity = (opts.light ?? 2.4) * k; }; return g;
}
const _p = new T.Vector3();

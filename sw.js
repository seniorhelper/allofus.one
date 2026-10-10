/* App-like speed: the 3D engine, the VR layer, every world module, the vendored three.js, the skies and the key textures are
   precached on the first visit (versioned: bump V to ship a new set), then served instantly and refreshed in the background.
   Models, images and audio are cached on first use. Pages (navigations) always check the network first. Oct 2026. */
const V = 'v112';
const CORE = [
  '/vendor/three/three.module.min.js', '/vendor/three/jsm/webxr/VRButton.js', '/vendor/three/jsm/loaders/GLTFLoader.js', '/vendor/three/jsm/loaders/RGBELoader.js',
  '/vendor/three/jsm/postprocessing/EffectComposer.js', '/vendor/three/jsm/postprocessing/RenderPass.js', '/vendor/three/jsm/postprocessing/ShaderPass.js', '/vendor/three/jsm/postprocessing/UnrealBloomPass.js', '/vendor/three/jsm/postprocessing/OutputPass.js', '/vendor/three/jsm/postprocessing/Pass.js', '/vendor/three/jsm/postprocessing/MaskPass.js',
  '/js/aou-engine.js', '/js/aou-xr.js', '/js/aou-go.js', '/js/aou-icons.js', '/js/aou-lifevr.js', '/js/aou-terrain.js', '/js/aou-world.js', '/js/aou-life.js', '/js/aou-lumi.js', '/js/aou-social.js', '/js/aou-estate.js', '/js/aou-plus.js', '/js/aou-build.js', '/js/aou-conf.js', '/js/aou-sso.js', '/js/aou-config.js',
  '/js/aou-balloons.js', '/js/aou-blocks.js', '/js/aou-coaster.js', '/js/aou-family.js', '/js/aou-fire.js', '/js/aou-garden.js', '/js/aou-house.js', '/js/aou-hub.js', '/js/aou-jamoke.js', '/js/aou-kit.js', '/js/aou-lakes.js', '/js/aou-lifetools.js', '/js/aou-plants.js', '/js/aou-ski2.js', '/js/aou-sky.js', '/js/aou-streets.js', '/js/aou-studio.js', '/js/aou-truck.js', '/js/aou-unity.js', '/js/aou-voice.js', '/js/aou-work.js', '/js/aou-orbit3d.js', '/js/aou-party.js',
  '/textures/sky-day-2k.jpg', '/textures/sky-day-1k.hdr', '/textures/sky-sunset-2k.jpg', '/textures/sky-citrus-2k.jpg', '/images/realistic-night-sky-moon-stars-360.avif',
  '/textures/grass.jpg', '/textures/grass-n.jpg', '/textures/asphalt.jpg', '/textures/asphalt-n.jpg', '/textures/concrete.jpg', '/textures/stone.jpg', '/textures/wood.jpg', '/textures/sand.jpg', '/textures/snow.jpg', '/textures/dirt.jpg',
  '/images/allofus-lockup.png', '/images/allofus-mark.svg', '/images/sky.jpg',
];
self.addEventListener('install', (e) => { e.waitUntil((async () => { const c = await caches.open(V + '-core'); await Promise.all(CORE.map(async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); if (r && r.ok) await c.put(u, r); } catch (err) { } })); await self.skipWaiting(); })()); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
const cacheFirst = async (req, name) => { const c = await caches.open(name); const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; };
const networkFirst = async (req, name) => { const c = await caches.open(name); try { const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res; } catch (e) { const hit = await c.match(req); if (hit) return hit; throw e; } };
/* precached core: answer from the cache at once, refresh it in the background so the next visit has the newest build */
const swr = async (req, name) => { const c = await caches.open(name); const hit = await c.match(req); const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null); if (hit) return hit; const res = await net; if (res) return res; throw new Error('offline'); };
const CORE_SET = new Set(CORE);
self.addEventListener('fetch', (e) => { const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  if (u.origin === location.origin && CORE_SET.has(u.pathname)) { e.respondWith(swr(r, V + '-core')); return; }
  if (u.origin === location.origin && /^\/vendor\/three\//.test(u.pathname)) { e.respondWith(cacheFirst(r, V + '-core')); return; }
  if (u.origin === location.origin && /\.(glb|gltf|avif|webp|png|jpe?g|svg|woff2?|mp3|hdr)$/i.test(u.pathname)) { e.respondWith(cacheFirst(r, V + '-media')); return; }
  if (u.hostname === 'cdn.jsdelivr.net' && /@supabase\/supabase-js/.test(u.pathname)) { e.respondWith(swr(r, V + '-cdn')); return; }
  if (u.origin === location.origin && (/\.(js|json|css)$/i.test(u.pathname) || r.mode === 'navigate')) { e.respondWith(networkFirst(r, V + '-code')); return; }
});

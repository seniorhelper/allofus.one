/* ============================================================
   allofus.one · feed video autoplay + the feed card look (Oct 10 2026)
   - Feed videos start MUTED when at least 60% of them is on screen, pause when scrolled away, one at a time.
   - Tap the video: play / pause. Speaker button: sound on / off for that video; the last choice is remembered
     for this browser session (sessionStorage) and used for the next video when the browser allows it.
   - The member decides: "Autoplay videos" On · Wi-Fi only · Off. Stored in localStorage and, when signed in,
     in profiles.home.autoplay (the same JSON the app already saves; no new column, no migration).
     Default On, except Off for prefers-reduced-motion and Data Saver (saveData).
   - Wi-Fi only uses navigator.connection when the browser has it (cellular / saveData / 2g / 3g = not Wi-Fi);
     browsers without it (Safari, Firefox) are treated as On.
   ============================================================ */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (d, w = 20) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const AP_ICON = {
  dots: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>', 12),
  lock: S('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 12),
  play: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  mute: S('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>'),
  sound: S('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  full: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7"/>', 18),
  auto: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>', 18),
};
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const SS = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { } } };
const KEY = 'aou_autoplay', MUTE_KEY = 'aou_vmuted';
export const AP_OPTS = [['on', 'On'], ['wifi', 'Wi-Fi only'], ['off', 'Off']];
const valid = (v) => v === 'on' || v === 'wifi' || v === 'off';
const conn = () => { try { return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null; } catch (e) { return null; } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
export const apDefault = () => (reduced() || (conn() && conn().saveData)) ? 'off' : 'on';
export const apGet = () => { const v = LS.get(KEY); return valid(v) ? v : apDefault(); };
/* Wi-Fi (or as good as): no Data Saver, not cellular, not 2g/3g. No Network Information API = assume yes. */
export const onWifi = () => { const c = conn(); if (!c) return true; if (c.saveData) return false; if (c.type === 'cellular') return false; if (/(^|-)(2g|3g)$/.test(String(c.effectiveType || ''))) return false; return true; };
export const apAllowed = () => { const v = apGet(); return v === 'on' || (v === 'wifi' && onWifi()); };
let saveRemote = null, toastFn = null;
export const apSet = (v, o = {}) => { if (!valid(v)) return; LS.set(KEY, v); if (o.remote !== false && saveRemote) { try { saveRemote(v); } catch (e) { } } document.querySelectorAll('[data-ap]').forEach(b => { const on = b.dataset.ap === v; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('p', on); }); pick(); };
/* the account copy wins on load (same choice on every device the member signs in on) */
export const apFromAccount = (home) => { const v = home && home.autoplay; if (valid(v) && v !== LS.get(KEY)) LS.set(KEY, v); };
export const apLabel = (v = apGet()) => (AP_OPTS.find(o => o[0] === v) || [, 'On'])[1];
/* the settings control: three squared choices, a radiogroup */
export const apSettingHTML = () => { const cur = apGet(); return `<div class="fl-chips ap-set" role="radiogroup" aria-label="Autoplay videos">${AP_OPTS.map(([k, n]) => `<button type="button" class="fl-btn sm ${cur === k ? 'p' : ''}" role="radio" aria-checked="${cur === k}" data-ap="${k}">${n}</button>`).join('')}</div><p class="muted ap-note">Feed videos start muted when they scroll into view and stop when they leave. Wi-Fi only skips autoplay on mobile data or Data Saver. Tap any video to play it yourself.</p>`; };
/* menu items for a video post's ⋯ menu ([icon html, label, action]) */
export const apMenuItems = () => { const cur = apGet(); return AP_OPTS.map(([k, n]) => [cur === k ? AP_ICON.check : AP_ICON.auto, 'Autoplay videos: ' + n, 'ap-' + k]); };
export const apMenuAct = (a) => { const m = /^ap-(on|wifi|off)$/.exec(a || ''); if (!m) return false; apSet(m[1]); if (toastFn) toastFn('Autoplay videos: ' + apLabel(m[1]) + (m[1] === 'off' ? '. Tap a video to play it.' : '')); return true; };

/* ---------- the player markup ---------- */
export const videoHTML = (src, poster) => { const u = String(src || ''); const s = poster || /#/.test(u) ? u : u + '#t=0.1'; return `<div class="vp" data-vp><video src="${esc(s)}"${poster ? ` poster="${esc(poster)}"` : ''} muted playsinline webkit-playsinline preload="metadata" disablepictureinpicture></video><button type="button" class="vp-tap" aria-label="Play video"><span class="vp-big">${AP_ICON.play}</span></button><span class="vp-time" aria-hidden="true"></span><div class="vp-ctl"><button type="button" class="vp-btn" data-vfull aria-label="Full screen" title="Full screen">${AP_ICON.full}</button><button type="button" class="vp-btn" data-vsnd aria-label="Turn sound on" title="Sound">${AP_ICON.mute}</button></div><div class="vp-bar" aria-hidden="true"><i></i></div></div>`; };

/* ---------- the controller: one observer for every feed video on the page ---------- */
const ratio = new WeakMap(); const userPaused = new WeakSet(); const manual = new WeakSet(); const live = new Set(); let io = null, started = false;
const vidOf = (vp) => vp.querySelector('video');
const fmt = (s) => { if (!isFinite(s) || s < 0) return ''; s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const paint = (vp) => { const v = vidOf(vp); if (!v) return; const playing = !v.paused && !v.ended; vp.classList.toggle('playing', playing); const tap = vp.querySelector('.vp-tap'); tap.setAttribute('aria-label', playing ? 'Pause video' : 'Play video'); tap.querySelector('.vp-big').innerHTML = playing ? AP_ICON.pause : AP_ICON.play; const sb = vp.querySelector('[data-vsnd]'); sb.innerHTML = v.muted ? AP_ICON.mute : AP_ICON.sound; sb.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Turn sound off'); sb.setAttribute('aria-pressed', v.muted ? 'false' : 'true'); };
const tick = (vp) => { const v = vidOf(vp); if (!v) return; const d = v.duration; const bar = vp.querySelector('.vp-bar i'); if (bar) bar.style.width = (isFinite(d) && d ? (v.currentTime / d) * 100 : 0) + '%'; const t = vp.querySelector('.vp-time'); if (t) t.textContent = isFinite(d) && d ? fmt(d - v.currentTime) : ''; };
const pauseOthers = (keep) => { live.forEach(vp => { if (vp === keep) return; const v = vidOf(vp); if (v && !v.paused) v.pause(); }); };
const play = async (vp, how) => { const v = vidOf(vp); if (!v) return; pauseOthers(vp); if (how === 'auto') v.muted = SS.get(MUTE_KEY) !== '0'; try { await v.play(); } catch (e) { if (!v.muted) { v.muted = true; try { await v.play(); } catch (e2) { } } } paint(vp); };
/* choose the most visible feed video (>= 60%); everything else pauses */
function pick() { if (!started) return; const allowed = apAllowed() && document.visibilityState !== 'hidden'; let best = null, bestR = 0; live.forEach(vp => { if (!vp.isConnected) { live.delete(vp); return; } const r = ratio.get(vp) || 0; const v = vidOf(vp); if (!v) return; const isMan = manual.has(vp); if (!v.paused && ((isMan && r < 0.3) || (!isMan && r < 0.6) || document.visibilityState === 'hidden' || (!isMan && !apAllowed()))) v.pause(); if (allowed && r >= 0.6 && !userPaused.has(vp) && r > bestR) { best = vp; bestR = r; } }); if (!best) return; const playingManual = [...live].find(vp => manual.has(vp) && !vidOf(vp).paused && vp !== best && (ratio.get(vp) || 0) >= 0.3); if (playingManual) return; const v = vidOf(best); if (v.paused && !v.ended) { manual.delete(best); play(best, 'auto'); } }
const wire = (vp) => { if (vp.dataset.vpOn) return; vp.dataset.vpOn = '1'; const v = vidOf(vp); if (!v) return; live.add(vp); if (io) io.observe(vp);
  vp.querySelector('.vp-tap').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (v.paused || v.ended) { userPaused.delete(vp); manual.add(vp); if (v.ended) v.currentTime = 0; play(vp, 'tap'); } else { v.pause(); userPaused.add(vp); } });
  vp.querySelector('[data-vsnd]').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); v.muted = !v.muted; SS.set(MUTE_KEY, v.muted ? '1' : '0'); if (!v.muted && v.paused) { userPaused.delete(vp); manual.add(vp); play(vp, 'tap'); } paint(vp); });
  vp.querySelector('[data-vfull]').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); try { if (v.requestFullscreen) v.requestFullscreen(); else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); } catch (x) { } });
  ['play', 'pause', 'ended', 'volumechange'].forEach(ev => v.addEventListener(ev, () => { if (ev === 'play') pauseOthers(vp); paint(vp); }));
  v.addEventListener('timeupdate', () => tick(vp)); v.addEventListener('loadedmetadata', () => tick(vp)); paint(vp); };
const scan = (root) => { if (!root || root.nodeType !== 1) return; if (root.matches && root.matches('[data-vp]')) wire(root); root.querySelectorAll && root.querySelectorAll('[data-vp]').forEach(wire); };
/* start once per page. save(v) stores the choice on the account (optional); toast(m) shows a message (optional). */
export function apInit(o = {}) { if (o.save) saveRemote = o.save; if (o.toast) toastFn = o.toast; if (started) { pick(); return; } started = true;
  if ('IntersectionObserver' in window) io = new IntersectionObserver((ents) => { ents.forEach(e => { ratio.set(e.target, e.isIntersecting ? e.intersectionRatio : 0); if (!e.isIntersecting) userPaused.delete(e.target); }); pick(); }, { threshold: [0, 0.3, 0.6, 0.8, 1] });
  scan(document.body); new MutationObserver((ms) => { ms.forEach(m => m.addedNodes.forEach(scan)); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', pick);
  const c = conn(); if (c && c.addEventListener) c.addEventListener('change', pick);
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', pick); } catch (e) { }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-ap]'); if (!b) return; e.preventDefault(); apSet(b.dataset.ap); if (toastFn) toastFn('Autoplay videos: ' + apLabel(b.dataset.ap)); });
}

/* ---------- CSS: the player, plus the feed card layout (edge-to-edge on phones, header · text · media · stats · four actions) ---------- */
export const AUTOPLAY_CSS = `
.fl .fl-post{padding:12px 16px 0}
.fl .fl-post .who{gap:10px;margin-bottom:8px;align-items:center}.fl .fl-post .who .av{width:42px;height:42px}.fl .fl-post .who>div:nth-child(2){min-width:0;flex:1}
.fl .fl-post .who b{font:700 15px/1.25 var(--ff,Poppins,Arial);color:#0f172a;overflow:hidden;text-overflow:ellipsis}.fl .fl-post .who b small{font-weight:600}
.fl .fl-post .who .pmeta{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font:500 12.5px/1.3 var(--ff,Poppins,Arial);color:#64748b;margin-top:1px}.fl .fl-post .who .pmeta svg{flex:none;color:#64748b}.fl .fl-post .who .pmeta .sep{opacity:.7}
.fl .fl-post .who .pact{margin-left:auto;display:flex;gap:2px;align-self:flex-start;flex:none}
.fl .fl-post .who .pact button{width:36px;height:36px;min-height:36px;padding:0;border:0;background:transparent;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#475569;cursor:pointer;box-shadow:none}.fl .fl-post .who .pact button:hover{background:#f1f5f9;color:#0f172a}.fl .fl-post .who .pact [data-edit]{color:#b45309}
.fl .fl-post .txt{font-size:15px;line-height:1.5;color:#0f172a;white-space:pre-line;overflow-wrap:anywhere}
.fl .fl-post .txt.clamp{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.fl .fl-post .seemore{border:0;background:none;padding:2px 0;margin:0;font:700 14.5px var(--ff,Poppins,Arial);color:#475569;cursor:pointer}.fl .fl-post .seemore:hover{text-decoration:underline}
.fl .fl-post .pics{margin:10px -16px 0}
.fl .fl-post .vid{display:block;margin:10px -16px 0;width:calc(100% + 32px);max-width:none;border-radius:0}
.fl .fl-post .lpv{display:flex;align-items:center;gap:12px;margin:10px -16px 0;padding:12px 16px;background:#f0f2f5;color:#0f172a;text-decoration:none;border-top:1px solid #e4e7ec;border-bottom:1px solid #e4e7ec}.fl .fl-post .lpv:hover{background:#e9edf2}
.fl .fl-post .lpv .lpv-t{flex:1;min-width:0}.fl .fl-post .lpv small{display:block;font:600 11.5px var(--ff,Poppins,Arial);letter-spacing:.04em;text-transform:uppercase;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fl .fl-post .lpv b{display:block;font:700 14.5px/1.3 var(--ff,Poppins,Arial);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fl .fl-post .lpv .lpv-btn{flex:none;background:#e2e6ec;border-radius:8px;padding:9px 14px;font:700 13.5px var(--ff,Poppins,Arial);color:#0f172a}
.fl .fl-post .pics+.vp,.fl .fl-post .vp+.vp{margin-top:2px}
.fl .fl-post .pstats{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0;padding:10px 0 8px;min-height:0;font:500 13.5px var(--ff,Poppins,Arial);color:#64748b}
.fl .fl-post .pstats .rleft{display:flex;align-items:center;gap:6px}.fl .fl-post .pstats .rchips i{font-size:15px;margin-right:-6px;box-shadow:0 0 0 2px #fff}
.fl .fl-post .pstats .pcnt{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;margin-left:auto}.fl .fl-post .pstats .pcnt:hover{text-decoration:underline}
.fl .fl-post .pstats:has(.rleft:empty):has(.pcnt[hidden]){padding:4px 0 0}
.fl .fl-post .acts4{border-top:1px solid #e4e7ec;margin:0 -8px;padding:4px 0}.fl .fl-post .acts4>button,.fl .fl-post .acts4 .rwrap>button{border-radius:8px}
.fl .fl-post .cmts{border-top:1px solid #e4e7ec;margin:0 -16px;padding:8px 16px 10px}
.fl .fl-post .rpop{margin:6px 0}
.fl .fl-post .phid,.fl .phid{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font:600 14px var(--ff,Poppins,Arial);color:#334155}
.fl .phid-card{background:#fff;border:1px solid #e1e6ee;border-radius:12px;padding:14px 16px;margin-bottom:12px}.fl .phid-card .muted{font-weight:500;font-size:13px;flex:1 1 200px}.fl .phid-card button{border-radius:8px}
/* the player */
.vp{position:relative;margin:10px -16px 0;background:#000;line-height:0;overflow:hidden;user-select:none;-webkit-user-select:none}
.vp video{display:block;width:100%;max-height:min(78vh,640px);object-fit:contain;background:#000;border-radius:0!important;margin:0}
.vp .vp-tap{position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:0}
.vp .vp-big{width:64px;height:64px;border-radius:50%;background:rgba(6,16,31,.55);color:#fff;display:flex;align-items:center;justify-content:center;transition:opacity .2s;backdrop-filter:blur(2px)}
.vp.playing .vp-big{opacity:0}.vp.playing .vp-tap:focus-visible .vp-big,.vp.playing:hover .vp-big{opacity:.85}
.vp .vp-tap:focus-visible{outline:3px solid #38f0ff;outline-offset:-3px}
.vp .vp-ctl{position:absolute;right:10px;bottom:12px;display:flex;gap:8px;z-index:2}
.vp .vp-btn{width:38px;height:38px;border:0;border-radius:10px;background:rgba(6,16,31,.62);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.vp .vp-btn:hover{background:rgba(6,16,31,.82)}.vp .vp-btn:focus-visible{outline:3px solid #38f0ff;outline-offset:1px}
.vp .vp-time{position:absolute;left:10px;bottom:14px;z-index:2;background:rgba(6,16,31,.62);color:#fff;border-radius:6px;padding:3px 7px;font:700 12px/1.2 var(--ff,Poppins,Arial);pointer-events:none}.vp .vp-time:empty{display:none}
.vp .vp-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.25);pointer-events:none}.vp .vp-bar i{display:block;height:100%;width:0;background:#38f0ff}
.ap-set{margin-top:4px}.ap-note{font-size:12px;margin-top:6px}
/* phones: posts run edge to edge, split by a thin gray rule (no floating cards) */
@media(max-width:760px){
.fl .fl-post{margin:0 -8px 8px;border-radius:0;border-left:0;border-right:0;box-shadow:none;padding:12px 12px 0}
.fl .fl-post .pics,.fl .fl-post .vp,.fl .fl-post .lpv{margin-left:-12px;margin-right:-12px}.fl .fl-post .vid{margin-left:-12px;margin-right:-12px;width:calc(100% + 24px)}.fl .fl-post .lpv{padding:12px}
.fl .fl-post .acts4{margin:0 -4px}.fl .fl-post .cmts{margin:0 -12px;padding:8px 12px 10px}
.fl .phid-card{margin:0 -8px 8px;border-radius:0;border-left:0;border-right:0}
}
@media(prefers-reduced-motion:reduce){.vp .vp-big{transition:none}}
`;

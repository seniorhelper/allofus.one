/* allofus.one · "Take the tour" (v27, Oct 23 2026)
   A 12-step spotlight tour of the whole platform: an overlay with a cut-out around the real element plus a card
   (title, two lines, Back / Next / Skip, progress dots). Keyboard (arrows, Enter, Esc), touch (swipe), and a
   mini preview card with an inline illustration + "Open it" when the step's element is not on the current view,
   so the tour never navigates away. Remembers completion in localStorage. Offers itself ONCE: to a new member
   after the short onboarding, and to an anonymous visitor on their 2nd visit. Never nags.
   Start it from anywhere with /?tour=1, a [data-tour] button, or window.AOU_TOUR.start(). No library. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s);
const DONE = 'aou_tour2_done', OFFERED = 'aou_tour2_offered', VISITS = 'aou_visits';
const WVM = 'https://worldvrmall.com/?utm_source=allofus&utm_medium=referral&utm_campaign=tour&utm_content=world_step';
const mobile = () => matchMedia('(max-width:1000px)').matches;
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

/* ---------- illustrations (inline SVG, drawn in code) ---------- */
const ART = {
  feed: '<rect x="8" y="10" width="104" height="18" rx="5" fill="#dbeafe"/><rect x="8" y="34" width="104" height="18" rx="5" fill="#e0f2fe"/><rect x="8" y="58" width="104" height="18" rx="5" fill="#f1f5f9"/><circle cx="18" cy="19" r="5" fill="#0369a1"/><circle cx="18" cy="43" r="5" fill="#0ea5e9"/><circle cx="18" cy="67" r="5" fill="#94a3b8"/>',
  circles: '<circle cx="36" cy="40" r="22" fill="#fce7f3" stroke="#e11d48" stroke-width="2"/><circle cx="76" cy="40" r="22" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/><circle cx="56" cy="40" r="5" fill="#0b1a3a"/><circle cx="26" cy="40" r="4" fill="#e11d48"/><circle cx="86" cy="40" r="4" fill="#7c3aed"/>',
  board: '<rect x="10" y="10" width="44" height="28" rx="6" fill="#fef3c7"/><rect x="62" y="10" width="48" height="28" rx="6" fill="#dcfce7"/><rect x="10" y="44" width="100" height="26" rx="6" fill="#e0f2fe"/><path d="M18 24h28M70 24h30M18 57h60" stroke="#0b1a3a" stroke-width="3" stroke-linecap="round" opacity=".5"/>',
  work: '<path d="M36 12l26 15v30L36 72 10 57V27z" fill="#ccfbf1" stroke="#14b8a6" stroke-width="2"/><path d="M84 20l22 13v26L84 72 62 59V33z" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>',
  brand: '<path d="M14 36l6-18h80l6 18" fill="#e0e7ff" stroke="#6366f1" stroke-width="2"/><rect x="20" y="36" width="80" height="36" fill="#fff" stroke="#6366f1" stroke-width="2"/><rect x="48" y="50" width="24" height="22" fill="#6366f1" opacity=".5"/>',
  groups: '<circle cx="60" cy="22" r="10" fill="#bbf7d0"/><circle cx="30" cy="56" r="10" fill="#bbf7d0"/><circle cx="90" cy="56" r="10" fill="#bbf7d0"/><path d="M52 30 38 48M68 30l14 18M40 56h40" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>',
  call: '<rect x="12" y="18" width="60" height="44" rx="8" fill="#fee2e2"/><path d="M72 32l32-14v44L72 48z" fill="#fecaca"/><circle cx="42" cy="40" r="9" fill="#ef4444"/>',
  spaces: '<path d="M60 10l44 20-44 20-44-20z" fill="#99f6e4"/><path d="M16 42l44 20 44-20" fill="none" stroke="#0d9488" stroke-width="3"/><path d="M16 56l44 20 44-20" fill="none" stroke="#0d9488" stroke-width="3" opacity=".6"/>',
  world: '<path d="M60 8l40 22v36L60 88 20 66V30z" fill="#cffafe" stroke="#06b6d4" stroke-width="2"/><path d="M20 30l40 22 40-22M60 52v36" fill="none" stroke="#06b6d4" stroke-width="2"/>',
  moments: '<rect x="14" y="20" width="92" height="52" rx="10" fill="#fce7f3"/><circle cx="60" cy="46" r="15" fill="#fff" stroke="#ec4899" stroke-width="3"/><circle cx="60" cy="46" r="6" fill="#ec4899"/>',
  data: '<path d="M60 8l36 14v24c0 20-15 36-36 42C39 82 24 66 24 46V22z" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/><path d="M44 46l10 10 22-22" fill="none" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  ask: '<path d="M100 40a40 30 0 0 1-58 27L20 76l7-23A40 30 0 1 1 100 40z" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/><path d="M44 36h32M44 48h20" stroke="#0369a1" stroke-width="4" stroke-linecap="round"/>',
  spark: '<circle cx="60" cy="42" r="26" fill="#fef9c3" stroke="#f59e0b" stroke-width="2"/><path d="M48 46c4 6 8 8 12 8s8-2 12-8" fill="none" stroke="#b45309" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="36" r="2.5" fill="#b45309"/><circle cx="70" cy="36" r="2.5" fill="#b45309"/>'
};
const art = (k) => `<svg class="tr-art" viewBox="0 0 120 90" aria-hidden="true">${ART[k] || ART.feed}</svg>`;

/* ---------- the steps ----------
   sel(): CSS selector(s) for the real element on the current page (desktop first, then phone). href: where the
   feature lives (the preview card's "Open it"). art: illustration when the element is not on screen. */
const STEPS = [
  { k: 'feed', t: 'Your feed, newest first', p: 'No hidden ranking. Pick who you see, mute words, and open "Why am I seeing this?" on any post. The feed is yours to tune.', sel: () => '.fl-filters, #f-feed', href: '/', art: 'feed' },
  { k: 'circles', t: 'Circles keep audiences apart', p: 'Family, Inner Tribe, Professional, Local. Post to one circle and only that circle sees it. Nobody is told which circles they are in.', sel: () => '.ux-q[href="/?v=circles"], a.ux-row[href="/?v=circles"]', href: '/?v=circles', art: 'circles' },
  { k: 'board', t: 'LIFEboard: your private dashboard', p: 'Goals, habits, a life wheel, vision board, journal and money tools. Private to you, and the same board shows up in 3D and VR.', sel: () => mobile() ? '.ux-q[href="/?v=board"]' : '.fl-top [data-v="board"], .ux-q[href="/?v=board"]', href: '/?v=board', art: 'board' },
  { k: 'work', t: 'FLOWworks: pads for getting things done', p: 'Sketch, plan and track on tiles you lay out yourself. Great for a project, a small team or a Saturday plan.', sel: () => 'a.ux-row[href="/?v=work"]', href: '/?v=work', art: 'work' },
  { k: 'brand', t: 'A free Brand page, and a way to grow', p: 'Every business gets a real page with SEO schema, buttons and FAQs. "Grow your business" adds free listings, press releases and 60-second lead follow-up.', sel: () => mobile() ? '.ux-q[href="/?v=grow"]' : '.fl-top [data-v="brand"], .ux-q[href="/?v=grow"]', href: '/?v=grow', art: 'brand' },
  { k: 'groups', t: 'Groups: buy, sell, trade and free', p: 'Local groups with no fees and no pay-to-play. Join, post, meet at a safe spot. Report in one tap if something feels off.', sel: () => mobile() ? 'a.ux-row[href="/?v=groups"]' : '.fl-top [data-v="groups"], a.ux-row[href="/?v=groups"]', href: '/?v=groups', art: 'groups' },
  { k: 'call', t: 'Unity Call: free video calls', p: 'One link, no download, no time limit. Open it, share the link, talk.', sel: () => 'a.ux-row[href="/meet/"]', href: '/meet/', art: 'call' },
  { k: 'spaces', t: 'Spaces and the Global Room', p: 'A home for any group or team: its own feed, events and courses. The Global Room puts everyone on one wall for a presentation or a watch party.', sel: () => 'a.ux-row[href="/?v=spaces"]', href: '/?v=spaces', art: 'spaces' },
  { k: 'world', t: 'A 3D world, in your browser or a headset', p: `Walk, build a house, meet people. Put on a Quest for VR. Shopping in 3D? Visit <a href="${WVM}" target="_blank" rel="sponsored noopener">World VR Mall</a>, built by the same team.`, sel: () => '.ms, a.ux-row[href="/world/"]', href: '/world/', art: 'world', html: true },
  { k: 'moments', t: 'Moments: faces, backdrops, quick clips', p: 'Fast, fun posts with a camera and a backdrop. Share one to your feed or a circle.', sel: () => '.ux-q[href="/moments/"], a.ux-row[href="/moments/"]', href: '/moments/', art: 'moments' },
  { k: 'data', t: 'Your data, your graph', p: 'Download everything in one tap. No ad trackers, never sold, no rage-bait ranking. Soon: sign your export with your own key so it is verifiable anywhere.', sel: () => 'a.ux-row[href="/?v=mydata"]', href: '/?v=mydata', art: 'data' },
  { k: 'ask', t: 'Ask allofus, any time', p: 'The hand in the corner is the guide. Ask how anything works. Real answers, and it tells you when it is an AI.', sel: () => '#orbit-tab, #orbit', href: '/?v=spark', art: 'ask' }
];
const END = { t: 'That is the tour. Where to first?', p: 'Three good first moves:' , links: [['/?v=spark', 'Open LIFEspark: your daily spark', 'spark'], ['/?v=circles', 'Set up your circles', 'circles'], ['/?v=grow', 'Grow your business', 'brand']] };

export const TOUR_CSS = `
.tr-ov{position:fixed;inset:0;z-index:100000;font-family:Poppins,Arial,sans-serif}
.tr-hole{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(8,20,41,.72),0 0 0 3px #38f0ff,0 0 24px 4px rgba(56,240,255,.45);transition:all .25s ease;pointer-events:none}
.tr-hole.none{box-shadow:0 0 0 9999px rgba(8,20,41,.78)}
.tr-card{position:fixed;width:min(380px,calc(100vw - 24px));background:#fff;color:#0f172a;border-radius:18px;box-shadow:0 30px 80px rgba(2,8,30,.45);padding:16px 18px 14px;transition:top .25s ease,left .25s ease;outline:0}
.tr-card .k{font:800 10.5px/1 Poppins,Arial;letter-spacing:.09em;text-transform:uppercase;color:#0369a1;margin:0 0 6px}
.tr-card h3{margin:0 0 6px;font:800 17px/1.25 Poppins,Arial;color:#0b1a3a}
.tr-card p{margin:0;font:500 13.5px/1.5 Poppins,Arial;color:#334155}
.tr-card p a{color:#0369a1;font-weight:700}
.tr-prev{display:flex;gap:12px;align-items:center;margin:0 0 8px;padding:10px;border-radius:14px;background:linear-gradient(135deg,#f8fafc,#eef2ff)}
.tr-art{width:96px;height:72px;flex:none}
.tr-prev a{font:700 12.5px Poppins,Arial;color:#0369a1;text-decoration:none;border:1.5px solid #bfdbfe;border-radius:10px;padding:6px 10px;display:inline-block;margin-top:6px}
.tr-foot{display:flex;align-items:center;gap:8px;margin-top:12px}
.tr-dots{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.tr-dots i{width:7px;height:7px;border-radius:50%;background:#dbe3ee}.tr-dots i.on{background:#0369a1;transform:scale(1.25)}.tr-dots i.done{background:#93c5fd}
.tr-card button{border:0;border-radius:10px;min-height:38px;padding:0 14px;font:700 13px Poppins,Arial;cursor:pointer;background:#f1f5f9;color:#0f172a}
.tr-card button.p{background:linear-gradient(135deg,#0369a1,#4f46e5);color:#fff}
.tr-card button.x{background:transparent;color:#64748b;padding:0 8px}
.tr-card button:focus-visible{outline:2px solid #0369a1;outline-offset:2px}
.tr-end{display:grid;gap:8px;margin-top:8px}
.tr-end a{display:flex;gap:10px;align-items:center;text-decoration:none;color:#0f172a;font:700 13px Poppins,Arial;border:1.5px solid #e2e8f0;border-radius:12px;padding:8px 10px}
.tr-end a:hover{border-color:#0369a1;background:#f0f9ff}
.tr-end .tr-art{width:48px;height:36px}
.tr-offer{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99990;background:#0b1a3a;color:#fff;border-radius:16px;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 18px 50px rgba(2,8,30,.4);font:600 13.5px Poppins,Arial;max-width:min(520px,calc(100vw - 24px))}
.tr-offer b{color:#9ff6ff}
.tr-offer button{border:0;border-radius:10px;min-height:36px;padding:0 12px;font:700 13px Poppins,Arial;cursor:pointer;background:#fff;color:#0b1a3a}
.tr-offer button.l{background:transparent;color:#cbd5e1}
@media(prefers-reduced-motion:reduce){.tr-hole,.tr-card{transition:none}}
`;
const css = () => { if ($('#aou-tour-css')) return; const s = document.createElement('style'); s.id = 'aou-tour-css'; s.textContent = TOUR_CSS; document.head.appendChild(s); };

const findEl = (step) => { try { const sels = String(step.sel()).split(',').map(s => s.trim()).filter(Boolean); for (const s of sels) { const el = $(s); if (el && el.offsetParent !== null) { const r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4) return el; } } } catch (e) { } return null; };

/* ---------- the tour itself ---------- */
export function startTour2(ctx = {}) {
  css(); if ($('.tr-ov')) return;
  const toast = ctx.toast || (() => { });
  let i = 0; const ov = document.createElement('div'); ov.className = 'tr-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Tour of allofus.one');
  ov.innerHTML = '<div class="tr-hole none"></div><div class="tr-card" tabindex="-1"></div>'; document.body.appendChild(ov);
  const hole = ov.firstChild, card = ov.lastChild; const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const finish = (why) => { ls.set(DONE, '1'); ls.set(OFFERED, '1'); document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', place); ov.remove(); try { const u = new URL(location.href); if (u.searchParams.has('tour')) { u.searchParams.delete('tour'); history.replaceState(null, '', u); } } catch (e) { } if (why === 'done') toast('Tour complete. Welcome in.'); };
  let target = null;
  const place = () => {
    const r = target ? target.getBoundingClientRect() : null; const vw = innerWidth, vh = innerHeight; const cw = Math.min(380, vw - 24); const ch = card.offsetHeight || 220;
    if (r) { hole.classList.remove('none'); const pad = 6; Object.assign(hole.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' }); let top = r.bottom + 14; if (top + ch > vh - 10) top = r.top - ch - 14; if (top < 10) top = Math.max(10, Math.min(vh - ch - 10, r.bottom + 14)); let left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12); card.style.top = top + 'px'; card.style.left = left + 'px'; }
    else { hole.classList.add('none'); Object.assign(hole.style, { left: '50%', top: '50%', width: '0', height: '0' }); card.style.top = Math.max(10, (vh - ch) / 2) + 'px'; card.style.left = Math.max(12, (vw - cw) / 2) + 'px'; }
  };
  const draw = () => {
    const last = i >= STEPS.length; const s = last ? END : STEPS[i]; target = last ? null : findEl(s);
    if (target) { try { target.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { } }
    const dots = `<div class="tr-dots" aria-hidden="true">${STEPS.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'on' : ''}"></i>`).join('')}</div>`;
    const body = last
      ? `<p class="k">Done · ${STEPS.length} of ${STEPS.length}</p><h3>${esc(s.t)}</h3><p>${esc(s.p)}</p><div class="tr-end">${s.links.map(([h, l, a]) => `<a href="${h}">${art(a)}<span>${esc(l)}</span></a>`).join('')}</div>`
      : `<p class="k">Step ${i + 1} of ${STEPS.length}</p>${target ? '' : `<div class="tr-prev">${art(s.art)}<div><small style="font:600 12px Poppins,Arial;color:#64748b">Not on this screen, so here is a peek.</small><br><a href="${s.href}">Open it →</a></div></div>`}<h3>${esc(s.t)}</h3><p>${s.html ? s.p : esc(s.p)}</p>`;
    card.innerHTML = `${body}<div class="tr-foot">${dots}${i > 0 && !last ? '<button type="button" data-back>Back</button>' : ''}${last ? '<button type="button" class="p" data-done>Finish</button>' : `<button type="button" class="x" data-skip>Skip</button><button type="button" class="p" data-next>${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button>`}</div>`;
    const b = (sel, fn) => { const el = $(sel, card); if (el) el.onclick = fn; };
    b('[data-back]', () => { i = Math.max(0, i - 1); draw(); }); b('[data-next]', next); b('[data-skip]', () => finish('skip')); b('[data-done]', () => finish('done'));
    place(); requestAnimationFrame(place); card.focus({ preventScroll: true });
  };
  const next = () => { if (i >= STEPS.length) return finish('done'); i++; draw(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish('skip'); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (e.target && e.target.tagName === 'A') return; e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); i = Math.max(0, i - 1); draw(); } };
  window.addEventListener('keydown', onKey, true); window.addEventListener('resize', place);
  let tx = null; card.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true }); card.addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (dx < -50) next(); else if (dx > 50) { i = Math.max(0, i - 1); draw(); } }, { passive: true });
  ov.addEventListener('click', (e) => { if (e.target === ov) next(); });
  draw(); return { finish, next };
}

/* ---------- the one-time offer (a small bar, not a modal) ---------- */
function offer(ctx) {
  if ($('.tr-offer') || $('.tr-ov') || $('.tour-ov')) return; css();
  const bar = document.createElement('div'); bar.className = 'tr-offer'; bar.setAttribute('role', 'status');
  bar.innerHTML = `<span><b>New here?</b> A 2-minute tour shows what one account gets you.</span><button type="button" data-go>Take the tour</button><button type="button" class="l" data-no>Not now</button>`;
  document.body.appendChild(bar); ls.set(OFFERED, '1');
  $('[data-go]', bar).onclick = () => { bar.remove(); startTour2(ctx); };
  $('[data-no]', bar).onclick = () => bar.remove();
  setTimeout(() => { if (bar.isConnected) bar.remove(); }, 25000);
}
/* called once at boot by aou-flat2.js (inside its onboarding timer) */
export function tourBoot(ctx = {}) {
  css();
  const q = new URLSearchParams(location.search);
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-tour]'); if (!t) return; e.preventDefault(); startTour2(ctx); });
  window.AOU_TOUR = { start: () => startTour2(ctx) };
  if (q.get('tour') === '1') { setTimeout(() => startTour2(ctx), 400); return; }
  if (ls.get(DONE) || ls.get(OFFERED)) return;
  const onFeed = !q.get('v') || q.get('v') === 'feed'; if (!onFeed) return;
  if (ctx.me) { /* a new member: after the short onboarding finished (it sets aou_tour_done) */ if (ls.get('aou_tour_done') && !ls.get('aou_tour_pending')) setTimeout(() => offer(ctx), 1500); return; }
  const n = (+ls.get(VISITS) || 0) + 1; ls.set(VISITS, String(n)); if (n === 2) setTimeout(() => offer(ctx), 2500);
}

/* allofus.one · onboarding (Oct 9 2026)
   1. The guided tour: five spotlight steps for every new member (and once for existing accounts) —
      Your page & photo → Connections → Post something → LIFEboard → Go 3D / VR. Keyboard: ← → Enter Esc.
   2. The claim flow: when someone signs in whose email pre-claimed a Brand page (pages.admin_emails, v17),
      a 4-step guided modal — welcome → finish your profile → review the page → your VR home spot.
   Nothing here touches /world/. Works in demo mode (saves are skipped, the walk-through still runs). */
import { ic } from './aou-icons2.js';
import { BRANDS } from './aou-brand.js';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* the simple guide: ≥20px body, 56px buttons, ≤12px radius, high contrast, one thing per screen */
const VG_CSS = `
.vg-wrap{position:fixed;inset:0;z-index:320;background:rgba(5,10,30,.62);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
.vg{box-sizing:border-box;background:#fff;color:#0f172a;width:min(680px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow:auto;border-radius:12px;box-shadow:0 30px 80px rgba(2,8,30,.45);font:400 20px/1.5 var(--ff,Poppins,Arial,sans-serif);display:flex;flex-direction:column}
.vg-top{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 20px 12px}
.vg-prog{display:flex;align-items:center;gap:12px;font:800 18px var(--ff,Poppins,Arial);color:#0f172a}.vg-prog span{white-space:nowrap}.vg-bar{flex:1;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden}.vg-bar i{display:block;height:100%;border-radius:5px;transition:width .3s}
.vg-help{display:flex;gap:8px 16px;flex-wrap:wrap;margin-top:10px;font-size:18px}.vg-help a{display:inline-flex;gap:8px;align-items:center;color:#075985;font-weight:700;text-decoration:underline;text-underline-offset:3px;min-height:44px}.vg-help a b{white-space:nowrap}.vg-help .hic{width:22px;height:22px;flex:none}
.vg-body{padding:20px 20px 8px;flex:1}.vg-body h2{margin:0 0 10px;font:900 32px/1.15 var(--fd,Georgia,serif);color:#0f172a;outline:0}.vg-body p{margin:0 0 14px}.vg-lead{font-size:24px;font-weight:700;color:#0f172a}.vg-note{background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:10px 14px}.vg-soft{color:#334155;font-size:19px}
.vg-hi{margin-bottom:10px}.vg-av{display:inline-block;width:96px;height:96px;border-radius:50%;background:#e0f2fe center/cover;border:4px solid #fff;box-shadow:0 6px 20px rgba(2,8,30,.25)}
.vg-big{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:12px 22px;border-radius:12px;border:2px solid #0f172a;background:#fff;color:#0f172a;font:800 20px var(--ff,Poppins,Arial);cursor:pointer;text-decoration:none;text-align:center;position:relative}
.vg-big .hic{width:26px;height:26px;flex:none}.vg-big:hover{background:#f1f5f9}.vg-big.vg-p{background:#0b5cad;border-color:#0b5cad;color:#fff}.vg-big.vg-p:hover{background:#094c8f}.vg-big[disabled]{opacity:.6;cursor:wait}
.vg-big:focus-visible,.vg-help a:focus-visible,.vg-later button:focus-visible,.vg textarea:focus-visible,.vg-big:focus-within{outline:4px solid #f59e0b;outline-offset:3px}
.vg-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0)}
.vg-photo{display:flex;flex-direction:column;align-items:center;gap:16px;margin:8px 0 12px}.vg-me{width:160px;height:160px;border-radius:50%;background:#e2e8f0 center/cover;display:grid;place-items:center;font:900 64px var(--ff,Poppins,Arial);color:#475569;border:4px solid #fff;box-shadow:0 8px 24px rgba(2,8,30,.2)}.vg-photo .vg-big{width:100%;max-width:420px;min-height:72px;font-size:22px}
.vg-lbl{display:block;font-weight:800;margin:6px 0 6px}.vg textarea{box-sizing:border-box;width:100%;border:2px solid #64748b;border-radius:12px;padding:14px;font:400 20px/1.5 var(--ff,Poppins,Arial);color:#0f172a;resize:vertical}
.vg-st{min-height:1.5em;font-weight:700;color:#065f46}
.vg-page{border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:6px 0 16px}.vg-page .cv{height:150px;background-size:cover;background-position:center}.vg-page .bd{padding:14px 16px}.vg-page h3{margin:0 0 4px;font:900 24px/1.2 var(--fd,Georgia,serif)}.vg-page .tg{font-size:19px;color:#334155}.vg-page ul{list-style:none;margin:8px 0 0;padding:0}.vg-page li{display:flex;gap:10px;align-items:center;margin:6px 0;font-size:19px;word-break:break-word}.vg-page li .hic{width:22px;height:22px;flex:none;color:#0b5cad}.vg-page a{color:#075985}
.vg-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vg-col{display:flex;flex-direction:column;gap:12px;margin:6px 0 14px}.vg-col .vg-big{width:100%}
.vg-inv{margin:8px 0 14px}.vg-inv input{box-sizing:border-box;width:100%;border:2px solid #64748b;border-radius:12px;padding:12px;font:600 18px var(--ff,Poppins,Arial);margin-bottom:12px}.vg-inv .vg-two{grid-template-columns:1fr 1fr 1fr}
.vg-nav{display:flex;justify-content:space-between;gap:12px;padding:14px 20px 6px;position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e8f0}.vg-nav .vg-big{min-width:140px}.vg-next{flex:0 1 260px}
.vg-later{text-align:center;padding:4px 20px 16px}.vg-later button{border:0;background:transparent;color:#334155;font:700 19px var(--ff,Poppins,Arial);text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:48px;padding:8px 14px;border-radius:12px}
#vg-help{position:fixed;left:74px;bottom:22px;z-index:61;display:inline-flex;align-items:center;gap:10px;min-height:56px;padding:10px 18px;border-radius:12px;border:0;background:#0b5cad;color:#fff;font:800 18px var(--ff,Poppins,Arial);box-shadow:0 10px 24px rgba(2,8,30,.35);cursor:pointer}#vg-help .hic{width:24px;height:24px}#vg-help:focus-visible{outline:4px solid #f59e0b;outline-offset:3px}
@media(max-width:1000px){#vg-help{bottom:92px;left:72px;font-size:17px;padding:8px 14px}}
@media(max-width:560px){.vg-wrap{padding:0}.vg{max-height:100vh;max-height:100dvh;height:100%;border-radius:0}.vg-body h2{font-size:28px}.vg-two,.vg-inv .vg-two{grid-template-columns:1fr}.vg-nav .vg-big{min-width:0;flex:1}.vg-top{padding:12px 16px 10px}.vg-body{padding:16px 16px 6px}.vg-nav{padding:12px 16px 4px}}
@media(prefers-reduced-motion:reduce){.vg-bar i{transition:none}}`;
export const ONBOARD_CSS = `
.tour-ov{position:fixed;inset:0;z-index:300;pointer-events:auto}.tour-hole{position:absolute;border-radius:16px;box-shadow:0 0 0 200vmax rgba(5,10,30,.62);transition:left .3s,top .3s,width .3s,height .3s;pointer-events:none;outline:3px solid #38f0ff;outline-offset:4px}
.tour-card{position:absolute;z-index:2;box-sizing:border-box;width:min(360px,calc(100vw - 32px));background:#fff;color:#14183a;border-radius:18px;box-shadow:0 30px 80px rgba(2,8,30,.45);padding:16px 18px 14px;font-family:var(--ff,Poppins,Arial);animation:fmIn .25s ease-out}.tour-card .k{display:flex;align-items:center;gap:8px;font:800 11px var(--ff);letter-spacing:.08em;text-transform:uppercase;color:#0ea5e9}.tour-card .k .hic{width:18px;height:18px}.tour-card h3{margin:6px 0 4px;font:900 19px var(--fd,Georgia,serif)}.tour-card p{margin:0 0 10px;font-size:13.5px;line-height:1.45;color:#334155}.tour-card .row{display:flex;gap:6px;align-items:center}.tour-card .row .sp{flex:1}.tour-card .dots{display:flex;gap:4px;margin:0 0 10px}.tour-card .dots i{height:4px;flex:1;border-radius:2px;background:#e2e8f0}.tour-card .dots i.on{background:#0ea5e9}.tour-card .fl-btn{min-height:36px}
.cl-wrap{position:fixed;inset:0;z-index:290;background:rgba(5,10,30,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:14px}.cl{background:#fff;color:#14183a;border-radius:22px;width:min(560px,100%);max-height:94vh;overflow:auto;box-shadow:0 30px 80px rgba(2,8,30,.45);animation:fmIn .25s ease-out;font-family:var(--ff,Poppins,Arial)}.cl .hero{padding:22px 22px 14px;color:#fff;border-radius:22px 22px 0 0;position:relative;overflow:hidden}.cl .hero:after{content:"";position:absolute;inset:-40% -10%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.22) 50%,transparent 60%);transform:translateX(-60%);animation:clSheen 5s ease-in-out infinite}@keyframes clSheen{0%,20%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}.cl .hero .k{font:800 11px var(--ff);letter-spacing:.1em;text-transform:uppercase;opacity:.85}.cl .hero h2{margin:4px 0 2px;font:900 24px var(--fd,Georgia,serif)}.cl .hero p{margin:0;font-size:13.5px;opacity:.92}.cl .bd{padding:14px 22px 18px}.cl .steps{display:flex;gap:6px;margin-bottom:12px}.cl .steps i{flex:1;height:5px;border-radius:3px;background:#e2e8f0}.cl .steps i.on{background:#0ea5e9}.cl label{display:block;font:700 12px var(--ff);color:#475569;margin:8px 0 3px}.cl input:not([type=file]),.cl textarea{width:100%;border:1.5px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:600 14px var(--ff);box-sizing:border-box;outline:0}.cl input:focus,.cl textarea:focus{border-color:#0ea5e9}.cl .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:12px}.cl .row .sp{flex:1}.cl .spot{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.cl .spot button{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 10px;font:700 12px var(--ff);cursor:pointer;text-align:left}.cl .spot button.on{border-color:#0ea5e9;background:#f0f9ff}.cl .pv{display:flex;gap:10px;align-items:center;margin:6px 0}.cl .pv .av{width:56px;height:56px;border-radius:50%;background:#e0f2fe center/cover;display:grid;place-items:center;font:900 22px var(--ff);color:#0b1a3a;flex:none}.cl .vr{background:linear-gradient(135deg,#0b1a3a,#1e3a6a);color:#fff;border-radius:16px;padding:14px;margin-top:6px;font-size:13px;line-height:1.5}.cl .vr b{color:#38f0ff}.cl .muted{color:#64748b;font-size:12px}
.cl-thanks{display:flex;gap:10px;align-items:flex-start;background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;border-radius:12px;padding:10px 12px;margin:0 0 10px;font-size:13.5px;line-height:1.45}.cl-thanks .hic{flex:none;width:20px;height:20px;color:#ea580c}
.cl-tour{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px;border:1.5px solid #bae6fd;background:#f0f9ff;border-radius:12px;padding:12px}.cl-tour>.hic{width:26px;height:26px;color:#0284c7;flex:none}.cl-tour>div{flex:1;min-width:200px}.cl-tour b{display:block;font-size:15px}.cl-tour span{font-size:13px;color:#334155}
@media(prefers-reduced-motion:reduce){.cl .hero:after{animation:none}}` + VG_CSS;
/* ---------- the tour ---------- */
export function startTour(ctx) {
  const { $, toast } = ctx; const me = ctx.me; const first = (me && me.name ? me.name.split(' ')[0] : 'friend');
  const mobile = () => matchMedia('(max-width:1000px)').matches;
  const STEPS = [
    { icon: '🙂', k: 'Step 1 · Your page', h: `Your page and your photo, ${esc(first)}`, p: 'Everything you post lives on your page. Add a photo and a line about you so people know who they are meeting. Tap <b>My page</b> any time to edit it.', sel: () => mobile() ? '.fl-bottom [data-v="u"]' : '.fl-id, .fl-top [data-v="u"]' },
    { icon: '🤝', k: 'Step 2 · Connections', h: 'You start connected with Zach', p: 'Zach is the founder of allofus.one and your first connection — so your feed is never empty on day one. One tap (⋯ → Disconnect) removes it. Connections are people you choose, not “friends” or “followers”.', sel: () => mobile() ? '.fl-bottom [data-v="conn"]' : '#conn-panel, .fl-top [data-v="conn"]' },
    { icon: '✍️', k: 'Step 3 · Post something', h: 'Say the first thing', p: 'Text, photos, a video, a poll, something for sale, an event, a need. No algorithm decides who sees it — your connections and the groups you pick do.', sel: () => '.fl-pill, .fl-comp, [data-open-comp], #fl-fab', before: () => { const b = $('[data-open-comp]'); if (b && !$('.fl-comp')) b.click(); } },
    { icon: '🧩', k: 'Step 4 · LIFEboard', h: 'Your LIFEboard', p: 'Goals, habits, the life wheel, trackers, journal, money tools, a widget dash you lay out yourself. Private to you, and the same board shows in 3D and VR.', sel: () => '.rail a[href="/?v=board"], .fl-foot a[href="/?board=1"]' },
    { icon: '🧊', k: 'Step 5 · Go 3D / VR', h: 'Feed · 3D · VR, one account', p: 'The rail at the top switches modes. <b>Feed</b> is this page. <b>3D</b> opens the world in your browser (walk, build, meet). <b>VR</b> is the same world in a headset. Your page, posts and people are the same in all three.', sel: () => '.ms' }
  ];
  let i = 0; const ov = document.createElement('div'); ov.className = 'tour-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Welcome tour'); ov.innerHTML = '<div class="tour-hole"></div><div class="tour-card" tabindex="-1"></div>'; document.body.appendChild(ov);
  const hole = ov.firstChild, card = ov.lastChild; const prevOverflow = document.body.style.overflow;
  const finish = (why) => { try { localStorage.setItem('aou_tour_done', '1'); localStorage.removeItem('aou_tour_pending'); } catch (e) { } ov.remove(); removeEventListener('resize', place); removeEventListener('keydown', keys, true); document.body.style.overflow = prevOverflow; if (why === 'done') toast && toast('You are all set. Welcome in.'); };
  const target = () => { const s = STEPS[i]; const sels = s.sel().split(',').map(x => x.trim()); for (const q of sels) { const el = $(q); if (el && el.offsetParent !== null && el.getBoundingClientRect().width > 0) return el; } return null; };
  const place = () => { const el = target(); const vw = innerWidth, vh = innerHeight; let r = null; if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' in Element.prototype ? 'instant' : 'auto' }); r = el.getBoundingClientRect(); } if (r) { const pad = 8; Object.assign(hole.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px', opacity: 1 }); } else { Object.assign(hole.style, { left: '50%', top: '40%', width: '0px', height: '0px', opacity: 1 }); } const cw = Math.min(360, vw - 32), ch = card.offsetHeight || 220; let left = 16, top = 16; if (r) { left = Math.max(16, Math.min(vw - cw - 16, r.left)); top = r.bottom + 14; if (top + ch > vh - 10) top = Math.max(10, r.top - ch - 14); if (r.height > vh * 0.7) top = Math.max(10, vh - ch - 20); } else { left = (vw - cw) / 2; top = Math.max(16, (vh - ch) / 2); } card.style.left = left + 'px'; card.style.top = top + 'px'; };
  const draw = () => { const s = STEPS[i]; if (s.before) { try { s.before(); } catch (e) { } } card.innerHTML = `<div class="k">${ic(s.icon)} ${s.k}</div><h3>${s.h}</h3><p>${s.p}</p><div class="dots">${STEPS.map((x, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div><div class="row">${i ? '<button class="fl-btn sm" data-back>Back</button>' : ''}<span class="sp"></span><button class="fl-btn sm" data-skip>Skip tour</button><button class="fl-btn p sm" data-next>${i === STEPS.length - 1 ? 'Done' : 'Next'}</button></div>`; card.querySelector('[data-next]').onclick = next; card.querySelector('[data-skip]').onclick = () => finish('skip'); const b = card.querySelector('[data-back]'); if (b) b.onclick = () => { i = Math.max(0, i - 1); draw(); }; setTimeout(place, 30); setTimeout(place, 350); card.querySelector('[data-next]').focus(); };
  const next = () => { if (i >= STEPS.length - 1) { finish('done'); return; } i++; draw(); };
  const keys = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish('skip'); } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.target.closest('button'))) { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); if (i) { i--; draw(); } } else if (e.key === 'Tab') { const f = [...card.querySelectorAll('button')]; if (!f.length) return; const a = document.activeElement; const idx = f.indexOf(a); if (e.shiftKey && (idx <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); } else if (!card.contains(a)) { e.preventDefault(); f[0].focus(); } } };
  addEventListener('keydown', keys, true); addEventListener('resize', place); document.body.style.overflow = 'hidden'; ov.addEventListener('click', (e) => { if (e.target === ov) next(); }); draw(); return { finish, next };
}
/* should the tour run now? once per device: right after joining, or once for accounts that never saw it */
export function tourDue(me) { try { if (new URLSearchParams(location.search).get('debugtour')) return true; if (!me) return false; if (localStorage.getItem('aou_tour_pending') === '1') return true; return !localStorage.getItem('aou_tour_done'); } catch (e) { return false; } }
/* ---------- the claim flow ---------- */
export const VR_SPOTS = [['gate', 'The Gateway (spawn)'], ['plaza', 'Central Plaza'], ['city', 'The City'], ['library', 'Library district'], ['falls', 'The Falls'], ['desert', 'Desert district'], ['beach', 'Beach Cove'], ['starport', 'Starport'], ['art', 'Art Garden'], ['unity', 'Unity Heights'], ['skyrange', 'Sky Range golf'], ['coaster', 'Peace Coaster'], ['lake-dillon', 'Lake Dillon'], ['conference', 'Conference Center'], ['first-street', 'First Street homes'], ['balloons', 'Kindness Commons']];
export function claimModal(ctx, pg) {
  remember(ctx); if (pg && (pg._guide || (pg._vip && pg._vip.style === 'simple'))) return openSimpleGuide(ctx, pg);
  const { sb, toast, upload } = ctx; const me = ctx.me || {}; const vip = (pg && pg._vip) || vipFor(me); const first = vip ? vip.name : String(me.name || '').split(' ')[0]; const f = Object.assign({ bio: '', city: '' }, (me.home && me.home.flat) || {}); const color = (pg.extra && pg.extra.color) || pg.color || '#0ea5e9';
  const x = Object.assign({}, pg.extra || {}); const cta = x.cta || {}; let step = 0; let photo = f.avatar || null, cover = pg.cover || null; let spot = pg.vr_home || pg.world_spot || 'gate';
  const w = document.createElement('div'); w.className = 'cl-wrap'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'You manage ' + pg.name); document.body.appendChild(w);
  const mark = () => { try { localStorage.setItem('aou_claimed_' + pg.slug, String(Date.now())); } catch (e) { } };
  const close = () => { mark(); w.remove(); removeEventListener('keydown', esc_, true); };
  const esc_ = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } }; addEventListener('keydown', esc_, true);
  const save = async (table, patch, match) => { if (!sb || !me.id) return; try { let q = sb.from(table).update(patch); for (const [k, v] of Object.entries(match)) q = q.eq(k, v); const { error } = await q; if (error && /column|schema cache/i.test(error.message)) { const p2 = Object.assign({}, patch); delete p2.extra; delete p2.hours; let q2 = sb.from(table).update(p2); for (const [k, v] of Object.entries(match)) q2 = q2.eq(k, v); await q2; } else if (error) toast(error.message); } catch (e) { } };
  const savePg = async (patch) => { const r = await savePagePatch(sb, pg, patch, me); if (r === 'review') toast(REVIEW_MSG); else if (r === 'basics') toast('Saved the basics — run supabase/allofus-v17.sql for the rest.'); else if (r === 'saved') toast('Page saved'); return r; };
  const hero = (k, h, p) => `<div class="hero" style="background:linear-gradient(135deg,${esc(color)},#0b1a3a)"><div class="k">${k}</div><h2>${h}</h2><p>${p}</p></div>`;
  const steps = () => `<div class="steps">${[0, 1, 2, 3].map(j => `<i class="${j <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const draw = () => {
    if (step === 0) w.innerHTML = `<div class="cl">${hero(vip ? 'Welcome, ' + esc(first) : 'Welcome', `You manage <span style="white-space:nowrap">${esc(pg.name)}</span>`, vip ? `Zach pre-linked ${esc(vip.full)}'s email to this Brand page. You manage it from your personal account (Zach stays the owner): post as the page, take messages, edit everything.` : 'Your email was pre-linked to this Brand page. It is yours to run from your personal account: post as the page, take messages, edit everything.')}<div class="bd">${steps()}${vip && vip.note ? `<div class="cl-thanks">${ic('🎁')}<span>${esc(vip.note)}</span></div>` : ''}<p>Four quick steps and you are set: your profile, a look at the page, and your spot in the 3D world (it works in VR too).</p><p class="muted">Nothing here is permanent — every piece can be changed later from the page's ⚙ Manage bar or your Control panel.</p><div class="row"><button class="fl-btn sm" data-later>Later</button><span class="sp"></span><button class="fl-btn p" data-next>Let's go</button></div></div></div>`;
    else if (step === 1) w.innerHTML = `<div class="cl">${hero('Step 2 of 4', 'Finish your profile', 'People who message the page see who answers. A photo and a line help.')}<div class="bd">${steps()}<div class="pv"><div class="av" ${photo ? `style="background-image:url(${esc(photo)});color:transparent"` : ''}>${esc((me.name || 'Y')[0])}</div><label class="fl-btn sm" style="margin:0">${ic('📷')} Profile photo<input type="file" accept="image/*" data-photo hidden></label><span class="muted" data-pst></span></div><label>About you</label><textarea data-bio maxlength="500" rows="3" placeholder="${esc((vip && vip.bio) || 'Registered dietitian, mom of two, runs the GLP-1 360 plan…')}">${esc(f.bio || (vip && vip.bio) || '')}</textarea><label>City</label><input data-city maxlength="60" value="${esc(f.city)}" placeholder="Denver, CO"><div class="row"><button class="fl-btn sm" data-back>Back</button><span class="sp"></span><button class="fl-btn sm" data-skip>Skip</button><button class="fl-btn p" data-next>Save and continue</button></div></div></div>`;
    else if (step === 2) w.innerHTML = `<div class="cl">${hero('Step 3 of 4', 'Review the page', 'The headline people see first. Make it yours.')}<div class="bd">${steps()}<label>Cover photo</label><div class="pv"><div class="av" style="border-radius:12px;width:96px;${cover ? `background-image:url(${esc(cover)})` : `background:${esc(color)}`}"></div><label class="fl-btn sm" style="margin:0">${ic('🖼️')} Upload cover<input type="file" accept="image/*" data-cover hidden></label><span class="muted" data-cst></span></div><label>Tagline</label><input data-tag maxlength="140" value="${esc(pg.tagline || '')}"><label>Main button (call to action)</label><div style="display:flex;gap:6px"><input data-ctal maxlength="40" value="${esc(cta.label || (pg.phone ? 'Call us' : 'Visit the website'))}" placeholder="Book a call" style="flex:1"><input data-ctah maxlength="200" value="${esc(cta.href || (pg.phone ? 'tel:' + String(pg.phone).replace(/[^0-9+]/g, '') : pg.website || ''))}" placeholder="https:// or tel:" style="flex:2"></div><label>Hours</label><input data-hours maxlength="120" value="${esc(pg.hours || '')}" placeholder="Mon-Fri 8am-6pm MT"><div class="row"><button class="fl-btn sm" data-back>Back</button><span class="sp"></span><button class="fl-btn sm" data-skip>Skip</button><button class="fl-btn p" data-next>Save and continue</button></div></div></div>`;
    else w.innerHTML = `<div class="cl">${hero('Step 4 of 4', 'Your VR home', 'Every page gets a spot in the 3D world. Yours is where visitors land when they tap “Visit in 3D”.')}<div class="bd">${steps()}<div class="vr">${ic('🕶️')} <b>How it works.</b> The same world runs in a browser (3D) and in a headset (VR). Your VR home is a place in it — a storefront, a corner of the plaza, a waterfall. Members can walk there, meet you, and tap through to this page. You can move it any time from ⚙ Manage → VR home spot.</div><div class="cl-tour">${ic('🧊')}<div><b>Take the 2-minute tour</b><span>You'll be sharing allofus with friends, so here's everything: your page, connections, posting, LIFEboard and 3D / VR.</span></div><button class="fl-btn p" data-tour>Take the tour</button></div><label>Pick your spot</label><div class="spot">${VR_SPOTS.map(([id, n]) => `<button data-spot="${id}" class="${id === spot ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div class="row"><button class="fl-btn sm" data-back>Back</button><span class="sp"></span><button class="fl-btn sm" data-later>Later</button><a class="fl-btn sm" data-go3d href="/world/?to=${esc(spot)}">${ic('🧊')} See it in 3D</a><a class="fl-btn p" data-govr href="/world/?to=${esc(spot)}&vr=1">${ic('🕶️')} Go to my VR home</a></div></div></div>`;
    const q = (s) => w.querySelector(s); const nx = q('[data-next]'), bk = q('[data-back]'), sk = q('[data-skip]'), lt = q('[data-later]');
    if (bk) bk.onclick = () => { step--; draw(); }; if (sk) sk.onclick = () => { step++; draw(); }; if (lt) lt.onclick = close;
    const ph = q('[data-photo]'); if (ph) ph.onchange = async () => { try { q('[data-pst]').textContent = 'Uploading…'; photo = await upload(ph.files[0], 'avatars'); q('.pv .av').style.backgroundImage = 'url(' + photo + ')'; q('.pv .av').style.color = 'transparent'; q('[data-pst]').textContent = 'Looks good.'; } catch (e) { q('[data-pst]').textContent = 'Upload needs the live server.'; } };
    const cv = q('[data-cover]'); if (cv) cv.onchange = async () => { try { q('[data-cst]').textContent = 'Uploading…'; cover = await upload(cv.files[0], 'pages'); q('.pv .av').style.backgroundImage = 'url(' + cover + ')'; q('[data-cst]').textContent = 'Looks good.'; } catch (e) { q('[data-cst]').textContent = 'Upload needs the live server.'; } };
    w.querySelectorAll('[data-spot]').forEach(b => b.onclick = async () => { spot = b.dataset.spot; w.querySelectorAll('[data-spot]').forEach(z => z.classList.toggle('on', z === b)); q('[data-go3d]').href = '/world/?to=' + spot; q('[data-govr]').href = '/world/?to=' + spot + '&vr=1'; if (me.id) await savePg({ vr_home: spot }); });
    if (q('[data-govr]')) { q('[data-govr]').onclick = mark; q('[data-go3d]').onclick = mark; }
    const tb = q('[data-tour]'); if (tb) tb.onclick = () => { close(); try { localStorage.removeItem('aou_tour_done'); } catch (e) { } setTimeout(() => startTour({ $: (x) => document.querySelector(x), me, toast }), 250); };
    if (nx) nx.onclick = async () => {
      if (step === 1) { const flat = Object.assign({}, f, { bio: q('[data-bio]').value.trim().slice(0, 500), city: q('[data-city]').value.trim().slice(0, 60) }); if (photo) flat.avatar = photo; const home = Object.assign({}, me.home || {}, { flat }); await save('profiles', { home }, { id: me.id }); if (me.home) me.home.flat = flat; toast('Profile saved'); }
      if (step === 2) { const patch = { tagline: q('[data-tag]').value.trim().slice(0, 140), hours: q('[data-hours]').value.trim().slice(0, 120), extra: Object.assign({}, x, { cta: { label: q('[data-ctal]').value.trim().slice(0, 40), href: q('[data-ctah]').value.trim().slice(0, 200) } }) }; if (cover) patch.cover = cover; if (me.id) await savePg(patch); Object.assign(pg, patch); }
      step++; draw(); };
    setTimeout(() => { const b = q('[data-next], [data-govr]'); b && b.focus(); }, 40);
  };
  draw(); return { close };
}
/* which of my pages was just claimed and has not had its walk-through on this device? */
/* which page needs its walk-through now? (1) a VIP client account (VIP map below: works before any SQL is run),
   (2) a page just claimed through admin_emails (v17), (3) ?guide=1 re-opens the guide for anyone signed in.
   Returns a page object (truthy) for claimModal(), or null. Side effects, all guarded: the founder-connect
   fallback and, for "simple" clients who have not finished, the "Help me get set up" button. */
export function claimDue(pages, me, claimedNow) {
  CL.dueCalled = true;
  try { if (me) { remember({ me }); founderConnect(me); } } catch (e) { }
  try {
    const forced = guideParam(); const v = vipFor(me);
    if (v) { for (const slug of v.slugs) if (forced || !lsGet('aou_claimed_' + slug)) { CL.opened = true; return vipPage(v, slug, pages); } if (v.style === 'simple' && !lsGet('aou_guide_done')) mountHelpButton(); }
    const day = 86400000; const db = (pages || []).find(p => p.slug && !lsGet('aou_claimed_' + p.slug) && me && p.owner_id !== me.id && (claimedNow > 0 || (p.claimed_at && Date.now() - new Date(p.claimed_at).getTime() < day))) || null;
    if (db) { CL.opened = true; return db; }
    if (forced && me) { CL.opened = true; const mine = (pages || [])[0]; return mine ? Object.assign({ _guide: true }, mine) : { _guide: true, slug: null, name: '' }; }
    return null;
  } catch (e) { return null; }
}
/* ---------- VIP client accounts (Oct 9 2026) ----------
   Keyed by lower-case sign-in email. style 'simple' = the large-type, one-thing-per-screen guide; 'standard' = the
   4-step claim modal, personalised, with the optional tour at the end. The SQL twin is supabase/allofus-v19-clients.sql. */
export const ZACH_PHONE = '1-800-481-8638'; const ZACH_TEL = 'tel:+18004818638'; const ZACH_MAIL = ['zach', 'eyetoad.com'].join('@');
export const FOUNDER_EMAILS = ['zach@eyetoad.com', 'zachwennstedt@gmail.com'];
export const SLUG_ALIAS = { 'raised-in-a-barn-furniture': 'raised-in-a-barn' };
export const canonSlug = (s) => SLUG_ALIAS[s] || s;
export const VIP = {
  'wasraisedinabarn@gmail.com': { name: 'Ritchie', full: 'Ritchie', slugs: ['raised-in-a-barn'], style: 'simple', vrHome: 'art', mallStore: 'https://worldvrmall.com/mall/?to=raised-in-a-barn',
    welcome: 'We will go one small step at a time. Nothing here can break, and you can change anything later.',
    bio: 'I build furniture by hand from reclaimed Colorado barnwood. Every piece is made to order.' },
  'meredith@elevationhealth.co': { name: 'Meredith', full: 'Meredith Cross', slugs: ['elevation-health'], style: 'standard', vrHome: 'falls',
    welcome: 'Zach set up the Elevation Health page for you and Lindsay.', note: 'Thank you for helping test allofus.one. While you do, Zach is giving Elevation Health free advertising here.',
    bio: 'Registered dietitian and co-founder of Elevation Health. I help people lose weight on GLP-1s and keep it off.' },
  'lindsay@elevationhealth.co': { name: 'Lindsay', full: 'Lindsay Gayman', slugs: ['elevation-health'], style: 'standard', vrHome: 'falls',
    welcome: 'Zach set up the Elevation Health page for you and Meredith.', note: 'Thank you for helping test allofus.one. While you do, Zach is giving Elevation Health free advertising here.',
    bio: 'Registered dietitian and co-founder of Elevation Health. Real nutrition support for people on GLP-1 medication.' }
};
export const vipFor = (me) => { try { return (me && me.email && VIP[String(me.email).toLowerCase().trim()]) || null; } catch (e) { return null; } };
export const vipCanEdit = (me, slug) => { const v = vipFor(me); return !!(v && slug && v.slugs.includes(canonSlug(slug))); };
const CL = { dueCalled: false, opened: false, last: {} };
const remember = (ctx) => { if (!ctx) return; for (const k of ['sb', 'me', 'toast', 'upload']) if (ctx[k]) CL.last[k] = ctx[k]; };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const guideParam = () => { try { return new URLSearchParams(location.search).get('guide') === '1'; } catch (e) { return false; } };
const say = (m) => { if (CL.last.toast) { try { CL.last.toast(m); return; } catch (e) { } } const t = document.createElement('div'); t.setAttribute('role', 'status'); t.textContent = m; t.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#14183a;color:#fff;padding:10px 16px;border-radius:12px;font:700 14px Poppins,Arial;z-index:400;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw'; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); };
/* the page object a VIP manages: the DB row when this account can already see it, else the built-in brand */
function vipPage(v, slug, pages) {
  const row = (pages || []).find(p => canonSlug(p.slug) === slug);
  const b = BRANDS.find(x => x.slug === slug) || { slug, name: slug };
  const base = row ? Object.assign({}, row) : Object.assign({ builtin: true, owner_id: null }, b, { extra: { color: b.color, cat: b.cat } });
  base.extra = Object.assign({ color: b.color }, base.extra || {}); base.vr_home = base.vr_home || v.vrHome;
  ['tagline', 'phone', 'website', 'location', 'hours', 'about'].forEach(k => { if (!base[k] && b[k]) base[k] = b[k]; });
  return Object.assign(base, pageDraft(slug), { _vip: v });
}
/* ---------- saving a page safely ----------
   Supabase returns no error when RLS silently blocks an UPDATE (0 rows). So: update ... select('id'); if no row came
   back, keep the change as a local draft + a page_edit_requests row (v19) and tell the person the honest thing. */
export const REVIEW_MSG = 'Saved for review — Zach will publish it';
export const pageDraft = (slug) => { try { return JSON.parse(localStorage.getItem('aou_pagedraft_' + canonSlug(slug)) || '{}') || {}; } catch (e) { return {}; } };
const keepDraft = (slug, patch) => { if (!slug) return; lsSet('aou_pagedraft_' + canonSlug(slug), JSON.stringify(Object.assign(pageDraft(slug), patch, { _at: Date.now() }))); };
const dropDraft = (slug, patch) => { try { const d = pageDraft(slug); Object.keys(patch || {}).forEach(k => delete d[k]); const left = Object.keys(d).filter(k => k !== '_at'); if (left.length) lsSet('aou_pagedraft_' + canonSlug(slug), JSON.stringify(d)); else localStorage.removeItem('aou_pagedraft_' + canonSlug(slug)); } catch (e) { } };
export async function savePagePatch(sb, pg, patch, me) {
  if (!sb || !me || !me.id || !pg) return 'demo';
  const review = async () => { keepDraft(pg.slug, patch); try { await sb.from('page_edit_requests').insert({ page_slug: canonSlug(pg.slug), user_id: me.id, email: me.email || null, patch }); } catch (e) { } return 'review'; };
  if (!pg.id && pg.slug) { try { const { data: r } = await sb.from('pages').select('id').eq('slug', canonSlug(pg.slug)).maybeSingle(); if (r && r.id) pg.id = r.id; } catch (e) { } }
  if (!pg.id) return review();
  try {
    let { data, error } = await sb.from('pages').update(patch).eq('id', pg.id).select('id'); let basics = false;
    if (error && /column|schema cache/i.test(error.message || '')) { const keep = {}; for (const k of ['name', 'tagline', 'phone', 'website', 'location', 'hours', 'logo', 'cover', 'world_spot']) if (k in patch) keep[k] = patch[k]; if (!Object.keys(keep).length) return review(); ({ data, error } = await sb.from('pages').update(keep).eq('id', pg.id).select('id')); basics = true; }
    if (!error && Array.isArray(data) && data.length) { dropDraft(pg.slug, patch); return basics ? 'basics' : 'saved'; }
    return review();
  } catch (e) { return review(); }
}
/* ---------- founder connection, client side ----------
   v17's trigger connects every new member to Zach. Before that SQL exists (or if it failed), the client can only
   insert rows where requester = me, so it sends a 'pending' request to Zach — and says exactly that. Once per device. */
let SBP = null;
async function getSB() {
  if (CL.last.sb && CL.last.sb.from && CL.last.sb.auth) return CL.last.sb;
  if (window.__aouLateSB) return window.__aouLateSB;
  if (!SBP) SBP = (async () => { const [{ createClient }, { CONFIG }] = await Promise.all([import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'), import('./aou-config.js')]); if (!CONFIG.SUPABASE_URL) return null; return createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: false } }); })().catch(() => null);
  return SBP;
}
export async function founderConnect(me) {
  try {
    if (!me || !me.id || FOUNDER_EMAILS.includes(String(me.email || '').toLowerCase())) return null; const key = 'aou_founder_' + me.id; if (lsGet(key)) return lsGet(key);
    const sb = await getSB(); if (!sb) return null;
    let fid = null;
    for (const u of ['zach', 'zachwennstedt']) { try { const { data } = await sb.rpc('find_user', { p_username: u }); const r = Array.isArray(data) ? data[0] : data; if (r && r.id) { fid = r.id; break; } } catch (e) { } }
    if (!fid) { try { const { data } = await sb.from('profiles').select('id,username').in('username', ['zach', 'zachwennstedt']).limit(1); fid = data && data[0] && data[0].id; } catch (e) { } }
    if (!fid || fid === me.id) return null;
    const { data: rows, error } = await sb.from('connections').select('id,status').or(`and(requester.eq.${me.id},addressee.eq.${fid}),and(requester.eq.${fid},addressee.eq.${me.id})`).limit(2);
    if (error) return null; if (rows && rows.length) { lsSet(key, 'ok'); return 'ok'; }
    const { error: e2 } = await sb.from('connections').insert({ requester: me.id, addressee: fid, kind: 'connect', status: 'pending' });
    if (e2) return null; lsSet(key, 'sent'); say("Request sent to Zach (the founder). He'll say hi."); return 'sent';
  } catch (e) { return null; }
}
/* ---------- "Help me get set up": re-open the guide any time ---------- */
export function openVipGuide(ctx, pg) {
  ctx = Object.assign({}, CL.last, ctx || {}); remember(ctx); const me = ctx.me || null; const v = vipFor(me);
  if (!pg) { const slug = v ? v.slugs[0] : ((me && me._pages && me._pages[0] && me._pages[0].slug) || null); pg = v ? vipPage(v, slug, me && me._pages) : slug ? Object.assign({ _guide: true }, me._pages[0]) : { _guide: true, slug: null, name: '' }; }
  if (v && v.style === 'standard' && !pg._guide) return claimModal(ctx, Object.assign({ _vip: v }, pg));
  return openSimpleGuide(ctx, pg);
}
function mountHelpButton() {
  if (document.getElementById('vg-help')) return; const b = document.createElement('button'); b.id = 'vg-help'; b.type = 'button'; b.innerHTML = `${ic('🙋')}<span>Help me get set up</span>`; b.onclick = () => openVipGuide(); document.body.appendChild(b);
}
/* ---------- the simple guide (Ritchie): large type, one thing per screen, always a way to call Zach ---------- */
const ARROW_L = '<svg class="hic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ARROW_R = '<svg class="hic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
export function openSimpleGuide(ctx, pg) {
  document.querySelectorAll('.vg-wrap').forEach(e => e.remove()); remember(ctx); CL.opened = true;
  const { sb, upload } = ctx; const me = ctx.me || null; const live = !!(sb && me && me.id); const v = (pg && pg._vip) || vipFor(me);
  const first = v ? v.name : (me && me.name ? String(me.name).split(' ')[0] : 'friend');
  const hasPage = !!(pg && pg.slug); const slug = hasPage ? canonSlug(pg.slug) : null; const brand = slug ? BRANDS.find(b => b.slug === slug) : null;
  const color = (pg && pg.extra && pg.extra.color) || (brand && brand.color) || '#0ea5e9';
  const vr = (pg && (pg.vr_home || pg.world_spot)) || (v && v.vrHome) || 'plaza';
  const mall = (v && v.mallStore) || (pg && pg.extra && pg.extra.mall) || null;
  const flat = Object.assign({}, (me && me.home && me.home.flat) || {}); let photo = flat.avatar || null; let cover = (pg && pg.cover) || null;
  const KEYS = ['welcome', 'photo', 'about'].concat(hasPage ? ['page'] : []).concat(hasPage || mall ? ['store'] : ['world']).concat(['done']);
  let i = Math.max(0, Math.min(KEYS.length - 2, +(lsGet('aou_guide_step') || 0) || 0)); if (lsGet('aou_guide_done')) i = 0;
  const w = document.createElement('div'); w.className = 'vg-wrap'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'vg-h'); document.body.appendChild(w);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; const opener = document.activeElement;
  const markSeen = () => { if (slug) lsSet('aou_claimed_' + slug, String(Date.now())); lsSet('aou_tour_done', '1'); try { localStorage.removeItem('aou_tour_pending'); } catch (e) { } };
  const close = () => { markSeen(); w.remove(); removeEventListener('keydown', keys, true); document.body.style.overflow = prevOverflow; if (!lsGet('aou_guide_done') && v && v.style === 'simple') mountHelpButton(); try { opener && opener.focus && opener.focus(); } catch (e) { } };
  const status = (t) => { const s = w.querySelector('[data-vg-st]'); if (s) s.textContent = t; };
  const saveProfile = async () => { if (!live) return false; try { const home = Object.assign({}, me.home || {}, { flat }); const { error } = await sb.from('profiles').update({ home }).eq('id', me.id); if (!error) { me.home = home; return true; } } catch (e) { } return false; };
  const ensurePage = async () => {
    if (!hasPage || pg.id || !live) return pg && pg.id ? 'have' : 'none';
    /* only for a client's own business (simple style): RLS lets a member insert a page they own. Otherwise Zach finishes it. */
    if (!(v && v.style === 'simple') || !brand) return 'zach';
    try {
      let { data: ex } = await sb.from('pages').select('id,slug,owner_id,admins').in('slug', [slug, 'raised-in-a-barn-furniture'].filter((x, k, a) => a.indexOf(x) === k)).limit(1); if (ex && ex[0] && ex[0].id) { Object.assign(pg, ex[0]); return 'have'; }
      const row = { owner_id: me.id, name: brand.name, slug, tagline: pg.tagline || brand.tagline, about: brand.about, phone: brand.phone, website: brand.website, location: brand.location, hours: brand.hours };
      const extra = { color: brand.color, cat: brand.cat, mall, sections: [{ t: 'about', text: brand.about }, { t: 'services', items: brand.services || [] }, { t: 'hours', hours: brand.hours || '', location: brand.location || '' }, { t: 'faq', items: brand.faq || [] }, { t: 'cta', text: 'Ready when you are.', label: brand.phone ? 'Call ' + brand.phone : 'Visit the website', href: brand.phone ? 'tel:' + brand.phone.replace(/[^0-9+]/g, '') : brand.website }] };
      if (cover) row.cover = cover;
      let { data, error } = await sb.from('pages').insert(Object.assign({ extra, admins: [], admin_emails: FOUNDER_EMAILS.concat([String(me.email || '').toLowerCase()]), vr_home: vr }, row)).select('id').maybeSingle();
      if (error && /admin_emails|vr_home|extra|admins|schema cache|column/i.test(error.message || '')) ({ data, error } = await sb.from('pages').insert(row).select('id').maybeSingle());
      if (!error) { if (data && data.id) pg.id = data.id; pg.owner_id = me.id; return 'made'; }
    } catch (e) { }
    return 'zach';
  };
  const helpBar = `<div class="vg-help"><a class="vg-call" href="${ZACH_TEL}">${ic('📞')}<span>Call Zach for help: <b>${ZACH_PHONE}</b></span></a><a class="vg-mail" href="mailto:${ZACH_MAIL}?subject=${encodeURIComponent('Help with allofus.one')}">${ic('📧')}<span>Email Zach</span></a></div>`;
  const pagePreview = () => { const p = Object.assign({}, brand || {}, pg || {}); const bg = cover ? `background-image:url(${esc(cover)})` : `background:linear-gradient(135deg,${esc(color)},#0b1a3a)`; const tel = p.phone ? 'tel:' + String(p.phone).replace(/[^0-9+]/g, '') : ''; return `<div class="vg-page"><div class="cv" style="${bg}" role="img" aria-label="${cover ? 'Your page picture' : 'Your page picture (a colour for now)'}"></div><div class="bd"><h3>${esc(p.name || '')}</h3>${p.tagline ? `<p class="tg">${esc(p.tagline)}</p>` : ''}<ul>${p.phone ? `<li>${ic('📞')}<a href="${esc(tel)}">${esc(p.phone)}</a></li>` : ''}${p.website ? `<li>${ic('🌐')}<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(String(p.website).replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></li>` : ''}${p.location ? `<li>${ic('🏠')}<span>${esc(p.location)}</span></li>` : ''}</ul></div></div>`; };
  const SCREENS = {
    welcome: () => `<div class="vg-hi"><span class="vg-av" style="background-image:url(/images/zach-face-shades.webp)" role="img" aria-label="Zach"></span></div><h2 id="vg-h" tabindex="-1">Welcome, ${esc(first)}!</h2><p class="vg-lead">${v ? 'Zach set this up for you.' : 'Let’s get you set up.'}</p><p>${esc((v && v.welcome) || 'One small step at a time. Nothing here can break, and you can change anything later.')}</p><p>It takes about five minutes. If you get stuck, the phone number above goes straight to Zach.</p>${live ? '' : '<p class="vg-note">This is a preview. Sign in and everything you do here is saved.</p>'}`,
    photo: () => `<h2 id="vg-h" tabindex="-1">Add your photo</h2><p>People like to see who they are talking to. A clear photo of your face works best.</p><div class="vg-photo"><span class="vg-me" ${photo ? `style="background-image:url(${esc(photo)})"` : ''} role="img" aria-label="${photo ? 'Your photo' : 'No photo yet'}">${photo ? '' : esc((first || 'Y')[0].toUpperCase())}</span><label class="vg-big vg-p">${ic('📷')}<span>${photo ? 'Change my photo' : 'Take or choose a photo'}</span><input type="file" accept="image/*" data-vg-photo class="vg-file"></label></div><p class="vg-st" data-vg-st aria-live="polite"></p><p class="vg-soft">No photo right now? That is fine. Tap <b>Next</b>.</p>`,
    about: () => `<h2 id="vg-h" tabindex="-1">A sentence about you</h2><p>We wrote one to get you started. Keep it, or change any words you like.</p><label for="vg-bio" class="vg-lbl">About you</label><textarea id="vg-bio" maxlength="500" rows="4">${esc(flat.bio || (v && v.bio) || '')}</textarea><p class="vg-st" data-vg-st aria-live="polite"></p>`,
    page: () => `<h2 id="vg-h" tabindex="-1">Your business page</h2><p>This is your <b>${esc((pg && pg.name) || '')}</b> page. We filled it in from your website.</p>${pagePreview()}<div class="vg-two"><button class="vg-big vg-p" data-vg-good>${ic('✅')}<span>Looks good</span></button><label class="vg-big">${ic('🖼️')}<span>Change the picture</span><input type="file" accept="image/*" data-vg-cover class="vg-file"></label></div><p class="vg-st" data-vg-st aria-live="polite"></p>`,
    store: () => `<h2 id="vg-h" tabindex="-1">Your store in the 3D mall</h2><p>${mall ? 'You have a store in World VR Mall. People walk in, look around and see your furniture, right from their computer or phone.' : 'Your page has a spot in the 3D world too.'}</p><div class="vg-col">${mall ? `<a class="vg-big vg-p" href="${esc(mall)}" target="_blank" rel="noopener">${ic('🛍️')}<span>Walk into my store</span></a>` : ''}<a class="vg-big" href="/world/?to=${encodeURIComponent(vr)}" target="_blank" rel="noopener">${ic('🧊')}<span>Explore allofus in 3D</span></a></div><p class="vg-soft">These open in a new tab. Come back to this tab when you are done looking.</p>`,
    world: () => `<h2 id="vg-h" tabindex="-1">allofus in 3D</h2><p>The same place, as a world you can walk around in. It works on a computer, a phone, or a VR headset.</p><div class="vg-col"><a class="vg-big vg-p" href="/world/?to=${encodeURIComponent(vr)}" target="_blank" rel="noopener">${ic('🧊')}<span>Explore allofus in 3D</span></a></div><p class="vg-soft">This opens in a new tab.</p>`,
    done: () => `<h2 id="vg-h" tabindex="-1">You're all set, ${esc(first)}!</h2><p>That is everything. Here are the three things people do most:</p><div class="vg-col"><button class="vg-big vg-p" data-vg-post>${ic('📷')}<span>${hasPage && v && v.style === 'simple' ? 'Post a photo of my furniture' : 'Post a photo'}</span></button><button class="vg-big" data-vg-invite>${ic('🤝')}<span>Invite a friend</span></button>${hasPage ? `<button class="vg-big" data-vg-mypage>${ic('🏠')}<span>Go to my page</span></button>` : `<a class="vg-big" href="/?v=u">${ic('🏠')}<span>Go to my page</span></a>`}</div><div data-vg-inv hidden class="vg-inv"></div><p class="vg-soft">You can open this guide again any time: tap <b>Help me get set up</b>, or go to allofus.one/?guide=1</p>`
  };
  const draw = () => {
    const k = KEYS[i]; lsSet('aou_guide_step', String(i)); const last = i === KEYS.length - 1;
    w.innerHTML = `<div class="vg"><div class="vg-top"><div class="vg-prog"><span>Step ${i + 1} of ${KEYS.length}</span><div class="vg-bar" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax="${KEYS.length}" aria-valuenow="${i + 1}"><i style="width:${Math.round((i + 1) / KEYS.length * 100)}%;background:${esc(color)}"></i></div></div>${helpBar}</div><div class="vg-body">${SCREENS[k]()}</div><div class="vg-nav">${i ? `<button class="vg-big vg-back" data-vg-back>${ARROW_L}<span>Back</span></button>` : '<span></span>'}<button class="vg-big vg-p vg-next" data-vg-next><span>${last ? 'Close' : i === 0 ? "Let's start" : 'Next'}</span>${last ? '' : ARROW_R}</button></div>${last ? '' : '<div class="vg-later"><button data-vg-later>I’ll do this later</button></div>'}</div>`;
    const q = (s) => w.querySelector(s);
    q('[data-vg-next]').onclick = next; const bk = q('[data-vg-back]'); if (bk) bk.onclick = () => { i = Math.max(0, i - 1); draw(); }; const lt = q('[data-vg-later]'); if (lt) lt.onclick = () => { close(); say('No problem. Tap "Help me get set up" whenever you are ready.'); };
    const ph = q('[data-vg-photo]'); if (ph) ph.onchange = async () => { const f = ph.files && ph.files[0]; if (!f) return; if (!live || !upload) { status('Photos save once you are signed in.'); return; } status('Uploading your photo…'); try { photo = await upload(f, 'avatars'); flat.avatar = photo; const me2 = q('.vg-me'); me2.style.backgroundImage = 'url(' + photo + ')'; me2.textContent = ''; status((await saveProfile()) ? 'Saved. That looks great.' : 'Uploaded. Zach will make sure it is saved.'); } catch (e) { status('That photo did not upload. You can skip it and try later.'); } };
    const bio = q('#vg-bio'); if (bio) { let t = null; bio.oninput = () => { clearTimeout(t); status(''); t = setTimeout(async () => { flat.bio = bio.value.trim().slice(0, 500); if (await saveProfile()) status('Saved.'); }, 1200); }; }
    const gd = q('[data-vg-good]'); if (gd) gd.onclick = async () => { gd.disabled = true; status('Saving your page…'); const r = await ensurePage(); status(r === 'zach' ? 'Zach will finish setting up your page. You do not need to do anything.' : r === 'none' ? '' : 'Saved.'); setTimeout(next, r === 'zach' ? 1600 : 500); };
    const cv = q('[data-vg-cover]'); if (cv) cv.onchange = async () => { const f = cv.files && cv.files[0]; if (!f) return; if (!live || !upload) { status('Pictures save once you are signed in.'); return; } status('Uploading the picture…'); try { cover = await upload(f, 'pages'); const c = q('.vg-page .cv'); c.style.background = ''; c.style.backgroundImage = 'url(' + cover + ')'; c.style.backgroundSize = 'cover'; c.style.backgroundPosition = 'center'; const made = await ensurePage(); if (made === 'zach') { keepDraft(slug, { cover }); status('Got it. Zach will put this picture on your page.'); return; } const r = made === 'made' ? 'saved' : await savePagePatch(sb, pg, { cover }, me); status(r === 'review' ? 'Got it. Zach will put this picture on your page.' : 'Saved. Your page has the new picture.'); if (pg) pg.cover = cover; } catch (e) { status('That picture did not upload. You can try again later.'); } };
    const po = q('[data-vg-post]'); if (po) po.onclick = () => { finish(); try { sessionStorage.setItem('aou_open_comp', '1'); } catch (e) { } if (location.pathname === '/' && !/[?&](page|v|u)=/.test(location.search)) openComposerSoon(); else location.href = '/'; };
    const mp = q('[data-vg-mypage]'); if (mp) mp.onclick = () => { finish(); location.href = '/?page=' + encodeURIComponent(slug); };
    const iv = q('[data-vg-invite]'); if (iv) iv.onclick = async () => { const url = 'https://allofus.one/' + (me && me.username ? '?u=' + encodeURIComponent(me.username) : ''); const text = `Come join me on allofus.one. ${hasPage && pg.name ? 'My page: ' + pg.name + '. ' : ''}`; if (navigator.share) { try { await navigator.share({ title: 'allofus.one', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } } const box = q('[data-vg-inv]'); box.hidden = false; box.innerHTML = `<p>Send your friend this link:</p><input readonly value="${esc(url)}" aria-label="Invite link"><div class="vg-two"><a class="vg-big" href="sms:?&body=${encodeURIComponent(text + url)}">${ic('💬')}<span>Text it</span></a><a class="vg-big" href="mailto:?subject=${encodeURIComponent('Join me on allofus.one')}&body=${encodeURIComponent(text + url)}">${ic('📧')}<span>Email it</span></a><button class="vg-big" data-vg-copy>${ic('🔗')}<span>Copy the link</span></button></div>`; box.querySelector('[data-vg-copy]').onclick = async () => { try { await navigator.clipboard.writeText(url); say('Link copied'); } catch (e) { box.querySelector('input').select(); } }; };
    setTimeout(() => { const h = q('#vg-h'); h && h.focus(); }, 30);
  };
  const finish = () => { lsSet('aou_guide_done', '1'); lsSet('aou_guide_step', '0'); const hb = document.getElementById('vg-help'); if (hb) hb.remove(); close(); const hb2 = document.getElementById('vg-help'); if (hb2) hb2.remove(); };
  const next = async () => {
    const k = KEYS[i];
    if (k === 'about') { const b = w.querySelector('#vg-bio'); if (b) { flat.bio = b.value.trim().slice(0, 500); await saveProfile(); } }
    if (k === 'page' && hasPage && !pg.id && live) { await ensurePage(); }
    if (i >= KEYS.length - 1) { finish(); say('You are all set. Welcome in.'); return; }
    i++; draw();
  };
  const keys = (e) => { if (!w.isConnected) return; if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { const f = [...w.querySelectorAll('a[href],button:not([disabled]),textarea,input:not([type=file]),label.vg-big')]; if (!f.length) return; const a = document.activeElement; const ix = f.indexOf(a); if (e.shiftKey && ix <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && ix === f.length - 1) { e.preventDefault(); f[0].focus(); } else if (!w.contains(a)) { e.preventDefault(); f[0].focus(); } } };
  addEventListener('keydown', keys, true); draw(); return { close, next };
}
/* file inputs inside big labels: Enter / Space on the label opens the picker */
if (typeof document !== 'undefined') document.addEventListener('keydown', (e) => { const l = e.target && e.target.closest && e.target.closest('label.vg-big'); if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const inp = l.querySelector('input[type=file]'); if (inp) inp.click(); } });
function openComposerSoon() { let n = 0; const t = setInterval(() => { n++; const b = document.querySelector('[data-open-comp]'); if (b || n > 30) { clearInterval(t); try { sessionStorage.removeItem('aou_open_comp'); } catch (e) { } if (b) { b.click(); setTimeout(() => { const pics = document.querySelector('.fl-comp [data-x="pics"]'); if (pics) pics.click(); }, 300); } } }, 300); }
/* module start (the Feed imports this file on every page): ?guide=1 for visitors who are not signed in (demo / before
   sign-in), and the "post a photo" hand-off after the guide navigated to the Feed. flat2 calls claimDue() for members. */
try {
  if (typeof window !== 'undefined' && !window.__aouOnboardInit) { window.__aouOnboardInit = true;
    try { if (sessionStorage.getItem('aou_open_comp') === '1') setTimeout(openComposerSoon, 1500); } catch (e) { }
    if (guideParam()) { let n = 0; const t = setInterval(() => { n++; if (CL.dueCalled || CL.opened || document.querySelector('.vg-wrap,.cl-wrap')) { clearInterval(t); return; } const booted = document.querySelector('.fl-top') && !document.querySelector('.fl-skel'); if ((booted && n > 8) || n > 24) { clearInterval(t); if (!CL.dueCalled && !CL.opened) openVipGuide({}); } }, 500); }
  }
} catch (e) { }

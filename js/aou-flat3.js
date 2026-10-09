/* ============================================================
   allofus.one · FLAT v9 (Oct 9 2026, launch night)
   - Header: brand · Feed/3D/VR · search · Invite · Acting as · Admin · bug, then an edge-to-edge row of nav tiles
   - Mobile: compact header, a bottom bar with Post in the middle and a More sheet (everything else, Admin, bug report)
   - Floating buttons never sit on content: the bug button lives in the header / More sheet, Orbit is a slim edge tab
   - Invite friends (personal ?ref= link, every share target, an in-page QR code, a count of who joined with it)
   - One share sheet for posts, profiles and Brand pages · Pages I manage + the profile ↔ page switcher
   - World news from Action Global News (rail, mobile swipe strip, a News filter) · a day-aware welcome
   - Account essentials: download my data, delete my account (honest about what needs a person)
   Everything here works in demo mode (no Supabase), with the CDN blocked and before the v17-v19 SQL is run.
   ============================================================ */
import { ic } from './aou-icons2.js';
import { qrSVG } from './aou-qr.js';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = (d, w = 20) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I3 = {
  invite: S('<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 4-6 7-6s6 2 7 6M19 8v6M16 11h6"/>'),
  share: S('<path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M12 3v12M7 8l5-5 5 5"/>'),
  link: S('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  copy: S('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  shield: S('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  bug: S('<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7V4M9 4l1.5 2M15 4l-1.5 2M7 12H3M21 12h-4M7 16l-3 2M17 16l3 2M7 9L4 7M17 9l3-2M12 11v8"/>'),
  chev: S('<path d="M6 9l6 6 6-6"/>', 16),
  search: S('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>', 24),
  more: S('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', 22),
  home: S('<path d="M3 11.5 12 4l9 7.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>', 22),
  people: S('<circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7 1"/>', 22),
  bell: S('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', 22),
  me: S('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 22),
  news: S('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M7 9h10M7 13h6M7 17h10"/>'),
  ext: S('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 16),
  qr: S('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'),
  download: S('<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 3v12M7 10l5 5 5-5"/>'),
  trash: S('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>'),
  x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: S('<path d="M5 12l5 5 9-10"/>'),
  swap: S('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
  back: S('<path d="M15 6l-6 6 6 6"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  pen: S('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3"/>'),
  biz: S('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3M3 13h18"/>'),
  help: S('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
  out: S('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>')
};
/* simple glyphs for the share targets (original line drawings, not the networks' logos) */
const G = {
  x: S('<path d="M4 4l16 16M20 4L4 20"/>'), fb: S('<path d="M14 21v-8h3l.5-3H14V8c0-1 .5-2 2-2h1.5V3.2C17 3.1 16 3 15 3c-2.6 0-4 1.6-4 4.3V10H8v3h3v8"/>'),
  li: S('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'), wa: S('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>'),
  sms: S('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>'), mail: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  rd: S('<circle cx="12" cy="14" r="6.5"/><path d="M9.5 14h.01M14.5 14h.01M9.5 16.5c1.5 1 3.5 1 5 0M12 7.5l1.5-4 3.5 1M19 9.5a1.6 1.6 0 1 0-1.8-2.6M5 9.5a1.6 1.6 0 1 1 1.8-2.6"/><circle cx="17.5" cy="4.5" r="1"/>'),
  tg: S('<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l8-6"/>'), dc: S('<path d="M7 7c3-1.5 7-1.5 10 0l2 9c-1.5 1.5-3.5 2.5-5 2.5l-1-2M7 7L5 16c1.5 1.5 3.5 2.5 5 2.5l1-2M8 15c2.5 1.2 5.5 1.2 8 0"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>'),
  native: S('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 6v8M9 9l3-3 3 3M10 18h4"/>')
};
const NET_ADMINS = ['zach@eyetoad.com', 'zachwennstedt@gmail.com'];
const isNetEmail = (e) => NET_ADMINS.includes(String(e || '').toLowerCase());
export const SITE = 'https://allofus.one';
export const inviteLink = (me) => SITE + '/' + (me && me.username ? '?ref=' + encodeURIComponent(me.username) : '');
export const profileLink = (u) => SITE + '/?u=' + encodeURIComponent(u || '');
const avatarOf = (me) => (me && me.home && me.home.flat && me.home.flat.avatar) || '';
const toastOf = (ctx) => (ctx && ctx.toast) || ((m) => console.log(m));
const copy = async (text, ctx, what = 'Link copied') => { try { await navigator.clipboard.writeText(text); toastOf(ctx)(what); return true; } catch (e) { try { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); if (ok) { toastOf(ctx)(what); return true; } } catch (e2) { } prompt('Copy this', text); return false; } };
const day = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });
const timeAgo = (d) => { const s = (Date.now() - new Date(d).getTime()) / 1000; if (!isFinite(s)) return ''; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago'; return new Date(d).toLocaleDateString(); };
const safeUrl = (u, rel) => { const s = String(u || '').trim(); if (/^https?:\/\//i.test(s)) return s; if (rel && /^\/[^/]/.test(s)) return s; return ''; };

/* ---------------- a sheet (bottom sheet on phones, centred card on laptops) ---------------- */
export function sheet(title, html, opts = {}) {
  $$('.sh-wrap').forEach(e => e.remove()); const w = document.createElement('div'); w.className = 'sh-wrap' + (opts.wide ? ' wide' : '');
  w.innerHTML = `<div class="sh" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh-hd"><h3>${opts.icon || ''}<span>${esc(title)}</span></h3><button class="sh-x" data-shx aria-label="Close">${I3.x}</button></div><div class="sh-bd">${html}</div></div>`;
  document.body.appendChild(w); document.body.classList.add('sh-open');
  const close = () => { w.remove(); if (!$('.sh-wrap')) document.body.classList.remove('sh-open'); document.removeEventListener('keydown', onKey); opts.onClose && opts.onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
  $('[data-shx]', w).onclick = close; w.addEventListener('click', (e) => { if (e.target === w) close(); });
  setTimeout(() => { const f = $('.sh-bd button, .sh-bd a, .sh-bd input', w); if (f && !opts.noFocus) try { f.focus({ preventScroll: true }); } catch (e) { } }, 30);
  return { el: w, close };
}

/* ---------------- share targets ---------------- */
export function shareTargets({ url, text, title }) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text || title || 'allofus.one'), tu = encodeURIComponent((text ? text + ' ' : '') + url);
  return [
    ['x', 'X', `https://twitter.com/intent/tweet?text=${t}&url=${u}`], ['fb', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['li', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`], ['wa', 'WhatsApp', `https://wa.me/?text=${tu}`],
    ['sms', 'Text message', `sms:?&body=${tu}`], ['mail', 'Email', `mailto:?subject=${encodeURIComponent(title || 'From allofus.one')}&body=${encodeURIComponent((text || '') + '\n\n' + url)}`],
    ['rd', 'Reddit', `https://www.reddit.com/submit?url=${u}&title=${t}`], ['tg', 'Telegram', `https://t.me/share/url?url=${u}&text=${t}`]
  ];
}
const targetsHTML = (o) => `<div class="sh-grid">${navigator.share ? `<button class="sh-t" data-native>${G.native}<span>Share…</span></button>` : ''}<button class="sh-t" data-copy>${I3.link}<span>Copy link</span></button>${shareTargets(o).map(([k, n, h]) => `<a class="sh-t" href="${esc(h)}" ${/^(sms|mailto):/.test(h) ? '' : 'target="_blank" rel="noopener"'} data-t="${k}">${G[k]}<span>${n}</span></a>`).join('')}<button class="sh-t" data-discord>${G.dc}<span>Discord</span></button><button class="sh-t" data-qr>${I3.qr}<span>QR code</span></button></div><div class="sh-qr" data-qrbox hidden></div><p class="sh-note" data-dcnote hidden>Discord has no share link. Your message and link are copied: open Discord, pick a chat and paste.</p>`;
const wireTargets = (root, o, ctx) => {
  const nb = $('[data-native]', root); if (nb) nb.onclick = () => { navigator.share({ title: o.title || 'allofus.one', text: o.text || '', url: o.url }).catch(() => { }); };
  $('[data-copy]', root).onclick = () => copy(o.url, ctx);
  $('[data-discord]', root).onclick = async () => { await copy((o.text ? o.text + '\n' : '') + o.url, ctx, 'Message copied — paste it in Discord'); const n = $('[data-dcnote]', root); if (n) n.hidden = false; window.open('https://discord.com/channels/@me', '_blank', 'noopener'); };
  $('[data-qr]', root).onclick = () => { const b = $('[data-qrbox]', root); if (!b.hidden) { b.hidden = true; return; } try { b.innerHTML = qrSVG(o.url, { size: 200, label: 'QR code for ' + o.url }) + `<small>Point a phone camera here. It opens ${esc(o.url.replace(/^https?:\/\//, ''))}</small>`; } catch (e) { b.textContent = 'This link is too long for a QR code.'; } b.hidden = false; };
};
/* the share sheet: internal options (feed, group, room, DM, 3D sign) on top, then every network */
export function shareSheet(ctx, o) {
  const internal = o.internal || [];
  const m = sheet(o.heading || 'Share', `${o.preview ? `<div class="sh-prev">${esc(o.preview)}</div>` : ''}<div class="sh-link"><input readonly value="${esc(o.url)}" aria-label="Link"><button class="fl-btn sm p" data-copy2>${I3.copy} Copy</button></div>${internal.length ? `<div class="sh-int">${internal.map(([icon, label], i) => `<button class="sh-row" data-int="${i}">${ic(icon) || I3.share}<span>${esc(label)}</span></button>`).join('')}</div>` : ''}<h4 class="sh-h">Share to</h4>${targetsHTML(o)}`, { icon: I3.share });
  wireTargets(m.el, o, ctx); $('[data-copy2]', m.el).onclick = () => copy(o.url, ctx);
  $$('[data-int]', m.el).forEach(b => b.onclick = () => { m.close(); try { internal[+b.dataset.int][2](); } catch (e) { } });
  return m;
}

/* ---------------- invite friends ---------------- */
export const inviteText = () => 'Join me on allofus.one: your feed, your page, your people. No hidden algorithm, free to join.';
export async function joinedCount(ctx) { const me = ctx.getMe(); if (!me || !me.username || !ctx.live) return null; try { const { count, error } = await ctx.sb.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', me.username); if (error) return null; return typeof count === 'number' ? count : null; } catch (e) { return null; } }
export function inviteSheet(ctx) {
  const me = ctx.getMe(); const url = inviteLink(me); const o = { url, text: inviteText(), title: 'Join me on allofus.one' };
  const m = sheet('Invite friends', `${me ? '' : `<p class="sh-note">Join first and your invite link carries your name. You can still share allofus.one right now.</p>`}<div class="inv-top"><div class="inv-qr">${(() => { try { return qrSVG(url, { size: 156, label: 'QR code for your invite link' }); } catch (e) { return ''; } })()}</div><div class="inv-main"><label class="sh-lbl">${me ? 'Your personal invite link' : 'The allofus.one link'}</label><div class="sh-link"><input readonly value="${esc(url)}" aria-label="Invite link"><button class="fl-btn sm p" data-copy2>${I3.copy} Copy</button></div><p class="inv-count" data-joined>${me ? 'Counting who joined with your link…' : ''}</p><p class="sh-note">They land on the Feed with a Join button. When they sign up with your link, it counts here.</p></div></div><h4 class="sh-h">Send it</h4>${targetsHTML(o)}`, { icon: I3.invite, wide: true });
  wireTargets(m.el, o, ctx); $('[data-copy2]', m.el).onclick = () => copy(url, ctx);
  (async () => { const el = $('[data-joined]', m.el); if (!el || !me) return; const n = await joinedCount(ctx); el.innerHTML = n === null ? 'Sign-ups through your link will be counted here.' : `<b>${n}</b> ${n === 1 ? 'person has' : 'people have'} joined with your link.`; })();
  return m;
}
export function inviteCardHTML(me) { return `<div class="fl-card inv-card"><div class="inv-ic">${I3.invite}</div><div class="inv-tx"><b>Invite friends</b><span>Your link, every app, a QR code.</span></div><button class="fl-btn sm p" data-invite>${I3.share} Invite</button></div>`; }

/* ---------------- header pieces ---------------- */
export function actingName(me, pages) { const a = (() => { try { return localStorage.getItem('aou_actas') || ''; } catch (e) { return ''; } })(); const pg = a && (pages || []).find(p => p.slug === a); return pg ? pg : null; }
export function headerActionsHTML(me, pages) {
  if (!me) return `<div class="hact"><button class="ha hs" data-hsearch aria-label="Search">${I3.search}</button><button class="ha" data-signin>${ic('🔑') || ''}<span>Sign in</span></button><button class="ha p" data-join>${I3.invite}<span>Join free</span></button></div>`;
  const act = actingName(me, pages); const av = act ? (act.logo || '') : avatarOf(me); const nm = act ? act.name : (me.name || 'Me');
  return `<div class="hact"><button class="ha hs" data-hsearch aria-label="Search">${I3.search}</button><button class="ha inv" data-invite aria-label="Invite friends">${I3.invite}<span>Invite</span></button><button class="ha actas${act ? ' page' : ''}" data-actas aria-haspopup="menu" aria-label="Acting as ${esc(nm)}. Switch profile or page"><i class="av" ${av ? `style="background-image:url(${esc(av)})"` : act && act.color ? `style="background:${esc(act.color)}"` : ''}>${av ? '' : esc((nm || 'M')[0])}</i><span class="t"><small>Acting as</small><b>${esc(nm)}</b></span>${I3.chev}</button>${me.isAdmin ? `<a class="ha adm" href="/?v=admin" aria-label="Admin dashboard">${I3.shield}<span>Admin</span></a>` : ''}<button class="ha bug" data-bug aria-label="Report a bug" title="Report a bug">${I3.bug}</button></div>`;
}
/* the profile ↔ page switcher: personal profile + every managed page; picking one goes there and sets the posting identity */
export function openActas(btn, ctx) {
  const me = ctx.getMe(); if (!me) return; const pages = ctx.myPages(); const cur = (() => { try { return localStorage.getItem('aou_actas') || ''; } catch (e) { return ''; } })();
  $$('.as-menu').forEach(x => x.remove()); const m = document.createElement('div'); m.className = 'as-menu'; m.setAttribute('role', 'menu');
  const row = (slug, name, sub, av, color, on) => `<button role="menuitemradio" aria-checked="${on}" class="as-row${on ? ' on' : ''}" data-as="${esc(slug)}"><i class="av" ${av ? `style="background-image:url(${esc(av)})"` : color ? `style="background:${esc(color)}"` : ''}>${av ? '' : esc((name || 'P')[0])}</i><span><b>${esc(name)}</b><small>${esc(sub)}</small></span>${on ? I3.check : ''}</button>`;
  m.innerHTML = `<div class="as-h">Acting as</div>${row('', me.name || 'Me', 'Personal profile' + (me.username ? ' · @' + me.username : ''), avatarOf(me), '', !cur)}${pages.length ? '<div class="as-h">Pages I manage</div>' + pages.map(p => row(p.slug, p.name, p.builtin ? 'network page · not saved yet' : (p.owner_id === me.id ? 'owner' : 'manager'), p.logo, p.color || (p.extra && p.extra.color), cur === p.slug)).join('') : '<p class="as-none">No pages yet. <a href="/?v=brand">Build a Brand page</a></p>'}<div class="as-foot"><a href="/?v=panel#p-pages">${I3.gear} Manage pages</a><button data-asinv>${I3.invite} Invite friends</button></div>`;
  document.body.appendChild(m); const r = btn.getBoundingClientRect(); const w = Math.min(320, innerWidth - 16); m.style.width = w + 'px'; m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; m.style.top = (r.bottom + 6) + 'px';
  const close = () => { m.remove(); document.removeEventListener('click', away, true); }; const away = (e) => { if (!m.contains(e.target) && !btn.contains(e.target)) close(); }; setTimeout(() => document.addEventListener('click', away, true), 0);
  $$('[data-as]', m).forEach(b => b.onclick = () => { const s = b.dataset.as; try { if (s) localStorage.setItem('aou_actas', s); else localStorage.removeItem('aou_actas'); } catch (e) { } close(); toastOf(ctx)(s ? 'Acting as ' + (pages.find(p => p.slug === s) || {}).name + '. Your posts go out as this page.' : 'Back to your personal profile'); location.href = s ? '/?page=' + encodeURIComponent(s) : '/?v=u'; });
  $('[data-asinv]', m).onclick = () => { close(); inviteSheet(ctx); };
  const first = $('.as-row', m); if (first) first.focus();
}
/* bar on a managed Brand page: who you are acting as, and the way back */
export function pageActingBar(ctx, slug) {
  const me = ctx.getMe(); if (!me) return null; const pg = ctx.myPages().find(p => p.slug === slug); if (!pg) return null; const cur = (() => { try { return localStorage.getItem('aou_actas') || ''; } catch (e) { return ''; } })();
  const b = document.createElement('div'); b.className = 'pg-actbar'; b.innerHTML = `<span class="pa-who">${I3.biz}<span>${cur === slug ? 'Acting as' : 'You manage'} <b>${esc(pg.name)}</b></span></span><span class="pa-acts">${cur === slug ? '' : `<button class="fl-btn sm p" data-pa-act>${I3.swap} Act as this page</button>`}<a class="fl-btn sm" href="/?page=${esc(slug)}&manage=1">${I3.gear} Manage</a><button class="fl-btn sm" data-pa-share>${I3.share} Share</button><button class="fl-btn sm" data-pa-back>${I3.back} Back to my profile</button></span>`;
  const act = $('[data-pa-act]', b); if (act) act.onclick = () => { try { localStorage.setItem('aou_actas', slug); } catch (e) { } toastOf(ctx)('Acting as ' + pg.name); location.reload(); };
  $('[data-pa-back]', b).onclick = () => { try { localStorage.removeItem('aou_actas'); } catch (e) { } location.href = '/?v=u'; };
  $('[data-pa-share]', b).onclick = () => shareSheet(ctx, { url: SITE + '/?page=' + encodeURIComponent(slug), text: pg.name + (pg.tagline ? ' · ' + pg.tagline : '') + ' on allofus.one', title: pg.name, heading: 'Share ' + pg.name });
  return b;
}

/* ---------------- Pages I manage (profile, prominent) ---------------- */
export function managedPagesHTML(list, me, opts = {}) {
  const act = (() => { try { return localStorage.getItem('aou_actas') || ''; } catch (e) { return ''; } })();
  if (!list.length) return `<section class="mp-sec" id="u-managed"><div class="mp-hd"><h2>${I3.biz}<span>Pages I manage</span></h2><a class="fl-btn sm p" href="/?v=brand">${ic('＋')} Build a Brand page</a></div><p class="muted">No business pages yet. A Brand page is free, has real SEO built in and runs from this profile.</p></section>`;
  return `<section class="mp-sec" id="u-managed"><div class="mp-hd"><h2>${I3.biz}<span>Pages I manage</span><em>${list.length}</em></h2><div class="mp-hb"><a class="fl-btn sm" href="/?v=brand">${ic('＋')} New page</a></div></div><div class="mp-grid">${list.map(p => { const col = p.color || (p.extra && p.extra.color) || '#1e3a6a'; const cover = safeUrl(p.cover, true); const logo = safeUrl(p.logo, true); const role = p.builtin ? 'Network page · not saved yet' : (me && p.owner_id === me.id ? 'Owner' : 'Manager'); return `<article class="mp-card" data-slug="${esc(p.slug)}" style="--bc:${esc(col)}"><a class="mp-cv" href="/?page=${esc(p.slug)}" style="${cover ? `background-image:url(${esc(cover)})` : ''}" aria-label="Open ${esc(p.name)}"><i class="mp-lg" ${logo ? `style="background-image:url(${esc(logo)})"` : ''}>${logo ? '' : esc((p.name || 'P')[0])}</i></a><div class="mp-b"><b>${esc(p.name)}</b><small>${esc(p.tagline || '')}</small><span class="mp-role">${role}${act === p.slug ? ' · acting as' : ''}</span></div><div class="mp-acts"><a class="fl-btn sm" href="/?page=${esc(p.slug)}">${I3.globe} Open</a><a class="fl-btn sm" href="/?page=${esc(p.slug)}&manage=1">${I3.gear} Manage</a>${p.builtin ? (opts.canSetup ? `<button class="fl-btn sm p" data-setup-one="${esc(p.slug)}">${ic('＋')} Save page</button>` : '') : `<button class="fl-btn sm ${act === p.slug ? 'p' : ''}" data-postas="${esc(p.slug)}">${I3.pen} Post as</button>`}</div></article>`; }).join('')}</div></section>`;
}

/* ---------------- world news · Action Global News (JSON Feed 1.1) ---------------- */
const NEWS_URL = 'https://actionglobalnews.com/feed.json'; let newsP = null;
export function fetchNews() {
  if (newsP) return newsP;
  newsP = (async () => {
    try { const c = JSON.parse(sessionStorage.getItem('aou_news') || 'null'); if (c && Date.now() - c.t < 30 * 60 * 1000) return c.items && c.items.length ? c.items : null; } catch (e) { }
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null; const to = setTimeout(() => { try { ac && ac.abort(); } catch (e) { } }, 6000);
    try { const r = await Promise.race([fetch(NEWS_URL, { signal: ac ? ac.signal : undefined, credentials: 'omit' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6200))]); if (!r.ok) throw new Error('news ' + r.status); const j = await r.json();
      const items = (j.items || []).map(i => ({ id: String(i.id || i.url || ''), url: safeUrl(i.url || i.external_url), title: String(i.title || '').trim(), summary: String(i.summary || i.content_text || '').replace(/<[^>]+>/g, '').trim().slice(0, 240), date: i.date_published || i.date_modified || '', image: safeUrl(i.image || i.banner_image, false), tag: (i.tags || [])[0] || 'World' })).filter(i => i.url && i.title).slice(0, 24);
      try { sessionStorage.setItem('aou_news', JSON.stringify({ t: Date.now(), items })); } catch (e) { } return items.length ? items : null;
    } catch (e) { try { sessionStorage.setItem('aou_news', JSON.stringify({ t: Date.now() - 25 * 60 * 1000, items: [] })); } catch (e2) { } return null; } finally { clearTimeout(to); }
  })(); return newsP;
}
const newsItemHTML = (n, i, big) => `<article class="nw-it${big ? ' big' : ''}">${n.image ? `<a class="nw-img" href="${esc(n.url)}" target="_blank" rel="noopener" style="background-image:url(${esc(n.image)})" aria-label="${esc(n.title)}"></a>` : `<a class="nw-img none" href="${esc(n.url)}" target="_blank" rel="noopener" aria-label="${esc(n.title)}">${I3.globe}</a>`}<div class="nw-bd"><div class="nw-meta"><span class="nw-tag">${esc(n.tag)}</span><span>${esc(timeAgo(n.date))}</span></div><a class="nw-t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>${big && n.summary ? `<p class="nw-sum">${esc(n.summary)}</p>` : ''}<div class="nw-acts"><a class="fl-btn sm" href="${esc(n.url)}" target="_blank" rel="noopener">${I3.ext} Read</a><button class="fl-btn sm" data-nshare="${i}" aria-label="Share to my feed">${I3.share} Share to feed</button></div></div></article>`;
const wireNews = (root, items, ctx) => $$('[data-nshare]', root).forEach(b => b.onclick = () => { const n = items[+b.dataset.nshare]; if (n) ctx.composeShare(n.url, n.title); });
const NEWS_HEAD = `<div class="nw-hd"><h3>${I3.news}<span>World news</span></h3><a href="https://actionglobalnews.com/" target="_blank" rel="noopener" class="nw-src">Action Global News</a></div>`;
/* right-rail card (desktop home) */
export async function newsRail(ctx, mount) { if (!mount) return; mount.hidden = true; const items = await fetchNews(); if (!items || !mount.isConnected) { mount.remove(); return; } mount.className = 'fl-card nw-card'; mount.innerHTML = NEWS_HEAD + `<div class="nw-list">${items.slice(0, 5).map((n, i) => newsItemHTML(n, i)).join('')}</div>`; mount.hidden = false; wireNews(mount, items, ctx); }
/* a horizontal swipe card dropped into the mobile feed */
export async function newsStrip(ctx, mount, offset = 0) { const items = await fetchNews(); if (!items || !mount.isConnected) { mount.remove(); return; } const slice = items.slice(offset % items.length).concat(items).slice(0, 8); mount.className = 'fl-card nw-strip'; mount.innerHTML = NEWS_HEAD + `<div class="nw-row" tabindex="0" aria-label="World news, swipe for more">${slice.map((n, i) => `<div class="nw-slide">${newsItemHTML(n, items.indexOf(n))}</div>`).join('')}</div>`; wireNews(mount, items, ctx); }
/* the News filter: the stream inline, bigger */
export async function newsFeed(ctx, mount) { mount.innerHTML = '<div class="fl-empty">Loading world news…</div>'; const items = await fetchNews(); if (!mount.isConnected) return; if (!items) { mount.innerHTML = `<div class="fl-card"><p class="muted">World news is not reachable right now. Try again in a bit, or read it at <a href="https://actionglobalnews.com/" target="_blank" rel="noopener">actionglobalnews.com</a>.</p></div>`; return; } mount.innerHTML = `<div class="fl-card nw-card nw-full">${NEWS_HEAD}<div class="nw-list">${items.map((n, i) => newsItemHTML(n, i, true)).join('')}</div></div>`; wireNews(mount, items, ctx); }

/* ---------------- day-aware welcome + a Friday treat ---------------- */
export function confetti() {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { }
  const c = document.createElement('canvas'); c.className = 'fx-confetti'; c.setAttribute('aria-hidden', 'true'); const W = c.width = innerWidth, H = c.height = innerHeight; document.body.appendChild(c); const g = c.getContext('2d'); if (!g) { c.remove(); return; }
  const cols = ['#0ea5e9', '#6366f1', '#f59e0b', '#22c55e', '#ec4899', '#38f0ff', '#ffd23f']; const P = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .28, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 4, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now(); const step = (t) => { const k = (t - t0) / 1000; g.clearRect(0, 0, W, H); P.forEach(p => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - k / 2.6); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }); if (k < 2.6) requestAnimationFrame(step); else c.remove(); }; requestAnimationFrame(step);
}
export async function greetingBanner(ctx, mount) {
  if (!mount) return; const me = ctx.getMe(); const now = new Date(); const d = day(); const h = now.getHours(); const friday = now.getDay() === 5; const first = me ? String(me.name || me.username || 'friend').split(' ')[0] : '';
  const today = now.toISOString().slice(0, 10); try { if (localStorage.getItem('aou_greet_hide') === today) { mount.remove(); return; } } catch (e) { }
  const tod = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  let isNew = false; try { isNew = !!(me && (localStorage.getItem('aou_tour_pending') === '1' || (me.createdAt && Date.now() - new Date(me.createdAt).getTime() < 36 * 3600 * 1000)) && !localStorage.getItem('aou_welcomed')); } catch (e) { }
  let ref = ''; try { ref = JSON.parse(localStorage.getItem('aou_ref') || '""') || ''; } catch (e) { ref = ''; }
  const title = isNew ? `Welcome to allofus.one${first ? ', ' + esc(first) : ''} — happy ${d}!` : me ? (friday ? `Happy Friday, ${esc(first)}` : `${tod}, ${esc(first)} — happy ${d}`) : ref ? `@${esc(ref)} invited you to allofus.one` : (friday ? 'Happy Friday — welcome to allofus.one' : `Happy ${d} — welcome to allofus.one`);
  const sub = isNew ? 'Your feed, your page, your people. Start with a hello post, then invite three friends.' : me ? '' : 'Read everything free. Join to post, react, connect and build your page.';
  mount.className = 'gr-banner' + (friday ? ' fri' : '') + (isNew ? ' new' : ''); mount.setAttribute('role', 'status');
  mount.innerHTML = `<div class="gr-tx"><b>${title}</b><span data-grsub>${esc(sub)}</span></div><div class="gr-acts">${me ? `<button class="fl-btn sm p" data-invite>${I3.invite} Invite friends</button>` : `<button class="fl-btn sm p" data-join>${I3.invite} Join free</button><button class="fl-btn sm" data-signin>Sign in</button>`}<button class="gr-x" data-grx aria-label="Hide for today">${I3.x}</button></div>`;
  $('[data-grx]', mount).onclick = () => { try { localStorage.setItem('aou_greet_hide', today); } catch (e) { } mount.remove(); };
  try { if (isNew) localStorage.setItem('aou_welcomed', '1'); } catch (e) { }
  try { if ((friday || isNew) && !sessionStorage.getItem('aou_greet_confetti')) { sessionStorage.setItem('aou_greet_confetti', '1'); setTimeout(confetti, 450); } } catch (e) { }
  if (ctx.live && ctx.sb) { try { const since = new Date(Date.now() - 7 * 864e5).toISOString(); const { count, error } = await ctx.sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since); const el = $('[data-grsub]', mount); if (!error && typeof count === 'number' && count > 0 && el) el.textContent = (sub ? sub + ' ' : '') + `${count} ${count === 1 ? 'person' : 'people'} joined this week.`; } catch (e) { } }
}

/* ---------------- the mobile More sheet ---------------- */
export function moreSheet(ctx) {
  const me = ctx.getMe(); const pages = me ? ctx.myPages() : []; const act = actingName(me, pages);
  const T = (href, icon, label, attr = '') => `<a class="mo-t" href="${href}" ${attr}>${icon}<span>${label}</span></a>`; const B = (data, icon, label) => `<button class="mo-t" ${data}>${icon}<span>${label}</span></button>`;
  const m = sheet('More', `${me ? `<button class="mo-who" data-mo-actas><i class="av" ${(act ? act.logo : avatarOf(me)) ? `style="background-image:url(${esc(act ? act.logo : avatarOf(me))})"` : ''}>${(act ? act.logo : avatarOf(me)) ? '' : esc(((act ? act.name : me.name) || 'M')[0])}</i><span><small>Acting as</small><b>${esc(act ? act.name : (me.name || 'Me'))}</b></span><em>${I3.swap} Switch</em></button>` : `<div class="mo-join"><button class="fl-btn p" data-join>${I3.invite} Join free</button><button class="fl-btn" data-signin>Sign in</button></div>`}
  <div class="mo-grid">${T('/?v=u', I3.me, 'My page')}${T('/?v=conn', I3.people, 'Connections')}${T('/?v=groups', ic('🛍️') || I3.biz, 'Groups')}${T('/?v=brand', I3.biz, 'Brand pages')}${T('/?v=video', ic('🎬') || '', 'Video')}${T('/?v=dm', ic('💬') || '', 'DMs')}${T('/?v=spaces', ic('🌐') || '', 'Spaces')}${T('/?v=events', ic('📅') || '', 'Events')}${T('/?v=inbox', ic('📬') || '', 'Inbox')}${T('/?v=board', ic('🧭') || '', 'LIFEboard')}${T('/?v=work', ic('⬡') || '', 'FLOWworks')}${T('/boost/', ic('🚀') || '', 'searchBOOST')}${T('/?v=search', I3.search, 'Search')}${B('data-invite', I3.invite, 'Invite friends')}${T('/?v=panel', I3.gear, 'Control panel')}${me && me.isAdmin ? T('/?v=admin', I3.shield, 'Admin', 'class="mo-t adm"') : ''}${T('/world/', ic('🧊') || '', '3D world')}${T('/world/?vr=1', ic('🥽') || '', 'VR')}${B('data-mo-bug', I3.bug, 'Report a bug')}${B('data-mo-help', I3.help, 'Help · Orbit')}${me ? B('data-mo-out', I3.out, 'Sign out') : ''}</div>`, { icon: I3.more });
  const wa = $('[data-mo-actas]', m.el); if (wa) wa.onclick = () => { const host = document.createElement('div'); wa.after(host); openActas(wa, ctx); };
  const bb = $('[data-mo-bug]', m.el); if (bb) bb.onclick = () => { m.close(); ctx.reportBug(); };
  const hb = $('[data-mo-help]', m.el); if (hb) hb.onclick = () => { m.close(); try { window.ORBIT && window.ORBIT.open(); } catch (e) { } };
  const ob = $('[data-mo-out]', m.el); if (ob) ob.onclick = async () => { try { await ctx.sb.auth.signOut(); } catch (e) { } try { localStorage.removeItem('aou_actas'); } catch (e) { } location.href = '/'; };
  $$('.mo-grid [data-invite]', m.el).forEach(b => b.onclick = () => { m.close(); inviteSheet(ctx); });
  return m;
}

/* ---------------- account essentials: download my data, delete my account ---------------- */
const MINE = (id) => [['profiles', 'id', id], ['feed_posts', 'user_id', id], ['feed_comments', 'user_id', id], ['feed_reactions', 'user_id', id], ['feed_saves', 'user_id', id], ['lifeboards', 'id', id], ['hugs', 'from_id', id], ['hub_messages', 'user_id', id], ['event_rsvps', 'user_id', id], ['page_follows', 'user_id', id], ['pages', 'owner_id', id]];
export async function exportMyData(ctx) {
  const me = ctx.getMe(); if (!me) return; const out = { exported_at: new Date().toISOString(), site: 'allofus.one', account: { id: me.id, email: me.email, username: me.username, name: me.name } , tables: {} };
  for (const [t, col, id] of MINE(me.id)) { try { const { data, error } = await ctx.sb.from(t).select('*').eq(col, id).limit(5000); if (!error) out.tables[t] = data || []; } catch (e) { } }
  try { const { data } = await ctx.sb.from('connections').select('*').or(`requester.eq.${me.id},addressee.eq.${me.id}`); out.tables.connections = data || []; } catch (e) { }
  try { out.device = { feed_prefs: JSON.parse(localStorage.getItem('aou_feedprefs') || 'null'), workboard: JSON.parse(localStorage.getItem('aou_workboard') || 'null') }; } catch (e) { }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `allofus-${me.username || 'me'}-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toastOf(ctx)('Your data is downloading');
  try { localStorage.setItem('aou_exported', String(Date.now())); } catch (e) { } return out;
}
export function deleteAccountSheet(ctx) {
  const me = ctx.getMe(); if (!me) return; const word = 'DELETE';
  const m = sheet('Delete my account', `<p>This removes what you posted and saved here: <b>posts, comments, reactions, saves, connections, hugs, your LIFEboard and your profile</b>. It cannot be undone.</p><ol class="del-steps"><li><b>Download your data first</b> (a JSON file of everything above).<div><button class="fl-btn sm" data-dl>${I3.download} Download my data</button></div></li><li>Type <b>${word}</b> to confirm.<input data-del-in autocomplete="off" spellcheck="false" aria-label="Type ${word} to confirm" placeholder="${word}"></li></ol><p class="sh-note">Your sign-in itself (email + password) can only be removed by our team. When you confirm, we file that request automatically and finish it within 7 days. Business pages you own are kept for their other managers; email info@eyetoad.com to remove them too.</p><div class="del-go"><button class="fl-btn" data-shx2>Keep my account</button><button class="fl-btn danger" data-del-go disabled>${I3.trash} Delete my account</button></div><div class="del-log" data-del-log></div>`, { icon: I3.trash });
  const inp = $('[data-del-in]', m.el), go = $('[data-del-go]', m.el), log = $('[data-del-log]', m.el);
  inp.oninput = () => { go.disabled = inp.value.trim().toUpperCase() !== word; }; $('[data-dl]', m.el).onclick = () => exportMyData(ctx); $('[data-shx2]', m.el).onclick = () => m.close();
  go.onclick = async () => {
    if (inp.value.trim().toUpperCase() !== word) return; go.disabled = true; inp.disabled = true; const lines = []; const say = (t, ok) => { lines.push(`<li class="${ok ? 'ok' : 'no'}">${ok ? I3.check : I3.x}<span>${esc(t)}</span></li>`); log.innerHTML = `<ul>${lines.join('')}</ul>`; };
    if (!ctx.live) { say('Demo mode: nothing is stored on a server from this page, so there is nothing to delete.', true); return; }
    let filed = false; try { const { error } = await ctx.sb.from('bugs').insert({ user_id: me.id, kind: 'delete-account', note: `Delete account request: ${me.email || ''} @${me.username || ''} (${me.id}). Content rows were removed by the member from the Control panel; please delete the auth user.`, page: '/?v=panel#p-account', ua: navigator.userAgent.slice(0, 160) }); filed = !error; } catch (e) { }
    say(filed ? 'Sign-in removal requested from our team (we finish it within 7 days).' : 'Could not file the sign-in removal automatically. Email info@eyetoad.com and we will do it.', filed);
    const steps = [['feed_reactions', 'Reactions', 'user_id'], ['feed_saves', 'Saves', 'user_id'], ['feed_comments', 'Comments', 'user_id'], ['feed_posts', 'Posts', 'user_id'], ['hugs', 'Hugs sent', 'from_id'], ['lifeboards', 'LIFEboard', 'id'], ['hub_messages', 'Room messages', 'user_id'], ['event_rsvps', 'Event RSVPs', 'user_id']];
    for (const [t, label, col] of steps) { try { const { error } = await ctx.sb.from(t).delete().eq(col, me.id); say(label + (error ? ' — could not delete (' + error.message.slice(0, 60) + ')' : ' deleted'), !error); } catch (e) { say(label + ' — skipped', false); } }
    try { const { error } = await ctx.sb.from('connections').delete().or(`requester.eq.${me.id},addressee.eq.${me.id}`); say('Connections' + (error ? ' — could not delete' : ' deleted'), !error); } catch (e) { say('Connections — skipped', false); }
    let profGone = false; try { const { error } = await ctx.sb.from('profiles').delete().eq('id', me.id); profGone = !error; if (error) { await ctx.sb.from('profiles').update({ display_name: 'Deleted member', home: {}, username: 'deleted-' + String(me.id).slice(0, 8) }).eq('id', me.id); } } catch (e) { }
    say(profGone ? 'Profile deleted' : 'Profile cleared (name, photo, bio and links removed)', true);
    try { localStorage.removeItem('aou_actas'); Object.keys(localStorage).filter(k => /^aou_draft_|^aou_feedprefs$|^aou_workboard$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { }
    log.insertAdjacentHTML('beforeend', `<p><b>Done.</b> You are being signed out. Questions: <a href="mailto:info@eyetoad.com">info@eyetoad.com</a> or 1-800-481-8638.</p>`);
    setTimeout(async () => { try { await ctx.sb.auth.signOut(); } catch (e) { } location.href = '/'; }, 4500);
  };
  return m;
}

/* ---------------- CSS (appended last: it wins) ---------------- */
export const FLAT3_CSS = `
/* ===== header: one bar, full width ===== */
.fl .fl-top{display:contents!important}
.fl .fl-top .bar{position:sticky;top:0;z-index:30;background:#06101f;display:flex;align-items:center;gap:14px;padding:10px clamp(12px,2vw,28px);max-width:none;box-sizing:border-box;border-bottom:1px solid rgba(255,255,255,.08)}
.fl .fl-top .lock{margin:0!important;flex:none;justify-content:flex-start;gap:8px}.fl .fl-top .lock .embl{width:46px!important;height:46px!important}.fl .fl-top .lock .wm .a,.fl .fl-top .lock .wm .o{font-size:27px!important}
.fl .fl-top .hrow{flex:1;display:flex;gap:12px;align-items:center;max-width:none;margin:0;min-width:0}
.fl .fl-top .ms{flex:0 0 auto;width:290px;padding:4px 8px}.fl .fl-top .ms .seg{padding:4px 6px;font-size:12.5px}.fl .fl-top .ms .seg .ic{width:26px;height:26px}
.fl .fl-top .fl-search{flex:1;min-width:120px;padding:6px 8px 6px 12px;border-radius:10px}.fl .fl-top .fl-search button{border-radius:8px}
.hact{display:flex;gap:8px;align-items:center;flex:none}
.ha{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:42px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:700 13px var(--ff);cursor:pointer;text-decoration:none;white-space:nowrap;box-sizing:border-box}.ha:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.32)}.ha svg{flex:none}
.ha.p{background:#0ea5e9;border-color:#0ea5e9}.ha.p:hover{background:#0284c7}.ha.inv{border-color:rgba(56,240,255,.45);color:#b9f6ff}.ha.adm{border-color:#22c55e;color:#bbf7d0;background:rgba(34,197,94,.12)}.ha.bug,.ha.hs{width:42px;padding:0}.ha.hs{display:none}
.ha.actas{padding:0 8px 0 5px;gap:8px;max-width:230px}.ha .av,.as-row .av,.mo-who .av{width:30px;height:30px;border-radius:50%;background:#e0f2fe center/cover;display:inline-flex;align-items:center;justify-content:center;font:900 13px var(--ff);color:#0b1a3a;flex:none;font-style:normal;box-shadow:0 0 0 2px rgba(255,255,255,.75)}.ha.actas.page .av{border-radius:8px;color:#fff}
.ha.actas .t{display:flex;flex-direction:column;line-height:1.1;text-align:left;min-width:0}.ha.actas small{font:800 9.5px var(--ff);letter-spacing:.08em;text-transform:uppercase;color:#94a3b8}.ha.actas b{font:800 13px var(--ff);max-width:150px;overflow:hidden;text-overflow:ellipsis}
/* nav tiles: an edge-to-edge row, evenly spaced */
.fl .fl-top .w{display:block!important;position:relative;z-index:4;background:#fff;border-bottom:1px solid #e5e7eb;padding:8px clamp(12px,2vw,28px);max-width:none!important;margin:0}
.fl .fl-top nav.fl-tiles{display:grid!important;grid-template-columns:repeat(var(--n,13),minmax(0,1fr));gap:8px;max-width:1720px;margin:0 auto!important;justify-content:stretch}
.fl .fl-top nav.fl-tiles button,.fl .fl-top nav.fl-tiles a.t{width:auto!important;min-width:0;height:60px;border-radius:12px!important;display:flex!important;padding:0 4px}.fl .fl-top nav.fl-tiles .l{overflow:hidden;text-overflow:ellipsis;max-width:100%}
@media(min-width:1001px){.fl-tiles button.wide{display:flex!important}}
/* phones + small tablets: compact, not sticky; nav lives in the bottom bar */
@media(max-width:1000px){.fl .fl-top .bar{position:relative;flex-wrap:wrap;gap:8px 8px;padding:8px 8px 10px}.fl .fl-top .lock .embl{width:36px!important;height:36px!important}.fl .fl-top .lock .wm .a,.fl .fl-top .lock .wm .o{font-size:22px!important}.fl .fl-top .lock{order:1}.hact{order:2;margin-left:auto;gap:6px}.fl .fl-top .hrow{order:3;flex:1 1 100%;flex-direction:row}.fl .fl-top .ms{width:100%}.fl .fl .fl-top .fl-search,.fl .fl-top .bar .fl-search{display:none!important}.ha{height:38px}.ha span,.ha.actas .t,.ha.actas>svg:last-child{display:none}.ha.hs{display:inline-flex}.ha:not(.actas){width:38px;padding:0}.ha.actas{padding:0 4px}.ha.p{width:auto;padding:0 10px}.ha.p span{display:inline}.fl .fl-top .w{display:none!important}}
@media(max-width:360px){.fl .fl-top .lock .wm{display:none}}
/* acting-as menu */
.as-menu{position:fixed;z-index:160;background:#fff;color:#14183a;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 18px 50px rgba(2,8,30,.25);padding:6px;max-height:min(70vh,520px);overflow:auto;animation:fmIn .15s ease-out}.as-h{font:800 10.5px var(--ff);letter-spacing:.08em;text-transform:uppercase;color:#64748b;padding:8px 10px 4px}
.as-row{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-radius:10px;padding:8px 10px;text-align:left;cursor:pointer;color:#14183a}.as-row:hover,.as-row:focus-visible{background:#f1f5f9}.as-row.on{background:#e0f2fe}.as-row .av{box-shadow:none;border:1px solid #e2e8f0}.as-row span{flex:1;min-width:0}.as-row b{display:block;font:800 13.5px var(--ff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.as-row small{display:block;font:600 11.5px var(--ff);color:#64748b}.as-row svg{color:#0ea5e9}
.as-foot{display:flex;gap:6px;border-top:1px solid #eef2f7;margin-top:6px;padding-top:6px}.as-foot a,.as-foot button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;font:700 12px var(--ff);color:#14183a;text-decoration:none;cursor:pointer}.as-none{padding:6px 10px;font-size:13px;color:#64748b}
/* ===== layout: 3 columns on laptops, 2 on tablets, edge to edge on phones ===== */
.fl .fl3{max-width:1400px;margin:0 auto;padding:16px clamp(16px,2.2vw,32px);display:grid;grid-template-columns:280px minmax(0,720px) 320px;justify-content:center;gap:20px;box-sizing:border-box}
.fl .fl3>*{min-width:0}
@media(max-width:1180px) and (min-width:761px){.fl .fl3{grid-template-columns:minmax(0,1fr) 290px;grid-template-areas:"main l" "main r";grid-template-rows:auto 1fr;align-items:start}.fl .fl3>:first-child{grid-area:l}.fl .fl3>:nth-child(2){grid-area:main}.fl .fl3>:nth-child(3){grid-area:r}}
@media(max-width:760px){.fl .fl3{display:flex;flex-direction:column;padding:8px;gap:0}.fl .fl3.home>section{order:-1}.fl .fl3 aside.r{order:3}}
.fl .sticky{top:84px}
/* ===== cards: defined, not floaty ===== */
.fl .fl-card,.fl .fl-post{background:#fff;border:1px solid #e1e6ee;border-radius:12px;box-shadow:0 1px 2px rgba(16,24,40,.05),0 2px 6px rgba(16,24,40,.03);margin-bottom:12px}
.fl .fl-post{padding:14px 16px 4px}.fl .fl-post .who .av{width:44px;height:44px;flex:none}.fl .fl-post .who b{font-size:15px}.fl .fl-post .txt{font-size:15.5px;line-height:1.55;color:#0f172a}
.fl .fl-post .pics{margin:10px -16px;gap:2px}.fl .fl-post .pics img{border-radius:0;max-height:560px}.fl .fl-post .vid,.fl .fl-post>video{border-radius:10px}
.fl .acts4{grid-template-columns:repeat(4,1fr);gap:4px;border-top:1px solid #e9edf3;margin:10px -8px 0;padding:4px 0 2px}.fl .acts4>button,.fl .acts4 .rwrap>button{min-height:42px;border-radius:10px;font:700 13.5px var(--ff);color:#334155;gap:7px}.fl .acts4>button:hover,.fl .acts4 .rwrap>button:hover{background:#f1f5f9;color:#0f172a}.fl .acts4 svg{width:19px;height:19px}
.fl .fl-filters{gap:6px;margin:0 0 12px;flex-wrap:wrap}.fl .fl-filters button{border-radius:10px!important;padding:8px 14px;font:700 13px var(--ff)}
.fl .fl-pill{padding:12px 14px;flex-wrap:wrap;gap:10px}.fl .fl-pill .pillbtn{border-radius:10px;min-height:44px;font:600 15px var(--ff);flex:1 1 200px}.fl .fl-pill .pq{display:flex;gap:6px;flex:1 1 100%;border-top:1px solid #eef2f7;padding-top:8px}.fl .fl-pill .pq button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;border-radius:10px;padding:8px 6px;font:700 13px var(--ff);color:#334155;cursor:pointer;min-height:40px}.fl .fl-pill .pq button:hover{background:#f1f5f9}.fl .fl-pill .pq .hic{width:19px;height:19px}.fl .fl-pill .pillico{display:none}
@media(max-width:760px){.fl .fl-card,.fl .fl-post{border-radius:10px;margin-bottom:8px}.fl .fl-post{padding:12px 12px 2px}.fl .fl-post .pics{margin:8px -12px}.fl .acts4{margin:8px -4px 0}.fl .acts4>button,.fl .acts4 .rwrap>button{font-size:12.5px;gap:5px;padding:8px 2px}.fl .fl-filters{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;padding:2px 0 4px;margin-bottom:8px}.fl .fl-filters button{flex:none}.fl .fl-pill .pq button span{display:none}}
/* radius: buttons are squared (12px max); true circles stay round */
.fl .fl-top nav.fl-tiles button,.fl .rail a,.fl .rail button,.fl .rail button.add,.lt-tile,.lt-holo,.lt-btn,.opt,.fl .fl-filters button,.fl-chips>*,.aou-chips>*{border-radius:12px!important}.fl .moments .ring{border-radius:50%}
/* chips that wrap: no overlap, no clipping, no underline (LIFEboard Money, Help, Wealth) */
.aou-chips{display:flex!important;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center}.aou-chips>*{margin:0!important}
a.lt-btn,.lt-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none!important;line-height:1.25;vertical-align:middle;box-sizing:border-box;max-width:100%;white-space:normal;text-align:center}.lt-btn .hic{width:16px;height:16px;flex:none}.lt-row>.lt-btn{flex:0 1 auto}
.lb-card a{text-decoration-thickness:1px}.lt-links a{text-decoration:none}
/* ===== floating things never cover content ===== */
#fl-bug{display:none!important}#fl-fab{display:none!important}
#fl-top{display:none!important}@media(min-width:1560px){#fl-top{display:block!important;right:20px;bottom:24px}}
#orbit-tab.glove{animation:none!important;transform:none!important;right:0!important;left:auto!important;top:auto!important;bottom:calc(120px + env(safe-area-inset-bottom))!important;width:22px!important;height:92px!important;border-radius:10px 0 0 10px!important;background:#06101f!important;filter:none!important;box-shadow:-4px 6px 18px rgba(2,8,30,.25)!important;overflow:hidden!important;display:flex;align-items:center;justify-content:center;transition:width .18s ease!important}
#orbit-tab.glove>svg,#orbit-tab.glove .say{display:none!important}#orbit-tab.glove .htab{position:static!important;opacity:1!important;pointer-events:none;writing-mode:vertical-rl;transform:rotate(180deg);background:transparent!important;color:#b6ff2e!important;padding:0!important;font:900 11px/1 var(--ff)!important;letter-spacing:.06em;border-radius:0!important;white-space:nowrap}
#orbit-tab.glove:hover,#orbit-tab.glove:focus-visible{width:30px!important}
@media(max-width:1000px){#orbit-tab.glove{width:14px!important;height:72px!important;bottom:calc(150px + env(safe-area-inset-bottom))!important}#orbit-tab.glove .htab{font-size:9.5px!important}}
body.sh-open #orbit-tab{display:none!important}
/* bottom bar (phones): Home · People · Post · Alerts · Me · More */
.fl-bottom{display:none}
@media(max-width:1000px){.fl .fl-bottom,.fl-bottom{display:grid!important;grid-template-columns:repeat(6,1fr);position:fixed;left:0;right:0;bottom:0;z-index:55;background:#fff;border-top:1px solid #e2e8f0;padding:4px 4px calc(4px + env(safe-area-inset-bottom));overflow:visible;box-shadow:0 -6px 18px rgba(2,8,30,.06)}.fl-bottom button{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px;border:0;background:transparent;border-radius:10px!important;font:700 10.5px var(--ff)!important;color:#334155;padding:4px 2px!important;cursor:pointer;position:relative}.fl-bottom button span{display:flex;color:var(--tc,#0ea5e9)}.fl-bottom button span svg{width:23px;height:23px}.fl-bottom button.on{color:var(--tc,#0ea5e9);background:color-mix(in srgb,var(--tc,#0ea5e9) 9%,#fff)}.fl-bottom button.post span{width:44px;height:32px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(79,70,229,.35)}.fl-bottom button.post span svg{width:22px;height:22px}.fl-bottom .badge{position:absolute;top:2px;right:calc(50% - 22px);background:#ff3b5c;color:#fff;border-radius:9px;font:900 10px/16px var(--ff);padding:0 5px;min-width:16px;text-align:center}body{padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}}
/* ===== sheets ===== */
.sh-wrap{position:fixed;inset:0;z-index:150;background:rgba(5,10,30,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;animation:fmIn .15s ease-out}
.sh{background:#fff;color:#14183a;border-radius:16px;width:min(560px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(2,8,30,.4);overflow:hidden}.sh-wrap.wide .sh{width:min(680px,100%)}
.sh-hd{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid #eef2f7}.sh-hd h3{flex:1;margin:0;display:flex;align-items:center;gap:8px;font:800 18px var(--ff)}.sh-hd h3 svg{color:#0ea5e9}
.sh-x{border:1px solid #e2e8f0;background:#fff;border-radius:10px;width:38px;height:38px;display:grid;place-items:center;cursor:pointer;color:#334155;flex:none}.sh-x:hover{background:#f1f5f9}
.sh-bd{padding:14px 16px 18px;overflow:auto}.sh-h{margin:14px 0 8px;font:800 12px var(--ff);letter-spacing:.06em;text-transform:uppercase;color:#64748b}.sh-lbl{display:block;font:800 12px var(--ff);color:#475569;margin:0 0 6px}
.sh-link{display:flex;gap:6px}.sh-link input{flex:1;min-width:0;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 10px;font:600 13px var(--ff);color:#0f172a;background:#f8fafc}
.sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.sh-t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:76px;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px 6px;font:700 12px var(--ff);color:#14183a;text-decoration:none;cursor:pointer;text-align:center}.sh-t:hover{border-color:#0ea5e9;background:#f0f9ff}.sh-t svg{width:24px;height:24px;color:#0369a1}
.sh-qr{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:12px}.sh-qr small{color:#64748b;font-size:12px;text-align:center}.sh-note{font-size:12.5px;color:#64748b;margin:10px 0 0;line-height:1.45}.sh-prev{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:13px;color:#334155;margin-bottom:10px}
.sh-int{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.sh-row{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:10px;font:700 13px var(--ff);color:#14183a;cursor:pointer;text-align:left}.sh-row:hover{background:#f1f5f9}.sh-row .hic,.sh-row svg{width:18px;height:18px;color:#0ea5e9;flex:none}
@media(max-width:600px){.sh-wrap{align-items:flex-end;padding:0}.sh{border-radius:16px 16px 0 0;width:100%;max-height:92vh;padding-bottom:env(safe-area-inset-bottom)}.sh-grid{grid-template-columns:repeat(4,1fr)}.sh-int{grid-template-columns:1fr}}
/* invite */
.inv-top{display:flex;gap:14px;align-items:flex-start}.inv-qr{flex:none;border:1px solid #e2e8f0;border-radius:12px;padding:6px;background:#fff;line-height:0}.inv-main{flex:1;min-width:0}.inv-count{margin:10px 0 0;font:600 14px var(--ff);color:#0f172a}.inv-count b{font-size:20px;color:#0ea5e9}
@media(max-width:600px){.inv-top{flex-direction:column-reverse;align-items:stretch}.inv-qr{align-self:center}}
.inv-card{display:flex;align-items:center;gap:10px}.inv-card .inv-ic{width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;display:grid;place-items:center;flex:none}.inv-card .inv-tx{flex:1;min-width:0}.inv-card .inv-tx b{display:block;font:800 14px var(--ff)}.inv-card .inv-tx span{font-size:12.5px;color:#64748b}
/* more sheet */
.mo-who{display:flex;align-items:center;gap:10px;width:100%;border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;margin-bottom:12px;color:#14183a}.mo-who .av{box-shadow:none;width:40px;height:40px}.mo-who span{flex:1}.mo-who small{display:block;font:800 10px var(--ff);letter-spacing:.08em;text-transform:uppercase;color:#64748b}.mo-who b{font:800 15px var(--ff)}.mo-who em{font-style:normal;display:flex;align-items:center;gap:4px;font:700 12px var(--ff);color:#0369a1}
.mo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.mo-t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:72px;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 4px;font:700 11.5px var(--ff);color:#14183a;text-decoration:none;cursor:pointer;text-align:center}.mo-t svg{width:22px;height:22px;color:#0ea5e9}.mo-t.adm{border-color:#22c55e;background:#f0fdf4}.mo-t.adm svg{color:#16a34a}.mo-join{display:flex;gap:8px;margin-bottom:12px}.mo-join .fl-btn{flex:1;justify-content:center}
@media(min-width:601px){.mo-grid{grid-template-columns:repeat(5,1fr)}}
/* ===== greeting banner ===== */
.gr-banner{display:flex;align-items:center;gap:12px;background:linear-gradient(120deg,#ecfeff,#eef2ff 55%,#fdf4ff);border:1px solid #c7d2fe;border-radius:12px;padding:12px 14px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}.gr-banner.fri{background:linear-gradient(120deg,#fff7ed,#fef3c7 45%,#ecfeff);border-color:#fcd34d}.gr-banner.new{background:linear-gradient(120deg,#ecfdf5,#e0f2fe);border-color:#86efac}
.gr-tx{flex:1;min-width:0}.gr-tx b{display:block;font:800 16px/1.3 var(--ff);color:#0f172a}.gr-tx span{display:block;font:600 13px/1.4 var(--ff);color:#475569;margin-top:2px}.gr-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.gr-x{border:0;background:transparent;color:#64748b;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;cursor:pointer}.gr-x:hover{background:rgba(15,23,42,.06)}
@media(max-width:600px){.gr-banner{flex-wrap:wrap;margin-bottom:8px}.gr-acts{width:100%;justify-content:flex-start}.gr-x{margin-left:auto}}
.fx-confetti{position:fixed;inset:0;z-index:180;pointer-events:none}
/* ===== world news ===== */
.nw-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}.nw-hd h3{margin:0!important;display:flex;align-items:center;gap:6px;flex:1;font:800 15px var(--ff)!important}.nw-hd h3 svg{color:#0ea5e9}.nw-src{font:700 11.5px var(--ff);color:#0369a1;text-decoration:none;white-space:nowrap}
.nw-list{display:flex;flex-direction:column}.nw-it{display:flex;gap:10px;padding:10px 0;border-top:1px solid #eef2f7}.nw-it:first-child{border-top:0;padding-top:2px}
.nw-img{flex:none;width:76px;height:76px;border-radius:10px;background:#e2e8f0 center/cover;display:grid;place-items:center;color:#94a3b8}.nw-img.none svg{width:28px;height:28px}.nw-bd{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.nw-meta{display:flex;gap:6px;align-items:center;font:700 11px var(--ff);color:#64748b}.nw-tag{background:#e0f2fe;color:#0369a1;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em;font-size:10px}
.fl .nw-t,.nw-t{font:700 13.5px/1.35 var(--ff);color:#0f172a;text-decoration:none;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.nw-t:hover{color:#0369a1}.nw-sum{margin:0;font-size:13px;color:#475569;line-height:1.45}
.nw-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}.nw-acts .fl-btn{font-size:12px;padding:5px 9px;min-height:32px}
.nw-card:not(.nw-full) .nw-img{width:64px;height:64px}.nw-card:not(.nw-full) .nw-img.none{display:none}.nw-it.big .nw-img{width:132px;height:100px}@media(max-width:600px){.nw-it.big{flex-direction:column}.nw-it.big .nw-img{width:100%;height:170px}}
.nw-strip .nw-row{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin:0 -12px;padding:0 12px 4px}.nw-strip .nw-row::-webkit-scrollbar{display:none}.nw-slide{flex:0 0 82%;scroll-snap-align:start;border:1px solid #e2e8f0;border-radius:10px;padding:8px}.nw-slide .nw-it{border:0;padding:0;flex-direction:column}.nw-slide .nw-img{width:100%;height:140px}
/* ===== profile header ===== */
.fl .fl-cover{height:clamp(170px,26vw,300px);background-size:cover;background-position:center}
.fl .fl-head{max-width:1360px;margin:-96px auto 0;padding:0 clamp(16px,2.2vw,32px);display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;position:relative}.fl .fl-head>.fl-name,.fl .fl-head>.fl-act{margin-top:106px}
.fl .fl-ava{width:168px;height:168px;border-radius:50%;border:5px solid #fff;box-shadow:0 0 0 3px #38bdf8,0 10px 30px rgba(2,8,30,.25);background-color:#6366f1;background-size:cover;background-position:center 30%;background-repeat:no-repeat;flex:none;font-size:64px;box-sizing:border-box}
.fl .fl-name{flex:1;min-width:220px;padding-bottom:6px}.fl .fl-name h1{font-size:30px;line-height:1.15}.fl .fl-name p{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
.u-url{display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:3px 4px 3px 10px;font:700 13px var(--ff);color:#0f172a;margin-top:6px;max-width:100%}.u-url a{color:#0369a1;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.u-url button{border:1px solid #e2e8f0;background:#fff;border-radius:8px;height:30px;padding:0 8px;display:inline-flex;align-items:center;gap:4px;font:700 12px var(--ff);color:#334155;cursor:pointer}.u-url button svg{width:15px;height:15px}
.fl .fl-act{padding-bottom:10px}
@media(max-width:760px){.fl .fl-head{margin-top:-72px;padding:0 12px;gap:10px;flex-direction:column;align-items:flex-start}.fl .fl-head>.fl-name,.fl .fl-head>.fl-act{margin-top:0}.fl .fl-ava{width:128px;height:128px;font-size:48px}.fl .fl-name h1{font-size:24px}.fl .fl-act{margin-left:0;flex-wrap:wrap}}
/* ===== pages I manage ===== */
.mp-sec{max-width:1336px;margin:18px auto 4px;padding:0 clamp(16px,2.2vw,32px);box-sizing:border-box}.mp-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}.mp-hd h2{display:flex;align-items:center;gap:8px;margin:0;flex:1;font:800 19px var(--ff)!important;color:#0f172a}.mp-hd h2 svg{color:#6366f1}.mp-hd h2 em{font-style:normal;background:#eef2ff;color:#4338ca;border-radius:8px;padding:1px 8px;font-size:13px}
.mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.mp-card{background:#fff;border:1px solid #e1e6ee;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.mp-cv{display:block;height:92px;position:relative;background:linear-gradient(135deg,var(--bc),#0b1a3a) center/cover}.mp-lg{position:absolute;left:12px;bottom:-22px;width:52px;height:52px;border-radius:12px;background:var(--bc) center/cover;border:3px solid #fff;color:#fff;display:grid;place-items:center;font:900 22px var(--ff);font-style:normal;box-shadow:0 4px 12px rgba(2,8,30,.2)}
.mp-b{padding:28px 12px 6px;display:flex;flex-direction:column;gap:2px;flex:1}.mp-b b{font:800 15px var(--ff);color:#0f172a}.mp-b small{color:#64748b;font-size:12.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mp-role{margin-top:4px;align-self:flex-start;background:#f1f5f9;border-radius:6px;padding:1px 8px;font:800 10.5px var(--ff);letter-spacing:.04em;text-transform:uppercase;color:#475569}
.mp-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px 12px 12px}.mp-acts .fl-btn{justify-content:center;padding:6px 4px;font-size:12px;min-height:34px}
@media(max-width:760px){.mp-sec{padding:0 8px;margin-top:14px}.mp-grid{grid-template-columns:1fr}}
/* managed Brand page bar */
.pg-actbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#0b1a3a;color:#fff;padding:10px clamp(12px,2.2vw,32px)}.pa-who{display:flex;align-items:center;gap:8px;font:600 14px var(--ff);flex:1;min-width:200px}.pa-who svg{color:#38f0ff}.pa-acts{display:flex;gap:6px;flex-wrap:wrap}.pg-actbar .fl-btn{background:#fff;color:#0f172a!important;border-color:#fff}.pg-actbar .fl-btn.p{background:#38f0ff;border-color:#38f0ff;color:#06101f!important}
/* account */
.del-steps{padding-left:20px;margin:10px 0}.del-steps li{margin:8px 0}.del-steps li>div{margin-top:6px}.del-steps input{display:block;margin-top:6px;width:100%;max-width:240px;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 10px;font:800 14px var(--ff);letter-spacing:.1em;box-sizing:border-box}
.del-go{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.fl-btn.danger{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important}.fl-btn.danger:disabled{opacity:.45;cursor:not-allowed}
.del-log ul{list-style:none;padding:0;margin:12px 0 0}.del-log li{display:flex;gap:6px;align-items:center;font-size:13px;padding:3px 0}.del-log li.ok svg{color:#16a34a}.del-log li.no svg{color:#dc2626}
/* identity card switcher + misc */
.badge[hidden],.fl [hidden]{display:none!important}
.fl-id .idq{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.fl-id .idq .fl-btn{flex:1 1 auto;justify-content:center}
.fl .hug-toast.inline{position:static!important;transform:none!important;width:auto!important;max-width:none!important;margin:0 0 12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fl .menu{z-index:60}
.fl-foot .foot-links{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center}.fl-foot button.lnk{border:0;background:none;color:#0369a1;font:600 12px var(--ff);cursor:pointer;padding:0}
@media(max-width:1000px){.fl-foot{padding-bottom:12px}}
`;

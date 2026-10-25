/* ============================================================
   allofus.one · safety layer (v26, Oct 23 2026)
   One module every surface shares:
   • 18+ gate: date of birth at sign-up, a blocking DOB step for older accounts, read-only mode under 18.
   • Upload guard: EVERY storage upload (posts / conference buckets) passes through here, because
     guardClient(sb) wraps the Supabase storage upload() once for all clients on the page:
       type allowlist (sniffed from the bytes, never the file name), no SVG / HTML / scripts,
       NSFW screening in the browser (nsfwjs, lazy-loaded, pinned), EXIF / GPS stripped by re-encoding,
       video GPS tags blanked, new accounts (< 72 h) and accounts without a confirmed DOB blocked,
       borderline pictures held in the private quarantine bucket for a moderator.
   • Report dialog (posts, comments, Messages, profiles, images), block, link guard (javascript: links).
   • Admin moderation queue (rendered inside the admin dashboard).
   The database enforces the same rules (supabase/_parts/v26-safety.sql); this file is the friendly front.
   Works before that SQL is run: falls back to the sign-in's user_metadata for the DOB.
   ============================================================ */
const FOUNDER = '320bf5d4-2d2d-482e-8633-87ced55e4155';
const NSFW_SRC = {
  lib: 'https://cdn.jsdelivr.net/npm/nsfwjs@4.2.1/dist/browser/nsfwjs.min.js',
  model: 'https://cdn.jsdelivr.net/gh/infinitered/nsfwjs@v4.2.1/models/mobilenet_v2/model.json',
};
const NCMEC_URL = 'https://report.cybertip.org/';
const CONTACT = 'info@eyetoad.com';
const H72 = 72 * 3600 * 1000;
const GUARDED = new Set(['posts', 'conference', 'quarantine']);
const ALLOW = {
  posts: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  conference: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'application/pdf',
    'application/vnd.ms-powerpoint', 'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};
ALLOW.quarantine = ALLOW.posts;
/* thresholds (nsfwjs classes: Drawing, Hentai, Neutral, Porn, Sexy) */
const BLOCK = (s) => s.Porn >= 0.6 || s.Hentai >= 0.6 || (s.Porn + s.Hentai) >= 0.75;
const HOLD = (s) => s.Sexy >= 0.55 || (s.Porn + s.Hentai) >= 0.3;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* http(s), site-relative, mailto, tel only — anything else becomes '#' */
export function safeUrl(u) { const s = String(u || '').trim(); if (!s) return ''; if (/^\/(?!\/)/.test(s)) return s; try { const x = new URL(s, location.href); return /^(https?:|mailto:|tel:|sms:)$/.test(x.protocol) ? x.href : '#'; } catch (e) { return '#'; } }

let CLIENT = null; let ST = null, STAt = 0, STP = null; let ORIG_UPLOAD = null;
const toast = (t, ms = 4200) => { try { let el = document.getElementById('aous-toast'); if (!el) { el = document.createElement('div'); el.id = 'aous-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = t; el.className = 'on'; clearTimeout(el._t); el._t = setTimeout(() => { el.className = ''; }, ms); } catch (e) { } };

/* ---------- styles (scoped, minimal: the design agent owns the look of the app itself) ---------- */
const CSS = `.aous-wrap{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.62);display:grid;place-items:center;padding:16px;font:500 15px/1.45 Poppins,system-ui,Arial,sans-serif;color:#0f172a}
.aous-box{background:#fff;border-radius:18px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:20px 20px 16px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.aous-box h3{margin:0 0 6px;font:800 19px/1.25 Poppins,system-ui,Arial}.aous-box p{margin:6px 0}.aous-box .m{color:#475569;font-size:13px}
.aous-box label{display:block;font-weight:700;font-size:13px;margin:10px 0 4px}.aous-box input[type=date],.aous-box textarea,.aous-box select{width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit}
.aous-box .ck{display:flex;gap:8px;align-items:flex-start;font-weight:600;font-size:13px}.aous-box .ck input{margin-top:3px;width:18px;height:18px;flex:none}
.aous-box .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.aous-box button,.aous-box a.b{border:0;border-radius:10px;padding:10px 16px;font:700 14px Poppins,system-ui,Arial;cursor:pointer;background:#e2e8f0;color:#0f172a;text-decoration:none;display:inline-block}
.aous-box button.p,.aous-box a.b.p{background:#0f766e;color:#fff}.aous-box button.d{background:#b91c1c;color:#fff}.aous-box .err{color:#b91c1c;font-weight:700;font-size:13px;min-height:18px;margin-top:6px}
.aous-box .cats{display:grid;gap:6px;margin-top:6px}.aous-box .cats label{display:flex;gap:8px;align-items:flex-start;margin:0;font-weight:600;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 10px;cursor:pointer}.aous-box .cats input{margin-top:3px}
.aous-box .warn{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 10px;font-size:13px}
#aous-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(30px);opacity:0;transition:.25s;z-index:2147483001;background:#0f172a;color:#fff;border-radius:12px;padding:10px 16px;font:600 14px Poppins,system-ui,Arial;max-width:92vw;pointer-events:none}#aous-toast.on{opacity:1;transform:translateX(-50%)}
.aous-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;background:#7c2d12;color:#fff;font:600 13px/1.4 Poppins,system-ui,Arial;padding:8px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}.aous-banner button{background:#fff;color:#7c2d12;border:0;border-radius:8px;padding:4px 10px;font:700 12px Poppins,Arial;cursor:pointer}
.aous-mq{display:grid;gap:10px}.aous-mq .it{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px}.aous-mq .it.cs{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.15)}.aous-mq .it h4{margin:0 0 4px;font:800 14px Poppins,Arial}.aous-mq .it .pv{background:#f8fafc;border-radius:10px;padding:8px;margin:6px 0;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}
.aous-mq .it img,.aous-mq .it video{max-width:220px;max-height:180px;border-radius:8px;display:block;margin-top:6px}.aous-mq .act{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.aous-mq .act button,.aous-mq .act a{font:700 12px Poppins,Arial;border-radius:8px;border:1px solid #cbd5e1;background:#fff;padding:5px 9px;cursor:pointer;color:#0f172a;text-decoration:none}
.aous-mq .act .x{border-color:#fecaca;color:#b91c1c}.aous-mq .act .n{background:#b91c1c;color:#fff;border-color:#b91c1c}.aous-mq .tag{display:inline-block;font:800 10px Poppins,Arial;letter-spacing:.04em;text-transform:uppercase;padding:2px 6px;border-radius:6px;background:#e2e8f0;margin-right:4px}.aous-mq .tag.r{background:#fee2e2;color:#991b1b}
.aous-mq .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}.aous-mq .grid figure{margin:0;background:#f8fafc;border-radius:10px;padding:4px;font-size:11px}.aous-mq .grid img,.aous-mq .grid video{width:100%;height:96px;object-fit:cover;border-radius:8px;max-width:none;margin:0}`;
function css() { if (document.getElementById('aous-css')) return; const s = document.createElement('style'); s.id = 'aous-css'; s.textContent = CSS; document.head.appendChild(s); }
function overlay(html, { closable = true } = {}) { css(); const w = document.createElement('div'); w.className = 'aous-wrap'; w.innerHTML = `<div class="aous-box" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(w); const close = () => { w.remove(); document.removeEventListener('keydown', onKey); }; const onKey = (e) => { if (e.key === 'Escape' && closable) close(); }; document.addEventListener('keydown', onKey); if (closable) w.addEventListener('click', (e) => { if (e.target === w) close(); }); setTimeout(() => { const f = w.querySelector('input,button,select,textarea'); f && f.focus(); }, 30); return { el: w, close, q: (s) => w.querySelector(s) }; }

/* ---------- age ---------- */
export function ageOf(dob) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || '')); if (!m) return null; const b = new Date(+m[1], +m[2] - 1, +m[3]); if (isNaN(b) || b > new Date() || +m[1] < 1900) return null; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; }
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const U18_KEY = 'aou_u18_until';
/* sign-up check: { ok, dob, minor, msg } */
export function dobCheck(dob, ack) {
  try { const until = +localStorage.getItem(U18_KEY) || 0; if (until > Date.now()) return { ok: false, minor: true, msg: 'allofus.one is for adults 18 and older. Thank you for being honest. Please come back when you are 18.' }; } catch (e) { }
  const a = ageOf(dob);
  if (a === null) return { ok: false, msg: 'Please enter your date of birth.' };
  if (a < 18) { try { localStorage.setItem(U18_KEY, String(Date.now() + 24 * 3600 * 1000)); } catch (e) { } return { ok: false, minor: true, msg: 'Sorry, allofus.one is only for adults 18 and older. Thank you for being honest. Please come back when you are 18.' }; }
  if (a > 120) return { ok: false, msg: 'Please check the year of your date of birth.' };
  if (!ack) return { ok: false, msg: 'Please confirm you are 18 or older.' };
  return { ok: true, dob: String(dob) };
}
/* the two fields every sign-up form adds (ids are prefixed so several forms can live on one page) */
export function dobFieldsHTML(prefix = 'aous') { return `<label>Date of birth <span style="font-weight:500;color:#64748b">(private, never shown)</span><input id="${prefix}-dob" type="date" autocomplete="bday" max="${todayISO()}" min="1900-01-01" required></label><label class="aous-ck" style="display:flex;gap:8px;align-items:flex-start;font-weight:600"><input type="checkbox" id="${prefix}-18" style="width:18px;height:18px;margin-top:2px;flex:none"><span>I am 18 or older. allofus.one is for adults only.</span></label>`; }

/* ---------- status ---------- */
function fallbackStatus(u) {
  const md = (u && u.user_metadata) || {}; const a = ageOf(md.dob); const created = u && u.created_at ? new Date(u.created_at).getTime() : Date.now();
  const minor = a !== null && a < 18; const admin = !!u && u.id === FOUNDER;
  const s = { sql: 0, signed_in: true, dob_set: a !== null, adult: a !== null && a >= 18 && !md.restricted, minor: minor || !!md.restricted, restricted: minor || !!md.restricted, held: false, banned: false, account_created: u && u.created_at, new_account: Date.now() - created < H72, admin };
  s.can_upload = admin || (s.adult && !s.new_account); return s;
}
export async function status(sb = CLIENT, force = false) {
  if (!sb) return { sql: 0, signed_in: false };
  if (!force && ST && Date.now() - STAt < 60000) return ST;
  if (STP && !force) return STP;
  STP = (async () => {
    let session = null; try { ({ data: { session } } = await sb.auth.getSession()); } catch (e) { }
    if (!session) { ST = { signed_in: false }; STAt = Date.now(); return ST; }
    const u = session.user; let s = null;
    try { const r = await sb.rpc('my_safety'); if (!r.error && r.data && r.data.sql) s = r.data; } catch (e) { }
    if (!s) s = fallbackStatus(u);
    s.uid = u.id; s.email = u.email; ST = s; STAt = Date.now(); return s;
  })();
  try { return await STP; } finally { STP = null; }
}
const whyNot = (s, what = 'do that') => {
  if (!s || !s.signed_in) return 'Please sign in first.';
  if (s.banned) return 'This account is suspended.';
  if (s.minor || s.restricted) return 'allofus.one is for adults 18+. This account is read-only.';
  if (!s.dob_set) return 'Please confirm your date of birth first (a one-time safety step).';
  if (s.held) return 'Your account is on hold while our team reviews a report.';
  return 'You can\'t ' + what + ' right now.';
};
/* can this person talk to others (calls, voice, Messages)? */
export async function canTalk(sb = CLIENT) { let s = await status(sb); if (s.admin) return { ok: true, s }; if (s.signed_in && !s.dob_set) { await dobGate(sb); s = await status(sb, true); } return s.adult ? { ok: true, s } : { ok: false, s, msg: whyNot(s, 'talk with people') }; }

/* ---------- the DOB gate (older accounts) ---------- */
let GATE_OPEN = false;
export async function dobGate(sb = CLIENT) {
  if (GATE_OPEN || !sb) return; GATE_OPEN = true;
  try {
    const s = await status(sb, true); if (!s.signed_in || s.dob_set) return;
    await new Promise((resolve) => {
      const m = overlay(`<h3>One quick safety step</h3><p>allofus.one is for adults 18 and older. Please confirm your date of birth to keep posting, messaging, connecting and calling.</p><p class="m">It stays private. It is never shown on your profile or to other members.</p>${dobFieldsHTML('aous-g')}<div class="err" data-err></div><div class="row"><button class="p" data-go>Continue</button><button data-out>Sign out</button></div><p class="m" style="margin-top:12px">Questions? <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="/community-rules/">Community rules</a></p>`, { closable: false });
      m.q('[data-out]').onclick = async () => { try { await sb.auth.signOut(); } catch (e) { } m.close(); resolve(); location.href = '/'; };
      m.q('[data-go]').onclick = async () => {
        const err = m.q('[data-err]'); const dob = m.q('#aous-g-dob').value; const ack = m.q('#aous-g-18').checked; const a = ageOf(dob);
        if (a === null) { err.textContent = 'Please enter your date of birth.'; return; }
        if (a >= 18 && !ack) { err.textContent = 'Please confirm you are 18 or older.'; return; }
        m.q('[data-go]').disabled = true; err.textContent = '';
        const r = await saveDob(sb, dob);
        if (r.error) { err.textContent = r.error; m.q('[data-go]').disabled = false; return; }
        if (a < 18) {
          m.el.querySelector('.aous-box').innerHTML = `<h3>Thank you for being honest</h3><p>allofus.one is only for adults, so this account is now <b>read-only</b>: you can read public pages, but posting, messaging, connecting and calls are turned off.</p><p class="m">If you typed the wrong date, email <a href="mailto:${CONTACT}">${CONTACT}</a> from the address on this account.</p><div class="row"><button class="p" data-ok>OK</button></div>`;
          m.el.querySelector('[data-ok]').onclick = () => { m.close(); resolve(); banner(); };
        } else { m.close(); toast('Thank you. You are all set.'); resolve(); }
      };
    });
  } finally { GATE_OPEN = false; }
}
async function saveDob(sb, dob) {
  let sqlOk = false, out = {};
  try { const r = await sb.rpc('set_my_dob', { p_dob: dob }); if (!r.error) { sqlOk = true; out = r.data || {}; } else if (!/PGRST202|Could not find the function|404/i.test(r.error.code + ' ' + r.error.message)) return { error: r.error.message }; } catch (e) { }
  // always keep a copy on the sign-in (private user_metadata): the database copies it once into member_safety
  try { await sb.auth.updateUser({ data: { dob, adult_ack: ageOf(dob) >= 18 } }); } catch (e) { }
  if (!sqlOk && ageOf(dob) < 18) { try { const { data: { user } } = await sb.auth.getUser(); if (user) { await sb.auth.updateUser({ data: { restricted: true } }); await sb.from('profiles').update({ adult: false }).eq('id', user.id); } } catch (e) { } }
  ST = null; await status(sb, true); return { ok: true, out };
}
function banner() {
  const s = ST; document.querySelectorAll('.aous-banner').forEach(b => b.remove()); if (!s || !s.signed_in) return;
  let t = ''; if (s.banned) t = 'This account is suspended for breaking our rules.'; else if (s.minor || s.restricted) t = 'Read-only account: allofus.one is for adults 18+. Posting, messages, connections and calls are off.'; else if (s.held) t = 'Your account is on hold while our safety team reviews a report. Reading still works.';
  if (!t) return; css(); const b = document.createElement('div'); b.className = 'aous-banner'; b.setAttribute('role', 'status'); b.innerHTML = `<span>${esc(t)}</span><button type="button">OK</button>`; b.querySelector('button').onclick = () => b.remove(); document.body.appendChild(b);
}

/* ---------- link guard: no javascript: / vbscript: / data: navigations from anything on the page ---------- */
let LINKS = false;
function linkGuard() { if (LINKS) return; LINKS = true; document.addEventListener('click', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return; let p = ''; try { p = new URL(a.getAttribute('href'), location.href).protocol; } catch (err) { return; } if (p === 'javascript:' || p === 'vbscript:' || p === 'file:' || (p === 'data:' && !a.hasAttribute('download'))) { e.preventDefault(); e.stopImmediatePropagation(); toast('That link was blocked for your safety.'); } }, true); }

/* ---------- byte sniffing ---------- */
async function head(blob, n = 64) { return new Uint8Array(await blob.slice(0, n).arrayBuffer()); }
const has = (b, at, arr) => arr.every((v, i) => b[at + i] === v);
async function sniff(blob) {
  const b = await head(blob); const txt = new TextDecoder('latin1').decode(b).replace(/^﻿/, '').trimStart().toLowerCase();
  if (has(b, 0, [0xFF, 0xD8, 0xFF])) return 'image/jpeg';
  if (has(b, 0, [0x89, 0x50, 0x4E, 0x47])) return 'image/png';
  if (has(b, 0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (has(b, 0, [0x52, 0x49, 0x46, 0x46]) && has(b, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  if (has(b, 0, [0x52, 0x49, 0x46, 0x46]) && has(b, 8, [0x57, 0x41, 0x56, 0x45])) return 'audio/wav';
  if (has(b, 4, [0x66, 0x74, 0x79, 0x70])) { const brand = new TextDecoder('latin1').decode(b.slice(8, 12)); if (/^qt/.test(brand)) return 'video/quicktime'; if (/^(M4A|M4B)/.test(brand)) return 'audio/mp4'; if (/^(heic|heix|mif1|msf1|hevc)/.test(brand)) return 'image/heic'; return 'video/mp4'; }
  if (has(b, 0, [0x1A, 0x45, 0xDF, 0xA3])) return 'video/webm';
  if (has(b, 0, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  if (has(b, 0, [0x49, 0x44, 0x33]) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) return 'audio/mpeg';
  if (has(b, 0, [0x4F, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (has(b, 0, [0x50, 0x4B, 0x03, 0x04])) return 'zip';
  if (has(b, 0, [0xD0, 0xCF, 0x11, 0xE0])) return 'ole';
  if (has(b, 0, [0x4D, 0x5A])) return 'exe';
  if (/^(<\?xml|<svg|<!doctype|<html|<script|<head|<body|<iframe|<object)/.test(txt) || /<svg[\s>]|<script[\s>]/.test(txt)) return 'markup';
  if (b.every(x => x === 9 || x === 10 || x === 13 || (x >= 32 && x < 127) || x >= 160)) return 'text';
  return 'unknown';
}
function resolveType(sniffed, declared, name) {
  const d = String(declared || '').toLowerCase(); const ext = String(name || '').split('.').pop().toLowerCase();
  if (sniffed === 'markup' || sniffed === 'exe' || /svg|html|xml|javascript|x-sh|x-msdownload/.test(d) || /^(svg|svgz|html?|xhtml|xml|js|mjs|exe|bat|cmd|sh|ps1|msi|apk|scr|jar|com|vbs)$/.test(ext)) return { bad: 'That file type is not allowed here (no SVG, web pages or programs).' };
  if (sniffed === 'zip') { if (/officedocument/.test(d)) return { mime: d }; const map = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }; return map[ext] ? { mime: map[ext] } : { bad: 'Zip files are not allowed. Upload the photo, video or PDF itself.' }; }
  if (sniffed === 'ole') { const map = { doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint' }; return map[ext] ? { mime: map[ext] } : { bad: 'That file type is not allowed here.' }; }
  if (sniffed === 'text') { if (ext === 'csv' || d === 'text/csv') return { mime: 'text/csv' }; return { mime: 'text/plain' }; }
  if (sniffed === 'image/heic') return { bad: 'HEIC photos cannot be checked here. On iPhone choose "Most Compatible" (Settings → Camera → Formats) or share the photo as JPEG.' };
  if (sniffed === 'unknown') return { bad: 'We could not recognise that file. Photos (JPG, PNG, WebP, GIF), MP4 videos and PDFs work.' };
  return { mime: sniffed };
}

/* ---------- NSFW model (lazy, pinned, loaded once) ---------- */
let MODEL = null;
const addScript = (src) => new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) { const t = setInterval(() => { if (window.nsfwjs) { clearInterval(t); res(); } }, 50); setTimeout(() => { clearInterval(t); rej(new Error('timeout')); }, 60000); return; } const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous'; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
export function loadModel() {
  /* the nsfwjs browser bundle carries its own TensorFlow.js core (tf.min.js is NOT loaded: it needs eval, which our CSP blocks) */
  if (!MODEL) MODEL = (async () => { if (!window.nsfwjs) await addScript(NSFW_SRC.lib); return window.nsfwjs.load(NSFW_SRC.model, { size: 224 }); })();
  const p = MODEL; return p.catch((e) => { if (MODEL === p) MODEL = null; throw new Error('MODEL ' + ((e && e.message) || e)); });
}
const scoresOf = (preds) => { const s = { Drawing: 0, Hentai: 0, Neutral: 0, Porn: 0, Sexy: 0 }; (preds || []).forEach(p => { s[p.className] = p.probability; }); return s; };
const maxScores = (a, b) => { const o = {}; for (const k of Object.keys(a)) o[k] = Math.max(a[k] || 0, (b && b[k]) || 0); return o; };
async function classify(src) { const model = await loadModel(); const c = document.createElement('canvas'); c.width = 224; c.height = 224; const g = c.getContext('2d'); const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height; const sc = Math.max(224 / w, 224 / h); const dw = w * sc, dh = h * sc; g.fillStyle = '#808080'; g.fillRect(0, 0, 224, 224); g.drawImage(src, (224 - dw) / 2, (224 - dh) / 2, dw, dh); return scoresOf(await model.classify(c, 5)); }
async function loadImage(blob) {
  if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) { } }
  const url = URL.createObjectURL(blob); try { const img = new Image(); await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('image timeout')), 20000); img.onload = () => { clearTimeout(t); res(); }; img.onerror = () => { clearTimeout(t); rej(new Error('image error')); }; img.src = url; }); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
/* re-encode through a canvas: drops EXIF / GPS / maker notes; keeps PNG / WebP transparency */
async function reencode(img, mime) {
  const MAX = 4096; let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; const k = Math.min(1, MAX / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
  const type = mime === 'image/png' ? 'image/png' : mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const out = await new Promise((res) => c.toBlob(res, type, 0.92)); if (!out) throw new Error('Could not process that picture.');
  return out;
}
async function videoScores(blob) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; const url = URL.createObjectURL(blob); v.src = url;
  const once = (ev, ms = 15000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('video timeout')), ms); v.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true }); v.addEventListener('error', () => { clearTimeout(t); rej(new Error('video error')); }, { once: true }); });
  try {
    await once('loadeddata'); const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 1; let s = null;
    for (const f of [0.05, 0.3, 0.55, 0.8]) { v.currentTime = Math.max(0, Math.min(d - 0.05, d * f)); try { await once('seeked', 8000); } catch (e) { continue; } s = maxScores(await classify(v), s); if (BLOCK(s)) break; }
    if (!s) throw new Error('no frames'); return s;
  } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); try { v.load(); } catch (e) { } }
}
/* blank ISO-6709 location strings (e.g. "+39.7392-104.9903+1609.000/") that phones write into MP4 / MOV */
async function scrubVideoGPS(blob) {
  const N = blob.size; const spans = N <= 8e6 ? [[0, N]] : [[0, 4e6], [N - 4e6, N]]; let hits = 0; const parts = [];
  for (const [a, z] of spans) { const buf = new Uint8Array(await blob.slice(a, z).arrayBuffer()); const s = new TextDecoder('latin1').decode(buf); const re = /[+-]\d{2}\.\d{2,}[+-]\d{3}\.\d{2,}(?:[+-]\d+(?:\.\d+)?)?\/?/g; let m; while ((m = re.exec(s))) { for (let i = 0; i < m[0].length; i++) { const ch = m[0][i]; if (ch >= '0' && ch <= '9') buf[m.index + i] = 0x30; } hits++; } parts.push(buf); }
  if (!hits) return { blob, hits };
  return { blob: new Blob(spans.length === 1 ? parts : [parts[0], blob.slice(4e6, N - 4e6), parts[1]], { type: blob.type }), hits };
}

/* ---------- the upload guard ---------- */
const sErr = (message, code = 'safety') => ({ data: null, error: Object.assign(new Error(message), { name: 'SafetyError', statusCode: '403', code }) });
async function prepare(bucket, path, body, opts) {
  const s = await status(CLIENT);
  if (!s.signed_in) return { block: 'Please sign in to upload.' };
  if (!s.admin) {
    if (!s.dob_set) { await dobGate(CLIENT); const s2 = await status(CLIENT, true); if (!s2.dob_set) return { block: 'Please confirm your date of birth first.' }; return prepare(bucket, path, body, opts); }
    if (!s.adult) return { block: whyNot(s, 'upload') };
    if (s.new_account) return { block: 'Photo, video and file uploads unlock 72 hours after you join. It is a safety rule that keeps spam and abuse out. You can post text right away.' };
    if (s.can_upload === false) return { block: 'Upload limit reached for now. Please try again in an hour.' };
  }
  return inspect(body, bucket, opts.contentType, path);
}
/* the file checks alone (type, NSFW, EXIF strip) — no account checks. Exported for previews and QA. */
export async function inspect(body, bucket = 'posts', declared = '', path = '') {
  const opts = { contentType: declared };
  const blob = body instanceof Blob ? body : null; if (!blob) return { block: 'That upload is not a file.' };
  if (blob.size > 50 * 1024 * 1024) return { block: 'That file is ' + (blob.size / 1048576).toFixed(1) + ' MB. The limit is 50 MB' + (bucket === 'conference' ? '.' : ' for videos and 20 MB for photos and files.') };
  const t = resolveType(await sniff(blob), opts.contentType || blob.type, blob.name || path); if (t.bad) return { block: t.bad };
  if (!(ALLOW[bucket] || []).includes(t.mime)) return { block: 'That file type is not allowed here.' };
  const kind = /^image\//.test(t.mime) ? 'image' : /^video\//.test(t.mime) ? 'video' : 'file';
  if (kind !== 'video' && bucket !== 'conference' && blob.size > 20 * 1024 * 1024) return { block: 'That ' + (kind === 'image' ? 'photo' : 'file') + ' is ' + (blob.size / 1048576).toFixed(1) + ' MB. The limit is 20 MB for photos and files (50 MB for videos).' };
  let out = blob, scores = null, note = '';
  try {
    if (kind === 'image') {
      const img = await loadImage(blob); scores = await classify(img);
      if (!BLOCK(scores) && t.mime !== 'image/gif') out = await reencode(img, t.mime);
    } else if (kind === 'video') {
      scores = await videoScores(blob); if (!BLOCK(scores)) { const r = await scrubVideoGPS(blob); out = r.blob; if (r.hits) note = 'gps-scrubbed'; }
    }
  } catch (e) {
    if (/^MODEL /.test(String(e && e.message))) return { block: 'The photo safety check could not load. Check your connection and try again in a minute.' };
    if (kind === 'video') return { block: 'We could not check that video. MP4 (H.264) videos work best.' };
    return { block: 'We could not read that picture. Try a JPG or PNG.' };
  }
  const mime = out.type && ALLOW[bucket].includes(out.type) ? out.type : t.mime;
  if (scores && BLOCK(scores)) return { block: 'This picture looks like nudity or sexual content, which is not allowed on allofus.one. It was not uploaded.', scores, hard: true };
  if (scores && HOLD(scores) && bucket !== 'quarantine') return { hold: true, body: out, mime, kind, scores };
  return { body: out, mime, kind, scores, note };
}
async function logMedia(bucket, path, r, status = 'ok', surface = '') {
  try { const s = ST; if (!CLIENT || !s || !s.uid) return; const url = bucket === 'quarantine' ? null : CLIENT.storage.from(bucket).getPublicUrl(path).data.publicUrl; await CLIENT.from('media_items').insert({ user_id: s.uid, bucket, path, url, mime: r.mime, bytes: r.body && r.body.size, kind: r.kind, surface: surface || (path.split('/')[1] || '').replace(/[-_]?\d.*$/, '').slice(0, 20) || null, scores: r.scores, status, reason: r.note || null }); } catch (e) { }
}
function installUploadGuard(sb) {
  let api; try { api = sb.storage.from('posts'); } catch (e) { return; }
  const proto = Object.getPrototypeOf(api); if (!proto || typeof proto.upload !== 'function') return;
  if (proto.__aouSafe) return; const orig = proto.upload; ORIG_UPLOAD = orig;
  proto.upload = async function (path, body, opts) {
    const bucket = this.bucketId; if (!GUARDED.has(bucket)) return orig.call(this, path, body, opts);
    opts = opts || {};
    let r; try { r = await prepare(bucket, String(path || ''), body, opts); } catch (e) { return sErr((e && e.message) || 'Upload check failed.'); }
    if (r.block) return sErr(r.block);
    if (r.hold) {
      try {
        const qpath = (ST && ST.uid ? ST.uid : 'x') + '/' + String(path).split('/').pop();
        const q = CLIENT.storage.from('quarantine'); const res = await orig.call(q, qpath, r.body, { contentType: r.mime, upsert: false });
        if (!res.error) await logMedia('quarantine', qpath, r, 'pending');
      } catch (e) { }
      return sErr('This picture may break our rules, so a moderator will look at it first. It was not posted. If it is approved we will let you know.', 'held');
    }
    const res = await orig.call(this, path, r.body, Object.assign({}, opts, { contentType: r.mime }));
    if (!res.error) logMedia(bucket, String(path), r, 'ok');
    return res;
  };
  proto.__aouSafe = true;
  /* warm the model up as soon as someone opens a file picker */
  document.addEventListener('click', (e) => { const t = e.target; if (t && t.closest && t.closest('input[type=file],label')) { const inp = t.closest('input[type=file]') || (t.closest('label') && t.closest('label').querySelector('input[type=file]')); if (inp && /image|video|^$/.test(inp.accept || '')) loadModel().catch(() => { }); } }, true);
}

/* ---------- the one call every page makes right after createClient() ---------- */
/* ---------- v27: private Realtime channels (Realtime Authorization) ----------
   world / pos-* / voice-* / meet:* / dm:* channels are joined as PRIVATE channels, so the realtime.messages policies in
   supabase/_parts/v27-security.sql decide who may listen or send (confirmed adults; Messages only the two people). If the
   policies are not deployed yet (or the visitor is not allowed), the join fails and the client falls back ONCE to the
   public channel, so nothing breaks today. Each channel keeps all its .on() handlers across the fallback. */
const PRIVATE_TOPICS = /^(world$|pos-|voice-|meet:|dm:|room:)/;
function installRealtimeGuard(sb) {
  const rt = sb && sb.realtime; if (!rt || typeof rt.channel !== 'function' || rt.__aouPrivate) return; rt.__aouPrivate = true;
  const origChannel = rt.channel;
  rt.channel = function (topic, opts) {
    const want = PRIVATE_TOPICS.test(String(topic || ''));
    if (want) { opts = opts || {}; opts.config = Object.assign({}, opts.config, { private: opts.config && opts.config.private === false ? false : true }); }
    const ch = origChannel.call(this, topic, opts);
    if (!want || !ch || ch.__aouSub) return ch;
    ch.__aouSub = true; const origSub = ch.subscribe;
    ch.subscribe = function (cb, timeout) {
      const self = this;
      return origSub.call(self, async (status, err) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && self.private && !self.__aouFell) {
          self.__aouFell = true; self.private = false; try { self.params.config.private = false; } catch (e) { }
          try { await self.unsubscribe(); } catch (e) { }
          try { origSub.call(self, cb, timeout); } catch (e) { cb && cb(status, err); }
          return;
        }
        cb && cb(status, err);
      }, timeout);
    };
    return ch;
  };
}

/* ---------- v27: Cloudflare Turnstile (bot protection), OFF until CONFIG.TURNSTILE_SITE_KEY is set ----------
   When Zach sets the key AND turns on Supabase Auth → Attack Protection → Bot and Abuse Protection → Turnstile (same site
   key / secret), sign-up and sign-in send the token as options.captchaToken. Without the key this resolves to undefined
   and the auth calls behave exactly as before. */
let TS_LOAD = null;
export async function captchaToken() {
  let key = ''; try { key = (await import('./aou-config.js')).CONFIG.TURNSTILE_SITE_KEY || ''; } catch (e) { } if (!key) return undefined;
  try {
    if (!window.turnstile) { TS_LOAD = TS_LOAD || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('turnstile load')); document.head.appendChild(s); setTimeout(() => rej(new Error('turnstile timeout')), 15000); }); await TS_LOAD; }
    let host = document.getElementById('aous-ts'); if (!host) { host = document.createElement('div'); host.id = 'aous-ts'; host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483002'; document.body.appendChild(host); }
    host.innerHTML = '';
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Verification timed out. Please try again.')), 60000);
      window.turnstile.render(host, { sitekey: key, appearance: 'interaction-only', callback: (tok) => { clearTimeout(t); setTimeout(() => { host.innerHTML = ''; }, 500); res(tok); }, 'error-callback': () => { clearTimeout(t); rej(new Error('Verification failed. Please reload and try again.')); } });
    });
  } catch (e) { throw new Error((e && e.message) || 'Verification failed.'); }
}

const GUARDED_CLIENTS = new WeakSet();
export function guardClient(sb) {
  if (!sb || GUARDED_CLIENTS.has(sb)) return sb; GUARDED_CLIENTS.add(sb); if (!CLIENT) CLIENT = sb;
  try { installUploadGuard(sb); } catch (e) { console.warn('safety upload guard', e); }
  try { installRealtimeGuard(sb); } catch (e) { console.warn('safety realtime guard', e); }
  linkGuard();
  try {
    sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_OUT') { ST = null; document.querySelectorAll('.aous-banner').forEach(b => b.remove()); return; } if (!session) return; if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION' || ev === 'USER_UPDATED') { CLIENT = CLIENT || sb; setTimeout(() => runGate(sb), 400); } });
  } catch (e) { }
  setTimeout(() => runGate(sb), 1200);
  return sb;
}
let GATED = false;
async function runGate(sb) { if (GATED) return; GATED = true; try { const s = await status(sb, true); if (!s.signed_in) { GATED = false; return; } if (!s.dob_set) await dobGate(sb); banner(); } catch (e) { GATED = false; } }

/* ---------- reporting ---------- */
const CATS = [
  ['child_safety', 'Child safety', 'A child may be at risk, or sexual content involving anyone under 18'],
  ['underage', 'This person seems to be under 18', 'allofus.one is for adults only'],
  ['sexual', 'Nudity or sexual content', ''],
  ['harassment', 'Harassment, bullying or hate', ''],
  ['threat', 'Threats, violence or self-harm', ''],
  ['illegal', 'Illegal goods or services', 'Drugs, weapons, stolen goods, trafficking'],
  ['scam', 'Scam, fraud or impersonation', ''],
  ['spam', 'Spam', ''],
  ['other', 'Something else', ''],
];
/* report({ sb, me, kind: 'post'|'comment'|'dm'|'hub'|'profile'|'media'|'page', id, owner, preview, media }) */
export async function report(o = {}) {
  const sb = o.sb || CLIENT; const s = sb ? await status(sb) : { signed_in: false };
  if (!s.signed_in) { toast('Please sign in to report. In an emergency call 911.'); return; }
  return new Promise((resolve) => {
    const m = overlay(`<h3>Report ${esc(o.label || ({ post: 'this post', comment: 'this comment', dm: 'this message', hub: 'this message', profile: 'this profile', media: 'this picture', page: 'this page' })[o.kind] || 'this')}</h3><p class="m">A real person reviews every report. The person you report is not told who reported them.</p><div class="cats">${CATS.map(([k, n, d], i) => `<label><input type="radio" name="aous-cat" value="${k}" ${i === 0 ? '' : ''}><span><b>${esc(n)}</b>${d ? `<br><span class="m">${esc(d)}</span>` : ''}</span></label>`).join('')}</div><div class="warn" data-cs style="display:none;margin-top:8px"><b>If a child is in danger right now, call 911.</b> You can also report directly to the National Center for Missing &amp; Exploited Children: <a href="${NCMEC_URL}" target="_blank" rel="noopener">report.cybertip.org</a> or 1-800-843-5678. Please do not download, screenshot or share the content.</div><label for="aous-det">What happened? (optional)</label><textarea id="aous-det" rows="3" maxlength="1000"></textarea>${o.owner && o.owner !== s.uid ? '<label class="ck" style="margin-top:8px"><input type="checkbox" id="aous-blk"> Also block this person</label>' : ''}<div class="err" data-err></div><div class="row"><button class="p" data-go>Send report</button><button data-x>Cancel</button></div>`);
    m.el.querySelectorAll('input[name=aous-cat]').forEach(r => r.onchange = () => { m.q('[data-cs]').style.display = r.value === 'child_safety' && r.checked ? '' : 'none'; });
    m.q('[data-x]').onclick = () => { m.close(); resolve(false); };
    m.q('[data-go]').onclick = async () => {
      const cat = (m.el.querySelector('input[name=aous-cat]:checked') || {}).value; const err = m.q('[data-err]'); if (!cat) { err.textContent = 'Pick what is wrong.'; return; }
      const det = (m.q('#aous-det').value || '').trim().slice(0, 1000); m.q('[data-go]').disabled = true;
      const evidence = { preview: String(o.preview || '').slice(0, 2000), media: (o.media || []).slice(0, 8), page: location.pathname + location.search, at: new Date().toISOString() };
      const reason = (CATS.find(c => c[0] === cat) || [])[1] + (det ? ' · ' + det : '') + ' · ' + (o.kind || '') + ' ' + (o.id || '');
      let ok = false, dup = false;
      try { const r = await sb.from('reports').insert({ reporter: s.uid, reported: o.owner || null, reason: reason.slice(0, 500), target_kind: o.kind || 'other', target_id: o.id != null ? String(o.id) : null, category: cat, details: det || null, evidence }); if (!r.error) ok = true; else if (r.error.code === '23505') dup = true; else throw r.error; } catch (e) {
        // before v26 SQL: the older reports table (reporter, reported, reason) or the bugs table
        try { const r2 = await sb.from('reports').insert({ reporter: s.uid, reported: o.owner || null, reason: ('[' + cat + '] ' + reason + ' · ' + evidence.preview).slice(0, 500) }); if (!r2.error) ok = true; } catch (e2) { }
        if (!ok) { try { const r3 = await sb.from('bugs').insert({ user_id: s.uid, kind: 'report', note: ('[' + cat + '] ' + reason).slice(0, 1000), page: evidence.page, ua: navigator.userAgent.slice(0, 160), extra: { report: { kind: o.kind, id: o.id, owner: o.owner }, evidence } }); if (!r3.error) ok = true; } catch (e3) { } }
      }
      const blk = m.q('#aous-blk'); if (blk && blk.checked && o.owner) await block(sb, o.owner);
      if (dup) { m.close(); toast('You already reported this. Thank you.'); resolve(true); return; }
      if (!ok) { err.innerHTML = `We could not send it. Please email <a href="mailto:${CONTACT}">${CONTACT}</a>${cat === 'child_safety' ? ` and report at <a href="${NCMEC_URL}" target="_blank" rel="noopener">report.cybertip.org</a>` : ''}.`; m.q('[data-go]').disabled = false; return; }
      m.close(); toast(cat === 'child_safety' ? 'Report sent. The content is hidden while we review it. If a child is in danger, call 911.' : 'Thank you. The report is with our team.', 6000); resolve(true);
    };
  });
}
/* block: adds the person to my profiles.blocked list (the database refuses their Messages, requests, hugs and calls) */
export async function block(sb, otherId, on = true) {
  sb = sb || CLIENT; const s = await status(sb); if (!s.signed_in || !otherId || otherId === s.uid) return false;
  try { const { data } = await sb.from('profiles').select('blocked').eq('id', s.uid).maybeSingle(); const cur = new Set((data && data.blocked) || []); on ? cur.add(otherId) : cur.delete(otherId); const { error } = await sb.from('profiles').update({ blocked: [...cur] }).eq('id', s.uid); if (error) throw error; toast(on ? 'Blocked. They cannot message, call or connect with you.' : 'Unblocked.'); return true; } catch (e) { toast('Could not update your block list.'); return false; }
}

/* ---------- admin moderation queue (inside /?v=admin&what=mod) ---------- */
const ago = (t) => { if (!t) return ''; const s = (Date.now() - new Date(t).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };
const PUB = '/storage/v1/object/public/';
const pathFromUrl = (u) => { const s = String(u || ''); const i = s.indexOf(PUB); if (i < 0) return null; const rest = s.slice(i + PUB.length); const j = rest.indexOf('/'); return j < 0 ? null : { bucket: rest.slice(0, j), path: decodeURIComponent(rest.slice(j + 1).split('?')[0]) }; };
/* move a public file into the private quarantine bucket (evidence), then take it off the public bucket */
async function quarantineUrl(sb, url) {
  const p = pathFromUrl(url); if (!p || p.bucket === 'quarantine') return false;
  try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return false; const blob = await r.blob(); const q = sb.storage.from('quarantine'); const up = ORIG_UPLOAD ? await ORIG_UPLOAD.call(q, p.path, blob, { contentType: blob.type || 'application/octet-stream' }) : await q.upload(p.path, blob, { contentType: blob.type }); if (up.error && !/exists|duplicate/i.test(up.error.message || '')) throw up.error; await sb.storage.from(p.bucket).remove([p.path]); try { await sb.from('media_items').update({ status: 'quarantined', bucket: 'quarantine', reviewed_at: new Date().toISOString() }).eq('bucket', p.bucket).eq('path', p.path); } catch (e) { } return true; } catch (e) { console.warn('quarantine', e); return false; }
}
export async function modQueue(main, { sb, me, toast: tst } = {}) {
  sb = sb || CLIENT; const say = tst || toast; css(); if (sb) guardClient(sb);
  main.innerHTML = '<div class="fl-card"><p class="muted">Loading the moderation queue…</p></div>';
  const q = async (p) => { try { const r = await p; return r.error ? { err: r.error.message, data: [] } : { data: r.data || [] }; } catch (e) { return { err: e.message, data: [] }; } };
  const [rep, med, acc, hp, hc] = await Promise.all([
    q(sb.from('reports').select('*').order('created_at', { ascending: false }).limit(300)),
    q(sb.from('media_items').select('*').order('created_at', { ascending: false }).limit(120)),
    q(sb.from('member_safety').select('*').or('flagged.eq.true,held.eq.true,restricted.eq.true,banned.eq.true').order('updated_at', { ascending: false }).limit(200)),
    q(sb.from('feed_posts').select('id,user_id,text,media,link,created_at,mod_status').neq('mod_status', 'ok').order('created_at', { ascending: false }).limit(100)),
    q(sb.from('feed_comments').select('id,post_id,user_id,body,media,created_at,mod_status').neq('mod_status', 'ok').order('created_at', { ascending: false }).limit(100)),
  ]);
  /* v27: incidents + audit chain status (both empty before v27-security.sql is run) */
  const [inc, av, scanFlag] = await Promise.all([
    q(sb.from('safety_incidents').select('*').order('created_at', { ascending: false }).limit(100)),
    q(sb.rpc('audit_verify')),
    q(sb.rpc('safety_flag', { k: 'server_scan_required' })),
  ]);
  try { sb.rpc('audit_admin_open', { p_page: location.pathname + location.search }).then(() => { }, () => { }); } catch (e) { }
  const sqlMissing = /member_safety|media_items|target_kind|mod_status|does not exist|schema cache/i.test([rep.err, med.err, acc.err, hp.err].join(' '));
  const open = rep.data.filter(r => (r.status || (r.resolved ? 'actioned' : 'open')) === 'open');
  const groups = {}; open.forEach(r => { const k = (r.target_kind || 'legacy') + ':' + (r.target_id || r.id); (groups[k] = groups[k] || { kind: r.target_kind || 'legacy', id: r.target_id, rows: [] }).rows.push(r); });
  const G = Object.values(groups).sort((a, b) => (b.rows.some(r => r.category === 'child_safety') - a.rows.some(r => r.category === 'child_safety')) || (b.rows.length - a.rows.length));
  const ids = new Set(); open.forEach(r => { r.reporter && ids.add(r.reporter); r.reported && ids.add(r.reported); }); acc.data.forEach(a => ids.add(a.user_id)); med.data.forEach(m => m.user_id && ids.add(m.user_id)); hp.data.forEach(p => ids.add(p.user_id)); hc.data.forEach(c => ids.add(c.user_id));
  const names = {}; if (ids.size) { const r = await q(sb.from('profiles').select('id,username,display_name').in('id', [...ids].slice(0, 500))); r.data.forEach(p => { names[p.id] = p; }); }
  const who = (id) => { if (!id) return '<i>unknown</i>'; const p = names[id]; return p ? `<b>${esc(p.display_name || p.username)}</b>${p.username ? ` <a href="/?u=${encodeURIComponent(p.username)}" target="_blank" rel="noopener">@${esc(p.username)}</a>` : ''}` : `<code>${esc(String(id).slice(0, 8))}</code>`; };
  // the reported content, fetched for preview (admin can read hidden posts / comments)
  const postIds = G.filter(g => g.kind === 'post' && /^\d+$/.test(g.id || '')).map(g => +g.id), comIds = G.filter(g => g.kind === 'comment' && /^\d+$/.test(g.id || '')).map(g => +g.id);
  const posts = {}, coms = {}; if (postIds.length) (await q(sb.from('feed_posts').select('id,user_id,text,media,link,mod_status').in('id', postIds))).data.forEach(p => { posts[p.id] = p; }); if (comIds.length) (await q(sb.from('feed_comments').select('id,post_id,user_id,body,media,mod_status').in('id', comIds))).data.forEach(c => { coms[c.id] = c; });
  const mediaHTML = (list) => (Array.isArray(list) ? list : list ? [list] : []).slice(0, 4).map(u => { const s = typeof u === 'string' ? u : (u && (u.url || u.src)) || ''; const su = safeUrl(s); if (!su || su === '#') return ''; return /\.(mp4|webm|mov)(\?|$)/i.test(su) ? `<video src="${esc(su)}" controls muted preload="metadata"></video>` : `<img src="${esc(su)}" alt="reported media" loading="lazy" referrerpolicy="no-referrer">`; }).join('');
  const grpHTML = (g) => { const cs = g.rows.some(r => r.category === 'child_safety'); const r0 = g.rows[0]; const owner = r0.reported || (posts[g.id] || coms[g.id] || {}).user_id; const item = g.kind === 'post' ? posts[g.id] : g.kind === 'comment' ? coms[g.id] : null; const ev = r0.evidence || {}; const text = item ? (item.text || item.body || '') : (ev.preview || r0.reason || ''); const media = item ? item.media : ev.media;
    return `<div class="it ${cs ? 'cs' : ''}" data-g="${esc(g.kind)}:${esc(g.id || '')}"><h4>${cs ? '<span class="tag r">child safety</span>' : ''}<span class="tag">${esc(g.kind)}</span>${g.id ? '#' + esc(g.id) : ''} · ${g.rows.length} report${g.rows.length > 1 ? 's' : ''} · ${ago(r0.created_at)}${item && item.mod_status && item.mod_status !== 'ok' ? ' · <span class="tag r">' + esc(item.mod_status) + '</span>' : ''}</h4><div>By ${who(owner)}</div><div class="m" style="font-size:12px">${g.rows.map(r => `${esc(r.category || 'report')}${r.details ? ': ' + esc(String(r.details).slice(0, 160)) : r.reason && !r.category ? ': ' + esc(String(r.reason).slice(0, 160)) : ''} <span class="muted">(from ${who(r.reporter)})</span>`).join('<br>')}</div><div class="pv">${esc(String(text).slice(0, 1200)) || '<i>no text</i>'}${mediaHTML(media)}</div>
      <div class="act">${['post', 'comment', 'dm', 'hub', 'media'].includes(g.kind) && g.id ? `<button data-a="keep">Keep (dismiss)</button><button class="x" data-a="remove">Remove</button>` : `<button data-a="dismiss">Dismiss</button>`}${owner ? `<button class="x" data-a="hold" data-u="${esc(owner)}">Hold account</button><button class="x" data-a="ban" data-u="${esc(owner)}">Ban user</button><button class="n" data-a="ncmec" data-u="${esc(owner)}">Preserve evidence + NCMEC</button>` : ''}</div></div>`; };
  const pend = med.data.filter(x => x.status === 'pending');
  const recent = med.data.filter(x => x.status === 'ok' && x.url).slice(0, 48);
  const signed = {}; await Promise.all(pend.filter(x => x.bucket === 'quarantine').slice(0, 30).map(async (x) => { try { const r = await sb.storage.from('quarantine').createSignedUrl(x.path, 900); if (r.data) signed[x.id] = r.data.signedUrl; } catch (e) { } }));
  const scoreTxt = (s) => s ? Object.entries(s).filter(([k]) => k !== 'Neutral' && k !== 'Drawing').map(([k, v]) => k + ' ' + Math.round(v * 100) + '%').join(' · ') : '';
  const pendHTML = (x) => { const u = signed[x.id] || x.url; return `<div class="it" data-m="${x.id}"><h4><span class="tag r">${esc(x.status)}</span>${esc(x.kind || '')} · ${ago(x.created_at)}</h4><div>By ${who(x.user_id)} · <span class="m">${esc(scoreTxt(x.scores))}</span></div>${u ? (x.kind === 'video' ? `<video src="${esc(u)}" controls muted preload="metadata"></video>` : `<img src="${esc(u)}" alt="held picture" referrerpolicy="no-referrer">`) : '<p class="m">(file not readable)</p>'}<div class="act"><button data-a="approve">Approve (publish)</button><button class="x" data-a="reject">Reject (keep as evidence)</button><button class="x" data-a="ban" data-u="${esc(x.user_id || '')}">Ban user</button><button class="n" data-a="ncmec" data-u="${esc(x.user_id || '')}">Preserve evidence + NCMEC</button></div></div>`; };
  const accHTML = (a) => `<div class="it" data-acc="${esc(a.user_id)}"><h4>${a.banned ? '<span class="tag r">banned</span>' : ''}${a.held ? '<span class="tag r">on hold</span>' : ''}${a.restricted ? '<span class="tag r">restricted · under 18</span>' : ''}${a.flagged ? '<span class="tag">flagged</span>' : ''}</h4><div>${who(a.user_id)} · ${a.dob ? 'age ' + (ageOf(String(a.dob).slice(0, 10)) ?? '?') : 'no DOB'} · ${ago(a.updated_at)}</div><div class="m" style="font-size:12px">${esc([a.held_reason, a.restricted_reason, a.banned_reason].filter(Boolean).join(' · '))}</div><div class="act">${a.held ? '<button data-a="release">Release hold</button>' : '<button class="x" data-a="hold">Hold</button>'}${a.restricted ? '<button data-a="unrestrict">Lift restriction (verified 18+)</button>' : '<button class="x" data-a="restrict">Restrict (minor)</button>'}${a.banned ? '<button data-a="unban">Unban</button>' : '<button class="x" data-a="ban">Ban</button>'}<button data-a="clear_flag">Clear flag</button><button class="n" data-a="ncmec">Preserve evidence + NCMEC</button><button data-a="export">Export evidence (JSON + sha256)</button></div></div>`;
  /* v27: incidents (automatic CSAM-class / hash-match / NSFW events from the server-side scanner) */
  const incData = Array.isArray(inc.data) ? inc.data : [];
  const incHTML = (i) => `<div class="it ${/csam|hash/.test(i.kind) ? 'cs' : ''}" data-inc="${i.id}" data-u="${esc(i.user_id || '')}"><h4><span class="tag r">${esc(i.kind)}</span><span class="tag">${esc(i.status)}</span>#${i.id} · ${ago(i.created_at)}${i.ncmec_report_id ? ' · NCMEC ' + esc(i.ncmec_report_id) : ''}</h4><div>By ${who(i.user_id)} · media #${esc(String(i.media_id || ''))} · evidence #${esc(String(i.evidence_id || ''))}</div><div class="m" style="font-size:12px">${esc(scoreTxt(i.details && i.details.scores) || (i.details && (i.details.note || i.details.hash_match)) || '')}</div><div class="act">${i.status === 'open' ? `<a class="n" href="${NCMEC_URL}" target="_blank" rel="noopener">Open CyberTipline</a><button data-a="ncmec-id">Record NCMEC report #</button>` : ''}<button data-a="export">Export evidence (JSON + sha256)</button>${i.status !== 'closed' ? '<button data-a="close">Close incident</button>' : ''}</div></div>`;
  const chain = av.data && typeof av.data === 'object' ? av.data : null;
  const chainHTML = chain ? `<p class="m" style="font-size:12px">Audit chain: <b style="color:${chain.ok ? '#15803d' : '#b91c1c'}">${chain.ok ? 'intact' : 'BROKEN at #' + esc(String(chain.first_bad_id))}</b> · ${esc(String(chain.checked))} rows · last hash <code>${esc(String(chain.last_hash || '').slice(0, 16))}…</code> · server scan ${scanFlag.data === true ? '<b style="color:#15803d">required (uploads hidden until scanned)</b>' : 'optional (client screening only — see SAFETY-RUNBOOK.md to deploy media-scan)'}</p>` : '<p class="m" style="font-size:12px">Run <code>supabase/_parts/v27-security.sql</code> for the hash-chained audit log, incidents and the server-side media scanner hooks.</p>';
  const hiddenHTML = [...hp.data.map(p => ({ k: 'post', id: p.id, u: p.user_id, t: p.text, m: p.media, s: p.mod_status, at: p.created_at })), ...hc.data.map(c => ({ k: 'comment', id: c.id, u: c.user_id, t: c.body, m: c.media, s: c.mod_status, at: c.created_at }))].map(h => `<div class="it" data-g="${h.k}:${h.id}"><h4><span class="tag r">${esc(h.s)}</span><span class="tag">${h.k}</span>#${h.id} · ${ago(h.at)}</h4><div>By ${who(h.u)}</div><div class="pv">${esc(String(h.t || '').slice(0, 600))}${mediaHTML(h.m)}</div><div class="act"><button data-a="keep">Restore</button><button class="x" data-a="remove">Remove for good</button></div></div>`).join('');
  main.innerHTML = `<div class="fl-card aous-mq-card"><h3>🛡️ Moderation</h3><p class="muted" style="font-size:12px">Child-safety reports are on top. Nothing here is ever hard-deleted: "Remove" hides the item and moves its files to the private quarantine bucket. For anything involving a minor: <b>Preserve evidence + NCMEC</b> freezes the account data and opens the CyberTipline (US law requires reporting apparent child sexual abuse material to NCMEC). Do not download or forward the material itself.</p>${sqlMissing ? '<p class="fl-err">Run <code>supabase/_parts/v26-safety.sql</code> in Supabase to turn on the full queue (some tables are missing).</p>' : ''}<div class="act" style="margin:6px 0"><button class="fl-btn sm" data-a="refresh">↻ Refresh</button><a class="fl-btn sm" href="${NCMEC_URL}" target="_blank" rel="noopener">Open NCMEC CyberTipline</a></div></div>
    ${chainHTML}<div class="aous-mq">${incData.length ? `<h3 style="margin:8px 0 0">Incidents · ${incData.length}</h3>${incData.map(incHTML).join('')}` : ''}<h3 style="margin:8px 0 0">Open reports · ${G.length}</h3>${G.map(grpHTML).join('') || '<p class="muted">No open reports. 🎉</p>'}
    <h3 style="margin:8px 0 0">Pictures waiting for review · ${pend.length}</h3>${pend.map(pendHTML).join('') || '<p class="muted">Nothing held.</p>'}
    <h3 style="margin:8px 0 0">Accounts to review · ${acc.data.length}</h3>${acc.data.map(accHTML).join('') || '<p class="muted">No flagged accounts.</p>'}
    <h3 style="margin:8px 0 0">Hidden posts and comments · ${hp.data.length + hc.data.length}</h3>${hiddenHTML || '<p class="muted">Nothing hidden.</p>'}
    <h3 style="margin:8px 0 0">Latest uploads (spot check) · ${recent.length}</h3><div class="grid">${recent.map(x => `<figure data-mu="${x.id}">${x.kind === 'video' ? `<video src="${esc(safeUrl(x.url))}" muted preload="metadata"></video>` : `<img src="${esc(safeUrl(x.url))}" alt="upload" loading="lazy" referrerpolicy="no-referrer">`}<figcaption>${who(x.user_id)} · ${ago(x.created_at)}<br><button class="fl-btn sm" data-a="pull" style="margin-top:4px">Remove</button></figcaption></figure>`).join('') || '<p class="muted">No uploads logged yet.</p>'}</div></div>`;
  const rpc = async (fn, args) => { const r = await sb.rpc(fn, args); if (r.error) throw r.error; return r.data; };
  const ncmec = async (uid, kind, id) => { if (!uid) { window.open(NCMEC_URL, '_blank', 'noopener'); return; } if (!confirm('Preserve evidence for this account and put it on hold?\n\nThen file the CyberTipline report (it opens in a new tab). Do not download or forward the material.')) return; try { const evId = await rpc('mod_preserve_evidence', { p_user: uid, p_kind: kind || null, p_id: id ? String(id) : null, p_note: 'NCMEC report started from the moderation queue' }); say('Evidence #' + evId + ' preserved. Account on hold.', 6000); } catch (e) { say('Could not preserve evidence: ' + e.message, 7000); } window.open(NCMEC_URL, '_blank', 'noopener'); };
  main.onclick = async (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'refresh') { modQueue(main, { sb, me, toast: say }); return; }
    const gEl = b.closest('[data-g]'), mEl = b.closest('[data-m]'), accEl = b.closest('[data-acc]'), muEl = b.closest('[data-mu]'), incEl = b.closest('[data-inc]');
    /* v27: signed evidence bundle for NCMEC / law enforcement. The server returns the exact JSON text + its sha256 and writes
       an audit row; the browser re-hashes the text so the printed hash is independently verified before download. */
    const exportBundle = async (uid, incId) => {
      if (!uid) { say('No account on this item.'); return; }
      const bundle = await rpc('mod_evidence_bundle', { p_user: uid, p_incident: incId ? +incId : null });
      const text = bundle && bundle.text; if (!text) throw new Error('empty bundle');
      let local = ''; try { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); local = [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { }
      const match = !local || local === bundle.sha256;
      const blob = new Blob([text], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'allofus-evidence-' + String(uid).slice(0, 8) + (incId ? '-incident' + incId : '') + '-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      say((match ? 'Evidence exported. sha256 verified: ' : 'Evidence exported. HASH MISMATCH, server says: ') + bundle.sha256 + ' (audit #' + bundle.audit_id + '). Keep this hash with your NCMEC / police report.', 15000);
      try { await navigator.clipboard.writeText(bundle.sha256); } catch (e) { }
    };
    if (incEl) {
      b.disabled = true;
      try {
        const id = incEl.dataset.inc, uid = incEl.dataset.u;
        if (a === 'export') await exportBundle(uid, id);
        else if (a === 'ncmec-id') { const n = prompt('NCMEC CyberTipline report number (from the confirmation page / email):'); if (n && n.trim()) { await rpc('mod_incident', { p_id: +id, p_status: 'reported_ncmec', p_ncmec: n.trim().slice(0, 60), p_note: null }); say('Recorded. The evidence row and the audit log carry the report number.'); modQueue(main, { sb, me, toast: say }); return; } }
        else if (a === 'close') { const note = prompt('Why is this incident closed? (kept in the audit trail)'); if (note === null) { b.disabled = false; return; } await rpc('mod_incident', { p_id: +id, p_status: 'closed', p_ncmec: null, p_note: note.slice(0, 500) || 'closed' }); say('Incident closed.'); modQueue(main, { sb, me, toast: say }); return; }
      } catch (err) { say('Failed: ' + (err.message || err), 7000); }
      b.disabled = false; return;
    }
    b.disabled = true;
    try {
      if (gEl) {
        const [kind, id] = gEl.dataset.g.split(':'); const uid = b.dataset.u;
        if (a === 'keep') { await rpc('mod_set_content', { p_kind: kind, p_id: id, p_status: 'ok', p_note: null }); say('Kept and reports dismissed.'); gEl.remove(); }
        else if (a === 'remove') { if (!confirm('Remove this ' + kind + '? Its files move to the private quarantine bucket (kept as evidence).')) { b.disabled = false; return; } await rpc('mod_set_content', { p_kind: kind, p_id: id, p_status: 'removed', p_note: null }); const it = kind === 'post' ? posts[id] || hp.data.find(p => String(p.id) === id) : kind === 'comment' ? coms[id] || hc.data.find(c => String(c.id) === id) : null; const list = it ? (Array.isArray(it.media) ? it.media : it.media ? [it.media] : []) : []; let n = 0; for (const u of list) if (await quarantineUrl(sb, typeof u === 'string' ? u : u && u.url)) n++; say('Removed' + (n ? ' · ' + n + ' file(s) quarantined' : '') + '.'); gEl.remove(); }
        else if (a === 'dismiss') { const g = G.find(x => (x.kind + ':' + (x.id || '')) === gEl.dataset.g); for (const r of (g ? g.rows : [])) { try { await rpc('mod_resolve_report', { p_report: r.id, p_status: 'dismissed' }); } catch (err) { await sb.from('reports').update({ resolved: true }).eq('id', r.id); } } say('Dismissed.'); gEl.remove(); }
        else if (a === 'hold' || a === 'ban') { if (!confirm((a === 'ban' ? 'Ban' : 'Hold') + ' this account?')) { b.disabled = false; return; } await rpc('mod_set_user', { p_user: uid, p_action: a, p_reason: 'from report ' + gEl.dataset.g }); say(a === 'ban' ? 'Banned. They are signed out within the hour and cannot sign in.' : 'Account on hold.'); }
        else if (a === 'ncmec') { await ncmec(uid, kind, id); }
      } else if (mEl) {
        const x = med.data.find(m => String(m.id) === mEl.dataset.m); if (!x) return;
        if (a === 'approve') { if (x.bucket === 'quarantine') { const r = await sb.storage.from('quarantine').download(x.path); if (r.error) throw r.error; const dest = x.path; const up = await (ORIG_UPLOAD || sb.storage.from('posts').upload).call(sb.storage.from('posts'), dest, r.data, { contentType: x.mime || r.data.type }); if (up.error && !/exists|duplicate/i.test(up.error.message || '')) throw up.error; await sb.from('media_items').update({ status: 'ok', bucket: 'posts', url: sb.storage.from('posts').getPublicUrl(dest).data.publicUrl, reviewed_at: new Date().toISOString(), reviewed_by: me && me.id }).eq('id', x.id); say('Approved: the picture is now in the member\'s uploads. They can post it again.'); } else { await rpc('mod_set_content', { p_kind: 'media', p_id: String(x.id), p_status: 'ok', p_note: null }); say('Approved.'); } mEl.remove(); }
        else if (a === 'reject') { await rpc('mod_set_content', { p_kind: 'media', p_id: String(x.id), p_status: 'removed', p_note: null }); if (x.bucket !== 'quarantine' && x.url) await quarantineUrl(sb, x.url); say('Rejected and kept as evidence.'); mEl.remove(); }
        else if (a === 'ban') { if (!confirm('Ban this account?')) { b.disabled = false; return; } await rpc('mod_set_user', { p_user: x.user_id, p_action: 'ban', p_reason: 'media ' + x.id }); say('Banned.'); }
        else if (a === 'ncmec') { await ncmec(x.user_id, 'media', x.id); }
      } else if (accEl) {
        const uid = accEl.dataset.acc;
        if (a === 'ncmec') await ncmec(uid);
        else if (a === 'export') await exportBundle(uid, null);
        else { if (['ban', 'restrict', 'hold'].includes(a) && !confirm(a[0].toUpperCase() + a.slice(1) + ' this account?')) { b.disabled = false; return; } await rpc('mod_set_user', { p_user: uid, p_action: a, p_reason: 'admin queue' }); say('Done: ' + a.replace('_', ' ') + '.'); modQueue(main, { sb, me, toast: say }); return; }
      } else if (muEl) {
        const x = med.data.find(m => String(m.id) === muEl.dataset.mu); if (!x) return; if (!confirm('Take this upload down? It moves to the private quarantine bucket.')) { b.disabled = false; return; } const ok = await quarantineUrl(sb, x.url); if (ok) { await rpc('mod_set_content', { p_kind: 'media', p_id: String(x.id), p_status: 'removed', p_note: null }).catch(() => { }); say('Taken down and kept as evidence. Also remove the post it was in, if any.'); muEl.remove(); } else say('Could not move the file (is the v26 SQL run?).');
      }
    } catch (err) { say('Failed: ' + (err.message || err), 7000); }
    b.disabled = false;
  };
}

/* ============================================================
   allofus.one · the home page header on a standalone page (v20)
   Used by /mission/. Paints the exact same header as the Feed (logo, Feed · 3D · VR,
   search, Sign in / Join, the row of tiles, the More menu) and the same phone bottom bar,
   by reusing headerHTML from aou-flat2.js. Every tile is a plain link into the Feed.
   ============================================================ */
import { FLAT_CSS } from './aou-flat.js';
import { headerHTML, FLAT2_CSS, ICON } from './aou-flat2.js';
import { moreSheet, I3 } from './aou-flat3.js';

/* a stored Supabase session → a minimal "me" so the header shows Acting as instead of Sign in */
const storedMe = () => { try { const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x)); if (!k) return null; const v = JSON.parse(localStorage.getItem(k) || 'null'); const u = v && (v.user || (v.currentSession && v.currentSession.user)); if (!u || !u.id) return null; if (v.expires_at && v.expires_at * 1000 < Date.now() - 7 * 864e5) return null; const md = u.user_metadata || {}; return { id: u.id, email: u.email, name: md.display_name || md.name || String(u.email || 'Me').split('@')[0], home: {} }; } catch (e) { return null; } };

export function mountPageHeader(opts = {}) {
  if (!document.getElementById('fl-css')) { const st = document.createElement('style'); st.id = 'fl-css'; st.textContent = FLAT_CSS + FLAT2_CSS; document.head.appendChild(st); }
  const me = storedMe(); const wrap = document.createElement('div'); wrap.className = 'fl pagehead'; wrap.innerHTML = headerHTML(me);
  const old = document.querySelector(opts.replace || 'body > header'); if (old) old.replaceWith(wrap); else document.body.prepend(wrap);
  /* phone bottom bar, same as the Feed */
  const bar = document.createElement('nav'); bar.className = 'fl-bottom'; bar.setAttribute('aria-label', 'Main');
  bar.innerHTML = `<a href="/" style="--tc:#0369a1"><span>${ICON.home}</span>Home</a><a href="/?v=conn" style="--tc:#ec4899"><span>${ICON.conn}</span>People</a><a class="post" href="/?v=feed&compose=1" style="--tc:#6366f1" aria-label="Write a post"><span>${I3.plus}</span>Post</a><a href="/?v=notif" style="--tc:#f97316"><span>${ICON.bell}</span>Alerts</a><a href="/?v=u" style="--tc:#f59e0b"><span>${ICON.me}</span>Me</a><button data-more style="--tc:#475569" aria-label="More"><span>${I3.more}</span>More</button>`;
  document.body.appendChild(bar);
  const st2 = document.createElement('style'); st2.textContent = `.pagehead{position:sticky;top:0;z-index:30}.fl-bottom a{border:0;background:transparent;font:700 11px Poppins,Arial;color:#14183a;display:flex;flex-direction:column;align-items:center;gap:2px;text-decoration:none}.fl-bottom a span{font-size:20px;color:var(--tc)}.fl-bottom a span svg{width:22px;height:22px}@media(max-width:1000px){.pagehead{position:relative}}.pagehead .fl-joinbar{display:none}.fl-bottom a.post span{display:flex;width:44px;height:32px;border-radius:10px;background:linear-gradient(135deg,#0369a1,#6366f1);color:#fff;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(79,70,229,.35)}`; document.head.appendChild(st2);
  const ctx = { sb: null, live: false, getMe: () => null, myPages: () => [], toast: () => { }, nav: (v) => { location.href = v === 'feed' ? '/' : '/?v=' + v; }, reportBug: () => { location.href = '/?bug=1'; }, composeShare: () => { location.href = '/'; } };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-v],[data-mode],[data-join],[data-signin],[data-hsearch],[data-more],[data-actas],[data-invite],[data-bug]'); if (!t) return;
    if (t.closest('.mo-grid') && !t.hasAttribute('data-more')) return;
    e.preventDefault();
    if (t.dataset.v) location.href = t.dataset.v === 'feed' ? '/' : '/?v=' + t.dataset.v;
    else if (t.dataset.mode) { if (t.dataset.mode !== 'flat') { try { localStorage.setItem('aou_view', t.dataset.mode); } catch (x) { } } location.href = t.dataset.href || '/'; }
    else if (t.hasAttribute('data-join')) location.href = '/?auth=join';
    else if (t.hasAttribute('data-signin')) location.href = '/?auth=in';
    else if (t.hasAttribute('data-hsearch')) location.href = '/?v=search';
    else if (t.hasAttribute('data-more')) moreSheet(ctx);
    else if (t.hasAttribute('data-actas')) location.href = '/?v=u';
    else if (t.hasAttribute('data-invite')) location.href = '/?v=panel#p-invite';
    else if (t.hasAttribute('data-bug')) location.href = '/?bug=1';
  });
  const sf = document.getElementById('fl-search'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); const q = (document.getElementById('fl-q') || {}).value || ''; location.href = '/?v=search&q=' + encodeURIComponent(q.trim()); };
}

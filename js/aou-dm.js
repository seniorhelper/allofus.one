/* Messages + Vibes on the flat Feed (Oct 2026, v2).
   The DM page (/?v=dm) now runs the same Comm engine and thread renderer as the Comm Hub (js/aou-comm.js), loaded on
   demand so the Feed stays light. This file keeps the small, always-loaded pieces: vibes (profile strip + burst) and
   the DM gate. Vibes are messages whose body is ::vibe:<kind>:: — they render as a card plus an emoji burst. */
import { ic } from './aou-icons2.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const P = (d) => `<svg class="hic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const I = (k, fb) => ic(k) || P(fb);
/* e = the emoji that bursts on screen (content), icon = the SVG used on buttons (UI) */
export const VIBES = [
  { k: 'hug', e: '🤗', n: 'Hug', msg: 'sent you a hug', icon: I('🫂', '<circle cx="12" cy="12" r="9"/>') },
  { k: 'kiss', e: '💋', n: 'Kiss', msg: 'blew you a kiss', icon: P('<path d="M3 12c3-4 6-4 9-2 3-2 6-2 9 2-3 4-6 6-9 6s-6-2-9-6z"/><path d="M3 12h18"/>') },
  { k: 'wave', e: '👋', n: 'Wave', msg: 'waved at you', icon: I('👋', '<path d="M7 11V5a2 2 0 0 1 4 0v5"/>') },
  { k: 'wink', e: '😉', n: 'Wink', msg: 'winked at you', icon: P('<circle cx="12" cy="12" r="9"/><path d="M8 10h2M14.5 9.5h.01M8.5 14.5a4.5 4.5 0 0 0 7 0"/>') },
  { k: 'vibes', e: '✨', n: 'Good vibes', msg: 'sent good vibes', icon: I('✨', '<path d="M12 3v18M3 12h18"/>') },
  { k: 'five', e: '🙌', n: 'High five', msg: 'high-fived you', icon: I('🙌', '<path d="M7 11V5a2 2 0 0 1 4 0v5"/>') },
  { k: 'heart', e: '❤️', n: 'Love', msg: 'sent love', icon: I('❤', '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>') },
  { k: 'coffee', e: '☕', n: 'Coffee', msg: 'bought you a coffee', icon: P('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>') },
  { k: 'crush', e: '💘', n: 'Crush', msg: 'has a crush on you', icon: I('💘', '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>') }
];
export const DM_CSS = `.dm-vibes{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 2px}.vibe-btn{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:6px 10px;font:700 12px Poppins,Arial;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#14183a;min-height:36px}.vibe-btn .hic{width:16px;height:16px;color:#e11d48}.vibe-btn:hover{border-color:#0ea5e9;background:#f0f9ff}.vibe-btn:focus-visible{outline:2px solid #6366f1;outline-offset:2px}@media(max-width:899px){.vibe-btn{min-height:44px}}.vibe-burst{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:100003;overflow:hidden}.vibe-burst i{position:absolute;font-style:normal;font-size:28px;animation:burstUp 1.6s ease-out forwards}@keyframes burstUp{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-60vh) scale(1.3) rotate(var(--r));opacity:0}}@media (prefers-reduced-motion:reduce){.vibe-burst{display:none}}
.dm-page{max-width:1240px;margin:0 auto;padding:12px 14px 0}.dm-host{height:calc(100vh - 140px);min-height:380px}@media(max-width:899px){.dm-page{padding:0}}`;

export function burst(emoji, n = 18) {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { }
  const w = document.createElement('div'); w.className = 'vibe-burst'; w.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) { const s = document.createElement('i'); s.textContent = emoji; s.style.left = (10 + Math.random() * 80) + '%'; s.style.top = (55 + Math.random() * 35) + '%'; s.style.animationDelay = (Math.random() * 0.5) + 's'; s.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg'); s.style.fontSize = (20 + Math.random() * 22) + 'px'; w.appendChild(s); }
  document.body.appendChild(w); setTimeout(() => w.remove(), 2400);
}

/* profile page helper: a strip of vibe buttons for someone else's profile */
export function vibeStripHTML(username) { return `<div class="dm-vibes" data-vibes="${esc(username)}" role="group" aria-label="Send a vibe">${VIBES.map(v => `<button type="button" class="vibe-btn" data-vibe="${v.k}" title="${v.n}">${v.icon}<span>${v.n}</span></button>`).join('')}</div>`; }
export async function canDM(sb, me, p) { try { const { data } = await sb.from('profiles').select('id,blocked,adult').in('id', [me.id, p.id]); const mine = (data || []).find(x => x.id === me.id) || {}, theirs = (data || []).find(x => x.id === p.id) || {}; if (mine.adult === false || theirs.adult === false) return { ok: false, why: 'DMs are for members 18 and older.' }; if ((theirs.blocked || []).includes(me.id)) return { ok: false, why: 'This person is not accepting your messages.' }; if ((mine.blocked || []).includes(p.id)) return { ok: false, why: 'You blocked this person. Unblock them from their profile to write.' }; return { ok: true }; } catch (e) { return { ok: true }; } }
export async function sendVibe(ctx, username, kind) {
  const { sb, me, toast } = ctx; const v = VIBES.find(x => x.k === kind); if (!v) return; if (!sb) { toast('Vibes need the live server.'); return; }
  const { data } = await sb.from('profiles').select('id,username').ilike('username', username).limit(1); const p = (data || [])[0]; if (!p) { toast('Could not find @' + username); return; }
  if (p.id === me.id) { burst(v.e); toast(v.n + ' sent to yourself. Self-care counts.'); return; }
  const g = await canDM(sb, me, p); if (!g.ok) { toast(g.why); return; }
  let r = await sb.from('messages').insert({ sender: me.id, recipient: p.id, body: `::vibe:${v.k}::` });
  if (r.error) r = await sb.from('hub_requests').insert({ from_user: me.id, to_user: p.id, kind: 'dm', body: `::vibe:${v.k}::` }); /* not connected yet: it goes as a request */
  if (r.error) { toast('Could not send. Try again.'); return; }
  burst(v.e); toast(v.n + ' sent to @' + p.username);
}
export function wireVibes(root, ctx) { root.querySelectorAll('[data-vibes]').forEach(strip => { strip.addEventListener('click', (e) => { const b = e.target.closest('[data-vibe]'); if (!b) return; if (!ctx.needMe()) return; sendVibe(ctx, strip.dataset.vibes, b.dataset.vibe); }); }); }

/* the DM page: the shared Comm app, full height, with the thread from ?with=username open */
export async function dmView(body, ctx) {
  const { sb, me, toast, needMe } = ctx; if (!needMe()) return;
  const Q = new URLSearchParams(location.search); const withU = (Q.get('with') || '').replace('@', '');
  body.innerHTML = `<div class="dm-page"><h1 class="cm-sr">Direct messages</h1><div class="dm-host" id="dm-host"><div class="fl-empty">Loading your messages…</div></div></div>`;
  const host = body.querySelector('#dm-host');
  let C; try { C = await import('./aou-comm.js'); } catch (e) { host.innerHTML = '<div class="fl-empty">Messages could not load. Check your connection and refresh.</div>'; return; }
  if (!sb) { host.innerHTML = '<div class="fl-empty">Messages need the live server. Reading the Feed still works; try again in a moment.</div>'; return; }
  const store = C.createStore({ sb, me, toast: C.commToast });
  const app = C.mountComm(host, { store, mode: 'page', toast: C.commToast, onOpenHub: (p) => { location.href = '/?v=hub' + (p && p.username ? '&with=' + encodeURIComponent(p.username) : ''); } });
  const fit = () => { if (!host.isConnected) return; const top = host.getBoundingClientRect().top + scrollY; const bb = document.querySelector('.fl-bottom'); const bh = bb && getComputedStyle(bb).display !== 'none' ? bb.offsetHeight : 0; host.style.height = Math.max(380, innerHeight - top - bh - (bh ? 0 : 12)) + 'px'; };
  fit(); addEventListener('resize', fit);
  await store.loadAll(); store.subscribe(); app.renderList();
  if (withU) { const got = await app.open(withU); if (!got) { const found = await store.searchPeople(withU).catch(() => []); const box = document.createElement('div'); box.className = 'cm-nf'; box.setAttribute('role', 'status');
    box.innerHTML = `<b>No member with the username @${C.esc ? C.esc(withU) : withU.replace(/[<>&"]/g, '')}.</b><span>${found.length ? 'Did you mean:' : 'Check the spelling, or find them in People.'}</span><div class="cm-nf-list">${found.map(f => `<button type="button" data-u="${(f.username || f.id).replace(/"/g, '')}">${C.avatarHTML(f, 32)}<span><b>${(C.nameOf(f) || '').replace(/[<>&]/g, '')}</b><small>@${(f.username || '').replace(/[<>&]/g, '')}</small></span></button>`).join('')}</div><a class="cm-nf-go" href="/?v=conn">Open People</a>`;
    host.prepend(box); box.addEventListener('click', async (e) => { const b = e.target.closest('[data-u]'); if (!b) return; const ok = await app.open(b.dataset.u); if (ok) { box.remove(); history.replaceState(null, '', '/?v=dm&with=' + encodeURIComponent(b.dataset.u)); } }); } }
  /* leaving the view (the Feed re-renders #fl-body): drop realtime + listeners */
  const watch = setInterval(() => { if (!host.isConnected) { clearInterval(watch); removeEventListener('resize', fit); app.destroy(); store.destroy(); } }, 1500);
  setTimeout(fit, 300);
}

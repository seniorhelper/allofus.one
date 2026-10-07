/* Messages + Vibes on the flat Feed (Oct 2026).
   Private threads between two people live in `messages` (sender, recipient, body). Vibes are messages whose
   body is ::vibe:<kind>:: — they render as an emoji burst for the receiver. Nothing here touches /world/. */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (iso) => { const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };
export const VIBES = [
  { k: 'hug', e: '🤗', n: 'Hug', msg: 'sent you a hug' },
  { k: 'kiss', e: '💋', n: 'Kiss', msg: 'blew you a kiss' },
  { k: 'wave', e: '👋', n: 'Wave', msg: 'waved at you' },
  { k: 'wink', e: '😉', n: 'Wink', msg: 'winked at you' },
  { k: 'vibes', e: '✨', n: 'Good vibes', msg: 'sent good vibes' },
  { k: 'five', e: '🙌', n: 'High five', msg: 'high-fived you' },
  { k: 'heart', e: '❤️', n: 'Love', msg: 'sent love' },
  { k: 'coffee', e: '☕', n: 'Coffee', msg: 'bought you a coffee' },
  { k: 'crush', e: '💘', n: 'Crush', msg: 'has a crush on you' }
];
export const DM_CSS = `.dm-wrap{display:grid;grid-template-columns:260px 1fr;gap:14px;min-height:60vh}.dm-list{display:flex;flex-direction:column;gap:4px}.dm-row{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;border:1px solid transparent;cursor:pointer;text-decoration:none;color:inherit}.dm-row:hover,.dm-row.on{background:#f1f5f9;border-color:#e2e8f0}.dm-row .av{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#e2e8f0;flex:none;display:grid;place-items:center;font:800 14px var(--fu);color:#475569}.dm-row b{display:block;font-size:14px}.dm-row small{color:#64748b;font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px}.dm-thread{display:flex;flex-direction:column;min-height:60vh}.dm-head{display:flex;align-items:center;gap:10px;padding:8px 0 12px;border-bottom:1px solid #e2e8f0}.dm-head .av{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#e2e8f0}.dm-log{flex:1;overflow:auto;padding:12px 2px;display:flex;flex-direction:column;gap:6px}.dm-msg{max-width:72%;padding:9px 12px;border-radius:14px;background:#f1f5f9;font-size:14px;line-height:1.4;position:relative;word-break:break-word}.dm-msg.me{align-self:flex-end;background:#0ea5e9;color:#fff}.dm-msg time{display:block;font-size:10px;opacity:.65;margin-top:3px}.dm-vibe{align-self:center;text-align:center;padding:8px 14px;border-radius:14px;background:linear-gradient(135deg,#fdf2f8,#eff6ff);border:1px solid #fbcfe8;font-size:13px}.dm-vibe .big{font-size:38px;display:block;animation:vibePop .7s cubic-bezier(.2,1.6,.4,1)}@keyframes vibePop{0%{transform:scale(.2) rotate(-20deg);opacity:0}60%{transform:scale(1.25) rotate(6deg)}100%{transform:scale(1) rotate(0)}}.dm-compose{display:flex;gap:8px;padding-top:10px;border-top:1px solid #e2e8f0}.dm-compose textarea{flex:1;resize:none;min-height:42px;max-height:120px;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:14px var(--fu)}.dm-vibes{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 2px}.vibe-btn{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:5px 9px;font:700 12px var(--fu);cursor:pointer;display:inline-flex;align-items:center;gap:5px;color:#0f172a}.vibe-btn:hover{border-color:#0ea5e9;background:#f0f9ff}.vibe-burst{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden}.vibe-burst i{position:absolute;font-style:normal;font-size:28px;animation:burstUp 1.6s ease-out forwards}@keyframes burstUp{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-60vh) scale(1.3) rotate(var(--r));opacity:0}}@media(max-width:820px){.dm-wrap{grid-template-columns:1fr}.dm-list.has-thread{display:none}.dm-thread{min-height:70vh}}`;

export function burst(emoji, n = 18) {
  const w = document.createElement('div'); w.className = 'vibe-burst';
  for (let i = 0; i < n; i++) { const s = document.createElement('i'); s.textContent = emoji; s.style.left = (10 + Math.random() * 80) + '%'; s.style.top = (55 + Math.random() * 35) + '%'; s.style.animationDelay = (Math.random() * 0.5) + 's'; s.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg'); s.style.fontSize = (20 + Math.random() * 22) + 'px'; w.appendChild(s); }
  document.body.appendChild(w); setTimeout(() => w.remove(), 2400);
}
const parseVibe = (body) => { const m = /^::vibe:([a-z]+)::$/.exec(String(body || '').trim()); return m ? VIBES.find(v => v.k === m[1]) || null : null; };

/* profile page helper: a strip of vibe buttons for someone else's profile */
export function vibeStripHTML(username) { return `<div class="dm-vibes" data-vibes="${esc(username)}">${VIBES.map(v => `<button class="vibe-btn" data-vibe="${v.k}" title="${v.n}">${v.e} ${v.n}</button>`).join('')}</div>`; }
export async function canDM(sb, me, p) { try { const { data } = await sb.from('profiles').select('id,blocked,adult').in('id', [me.id, p.id]); const mine = (data || []).find(x => x.id === me.id) || {}, theirs = (data || []).find(x => x.id === p.id) || {}; if (mine.adult === false || theirs.adult === false) return { ok: false, why: 'DMs are for members 18 and older.' }; if ((theirs.blocked || []).includes(me.id)) return { ok: false, why: 'This person is not accepting your messages.' }; if ((mine.blocked || []).includes(p.id)) return { ok: false, why: 'You blocked this person. Unblock them from their profile to write.' }; return { ok: true }; } catch (e) { return { ok: true }; } }
export async function sendVibe(ctx, username, kind) {
  const { sb, me, toast } = ctx; const v = VIBES.find(x => x.k === kind); if (!v) return;
  const { data } = await sb.from('profiles').select('id,username').ilike('username', username).limit(1); const p = (data || [])[0]; if (!p) { toast('Could not find @' + username); return; }
  if (p.id === me.id) { burst(v.e); toast(v.e + ' Sent to yourself. Self-care counts.'); return; }
  const g = await canDM(sb, me, p); if (!g.ok) { toast(g.why); return; }
  const r = await sb.from('messages').insert({ sender: me.id, recipient: p.id, body: `::vibe:${v.k}::` });
  if (r.error) { toast('Could not send. Try again.'); return; }
  burst(v.e); toast(v.e + ' ' + v.n + ' sent to @' + p.username);
}
export function wireVibes(root, ctx) { root.querySelectorAll('[data-vibes]').forEach(strip => { strip.addEventListener('click', (e) => { const b = e.target.closest('[data-vibe]'); if (!b) return; if (!ctx.needMe()) return; sendVibe(ctx, strip.dataset.vibes, b.dataset.vibe); }); }); }

export async function dmView(body, ctx) {
  const { sb, me, toast, nav, needMe, rightRail, wireRight } = ctx; if (!needMe()) return;
  const Q = new URLSearchParams(location.search); const withU = (Q.get('with') || '').replace('@', '').toLowerCase();
  body.innerHTML = `<div class="fl-grid"><div class="fl-main"><div class="fl-card"><h2 style="margin:0 0 10px;font:400 26px var(--fd)">DMs</h2><div class="dm-wrap"><div class="dm-list${withU ? ' has-thread' : ''}" id="dm-list"><div class="muted">Loading…</div></div><div class="dm-thread" id="dm-thread">${withU ? '' : '<div class="fl-empty">Pick a person on the left, or open anyone\'s profile and tap DM. Anyone can DM anyone — unless they\'ve blocked you, or either of you is under 18.</div>'}</div></div></div></div>${rightRail()}</div>`; wireRight(body);
  const listEl = body.querySelector('#dm-list'), thEl = body.querySelector('#dm-thread');
  /* recent conversations: last message per counterpart */
  const { data: rows } = await sb.from('messages').select('id,sender,recipient,body,created_at').or(`sender.eq.${me.id},recipient.eq.${me.id}`).is('room', null).order('created_at', { ascending: false }).limit(300).then(r => r, () => ({ data: [] }));
  const peers = new Map(); for (const m of rows || []) { const other = m.sender === me.id ? m.recipient : m.sender; if (!peers.has(other)) peers.set(other, m); }
  const ids = [...peers.keys()]; let profs = {};
  if (ids.length) { const { data: ps } = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', ids); for (const p of ps || []) profs[p.id] = p; }
  const rowHTML = (p, m) => { const v = m && parseVibe(m.body); const last = v ? v.e + ' ' + v.n : (m ? m.body : ''); return `<a class="dm-row${withU && p.username && p.username.toLowerCase() === withU ? ' on' : ''}" href="/?v=dm&with=${esc(p.username || '')}">${p.avatar_url ? `<img class="av" src="${esc(p.avatar_url)}" alt="">` : `<span class="av">${esc((p.display_name || p.username || '?').slice(0, 1).toUpperCase())}</span>`}<span style="min-width:0"><b>${esc(p.display_name || p.username || 'Member')}</b><small>${esc(last)}${m ? ' · ' + ago(m.created_at) : ''}</small></span></a>`; };
  listEl.innerHTML = ids.length ? ids.map(id => profs[id] ? rowHTML(profs[id], peers.get(id)) : '').join('') : '<div class="muted" style="padding:8px">No conversations yet. Open a profile and tap Message or send a vibe.</div>';
  if (!withU) return;
  const { data: pd } = await sb.from('profiles').select('id,username,display_name,avatar_url').ilike('username', withU).limit(1); const p = (pd || [])[0];
  if (!p) { thEl.innerHTML = '<div class="fl-empty">No one by that name.</div>'; return; }
  const gate = await canDM(sb, me, p); if (!gate.ok) { thEl.innerHTML = `<div class="fl-empty">${esc(gate.why)}</div>`; return; }
  if (!ids.includes(p.id)) listEl.insertAdjacentHTML('afterbegin', rowHTML(p, null));
  thEl.innerHTML = `<div class="dm-head">${p.avatar_url ? `<img class="av" src="${esc(p.avatar_url)}" alt="">` : '<span class="av"></span>'}<div><b>${esc(p.display_name || p.username)}</b> <a class="muted" href="/?v=u&u=${esc(p.username)}" style="font-size:12px">@${esc(p.username)} · profile</a></div></div><div class="dm-log" id="dm-log"></div>${vibeStripHTML(p.username)}<div class="dm-compose"><textarea id="dm-text" placeholder="Write to ${esc(p.display_name || p.username)}… (Enter to send)"></textarea><button class="fl-btn p" id="dm-send">Send</button></div>`;
  wireVibes(thEl, ctx);
  const log = thEl.querySelector('#dm-log'); const seen = new Set();
  const render = (m, animate) => { if (seen.has(m.id)) return; seen.add(m.id); const mine = m.sender === me.id; const v = parseVibe(m.body); const el = document.createElement('div');
    if (v) { el.className = 'dm-vibe'; el.innerHTML = `<span class="big">${v.e}</span>${mine ? 'You ' + v.msg.replace('you', 'them') : esc(p.display_name || p.username) + ' ' + v.msg}<time style="display:block;font-size:10px;opacity:.6">${ago(m.created_at)}</time>`; if (animate && !mine) burst(v.e); }
    else { el.className = 'dm-msg' + (mine ? ' me' : ''); el.innerHTML = `${esc(m.body)}<time>${ago(m.created_at)}</time>`; }
    log.appendChild(el); log.scrollTop = log.scrollHeight; };
  const load = async () => { const { data } = await sb.from('messages').select('*').or(`and(sender.eq.${me.id},recipient.eq.${p.id}),and(sender.eq.${p.id},recipient.eq.${me.id})`).order('created_at').limit(200); /* older notes sent through the Inbox (hub_requests kind=dm) show in the same thread so nothing is lost */ let old = []; try { const r = await sb.from('hub_requests').select('id,from_user,to_user,body,created_at').eq('kind', 'dm').or(`and(from_user.eq.${me.id},to_user.eq.${p.id}),and(from_user.eq.${p.id},to_user.eq.${me.id})`).order('created_at').limit(100); old = (r.data || []).map(x => ({ id: 'hr' + x.id, sender: x.from_user, recipient: x.to_user, body: x.body, created_at: x.created_at })); } catch (e) { } const all = old.concat(data || []).sort((x, y) => new Date(x.created_at) - new Date(y.created_at)); all.forEach(m => render(m, false)); if (!all.length) log.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Say hi, or send a vibe below.</div>'; };
  await load();
  const ta = thEl.querySelector('#dm-text'); const send = async () => { const t = ta.value.trim(); if (!t) return; ta.value = ''; const { data, error } = await sb.from('messages').insert({ sender: me.id, recipient: p.id, body: t }).select().single(); if (error) { toast('Could not send.'); ta.value = t; return; } if (log.querySelector('.muted')) log.innerHTML = ''; render(data, false); };
  thEl.querySelector('#dm-send').onclick = send; ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  try { const ch = sb.channel('dm-' + me.id + '-' + p.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${me.id}` }, (pay) => { const m = pay.new; if (m.sender === p.id) { if (log.querySelector('.muted')) log.innerHTML = ''; render(m, true); } }).subscribe(); window.addEventListener('beforeunload', () => { try { sb.removeChannel(ch); } catch (e) { } }, { once: true }); } catch (e) { setInterval(load, 8000); }
}

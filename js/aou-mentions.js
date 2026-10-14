/* ============================================================
   allofus.one · @mentions that really work (v20, Oct 14 2026)
   - Type @ in any post, comment or edit box: a list of real members appears (people you are connected to first),
     arrow keys / tap to pick. It sits above every sheet and modal.
   - You can only tag someone who exists: before a post or comment is saved, every @name is checked against
     profiles; unknown names stop the post with a clear message.
   - Only real members render as links. "@anything" that is not a member stays plain text.
   - The tagged person gets an Alert (and a live toast + a desktop / phone notification while allofus.one is open).
   No new tables: mentions are found by searching post and comment text for @username.
   ============================================================ */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const MENTION_RE = /(^|[^a-z0-9_.@-])@([a-z0-9_][a-z0-9_.-]{0,23})/gi;
/* every @handle in a piece of text, lower-case, trailing dots stripped, no duplicates */
export const handlesIn = (t) => { const out = new Set(); String(t || '').replace(MENTION_RE, (m, a, h) => { out.add(h.replace(/[.-]+$/, '').toLowerCase()); return m; }); return [...out].filter(Boolean); };
/* usernames known to exist (lower-case) → { id, username, name, avatar } */
export const KNOWN = new Map();
const remember = (r) => { if (r && r.username) KNOWN.set(String(r.username).toLowerCase(), { id: r.id, username: r.username, name: r.display_name || r.name || r.username, avatar: r.home && r.home.flat && r.home.flat.avatar }); };
export const rememberMany = (rows) => (rows || []).forEach(remember);
const missing = new Set(); /* names we already looked up and did not find */
/* look up any handles we have not seen yet (one query) */
export async function resolveHandles(sb, list) { const need = [...new Set(list.map(h => h.toLowerCase()))].filter(h => !KNOWN.has(h) && !missing.has(h)); if (!need.length || !sb) return; try { const { data, error } = await sb.from('profiles').select('id,username,display_name,home').in('username', need); if (error) throw error; rememberMany(data); need.forEach(h => { if (!KNOWN.has(h)) missing.add(h); }); } catch (e) { } }
/* before saving: { ok, ids, unknown } */
export async function checkMentions(sb, text) { const hs = handlesIn(text); if (!hs.length) return { ok: true, ids: [], unknown: [] }; missing.clear(); await resolveHandles(sb, hs); const unknown = hs.filter(h => !KNOWN.has(h)); const ids = hs.filter(h => KNOWN.has(h)).map(h => KNOWN.get(h).id); return { ok: !unknown.length, ids, unknown }; }
export const unknownMsg = (u) => u.length === 1 ? `No member is called @${u[0]}. Type @ and pick a name from the list, or remove the @.` : `These are not members: ${u.map(x => '@' + x).join(', ')}. Type @ and pick names from the list.`;
/* text (already HTML-escaped) → links for real members only; #tags as before */
export const linkify = (h) => h.replace(/(^|\s)#([a-z0-9_]{2,30})\b/gi, '$1<a class="tag" href="/?v=search&q=%23$2">#$2</a>').replace(MENTION_RE, (m, a, hd) => { const k = hd.replace(/[.-]+$/, '').toLowerCase(); const u = KNOWN.get(k); if (!u) return m; const rest = hd.slice(k.length); return `${a}<a class="tag ment" href="/?u=${encodeURIComponent(u.username)}" title="${esc(u.name)}">@${esc(u.username)}</a>${rest}`; });
/* make sure every handle in these texts is resolved before rendering */
export const prepTexts = (sb, texts) => resolveHandles(sb, texts.flatMap(handlesIn));

/* ---------- the @ picker ---------- */
export const MENTION_CSS = `.men2{position:fixed;z-index:10050;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 18px 40px rgba(2,8,30,.22);max-height:260px;overflow:auto;min-width:240px;max-width:min(340px,92vw);padding:4px}.men2 .mh{font:800 10.5px var(--ff,Poppins,Arial);letter-spacing:.06em;text-transform:uppercase;color:#64748b;padding:6px 10px 4px}.men2 button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:0;background:#fff;padding:7px 10px;border-radius:9px;cursor:pointer;font:600 13.5px var(--ff,Poppins,Arial);color:#0f172a}.men2 button:hover,.men2 button.on{background:#e0f2fe}.men2 .av{width:30px;height:30px;border-radius:50%;background:#e0f2fe center/cover;display:inline-flex;align-items:center;justify-content:center;font:900 13px var(--ff,Poppins,Arial);color:#0b1a3a;flex:none}.men2 b{display:block;font-weight:800;line-height:1.2}.men2 small{color:#64748b;font-size:12px}.men2 .none{padding:10px;color:#64748b;font:600 13px var(--ff,Poppins,Arial)}a.tag.ment{background:#e0f2fe;color:#0369a1;border-radius:6px;padding:0 3px;font-weight:700;text-decoration:none}`;
let cssOn = false; const addCss = () => { if (cssOn) return; cssOn = true; const s = document.createElement('style'); s.textContent = MENTION_CSS; document.head.appendChild(s); };
/* attach the picker to a textarea / input. o.first() → ids to list first (connections). */
export function attachMentions(ta, sb, o = {}) {
  if (!ta || ta.dataset.men2) return; ta.dataset.men2 = '1'; ta.dataset.men = '1'; addCss();
  let box = null, items = [], sel = 0, at = -1, t = 0, qn = 0;
  const close = () => { if (box) { box.remove(); box = null; } };
  const pick = (u) => { if (!u) return; const v = ta.value; const end = ta.selectionStart; ta.value = v.slice(0, at) + '@' + u.username + ' ' + v.slice(end); const pos = at + u.username.length + 2; ta.focus(); try { ta.setSelectionRange(pos, pos); } catch (e) { } remember({ id: u.id, username: u.username, display_name: u.name, home: u.home }); close(); ta.dispatchEvent(new Event('input', { bubbles: true })); };
  const place = () => { if (!box) return; const r = ta.getBoundingClientRect(); const h = box.offsetHeight || 200; const below = innerHeight - r.bottom; box.style.left = Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8)) + 'px'; box.style.top = (below > h + 8 || below > r.top ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + 'px'; };
  const draw = (q) => { if (!box) { box = document.createElement('div'); box.className = 'men2'; box.setAttribute('role', 'listbox'); document.body.appendChild(box); } box.innerHTML = items.length ? `<div class="mh">${q ? 'Members' : 'Tag someone'}</div>` + items.map((u, i) => `<button type="button" role="option" data-i="${i}" class="${i === sel ? 'on' : ''}" aria-selected="${i === sel}"><span class="av" ${u.avatar ? `style="background-image:url(${esc(u.avatar)});color:transparent"` : ''}>${esc((u.name || u.username || '?')[0])}</span><span><b>${esc(u.name || u.username)}</b><small>@${esc(u.username)}</small></span></button>`).join('') : `<div class="none">No member called @${esc(q)}. Only real members can be tagged.</div>`; box.querySelectorAll('button').forEach(b => { b.onmousedown = (e) => { e.preventDefault(); pick(items[+b.dataset.i]); }; b.ontouchstart = (e) => { e.preventDefault(); pick(items[+b.dataset.i]); }; }); place(); };
  const search = async (q) => { const my = ++qn; let rows = []; try { let qq = sb.from('profiles').select('id,username,display_name,home').not('username', 'is', null).limit(8); if (q) { const like = '%' + q.replace(/[%_,()]/g, '') + '%'; qq = qq.or(`username.ilike.${like},display_name.ilike.${like}`); } else { const first = (o.first && o.first()) || []; if (first.length) qq = qq.in('id', first.slice(0, 30)); else qq = qq.order('created_at', { ascending: false }); } const { data } = await qq; rows = data || []; } catch (e) { rows = []; } if (my !== qn) return; const meId = o.meId && o.meId(); items = rows.filter(r => r.username && r.id !== meId).map(r => ({ id: r.id, username: r.username, name: r.display_name, home: r.home, avatar: r.home && r.home.flat && r.home.flat.avatar })); rememberMany(rows); sel = 0; draw(q); };
  ta.addEventListener('input', () => { const v = ta.value.slice(0, ta.selectionStart); const m = v.match(/(^|[\s(])@([a-z0-9_.-]{0,24})$/i); if (!m) { close(); return; } at = v.length - m[2].length - 1; clearTimeout(t); const q = m[2].toLowerCase(); t = setTimeout(() => search(q), q ? 150 : 0); });
  ta.addEventListener('keydown', (e) => { if (!box || !items.length) { if (box && e.key === 'Escape') close(); return; } if (e.key === 'ArrowDown') { sel = (sel + 1) % items.length; draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = (sel - 1 + items.length) % items.length; draw(); e.preventDefault(); } else if (e.key === 'Enter' || e.key === 'Tab') { pick(items[sel]); e.preventDefault(); e.stopImmediatePropagation(); } else if (e.key === 'Escape') close(); }, true);
  ta.addEventListener('blur', () => setTimeout(close, 180)); addEventListener('scroll', place, { passive: true });
}

/* ---------- notifications while the site is open ---------- */
export const notifyOn = () => { try { return 'Notification' in window && Notification.permission === 'granted'; } catch (e) { return false; } };
export async function askNotify() { try { if (!('Notification' in window)) return 'unsupported'; if (Notification.permission === 'granted') return 'granted'; return await Notification.requestPermission(); } catch (e) { return 'denied'; } }
export async function systemNotify(title, body, url) { if (!notifyOn() || document.visibilityState === 'visible') return; try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); const opts = { body, icon: '/images/favicon-192.png', badge: '/images/favicon-192.png', data: { url: url || '/?v=notif' }, tag: 'aou-' + Date.now() }; if (reg && reg.showNotification) await reg.showNotification(title, opts); else { const n = new Notification(title, opts); n.onclick = () => { focus(); location.href = url || '/?v=notif'; }; } } catch (e) { } }

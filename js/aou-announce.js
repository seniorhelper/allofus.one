/* Dismissible announcement bar at the top of the home feed (v152).
   To change it: edit ANNOUNCEMENTS. Give every new announcement a NEW id, so people who closed an older one still see it.
   Fields: id (required), text (required, plain words, only true things), label (small tag), link + linkText (optional, a page on this site
   or an https address), until (optional last day, YYYY-MM-DD). The first one that is not closed and not expired is shown. */
export const ANNOUNCEMENTS = [
  { id: '2026-11-23-whats-new', label: 'New', text: 'Build your own house, comment threads that stay open (with emoji), and a tighter More menu.', until: '2026-12-07' }
];
const KEY = 'aou_ann_closed';
const closedIds = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export function current(now = new Date()) {
  const c = closedIds();
  return ANNOUNCEMENTS.find(a => a && a.id && a.text && !c.includes(a.id) && (!a.until || now <= new Date(a.until + 'T23:59:59'))) || null;
}
export function mountAnnounce(host) {
  if (!host) return false; if (host.querySelector('#aou-ann')) return true; const a = current(); if (!a) return false;
  if (!document.getElementById('aou-ann-css')) { const st = document.createElement('style'); st.id = 'aou-ann-css'; st.textContent = '#aou-ann{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 8px 10px 14px;border-radius:14px;background:#1b1f3b;color:#fff;font:600 14px/1.4 var(--fu,Arial,sans-serif)}#aou-ann .ann-l{flex:none;background:#fbbf24;color:#1b1f3b;font-weight:800;font-size:11px;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:3px 9px}#aou-ann .ann-t{flex:1;min-width:0;overflow-wrap:anywhere}#aou-ann a{color:#fde68a;font-weight:800;text-decoration:underline;margin-left:6px;white-space:nowrap}#aou-ann .ann-x{flex:none;width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#fff;font-size:20px;line-height:1;cursor:pointer}#aou-ann .ann-x:hover{background:rgba(255,255,255,.14)}#aou-ann .ann-x:focus-visible,#aou-ann a:focus-visible{outline:2px solid #fde68a;outline-offset:2px}'; document.head.appendChild(st); }
  const bar = document.createElement('div'); bar.id = 'aou-ann'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Announcement');
  if (a.label) { const l = document.createElement('span'); l.className = 'ann-l'; l.textContent = a.label; bar.appendChild(l); }
  const t = document.createElement('span'); t.className = 'ann-t'; t.textContent = a.text;
  if (a.link && /^(\/(?!\/)|https:\/\/)/.test(a.link)) { const k = document.createElement('a'); k.href = a.link; k.textContent = a.linkText || 'See more'; t.appendChild(k); }
  bar.appendChild(t);
  const x = document.createElement('button'); x.type = 'button'; x.className = 'ann-x'; x.setAttribute('aria-label', 'Close this announcement'); x.textContent = '×';
  x.onclick = () => { try { const c = closedIds(); if (!c.includes(a.id)) c.push(a.id); localStorage.setItem(KEY, JSON.stringify(c.slice(-30))); } catch (e) { } bar.remove(); };
  bar.appendChild(x); host.prepend(bar); return true;
}

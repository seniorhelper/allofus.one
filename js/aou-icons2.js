/* allofus.one house icons, set 2 (Oct 9 2026). Extends aou-icons.js (never edited here) with the glyphs the
   flat side still leaned on: LIFEboard tools, feed chrome, profile + page buttons, control panel, context menus.
   Same contract: outlined 24-grid SVG, currentColor, squared. Content people typed is never touched. */
import { HICON } from './aou-icons.js';
const P = (d) => `<svg class="hic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SET2 = {
  '✏️': P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3"/>'),
  '✏': P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3"/>'),
  '🧩': P('<path d="M9 4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H5v-4a2 2 0 1 0 0-4V4z"/>'),
  '☀️': P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'),
  '📧': P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  '🎮': P('<rect x="3" y="7" width="18" height="11" rx="4"/><path d="M8 11v3M6.5 12.5h3M16 11h.01M18 13h.01"/>'),
  '🎓': P('<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>'),
  '🪙': P('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h3.5a2 2 0 0 1 0 4H9.5h4a2 2 0 0 1 0 4H9.5"/>'),
  '🤖': P('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M8 4h8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M9 17h6"/>'),
  '⬡': P('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>'),
  '💸': P('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9h.01M18 15h.01"/>'),
  '🕊️': P('<path d="M4 13c3 0 5-2 6-5 1 3 4 4 7 3l4-2-2 4c-1 3-4 5-8 5H8l-4 3 2-5c-1-1-2-2-2-3z"/>'),
  '🆘': P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>'),
  '😇': P('<circle cx="12" cy="13" r="8"/><ellipse cx="12" cy="4" rx="5" ry="1.6"/><path d="M9 12h.01M15 12h.01M9 16c1.5 1.5 4.5 1.5 6 0"/>'),
  '📈': P('<path d="M3 20h18"/><path d="M4 16l5-5 4 3 7-8"/><path d="M16 6h4v4"/>'),
  '⏰': P('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M5 4L3 6M19 4l2 2"/>'),
  '⏱️': P('<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M10 2h4M12 2v3"/>'),
  '📓': P('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/>'),
  '💌': P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/><path d="M12 16l-1-.9a1.4 1.4 0 0 1 2 -2 1.4 1.4 0 0 1 2 2z"/>'),
  '💰': P('<path d="M9 4h6l2 3H7z"/><path d="M7 7c-3 3-4 6-4 9a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4c0-3-1-6-4-9"/><path d="M12 10v7M10 12h3a1.5 1.5 0 0 1 0 3h-3"/>'),
  '📊': P('<path d="M3 20h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>'),
  '🎤': P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>'),
  '🪣': P('<path d="M4 8h16l-2 12H6z"/><ellipse cx="12" cy="8" rx="8" ry="2"/><path d="M7 8c0-4 10-4 10 0"/>'),
  '🧊': P('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  '🎁': P('<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18M12 9v12M12 9c-2 0-4-1-4-3a2 2 0 0 1 4 0M12 9c2 0 4-1 4-3a2 2 0 0 0-4 0"/>'),
  '🔎': P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  '🔍': P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  '🔔': P('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  '⚙️': P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  '⚙': P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  '🔒': P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  '🏷️': P('<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'),
  '📣': P('<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M18 9a4 4 0 0 1 0 6"/>'),
  '🙂': P('<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14.5c1.5 2 5.5 2 7 0"/>'),
  '🔖': P('<path d="M6 4h12v17l-6-4-6 4z"/>'),
  '⏳': P('<path d="M6 3h12M6 21h12M8 3v4l4 5-4 5v4M16 3v4l-4 5 4 5v4"/>'),
  '🗑': P('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'),
  '🗑️': P('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'),
  '👍': P('<path d="M7 11v9H4v-9z"/><path d="M7 11l4-7c1.5 0 2.5 1 2.5 2.5L13 10h6a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7"/>'),
  '👎': P('<path d="M7 13V4H4v9z"/><path d="M7 13l4 7c1.5 0 2.5-1 2.5-2.5L13 14h6a2 2 0 0 0 2-2l-1.5-6a2 2 0 0 0-2-2H7"/>'),
  '🖼️': P('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>'),
  '🎬': P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 7l2 4M12 7l2 4M17 7l2 4"/>'),
  '📷': P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  '🔁': P('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  '💘': P('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M3 21l8-8M9 13h2v2"/>'),
  '🙌': P('<path d="M7 20v-6l-3-5 2-1 2 3V5a1 1 0 0 1 2 0v6M17 20v-6l3-5-2-1-2 3V5a1 1 0 0 0-2 0v6"/>'),
  '🚪': P('<path d="M4 21h16M6 21V4h9v17"/><circle cx="12.5" cy="12" r="1"/>'),
  '🛠️': P('<path d="M14 7a4 4 0 0 0 5 5l-8 8-3-3 8-8zM3 21l3-3"/>'),
  '🛠': P('<path d="M14 7a4 4 0 0 0 5 5l-8 8-3-3 8-8zM3 21l3-3"/>'),
  '⤢': P('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
  '⤡': P('<path d="M4 10V4h6M20 14v6h-6M4 4l7 7M20 20l-7-7"/>'),
  '🕒': P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  '🕶️': P('<path d="M3 9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-3l-2-3h-2l-2 3H6a3 3 0 0 1-3-3z"/><circle cx="8.5" cy="12" r="1.5"/><circle cx="15.5" cy="12" r="1.5"/>'),
  '🥽': P('<path d="M3 9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-3l-2-3h-2l-2 3H6a3 3 0 0 1-3-3z"/>'),
  '🎥': P('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>'),
  '📝': P('<path d="M5 4h10l4 4v12H5z"/><path d="M9 13h6M9 17h6M9 9h2"/>'),
  '🧰': P('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18M10 13v3M14 13v3"/>'),
  '❓': P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>'),
  '📒': P('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4M12 16h4"/>'),
  '🔠': P('<path d="M3 18l4-12 4 12M4.5 14h5"/><path d="M14 6v12M14 12h3a3 3 0 0 1 0 6h-3M14 6h3a3 3 0 0 1 0 6"/>'),
  '🙋': P('<circle cx="12" cy="7" r="3"/><path d="M6 21v-5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v5M19 3v5"/>'),
  '📘': P('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z"/><path d="M5 4v16a3 3 0 0 1 3-3h11"/>'),
  '📱': P('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'),
  '📌': P('<path d="M12 21v-6M8 15h8l-1-5V5h1V3H8v2h1v5z"/>'),
  '📴': P('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M4 4l16 16"/>'),
  '📶': P('<path d="M4 18h.01M8 18v-3M12 18v-7M16 18V7M20 18V3"/>'),
  '👤': P('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  '🧍': P('<circle cx="12" cy="5" r="2"/><path d="M12 7v7M9 10h6M12 14l-2 7M12 14l2 7"/>'),
  '🛍️': P('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  '✍️': P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3M3 22h12"/>'),
  '✍': P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3M3 22h12"/>'),
  '💾': P('<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  '🏆': P('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 20h8"/>'),
  '📬': P('<path d="M4 10h12v10H4z"/><path d="M4 14h12M10 10V4h8l-2 2 2 2h-8"/>'),
  '🟢': P('<circle cx="12" cy="12" r="7"/>'),
  '🌳': P('<circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6"/>'),
  '⭐': P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  '＋': P('<path d="M12 5v14M5 12h14"/>'),
  '🤿': P('<circle cx="10" cy="11" r="6"/><path d="M16 11h3v9M10 17v4"/>'),
  '🖐️': P('<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7M16 12V8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-12 0v-2a2 2 0 0 1 2-2"/>'),
  '🎊': P('<path d="M4 20l4-12 8 8z"/><path d="M14 6l1-2M18 8l2-1M16 12l2 1M12 4l.5 2M20 4l1 1"/>')
};
export const HICON2 = Object.assign({}, HICON, SET2);
export const ICON2_CSS = `.hic{width:1.1em;height:1.1em;vertical-align:-0.18em;display:inline-block;color:currentColor}`;
/* icon by emoji key (for templates): ic('✏️') → svg string */
export const ic = (k, cls) => { const s = HICON2[k] || HICON2[String(k).replace(/️/g, '')] || ''; return cls && s ? s.replace('class="hic"', `class="hic ${cls}"`) : s; };
/* LIFEboard tool ids → the icon that stands for them on the flat side */
export const TOOL_ICON = { today: '☀️', dash: '🧩', email: '📧', arcade: '🎮', study: '🎓', wealth: '🪙', agent: '🤖', hub: '📡', home: '🏡', work: '⬡', money2: '💸', spirit: '🕊️', help: '🆘', bugs: '🐞', halo: '😇', trackers: '📈', reminders: '⏰', focus: '⏱️', journal: '📓', future: '💌', money: '💰', moneytools: '💰', hugs: '🤗', insights: '📊', events: '🎤', bucket: '🪣', overview: '🧭', goals: '🎯', vision: '🖼️', social: '📰', wellness: '🌱', giving: '🎁', create: '🎨', paths: '🧭', blocks: '🧱', habits: '✅', wheel: '🧭', projects: '🧰', gen: '✨' };
export const toolIcon = (id) => ic(TOOL_ICON[id] || '✨');
const RX = new RegExp('(' + Object.keys(HICON2).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'g');
/* content stays content: anything a member typed, reactions, big-text posts, Hearts, Orbit's glove */
const SKIP = 'textarea, input, [contenteditable], canvas, #orbit-tab, .glove, #aou-lumi .face, .txt, .bigtxt, .cmts, .cmt, .rpop, .rsum, .rchips, .rx, .fl-dbl, .vibe-burst, .dm-msg, .dm-vibe, .hearts, #hearts, .lb .out, .no-icons, code, pre, .fl-feed .say, .act-car .t, .act-car .m, .lt-journal, .lt-letter, .prev';
export function swapEmoji(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => { if (!n.nodeValue || !RX.test(n.nodeValue)) return NodeFilter.FILTER_REJECT; RX.lastIndex = 0; const p = n.parentElement; if (!p || p.closest(SKIP) || p.closest('svg')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
  const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
  for (const t of nodes) { const span = document.createElement('span'); span.innerHTML = t.nodeValue.replace(RX, (m, k) => HICON2[k] || m); t.replaceWith(...span.childNodes); }
}
export function watchEmoji(root) {
  swapEmoji(root);
  const mo = new MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach(a => { if (a.nodeType === 1) swapEmoji(a); else if (a.nodeType === 3 && a.parentElement) swapEmoji(a.parentElement); }); });
  mo.observe(root, { childList: true, subtree: true }); return mo;
}

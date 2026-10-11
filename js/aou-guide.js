/* allofus.one · guides + line icons (Oct 11 2026)
   One small kit the flat tools share:
   - LI: a Lucide-style line icon set (24 grid, 2px stroke, currentColor, inline SVG, no CDN)
   - guideHTML(): the "what is this + how it works (3 steps) + examples" card for any tool with an empty or confusing state
   - GUIDE_CSS: the card, step list, example chips and the shared 44px icon-button style (.ib)
   Nothing here talks to the server. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const S = (d, extra = '') => `<svg class="li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
export const LI = {
  book: S('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  cap: S('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
  check: S('<path d="M20 6 9 17l-5-5"/>'),
  checkCircle: S('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  circle: S('<circle cx="12" cy="12" r="10"/>'),
  plus: S('<path d="M5 12h14M12 5v14"/>'),
  pencil: S('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
  trash: S('<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>'),
  share: S('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>'),
  link: S('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  external: S('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  play: S('<polygon points="6 3 20 12 6 21 6 3"/>'),
  users: S('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  sparkles: S('<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>'),
  back: S('<path d="m12 19-7-7 7-7M19 12H5"/>'),
  up: S('<path d="m18 15-6-6-6 6"/>'),
  down: S('<path d="m6 9 6 6 6-6"/>'),
  right: S('<path d="m9 18 6-6-6-6"/>'),
  languages: S('<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
  music: S('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  briefcase: S('<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  activity: S('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  utensils: S('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>'),
  wallet: S('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  listChecks: S('<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>'),
  calendar: S('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  inbox: S('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
  home: S('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  sliders: S('<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>'),
  maximize: S('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  minimize: S('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'),
  x: S('<path d="M18 6 6 18M6 6l12 12"/>'),
  scaling: S('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="3" y="12" width="9" height="9" rx="1.5"/><path d="M15 9l3-3M15 6h3v3"/>'),
  grip: S('<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>'),
  restore: S('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  bulb: S('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>'),
  info: S('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  copy: S('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  video: S('<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.94a.5.5 0 0 0-.78-.42L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>'),
  layers: S('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
  eyeOff: S('<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>'),
  flag: S('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>'),
  clock: S('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  target: S('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>')
};
export const li = (k, cls) => { const s = LI[k] || ''; return cls ? s.replace('class="li"', `class="li ${cls}"`) : s; };

/* the "what is this" card: { icon, title, what, steps:[3 strings], examples:[{label, act}] , note } */
export function guideHTML(g) {
  return `<section class="gd" aria-label="How ${esc(g.title)} works"><div class="gd-h"><span class="gd-ic">${li(g.icon || 'info')}</span><div><h3>${esc(g.title)}</h3><p>${g.what}</p></div></div>
  <ol class="gd-steps">${(g.steps || []).map((s, i) => `<li><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol>
  ${g.examples && g.examples.length ? `<p class="gd-lbl">${esc(g.exLabel || 'Try one')}</p><div class="gd-ex">${g.examples.map((e, i) => `<button type="button" class="gd-chip" data-gex="${i}">${e.icon ? li(e.icon) : ''}<span>${esc(e.label)}</span></button>`).join('')}</div>` : ''}
  ${g.note ? `<p class="gd-note">${li('info')}<span>${g.note}</span></p>` : ''}</section>`;
}
/* wire example chips: each example gets { fill: {selector: value}, focus: selector } or { run: fn } */
export function wireGuide(root, g) {
  (g.examples || []).forEach((e, i) => { const b = root.querySelector(`[data-gex="${i}"]`); if (!b) return; b.onclick = () => { if (e.run) return e.run(); if (e.fill) { Object.entries(e.fill).forEach(([sel, val]) => { const el = root.querySelector(sel) || document.querySelector(sel); if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); } }); } const f = e.focus && (root.querySelector(e.focus) || document.querySelector(e.focus)); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { f.focus({ preventScroll: true }); } catch (x) { } } }; });
}

export const GUIDE_CSS = `
.li{width:20px;height:20px;flex:none;display:inline-block;vertical-align:middle}
.gd{background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin-bottom:12px}
.gd-h{display:flex;gap:12px;align-items:flex-start}.gd-h h3{margin:0 0 4px;font:900 17px Poppins,Arial;color:#0f172a}.gd-h p{margin:0;color:#334155;font-size:14px;line-height:1.5}
.gd-ic{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff}.gd-ic .li{width:22px;height:22px}
.gd-steps{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px}.gd-steps>li>span b{font-weight:800;color:#0f172a}.gd-steps li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:#1e293b;line-height:1.45}.gd-steps>li>b{flex:none;width:26px;height:26px;border-radius:8px;background:#0b1a3a;color:#b6ff2e;display:grid;place-items:center;font:900 13px Poppins,Arial}
.gd-lbl{margin:14px 0 6px;font:800 11px Poppins,Arial;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
.gd-ex{display:flex;flex-wrap:wrap;gap:6px}.gd-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:8px 12px;border:1.5px solid #dbe3ee;border-radius:12px;background:#fff;font:700 13px Poppins,Arial;color:#0f172a;cursor:pointer;text-align:left;transition:border-color .15s,background .15s,transform .12s}.gd-chip .li{width:16px;height:16px;color:#0ea5e9}.gd-chip:hover{border-color:#0ea5e9;background:#f0f9ff}.gd-chip:active{transform:translateY(1px)}
.gd-note{display:flex;gap:8px;align-items:flex-start;margin:12px 0 0;font-size:12.5px;color:#475569;line-height:1.45}.gd-note .li{width:16px;height:16px;color:#64748b;margin-top:1px}
.gd-chip:focus-visible,.ib:focus-visible,.gbtn:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}
/* shared icon button (44px touch target) */
.ib{display:inline-grid;place-items:center;width:40px;height:40px;min-width:40px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#334155;cursor:pointer;padding:0;position:relative;transition:background .15s,border-color .15s,color .15s}.ib::after{content:"";position:absolute;inset:-2px}.ib:hover{background:#f1f5f9;border-color:#cbd5e1;color:#0f172a}.ib .li{width:18px;height:18px}.ib.danger:hover{color:#b91c1c;border-color:#fecaca;background:#fef2f2}
/* shared text button with icon */
.gbtn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1.5px solid #dbe3ee;background:#fff;color:#0f172a;font:800 14px Poppins,Arial;cursor:pointer;text-decoration:none;transition:background .15s,border-color .15s,box-shadow .15s,transform .12s}.gbtn .li{width:18px;height:18px}.gbtn:hover{border-color:#94a3b8;background:#f8fafc}.gbtn:active{transform:translateY(1px)}
.gbtn.p{background:linear-gradient(135deg,#0ea5e9,#6366f1);border-color:transparent;color:#fff;box-shadow:0 8px 20px rgba(79,70,229,.25)}.gbtn.p:hover{box-shadow:0 10px 24px rgba(79,70,229,.35);filter:brightness(1.04)}
.gbtn.sm{min-height:40px;padding:0 12px;font-size:13px}.gbtn.danger{color:#b91c1c}.gbtn.danger:hover{background:#fef2f2;border-color:#fecaca}
.gbtn[disabled]{opacity:.55;cursor:not-allowed}
.gd-wrap{margin-bottom:12px}.gd-wrap>.gd{margin-bottom:0}.gd-sum{display:none;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;font:800 14px Poppins,Arial;color:#0f172a;cursor:pointer;list-style:none}.gd-sum::-webkit-details-marker{display:none}.gd-sum .li:first-child{color:#0ea5e9}.gd-sum .li:last-child{margin-left:auto;transition:transform .15s}.gd-wrap[open]>.gd-sum .li:last-child{transform:rotate(180deg)}
@media(min-width:1001px){.gd-side{position:sticky;top:12px;align-self:start}.gd-side .gd-h{flex-direction:column;gap:10px}}
@media(max-width:1000px){.gd-sum{display:flex}.gd-wrap[open]>.gd-sum{border-radius:14px 14px 0 0;border-bottom:0}.gd-wrap[open]>.gd{border-top-left-radius:0;border-top-right-radius:0}}
@media(max-width:600px){.gd{padding:14px}.gd-h h3{font-size:16px}}
`;

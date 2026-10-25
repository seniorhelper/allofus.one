/* allofus.one · Grow your business launchpad (v26, Oct 23 2026) · view key "grow" (/?v=grow, alias /?v=launchpad)
   Ties the business side of allofus (Brand pages, searchBOOST) to the tools Eye To Ad Media runs:
   AI Speed to Leads, USA Business Search, Colorado Business List, three press-release sites, World VR Mall, Eye To Ad Media.
   LINK RULES (directory-pricing-and-link-rules): every outbound promo link is rel="sponsored noopener" (zero followed
   own-site links), opens in a new tab, and carries utm_source=allofus so visits show up in each site's analytics.
   Press release: none of the PR sites accept prefilled fields from another site (checked 2026-10-23: the Release Builder
   only reads its own localStorage), so we build the draft here, copy it to the clipboard, and open the builder. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PHONE = '1-800-481-8638';
export const utm = (url, content = 'launchpad') => { try { const u = new URL(url); u.searchParams.set('utm_source', 'allofus'); u.searchParams.set('utm_medium', 'referral'); u.searchParams.set('utm_campaign', 'grow'); u.searchParams.set('utm_content', content); return u.toString(); } catch (e) { return url; } };
const out = (url, label, cls = 'fl-btn', content) => `<a class="${cls}" href="${esc(utm(url, content))}" target="_blank" rel="sponsored noopener">${label}</a>`;

/* the network tools (every URL HEAD-checked 200 on 2026-10-23) */
export const TOOLS = [
  { k: 'stl', name: 'AI Speed to Leads', tag: 'Answer every new inquiry in about 60 seconds', color: '#0ea5e9',
    body: 'When someone fills out your website form, an AI assistant follows up by email or a call within about a minute, while they are still interested. Only people who asked to be contacted are ever called. No cold calling, ever.',
    main: ['https://aispeedtoleads.com/', 'See how it works'], alt: ['https://aispeedtoleads.com/demo/', 'Hear the live demo'] },
  { k: 'usa', name: 'USA Business Search', tag: 'Free business listing, nationwide', color: '#1d4ed8',
    body: 'Add, fix or remove your listing for free, with your own description. A Verified badge and featured spots are optional upgrades.',
    main: ['https://usabusinesssearch.com/add-your-business/', 'Add my free listing'], alt: ['https://usabusinesssearch.com/', 'Browse the directory'] },
  { k: 'co', name: 'Colorado Business List', tag: 'Free listing for Colorado businesses', color: '#059669',
    body: 'The statewide Colorado directory. Free listing with your owner description; optional Verified badge.',
    main: ['https://cobusinesslist.com/add-your-business/', 'Add my free Colorado listing'], alt: ['https://cobusinesslist.com/', 'Browse Colorado'] },
  { k: 'vr', name: 'World VR Mall', tag: 'A 3D storefront people can walk into', color: '#7c3aed',
    body: 'Lease a storefront in a walk-in 3D mall that works in any browser and on a VR headset. Your store links straight to your own checkout.',
    main: ['https://worldvrmall.com/lease/', 'Lease a store'], alt: ['https://worldvrmall.com/', 'Walk the mall'] },
  { k: 'eta', name: 'Eye To Ad Media', tag: 'Done-for-you websites, SEO and ads', color: '#0b1a3a',
    body: `The Denver team behind allofus.one. Websites, SEO, AI search visibility, paid ads and lead generation, built and run for you. Call ${PHONE}.`,
    main: ['https://eyetoad.com/', 'Talk to the team'], alt: null },
];
export const PR_SITES = [
  { name: 'Distribute Press Releases', note: 'Free Release Builder: write it, check it, then choose where it goes.', url: 'https://distributepressreleases.com/tools/release-builder/', cta: 'Open the free Release Builder' },
  { name: 'Press Release for Business', note: 'Publishing plans for business news, with a permanent release page.', url: 'https://pressreleaseforbusiness.com/pricing/', cta: 'See publishing plans' },
  { name: 'Action Global News', note: 'Business and tech news desk; distribution for announcements.', url: 'https://actionglobalnews.com/press-release-distribution/', cta: 'Ask about distribution' },
];
export const GROW_CSS = `.gr-wrap{max-width:1000px;margin:16px auto;padding:0 12px;display:grid;gap:14px;font-family:Poppins,Arial,sans-serif;color:#0f172a}.gr-hero{background:linear-gradient(135deg,#0b1a3a,#1e3a6a);color:#fff;border-radius:18px;padding:22px}.gr-hero h2{margin:0 0 6px;font-size:clamp(22px,4vw,30px)}.gr-hero p{margin:0;color:#cfe8ff;max-width:720px;line-height:1.5}.gr-steps{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.gr-steps button{border:1.5px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;padding:6px 12px;font:700 12px Poppins,Arial;cursor:pointer}.gr-steps button.done{background:#22c55e;border-color:#22c55e;color:#04210f}.gr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.gr-c{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;border-top:5px solid var(--c)}.gr-c h3{margin:0;font-size:17px}.gr-c .t{font:700 12px Poppins,Arial;color:var(--c);text-transform:uppercase;letter-spacing:.04em}.gr-c p{margin:0;color:#475569;line-height:1.5;font-size:14px;flex:1}.gr-c .b{display:flex;gap:8px;flex-wrap:wrap}.gr-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px}.gr-card h3{margin:0 0 6px}.gr-card p{margin:0 0 10px;color:#475569;line-height:1.5}.gr-f{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gr-f label{display:grid;gap:4px;font:700 12px Poppins,Arial;color:#334155}.gr-f label.w{grid-column:1/-1}.gr-f input,.gr-f textarea{border:1.5px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:500 14px Poppins,Arial;min-width:0}.gr-f textarea{min-height:70px;resize:vertical}.gr-pr{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}.gr-pr div{background:#f8fafc;border-radius:12px;padding:12px;display:grid;gap:6px}.gr-pr b{color:#0b1a3a}.gr-pr small{color:#64748b}.gr-out{white-space:pre-wrap;background:#0b1a3a;color:#e2e8f0;border-radius:12px;padding:12px;font:500 12.5px/1.5 ui-monospace,Consolas,monospace;max-height:260px;overflow:auto;margin-top:10px}.gr-note{font-size:12px;color:#64748b}@media(max-width:640px){.gr-f{grid-template-columns:1fr}}`;

const STEPS = [['page', 'Brand page here'], ['usa', 'Free USA listing'], ['co', 'Colorado listing'], ['pr', 'Press release'], ['stl', 'Speed to lead']];
const done = () => { try { return JSON.parse(localStorage.getItem('aou_grow_done') || '{}'); } catch (e) { return {}; } };
const mark = (k) => { const d = done(); d[k] = Date.now(); try { localStorage.setItem('aou_grow_done', JSON.stringify(d)); } catch (e) { } };

export function releaseText(f) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const place = f.city ? f.city.toUpperCase() + ' — ' : '';
  return [
    f.headline || `${f.company || 'Our company'} announces [your news]`,
    f.summary ? '\n' + f.summary : '',
    `\n${place}${date} — ${f.lede || (f.company || 'The company') + ' today announced [what is new, who it helps, and when it is available].'}`,
    f.quote ? `\n"${f.quote}" said ${f.who || '[name, title]'}.` : '',
    `\nAbout ${f.company || '[company]'}\n${f.about || '[One short paragraph: what you do, where, since when.]'}`,
    f.website ? `\nWebsite: ${f.website}` : '',
    `\nMedia contact: ${f.contact || '[name, email, phone]'}`,
    '\n###',
  ].filter(Boolean).join('\n');
}

async function myBrand(F3) {
  try { const me = F3.getMe && F3.getMe(); if (!me || !F3.live) return null; const pages = (F3.myPages && F3.myPages()) || []; const slug = (() => { try { return localStorage.getItem('aou_actas'); } catch (e) { return null; } })() || (pages[0] && pages[0].slug); if (!slug) return null; const { data } = await F3.sb.from('pages').select('slug,name,tagline,about,website,location').eq('slug', slug).maybeSingle(); return data || null; } catch (e) { return null; }
}

export async function growView(body, F3) {
  if (!document.getElementById('aou-grow-css')) { const s = document.createElement('style'); s.id = 'aou-grow-css'; s.textContent = GROW_CSS; document.head.appendChild(s); }
  const me = F3.getMe && F3.getMe(); const d = done();
  body.innerHTML = `<div class="gr-wrap">
  <section class="gr-hero"><h2>Grow your business from allofus.one</h2><p>Your Brand page here is free. These are the tools our team runs to get local businesses found, talked about and answered fast. Start anywhere; check off what you have done.</p><div class="gr-steps" role="list">${STEPS.map(([k, n]) => `<button type="button" role="listitem" data-step="${k}" class="${d[k] ? 'done' : ''}" aria-pressed="${d[k] ? 'true' : 'false'}">${d[k] ? '✓ ' : ''}${esc(n)}</button>`).join('')}</div></section>
  <section class="gr-card"><h3>1. Your Brand page on allofus.one</h3><p>Logo, cover, services, hours, FAQ, call and website buttons, and posts your followers see in their feed, newest first. Free.</p><div class="ci-row" style="display:flex;gap:8px;flex-wrap:wrap"><a class="fl-btn p" href="/?v=brand">${me ? 'Open my Brand page' : 'Build a free Brand page'}</a><button class="fl-btn" type="button" data-runad style="border-color:#16a34a;color:#15803d">📣 Run an ad · from $19</button><a class="fl-btn" href="/?v=marketing">Marketing dash</a><a class="fl-btn" href="/boost/">searchBOOST ad maker</a><a class="fl-btn" href="/?g=general">Post in the Trading Post</a></div><p class="gr-note" style="margin:8px 0 0">Ads here reach only members who allow them: labeled Sponsored, rated G, no tracking. One payment, no auto-renew.</p></section>
  <section class="gr-grid">${TOOLS.map(t => `<article class="gr-c" data-k="${t.k}" style="--c:${t.color}"><span class="t">${esc(t.tag)}</span><h3>${esc(t.name)}</h3><p>${esc(t.body)}</p><div class="b">${out(t.main[0], esc(t.main[1]), 'fl-btn p', t.k)}${t.alt ? out(t.alt[0], esc(t.alt[1]), 'fl-btn', t.k + '-alt') : ''}</div></article>`).join('')}</section>
  <section class="gr-card" id="pr"><h3>2. Launch a press release</h3><p>Fill this in once. We turn it into a clean release draft, copy it for you, and open the press site you pick. (Those sites cannot receive text from another site, so you paste it in: one tap.)</p>
   <div class="gr-f"><label>Company<input data-f="company" maxlength="80"></label><label>Website<input data-f="website" maxlength="200" placeholder="https://"></label><label>City, State<input data-f="city" maxlength="60" placeholder="Denver, CO"></label><label>Quote from<input data-f="who" maxlength="80" placeholder="Name, title"></label><label class="w">Headline<input data-f="headline" maxlength="120" placeholder="What is new, in one line"></label><label class="w">Summary (1-2 sentences)<textarea data-f="summary" maxlength="400"></textarea></label><label class="w">First paragraph: who, what, when, where, why<textarea data-f="lede" maxlength="900"></textarea></label><label class="w">Quote<textarea data-f="quote" maxlength="400"></textarea></label><label class="w">About the company<textarea data-f="about" maxlength="600"></textarea></label><label class="w">Media contact (shown in the release you paste; we do not store it on our server)<input data-f="contact" maxlength="160"></label></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="fl-btn p" type="button" data-copy>Copy my release</button><button class="fl-btn" type="button" data-announce>Announce it on my allofus feed</button></div><div class="gr-out" data-prev hidden></div>
   <div class="gr-pr">${PR_SITES.map((p, i) => `<div><b>${esc(p.name)}</b><small>${esc(p.note)}</small>${out(p.url, esc(p.cta), i ? 'fl-btn' : 'fl-btn p', 'pr-' + i)}</div>`).join('')}</div>
   <p class="gr-note">Your draft is saved on this device only.</p></section>
  <section class="gr-card"><h3>Want it done for you?</h3><p>Call ${PHONE} or email info@eyetoad.com. A real person answers. Office: 1001 Bannock St #660, Denver.</p></section></div>`;
  { const ra = $('[data-runad]', body); if (ra) ra.onclick = async () => { try { const AD = await import('./aou-ads.js'); AD.openComposer({ sb: F3.sb, me, toast: F3.toast, pages: (F3.myPages && F3.myPages()) || [] }); } catch (e) { (F3.toast || alert)('Could not open the ad composer.'); } }; }
  const KEY = 'aou_pr_draft'; let f = {}; try { f = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
  const b = await myBrand(F3); if (b) { f.company = f.company || b.name || ''; f.website = f.website || b.website || ''; f.city = f.city || b.location || ''; f.about = f.about || b.about || b.tagline || ''; }
  $$('[data-f]', body).forEach(el => { el.value = f[el.dataset.f] || ''; el.oninput = () => { f[el.dataset.f] = el.value; try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) { } }; });
  const prev = $('[data-prev]', body);
  $('[data-copy]', body).onclick = async () => { const t = releaseText(f); prev.hidden = false; prev.textContent = t; try { await navigator.clipboard.writeText(t); (F3.toast || alert)('Copied. Now open a press site below and paste it in.'); } catch (e) { (F3.toast || alert)('Select the text below and copy it.'); } mark('pr'); };
  $('[data-announce]', body).onclick = () => { if (!F3.composeShare) return; const t = (f.headline || '') + (f.summary ? '\n' + f.summary : ''); F3.composeShare(f.website || 'https://allofus.one/', t.trim() || 'News from ' + (f.company || 'us')); };
  $$('.gr-c', body).forEach(a => a.addEventListener('click', (e) => { if (e.target.closest('a') && STEPS.some(s => s[0] === a.dataset.k)) mark(a.dataset.k); }));
  $$('[data-step]', body).forEach(btn => btn.onclick = () => { const k = btn.dataset.step; const dd = done(); if (dd[k]) delete dd[k]; else dd[k] = Date.now(); try { localStorage.setItem('aou_grow_done', JSON.stringify(dd)); } catch (e) { } btn.classList.toggle('done', !!dd[k]); btn.setAttribute('aria-pressed', dd[k] ? 'true' : 'false'); btn.textContent = (dd[k] ? '✓ ' : '') + (STEPS.find(s => s[0] === k) || [, ''])[1]; });
}

/* a compact launchpad card for other pages (searchBOOST, Brand page manage bar) */
export function growCardHTML() {
  return `<div class="gr-mini" style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:14px;font-family:Poppins,Arial,sans-serif"><b style="color:#0b1a3a">Grow your business</b><p style="margin:4px 0 10px;color:#475569;font-size:13px">Free listings, a press release builder, 60-second AI follow-up for new inquiries, and a 3D storefront.</p><a class="fl-btn p sm" href="/?v=grow">Open the launchpad</a></div>`;
}

/* ============================================================
   allofus.one · Global Match 2.0 (v29, Oct 25 2026) · runs /match/
   • Two-sided composer (I need | I have) with the Match Shield screening as you type (js/aou-match-safety.js)
   • "Tidy with AI": the match-ai Edge Function turns one sentence into a clean card (falls back to a quick local tidy)
   • Live board: needs left, haves right, filters, and threads drawn between cards that could match
   • Your posts: status (open / held / removed and why), best matches for each, mark matched / close
   Works before supabase/_parts/v29-match.sql runs (new columns are dropped from the insert and retried).
   ============================================================ */
import { CONFIG } from './aou-config.js';
import { screen, STRIKE_TEXT } from './aou-match-safety.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (t) => { const s = (Date.now() - new Date(t).getTime()) / 1000; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; };
const toast = (m, ms = 3200) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

const TOPICS = [['things', 'Things'], ['rides', 'Rides'], ['skills', 'Skills + lessons'], ['time', 'Time + help'], ['space', 'Space + storage'], ['work', 'Work + gigs'], ['food', 'Food'], ['pets', 'Pets'], ['kids', 'Kids + family'], ['tech', 'Tech help'], ['home', 'Home + repairs'], ['health', 'Health support'], ['other', 'Something else']];
const TOPIC = Object.fromEntries(TOPICS);
const XLBL = { give: 'Free', sell: 'For sale', trade: 'Trade', lend: 'Lend', teach: 'Teach', volunteer: 'Volunteer', free: 'Free', buy: 'Will pay', borrow: 'Borrow', swap: 'Swap', hire: 'Hire', learn: 'Learn' };
const XGROUP = { give: 'free', free: 'free', sell: 'money', buy: 'money', lend: 'lend', borrow: 'lend', trade: 'trade', swap: 'trade', teach: 'learn', learn: 'learn', hire: 'work', volunteer: 'work' };
// which have-exchange answers which need-exchange (score bonus, never a filter)
const FITS = { free: ['give', 'volunteer'], buy: ['sell'], borrow: ['lend', 'give'], swap: ['trade'], hire: ['volunteer', 'sell', 'teach'], learn: ['teach', 'volunteer'] };
const RLBL = { nearby: 'Nearby', city: 'City', country: 'Country', world: 'Worldwide' };
const ULVL = { now: 0, week: 1, month: 2, anytime: 3 };
const PLACEHOLDERS = {
  need: ['a ride to the airport Friday 6am…', 'someone to teach me guitar…', 'a crib for a few months…', 'help moving a couch Saturday…', 'resume help, can trade Spanish lessons…', 'a quiet place to study…'],
  have: ["a kid's bike I don't need anymore…", 'Tuesday afternoons free to drive…', 'a truck for moving help…', 'Spanish lessons, happy to swap…', 'extra garden tomatoes…', 'a spare room for a week…'],
};
// small synonym map so "sofa" finds "couch" before the AI tags arrive
const SYN = [['couch', 'sofa', 'loveseat', 'sectional'], ['bike', 'bicycle', 'cycle'], ['ride', 'lift', 'drive', 'carpool', 'airport'], ['tutor', 'lesson', 'lessons', 'teach', 'learn', 'class'], ['laptop', 'computer', 'pc', 'macbook'], ['crib', 'cot', 'bassinet'], ['stroller', 'pram', 'buggy'], ['move', 'moving', 'movers', 'haul', 'truck'], ['room', 'space', 'stay', 'sublet', 'housing'], ['clothes', 'clothing', 'jacket', 'coat', 'shoes'], ['job', 'work', 'gig', 'shift', 'hire'], ['phone', 'iphone', 'android', 'cell'], ['dog', 'puppy', 'dogsit', 'walker'], ['cat', 'kitten', 'catsit'], ['food', 'meal', 'meals', 'groceries'], ['resume', 'cv', 'interview'], ['guitar', 'piano', 'music', 'drums'], ['fix', 'repair', 'handyman', 'plumbing', 'electric'], ['garden', 'yard', 'lawn', 'mow']];
const SYNI = new Map(); SYN.forEach((g, i) => g.forEach((w) => SYNI.set(w, 'syn' + i)));
const STOP = new Set(['need', 'have', 'want', 'with', 'some', 'help', 'used', 'free', 'from', 'that', 'this', 'your', 'about', 'please', 'looking', 'anyone', 'someone', 'would', 'could', 'really', 'good', 'great', 'thanks', 'for', 'the', 'and', 'any', 'can', 'will', 'just', 'like', 'very', 'new', 'old', 'one', 'two', 'get', 'got', 'its', 'our']);
const words = (s) => { const out = new Set(); String(s || '').toLowerCase().split(/[^a-z0-9]+/).forEach((w) => { if (w.length < 3 || STOP.has(w)) return; w = w.replace(/(ies)$/, 'y').replace(/(?<=[^s])s$/, ''); out.add(SYNI.get(w) || w); }); return out; };
const sameCity = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();

function score(need, have) {
  const a = words([need.title, need.details, (need.tags || []).join(' ')].join(' ')), b = words([have.title, have.details, (have.tags || []).join(' ')].join(' '));
  let overlap = 0; a.forEach((w) => { if (b.has(w)) overlap++; });
  if (!overlap && !(need.topic && need.topic === have.topic && need.topic !== 'other')) return 0;
  let s = overlap * 4;
  if (need.topic && need.topic === have.topic) s += 2;
  if (need.exchange && (FITS[need.exchange] || []).includes(have.exchange)) s += 2;
  if (sameCity(need.city, have.city)) s += 3; else if (need.reach === 'world' || have.reach === 'world') s += 1;
  if (need.user === have.user) return 0;
  return overlap ? s : s * 0.4;
}

let sb = null, me = null, POSTS = [], NAMES = new Map();
const side = (k) => ({ t: $('#t-' + k), k: $('#k-' + k), x: $('#x-' + k), c: $('#c-' + k), r: $('#r-' + k), u: $('#u-' + k), s: $('#s-' + k), ai: $(`[data-ai=${k}]`), go: $(`[data-go=${k}]`) });

/* ---------- shield meter ---------- */
const ICON = { shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.4 2.4L15.5 10"/></svg>', warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M12 8v5M12 16.5v.5"/></svg>', block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>' };
function meter(k) {
  const S = side(k), text = [S.t.value, S.c.value].join(' ').trim();
  if (!text) { S.s.className = 'shield idle'; S.s.innerHTML = ICON.shield + '<span>Match Shield is on. Every post is checked before anyone sees it.</span>'; S.go.disabled = false; return { level: 'ok', hits: [] }; }
  const r = screen(text);
  if (r.level === 'block') { S.s.className = 'shield block'; S.s.innerHTML = ICON.block + `<span><b>Blocked: ${esc(r.hits.filter((h) => h.level === 'block').map((h) => h.label).join(', '))}.</b> ${esc(STRIKE_TEXT)}</span>`; S.go.disabled = true; }
  else if (r.level === 'warn') { S.s.className = 'shield warn'; S.s.innerHTML = ICON.warn + `<span><b>Heads-up:</b> ${esc(r.hits.map((h) => h.label).join('; '))}. You can still post; keep payments and contact inside allofus.</span>`; S.go.disabled = false; }
  else { S.s.className = 'shield ok'; S.s.innerHTML = ICON.shield + '<span>Looks good. The AI safety reader checks it again after you post.</span>'; S.go.disabled = false; }
  return r;
}

/* ---------- live preview across the seam ---------- */
function preview() {
  const tool = $('#tool'), pv = $('#preview'); const out = [];
  for (const k of ['need', 'have']) {
    const S = side(k); const txt = S.t.value.trim(); if (txt.length < 4 || screen(txt).level === 'block') continue;
    const mine = { kind: k, title: txt, details: '', topic: S.k.value, exchange: S.x.value, city: S.c.value, reach: S.r.value, user: me && me.id };
    const other = POSTS.filter((p) => p.kind !== k).map((p) => ({ p, s: k === 'need' ? score(mine, p) : score(p, mine) })).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, 4);
    if (other.length) out.push({ k, other });
  }
  tool.classList.toggle('live', out.length > 0);
  if (!out.length) { pv.classList.remove('on'); pv.innerHTML = ''; return; }
  pv.classList.add('on');
  pv.innerHTML = out.map(({ k, other }) => `<div><b>${other.length} possible ${k === 'need' ? 'have' : 'need'}${other.length > 1 ? 's' : ''}</b> on the board already match your ${k}:<div class="pv">${other.map(({ p }) => `<a href="#p-${p.id}" data-jump="${p.id}">${esc(p.title.slice(0, 48))}${p.city ? ' · ' + esc(p.city) : ''}</a>`).join('')}</div></div>`).join('');
}

/* ---------- AI tidy ---------- */
const LOCAL_TOPIC = [[/\b(ride|lift|airport|drive|carpool)\b/, 'rides'], [/\b(lesson|teach|tutor|learn|class|coach)\b/, 'skills'], [/\b(job|gig|shift|hire|work)\b/, 'work'], [/\b(room|space|storage|garage|stay|sublet)\b/, 'space'], [/\b(dog|cat|pet|puppy|kitten)\b/, 'pets'], [/\b(baby|kid|crib|stroller|toddler|school)\b/, 'kids'], [/\b(laptop|computer|phone|wifi|printer|tech)\b/, 'tech'], [/\b(fix|repair|plumb|paint|fence|roof|yard|lawn|garden)\b/, 'home'], [/\b(food|meal|groceries|cook|bake)\b/, 'food'], [/\b(time|help|visit|company|errand)\b/, 'time']];
function localTidy(k, text) {
  const t = text.replace(/\s+/g, ' ').trim(), low = t.toLowerCase();
  const title = (t.charAt(0).toUpperCase() + t.slice(1)).replace(/[.!…]+$/, '').slice(0, 80);
  const topic = (LOCAL_TOPIC.find(([rx]) => rx.test(low)) || [0, 'things'])[1];
  let exchange = k === 'need' ? 'free' : 'give';
  if (k === 'have') { if (/\b(sell|\$\d|price|obo)\b/.test(low)) exchange = 'sell'; else if (/\b(trade|swap)\b/.test(low)) exchange = 'trade'; else if (/\b(lend|borrow|loan)\b/.test(low)) exchange = 'lend'; else if (/\b(teach|lesson|tutor)\b/.test(low)) exchange = 'teach'; else if (/\b(volunteer|free time|happy to help)\b/.test(low)) exchange = 'volunteer'; }
  else { if (/\b(pay|buy|\$\d)\b/.test(low)) exchange = 'buy'; else if (/\b(borrow|loan)\b/.test(low)) exchange = 'borrow'; else if (/\b(trade|swap)\b/.test(low)) exchange = 'swap'; else if (/\b(hire|paid)\b/.test(low)) exchange = 'hire'; else if (/\b(learn|lesson|teach me)\b/.test(low)) exchange = 'learn'; }
  const urgency = /\b(today|tonight|asap|now|urgent)\b/.test(low) ? 'now' : /\b(tomorrow|this week|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b/.test(low) ? 'week' : 'anytime';
  return { title, details: '', topic, exchange, urgency, tags: [...words(t)].filter((w) => !w.startsWith('syn')).slice(0, 8) };
}
const AITAGS = { need: [], have: [] };
async function tidy(k) {
  const S = side(k), text = S.t.value.trim(); if (text.length < 3) { S.t.focus(); toast('Write a few words first.'); return; }
  if (screen(text).level === 'block') { meter(k); return; }
  S.ai.disabled = true; const label = S.ai.innerHTML; S.ai.lastChild.textContent = 'Tidying…';
  let card = null, safety = null, used = 'ai';
  try {
    if (!sb) throw new Error('offline');
    const { data, error } = await sb.functions.invoke('match-ai', { body: { mode: 'parse', text, side: k } });
    if (error || !data || !data.card) throw error || new Error('no card');
    card = data.card; safety = data.safety;
  } catch (e) { card = localTidy(k, text); used = 'local'; }
  S.ai.disabled = false; S.ai.innerHTML = label;
  if (safety && safety.verdict === 'block') { S.s.className = 'shield block'; S.s.innerHTML = ICON.block + `<span><b>The AI safety reader blocked this.</b> ${esc(safety.reason || '')} ${esc(STRIKE_TEXT)}</span>`; S.go.disabled = true; return; }
  S.t.value = card.title + (card.details ? '. ' + card.details : '');
  if (TOPIC[card.topic]) S.k.value = card.topic;
  if ([...S.x.options].some((o) => o.value === card.exchange)) S.x.value = card.exchange;
  if (card.urgency && ULVL[card.urgency] !== undefined) S.u.value = card.urgency;
  if (card.reach === 'world') S.r.value = 'world';
  AITAGS[k] = (card.tags || []).slice(0, 12);
  meter(k); preview();
  if (safety && safety.verdict === 'hold') { S.s.className = 'shield warn'; S.s.innerHTML = ICON.warn + `<span><b>Heads-up from the AI reader:</b> ${esc(safety.reason || 'a person will look at this before it goes live.')}</span>`; }
  toast(used === 'ai' ? 'Tidied. Check it, then post.' : 'Tidied (quick mode). Check it, then post.');
}

/* ---------- posting ---------- */
async function post(k) {
  const S = side(k), text = S.t.value.trim();
  if (text.length < 3) { S.t.focus(); toast('Say what you ' + k + ' in a few words.'); return; }
  if (meter(k).level === 'block') return;
  const draft = { k, text, topic: S.k.value, exchange: S.x.value, city: S.c.value, reach: S.r.value, urgency: S.u.value, tags: AITAGS[k] };
  if (!me) { store.set('aou_match_draft', draft); try { localStorage.setItem('aou_next', '/match/'); } catch (e) { } location.href = '/?auth=join'; return; }
  const parts = text.split(/(?<=[.!?])\s+/); const title = parts[0].replace(/[.!?]+$/, '').slice(0, 90); const details = parts.slice(1).join(' ').slice(0, 1000) || null;
  if (title.length < 2) { toast('A few more words, please.'); return; }
  const base = { user_id: me.id, user_name: me.name, kind: k, category: ['skills', 'time', 'work', 'rides', 'tech', 'home', 'health'].includes(draft.topic) ? 'service' : 'item', title, details, city: draft.city.trim() || null };
  const full = Object.assign({}, base, { topic: draft.topic, exchange: draft.exchange, reach: draft.reach, urgency: draft.urgency, tags: draft.tags || [] });
  S.go.disabled = true; const old = S.go.textContent; S.go.textContent = 'Posting…';
  let res = await sb.from('match_posts').insert(full).select().single();
  if (res.error && /column|schema cache|topic|exchange|reach|urgency|tags/i.test(res.error.message || '')) res = await sb.from('match_posts').insert(base).select().single();
  S.go.disabled = false; S.go.textContent = old;
  if (res.error) {
    const m = res.error.message || ''; if (/MATCH_PAUSED/.test(m)) { modal('Posting is paused', `<p>${esc(m.replace(/^.*MATCH_PAUSED:\s*/, ''))}</p><p>If you think this is a mistake, call <a href="tel:18004818638">1-800-481-8638</a>.</p>`); return; }
    if (/adult|row-level|policy/i.test(m)) { modal('One quick step first', '<p>Global Match is for adults. Open your feed once and confirm your date of birth, then come back and post.</p><p><a class="sbtn p" href="/?v=u">Confirm on my profile</a></p>'); return; }
    toast('Could not post: ' + m.slice(0, 120)); return;
  }
  const row = norm(res.data);
  if (row.status === 'removed') { modal('This post was blocked', `<p><b>The Match Shield stopped it</b> and recorded a strike on this account.</p><p>${esc(STRIKE_TEXT)}</p>`); S.t.value = ''; meter(k); return; }
  S.t.value = ''; AITAGS[k] = []; store.set('aou_match_draft', null); meter(k);
  POSTS.unshift(row); NAMES.set(me.id, { name: me.name, username: me.username }); drawBoard(); drawMine();
  const best = POSTS.filter((p) => p.kind !== k).map((p) => ({ p, s: k === 'need' ? score(row, p) : score(p, row) })).filter((x) => x.s >= 4).sort((a, b) => b.s - a.s)[0];
  if (best) weHaveAMatch(row, best.p); else toast('Posted. We will keep looking and show matches under Your posts.', 4200);
}
function weHaveAMatch(mine, other) {
  const n = mine.kind === 'need' ? mine : other, h = mine.kind === 'need' ? other : mine;
  modal('We may have a match', `<div class="matchwow"><p>Your ${mine.kind} lines up with a ${other.kind} already on the board.</p><div class="pair"><div style="--k:var(--need)">${esc(n.title)}</div><i>⇄</i><div style="--k:var(--have)">${esc(h.title)}</div></div>${dmLink(other, 'sbtn p')}</div>`);
}
function dmLink(p, cls = 'sbtn') { const u = NAMES.get(p.user); const who = u && u.username ? u.username : ''; const label = p.kind === 'need' ? 'I can help' : 'I want this'; return who ? `<a class="${cls}" href="/?v=dm&with=${encodeURIComponent(who)}" data-dm>${label} · message</a>` : `<span class="${cls} q">Message unavailable</span>`; }
function modal(title, html) { const w = document.createElement('div'); w.className = 'modal'; w.innerHTML = `<div role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${html}<p style="margin-top:16px"><button class="sbtn" data-x>Close</button></p></div>`; document.body.appendChild(w); const x = () => w.remove(); $('[data-x]', w).onclick = x; w.onclick = (e) => { if (e.target === w) x(); }; document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { x(); document.removeEventListener('keydown', k); } }); $('[data-x]', w).focus(); }

/* ---------- board ---------- */
const norm = (r) => ({ id: r.id, user: r.user_id, name: r.user_name, kind: r.kind, cat: r.category, title: r.title || '', details: r.details || '', city: r.city || '', status: r.status || 'open', topic: r.topic || (r.category === 'service' ? 'time' : 'things'), exchange: r.exchange || (r.kind === 'need' ? 'free' : 'give'), reach: r.reach || 'city', urgency: r.urgency || 'anytime', tags: r.tags || [], at: r.created_at, ai: r.ai || null, screen: r.screen || null });
function filtered() {
  const q = ($('#q').value || '').trim().toLowerCase(), fk = $('#fk').value, fx = $('#fx').value, fr = $('#fr').value, mycity = (me && me.city) || store.get('aou_match_city', '');
  if (q && screen(q).level === 'block') return null;
  const qw = q ? words(q) : null;
  let list = POSTS.filter((p) => p.status === 'open' && (!fk || p.topic === fk) && (!fx || XGROUP[p.exchange] === fx) && (!fr || (fr === 'world' ? p.reach === 'world' : sameCity(p.city, mycity) || p.reach === 'world')));
  if (qw) list = list.filter((p) => { const w = words([p.title, p.details, p.city, p.tags.join(' ')].join(' ')); let hit = false; qw.forEach((x) => { if (w.has(x)) hit = true; }); return hit || (p.title + ' ' + p.details + ' ' + p.city).toLowerCase().includes(q); });
  if ($('#fs').value === 'urgent') list = list.slice().sort((a, b) => (ULVL[a.urgency] ?? 3) - (ULVL[b.urgency] ?? 3) || new Date(b.at) - new Date(a.at));
  return list;
}
function cardHTML(p) {
  const u = NAMES.get(p.user); const who = u ? (u.name || '@' + u.username) : (p.name || 'A member');
  const mineP = me && p.user === me.id;
  return `<article class="card ${p.kind}" id="p-${p.id}" data-id="${p.id}"><p class="t">${esc(p.title)}</p>${p.details ? `<p class="d">${esc(p.details.slice(0, 220))}</p>` : ''}<div class="meta"><span>${esc(TOPIC[p.topic] || 'Other')}</span><span>${esc(XLBL[p.exchange] || '')}</span>${p.city ? `<span>${esc(p.city)}</span>` : ''}<span>${esc(RLBL[p.reach] || '')}</span>${p.urgency === 'now' ? '<span style="border-color:#f97316;color:#c2410c">Urgent</span>' : ''}<span>${ago(p.at)}</span></div><div class="row"><span class="who">${esc(who)}</span>${mineP ? '<span class="sbtn q">Your post</span>' : `${dmLink(p, 'sbtn p')}<button class="sbtn q" data-report="${p.id}" aria-label="Report this post">Report</button>`}</div></article>`;
}
function drawBoard() {
  const list = filtered(); const warn = $('#fwarn');
  if (list === null) {
    warn.classList.add('on'); warn.textContent = 'That search is blocked by the Match Shield. ' + STRIKE_TEXT;
    $('#l-need').innerHTML = $('#l-have').innerHTML = ''; $('#n-need').textContent = $('#n-have').textContent = '';
    if (sb && me) sb.rpc('match_search_flag', { p_q: $('#q').value.slice(0, 200) }).then(() => { }, () => { });
    return;
  }
  warn.classList.remove('on');
  for (const k of ['need', 'have']) {
    const arr = list.filter((p) => p.kind === k).slice(0, 60);
    $('#n-' + k).textContent = arr.length ? arr.length + ' open' : '';
    $('#l-' + k).innerHTML = arr.map(cardHTML).join('') || `<div class="empty">${POSTS.length ? 'Nothing here with these filters.' : `Be the first ${k}. Early posts get seen first.`}<br><a href="#tool" data-side-jump="${k}">Post a ${k} →</a></div>`;
  }
  $('#threads').innerHTML = '';
}
/* threads: hover a card, draw curves to its best matches on the other side */
function threads(card) {
  const svg = $('#threads'), bd = $('#bd'); svg.innerHTML = ''; $$('.card.hot,.card.src', bd).forEach((c) => c.classList.remove('hot', 'src')); bd.classList.remove('focus');
  if (!card || innerWidth < 761) return;
  const p = POSTS.find((x) => String(x.id) === card.dataset.id); if (!p) return;
  const others = $$(`#l-${p.kind === 'need' ? 'have' : 'need'} .card`, bd).map((el) => ({ el, q: POSTS.find((x) => String(x.id) === el.dataset.id) })).filter((o) => o.q).map((o) => ({ ...o, s: p.kind === 'need' ? score(p, o.q) : score(o.q, p) })).filter((o) => o.s >= 3).sort((a, b) => b.s - a.s).slice(0, 4);
  if (!others.length) return;
  bd.classList.add('focus'); card.classList.add('src');
  const B = bd.getBoundingClientRect(), A = card.getBoundingClientRect();
  const ax = p.kind === 'need' ? A.right - B.left : A.left - B.left, ay = A.top - B.top + A.height / 2;
  svg.innerHTML = `<defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="#ff5a7a"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#19e3c1"/></linearGradient></defs>` + others.map(({ el }) => { el.classList.add('hot'); const R = el.getBoundingClientRect(); const bx = p.kind === 'need' ? R.left - B.left : R.right - B.left, by = R.top - B.top + R.height / 2; const mx = (ax + bx) / 2; return `<path d="M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}" stroke="url(#tg)"/>`; }).join('');
}

/* ---------- your posts ---------- */
function drawMine() {
  const band = $('#mine-band'); if (!me) { band.hidden = true; return; }
  const mine = POSTS.filter((p) => p.user === me.id).concat(MINE_HIDDEN).filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i);
  if (!mine.length) { band.hidden = true; return; } band.hidden = false;
  $('#mine').innerHTML = mine.map((p) => {
    const why = p.status === 'removed' ? 'Blocked by the Match Shield (a strike was recorded).' : p.status === 'held' ? ('Held for a person to review' + (p.ai && p.ai.reason ? ': ' + p.ai.reason : '.')) : '';
    const cands = p.status === 'open' ? POSTS.filter((q) => q.kind !== p.kind && q.status === 'open').map((q) => ({ q, s: p.kind === 'need' ? score(p, q) : score(q, p) })).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, 3) : [];
    return `<article class="card ${p.kind}"><div class="row" style="margin:0 0 6px"><span class="st ${p.status}">${p.status}</span><span class="who">${p.kind === 'need' ? 'I need' : 'I have'} · ${ago(p.at)}</span></div><p class="t">${esc(p.title)}</p>${why ? `<p class="d">${esc(why)}</p>` : ''}${p.status === 'open' ? `<div class="cand">${cands.length ? '<b>Best matches:</b> ' + cands.map(({ q }) => `<a href="#p-${q.id}" data-jump="${q.id}">${esc(q.title.slice(0, 50))}</a>`).join(' · ') : 'No match yet. We keep looking; check back or share your post.'}</div><div class="row"><button class="sbtn p" data-status="matched" data-pid="${p.id}">Mark matched</button><button class="sbtn" data-status="closed" data-pid="${p.id}">Close</button><button class="sbtn q" data-share="${p.id}">Share</button></div>` : ''}</article>`;
  }).join('');
}
let MINE_HIDDEN = [];

/* ---------- boot ---------- */
async function load() {
  if (!sb) return;
  const { data } = await sb.from('match_posts').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(300);
  POSTS = (data || []).map(norm);
  if (me) { const { data: own } = await sb.from('match_posts').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50); MINE_HIDDEN = (own || []).map(norm).filter((p) => p.status !== 'open'); }
  const ids = [...new Set(POSTS.map((p) => p.user))].filter((id) => !NAMES.has(id));
  for (let i = 0; i < ids.length; i += 100) { const { data: pr } = await sb.from('profiles').select('id,username,display_name').in('id', ids.slice(i, i + 100)); (pr || []).forEach((r) => NAMES.set(r.id, { name: r.display_name, username: r.username })); }
}
async function stats() {
  const el = $('#stats'); let s = null;
  try { const { data } = await sb.rpc('match_stats'); s = data; } catch (e) { }
  if (!s) { const n = POSTS.filter((p) => p.kind === 'need').length, h = POSTS.length - n; s = { needs: n, haves: h, matches: 0, today: POSTS.filter((p) => Date.now() - new Date(p.at) < 864e5).length }; }
  const total = (s.needs || 0) + (s.haves || 0);
  el.innerHTML = total >= 20 ? `<div><b>${s.needs}</b>open needs</div><div><b>${s.haves}</b>open haves</div><div><b>${s.matches || 0}</b>matches made</div><div><b>${s.today || 0}</b>posted today</div>` : `<div class="early">Brand new and growing. Early posts get seen first, and every one is checked for safety.</div>`;
}
export async function bootMatch() {
  // selects + rotating placeholders
  const opts = TOPICS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  $('#k-need').innerHTML = opts; $('#k-have').innerHTML = opts; $('#fk').innerHTML = '<option value="">All kinds</option>' + opts;
  for (const k of ['need', 'have']) { let i = 0; setInterval(() => { const t = $('#t-' + k); if (document.activeElement !== t && !t.value) t.placeholder = PLACEHOLDERS[k][++i % PLACEHOLDERS[k].length]; }, 3200); }
  // phone tabs
  $$('.tabs button').forEach((b) => b.onclick = () => { $$('.tabs button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); $$('.side').forEach((s) => { s.hidden = s.dataset.side !== b.dataset.s; }); });
  for (const k of ['need', 'have']) { const S = side(k); let t = 0; const on = () => { meter(k); clearTimeout(t); t = setTimeout(preview, 250); }; S.t.addEventListener('input', on); S.c.addEventListener('input', on); [S.k, S.x, S.r].forEach((el) => el.addEventListener('change', preview)); S.ai.onclick = () => tidy(k); S.go.onclick = () => post(k); S.c.addEventListener('change', () => store.set('aou_match_city', S.c.value.trim())); meter(k); }
  // filters
  let ft = 0; ['#q', '#fk', '#fx', '#fr', '#fs'].forEach((s) => $(s).addEventListener(s === '#q' ? 'input' : 'change', () => { clearTimeout(ft); ft = setTimeout(drawBoard, s === '#q' ? 300 : 0); }));
  const bd = $('#bd'); bd.addEventListener('mouseover', (e) => { const c = e.target.closest('.card'); if (c && !c.classList.contains('src')) threads(c); }); bd.addEventListener('mouseleave', () => threads(null)); addEventListener('resize', () => threads(null));
  document.addEventListener('click', async (e) => {
    const j = e.target.closest('[data-jump]'); if (j) { e.preventDefault(); const c = document.getElementById('p-' + j.dataset.jump); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('hot'); setTimeout(() => c.classList.remove('hot'), 2200); } return; }
    const sj = e.target.closest('[data-side-jump]'); if (sj) { const b = $(`.tabs button[data-s=${sj.dataset.sideJump}]`); if (b) b.click(); setTimeout(() => $('#t-' + sj.dataset.sideJump).focus(), 400); return; }
    const dm = e.target.closest('[data-dm]'); if (dm && !me) { e.preventDefault(); try { localStorage.setItem('aou_next', '/match/'); } catch (x) { } location.href = '/?auth=join'; return; }
    const rp = e.target.closest('[data-report]'); if (rp) { const p = POSTS.find((x) => String(x.id) === rp.dataset.report); if (!me) { location.href = '/?auth=in'; return; } try { const SF = await import('./aou-safety.js'); await SF.report({ sb, me, kind: 'profile', id: p.user, owner: p.user, label: 'this Global Match post', preview: `Global Match #${p.id} (${p.kind}): ${p.title}` }); } catch (x) { toast('Could not open the report form. Email info@eyetoad.com.'); } return; }
    const st = e.target.closest('[data-status]'); if (st && sb && me) { const { error } = await sb.from('match_posts').update({ status: st.dataset.status }).eq('id', st.dataset.pid).eq('user_id', me.id); if (error) { toast('Could not update: ' + error.message); return; } const p = POSTS.find((x) => String(x.id) === st.dataset.pid); if (p) { p.status = st.dataset.status; MINE_HIDDEN.push(p); POSTS = POSTS.filter((x) => x !== p); } drawBoard(); drawMine(); toast(st.dataset.status === 'matched' ? 'Matched. That is the whole point. Thank you.' : 'Closed.'); return; }
    const sh = e.target.closest('[data-share]'); if (sh) { const p = POSTS.find((x) => String(x.id) === sh.dataset.share) || {}; const url = location.origin + '/match/#p-' + sh.dataset.share; const text = (p.kind === 'need' ? 'I need: ' : 'I have: ') + (p.title || '') + ' · Global Match on allofus.one'; if (navigator.share) navigator.share({ title: 'Global Match', text, url }).catch(() => { }); else { try { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copied.'); } catch (x) { } } }
  });
  const c0 = store.get('aou_match_city', ''); if (c0) { $('#c-need').value = $('#c-have').value = c0; }
  drawBoard();
  // Supabase (same origin as the feed, so the member's session is shared)
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY); try { (await import('./aou-safety.js')).guardClient(sb); } catch (e) { }
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      const { data: pr } = await sb.from('profiles').select('id,username,display_name').eq('id', session.user.id).maybeSingle();
      me = { id: session.user.id, name: (pr && (pr.display_name || pr.username)) || 'Member', username: pr && pr.username, city: '' };
      const chip = $('#me-chip'); chip.textContent = '@' + (me.username || 'me'); chip.href = '/?v=u';
      if (me.city && !c0) { $('#c-need').value = $('#c-have').value = me.city; }
    }
    await load(); drawBoard(); drawMine(); stats(); preview();
    // a draft saved before joining comes back
    const d = store.get('aou_match_draft', null);
    if (d && d.text) { const b = $(`.tabs button[data-s=${d.k}]`); if (b) b.click(); const S = side(d.k); S.t.value = d.text; S.k.value = d.topic; S.x.value = d.exchange; S.c.value = d.city || ''; S.r.value = d.reach; S.u.value = d.urgency; AITAGS[d.k] = d.tags || []; meter(d.k); preview(); if (me) { toast('Your ' + d.k + ' is ready. Press Post when you are happy with it.', 5000); S.go.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    if (location.hash.startsWith('#p-')) { const c = document.getElementById(location.hash.slice(1)); if (c) { c.scrollIntoView({ block: 'center' }); c.classList.add('hot'); } }
  } catch (e) { console.warn('match offline', e); $('#stats').innerHTML = '<div class="early">Could not reach the board. Check your connection and reload.</div>'; }
}

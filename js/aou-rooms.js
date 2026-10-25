/* ============================================================
   allofus.one · Rooms (v30, Oct 25 2026) · runs /chat/
   Old-school chat rooms, rebuilt: a themed room list with live head counts, grouped lines with screen-name colors,
   "has entered / left the room" door lines, /me actions, replies, own-line delete, Report, a People-here list with
   away messages and IM links, synthesized door chimes, text colors and original SVG faces.
   • Messages: public.hub_messages (+ v30 columns kind / reply_to / status). Realtime INSERT/UPDATE via postgres_changes.
   • Who's here / away / typing: private Realtime channel 'room:<slug>' (presence + broadcast), adults only (v27 policy).
   • Head counts: one private presence channel 'room:_lobby-directory' where every member tracks the room they are in.
   • Every line passes the Match Shield as you type (js/aou-match-safety.js) and again in the database (v30 room_guard).
   Works before supabase/_parts/v30-rooms-constellations.sql runs: falls back to the 8 seeded rooms and plain inserts.
   ============================================================ */
import { CONFIG } from './aou-config.js';
import { screen, STRIKE_TEXT } from './aou-match-safety.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const toast = (m, ms = 3400) => { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); };
const hm = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const full = (t) => new Date(t).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayKey = (t) => new Date(t).toDateString();
const dayLabel = (t) => { const d = new Date(t), n = new Date(); const y = new Date(n); y.setDate(n.getDate() - 1); if (d.toDateString() === n.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); };

/* ---------- rooms (fallback = the 8 seeded in v30) ---------- */
const SEED = [
  { slug: 'general', name: 'The Lobby', topic: 'Say hi. Everyone starts here.', theme: 'dawn', kind: 'lobby', sort: 1 },
  { slug: 'help', name: 'Help Desk', topic: 'Ask how anything on allofus works. Members and the team answer.', theme: 'paper', kind: 'topic', sort: 10 },
  { slug: 'kindness', name: 'Kindness Corner', topic: 'Good news, small wins, gratitude.', theme: 'aurora', kind: 'topic', sort: 20 },
  { slug: 'business', name: 'Shop Talk', topic: 'Owners, makers and side hustles trading notes.', theme: 'ember', kind: 'topic', sort: 30 },
  { slug: 'night-owls', name: 'Night Owls', topic: 'For the ones still up.', theme: 'dusk', kind: 'topic', sort: 40 },
  { slug: 'denver', name: 'Denver Live', topic: 'Colorado people, plans and places.', theme: 'forest', kind: 'topic', sort: 50 },
  { slug: 'creators', name: 'Studio', topic: 'Music, art, video, writing: share what you are making.', theme: 'ocean', kind: 'topic', sort: 60 },
  { slug: 'banquet', name: 'The Banquet Hall', topic: 'Big conversations, one table.', theme: 'ember', kind: 'topic', sort: 70 },
];
const THEMES = { dawn: ['#f0526e', '#fff1ec'], dusk: ['#6d43d0', '#f1edff'], ocean: ['#1d82c8', '#e9f5fd'], forest: ['#2f8f5b', '#eaf6ec'], ember: ['#e0672b', '#fff1e6'], aurora: ['#0fb39a', '#e6faf4'], paper: ['#14183a', '#f5f1e6'] };
const COLORS = [['ink', 'Ink'], ['coral', 'Coral'], ['teal', 'Teal'], ['gold', 'Honey'], ['plum', 'Plum'], ['ocean', 'Sky']];
const COLOR_OK = new Set(COLORS.map((c) => c[0]));
const COLOR_HEX = { ink: '#14183a', coral: '#c8304d', teal: '#08806e', gold: '#9a6200', plum: '#6d43d0', ocean: '#1d64b0' };
const NAME_COLORS = ['#c8304d', '#08806e', '#6d43d0', '#1d64b0', '#b4510f', '#a3376e', '#2f7d3a', '#8a5a00', '#0e7490', '#4338ca'];

/* ---------- icons (original line art) ---------- */
const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  rooms: S('<path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/>'),
  people: S('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17 14.2c1.9.5 3.1 2.1 3.5 4.8"/>'),
  shield: S('<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.4 2.4L15.5 10"/>'),
  warn: S('<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M12 8v5M12 16.5v.5"/>'),
  block: S('<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  face: S('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8.5 14.2c1 1.3 2.2 1.9 3.5 1.9s2.5-.6 3.5-1.9"/><path d="M9 9.5v1M15 9.5v1"/>'),
  send: S('<path d="M4 12h12M11 6l6 6-6 6"/><path d="M20 5v14"/>'),
  reply: S('<path d="M10 7L5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>'),
  trash: S('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>'),
  flag: S('<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  down: S('<path d="M12 5v13M6 12l6 6 6-6"/>'),
  chimeOn: S('<path d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v4L5 16h14l-1.5-3V9A5.5 5.5 0 0 0 12 3.5z"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M20 6.5c.8 1 1.2 2.2 1.2 3.5M4 6.5C3.2 7.5 2.8 8.7 2.8 10"/>'),
  chimeOff: S('<path d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v4L5 16h14l-1.5-3V9A5.5 5.5 0 0 0 12 3.5z"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M4 3l16 18"/>'),
  doorIn: S('<path d="M13 4h6v16h-6"/><path d="M3 12h11M10 8l4 4-4 4"/>'),
  doorOut: S('<path d="M11 4H5v16h6"/><path d="M10 12h11M17 8l4 4-4 4"/>'),
  spark: S('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  person: S('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>'),
  moon: S('<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>'),
};
const GLYPH = {
  general: '<path d="M6 21V4h9v17M3 21h18M12 12.5h.01M15 4l3.5 1.6V21"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5"/>',
  kindness: '<path d="M12 21v-8"/><path d="M12 13c0-4-3-6.5-7.5-6.5 0 4 3 6.5 7.5 6.5z"/><path d="M12 11c0-3.5 2.6-5.8 6.8-5.8 0 3.5-2.6 5.8-6.8 5.8z"/>',
  business: '<path d="M4.5 10v10h15V10M3 4h18l-1.3 6H4.3z"/><path d="M9.5 20v-5h5v5"/>',
  'night-owls': '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"/><path d="M17 3.2l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/>',
  denver: '<path d="M2 20l6.5-11 4 6.5 2.5-4L22 20z"/><path d="M7 11.5l1.5-2.5 1.6 2.6"/>',
  creators: '<path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7h2.2a4 4 0 0 0 4-4c0-4.2-3.9-7.4-8.8-7.4z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.3" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  banquet: '<path d="M2.5 12h19M5 12v8M19 12v8M8 16h8"/><circle cx="7" cy="7" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="7" r="2"/>',
  constellation: '<path d="M4 17l5-6 5 3 6-9"/><circle cx="4" cy="17" r="1.6"/><circle cx="9" cy="11" r="1.6"/><circle cx="14" cy="14" r="1.6"/><circle cx="20" cy="5" r="1.6"/>',
  topic: '<path d="M4 5h16v11H10l-5 4V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
};
const glyph = (r) => S(GLYPH[r.slug] || (r.kind === 'constellation' ? GLYPH.constellation : GLYPH.topic));

/* ---------- faces: 11 original line-drawn faces, typed as :code: ---------- */
const FB = (fill = '#ffd56b') => `<rect x="2.2" y="2.2" width="19.6" height="19.6" rx="7" fill="${fill}" stroke="#14183a" stroke-width="1.5"/>`;
const FACE_PARTS = {
  smile: FB() + '<circle cx="9" cy="10" r="1.2" fill="#14183a"/><circle cx="15" cy="10" r="1.2" fill="#14183a"/><path d="M8 14.2c1.1 1.6 2.4 2.4 4 2.4s2.9-.8 4-2.4" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  grin: FB() + '<path d="M7.5 10.6c.8-1.3 2.2-1.3 3 0M13.5 10.6c.8-1.3 2.2-1.3 3 0" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M7 13.5h10c0 2.9-2.2 4.8-5 4.8s-5-1.9-5-4.8z" fill="#fff" stroke="#14183a" stroke-width="1.4" stroke-linejoin="round"/><path d="M7.4 15.3h9.2" stroke="#14183a" stroke-width="1"/>',
  wink: FB() + '<circle cx="9" cy="10" r="1.2" fill="#14183a"/><path d="M13.6 10.2h3" stroke="#14183a" stroke-width="1.6" stroke-linecap="round"/><path d="M8.3 14.4c1.2 1.5 2.4 2.1 3.7 2.1 1.6 0 2.9-.8 3.9-2.4" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14.6 15.6c.3 1.3 1.4 1.7 2.1 1" stroke="#f0526e" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  laugh: FB() + '<path d="M7.4 10.5l1.6-1.6 1.6 1.6M13.4 10.5l1.6-1.6 1.6 1.6" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 13h9c0 3-2 5.2-4.5 5.2S7.5 16 7.5 13z" fill="#c8304d" stroke="#14183a" stroke-width="1.4" stroke-linejoin="round"/><path d="M4.6 11.5c-.6 1-.3 2 .5 2.1M19.4 11.5c.6 1 .3 2-.5 2.1" stroke="#1d82c8" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  wow: FB() + '<circle cx="9" cy="9.6" r="1.6" fill="#fff" stroke="#14183a" stroke-width="1.3"/><circle cx="15" cy="9.6" r="1.6" fill="#fff" stroke="#14183a" stroke-width="1.3"/><circle cx="9" cy="9.8" r=".6" fill="#14183a"/><circle cx="15" cy="9.8" r=".6" fill="#14183a"/><ellipse cx="12" cy="15.6" rx="2" ry="2.5" fill="#14183a"/>',
  sad: FB('#ffe39b') + '<path d="M7.6 8.6l2.6.9M16.4 8.6l-2.6.9" stroke="#14183a" stroke-width="1.4" stroke-linecap="round"/><circle cx="9.2" cy="11" r="1.1" fill="#14183a"/><circle cx="14.8" cy="11" r="1.1" fill="#14183a"/><path d="M8.6 17c.9-1.3 2.1-1.9 3.4-1.9s2.5.6 3.4 1.9" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M15.6 12.6c-.5.9-.5 1.7.2 2" stroke="#1d82c8" stroke-width="1.3" fill="none" stroke-linecap="round"/>',
  love: FB() + '<path d="M9 11.8L7 9.9a1.2 1.2 0 0 1 2-1.4 1.2 1.2 0 0 1 2 1.4zM15 11.8l-2-1.9a1.2 1.2 0 0 1 2-1.4 1.2 1.2 0 0 1 2 1.4z" fill="#f0526e" stroke="#c8304d" stroke-width=".8" stroke-linejoin="round"/><path d="M8.4 14.4c1 1.4 2.2 2.1 3.6 2.1s2.6-.7 3.6-2.1" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  cool: FB() + '<path d="M5.2 8.6h13.6v1.3c0 1.8-1.2 3-2.9 3h-.9c-1.4 0-2.3-.9-2.8-2.2h-.4c-.5 1.3-1.4 2.2-2.8 2.2h-.9c-1.7 0-2.9-1.2-2.9-3z" fill="#14183a"/><path d="M7.3 9.6l1.4 1.4M14.5 9.6l1.4 1.4" stroke="#7fd6c7" stroke-width="1" stroke-linecap="round"/><path d="M9.2 16.1c1.7.8 3.8.7 5.5-.6" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  think: FB() + '<path d="M7.6 8.2l2.4-.4M14 7.4l2.6.9" stroke="#14183a" stroke-width="1.4" stroke-linecap="round"/><circle cx="9" cy="10.4" r="1.1" fill="#14183a"/><circle cx="15" cy="10.4" r="1.1" fill="#14183a"/><path d="M9.5 15.6l4.8-.9" stroke="#14183a" stroke-width="1.5" stroke-linecap="round"/><path d="M15.5 18.6c1.6.2 2.8-.6 2.8-1.6s-1.1-1.3-2-.8" fill="#ffd56b" stroke="#14183a" stroke-width="1.3" stroke-linecap="round"/>',
  sleepy: FB('#ffe39b') + '<path d="M7.6 11h3M13.4 11h3" stroke="#14183a" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="12" cy="16" rx="1.4" ry="1.1" fill="#14183a"/><path d="M15.6 3.8h2.6l-2.6 2.6h2.6M19 1.6h1.6L19 3.2h1.6" stroke="#6d43d0" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  party: FB() + '<path d="M4.5 8.5L7 1.8l3.6 5.4z" fill="#f0526e" stroke="#14183a" stroke-width="1.2" stroke-linejoin="round"/><circle cx="9.5" cy="11" r="1.1" fill="#14183a"/><circle cx="15" cy="11" r="1.1" fill="#14183a"/><path d="M8.5 14.3c1 1.5 2.2 2.2 3.6 2.2s2.6-.7 3.6-2.2" stroke="#14183a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M18 4.5l.4 1M20.5 7l-1 .3M16.6 2.6l-.2 1" stroke="#0fb39a" stroke-width="1.3" stroke-linecap="round"/>',
};
const FACE_NAMES = { smile: 'smile', grin: 'big grin', wink: 'wink', laugh: 'laughing', wow: 'wow', sad: 'sad', love: 'love it', cool: 'cool', think: 'thinking', sleepy: 'sleepy', party: 'party' };
const faceSVG = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${FACE_PARTS[k]}</svg>`;

/* ---------- state ---------- */
let sb = null, me = null, ROOMS = SEED.slice(), ROOM = SEED[0];
let ROWS = [], BYID = new Map(), NAMES = new Map(), HAS_MORE = false, LOADING = false, ENTER_TOKEN = 0;
let chRoom = null, chDb = null, chDir = null;
let HERE = new Map(), KNOWN = new Map(), PRESENCE_READY = false, TYPING = new Map(), DIR = {}, ACTIVE = {};
let REPLY = null, COLOR = COLOR_OK.has(store.get('aou_rooms_color', 'ink')) ? store.get('aou_rooms_color', 'ink') : 'ink';
let AWAY = '', AUTO_AWAY = false, UNSEEN = 0, LAST_TYPING_SENT = 0, OFFLINE = false, NOT_READY = false;
const nameOf = (uid) => (NAMES.get(uid) || {}).name || 'Member';
const userOf = (uid) => (NAMES.get(uid) || {}).username || '';
const ucolor = (uid) => { let h = 0; for (const c of String(uid || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return NAME_COLORS[h % NAME_COLORS.length]; };
const initials = (n) => { const w = String(n || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || '')[1] || '')).toUpperCase(); };

/* ---------- sound: WebAudio, synthesized, never before a gesture ---------- */
let AC = null, GESTURE = false, MUTED = !!store.get('aou_rooms_mute', false), LAST_BLIP = 0;
const markGesture = () => { GESTURE = true; };
addEventListener('pointerdown', markGesture, { capture: true, passive: true }); addEventListener('keydown', markGesture, { capture: true });
function actx() {
  if (!GESTURE || MUTED) return null;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; }
}
function tone(c, f, t0, d, v, type = 'sine', f2 = 0) {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d * 0.6);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + d + 0.05);
}
const SND = {
  // a soft wooden knock and a rising third: "door opens"
  open() { const c = actx(); if (!c) return; const t = c.currentTime + 0.01; tone(c, 180, t, 0.08, 0.05, 'triangle', 120); tone(c, 587.33, t + 0.06, 0.55, 0.045); tone(c, 739.99, t + 0.16, 0.7, 0.04); tone(c, 1479.98, t + 0.16, 0.35, 0.006, 'triangle'); },
  // the same notes falling, then a soft latch: "door closes"
  close() { const c = actx(); if (!c) return; const t = c.currentTime + 0.01; tone(c, 739.99, t, 0.4, 0.035); tone(c, 554.37, t + 0.11, 0.55, 0.035); tone(c, 140, t + 0.36, 0.07, 0.045, 'triangle', 90); },
  blip() { const now = Date.now(); if (now - LAST_BLIP < 450) return; LAST_BLIP = now; const c = actx(); if (!c) return; const t = c.currentTime + 0.01; tone(c, 880, t, 0.11, 0.03, 'triangle', 1320); },
  sent() { const c = actx(); if (!c) return; const t = c.currentTime + 0.01; tone(c, 990, t, 0.08, 0.018, 'sine', 1180); },
};
function drawMute() { const b = $('#mute'); b.setAttribute('aria-pressed', String(!MUTED)); b.innerHTML = (MUTED ? ICON.chimeOff : ICON.chimeOn) + `<span class="sr">${MUTED ? 'Door chimes are off. Turn on' : 'Door chimes are on. Turn off'}</span>`; b.title = MUTED ? 'Chimes off' : 'Chimes on'; }

/* ---------- text: color prefix + faces, always escaped ---------- */
function parse(r) {
  let body = String(r.body || ''), kind = r.kind || 'say';
  if (/^\/me\s/i.test(body)) { kind = 'me'; body = body.replace(/^\/me\s+/i, ''); }
  let color = 'ink'; const m = /^\[c=([a-z]{2,8})\]\s?/.exec(body); if (m) { body = body.slice(m[0].length); if (COLOR_OK.has(m[1])) color = m[1]; }
  return { kind, color, text: body };
}
const fmt = (text) => esc(text).replace(/:([a-z]{2,8}):/g, (m0, k) => FACE_PARTS[k] ? `<span class="emo" role="img" aria-label="${FACE_NAMES[k]}">${faceSVG(k)}</span>` : m0).replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>');
const plain = (text) => String(text || '').replace(/:([a-z]{2,8}):/g, (m0, k) => FACE_PARTS[k] ? '(' + FACE_NAMES[k] + ')' : m0).replace(/\s+/g, ' ').trim();

/* ---------- rendering ---------- */
const log = () => $('#log'), scroller = () => $('#scroller');
const atBottom = () => { const s = scroller(); return s.scrollHeight - s.scrollTop - s.clientHeight < 90; };
const toBottom = () => { const s = scroller(); s.scrollTop = s.scrollHeight; UNSEEN = 0; drawNewbar(); };
function drawNewbar() { const b = $('#newbar'); if (UNSEEN > 0) { b.hidden = false; b.innerHTML = `${UNSEEN} new line${UNSEEN > 1 ? 's' : ''} ${ICON.down}`; } else b.hidden = true; }
const groups = (prev, r) => prev && !prev.local && !r.local && prev.user_id === r.user_id && parse(prev).kind === 'say' && parse(r).kind === 'say' && (new Date(r.created_at) - new Date(prev.created_at)) < 5 * 60e3 && dayKey(prev.created_at) === dayKey(r.created_at);

function actsHTML(r) {
  if (r.local || r.status === 'removed') return '';
  const mine = me && r.user_id === me.id;
  return `<div class="acts"><button type="button" data-reply="${r.id}" aria-label="Reply to this line">${ICON.reply}Reply</button>${mine ? `<button type="button" data-del="${r.id}" aria-label="Delete my line">${ICON.trash}Delete</button>` : `<button type="button" data-report="${r.id}" aria-label="Report this line">${ICON.flag}Report</button>`}</div>`;
}
function quoteHTML(r) {
  if (!r.reply_to) return '';
  const q = BYID.get(r.reply_to) || BYID.get(Number(r.reply_to));
  const who = q ? nameOf(q.user_id) : 'an earlier line', txt = q ? plain(parse(q).text).slice(0, 90) : '';
  return `<div class="quote" data-jump="${esc(r.reply_to)}" title="Jump to the line this replies to">${ICON.reply}<span><b>${esc(who)}</b>${txt ? ': ' + esc(txt) : ''}</span></div>`;
}
function lineHTML(r) {
  const p = parse(r), toMe = me && me.username && r.user_id !== me.id && new RegExp('@' + me.username.replace(/[^\w]/g, '') + '\\b', 'i').test(p.text);
  const blocked = r.status === 'removed';
  return `<div class="ln${blocked ? ' blocked' : ''}${toMe ? ' tome' : ''}" id="m-${esc(r.id)}" data-id="${esc(r.id)}">${quoteHTML(r)}<div class="tx c-${p.color}">${fmt(p.text)}</div>${blocked ? `<div class="bnote">The Shield blocked this line. Only you can see it. ${esc(STRIKE_TEXT)}</div>` : ''}<time datetime="${esc(r.created_at)}" title="${esc(full(r.created_at))}">${hm(r.created_at)}</time>${actsHTML(r)}</div>`;
}
function groupHTML(r, lines) {
  const c = ucolor(r.user_id), n = nameOf(r.user_id), u = userOf(r.user_id), href = u ? `/?u=${encodeURIComponent(u)}` : '';
  const av = href ? `<a class="av" href="${href}" style="--uc:${c}" aria-hidden="true" tabindex="-1">${esc(initials(n))}</a>` : `<span class="av" style="--uc:${c}" aria-hidden="true">${esc(initials(n))}</span>`;
  return `<div class="grp" data-uid="${esc(r.user_id)}" style="--uc:${c}">${av}<div><div class="gh">${href ? `<a href="${href}">${esc(n)}</a>` : `<span class="nm">${esc(n)}</span>`}<time datetime="${esc(r.created_at)}" title="${esc(full(r.created_at))}">${hm(r.created_at)}</time></div><div class="lines">${lines || lineHTML(r)}</div></div></div>`;
}
function rowHTML(r, prev, lines) {
  let h = '';
  if (!prev || dayKey(prev.created_at) !== dayKey(r.created_at)) h += `<div class="day" role="separator">${esc(dayLabel(r.created_at))}</div>`;
  const p = parse(r);
  if (r.local || p.kind === 'system') return h + `<div class="sys${r.out ? ' out' : ''}" id="m-${esc(r.id)}">${r.out ? ICON.doorOut : ICON.doorIn}<span>${esc(p.text)}</span><time datetime="${esc(r.created_at)}">${hm(r.created_at)}</time></div>`;
  if (p.kind === 'me') { const c = ucolor(r.user_id); return h + `<div class="act${r.status === 'removed' ? ' blocked' : ''}" id="m-${esc(r.id)}" data-id="${esc(r.id)}" style="--uc:${c}">${ICON.spark}<b>${esc(nameOf(r.user_id))}</b> <span class="c-${p.color}">${fmt(p.text)}</span>${r.status === 'removed' ? `<div class="bnote">The Shield blocked this line. Only you can see it.</div>` : ''}${actsHTML(r)}</div>`; }
  return h + groupHTML(r, lines);
}
function renderAll(keep) {
  const L = log(), s = scroller(); const prevH = s.scrollHeight, prevTop = s.scrollTop;
  L.setAttribute('aria-busy', 'true');
  if (!ROWS.length) {
    L.innerHTML = NOT_READY ? `<div class="empty"><b>Rooms open very soon</b>The chat is being switched on. Check back shortly, or say hi on the <a href="/">feed</a> in the meantime.</div>` : OFFLINE ? `<div class="empty"><b>Could not reach the rooms</b>Check your connection and reload the page.</div>` : `<div class="empty"><b>Quiet in ${esc(ROOM.name)}</b>${me ? 'Be the first to say hi. A simple hello starts most of the best conversations.' : 'Nobody has said anything yet. Join free and say the first hello.'}</div>`;
  } else {
    // chunks: each is a lead row (+ the rows grouped under it); a group only forms for consecutive plain lines
    const chunks = []; let prev = null;
    for (const r of ROWS) { if (chunks.length && groups(prev, r)) chunks[chunks.length - 1].rows.push(r); else chunks.push({ lead: r, before: prev, rows: [r] }); prev = r; }
    L.innerHTML = chunks.map((c) => rowHTML(c.lead, c.before, c.rows.length > 1 ? c.rows.map(lineHTML).join('') : '')).join('');
  }
  L.setAttribute('aria-busy', 'false');
  $('#earlier').hidden = !HAS_MORE;
  if (keep === 'top') s.scrollTop = s.scrollHeight - prevH + prevTop; else if (keep === 'stay') s.scrollTop = prevTop; else toBottom();
}
function appendRow(r) {
  const L = log(), was = atBottom(), mine = me && r.user_id === me.id;
  const i = ROWS.indexOf(r), prev = ROWS[i - 1];
  if (i !== ROWS.length - 1 || !L.querySelector('.grp,.sys,.act')) { renderAll(was || mine ? 'bottom' : 'stay'); if (!was && !mine) { UNSEEN++; drawNewbar(); } return; }
  const last = L.lastElementChild;
  if (groups(prev, r) && last && last.classList.contains('grp') && last.dataset.uid === String(r.user_id)) last.querySelector('.lines').insertAdjacentHTML('beforeend', lineHTML(r));
  else L.insertAdjacentHTML('beforeend', rowHTML(r, prev));
  if (was || mine) toBottom(); else { UNSEEN++; drawNewbar(); }
}
function addRow(r) {
  if (BYID.has(r.id)) return false;
  BYID.set(r.id, r);
  const t = new Date(r.created_at).getTime(); let i = ROWS.length;
  while (i > 0 && new Date(ROWS[i - 1].created_at).getTime() > t) i--;
  ROWS.splice(i, 0, r);
  if (ROWS.length > 400) { const cut = ROWS.splice(0, ROWS.length - 400); cut.forEach((x) => BYID.delete(x.id)); HAS_MORE = true; }
  return true;
}
function removeRow(id) {
  const r = BYID.get(id) || BYID.get(Number(id)); if (!r) return;
  BYID.delete(r.id); ROWS = ROWS.filter((x) => x !== r);
  renderAll('stay');
}
function addSystem(text, out) {
  const r = { id: 'sys-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), local: true, out: !!out, kind: 'system', body: text, user_id: null, created_at: new Date().toISOString() };
  addRow(r); appendRow(r);
}

/* ---------- names ---------- */
async function ensureNames(ids) {
  const need = [...new Set(ids)].filter((id) => id && !NAMES.has(id)); if (!need.length || !sb) return;
  for (let i = 0; i < need.length; i += 100) {
    try { const { data } = await sb.from('profiles').select('id,username,display_name').in('id', need.slice(i, i + 100)); (data || []).forEach((p) => NAMES.set(p.id, { name: p.display_name || p.username || 'Member', username: p.username || '' })); } catch (e) { }
  }
  need.forEach((id) => { if (!NAMES.has(id)) NAMES.set(id, { name: 'Member', username: '' }); });
}

/* ---------- room list ---------- */
function drawRooms() {
  const el = $('#room-list'); const g = { lobby: [], topic: [], constellation: [] };
  ROOMS.forEach((r) => (g[r.kind] || g.topic).push(r));
  const item = (r) => {
    const [t, tint] = THEMES[r.theme] || THEMES.dawn, n = DIR[r.slug] || 0, cur = r.slug === ROOM.slug;
    const badge = me ? `<span class="cnt${n ? '' : ' z'}" title="${n} ${n === 1 ? 'person' : 'people'} here">${ICON.person}${n}<span class="sr"> here</span></span>` : (ACTIVE[r.slug] ? `<span class="live" title="Lines in the last 20 minutes"><span class="sr">active now</span></span>` : '');
    return `<a class="ri" href="?r=${encodeURIComponent(r.slug)}" data-room="${esc(r.slug)}" style="--rt:${t};--rtint:${tint}"${cur ? ' aria-current="page"' : ''}><span class="sw" aria-hidden="true">${glyph(r)}</span><span style="min-width:0"><b>${esc(r.name)}</b><small>${esc(r.topic || '')}</small></span>${badge}</a>`;
  };
  el.innerHTML = `<p class="rgh">Open rooms</p>${[...g.lobby, ...g.topic].map(item).join('')}${g.constellation.length ? `<p class="rgh">Constellation rooms</p>${g.constellation.map(item).join('')}` : ''}<p class="rtip">${me ? 'Type <b>/away</b> and a note when you step out. People see it next to your name.' : 'Anyone can read along. <a href="/?auth=join" data-join>Join free</a> to talk, see who is here and IM people you meet.'}</p>`;
}
async function loadRooms() {
  try {
    const { data, error } = await sb.from('rooms').select('slug,name,topic,theme,kind,space_slug,sort,status').eq('status', 'open').order('sort', { ascending: true }).order('name', { ascending: true });
    if (!error && data && data.length) ROOMS = data.map((r) => ({ ...r, theme: THEMES[r.theme] ? r.theme : 'dawn', kind: r.kind || 'topic' }));
  } catch (e) { }
}
async function loadActivity() {
  if (!sb || NOT_READY) return;
  try {
    const { data } = await sb.from('hub_messages').select('room').gte('created_at', new Date(Date.now() - 20 * 60e3).toISOString()).limit(1000);
    ACTIVE = {}; (data || []).forEach((r) => { ACTIVE[r.room] = (ACTIVE[r.room] || 0) + 1; });
    if (!me) drawRooms();
  } catch (e) { }
}

/* ---------- history ---------- */
const visible = (r) => r && r.status !== 'deleted' && (r.status !== 'removed' || (me && r.user_id === me.id));
async function loadHistory(before) {
  if (!sb || LOADING) return; LOADING = true; const tok = ENTER_TOKEN;
  try {
    let q = sb.from('hub_messages').select('*').eq('room', ROOM.slug).order('created_at', { ascending: false }).limit(80);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q; if (tok !== ENTER_TOKEN) return;
    if (error) throw error;
    HAS_MORE = (data || []).length === 80; OFFLINE = false;
    const rows = (data || []).filter(visible);
    await ensureNames(rows.map((r) => r.user_id)); if (tok !== ENTER_TOKEN) return;
    rows.forEach(addRow);
    renderAll(before ? 'top' : 'bottom');
  } catch (e) {
    // before supabase/_parts/v29-match.sql runs, hub_messages does not exist on production
    if (/schema cache|PGRST205|does not exist/i.test((e && (e.message || e.code)) || '')) { NOT_READY = true; drawShield(); } else console.warn('rooms history', e);
    if (!before) { OFFLINE = !NOT_READY && !ROWS.length; renderAll('bottom'); }
  }
  finally { LOADING = false; }
}

/* ---------- realtime ---------- */
function leaveChannels() {
  for (const ch of [chRoom, chDb]) { if (ch) { try { sb.removeChannel(ch); } catch (e) { } } }
  chRoom = chDb = null;
}
function subscribeDb() {
  const slug = ROOM.slug, tok = ENTER_TOKEN;
  chDb = sb.channel('hubdb-' + slug + '-' + Math.random().toString(36).slice(2, 7))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hub_messages', filter: 'room=eq.' + slug }, async (p) => {
      const r = p.new; if (tok !== ENTER_TOKEN || !r || r.room !== slug || !visible(r) || BYID.has(r.id)) return;
      await ensureNames([r.user_id]); if (tok !== ENTER_TOKEN || BYID.has(r.id)) return;
      addRow(r); appendRow(r); TYPING.delete(r.user_id); drawTyping(); drawPeople();
      if (!me || r.user_id !== me.id) SND.blip();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hub_messages', filter: 'room=eq.' + slug }, (p) => {
      const r = p.new; if (tok !== ENTER_TOKEN || !r) return; if (!visible(r)) removeRow(r.id);
    })
    .subscribe();
}
const meta = () => ({ uid: me.id, name: me.name, username: me.username || '', away: AWAY || '', at: Date.now() });
function joinPresence() {
  if (!me) return;
  const slug = ROOM.slug, tok = ENTER_TOKEN;
  const ch = sb.channel('room:' + slug, { config: { presence: { key: me.id }, broadcast: { self: false } } });
  chRoom = ch;
  ch.on('presence', { event: 'sync' }, () => { if (tok === ENTER_TOKEN) onSync(ch); })
    .on('broadcast', { event: 'typing' }, ({ payload }) => { if (tok !== ENTER_TOKEN || !payload || !payload.uid || payload.uid === me.id) return; TYPING.set(payload.uid, Date.now() + 4500); drawTyping(); drawPeople(); })
    .on('broadcast', { event: 'del' }, ({ payload }) => { if (tok === ENTER_TOKEN && payload && payload.id != null) removeRow(payload.id); })
    .subscribe(async (st) => {
      if (tok !== ENTER_TOKEN || ch !== chRoom) return;
      if (st === 'SUBSCRIBED') { try { await ch.track(meta()); } catch (e) { } setTimeout(() => { if (tok === ENTER_TOKEN) PRESENCE_READY = true; }, 1800); }
    });
}
function onSync(ch) {
  const st = ch.presenceState(), now = new Map();
  for (const key of Object.keys(st)) { const m = (st[key] || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0))[0]; if (m) now.set(key, m); }
  const prev = HERE; HERE = now;
  for (const [k, m] of now) { KNOWN.set(k, m); if (m.name && !NAMES.has(k)) NAMES.set(k, { name: m.name, username: m.username || '' }); }
  if (PRESENCE_READY) {
    for (const k of now.keys()) if (!prev.has(k) && k !== me.id) { addSystem(`${(now.get(k).name || 'Someone')} has entered the room.`); SND.open(); }
    for (const k of prev.keys()) if (!now.has(k) && k !== me.id) {
      const tok = ENTER_TOKEN, nm = (prev.get(k).name || 'Someone');
      setTimeout(() => { if (tok === ENTER_TOKEN && !HERE.has(k)) { addSystem(`${nm} has left the room.`, true); SND.close(); TYPING.delete(k); drawTyping(); } }, 2500);
    }
  }
  drawPeople();
}
function joinDirectory() {
  if (!me || chDir) return;
  const ch = sb.channel('room:_lobby-directory', { config: { presence: { key: me.id } } }); chDir = ch;
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState(); const c = {};
    for (const key of Object.keys(st)) { const rooms = new Set((st[key] || []).map((m) => m.room).filter(Boolean)); rooms.forEach((r) => { c[r] = (c[r] || 0) + 1; }); }
    DIR = c; drawRooms(); drawHereCount();
  }).subscribe(async (s) => { if (s === 'SUBSCRIBED') { try { await ch.track({ room: ROOM.slug, at: Date.now() }); } catch (e) { } } });
}
function trackDirectory() { if (chDir) { try { chDir.track({ room: ROOM.slug, at: Date.now() }); } catch (e) { } } }
async function retrack() { if (chRoom && me) { try { await chRoom.track(meta()); } catch (e) { } } }

/* ---------- people here ---------- */
function drawHereCount() { const n = me ? Math.max(HERE.size, DIR[ROOM.slug] || 0) : 0; $('#here-n').textContent = String(n); $('#ppl-n').textContent = me ? `(${HERE.size})` : ''; }
function drawPeople() {
  const ul = $('#ppl'), box = $('#awaybox');
  drawHereCount();
  if (!me) { ul.innerHTML = `<li class="pnote">Members see who is in the room, their away notes and an IM button for each person.<br><br><a class="btn" href="/?auth=join" data-join>Join free</a></li>`; box.hidden = true; return; }
  const now = Date.now(); const list = [...HERE.entries()].map(([k, m]) => ({ k, m, typing: (TYPING.get(k) || 0) > now, away: !!m.away }));
  if (!HERE.has(me.id)) list.push({ k: me.id, m: meta(), typing: false, away: !!AWAY });
  const rank = (x) => (x.k === me.id ? 0 : x.typing ? 1 : x.away ? 3 : 2);
  list.sort((a, b) => rank(a) - rank(b) || String(a.m.name || '').localeCompare(String(b.m.name || '')));
  ul.innerHTML = list.map(({ k, m, typing, away }) => {
    const c = ucolor(k), n = m.name || nameOf(k), u = m.username || userOf(k), you = k === me.id;
    const state = typing ? 'typing' : away ? 'away' : 'here';
    const sub = away ? 'Away: ' + m.away : typing ? 'typing…' : u ? '@' + u : 'here';
    return `<li class="pp ${state}" style="--uc:${c}" ${away ? `title="${esc(n)} is away: ${esc(m.away)}"` : ''}><span class="av sm" style="--uc:${c}" aria-hidden="true">${esc(initials(n))}<span class="dot"></span></span><div class="pn"><b>${esc(n)}${you ? ' <span style="color:var(--mut);font-weight:600">(you)</span>' : ''}</b><small>${esc(sub)}</small><span class="sr">${state}</span></div>${!you && u ? `<div class="pa"><a class="ib im" href="/?v=dm&with=${encodeURIComponent(u)}" title="Send ${esc(n)} an IM" aria-label="Send ${esc(n)} an IM">IM</a><a class="ib" href="/?u=${encodeURIComponent(u)}" title="${esc(n)}'s profile" aria-label="${esc(n)}'s profile">${ICON.person}</a></div>` : ''}</li>`;
  }).join('');
  box.hidden = false;
  box.innerHTML = AWAY
    ? `<p>You are away: <b>${esc(AWAY)}</b></p><div class="row"><button class="tb" type="button" data-back>${ICON.doorIn}I'm back</button></div>`
    : `<p>Stepping out? Leave a note people can see.</p><div class="row"><label class="sr" for="away-in">Away note</label><input id="away-in" maxlength="80" placeholder="Away: grabbing dinner"><button class="tb" type="button" data-away>${ICON.moon}Set</button></div>`;
}
function drawTyping() {
  const now = Date.now(); for (const [k, t] of TYPING) if (t < now) TYPING.delete(k);
  const names = [...TYPING.keys()].map((k) => (HERE.get(k) || KNOWN.get(k) || {}).name || nameOf(k));
  $('#typing').innerHTML = names.length ? `<b>${esc(names.slice(0, 2).join(' and '))}</b>${names.length > 2 ? ` and ${names.length - 2} more` : ''} ${names.length > 1 ? 'are' : 'is'} typing<i></i><i></i><i></i>` : '';
}
async function setAway(text) {
  AWAY = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (AWAY && screen(AWAY).level === 'block') { AWAY = ''; toast('That away note is not allowed here.'); }
  AUTO_AWAY = false; await retrack(); drawPeople();
  toast(AWAY ? 'Away note set. People see it next to your name.' : 'Welcome back.');
}

/* ---------- composer ---------- */
const ta = () => $('#msg');
function stripForScreen(t) { return String(t || '').replace(/^\/me\s+/i, '').replace(/:([a-z]{2,8}):/g, ' '); }
function drawShield() {
  const el = $('#shield'), v = ta().value.trim(), send = $('#send');
  if (NOT_READY && me) { el.className = 'shield info'; el.innerHTML = ICON.warn + '<span>Rooms open very soon. Sending switches on as soon as the chat is live.</span>'; send.disabled = true; return { level: 'ok' }; }
  if (!v || /^\/(away|back)\b/i.test(v)) { el.className = 'shield'; el.innerHTML = ''; send.disabled = !me; return { level: 'ok' }; }
  const r = screen(stripForScreen(v));
  if (r.level === 'block') { el.className = 'shield block'; el.innerHTML = ICON.block + `<span><b>This can't be sent: ${esc(r.hits.filter((h) => h.level === 'block').map((h) => h.label).join(', '))}.</b> ${esc(STRIKE_TEXT)}</span>`; send.disabled = true; }
  else if (r.level === 'warn') { el.className = 'shield warn'; el.innerHTML = ICON.warn + `<span><b>Heads-up:</b> ${esc(r.hits.map((h) => h.label).join('; '))}. You can still send it; keep contact and payments inside allofus.</span>`; send.disabled = !me; }
  else { el.className = 'shield'; el.innerHTML = ''; send.disabled = !me; }
  return r;
}
function autosize() { const t = ta(); t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight + 6) + 'px'; $('.chat').style.setProperty('--cmp-h', ($('#composer').offsetHeight + $('#typing').offsetHeight + 8) + 'px'); }
function drawReply() {
  const el = $('#rchip');
  if (!REPLY) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false; el.innerHTML = `<span>Replying to <b>${esc(REPLY.name)}</b>: ${esc(REPLY.text)}</span><button type="button" data-unreply aria-label="Cancel the reply">${ICON.close}</button>`;
}
function insertAtCaret(s) {
  const t = ta(); const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? t.value.length;
  const pre = t.value.slice(0, a), pad = pre && !/\s$/.test(pre) ? ' ' : '';
  t.value = pre + pad + s + ' ' + t.value.slice(b); const p = (pre + pad + s + ' ').length; t.setSelectionRange(p, p); t.focus(); drawShield(); autosize();
}
function closePops(except) { ['color', 'face'].forEach((k) => { if (k === except) return; $('#pop-' + k).hidden = true; $('#b-' + k).setAttribute('aria-expanded', 'false'); }); }
function togglePop(k) { const p = $('#pop-' + k), open = p.hidden; closePops(k); p.hidden = !open; $('#b-' + k).setAttribute('aria-expanded', String(open)); if (open) { const f = p.querySelector('[aria-checked=true],button'); if (f) f.focus(); } }
function drawColors() {
  $('#color-dot').style.background = COLOR_HEX[COLOR];
  $('#colors').innerHTML = COLORS.map(([k, n]) => `<button type="button" role="radio" aria-checked="${k === COLOR}" data-color="${k}"><i style="background:${COLOR_HEX[k]}"></i><span style="color:${COLOR_HEX[k]}">${n}</span></button>`).join('');
  ta().style.color = COLOR_HEX[COLOR];
}
function sendTyping() {
  if (!me || !chRoom) return; const now = Date.now(); if (now - LAST_TYPING_SENT < 2500) return; LAST_TYPING_SENT = now;
  try { chRoom.send({ type: 'broadcast', event: 'typing', payload: { uid: me.id } }); } catch (e) { }
}
function goJoin(path = '/?auth=join') { try { localStorage.setItem('aou_next', '/chat/' + (ROOM.slug !== 'general' ? '?r=' + encodeURIComponent(ROOM.slug) : '')); } catch (e) { } location.href = path; }
function modal(title, html) {
  const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div><h3>${esc(title)}</h3>${html}<div class="row"><button class="btn alt" type="button" data-x>OK</button></div></div>`;
  const close = () => { m.remove(); ta().focus(); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-x]')) close(); });
  m.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.appendChild(m); m.querySelector('[data-x]').focus();
}
let SENDING = false;
async function send() {
  if (!me) { goJoin(); return; }
  if (SENDING || NOT_READY) return;
  const t = ta(); let raw = t.value.replace(/\s+$/, ''); if (!raw.trim()) return;
  if (/^\/away\b/i.test(raw)) { t.value = ''; autosize(); drawShield(); await setAway(raw.replace(/^\/away\s*/i, '') || 'Stepped away'); return; }
  if (/^\/back\b/i.test(raw)) { t.value = ''; autosize(); drawShield(); await setAway(''); return; }
  let kind = 'say', body = raw.replace(/^\s+/, '');
  if (/^\/me\s+\S/i.test(body)) { kind = 'me'; body = body.replace(/^\/me\s+/i, ''); }
  else if (/^\/[a-z]+\b/i.test(body)) { toast('Room commands: /me waves · /away a note · /back'); return; }
  if (drawShield().level === 'block') return;
  const pre = COLOR !== 'ink' ? `[c=${COLOR}]` : '';
  body = (pre + body).slice(0, 1990);
  const row = { room: ROOM.slug, user_id: me.id, body, kind, reply_to: REPLY ? REPLY.id : null };
  SENDING = true; $('#send').disabled = true;
  let res = await sb.from('hub_messages').insert(row).select().single();
  if (res.error && /column|schema cache|kind|reply_to|status/i.test(res.error.message || '') && !/ROOM_/.test(res.error.message || '')) {
    res = await sb.from('hub_messages').insert({ room: ROOM.slug, user_id: me.id, body: (kind === 'me' ? '/me ' : '') + body }).select().single();
  }
  SENDING = false; drawShield();
  if (res.error) {
    const m = res.error.message || '';
    if (/ROOM_PAUSED/.test(m)) { modal('Chat is paused on this account', `<p>${esc(m.replace(/^.*ROOM_PAUSED:\s*/, '').replace(/^./, (c) => c.toUpperCase()))}.</p><p>If you think this is a mistake, call <a href="tel:18004818638">1-800-481-8638</a>.</p>`); return; }
    if (/ROOM_CLOSED/.test(m)) { toast('This room is closed right now. The Lobby is always open.', 5000); return; }
    if (/ROOM_SLOW/.test(m)) { const el = $('#shield'); el.className = 'shield info'; el.innerHTML = ICON.warn + '<span><b>Easy there.</b> Rooms allow 20 lines a minute. Take a breath and send again in a few seconds.</span>'; return; }
    if (/adult|row-level|policy|permission/i.test(m)) { modal('One quick step first', '<p>Rooms are for adults. Open your feed once and confirm your date of birth, then come back and say hi.</p><p><a class="btn" href="/?v=u">Confirm on my profile</a></p>'); return; }
    toast('Could not send: ' + m.slice(0, 120)); return;
  }
  t.value = ''; autosize(); REPLY = null; drawReply(); drawShield(); LAST_TYPING_SENT = 0;
  const r = res.data;
  if (r && r.status === 'removed') {
    modal('That line was blocked', `<p><b>The Shield stopped it</b> and recorded a strike on this account. Nobody else can see it.</p><p>${esc(STRIKE_TEXT)}</p>`);
  } else SND.sent();
  if (r && !BYID.has(r.id)) { await ensureNames([r.user_id]); if (addRow(r)) appendRow(r); }
}
async function delLine(id, btn) {
  if (!btn.classList.contains('sure')) { btn.classList.add('sure'); btn.lastChild.textContent = 'Sure?'; setTimeout(() => { if (btn.isConnected) { btn.classList.remove('sure'); btn.lastChild.textContent = 'Delete'; } }, 3500); return; }
  let { error } = await sb.from('hub_messages').update({ status: 'deleted' }).eq('id', id).eq('user_id', me.id);
  if (error && /column|status|schema cache/i.test(error.message || '')) ({ error } = await sb.from('hub_messages').delete().eq('id', id).eq('user_id', me.id));
  if (error) { toast('Could not delete: ' + (error.message || '').slice(0, 100)); return; }
  removeRow(id);
  try { chRoom && chRoom.send({ type: 'broadcast', event: 'del', payload: { id } }); } catch (e) { }
  toast('Line deleted.');
}
async function reportLine(id) {
  const r = BYID.get(id) || BYID.get(Number(id)); if (!r) return;
  if (!me) { goJoin('/?auth=in'); return; }
  try { const SF = await import('./aou-safety.js'); await SF.report({ sb, me, kind: 'hub', id: r.id, owner: r.user_id, label: 'this chat line', preview: `Room ${ROOM.slug} · ${nameOf(r.user_id)}: ${plain(parse(r).text)}`.slice(0, 1800) }); }
  catch (e) { toast('Could not open the report form. Email info@eyetoad.com.'); }
}

/* ---------- entering a room ---------- */
async function enterRoom(slug) {
  const r = ROOMS.find((x) => x.slug === slug) || ROOMS.find((x) => x.slug === 'general') || ROOMS[0];
  ENTER_TOKEN++; if (sb) leaveChannels();
  ROOM = r; ROWS = []; BYID = new Map(); HERE = new Map(); TYPING.clear(); PRESENCE_READY = false; REPLY = null; UNSEEN = 0; HAS_MORE = false; LOADING = false;
  $('#app').dataset.theme = THEMES[r.theme] ? r.theme : 'dawn';
  $('#room-name').textContent = r.name; $('#room-topic').textContent = r.topic || ''; $('#room-glyph').innerHTML = glyph(r);
  log().setAttribute('aria-label', 'Messages in ' + r.name);
  document.title = `${r.name} · Rooms · live chat | allofus.one`;
  try { const u = new URL(location.href); if (r.slug === 'general') u.searchParams.delete('r'); else u.searchParams.set('r', r.slug); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { }
  ta().placeholder = me ? `Say something in ${r.name}…` : 'Join free to chat';
  drawRooms(); drawPeople(); drawReply(); drawTyping(); drawNewbar(); panes(null);
  log().innerHTML = '<div class="empty"><b>Opening the door…</b>Loading the latest lines.</div>';
  if (!sb) return;
  await loadHistory();
  if (!NOT_READY) subscribeDb(); joinPresence(); trackDirectory();
}

/* ---------- mobile panes ---------- */
function panes(which) {
  ['rooms', 'people'].forEach((k) => { const p = $('#' + k), on = which === k; p.classList.toggle('open', on); $$(`[data-open=${k}]`).forEach((b) => b.setAttribute('aria-expanded', String(on))); });
  $('#scrim').hidden = !which;
  if (which) { const f = $('#' + which).querySelector('a,button,input'); if (f) setTimeout(() => f.focus(), 60); }
}
function setVH() {
  const h = window.visualViewport ? window.visualViewport.height : innerHeight;
  document.documentElement.style.setProperty('--vvh', h + 'px');
  const hd = $('header.top'); if (hd) document.documentElement.style.setProperty('--hh', hd.offsetHeight + 'px');
}

/* ---------- boot ---------- */
export async function bootRooms() {
  $$('[data-i]').forEach((s) => { s.outerHTML = ICON[s.dataset.i] || ''; });
  $$('.x').forEach((b) => { b.innerHTML = ICON.close; });
  setVH(); addEventListener('resize', setVH); if (window.visualViewport) window.visualViewport.addEventListener('resize', setVH);
  drawMute(); drawColors();
  $('#faces').innerHTML = Object.keys(FACE_PARTS).map((k) => `<button type="button" data-face="${k}" title=":${k}:" aria-label="${FACE_NAMES[k]}">${faceSVG(k)}</button>`).join('');
  const want = (new URLSearchParams(location.search).get('r') || 'general').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'general';

  // logged-out composer until we know better
  const gate = (on) => { $('#gate').hidden = !on; ta().disabled = on; $('#b-color').disabled = on; $('#b-face').disabled = on; $('#send').disabled = on; };
  gate(true);

  // events
  $('#mute').onclick = () => { MUTED = !MUTED; store.set('aou_rooms_mute', MUTED); drawMute(); if (!MUTED) { GESTURE = true; SND.open(); } };
  $('#composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });
  ta().addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    else if (e.key === 'Escape') { if (REPLY) { REPLY = null; drawReply(); } closePops(); }
  });
  ta().addEventListener('input', () => { drawShield(); autosize(); if (ta().value.trim()) sendTyping(); });
  ta().addEventListener('focus', () => { if (matchMedia('(max-width:900px)').matches) setTimeout(() => { const a = $('#app'); window.scrollTo({ top: a.getBoundingClientRect().top + scrollY - $('header.top').offsetHeight, behavior: 'auto' }); if (atBottom()) toBottom(); }, 250); });
  $('#b-color').onclick = () => togglePop('color'); $('#b-face').onclick = () => togglePop('face');
  $('#scroller').addEventListener('scroll', () => { if (atBottom() && UNSEEN) { UNSEEN = 0; drawNewbar(); } }, { passive: true });
  $('#newbar').onclick = () => { toBottom(); ta().focus({ preventScroll: true }); };
  $('#earlier').onclick = () => { const first = ROWS.find((r) => !r.local); if (first) loadHistory(first.created_at); };
  $('#scrim').onclick = () => panes(null);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePops(); panes(null); } });
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t.closest('.pop') && !t.closest('#b-color') && !t.closest('#b-face')) closePops();
    const op = t.closest('[data-open]'); if (op) { const k = op.dataset.open; panes($('#' + k).classList.contains('open') ? null : k); return; }
    if (t.closest('[data-close]')) { panes(null); return; }
    const rm = t.closest('[data-room]'); if (rm) { e.preventDefault(); if (rm.dataset.room !== ROOM.slug) enterRoom(rm.dataset.room); else panes(null); return; }
    const jn = t.closest('[data-join],#join-btn'); if (jn) { e.preventDefault(); goJoin(); return; }
    const c = t.closest('[data-color]'); if (c) { COLOR = c.dataset.color; store.set('aou_rooms_color', COLOR); drawColors(); closePops(); ta().focus(); return; }
    const f = t.closest('[data-face]'); if (f) { insertAtCaret(':' + f.dataset.face + ':'); closePops(); return; }
    const rp = t.closest('[data-reply]'); if (rp) { if (!me) { goJoin(); return; } const r = BYID.get(rp.dataset.reply) || BYID.get(Number(rp.dataset.reply)); if (r) { REPLY = { id: r.id, name: nameOf(r.user_id), text: plain(parse(r).text).slice(0, 80) }; drawReply(); ta().focus(); } return; }
    if (t.closest('[data-unreply]')) { REPLY = null; drawReply(); ta().focus(); return; }
    const dl = t.closest('[data-del]'); if (dl && me) { const id = BYID.has(Number(dl.dataset.del)) ? Number(dl.dataset.del) : dl.dataset.del; delLine(id, dl); return; }
    const rep = t.closest('[data-report]'); if (rep) { reportLine(rep.dataset.report); return; }
    const jm = t.closest('[data-jump]'); if (jm) { const el = document.getElementById('m-' + jm.dataset.jump); if (el) { el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); el.classList.add('sel'); setTimeout(() => el.classList.remove('sel'), 1800); } else toast('That line is further back. Load earlier lines to see it.'); return; }
    if (t.closest('[data-back]')) { setAway(''); return; }
    if (t.closest('[data-away]')) { const v = ($('#away-in') || {}).value || ''; setAway(v || 'Stepped away'); return; }
    // touch: tap a line to show its buttons
    const ln = t.closest('.ln,.act'); $$('.ln.sel,.act.sel').forEach((x) => { if (x !== ln) x.classList.remove('sel'); }); if (ln && !t.closest('a,button')) ln.classList.toggle('sel');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'away-in') { e.preventDefault(); setAway(e.target.value || 'Stepped away'); } });
  // idle: hidden for 10 minutes = auto away, cleared on return
  let hidT = 0;
  document.addEventListener('visibilitychange', () => {
    if (!me) return;
    if (document.hidden) { hidT = setTimeout(() => { if (!AWAY) { AWAY = 'Idle'; AUTO_AWAY = true; retrack(); drawPeople(); } }, 10 * 60e3); }
    else { clearTimeout(hidT); if (AUTO_AWAY) { AWAY = ''; AUTO_AWAY = false; retrack(); drawPeople(); } }
  });
  setInterval(() => { if (TYPING.size) { drawTyping(); drawPeople(); } }, 1200);

  ROOM = SEED.find((r) => r.slug === want) || SEED[0];
  drawRooms(); drawPeople(); autosize();

  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY); try { (await import('./aou-safety.js')).guardClient(sb); } catch (e) { }
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      let pr = null; try { ({ data: pr } = await sb.from('profiles').select('id,username,display_name').eq('id', session.user.id).maybeSingle()); } catch (e) { }
      me = { id: session.user.id, name: (pr && (pr.display_name || pr.username)) || 'Member', username: (pr && pr.username) || '' };
      NAMES.set(me.id, { name: me.name, username: me.username });
      const chip = $('#me-chip'); chip.textContent = '@' + (me.username || 'me'); chip.href = '/?v=u';
      gate(false);
    }
    await loadRooms();
    if (!ROOMS.some((r) => r.slug === want) && want !== 'general') toast('That room is not open. Here is The Lobby.');
    await enterRoom(want);
    joinDirectory(); loadActivity(); setInterval(loadActivity, 60e3);
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && me) location.reload(); if (ev === 'SIGNED_IN' && !me) location.reload(); });
  } catch (e) {
    console.warn('rooms offline', e); OFFLINE = true; ROWS = []; renderAll('bottom');
  }
  addEventListener('pagehide', () => { try { leaveChannels(); if (chDir) sb.removeChannel(chDir); } catch (e) { } });
}

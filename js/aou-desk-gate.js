/* allofus.one · the desk · access-code curtain. The code is checked against a one-way fingerprint; the desk code loads only after it matches.
   This keeps an unfinished page unlisted. It is not a lock: nothing private sits behind it. */
import { gateOk, gateToken } from './aou-desk-logic.js';

const $ = (id) => document.getElementById(id);
const GK = 'aou_desk_gate', LEN = 6;
let code = '', busy = false, fails = 0, waitUntil = 0;

async function open() {
  $('dk-gate').hidden = true; $('dk-app').hidden = false;
  try { const m = await import('./aou-desk.js'); await m.start(); }
  catch (e) { $('dk-load').textContent = 'The desk could not start on this device. A browser with WebGL is needed.'; console.error(e); }
}
function dots() { const d = $('dk-dots'); d.textContent = ''; for (let i = 0; i < LEN; i++) { const s = document.createElement('i'); if (i < code.length) s.className = 'f'; d.appendChild(s); } }
async function submit() {
  if (busy || code.length < 4) return; const now = Date.now();
  if (now < waitUntil) { $('dk-gate-msg').textContent = 'Wait a few seconds, then try again.'; return; }
  busy = true; $('dk-gate-msg').textContent = 'Checking…';
  let ok = false; try { ok = await gateOk(code, crypto.subtle); } catch (e) { $('dk-gate-msg').textContent = 'This browser can not check the code (a secure https page is needed).'; busy = false; return; }
  busy = false;
  if (ok) { try { localStorage.setItem(GK, gateToken()); } catch (e) { } open(); return; }
  fails++; waitUntil = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(fails, 5)); code = ''; dots(); $('dk-gate-msg').textContent = 'That code is not right.';
}
function press(k) { if (busy) return; if (k === 'del') code = code.slice(0, -1); else if (k === 'go') { submit(); return; } else if (code.length < LEN) code += k; $('dk-gate-msg').textContent = ''; dots(); if (code.length === LEN) submit(); }

let remembered = false; try { remembered = localStorage.getItem(GK) === gateToken(); } catch (e) { }
if (remembered) open();
else {
  const pad = $('dk-pad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'].forEach((k) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = k === 'del' ? '⌫' : k === 'go' ? 'OK' : k; b.setAttribute('aria-label', k === 'del' ? 'Delete' : k === 'go' ? 'Enter code' : k); if (k === 'go') b.className = 'go'; b.addEventListener('click', () => press(k)); pad.appendChild(b); });
  addEventListener('keydown', (e) => { if (!$('dk-gate').hidden) { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('go'); } });
  dots();
}

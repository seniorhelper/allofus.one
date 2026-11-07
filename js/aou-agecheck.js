/* allofus.one · on-device face age check (v33, Nov 7 2026)
   A one-time step for every member (new sign-ups and existing members at their next visit).
   - Runs entirely in the member's browser with the open-source face-api models in /vendor/face-api (MIT).
     The camera picture never leaves the device and is never stored. Only the estimated age number is saved.
   - 25+ estimate: done. 18–24: let in, flagged for a person to double-check (and a real ID-style check later).
     Under 18: held (cannot post, comment, message or upload) until a person reviews it.
   - This is a first filter, not proof of age. A real provider (Yoti) plugs into age_provider when the keys arrive.
   - Admins review at /?v=agereview. Server side: supabase/_parts/v33-face-age.sql. */
const BASE = '/vendor/face-api/';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let FA = null, CSS_ON = false;
const CSS = `.ag-wrap{position:fixed;inset:0;z-index:99999;background:rgba(10,14,40,.82);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Poppins,Arial,sans-serif}
.ag-card{background:#fff;color:#14183a;border-radius:20px;max-width:440px;width:100%;padding:20px 20px 16px;box-shadow:0 20px 60px rgba(0,0,0,.35);max-height:92vh;overflow:auto}
.ag-card h3{margin:0 0 6px;font-size:21px}.ag-card p{margin:6px 0;font-size:15px;line-height:1.5}.ag-note{font-size:13px;color:#475569}
.ag-cam{position:relative;width:100%;aspect-ratio:4/3;background:#0f172a;border-radius:14px;overflow:hidden;margin:10px 0}.ag-cam video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
.ag-ring{position:absolute;inset:12% 22%;border:3px dashed rgba(255,255,255,.7);border-radius:50%}
.ag-btn{display:inline-block;border:0;border-radius:12px;padding:11px 16px;font:700 15px Poppins,Arial,sans-serif;cursor:pointer;background:#1b1f3b;color:#fff;margin:4px 6px 0 0}.ag-btn.s{background:#e2e8f0;color:#14183a}
.ag-bar{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:8px 0}.ag-bar i{display:block;height:100%;width:0;background:#16a34a;transition:width .2s}`;
function css() { if (CSS_ON) return; CSS_ON = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
async function load() {
  if (FA) return FA;
  const m = await import(BASE + 'face-api.esm.js');
  await m.nets.tinyFaceDetector.loadFromUri(BASE + 'model');
  await m.nets.ageGenderNet.loadFromUri(BASE + 'model');
  FA = m; return m;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

/* call once after sign-in on the main pages; shows the check only when the database says it is still needed */
export async function ensure(sb, me) {
  if (!sb || !me || me.isAdmin) return;
  let st = null; try { const r = await sb.rpc('safety_face_status'); if (r.error) return; st = r.data; } catch (e) { return; }
  if (!st || !st.required || st.done) { if (st && st.result === 'under18') heldCard(sb); return; }
  open(sb);
}

function shell(html) { css(); const w = document.createElement('div'); w.className = 'ag-wrap'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Quick age check'); w.innerHTML = `<div class="ag-card">${html}</div>`; document.body.appendChild(w); return w; }
function signOutBtn(w, sb) { const b = w.querySelector('[data-ag-out]'); if (b) b.onclick = async () => { try { await sb.auth.signOut(); } catch (e) { } location.href = '/'; }; }

function heldCard(sb) {
  if (document.querySelector('.ag-wrap')) return;
  const w = shell(`<h3>Your account is on hold for a quick review</h3><p>Our age check could not confirm you are 18 or older. allofus.one is for adults only, so posting, comments, messages and uploads are paused until a person reviews it, usually within a day.</p><p class="ag-note">If you are an adult, nothing else is needed: we'll let you know. Questions: 1-800-481-8638 or info@eyetoad.com.</p><button class="ag-btn s" data-ag-ok>OK</button> <button class="ag-btn s" data-ag-out>Sign out</button>`);
  w.querySelector('[data-ag-ok]').onclick = () => w.remove(); signOutBtn(w, sb);
}

function open(sb) {
  if (document.querySelector('.ag-wrap')) return;
  const w = shell(`<h3>One quick age check 🛡️</h3>
    <p>allofus.one is for adults 18+. To keep minors out, everyone does a 5-second selfie age check, once.</p>
    <p class="ag-note"><b>Your picture never leaves your device and is never saved.</b> Your phone or computer estimates your age right here; we only keep the number. <a href="/privacy/" target="_blank" rel="noopener">Privacy</a></p>
    <div class="ag-cam" hidden><video playsinline muted autoplay></video><div class="ag-ring"></div></div>
    <div class="ag-bar" hidden><i></i></div>
    <p class="ag-msg ag-note" aria-live="polite"></p>
    <div><button class="ag-btn" data-ag-go>Start the check</button><button class="ag-btn s" data-ag-out>Sign out</button></div>`);
  signOutBtn(w, sb);
  const go = w.querySelector('[data-ag-go]'), msg = w.querySelector('.ag-msg'), cam = w.querySelector('.ag-cam'), video = w.querySelector('video'), bar = w.querySelector('.ag-bar'), fill = bar.querySelector('i');
  let stream = null; const stop = () => { try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) { } stream = null; };
  go.onclick = async () => {
    go.disabled = true; msg.textContent = 'Loading the check (about 2 MB, once)…';
    let m; try { m = await load(); } catch (e) { msg.textContent = 'The check could not load. Check your connection and try again.'; go.disabled = false; return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); }
    catch (e) { msg.innerHTML = 'We need your camera for this one step. Allow camera access in your browser, then try again. No camera? Call 1-800-481-8638 and we\'ll help.'; go.disabled = false; go.textContent = 'Try again'; return; }
    cam.hidden = false; bar.hidden = false; video.srcObject = stream; await new Promise(r => { if (video.readyState >= 2) r(); else video.onloadeddata = () => r(); });
    msg.textContent = 'Look at the camera, face in the circle, good light…';
    const opts = new m.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const ages = []; const t0 = Date.now();
    while (ages.length < 12 && Date.now() - t0 < 20000) {
      try { const d = await m.detectSingleFace(video, opts).withAgeAndGender(); if (d && d.detection && d.detection.score > 0.6 && typeof d.age === 'number') { ages.push(d.age); fill.style.width = Math.round(ages.length / 12 * 100) + '%'; } } catch (e) { }
      await new Promise(r => setTimeout(r, 150));
    }
    stop(); cam.hidden = true;
    if (ages.length < 5) { msg.textContent = 'We could not see your face clearly. Face the camera in good light and try again.'; bar.hidden = true; fill.style.width = '0'; go.disabled = false; go.textContent = 'Try again'; return; }
    const est = Math.round(median(ages) * 10) / 10;
    msg.textContent = 'Saving…';
    const { data, error } = await sb.rpc('safety_face_check', { p_age: est, p_samples: ages.length });
    if (error) { msg.textContent = 'Could not save the check: ' + String(error.message || '').slice(0, 120); go.disabled = false; go.textContent = 'Try again'; return; }
    const res = data && data.result;
    if (res === 'under18') { w.remove(); heldCard(sb); return; }
    w.querySelector('.ag-card').innerHTML = res === 'review'
      ? `<h3>Thanks, you're in ✅</h3><p>You look close to 18 to our check, so a person may double-check later. Nothing for you to do now.</p><button class="ag-btn" data-ag-done>Continue</button>`
      : `<h3>Thanks, all set ✅</h3><p>That's it. You won't be asked again.</p><button class="ag-btn" data-ag-done>Continue</button>`;
    w.querySelector('[data-ag-done]').onclick = () => w.remove();
  };
}

/* admin: /?v=agereview */
export async function reviewView(body, F3) {
  const sb = F3.sb; const me = F3.getMe && F3.getMe(); const toast = (t) => (F3.toast ? F3.toast(t) : alert(t));
  if (!me || !me.isAdmin) { body.innerHTML = '<div class="fl-empty">Admins only.</div>'; return; }
  body.innerHTML = '<div class="fl-empty">Loading…</div>';
  const { data, error } = await sb.rpc('admin_face_reviews');
  if (error) { body.innerHTML = `<div class="fl-empty">${esc(error.message)}</div>`; return; }
  const rows = data || [];
  body.innerHTML = `<div class="fl-card" style="max-width:760px;margin:12px auto"><h3>Age checks to review (${rows.length})</h3><p class="muted">On-device estimates only: a first filter, not proof. "Held" members cannot post, comment, message or upload until you clear them. Look at their profile and posts; if unsure, ask them for a real ID check once Yoti is live.</p>
    ${rows.map(r => `<div style="border-top:1px solid #e5e7eb;padding:8px 0" data-u="${esc(r.user_id)}"><b>${esc(r.name || r.username || 'member')}</b> <a href="/?u=${esc(r.username || '')}" target="_blank" rel="noopener">@${esc(r.username || '?')}</a> · estimate <b>${esc(r.est)}</b> · ${r.result === 'under18' ? '<span style="color:#b91c1c;font-weight:700">held (under 18)</span>' : 'flagged (18–24)'} · ${esc(new Date(r.at).toLocaleString())} · typed birth date says ${r.dob_age == null ? '?' : esc(r.dob_age)}
      <div style="margin-top:4px"><button class="fl-btn sm p" data-ok="1">Adult: clear</button> <button class="fl-btn sm" data-ok="0">Keep held</button></div></div>`).join('') || '<p class="muted">Nothing waiting.</p>'}</div>`;
  body.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => {
    const u = b.closest('[data-u]').dataset.u; const ok = b.dataset.ok === '1';
    const { error: e2 } = await sb.rpc('admin_face_decide', { p_user: u, p_adult: ok });
    toast(e2 ? 'Could not save: ' + e2.message : ok ? 'Cleared.' : 'Kept on hold.'); reviewView(body, F3);
  });
}

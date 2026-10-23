/* allofus.one · "Your graph is yours" (v27, Oct 23 2026)
   The practical first step of sovereign identity, with no blockchain and no token:
   - an Ed25519 key pair made in the browser (WebCrypto). The public key becomes a did:key (W3C did:key method,
     multicodec 0xed01 + base58btc) and is stored in profiles.pubkey when the v27 SQL has run.
   - the member downloads the private key file (it never leaves the device otherwise; a copy stays in this browser's
     localStorage so signing works later; "Forget key on this device" removes it).
   - "Download signed export" writes the normal JSON export plus a detached signature file. Anyone can verify the pair
     with any Ed25519 library, or on /?v=verify, with no account and no server call. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s);
const KEY = 'aou_idkey';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58enc(bytes) { let n = 0n; for (const b of bytes) n = (n << 8n) + BigInt(b); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of bytes) { if (b !== 0) break; s = '1' + s; } return s; }
export function b58dec(s) { let n = 0n; for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); } const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; } for (const ch of s) { if (ch !== '1') break; out.unshift(0); } return new Uint8Array(out); }
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const didFromRaw = (raw) => 'did:key:z' + b58enc(new Uint8Array([0xed, 0x01, ...raw]));
export function rawFromDid(did) { const m = /^did:key:z([1-9A-HJ-NP-Za-km-z]+)$/.exec(String(did || '').trim()); if (!m) throw new Error('not a did:key'); const b = b58dec(m[1]); if (b[0] !== 0xed || b[1] !== 0x01 || b.length !== 34) throw new Error('not an Ed25519 did:key'); return b.slice(2); }
const supported = async () => { try { const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); return !!k; } catch (e) { return false; } };
const stored = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const download = (name, text, type = 'application/json') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
const sha256hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');

export async function makeKey() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)); const pkcs8 = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const rec = { did: didFromRaw(raw), publicKeyRaw_b64: b64(raw), privateKeyPkcs8_b64: b64(pkcs8), alg: 'Ed25519', created: new Date().toISOString(), site: 'allofus.one' };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { } return rec;
}
export async function signBytes(rec, bytes) { const pk = await crypto.subtle.importKey('pkcs8', unb64(rec.privateKeyPkcs8_b64), { name: 'Ed25519' }, false, ['sign']); return b64(await crypto.subtle.sign({ name: 'Ed25519' }, pk, bytes)); }
export async function verifyBytes(did, sigB64, bytes) { const pub = await crypto.subtle.importKey('raw', rawFromDid(did), { name: 'Ed25519' }, false, ['verify']); return crypto.subtle.verify({ name: 'Ed25519' }, pub, unb64(sigB64), bytes); }

export const ID_CSS = `.idb{display:grid;gap:10px}.idb .did{font:600 12px/1.4 ui-monospace,Menlo,Consolas,monospace;word-break:break-all;background:#f8fafc;border-radius:10px;padding:8px 10px;color:#0f172a}.idb .row{display:flex;gap:8px;flex-wrap:wrap}.idb .row .fl-btn{min-height:40px}.idb .ok{color:#15803d;font-weight:700}.idb .bad{color:#b91c1c;font-weight:700}.idb ol{margin:0;padding-left:18px;font:500 13px/1.55 Poppins,Arial;color:#334155}.idb input[type=file]{font:500 12.5px Poppins,Arial}`;
const css = () => { if ($('#aou-id-css')) return; const s = document.createElement('style'); s.id = 'aou-id-css'; s.textContent = ID_CSS; document.head.appendChild(s); };

/* the block on /?v=mydata (needs a signed-in member; F3 = the flat2 context) */
export async function identityBlock(host, F3) {
  css(); const me = F3.getMe && F3.getMe(); const sb = F3.live ? F3.sb : null; const toast = F3.toast || (() => { });
  if (!(await supported())) { host.innerHTML = `<h3>Your graph is yours</h3><p>This browser cannot make Ed25519 keys yet (needs a current Chrome, Edge, Safari or Firefox). The one-click export above still works everywhere.</p>`; return; }
  let rec = stored(); let saved = null; try { if (sb && me) { const { data } = await sb.from('profiles').select('pubkey').eq('id', me.id).maybeSingle(); saved = data && data.pubkey; } } catch (e) { }
  const draw = () => {
    host.innerHTML = `<h3>Your graph is yours: a key only you hold</h3><p>Make an identity key on this device. The public half becomes your <b>did:key</b> (an open W3C identifier) and can sit on your profile; the private half is a file you keep. Sign your export with it and anyone can check the file is really yours, with no allofus server involved. No blockchain, no token, no cost.</p>
    <div class="idb">${rec ? `<div class="did" title="Your decentralized identifier">${esc(rec.did)}</div><p class="muted" style="margin:0;font-size:12px">${saved === rec.did ? '<span class="ok">On your profile.</span>' : saved ? '<span class="bad">Your profile holds a different key.</span> Publish this one to replace it.' : 'Not on your profile yet.'} Key made ${esc(rec.created.slice(0, 10))}.</p>
    <div class="row">${me ? `<button class="fl-btn p" type="button" data-id-sign>Download signed export</button>` : ''}<button class="fl-btn" type="button" data-id-dl>Download my key file</button>${me && sb && saved !== rec.did ? `<button class="fl-btn" type="button" data-id-pub>Put public key on my profile</button>` : ''}<a class="fl-btn" href="/?v=verify">Verify an export</a><button class="fl-btn" type="button" data-id-forget style="color:#b91c1c;border-color:#fecaca">Forget key on this device</button></div>`
    : `<div class="row">${me ? `<button class="fl-btn p" type="button" data-id-make>Create my identity key</button>` : '<a class="fl-btn p" href="/?auth=in">Sign in to create a key</a>'}<a class="fl-btn" href="/?v=verify">Verify an export</a></div>`}
    <ol><li>The key is made in your browser with WebCrypto (Ed25519). We never see the private half.</li><li>Keep the key file somewhere safe (a password manager works). Lose it and you simply make a new one.</li><li>A signed export is two files: your data (JSON) and a signature. Verify them on /?v=verify or with any Ed25519 tool.</li></ol></div>`;
    const on = (sel, fn) => { const b = $(sel, host); if (b) b.onclick = fn; };
    on('[data-id-make]', async (e) => { e.currentTarget.disabled = true; rec = await makeKey(); download(`allofus-identity-key-${rec.did.slice(-8)}.json`, JSON.stringify(rec, null, 2)); toast('Key created. Your key file is downloading. Keep it safe.'); if (sb && me) { try { const { error } = await sb.from('profiles').update({ pubkey: rec.did }).eq('id', me.id); if (!error) saved = rec.did; } catch (er) { } } draw(); });
    on('[data-id-dl]', () => download(`allofus-identity-key-${rec.did.slice(-8)}.json`, JSON.stringify(rec, null, 2)));
    on('[data-id-pub]', async (e) => { e.currentTarget.disabled = true; try { const { error } = await sb.from('profiles').update({ pubkey: rec.did }).eq('id', me.id); if (error) throw error; saved = rec.did; toast('Public key saved to your profile'); } catch (er) { toast(/column|schema cache/i.test(er.message || '') ? 'Needs the v27 server update first.' : (er.message || 'Could not save')); } draw(); });
    on('[data-id-forget]', () => { if (!confirm('Remove the key from this device? Keep your downloaded key file if you want to sign again later.')) return; try { localStorage.removeItem(KEY); } catch (e) { } rec = null; draw(); });
    on('[data-id-sign]', async (e) => { const b = e.currentTarget; b.disabled = true; try { const F = await import('./aou-flat3.js'); const out = await F.exportMyData(F3); const text = JSON.stringify(out, null, 2); const bytes = new TextEncoder().encode(text); const sig = { format: 'allofus-signed-export/1', alg: 'Ed25519', did: rec.did, signed_at: new Date().toISOString(), payload_file: 'the JSON export downloaded with this file', payload_sha256: await sha256hex(bytes), signature_b64: await signBytes(rec, bytes), how_to_verify: 'Verify the Ed25519 signature over the exact UTF-8 bytes of the export file with the public key inside the did:key, or open https://allofus.one/?v=verify' }; download(`allofus-${me.username || 'me'}-${new Date().toISOString().slice(0, 10)}.sig.json`, JSON.stringify(sig, null, 2)); toast('Export and signature downloaded'); } catch (er) { toast('Could not sign: ' + (er.message || er)); } b.disabled = false; });
  };
  draw();
}

/* /?v=verify : pick the export + its .sig.json, verify locally */
export async function verifyView(body) {
  css();
  body.innerHTML = `<div class="ci-wrap" style="max-width:860px;margin:16px auto;padding:0 12px;display:grid;gap:14px;font-family:Poppins,Arial,sans-serif"><div class="fl-card idb"><h2 style="margin:0">Verify an allofus export</h2><p style="margin:0;color:#475569">Pick the two files a member downloaded: the data export (<code>allofus-…json</code>) and its signature (<code>…sig.json</code>). Everything happens in your browser; nothing is uploaded.</p>
  <label>Export file <input type="file" data-vf-data accept=".json,application/json"></label><label>Signature file <input type="file" data-vf-sig accept=".json,application/json"></label><div class="row"><button class="fl-btn p" type="button" data-vf-go>Verify</button></div><div data-vf-out></div>
  <p class="muted" style="font-size:12px;margin:0">Format: the signature file holds <code>did</code> (a did:key for an Ed25519 public key), <code>payload_sha256</code> and <code>signature_b64</code>, signed over the exact bytes of the export file. Any Ed25519 library can check it too.</p></div></div>`;
  const out = $('[data-vf-out]', body);
  $('[data-vf-go]', body).onclick = async () => {
    const fd = $('[data-vf-data]', body).files[0], fs = $('[data-vf-sig]', body).files[0]; if (!fd || !fs) { out.innerHTML = '<p class="bad">Pick both files first.</p>'; return; }
    try { const bytes = new Uint8Array(await fd.arrayBuffer()); const sig = JSON.parse(await fs.text()); if (!sig.did || !sig.signature_b64) throw new Error('That is not an allofus signature file.'); const hash = await sha256hex(bytes); const ok = await verifyBytes(sig.did, sig.signature_b64, bytes); let who = ''; try { const j = JSON.parse(new TextDecoder().decode(bytes)); who = j.account && (j.account.username || j.account.name) ? ` for @${j.account.username || j.account.name}` : ''; } catch (e) { }
      out.innerHTML = ok ? `<p class="ok">Valid. This export${esc(who)} was signed by <span class="did" style="display:inline">${esc(sig.did)}</span> on ${esc(String(sig.signed_at || '').slice(0, 10))}.</p><p class="muted" style="font-size:12px">SHA-256 ${esc(hash)}${sig.payload_sha256 && sig.payload_sha256 !== hash ? ' (differs from the hash recorded in the signature file)' : ''}</p>` : `<p class="bad">Not valid. The file was changed after signing, or the signature belongs to a different export or key.</p>`; }
    catch (e) { out.innerHTML = `<p class="bad">${esc(e.message || e)}</p>`; }
  };
}

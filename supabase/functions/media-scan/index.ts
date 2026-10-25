// allofus.one · media-scan · Supabase Edge Function (Deno) · v28 (video), Oct 25 2026 (v27 Oct 23)
// Server-side screening of EVERY upload, pictures AND videos (the browser check in js/aou-safety.js is a convenience; this is the control).
//
// Trigger: a database webhook on public.media_items INSERT (pg_net trigger safety_media_webhook_v27 in v27-security.sql,
//          or Dashboard → Database → Webhooks). Body: { type: 'INSERT', table: 'media_items', record: {...} }
// Auth:    header  x-aou-secret: <MEDIA_SCAN_SECRET>   (deploy with --no-verify-jwt; the secret is the gate)
// Reply:   202 at once; the scan runs in the background (EdgeRuntime.waitUntil) so a 50 MB video never hits the 8 s webhook timeout.
// Steps:   1. download the object with the service role; work out image / video / file from mime, extension and magic bytes
//          2. sha256 (+ 64-bit dHash for pictures) → public.media_hashes blocklist (sha256 exact, dHash near-duplicate)
//          3. classifier: Hive Visual Moderation (SCAN_PROVIDER=hive) or AWS Rekognition DetectModerationLabels
//             (SCAN_PROVIDER=rekognition). SCAN_PROVIDER=none → hash check only.
//             VIDEOS: Hive samples frames server-side and returns one result per frame; we take the worst frame.
//             Rekognition (video needs S3 + async jobs) and none have no video path: the video is held as 'review'
//             (= pending, visible only to its author) until a human approves it in Admin → Moderation.
//             Optional HIVE_CSAM_API_KEY: a second Hive project (Hive's CSAM detection with Thorn) called for every
//             picture and video; any positive is CSAM-class.
//          4. CSAM-class or hash hit → move the file to the private 'quarantine' bucket, then media_scan_result() does the rest
//             (status csam_suspect, evidence snapshot, account hold, incident row, founder alert, audit rows).
//             NSFW → quarantine + pending (human review). Clean → ok. Error / review → stays pending while
//             server_scan_required is on (fail closed), unchanged while it is off.
// Secrets (Supabase → Edge Functions → Secrets): MEDIA_SCAN_SECRET (required), SCAN_PROVIDER (hive|rekognition|none),
//   HIVE_API_KEY (+ optional HIVE_CSAM_API_KEY)  |  AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION,
//   optional RESEND_API_KEY + ALERT_EMAIL, MAX_SCANS_PER_DAY (default 3000), NSFW_THRESHOLD (default 0.70), CSAM_THRESHOLD (default 0.50).
// Never logs file bytes, member e-mails or raw IPs. Never re-transmits suspected CSAM anywhere except the classifier
// vendor you contracted for exactly that purpose (see SAFETY-RUNBOOK.md: 18 U.S.C. 2258A).
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const PROVIDER = env("SCAN_PROVIDER", "none").toLowerCase();
const NSFW_T = +env("NSFW_THRESHOLD", "0.70");
const CSAM_T = +env("CSAM_THRESHOLD", "0.50");
const MAX_DAY = +env("MAX_SCANS_PER_DAY", "3000");

// review = no classifier could look at it (video without Hive): held for a human, never auto-published while the flag is on
type Verdict = "ok" | "nsfw" | "csam" | "review" | "error";
type Result = { verdict: Verdict; provider: string; sha256?: string; phash?: string; scores?: Record<string, number>; note?: string; moved?: boolean; quarantine_path?: string; matched?: string[]; bytes?: number; kind?: string; frames?: number };
type Kind = "image" | "video" | "file";

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array) => hex(await crypto.subtle.digest("SHA-256", bytes));
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

/* image / video / file. The storage intake row can arrive without a mimetype (resumable uploads set it later), so the
   bytes decide when the label is missing or lies: ftyp box (mp4 / mov, except HEIC/AVIF stills), EBML (webm). */
function kindOf(bytes: Uint8Array, mime: string, path: string): Kind {
  const has = (o: number, sig: number[]) => sig.every((v, i) => bytes[o + i] === v);
  if (has(4, [0x66, 0x74, 0x79, 0x70])) { const brand = String.fromCharCode(...bytes.slice(8, 12)); return /^(heic|heix|mif1|msf1|avif)/.test(brand) ? "image" : /^(M4A|M4B)/.test(brand) ? "file" : "video"; }
  if (has(0, [0x1A, 0x45, 0xDF, 0xA3])) return "video";
  if (has(0, [0xFF, 0xD8, 0xFF]) || has(0, [0x89, 0x50, 0x4E, 0x47]) || has(0, [0x47, 0x49, 0x46, 0x38]) || (has(0, [0x52, 0x49, 0x46, 0x46]) && has(8, [0x57, 0x45, 0x42, 0x50]))) return "image";
  if (/^video\//.test(mime) || /\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(path)) return "video";
  if (/^image\//.test(mime) || /\.(jpe?g|png|gif|webp|heic|avif)$/i.test(path)) return "image";
  return "file";
}

/* 64-bit difference hash (dHash): grayscale 9x8, each bit = left pixel brighter than right. Robust to resize / re-encode,
   not to crops or mirrors. PDQ (256-bit, what NCMEC / Meta lists use) is reserved in media_hashes.pdq for when Zach has
   hash-list access; swap this function for a PDQ implementation then. */
async function dhash(bytes: Uint8Array): Promise<string | undefined> {
  try {
    const img = await Image.decode(bytes);
    const small = img.resize(9, 8);
    const g: number[] = [];
    for (let y = 1; y <= 8; y++) for (let x = 1; x <= 9; x++) { const [r, gg, b] = Image.colorToRGB(small.getPixelAt(x, y)); g.push(0.299 * r + 0.587 * gg + 0.114 * b); }
    let bits = 0n;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { bits <<= 1n; if (g[y * 9 + x] > g[y * 9 + x + 1]) bits |= 1n; }
    return bits.toString(16).padStart(16, "0");
  } catch (_) { return undefined; }
}
const hamming = (a: string, b: string) => { let x = BigInt("0x" + a) ^ BigInt("0x" + b); let n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

/* ---------- classifier: Hive Visual Moderation (pictures and videos) ---------- */
// One call for both: a picture returns one output entry, a video one entry per sampled frame. Each class keeps its worst frame.
async function hiveCall(key: string, bytes: Uint8Array, mime: string): Promise<{ ok: false; note: string } | { ok: true; scores: Record<string, number>; frames: number }> {
  const fd = new FormData(); fd.append("media", new Blob([bytes], { type: mime || "application/octet-stream" }), "upload");
  const r = await fetch("https://api.thehive.ai/api/v2/task/sync", { method: "POST", headers: { authorization: "token " + key }, body: fd });
  if (!r.ok) return { ok: false, note: "hive " + r.status };
  const j = await r.json();
  const outs: { classes?: { class: string; score: number }[] }[] = j?.status?.[0]?.response?.output ?? [];
  if (!outs.length) return { ok: false, note: "hive: empty result" };   // never read "no frames" as clean
  const scores: Record<string, number> = {};
  for (const o of outs) for (const c of o.classes ?? []) if (typeof c.score === "number" && c.score > (scores[c.class] ?? -1)) scores[c.class] = c.score;
  return { ok: true, scores, frames: outs.length };
}
// verdict from Hive's classes. A child being in a picture is NOT abuse (family photos are fine): CSAM-class means a
// CSAM / exploitation class, or a minor present AND sexual content in the same file.
function hiveVerdict(scores: Record<string, number>, csamProject = false): { verdict: Verdict; note?: string } {
  const max = (re: RegExp) => Math.max(0, ...Object.entries(scores).filter(([k]) => re.test(k)).map(([, v]) => v));
  const csamClass = csamProject ? max(/csam|child_exploit|match|positive/i) : max(/csam|child_exploit/i);
  const minor = max(/^yes_(minor|child|underage)|^(minor|child)_present/i);
  const nsfw = max(/^yes_(sexual_activity|sexual_intent|female_nudity|male_nudity|genitals|anus|breast)|general_nsfw/i);
  const csam = Math.max(csamClass, Math.min(minor, nsfw));
  if (csam >= CSAM_T) return { verdict: "csam", note: `hive csam ${csam.toFixed(2)}` + (csamClass >= CSAM_T ? "" : " (minor + sexual content)") };
  if (nsfw >= NSFW_T) return { verdict: "nsfw", note: `hive nsfw ${nsfw.toFixed(2)}` };
  return { verdict: "ok" };
}
async function hive(bytes: Uint8Array, mime: string): Promise<Partial<Result>> {
  const key = env("HIVE_API_KEY"); if (!key) return { verdict: "error", note: "HIVE_API_KEY missing" };
  const main = await hiveCall(key, bytes, mime);
  if (!main.ok) return { verdict: "error", note: main.note };
  const out: Partial<Result> = { scores: Object.fromEntries(Object.entries(main.scores).filter(([, v]) => v >= 0.05).map(([k, v]) => [k, +v.toFixed(3)])), frames: main.frames, ...hiveVerdict(main.scores) };
  // Hive's CSAM detection (Thorn Safer hash matching + classifier) is a separate project / key when your contract includes it.
  // Check its class names against the first real response in your Hive dashboard and adjust hiveVerdict() if they differ.
  const csamKey = env("HIVE_CSAM_API_KEY");
  if (csamKey && out.verdict !== "csam") {
    const c = await hiveCall(csamKey, bytes, mime);
    if (!c.ok) return { ...out, verdict: "error", note: "csam check failed: " + c.note };
    const v = hiveVerdict(c.scores, true);
    if (v.verdict === "csam") return { ...out, ...v, scores: { ...out.scores, ...Object.fromEntries(Object.entries(c.scores).map(([k, s]) => ["csam:" + k, +s.toFixed(3)])) } };
  }
  return out;
}

/* ---------- classifier: AWS Rekognition DetectModerationLabels (pictures only) ---------- */
async function rekognition(bytes: Uint8Array): Promise<Partial<Result>> {
  if (!env("AWS_ACCESS_KEY_ID") || !env("AWS_SECRET_ACCESS_KEY")) return { verdict: "error", note: "AWS keys missing" };
  if (bytes.byteLength > 5 * 1024 * 1024) { // Rekognition inline limit is 5 MB: downscale first
    try { const img = await Image.decode(bytes); const k = Math.min(1, 1600 / Math.max(img.width, img.height)); bytes = await img.resize(Math.round(img.width * k), Math.round(img.height * k)).encodeJPEG(85); } catch (_) { return { verdict: "error", note: "too large to downscale" }; }
  }
  const { RekognitionClient, DetectModerationLabelsCommand } = await import("npm:@aws-sdk/client-rekognition@3");
  const client = new RekognitionClient({ region: env("AWS_REGION", "us-east-1"), credentials: { accessKeyId: env("AWS_ACCESS_KEY_ID"), secretAccessKey: env("AWS_SECRET_ACCESS_KEY") } });
  const out = await client.send(new DetectModerationLabelsCommand({ Image: { Bytes: bytes }, MinConfidence: 40 }));
  const scores: Record<string, number> = {};
  for (const l of out.ModerationLabels ?? []) if (l.Name && l.Confidence) scores[l.Name] = +(l.Confidence / 100).toFixed(3);
  // Rekognition is NOT a CSAM detector (AWS states this). It flags explicit / nudity; CSAM must come from hash lists.
  const nsfwScore = Math.max(...Object.entries(scores).filter(([k]) => /^(Explicit|Explicit Nudity|Explicit Sexual Activity|Sex Toys|Non-Explicit Nudity of Intimate parts and Kissing|Graphic Male Nudity|Graphic Female Nudity|Sexual Activity)$/i.test(k)).map(([, v]) => v), 0);
  const verdict: Verdict = nsfwScore >= NSFW_T ? "nsfw" : "ok";
  return { verdict, scores, note: verdict === "ok" ? undefined : `rekognition ${verdict} ${nsfwScore.toFixed(2)}` };
}

async function alertEmail(subject: string, text: string) {
  const key = env("RESEND_API_KEY"), to = env("ALERT_EMAIL"); if (!key || !to) return;
  try { await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify({ from: "allofus.one safety <safety@allofus.one>", to: [to], subject, text }) }); } catch (_) { /* in-app notify() already fired */ }
}

async function scan(id: number) {
  // fresh row from the database (the webhook payload could be stale)
  const { data: m, error } = await admin.from("media_items").select("*").eq("id", id).maybeSingle();
  if (error || !m) return { ok: false, error: "no row" };
  if (m.bucket === "quarantine" || ["removed", "csam_suspect", "quarantined"].includes(m.status) || m.scanned_at) return { ok: true, skipped: m.status };

  // daily cost cap (counts scans done today)
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("media_items").select("id", { count: "exact", head: true }).gte("scanned_at", since.toISOString());
  const capped = (count ?? 0) >= MAX_DAY;

  const result: Result = { verdict: "error", provider: PROVIDER, kind: m.kind ?? undefined };
  try {
    const dl = await admin.storage.from(m.bucket).download(m.path);
    if (dl.error || !dl.data) throw new Error("download: " + (dl.error?.message ?? "empty"));
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const mime = m.mime ?? dl.data.type ?? "";
    const kind = kindOf(bytes, mime, m.path);
    result.kind = kind; result.bytes = bytes.byteLength;
    result.sha256 = await sha256(bytes);
    if (kind === "image") result.phash = await dhash(bytes);

    // 1. blocklist: exact sha256 (pictures, videos, files), then near-duplicate dHash for pictures (Hamming ≤ 6 of 64)
    const matched: string[] = [];
    const { data: exact } = await admin.from("media_hashes").select("sha256,label").eq("sha256", result.sha256).maybeSingle();
    if (exact) matched.push(exact.label + ":" + exact.sha256.slice(0, 12));
    if (!exact && result.phash) {
      const { data: near } = await admin.from("media_hashes").select("sha256,phash,label").not("phash", "is", null).limit(5000);
      for (const h of near ?? []) if (h.phash && hamming(h.phash, result.phash) <= 6) matched.push(h.label + ":~" + h.sha256.slice(0, 12));
    }
    if (matched.length) { result.matched = matched; result.verdict = matched.some((x) => x.startsWith("csam")) ? "csam" : "nsfw"; result.note = "hash blocklist match"; }
    // 2. classifier: pictures and videos; other files (PDF, text) are hash-checked only
    else if (kind === "file") { result.verdict = "ok"; result.note = "file: hash check only"; }
    else if (capped) { result.verdict = "error"; result.note = "daily scan cap reached"; }
    else if (PROVIDER === "hive") Object.assign(result, await hive(bytes, mime || (kind === "video" ? "video/mp4" : "image/jpeg")));
    else if (kind === "video") { result.verdict = "review"; result.note = "video held for human review (" + PROVIDER + " cannot scan video; Hive can)"; }
    else if (PROVIDER === "rekognition") Object.assign(result, await rekognition(bytes));
    else { result.verdict = "ok"; result.note = "no classifier configured (SCAN_PROVIDER=none): hash check only"; }

    // 3. quarantine the bytes BEFORE touching the row, so a public URL dies first
    if (result.verdict === "nsfw" || result.verdict === "csam") {
      const qpath = m.path;
      const up = await admin.storage.from("quarantine").upload(qpath, bytes, { contentType: mime || "application/octet-stream", upsert: true });
      if (!up.error) { const rm = await admin.storage.from(m.bucket).remove([m.path]); result.moved = !rm.error; result.quarantine_path = qpath; }
    }
  } catch (e) {
    result.verdict = "error"; result.note = String((e as Error)?.message ?? e).slice(0, 200);
  }

  const { data: applied, error: rpcErr } = await admin.rpc("media_scan_result", { p_media: id, p_result: result });
  if (result.verdict === "csam") await alertEmail("[allofus.one] CSAM-class upload: incident " + (applied?.incident_id ?? "?"), `media_items #${id} (${result.kind}) from user ${m.user_id}. File quarantined, account held, evidence preserved. Open Admin → Moderation and follow SAFETY-RUNBOOK.md (NCMEC CyberTipline within 24 h). Do not download or forward the file.`);
  if (result.verdict === "error" && !capped) console.warn("media-scan error", id, result.note);
  if (rpcErr) console.warn("media-scan rpc error", id, rpcErr.message);
  return { ok: !rpcErr, media_id: id, kind: result.kind, verdict: result.verdict, applied, error: rpcErr?.message };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = env("MEDIA_SCAN_SECRET");
  if (!secret || !safeEq(req.headers.get("x-aou-secret") ?? "", secret)) return new Response("forbidden", { status: 403 });
  let body: any = {}; try { body = await req.json(); } catch (_) { return new Response("bad json", { status: 400 }); }
  const rec = body?.record ?? body?.media ?? body;
  const id = Number(rec?.id); if (!id) return new Response("no id", { status: 400 });
  // ?wait=1 (manual tests, re-scans) answers with the verdict; the webhook gets 202 and the scan keeps running after the reply.
  const job = scan(id).catch((e) => { console.warn("media-scan crash", id, String(e).slice(0, 200)); return { ok: false, error: "crash" }; });
  const bg = (globalThis as any).EdgeRuntime;
  if (new URL(req.url).searchParams.get("wait") === "1" || !bg?.waitUntil) return Response.json(await job);
  bg.waitUntil(job);
  return Response.json({ ok: true, queued: id }, { status: 202 });
});

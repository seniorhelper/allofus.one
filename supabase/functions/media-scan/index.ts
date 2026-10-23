// allofus.one · media-scan · Supabase Edge Function (Deno) · v27, Oct 23 2026
// Server-side screening of EVERY upload (the browser check in js/aou-safety.js is a convenience; this is the control).
//
// Trigger: a database webhook on public.media_items INSERT (pg_net trigger safety_media_webhook_v27 in v27-security.sql,
//          or Dashboard → Database → Webhooks). Body: { type: 'INSERT', table: 'media_items', record: {...} }
// Auth:    header  x-aou-secret: <MEDIA_SCAN_SECRET>   (deploy with --no-verify-jwt; the secret is the gate)
// Steps:   1. download the object with the service role
//          2. sha256 + 64-bit dHash → public.media_hashes blocklist (sha256 exact, dHash near-duplicate)
//          3. classifier: Hive Visual Moderation (SCAN_PROVIDER=hive) or AWS Rekognition DetectModerationLabels
//             (SCAN_PROVIDER=rekognition). SCAN_PROVIDER=none → hash check only.
//          4. CSAM-class or hash hit → move the file to the private 'quarantine' bucket, then media_scan_result() does the rest
//             (status csam_suspect, evidence snapshot, account hold, incident row, founder alert, audit rows).
//             NSFW → quarantine + pending (human review). Clean → ok.
// Secrets (Supabase → Edge Functions → Secrets): MEDIA_SCAN_SECRET (required), SCAN_PROVIDER (hive|rekognition|none),
//   HIVE_API_KEY  |  AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION,  optional RESEND_API_KEY + ALERT_EMAIL,
//   optional MAX_SCANS_PER_DAY (default 3000), NSFW_THRESHOLD (default 0.70), CSAM_THRESHOLD (default 0.50).
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

type Verdict = "ok" | "nsfw" | "csam" | "error";
type Result = { verdict: Verdict; provider: string; sha256?: string; phash?: string; scores?: Record<string, number>; note?: string; moved?: boolean; quarantine_path?: string; matched?: string[]; bytes?: number; kind?: string };

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: Uint8Array) => hex(await crypto.subtle.digest("SHA-256", bytes));
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

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

/* ---------- classifier: Hive Visual Moderation ---------- */
async function hive(bytes: Uint8Array, mime: string): Promise<Partial<Result>> {
  const key = env("HIVE_API_KEY"); if (!key) return { verdict: "error", note: "HIVE_API_KEY missing" };
  const fd = new FormData(); fd.append("media", new Blob([bytes], { type: mime || "application/octet-stream" }), "upload");
  const r = await fetch("https://api.thehive.ai/api/v2/task/sync", { method: "POST", headers: { authorization: "token " + key }, body: fd });
  if (!r.ok) return { verdict: "error", note: "hive " + r.status };
  const j = await r.json();
  const classes: { class: string; score: number }[] = j?.status?.[0]?.response?.output?.[0]?.classes ?? [];
  const scores: Record<string, number> = {}; for (const c of classes) if (c.score >= 0.05) scores[c.class] = +c.score.toFixed(3);
  // Hive's visual moderation taxonomy (yes_* classes). CSAM detection proper is Hive's separate CSAM product (with Thorn):
  // it returns a match flag; map it here when enabled on your account. Adjust these patterns after reading your contract's class list.
  const csamScore = Math.max(...classes.filter((c) => /csam|child_exploit|yes_minor|underage/i.test(c.class)).map((c) => c.score), 0);
  const nsfwScore = Math.max(...classes.filter((c) => /^yes_(sexual_activity|sexual_intent|female_nudity|male_nudity|genitals|anus)|general_nsfw/i.test(c.class)).map((c) => c.score), 0);
  const verdict: Verdict = csamScore >= CSAM_T ? "csam" : nsfwScore >= NSFW_T ? "nsfw" : "ok";
  return { verdict, scores, note: verdict === "ok" ? undefined : `hive ${verdict} ${(verdict === "csam" ? csamScore : nsfwScore).toFixed(2)}` };
}

/* ---------- classifier: AWS Rekognition DetectModerationLabels ---------- */
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = env("MEDIA_SCAN_SECRET");
  if (!secret || !safeEq(req.headers.get("x-aou-secret") ?? "", secret)) return new Response("forbidden", { status: 403 });
  let body: any = {}; try { body = await req.json(); } catch (_) { return new Response("bad json", { status: 400 }); }
  const rec = body?.record ?? body?.media ?? body;
  const id = Number(rec?.id); if (!id) return new Response("no id", { status: 400 });

  // fresh row from the database (the webhook payload could be stale)
  const { data: m, error } = await admin.from("media_items").select("*").eq("id", id).maybeSingle();
  if (error || !m) return Response.json({ ok: false, error: "no row" }, { status: 404 });
  if (m.bucket === "quarantine" || ["removed", "csam_suspect", "quarantined"].includes(m.status) || m.scanned_at) return Response.json({ ok: true, skipped: m.status });

  // daily cost cap (counts scans done today)
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("media_items").select("id", { count: "exact", head: true }).gte("scanned_at", since.toISOString());
  const capped = (count ?? 0) >= MAX_DAY;

  const result: Result = { verdict: "error", provider: PROVIDER, kind: m.kind ?? undefined };
  try {
    const dl = await admin.storage.from(m.bucket).download(m.path);
    if (dl.error || !dl.data) throw new Error("download: " + (dl.error?.message ?? "empty"));
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    result.bytes = bytes.byteLength;
    result.sha256 = await sha256(bytes);
    const isImage = (m.mime ?? dl.data.type ?? "").startsWith("image/") || m.kind === "image";
    if (isImage) result.phash = await dhash(bytes);

    // 1. blocklist: exact sha256, then near-duplicate dHash (Hamming ≤ 6 of 64)
    const matched: string[] = [];
    const { data: exact } = await admin.from("media_hashes").select("sha256,label").eq("sha256", result.sha256).maybeSingle();
    if (exact) matched.push(exact.label + ":" + exact.sha256.slice(0, 12));
    if (!exact && result.phash) {
      const { data: near } = await admin.from("media_hashes").select("sha256,phash,label").not("phash", "is", null).limit(5000);
      for (const h of near ?? []) if (h.phash && hamming(h.phash, result.phash) <= 6) matched.push(h.label + ":~" + h.sha256.slice(0, 12));
    }
    if (matched.length) { result.matched = matched; result.verdict = matched.some((x) => x.startsWith("csam")) ? "csam" : "nsfw"; result.note = "hash blocklist match"; }
    // 2. classifier (images only; videos: hash check only, flagged for human review when the flag is on)
    else if (!isImage) { result.verdict = "ok"; result.note = "video/file: hash check only (no server frame sampling yet)"; }
    else if (capped) { result.verdict = "error"; result.note = "daily scan cap reached"; }
    else if (PROVIDER === "hive") Object.assign(result, await hive(bytes, m.mime ?? dl.data.type));
    else if (PROVIDER === "rekognition") Object.assign(result, await rekognition(bytes));
    else { result.verdict = "ok"; result.note = "no classifier configured (SCAN_PROVIDER=none): hash check only"; }

    // 3. quarantine the bytes BEFORE touching the row, so a public URL dies first
    if (result.verdict === "nsfw" || result.verdict === "csam") {
      const qpath = m.path;
      const up = await admin.storage.from("quarantine").upload(qpath, bytes, { contentType: m.mime ?? dl.data.type ?? "application/octet-stream", upsert: true });
      if (!up.error) { const rm = await admin.storage.from(m.bucket).remove([m.path]); result.moved = !rm.error; result.quarantine_path = qpath; }
    }
  } catch (e) {
    result.verdict = "error"; result.note = String((e as Error)?.message ?? e).slice(0, 200);
  }

  const { data: applied, error: rpcErr } = await admin.rpc("media_scan_result", { p_media: id, p_result: result });
  if (result.verdict === "csam") await alertEmail("[allofus.one] CSAM-class upload: incident " + (applied?.incident_id ?? "?"), `media_items #${id} from user ${m.user_id}. File quarantined, account held, evidence preserved. Open Admin → Moderation and follow SAFETY-RUNBOOK.md (NCMEC CyberTipline within 24 h). Do not download or forward the file.`);
  if (result.verdict === "error" && !capped) console.warn("media-scan error", id, result.note);
  return Response.json({ ok: !rpcErr, media_id: id, verdict: result.verdict, applied, error: rpcErr?.message });
});

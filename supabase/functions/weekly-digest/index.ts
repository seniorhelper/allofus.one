// allofus.one · weekly-digest · Supabase Edge Function (Deno) · v27, Oct 23 2026
// Sends the Sunday digest to members who opted in (profiles.email_optin): new members, the top posts, this week's
// spark, one feature spotlight, and a one-click unsubscribe link (public.unsubscribe(token) RPC, see v27-growth.sql).
// Triggers: pg_cron via pg_net with header x-cron-secret: <CRON_SECRET> (schedule in v27-growth.sql), or
// { test: true } from a signed-in ADMIN: the digest goes to that admin only.
// Secrets: RESEND_API_KEY, CRON_SECRET. Optional MAIL_FROM. Deploy with --no-verify-jwt. No tracking pixels; no logging of addresses.
import { createClient } from "npm:@supabase/supabase-js@2";

const FOUNDER = "320bf5d4-2d2d-482e-8633-87ced55e4155"; // public.is_admin() = this uuid (allofus-v22-lockdown.sql)
const FROM = Deno.env.get("MAIL_FROM") ?? "allofus <hello@allofus.one>";
const SITE = "https://allofus.one";
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://allofus.one", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// The same 125 prompts live in js/aou-lifespark.js; this short list rotates by ISO week so the mail matches the site's
// Sunday spark closely enough without importing browser code. Keep both original.
const SPARKS = [
  "What did you do this week that your younger self would be proud of?",
  "Who helped you last month without being asked? Send them one line today.",
  "What is one habit you kept this year, and what did keeping it teach you?",
  "What question do customers ask you most often? Write the answer in two sentences and post it.",
  "Name three things your hands did for you today before noon.",
  "What are you carrying that was never yours to carry?",
  "Write a six-word story about your neighborhood.",
  "What is a small win from this week that nobody else noticed?",
  "What would you tell a friend who was in your exact situation today?",
  "Which part of today are you most likely to remember in ten years?",
  "What is one thing you want less of in your feed, and in your life?",
  "Teach someone one small thing today: a shortcut, a recipe, a route.",
  "What does rest look like when it is real and not just scrolling?",
];
const FEATURES: [string, string, string][] = [
  ["Circles", "Share with Family, Inner Tribe, Professional or Local only. Audiences never mix.", "/?v=circles"],
  ["LIFEspark", "A daily spark, three tiny wins and two minutes of breath.", "/?v=spark"],
  ["Grow your business", "Free listings, a press release builder and 60-second lead follow-up.", "/?v=grow"],
  ["Unity Call", "Free video calls with one link. No download, no time limit.", "/meet/"],
  ["Discover", "NASA, Wikipedia and world news, with the source on every card.", "/?v=discover"],
  ["Courses", "Teach what you know in five short lessons, free.", "/?v=courses"],
  ["3D world", "Walk the world in your browser. Bring a headset for VR.", "/world/"],
  ["Your data", "One-click export, and now a key only you hold to sign it.", "/?v=mydata"],
];
const weekNo = () => Math.floor(Date.now() / (7 * 864e5));

export function digestHTML(name: string, d: any, unsubUrl: string) {
  const first = esc((name || "friend").split(" ")[0]);
  const spark = SPARKS[weekNo() % SPARKS.length]; const [fn, fd, fh] = FEATURES[weekNo() % FEATURES.length];
  const names: string[] = Array.isArray(d.new_names) ? d.new_names : [];
  const top: any[] = Array.isArray(d.top_posts) ? d.top_posts : [];
  const a = (h: string, t: string) => `<a href="${SITE}${h}" style="color:#0369a1">${t}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#0b1a3a;color:#fff;border-radius:18px 18px 0 0;padding:22px 24px"><div style="font:800 22px Arial">allofus<span style="color:#38f0ff">.one</span></div><div style="color:#cbd5e1;font-size:13px;margin-top:4px">this week, in one short email</div></div>
  <div style="background:#fff;border-radius:0 0 18px 18px;padding:24px;line-height:1.55;font-size:15px">
    <p style="margin:0 0 14px">Hi ${first}. Here is the week on allofus.one.</p>
    <h3 style="margin:0 0 6px;font-size:15px;color:#0b1a3a">New this week</h3>
    <p style="margin:0 0 14px">${Number(d.new_members || 0)} ${Number(d.new_members) === 1 ? "person" : "people"} joined${names.length ? ", including " + names.map(esc).join(", ") : ""}. ${Number(d.posts || 0)} public posts. ${a("/?v=search", "Say hi to someone new")}.</p>
    ${top.length ? `<h3 style="margin:0 0 6px;font-size:15px;color:#0b1a3a">Posts people talked about</h3><ul style="margin:0 0 14px;padding-left:20px">${top.map((p) => `<li style="margin-bottom:6px"><b>${esc(p.who)}</b>: ${esc(String(p.text || "").slice(0, 140))}${String(p.text || "").length > 140 ? "…" : ""} ${a("/?post=" + encodeURIComponent(p.id), "open")}</li>`).join("")}</ul>` : ""}
    <h3 style="margin:0 0 6px;font-size:15px;color:#0b1a3a">This week's spark</h3>
    <p style="margin:0 0 14px;font-size:16px"><i>${esc(spark)}</i><br><span style="font-size:13px;color:#475569">Answer it on your feed, or in ${a("/?v=spark", "LIFEspark")}.</span></p>
    <h3 style="margin:0 0 6px;font-size:15px;color:#0b1a3a">Did you know: ${esc(fn)}</h3>
    <p style="margin:0 0 18px">${esc(fd)} ${a(fh, "Open " + fn)}</p>
    <p style="margin:0;font-size:13px;color:#475569">${Number(d.brand_pages || 0)} Brand pages so far. Run a business? ${a("/?v=grow", "Grow your business")} is free.</p>
  </div>
  <p style="font-size:11.5px;color:#64748b;line-height:1.5;margin:14px 6px 0">You asked for the occasional allofus update when you signed up. <a href="${unsubUrl}" style="color:#64748b">Unsubscribe in one click</a> · <a href="${SITE}/privacy/" style="color:#64748b">Privacy</a><br>Eye To Ad Media · 1001 Bannock St #660, Denver, CO 80204</p>
</div></body></html>`;
}

async function sendBatch(list: { to: string; subject: string; html: string }[]) {
  const key = Deno.env.get("RESEND_API_KEY"); if (!key) throw new Error("RESEND_API_KEY not set");
  const r = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(list.map((m) => ({ from: FROM, to: [m.to], subject: m.subject, html: m.html, reply_to: "info@eyetoad.com" }))) });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any = {}; try { body = await req.json(); } catch (_) { body = {}; }

  let recipients: { email: string; display_name: string; unsub_token: string }[] = [];
  const cron = Deno.env.get("CRON_SECRET") ?? "";
  if (body.test) {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(token); if (!data?.user?.id) return json({ error: "auth" }, 401);
    if (data.user.id !== FOUNDER) return json({ error: "admins only" }, 403);
    const { data: rows } = await admin.rpc("aou_member_mail", { p_user: data.user.id });
    const m = Array.isArray(rows) ? rows[0] : rows; if (!m?.email) return json({ error: "no email on your account" }, 400);
    recipients = [{ email: m.email, display_name: m.display_name, unsub_token: m.unsub_token }];
  } else if (cron && req.headers.get("x-cron-secret") === cron) {
    const { data, error } = await admin.rpc("aou_digest_recipients"); if (error) return json({ error: "run v27-growth.sql: " + error.message }, 500);
    recipients = (data ?? []) as any[];
  } else return json({ error: "forbidden" }, 403);

  const { data: d, error: de } = await admin.rpc("aou_digest_data"); if (de) return json({ error: "digest data: " + de.message }, 500);
  const subject = `This week on allofus.one: ${Number(d.new_members || 0)} new ${Number(d.new_members) === 1 ? "member" : "members"}, a spark, and one thing to try`;
  let sent = 0; const errors: string[] = [];
  for (let i = 0; i < recipients.length; i += 50) {
    const chunk = recipients.slice(i, i + 50).map((m) => ({ to: m.email, subject, html: digestHTML(m.display_name, d, `${SITE}/?unsub=${encodeURIComponent(m.unsub_token)}`) }));
    try { await sendBatch(chunk); sent += chunk.length; } catch (e) { errors.push(String((e as Error).message)); }
  }
  return json({ ok: errors.length === 0, message: `Digest sent to ${sent} of ${recipients.length}${body.test ? " (test, you only)" : ""}.`, errors });
});

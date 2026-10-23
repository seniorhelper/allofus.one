// allofus.one · welcome-mail · Supabase Edge Function (Deno) · v27, Oct 23 2026
// Sends ONE warm welcome email when a profile row is created. Triggered by a Database Webhook
// (Database -> Webhooks -> table public.profiles, event INSERT, HTTP request to this function with header
// x-webhook-secret: <WEBHOOK_SECRET>). Also accepts { test: true, user_id } from a signed-in ADMIN (the admin panel button).
// Secrets: RESEND_API_KEY, WEBHOOK_SECRET. Optional: MAIL_FROM (default "allofus <hello@allofus.one>").
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected. Deploy with --no-verify-jwt (the webhook has no user JWT);
// the shared secret and the admin check are the auth. No tracking pixels. Never logs email addresses.
import { createClient } from "npm:@supabase/supabase-js@2";

const FOUNDER = "320bf5d4-2d2d-482e-8633-87ced55e4155"; // public.is_admin() = this uuid (allofus-v22-lockdown.sql)
const FROM = Deno.env.get("MAIL_FROM") ?? "allofus <hello@allofus.one>";
const SITE = "https://allofus.one";
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://allofus.one", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function welcomeHTML(name: string, unsubUrl: string, optin: boolean) {
  const first = esc((name || "friend").split(" ")[0]);
  const btn = (href: string, label: string) => `<a href="${href}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;padding:12px 18px;border-radius:12px">${label}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#0b1a3a;color:#fff;border-radius:18px 18px 0 0;padding:22px 24px"><div style="font:800 22px Arial">allofus<span style="color:#38f0ff">.one</span></div><div style="color:#cbd5e1;font-size:13px;margin-top:4px">the social network you control</div></div>
  <div style="background:#fff;border-radius:0 0 18px 18px;padding:24px;line-height:1.55;font-size:15px">
    <p style="margin:0 0 12px;font-size:18px"><b>Welcome in, ${first}.</b></p>
    <p style="margin:0 0 14px">You just joined a network with no ad trackers, a feed that is newest-first, and audiences that never mix. Here are three good first moves:</p>
    <ol style="margin:0 0 16px;padding-left:20px">
      <li style="margin-bottom:8px"><b>Set up your Circles.</b> Family, Inner Tribe, Professional, Local. Put a few people in each and post to one circle only. <a href="${SITE}/?v=circles" style="color:#0369a1">Open Circles</a></li>
      <li style="margin-bottom:8px"><b>Say the first thing.</b> A photo, a question, something you are working on. There is no algorithm deciding who sees it; your connections and circles do.</li>
      <li style="margin-bottom:8px"><b>Try LIFEspark.</b> A daily spark, three tiny wins and two minutes of breath. <a href="${SITE}/?v=spark" style="color:#0369a1">Open LIFEspark</a></li>
    </ol>
    <p style="margin:0 0 18px">Not sure where things are? The tour takes two minutes.</p>
    <p style="margin:0 0 20px">${btn(SITE + "/?tour=1", "Take the tour")}</p>
    <p style="margin:0 0 6px;font-size:13px;color:#475569">Run a business? Your free Brand page and the Grow launchpad are at <a href="${SITE}/?v=grow" style="color:#0369a1">allofus.one/?v=grow</a>.</p>
    <p style="margin:0;font-size:13px;color:#475569">Questions: reply to this email, or call 1-800-481-8638. A person answers.</p>
  </div>
  <p style="font-size:11.5px;color:#64748b;line-height:1.5;margin:14px 6px 0">You are getting this one-time welcome because you created an account on allofus.one. ${optin ? "You also said yes to the occasional update; a short digest goes out on Sundays." : "You did not opt in to updates, so this is the only email you will get from us apart from account notices."} <a href="${unsubUrl}" style="color:#64748b">Unsubscribe from updates</a> · <a href="${SITE}/privacy/" style="color:#64748b">Privacy</a><br>Eye To Ad Media · 1001 Bannock St #660, Denver, CO 80204</p>
</div></body></html>`;
}

async function send(to: string, subject: string, html: string, unsubUrl?: string) {
  const key = Deno.env.get("RESEND_API_KEY"); if (!key) throw new Error("RESEND_API_KEY not set");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: "info@eyetoad.com", headers: { "List-Unsubscribe": `<${unsubUrl || SITE + "/?unsub=1"}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }) });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any = {}; try { body = await req.json(); } catch (_) { return json({ error: "bad_json" }, 400); }

  let userId = "";
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  if (req.headers.get("x-webhook-secret") && secret && req.headers.get("x-webhook-secret") === secret) {
    // Database Webhook payload: { type: 'INSERT', table: 'profiles', record: { id, ... } }
    if (body.type !== "INSERT" || body.table !== "profiles" || !body.record?.id) return json({ ok: true, skipped: "not a profile insert" });
    userId = String(body.record.id);
  } else if (body.test) {
    // admin test: the caller must be a signed-in admin; the mail goes to the caller only
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(token); if (!data?.user?.id) return json({ error: "auth" }, 401);
    if (data.user.id !== FOUNDER) return json({ error: "admins only" }, 403);
    userId = data.user.id;
  } else return json({ error: "forbidden" }, 403);

  const { data: rows, error } = await admin.rpc("aou_member_mail", { p_user: userId });
  if (error) return json({ error: "run v27-growth.sql: " + error.message }, 500);
  const m = Array.isArray(rows) ? rows[0] : rows; if (!m?.email) return json({ ok: true, skipped: "no email" });
  const unsub = `${SITE}/?unsub=${encodeURIComponent(m.unsub_token)}`;
  try {
    const r = await send(m.email, "Welcome to allofus.one: three good first moves", welcomeHTML(m.display_name, unsub, !!m.email_optin), unsub);
    return json({ ok: true, message: "Welcome email sent.", id: r?.id });
  } catch (e) { return json({ error: String((e as Error).message) }, 502); }
});

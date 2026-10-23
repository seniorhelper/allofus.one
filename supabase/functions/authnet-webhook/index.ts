// allofus.one · Authorize.net webhook · Supabase Edge Function (Deno) · Oct 23 2026
// Authorize.net POSTs here when a payment settles. We verify the signature, look up the order reference,
// and mark the ad order paid (which creates the live ad) through public.ad_order_paid_by_ref().
//
// URL to give Authorize.net:  https://izfccjaznlcffvjxawya.supabase.co/functions/v1/authnet-webhook
// Deploy with --no-verify-jwt (Authorize.net cannot send a Supabase JWT):
//     supabase functions deploy authnet-webhook --no-verify-jwt
//
// Secrets (Supabase -> Edge Functions -> Secrets):
//   AUTHNET_SIGNATURE_KEY   Authorize.net Merchant Interface -> Account -> Settings -> Security Settings -> API Credentials & Keys
//                           -> "Signature Key" (Obtain). 128 hex characters. Webhooks are signed with it.
//   AUTHNET_API_LOGIN_ID    same page: API Login ID. Used to read the transaction and find our order reference.
//   AUTHNET_TRANSACTION_KEY same page: Transaction Key (Obtain).
//   AUTHNET_SANDBOX         "1" while testing against the sandbox; unset / "0" in production.
//   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.
//
// How the order is matched: the Accept Hosted page is created (functions/authnet-hosted) with refId = invoiceNumber =
// our order ref (AOU-XXXXXXX). On the webhook we take payload.id (transId), call getTransactionDetails and read
// transaction.order.invoiceNumber (fallbacks: refId, description, payload.invoiceNumber, payload.merchantReferenceId).
//
// Signature: header X-ANET-Signature = "sha512=" + HMAC-SHA512(rawBody, SignatureKey as ASCII text), uppercase hex.
// We compare constant-time, case-insensitive. Unsigned or wrongly signed requests get 401 and are never processed.
// Events handled: net.authorize.payment.authcapture.created, net.authorize.payment.priorAuthCapture.created,
//                 net.authorize.payment.capture.created  -> paid + live
//                 net.authorize.payment.refund.created, net.authorize.payment.void.created -> refunded (ad off)
// Everything else -> 200 { ignored: true } (Authorize.net retries on non-2xx, so unknown events must still 200).
import { createClient } from "npm:@supabase/supabase-js@2";

const SIG_KEY = Deno.env.get("AUTHNET_SIGNATURE_KEY") ?? "";
const LOGIN = Deno.env.get("AUTHNET_API_LOGIN_ID") ?? "";
const TKEY = Deno.env.get("AUTHNET_TRANSACTION_KEY") ?? "";
const SANDBOX = (Deno.env.get("AUTHNET_SANDBOX") ?? "0") === "1";
const API = SANDBOX ? "https://apitest.authorize.net/xml/v1/request.api" : "https://api.authorize.net/xml/v1/request.api";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sameCI = (a: string, b: string) => { // constant-time, case-insensitive
  const x = a.toLowerCase(), y = b.toLowerCase(); if (x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0;
};
async function verify(raw: string, header: string | null): Promise<boolean> {
  if (!SIG_KEY || !header) return false;
  const given = header.replace(/^sha512=/i, "").trim();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SIG_KEY), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return sameCI(mac, given);
}
const REF = /AOU-[A-Z0-9]{5,9}/i;
async function findRef(transId: string, payload: Record<string, unknown>): Promise<{ ref: string | null; amount: number | null }> {
  // 1. straight from the payload when present
  for (const k of ["invoiceNumber", "merchantReferenceId", "refId", "description"]) {
    const v = payload[k]; if (typeof v === "string" && REF.test(v)) return { ref: (v.match(REF) as RegExpMatchArray)[0].toUpperCase(), amount: Number(payload.authAmount ?? null) || null };
  }
  // 2. ask Authorize.net for the transaction (needs API login + transaction key)
  if (!LOGIN || !TKEY) return { ref: null, amount: null };
  const body = { getTransactionDetailsRequest: { merchantAuthentication: { name: LOGIN, transactionKey: TKEY }, transId } };
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const txt = (await r.text()).replace(/^﻿/, ""); // Authorize.net prefixes a BOM
  let j: Record<string, unknown> = {}; try { j = JSON.parse(txt); } catch { return { ref: null, amount: null }; }
  const t = (j.transaction ?? {}) as Record<string, unknown>; const order = (t.order ?? {}) as Record<string, unknown>;
  for (const v of [order.invoiceNumber, order.description, j.refId, t.refId]) {
    if (typeof v === "string" && REF.test(v)) return { ref: (v.match(REF) as RegExpMatchArray)[0].toUpperCase(), amount: Number(t.settleAmount ?? t.authAmount ?? null) || null };
  }
  return { ref: null, amount: Number(t.settleAmount ?? t.authAmount ?? null) || null };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true, service: "authnet-webhook" });
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("X-ANET-Signature")))) return json({ error: "bad signature" }, 401);
  let ev: Record<string, unknown>; try { ev = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }
  const type = String(ev.eventType ?? ""); const payload = (ev.payload ?? {}) as Record<string, unknown>;
  const transId = String(payload.id ?? ""); const responseCode = Number(payload.responseCode ?? 1);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  if (/^net\.authorize\.payment\.(authcapture|priorAuthCapture|capture)\.created$/.test(type)) {
    if (responseCode !== 1) return json({ ignored: true, reason: "not approved" });
    const { ref, amount } = await findRef(transId, payload);
    if (!ref) { console.warn("authnet: paid transaction without an AOU ref", transId); return json({ ignored: true, reason: "no ref", transId }); }
    // amount check: the order amount must match what was charged (cents)
    const { data: order } = await sb.from("ad_orders").select("id, amount_cents, status").eq("ref", ref).maybeSingle();
    if (!order) return json({ ignored: true, reason: "unknown ref", ref });
    if (amount != null && Math.round(amount * 100) !== order.amount_cents) { console.warn("authnet: amount mismatch", ref, amount, order.amount_cents); await sb.from("ad_orders").update({ note: `Card payment of $${amount} did not match order total; check Authorize.net transaction ${transId}`, authnet_trans_id: transId, pay_method: "card" }).eq("id", order.id); return json({ held: true, ref }); }
    const { data, error } = await sb.rpc("ad_order_paid_by_ref", { p_ref: ref, p_trans: transId });
    if (error) { console.error("authnet: rpc", error.message); return json({ error: "db" }, 500); }
    return json({ ok: true, ref, order: data });
  }
  if (/^net\.authorize\.payment\.(refund|void)\.created$/.test(type)) {
    const refTrans = String(payload.refTransId ?? payload.id ?? "");
    if (refTrans) {
      const { data: o } = await sb.from("ad_orders").select("id").eq("authnet_trans_id", refTrans).maybeSingle();
      if (o) {
        await sb.from("ad_orders").update({ status: "refunded", note: `${type.includes("void") ? "Voided" : "Refunded"} in Authorize.net (${transId})`, updated_at: new Date().toISOString() }).eq("id", o.id);
        await sb.from("ads").update({ status: "off", ends_at: new Date().toISOString() }).eq("order_id", o.id);
        return json({ ok: true, refunded: o.id });
      }
    }
    return json({ ignored: true, reason: "no matching order" });
  }
  return json({ ignored: true, type });
});

// allofus.one · Authorize.net Accept Hosted token · Supabase Edge Function (Deno) · Oct 23 2026
// The member's browser never sees a card field on our pages. This function asks Authorize.net for a one-time
// Accept Hosted token for ONE order (amount read from our database, never from the client) and the browser posts
// that token to https://accept.authorize.net/payment/payment, Authorize.net's own hosted page.
//
// POST { ref: "AOU-XXXXXXX" }  with the member's Supabase JWT (Authorization: Bearer ...; the client sends it by default)
// -> 200 { token, action }     action = the hosted page URL to POST the token to
// -> 4xx { error }
//
// Set in js/aou-config.js:  AUTHNET_PAY_URL: 'https://izfccjaznlcffvjxawya.supabase.co/functions/v1/authnet-hosted'
// Secrets: AUTHNET_API_LOGIN_ID, AUTHNET_TRANSACTION_KEY, optional AUTHNET_SANDBOX="1".
// Deploy:  supabase functions deploy authnet-hosted      (JWT verification ON: only signed-in members can start a payment)
import { createClient } from "npm:@supabase/supabase-js@2";

const LOGIN = Deno.env.get("AUTHNET_API_LOGIN_ID") ?? "";
const TKEY = Deno.env.get("AUTHNET_TRANSACTION_KEY") ?? "";
const SANDBOX = (Deno.env.get("AUTHNET_SANDBOX") ?? "0") === "1";
const API = SANDBOX ? "https://apitest.authorize.net/xml/v1/request.api" : "https://api.authorize.net/xml/v1/request.api";
const ACTION = SANDBOX ? "https://test.authorize.net/payment/payment" : "https://accept.authorize.net/payment/payment";
const ORIGINS = ["https://allofus.one", "https://www.allofus.one"];
const cors = (o: string | null) => ({ "Access-Control-Allow-Origin": o && (ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o)) ? o : "https://allofus.one", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" });
const json = (b: unknown, s: number, o: string | null) => new Response(JSON.stringify(b), { status: s, headers: { ...cors(o), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  if (!LOGIN || !TKEY) return json({ error: "Card checkout is not connected yet. Use Invoice me." }, 503, origin);
  let ref = ""; try { ref = String((await req.json()).ref ?? "").toUpperCase().trim(); } catch { /* no body */ }
  if (!/^AOU-[A-Z0-9]{5,9}$/.test(ref)) return json({ error: "bad ref" }, 400, origin);
  // the caller must own the order (RLS does this for us when we use their JWT)
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: o, error } = await sb.from("ad_orders").select("id, ref, amount_cents, status, headline, plan, days").eq("ref", ref).maybeSingle();
  if (error || !o) return json({ error: "order not found" }, 404, origin);
  if (o.status !== "awaiting_payment") return json({ error: "this order is " + o.status.replace("_", " ") }, 409, origin);
  const amount = (o.amount_cents / 100).toFixed(2);
  const body = { getHostedPaymentPageRequest: {
    merchantAuthentication: { name: LOGIN, transactionKey: TKEY },
    refId: o.ref,
    transactionRequest: { transactionType: "authCaptureTransaction", amount, order: { invoiceNumber: o.ref, description: `allofus.one ad · ${o.plan} · ${String(o.headline ?? "").slice(0, 200)}` } },
    hostedPaymentSettings: { setting: [
      { settingName: "hostedPaymentReturnOptions", settingValue: JSON.stringify({ showReceipt: true, url: `https://allofus.one/?v=marketing&paid=${o.ref}`, urlText: "Back to my Marketing dash", cancelUrl: "https://allofus.one/?v=marketing", cancelUrlText: "Cancel" }) },
      { settingName: "hostedPaymentButtonOptions", settingValue: JSON.stringify({ text: "Pay $" + amount }) },
      { settingName: "hostedPaymentOrderOptions", settingValue: JSON.stringify({ show: true, merchantName: "allofus.one · Eye To Ad Media" }) },
      { settingName: "hostedPaymentPaymentOptions", settingValue: JSON.stringify({ cardCodeRequired: true, showCreditCard: true, showBankAccount: false }) },
      { settingName: "hostedPaymentBillingAddressOptions", settingValue: JSON.stringify({ show: true, required: false }) },
      { settingName: "hostedPaymentCustomerOptions", settingValue: JSON.stringify({ showEmail: true, requiredEmail: true, addPaymentProfile: false }) },
      { settingName: "hostedPaymentSecurityOptions", settingValue: JSON.stringify({ captcha: false }) },
    ] },
  } };
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const txt = (await r.text()).replace(/^﻿/, "");
  let j: Record<string, unknown> = {}; try { j = JSON.parse(txt); } catch { return json({ error: "gateway" }, 502, origin); }
  const token = (j as { token?: string }).token;
  if (!token) { console.error("authnet hosted", JSON.stringify((j as { messages?: unknown }).messages ?? j).slice(0, 300)); return json({ error: "Could not start the card payment. Use Invoice me or call 1-800-481-8638." }, 502, origin); }
  await sb.from("ad_orders").update({ pay_method: "card" }).eq("id", o.id);
  return json({ token, action: ACTION, amount }, 200, origin);
});

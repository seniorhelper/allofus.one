// allofus.one · "Ask allofus" AI guide · Supabase Edge Function (Deno) · Oct 23 2026
// POST { q: string, history?: [{role:'user'|'assistant', content:string}], page?: string, mode?: 'guide' | 'spark' }
// mode 'spark' (v27; 'muse' is accepted as a silent alias) = LIFEspark's "Ask allofus": a warm, non-clinical thinking partner
// for ideas, plans and creative blocks. Same limits, same safety rules, max 500 tokens, no memory between visits.
// -> 200 { answer: string, chips?: string[] }    429 { error:'rate' }    4xx/5xx { error }
// Secrets: ANTHROPIC_API_KEY (set by Zach in Supabase -> Edge Functions -> Secrets). Optional GUIDE_SALT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.
// Never logs question text or raw IPs. Rate limits: 20/hour per visitor, 60/day per visitor, 2000/day site-wide.
import Anthropic from "npm:@anthropic-ai/sdk@1.2.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { KNOWLEDGE, SPARK_KNOWLEDGE } from "./knowledge.ts";

const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 500;
const LIMITS = { perHour: 20, perDay: 60, siteDay: 2000 };
const ORIGINS = ["https://allofus.one", "https://www.allofus.one", "http://localhost:8483", "http://127.0.0.1:8483"];

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : "https://allofus.one",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

// in-memory fallback when the counter table has not been created yet (per isolate, best effort)
const mem = new Map<string, number[]>();

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function whoIs(req: Request): Promise<string> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token) {
    try { const { data } = await admin.auth.getUser(token); if (data?.user?.id) return "u:" + data.user.id; } catch (_) { /* anon key or expired */ }
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return "ip:" + (await sha((Deno.env.get("GUIDE_SALT") ?? "allofus-guide") + "|" + ip));
}

async function overLimit(who: string): Promise<boolean> {
  const hour = new Date(Date.now() - 3600e3).toISOString(), day = new Date(Date.now() - 86400e3).toISOString();
  try {
    const [h, d, s] = await Promise.all([
      admin.from("aou_guide_hits").select("id", { count: "exact", head: true }).eq("who", who).gte("at", hour),
      admin.from("aou_guide_hits").select("id", { count: "exact", head: true }).eq("who", who).gte("at", day),
      admin.from("aou_guide_hits").select("id", { count: "exact", head: true }).gte("at", day),
    ]);
    if (h.error || d.error || s.error) throw h.error || d.error || s.error;
    return (h.count ?? 0) >= LIMITS.perHour || (d.count ?? 0) >= LIMITS.perDay || (s.count ?? 0) >= LIMITS.siteDay;
  } catch (_) {
    const now = Date.now(); const list = (mem.get(who) ?? []).filter((t) => now - t < 3600e3);
    mem.set(who, list); return list.length >= LIMITS.perHour;
  }
}

async function record(who: string, tin: number, tout: number, ok: boolean) {
  try { const { error } = await admin.from("aou_guide_hits").insert({ who, tokens_in: tin, tokens_out: tout, ok }); if (error) throw error; }
  catch (_) { const l = mem.get(who) ?? []; l.push(Date.now()); mem.set(who, l); }
}

// strip anything that looks like personal data before it reaches the model
const scrub = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
  .replace(/\+?\d[\d\s().-]{8,}\d/g, "[number removed]")
  .slice(0, 600);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "not_configured" }, 503, origin);

  let body: { q?: string; history?: { role: string; content: string }[]; page?: string; mode?: string } = {};
  try { body = await req.json(); } catch (_) { return json({ error: "bad_json" }, 400, origin); }
  const q = scrub(String(body.q ?? "").trim());
  if (!q) return json({ error: "empty" }, 400, origin);

  const who = await whoIs(req);
  if (await overLimit(who)) return json({ error: "rate", answer: "I have answered a lot of questions for you this hour. Try again a little later, or call 1-800-481-8638 for a person." }, 429, origin);

  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role as "user" | "assistant", content: scrub(m.content) }));
  // the API needs alternating turns that start with the user
  while (history.length && history[0].role !== "user") history.shift();
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) { if (messages.length && messages[messages.length - 1].role === m.role) messages[messages.length - 1].content += "\n" + m.content; else messages.push({ ...m }); }
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  const page = String(body.page ?? "").replace(/[^\w/?=&.-]/g, "").slice(0, 80);
  const mode = body.mode === "spark" || body.mode === "muse" ? "spark" : "guide";
  messages.push({ role: "user", content: (page ? `(I am on ${page})\n` : "") + q });

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [{ type: "text", text: mode === "spark" ? SPARK_KNOWLEDGE : KNOWLEDGE, cache_control: { type: "ephemeral" } }],
      messages,
    } as any);
    if (res.stop_reason === "refusal") {
      await record(who, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0, false);
      return json(mode === "spark"
        ? { answer: "That one is outside what I can help with here. I am good for plans, ideas, creative blocks and small next steps. If this is about your safety, call or text 988 (US) or 911 in an emergency.", chips: ["Help me plan tomorrow", "A creative warm-up", "An idea for my business"] }
        : { answer: "I only help with allofus.one. Try asking how to post, use Circles, or grow your business here.", chips: ["How do Circles work?", "Grow my business", "Human"] }, 200, origin);
    }
    const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    await record(who, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0, true);
    return json({ answer: text || "Sorry, I lost my words. Try asking another way.", chips: [] }, 200, origin);
  } catch (e) {
    await record(who, 0, 0, false);
    const status = e instanceof Anthropic.RateLimitError ? 429 : e instanceof Anthropic.APIError ? 502 : 500;
    return json({ error: "upstream", status }, status === 429 ? 429 : 502, origin);
  }
});

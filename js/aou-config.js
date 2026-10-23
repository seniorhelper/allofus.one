/* ============================================================
   allofus.one · settings
   Leave these blank = DEMO mode (everything saves on the visitor's
   own device, demo residents answer). Paste your Supabase Project
   URL + anon public key = LIVE mode (real accounts, real chat,
   real players walking around). See /SETUP.md.
   The anon key is SAFE to publish (Row Level Security protects
   the data). NEVER paste the service_role key here.
   ============================================================ */
export const CONFIG = {
  SUPABASE_URL: 'https://izfccjaznlcffvjxawya.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF',
  // Optional voice relay for strict networks (a TURN server). Example:
  // TURN: { urls: 'turn:YOUR-TURN-HOST:3478', username: 'user', credential: 'pass' },
  TURN: null,
  // Web Push (phone + desktop notifications). Public key only; the private key lives in the GitHub repo secret VAPID_PRIVATE_KEY.
  VAPID_PUBLIC_KEY: 'BKrf2PLwUBb2bnPY5VkyinxC8SWUhkAPeU2B1-o5Itt0YYM-5uCBELZQ_MB14hR2fXd1yOuo-pkLZyCegQ2tit0',
  // v27: Cloudflare Turnstile bot protection for sign-up / sign-in. '' = off (default). To turn on: dash.cloudflare.com →
  // Turnstile → add widget (domain allofus.one, Managed) → paste the SITE key here, and the SECRET key in Supabase →
  // Authentication → Attack Protection → Bot and Abuse Protection → Turnstile. Do both in the same minute (see SAFETY-RUNBOOK.md).
  TURNSTILE_SITE_KEY: '',
  // v27: card checkout for ads. '' = "Invoice me" only. Set to the deployed Edge Function URL
  // 'https://izfccjaznlcffvjxawya.supabase.co/functions/v1/authnet-hosted' once the AUTHNET_* secrets are in Supabase (see js/aou-ads.js).
  AUTHNET_PAY_URL: '',
  // v27 Discover: public API keys (safe to publish). '' = NASA uses DEMO_KEY (low rate limit) and the Pixabay tab stays hidden.
  NASA_KEY: '',
  PIXABAY_KEY: '',
};

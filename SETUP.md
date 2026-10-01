# allofus.one · setup

## 1. Upload the site (demo mode works right away)
1. In cPanel → **File Manager** → `public_html` for allofus.one.
2. Upload `allofus-one.zip`, right-click → **Extract**. Make sure `index.html` sits directly in `public_html` (not inside a sub-folder).
3. Visit https://allofus.one. Everything works in **demo mode**: accounts, Lifeboard, Match and land save on each visitor's own device, and the demo residents answer.

## 2. Turn on LIVE mode (real accounts, chat, players) with Supabase (free)
1. Go to **supabase.com** → Sign up (GitHub or email) → **New project**.
   - Name: `allofus` · Database password: make a strong one and save it · Region: **West US** (closest to Denver) · Plan: Free.
2. Wait ~2 minutes for it to finish setting up.
3. **SQL Editor** (left menu) → **New query** → open `supabase/schema.sql` from the zip, copy ALL of it, paste, click **Run**. You should see "Success. No rows returned."
4. **Project Settings → API** (or the **Connect** button). Copy two things:
   - **Project URL** (looks like `https://abcdefghij.supabase.co`)
   - **anon public** key (long string starting `eyJ...`)
   - ⚠️ Do NOT copy the `service_role` key. Never put it on the website.
5. Open `js/aou-config.js` (cPanel File Manager → Edit) and paste them in:
   ```js
   SUPABASE_URL: 'https://abcdefghij.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
   Save.
6. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
   - For launch week you can turn **Confirm email** OFF so people get in instantly. Turn it back ON later.
7. **Authentication → URL Configuration**: Site URL = `https://allofus.one`, and add `https://allofus.one/*` to Redirect URLs.
8. Reload allofus.one. Tap ✨ Join → you now get the email + password fields. That means LIVE is on.

## 3. Test it
- Make an account in Chrome, another in a private window. Walk both around: you should see each other with status rings.
- Wave → Connect → accept in the other window → chat.
- Claim a lot on Unity Road (green stakes south of the Gateway). The other window sees the house.

## Notes
- Free Supabase pauses after 7 days with zero visits; just click "Restore" in the dashboard. Upgrade ($25/mo) when traffic grows.
- Real paintings: drop photos into `/images/art/` named like `pulling-away.jpg` (title, lowercase, dashes) and they replace the digital studies.
- Demo residents are labeled "Demo resident" on their cards. Remove them later in `js/aou-life.js` (DEMO_PEOPLE).

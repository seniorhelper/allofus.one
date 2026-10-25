# allofus.one · SAFETY RUNBOOK (v27, Oct 23 2026)

For Zach, the designated safety reporter. One page you can follow under stress. Read §4 first if something involving a child just happened.

## 0. Where things stand (checked against production on 2026-10-23, read-only)

- Production Supabase (`izfccjaznlcffvjxawya`) is still on **v22**: `member_safety`, `media_items`, `mod_evidence`, `circles` do not exist there yet (REST returns 404). The 18+ gate, moderation queue and the audit log are **not live until you run the SQL in §1**.
- With only the public anon key, an outsider today can: read public rooms in `messages`, list other members' files in the `posts` bucket, join every Realtime channel (world positions, voice signalling, Unity Call rooms). All three close when v26 + v27 run. DMs, push subscriptions, notifications, lifeboards, reports, bugs and presence already return nothing to anonymous requests (verified).
- Round-1 client-side NSFW screening (nsfwjs in the browser) is a convenience. **The server-side scanner (§3) is the real control** and is scaffolded, not deployed: it needs an API key and ~20 minutes.

## 1. SQL run order (Supabase → SQL Editor, paste whole file, Run)

1. `supabase/_parts/v26-features.sql`
2. `supabase/_parts/v26-safety.sql`
3. `supabase/_parts/v27-security.sql`  (then any other `v27-*.sql` from the other rounds)

All three are idempotent: re-running is safe, and running v26-safety again after v27 is safe (tested). Check afterwards:

```sql
select public.audit_verify();                                   -- {"ok": true, "checked": n, ...}
select key, value from public.safety_settings where not secret;  -- server_scan_required = false
select count(*) from public.media_items where reason = 'backfill v27';
select polname from pg_policy where polname like 'v27%';
```

What v27 changes for members: nothing visible. Existing accounts keep every read; adults see the one-time date-of-birth modal from v26; after it they regain everything (proved in PGlite, see `MASTER-GAMEPLAN.md §4`).

## 2. Supabase dashboard steps (numbered, ~15 minutes)

1. **Authentication → Attack Protection**: turn on "Prevent use of leaked passwords"; set minimum password length 8+.
2. **Authentication → Rate limits**: sign-ups 30/hour per IP, token refresh default, "sign in / sign up" 30 per 5 min.
3. **Authentication → Email**: confirm "Enable email confirmations" is ON (v26 only trusts confirmed e-mails).
4. **Storage → Buckets**: `quarantine` must be **private** (v27 forces it, verify); `posts` and `conference` public with the MIME allowlists (v26).
5. **Realtime → Settings**: leave the default (private channels enforce `realtime.messages` policies; the probe on 2026-10-23 confirmed private channels are already denied without policies). Nothing to toggle; v27 adds the policies, the client (`js/aou-safety.js`) joins `world`, `pos-*`, `voice-*`, `meet:*` as private and falls back to public once if a join is refused.
6. **Database → Extensions**: enable `pg_net` (for the scanner webhook) and `pg_cron` (optional, KPI snapshot).
7. **Edge Functions → Secrets**: add the keys listed in §3 step 2.
8. **Project Settings → API**: confirm the anon key in `js/aou-config.js` is the *publishable* key, never the secret/service key. (It is.)
9. **Authentication → Bot and Abuse Protection** (only when you have a Turnstile key, §7).
10. **Database → Webhooks** (alternative to pg_net, §3 step 4b).

## 3. media-scan: deploy the server-side picture + video screen

The function is `supabase/functions/media-scan/index.ts` (v28, Oct 25: videos too). Until it runs, uploads are screened only in the browser and `server_scan_required` stays **off**, so nothing is hidden and UX is unchanged.

What it does with each upload: pictures and videos are hash-checked against `media_hashes`, then sent to the classifier. **Videos:** Hive samples frames on its side and the worst frame decides. With Rekognition or `none` there is no video scan, so every video is held as *review* (pending, visible only to its author) until you press Approve in Admin → Moderation. PDFs and other files: hash check only. Any scan error keeps the upload pending while the flag is on (fail closed). The webhook gets an instant 202 and the scan finishes in the background, so a 50 MB video does not time out.

1. Install the CLI once: `npm i -g supabase`, then `supabase login` and `supabase link --project-ref izfccjaznlcffvjxawya` (run inside the repo folder).
2. Secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set KEY=value`):
   - `MEDIA_SCAN_SECRET` = a long random string (`openssl rand -hex 32`). The webhook sends it as `x-aou-secret`.
   - `SCAN_PROVIDER` = `hive` or `rekognition` (or `none` for hash-only while you wait for a vendor account).
   - Hive: `HIVE_API_KEY`; if your Hive contract includes CSAM detection (Thorn), its project key goes in `HIVE_CSAM_API_KEY` (checked on every picture and video). Rekognition: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (IAM user with only `rekognition:DetectModerationLabels`).
   - Optional: `RESEND_API_KEY` + `ALERT_EMAIL=zach@eyetoad.com` for an e-mail on every CSAM-class hit (in-app alert fires regardless). `MAX_SCANS_PER_DAY` (default 3000) caps cost.
3. Deploy: `supabase functions deploy media-scan --no-verify-jwt` (the shared secret is the gate, not a user JWT).
4. Wire the trigger, either way:
   - **4a (pg_net, no dashboard clicking):** in the SQL editor
     ```sql
     select public.safety_set_setting('media_scan_url', '"https://izfccjaznlcffvjxawya.supabase.co/functions/v1/media-scan"'::jsonb, true);
     select public.safety_set_setting('media_scan_secret', '"<the MEDIA_SCAN_SECRET value>"'::jsonb, true);
     ```
   - **4b (Dashboard → Database → Webhooks → Create):** table `media_items`, event INSERT, type HTTP request, URL above, header `x-aou-secret: <secret>`, timeout 8000 ms.
5. Test with a harmless picture AND a short harmless video (a few seconds of your yard): upload both from the app, then `select id, kind, status, scanner, scanned_at, scan->>'frames' frames, scan->>'note' note from public.media_items order by id desc limit 4;` → `scanner` filled, `status` ok, the video shows a `frames` count (Hive). Never test with real abusive material, not even "to check it works".
6. Turn the hard rule on: `select public.safety_set_setting('server_scan_required', 'true');` From now on every new upload is `pending` (visible only to its author) until the scanner says ok, usually within 2–5 seconds. Turn it off with `'false'` if the function is down.
7. Add known-bad hashes any time: `select public.mod_block_hash('<sha256>', 'csam', 'incident #n');` (retro-flags existing copies).

**Which vendor to buy and why.** Buy **Hive** (thehive.ai, Visual Moderation + ask for the CSAM detection add-on, which Hive runs with Thorn's Safer hash matching). It is the only one of the two that can return a CSAM-class signal; AWS Rekognition explicitly is *not* a CSAM detector (nudity/explicit only). Cost at our scale (a few thousand uploads a month): Hive visual moderation is pay-as-you-go in the low single dollars per 1,000 images (expect roughly $5–$15/month; the CSAM add-on is contract-priced, ask); Rekognition is about $1 per 1,000 images (first million) and needs an AWS account. Verify the current price sheets before signing. Either way the Edge Function runs inside the free Supabase quota (500k invocations/month).

**What the scanner cannot do today (plainly):** videos are only classified with Hive (Rekognition/none → held for a human); no PhotoDNA / PDQ hash lists until NCMEC grants access (columns are reserved: `media_hashes.pdq`, `media_hashes.photodna`); a classifier is probabilistic, so 100 % is not a real number — the stack is hash lists + classifier + 3-report auto-hide + human review + legal hold.

## 4. If it is CSAM (child sexual abuse material): the legal steps

**Legal basis (US).** 18 U.S.C. § 2258A requires an electronic communication / remote computing service provider that obtains *actual knowledge* of apparent child pornography (CSAM) to report it to NCMEC's CyberTipline as soon as reasonably possible. § 2258A(h) requires preserving the report contents (the file, the account data, the context) for a set period: 90 days originally, extended to **one year** by the REPORT Act of 2024, and longer on a law-enforcement preservation request. Knowing and wilful failure to report carries civil fines (raised by the REPORT Act). § 2258B gives providers limited liability for good-faith reporting and preservation. Also: **never re-transmit, download, forward or screenshot the material** for any purpose other than the report (§ 2252A applies to everyone, including moderators). This is not legal advice; have counsel confirm your obligations, including state law and the UK Online Safety Act if you ever market there.

**Step by step (Zach as designated reporter):**

1. Do not open, download, forward or screenshot the file. The scanner already moved it to the private `quarantine` bucket; the public URL is dead.
2. Open **Admin → Moderation**. The incident sits at the top (red). Confirm the account shows **on hold**; if the item came from a member report instead, click **Preserve evidence + NCMEC** on that card (snapshot + hold).
3. Click **Export evidence (JSON + sha256)**. Save the file off the laptop that browses the site (encrypted drive). Write down the sha256 the toast shows (it is also in the audit log, `evidence.export`). The bundle holds: account data, sign-in IPs, the item, all media rows, reports, hidden content, the member's audit trail and the chain-check result. It does **not** include image bytes.
4. Go to <https://report.cybertip.org/> → *Report as an Electronic Service Provider*. Fill in: the uploader's account e-mail and user id, upload timestamp (UTC), IP addresses (from the bundle's `sign_ins`), the file's sha256 and `quarantine/<path>`, and that the file is preserved. Note the **report number**.
5. Back in Admin → Moderation click **Record NCMEC report #** on the incident; paste the number. This writes `evidence.update` + `incident.update` audit rows and ties the number to the evidence row.
6. If a child seems to be in danger right now: call 911 / local police first, then do steps 2–5.
7. Keep the account **held** (not deleted). `delete_my_account()` and `admin_delete_user()` refuse while evidence is on hold; a member's deletion request is queued and shows up as `account.delete_queued` in the audit log. Release only after law enforcement says so: **Close incident** → `mod_release_and_delete(user)`.
8. Register as an ESP with NCMEC (one-time, before you need it): the ESP programme page on cybertip.org / missingkids.org explains it (e-mail the ESP team listed there). Registered providers can file through the ESP portal and later request hash-list access (PhotoDNA via Microsoft, PDQ lists). Put the confirmation in the client profile doc.
9. Every 90 days: `select public.audit_verify();` and export the audit log to cold storage: `copy (select * from public.audit_log order by id) to stdout csv header` (or Dashboard → Table → Export CSV). The chain hash of the last row is your tamper seal; write it in the paper log.

## 5. Everyday moderation (what each button does)

- **Keep (dismiss)** → `mod_set_content(kind, id, 'ok')`: reports dismissed, audit `content.mod_status` / `report.dismissed`.
- **Remove** → status `removed`, media moved to `quarantine`, audit rows. Nothing is hard-deleted.
- **Hold / Release / Restrict / Ban** → `mod_set_user`; every change lands in `audit_log` (`safety.hold`, `safety.ban`, …).
- **Preserve evidence + NCMEC** → snapshot + hold (`evidence.preserve`).
- **Export evidence** → signed bundle (`evidence.export`, hash in payload).
- **Approve / Reject** (pictures waiting) → quarantine ↔ posts; `media.status` audit rows.
- The **Audit chain** line at the top of the queue must read *intact*. If it ever says BROKEN, stop, export everything, and call counsel: someone with database access edited history.

## 6. Account deletion (self-serve, live after v27 SQL)

Control panel → Your data → Delete my account → type DELETE. The client removes the member's files through the Storage API, then calls `delete_my_account()`, which deletes content, storage rows, push subscriptions, notifications, presence, circles, connections, the profile **and the auth user**, after writing the `account.delete` audit row (e-mail stored only as a sha256). Brand pages move to the founder for their other managers. If evidence is on hold the call returns `queued: true` and the member sees a plain explanation. Before v27 SQL is run the old flow (content deletion + a request row in `bugs`) still works.

## 7. Bot protection (Cloudflare Turnstile), off by default

1. dash.cloudflare.com → Turnstile → Add widget: domain `allofus.one`, mode Managed. Copy **Site key** and **Secret key**.
2. Supabase → Authentication → Attack Protection → Bot and Abuse Protection → enable, provider Turnstile, paste the **secret**.
3. `js/aou-config.js` → `TURNSTILE_SITE_KEY: '<site key>'`, push.
   Do 2 and 3 within the same few minutes: with the Supabase side on and the site key empty, sign-ups fail; with the site key set and Supabase off, the token is simply ignored. The CSP meta on all 17 pages already allows `https://challenges.cloudflare.com`.

## 8. Real security headers: Cloudflare (free) in front of GitHub Pages (recommendation; DNS not changed)

GitHub Pages cannot send HSTS preload, `frame-ancestors`, a nonce-based CSP, or `Permissions-Policy`. The `<meta>` CSP we ship cannot express `frame-ancestors` and still needs `'unsafe-inline'`. Cloudflare's free plan fixes that without a server:

1. Cloudflare → Add site `allofus.one` (Free). Change the registrar's nameservers to the two Cloudflare gives you (this is the one DNS change; do it when you have 10 quiet minutes).
2. DNS: keep the four GitHub Pages A records (185.199.108–111.153) and `www` CNAME → `seniorhelper.github.io`, **proxied (orange cloud)**. GitHub Pages must keep "Enforce HTTPS" on; set Cloudflare SSL/TLS to **Full (strict)**.
3. SSL/TLS → Edge Certificates: Always Use HTTPS on, HSTS on (max-age 6 months, include subdomains, preload later), Minimum TLS 1.2.
4. Rules → Transform Rules → **Modify Response Header** (one rule, all requests), add:
   - `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` (keeps the meta CSP for the rest; a header `frame-ancestors` is the only way to stop clickjacking)
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=()`
   - `Cross-Origin-Opener-Policy: same-origin-allow-popups`
5. Security → Bots: **Bot Fight Mode** on. Security → WAF: managed ruleset (free), plus a rate-limiting rule: `/` and `/world/` 300 requests / 10 s per IP → block 1 min.
6. Security → Settings: Browser Integrity Check on; Challenge Passage 30 min.
7. Caching: respect origin (GitHub Pages sends 10-minute cache headers); purge on deploy is optional.
8. Later: move the CSP meta to a Cloudflare header with a per-request nonce (Workers, free tier) so `'unsafe-inline'` can go. Not before the inline scripts in `index.html` and `world/index.html` are given nonces.

Risk: none to members; the SSO hand-off (`#aou_sso=`) and Supabase calls are unaffected (different origin). Roll back by pointing nameservers back to the registrar.

## 9. Vulnerability register (round 2, red-team with the anon key + a browser)

| Sev | Where | Proof (read-only probe 2026-10-23) | Status |
|---|---|---|---|
| High | Production has not run v26/v27 | `GET /rest/v1/member_safety` → 404; `media_items` 404 | **Open until Zach runs §1** |
| High | Direct upload via Storage REST skipped the client NSFW check and `media_items` log entirely | Storage insert policy only checks folder + adult; no row needed | **Fixed (v27)**: storage trigger logs every object; posts whose media has no `ok` row are hidden from everyone but the author; scanner hook |
| High | No server-side CSAM/NSFW screening | by design of round 1 | **Built (v27)**, deploy per §3; honest limits in §3 |
| High | Realtime channels joinable by anyone with the anon key (world positions, voice SDP, Unity Call rooms) | `phx_join realtime:world` as anon → `ok` | **Fixed (v27)**: `realtime.messages` policies + private channels in the client with one-time fallback |
| High | No tamper-evident audit trail | — | **Fixed (v27)**: hash-chained append-only `audit_log`, `audit_verify()`, triggers on every safety table; tampering detected in PGlite test |
| High | Account deletion needed a manual step; auth user stayed | flat3 filed a `bugs` row | **Fixed (v27)**: `delete_my_account()` deletes the auth user; legal hold queues it |
| Med | Anonymous can list other members' files in the `posts` bucket | `POST /storage/v1/object/list/posts {prefix:"<uid>"}` → file names | Fixed by v26 (`v26 no listing others`), **live after §1**; top-level folder names may still list (storage.search), low |
| Med | `profiles.blocked` and `profiles.home` world-readable (who blocked whom; lot coordinates; notification switches) | `GET /rest/v1/profiles?select=blocked,home` | **Open (accepted for now)**: moving `blocked` to `member_safety` needs client changes in `aou-flat2.js` (another agent's file today). Plan: `set_block()` RPC + `my_safety().blocked` |
| Med | Public room chat readable without sign-in | `GET /rest/v1/messages?room=…` → rows | By design (town square). Recommend: require sign-in for `room is not null` reads in the next round |
| Med | Username / display name accepted any characters (stored XSS if any renderer forgets `esc`) | `profiles.username` only had a length check | **Fixed (v27)**: regex on change, `<>` → `‹›`; existing rows untouched; sign-in upsert proven safe |
| Med | `claim_my_pages`, `admin_stats` callable by anon | `POST /rest/v1/rpc/claim_my_pages` → 0 | **Fixed (v27)**: revoked from anon/public |
| Med | CSP needs `'unsafe-inline'`; no `frame-ancestors` possible from meta | inline scripts in HTML | **Open**: §8 Cloudflare plan |
| Low | Service worker opens `notification.data.url` from the DB without an origin check | `sw.js` `clients.openWindow(url)` | Open (sw.js frozen this round); `notify()` is API-revoked, triggers build the URLs, so only an admin or DB bug could plant a URL |
| Low | `hearts/index.html` renders sample profile fields unescaped | static demo data, page retired | Open: delete the page after the SAFETY push (already on the checklist) |
| Low | `aou-lifetools.js`, `aou-plants.js` render the member's own localStorage data unescaped | self-XSS only | Accepted |
| Low | formsubmit.co form on Boost page can be spammed | third-party form | Accepted (Turnstile on that form is a follow-up) |
| Info | Secrets in git history | `git log -p` grep for service_role / sk-ant / private keys → only variable names | Clean |
| Info | CDN pinning | `@supabase/supabase-js@2` floats on major; nsfwjs 4.2.1 and mediapipe 0.10.14 pinned; SRI impossible for `+esm` module graphs | Accepted; pin `@2.x.y` in a quiet week and re-test |
| Info | `aou-guide` Edge Function | per-visitor + site-wide limits, PII scrub, refusal path, 500-token cap; JWT not required (public helper) | OK; cost cap ≈ 2,000 × 500 tokens/day |
| Info | `_push` GitHub Action | schedule + manual dispatch only, secrets via repo secrets, `contents: read` | OK |
| Info | SSO hash hand-off | 10-minute token, referrer check, our two domains only | OK |

## 10. What stays impossible or needs money / accounts (plainly)

- **Age is self-declared.** Real age assurance (ID / face estimation) is a paid vendor (Yoti, Veriff, Persona) and a UX cost; required before UK marketing.
- **100 % CSAM detection does not exist.** Hash lists catch known material; classifiers catch some new material; humans and reports catch the rest. NCMEC hash access needs ESP registration; PhotoDNA needs a Microsoft licence.
- **Video** is classified by Hive's video endpoint (v28). Without Hive, every video waits for a human.
- **Headers** need Cloudflare (free) or a server.
- **A second human moderator** is the single biggest safety upgrade left.

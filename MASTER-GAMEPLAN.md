# allofus.one · MASTER GAMEPLAN

*Last updated: 2026-10-23. Owner: Zach Wennstedt, Eye To Ad Media, 1001 Bannock St #660, Denver, 1-800-481-8638.*

This file is the hand-off document. It covers where the project is, where it is going, and how to run it. It is written to be honest. **No traction number below is invented.** Where the data is unknown, you get the SQL that pulls it.

---

## 1. The pitch (one paragraph)

**allofus.one is the social network you control.** It is for adults, and it carries no ad trackers.
- The feed is newest-first by default. Every post can tell you why it is there.
- Circles let you share with Family, your Inner Tribe, work or neighbors without the audiences mixing.
- You can download your whole graph in one tap.

One account also gets you:
- local buy/sell/trade groups
- free Brand pages for small businesses
- Spaces, Events and Courses (what Skool and Circle charge $9 to $199 a month for)
- a personal LIFEboard
- an AI guide
- a 3D world you can walk in a browser or a VR headset

Revenue does not come from surveillance ads. It comes from what local businesses already buy from the same company: listings, press releases, AI lead response, VR storefronts and done-for-you marketing. That gives the network a working revenue engine from day one, instead of a "monetize later" promise.

---

## 2. Current state: what exists today (read from the code, 2026-10-23)

Status key:
- **LIVE**: shipped and working on allofus.one.
- **BETA**: shipped, but rough or needs data or real users.
- **NEW-v26**: built today. It needs the v26 SQL and/or deploy steps, and is not pushed yet.
- **STUB**: placeholder or partial.

### 2a. Pages (static routes)

| Route | What it is | Status |
|---|---|---|
| `/` (`index.html` → `js/aou-flat2.js`) | The Feed app. Every `/?v=` view below lives here. | LIVE |
| `/world/` | 3D world (three.js engine `aou-engine.js`, `aou-world.js`) plus WebXR VR (`/world/?vr=1`, shared layer `aou-xr.js` xr-v9) | LIVE (VR is BETA: still being tuned on Quest) |
| `/boost/` | searchBOOST marketing hub. Ad maker, campaign builder, packages from $299/mo, as published on the page. | LIVE |
| `/rooms/` | Global Room (team or group space with a presentation wall) | BETA |
| `/meet/` | Unity Call video rooms (WebRTC) | LIVE |
| `/moments/` | Faces, backdrops and quick clips | LIVE |
| `/games/` | Browser games | LIVE |
| `/match/` | Have / Need matching for items and services (no money changes hands) | LIVE |
| `/hearts/` | 18+ mind-first matching | **Being retired today by the SAFETY round (dating and crush removed).** Remove it from the sitemap and nav after the SAFETY push. |
| `/mission/` | Mission, the creator, and **Our promise** (NEW-v26, anchor `#promise`) | LIVE + NEW-v26 |
| `/community-rules/`, `/privacy/`, `/terms/`, `/accessibility/`, `/report-bug/` | Policies | LIVE |
| `/follow-badge/` | Embeddable follow badge for Brand pages | LIVE |
| `/flat/` | Redirect to `/` | LIVE |

### 2b. Views inside the Feed app (`/?v=<key>`)

| Key | Module | Status |
|---|---|---|
| `feed` (default) | `aou-flat2.js` | LIVE |
| | Filters: Everyone, Connections, Mine, Saved, World news. Sorts: New (default), Top, Hot (formula shown). Dear Feed word nudges. | |
| `u` (profile), `conn`, `notif`, `search`, `settings`, `panel` (control panel) | `aou-flat2.js`, `aou-flat3.js`, `aou-conns.js` | LIVE |
| `brand` (alias `biz`), `?page=<slug>` | `aou-brand.js` | LIVE |
| | Brand pages: sections, logo and cover, FAQ, JSON-LD block, managers, pre-linked clients, VR home spot. | |
| `groups`, `?g=<slug>` | Buy/sell/trade and topic groups | LIVE |
| `video` | Every video, newest first | LIVE |
| `dm`, `messages`, `inbox`, `hub`, `room` | `aou-dm.js`, `aou-comm.js`, `aou-hub.js` | LIVE |
| | Messages, Comm Hub, live text rooms. | |
| `spaces`, `space`, `events`, `courses` | `aou-spaces.js`, `aou-courses.js`, `aou-course-templates.js` | LIVE (BETA quality) |
| `board` | LIFEboard (`aou-board.js`, `aou-lifetools.js`, `aou-blocks.js`, `aou-money.js`) | LIVE |
| | Goals, habits, money tools, journal, MONEYblocks. | |
| `work` | FLOWworks pads (`aou-work.js`) | LIVE |
| `admin` | Admin dashboard (`aou-admin.js`): KPIs, signups, online now, bugs, moderation | LIVE (the SAFETY round adds a moderation queue) |
| **`grow`** (alias `launchpad`) | **Grow your business launchpad** (`aou-bizhub.js`) | **NEW-v26** (works now, no SQL needed) |
| **`circles`** | **Circles manager** (`aou-circles.js`) | **NEW-v26** (needs SQL) |
| **`mydata`** | **Your data: download or delete, plus our promise** (`aou-circles.js` → `aou-flat3.js` export/delete) | **NEW-v26** (works now) |

### 2c. Always-on helpers

- **Orbit** (`aou-orbit.js`): helper widget. Scripted intents, plus **AI answers via "Ask allofus"** (NEW-v26, live once the Edge Function is deployed).
- **Lumi** (`aou-lumi.js`, scripted, inside the 3D world).
- **Onboarding** (`aou-onboard.js`): 5-step tour and the client claim flow.
- **@mentions** (`aou-mentions.js`).
- **Push notifications** (`aou-push.js` + `sw.js`).
- **Photo editor** (`aou-photoedit.js`).
- **Video autoplay** (`aou-autoplay.js`).
- **Welcome / seed posts** (`aou-seed.js`): labeled samples so the feed is never empty.
- **QR invites** (`aou-qr.js`).
- **SSO with World VR Mall** (`aou-sso.js`).
- **Voice chat** (`aou-voice.js`).
- **Conference screen** (`aou-conf.js`).
- **UX layer** (`aou-ux.js`, built today by the DESIGN round): grouped main menu (You · Connect · Create & Grow · Explore) and the header tiles.

### 2d. 3D / VR world modules (all LIVE, Zach's showcase)

- Engine, terrain and endless roads: `aou-engine`, `aou-terrain`.
- Places and estates: `aou-world`, `aou-estate`, `aou-house`, `aou-unity`, `aou-family`, `aou-streets`, `aou-build` (home builder, addresses, directory), `aou-garden`, `aou-plants`, `aou-lakes`, `aou-life`.
- Activities: `aou-coaster`, `aou-ski2`, `aou-sky` (lanterns), `aou-fire`, `aou-balloons`, `aou-party`, `aou-jamoke`, `aou-truck`.
- Characters: `aou-studio` (character studio).
- VR: `aou-xr` (shared VR layer), `aou-sawcut` (VR arrival), `aou-landings`, `aou-go`, `aou-screen`, `aou-orbit3d`, `aou-lifevr`.

### 2e. Backend (Supabase project `izfccjaznlcffvjxawya`)

The database has 40+ tables, including:
- `profiles`, `feed_posts`, `feed_comments`, `feed_reactions`, `feed_saves`
- `connections`, `messages`, `hub_messages`, `hub_requests`, `meeting_requests`, `hugs`, `notifications`, `presence`
- `pages`, `page_follows`, `page_views`, `leads`
- `spaces`, `space_members`, `events`, `event_rsvps`, `courses`, `lessons`, `lesson_done`
- `lifeboards`, `plots`, `wishes`, `match_posts`, `push_subscriptions`
- `reports`, `media_items`, `member_safety`, `mod_evidence` (from the SAFETY round)

Today adds `circles`, `circle_members`, `aou_guide_hits` and `aou_kpi_daily`. There is also one Edge Function, `aou-guide`, which is NEW.

---

## 3. Architecture and the rules that keep it working

- **Static site on GitHub Pages** (`seniorhelper/allofus.one`, branch `main`, CNAME `allofus.one`). No build step. Plain ES modules in `/js/`.
- **Supabase** handles auth, Postgres with RLS, storage, realtime, and now Edge Functions. The anon key lives in `js/aou-config.js`. The service-role key is **never** put in the site.
- **SQL delivery rule.** Zach runs SQL by hand in Supabase → SQL Editor. Every file is additive, idempotent and safe to re-run. One cumulative file goes out per round. Today's parts are:
  - `supabase/_parts/v26-safety.sql` (SAFETY round)
  - `supabase/_parts/v26-features.sql` (this round)

  At push time they can be concatenated into `supabase/allofus-ALL-v26.sql`. Run order: **safety first, then features.** The features file does not depend on safety.
- **Feature-detect rule.** The client must work before the SQL is run. The v26 modules probe for their tables or columns and fall back silently. The circles probe result is cached in `localStorage.aou_circ_ready`: 1 hour if no, 24 hours if yes.
- **Service worker rule.** Bump `const V` in `sw.js` on every delivery. It is currently `v123`. **This round did NOT bump it.** Bump it once, at push time, for all three rounds together.
- **Big-file rule.** `js/aou-flat2.js` has giant single lines. Patch it with small exact string replacements from a node script. Never use `node -e` with `$$` in bash.
- **VR layer.** `js/aou-xr.js` is shared with World VR Mall (`wvm-xr.js`). Change both together, never one. Anything at `sessionstart` must not read the XR camera pose.
- **QA.** Run a local static server and check every view for zero console errors. Check JS syntax with `node --check` on a `.mjs` copy. HEAD-check every outbound link.

---

## 4. Safety and trust posture

1. **Adults only (18+).** The SAFETY round adds:
   - a private `member_safety` table with date of birth
   - posting, DMs and connections need a confirmed adult
   - Hearts and Crush are retired
   - **Nothing romance- or dating-like is to be added again.**
2. **Moderation.**
   - Reports carry a target and a category.
   - 3 reporters, or 1 child-safety report, auto-hide the content and hold the account.
   - There is an admin moderation queue, and an upload log with moderation status.
   - Evidence snapshots are kept for NCMEC and law enforcement.
3. **NCMEC.** Suspected child sexual exploitation is reported to the NCMEC CyberTipline (report.cybertip.org). Evidence is preserved, not deleted. US providers have a legal reporting duty under 18 U.S.C. 2258A. **TODO:** register as an ESP with NCMEC and write the internal SOP.
4. **No tracking.** There are no third-party analytics or ad pixels. I checked on 2026-10-23: the repo has no gtag, GTM, fbq, Clarity or Hotjar.
   - Sponsored posts (searchBOOST "rare rated-G ads") are labeled, capped at about 1 per 15 posts, and untargeted.
   - Keep it this way. It is the moat.
5. **The AI guide** discloses that it is AI and is not a companion: no role-play, no romance. It refuses off-topic requests and gives 988/911 crisis info. It strips emails and phone numbers before calling the model, and stores no question text. Rate limits:
   - 20 questions per hour per visitor
   - 60 per day per visitor
   - 2,000 per day site-wide

   This tracks the 2025-26 regulatory focus on AI companions: the FTC 6(b) study (Sept 2025), New York's AI companion law (Nov 2025) and California SB 243 (Jan 2026). [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/09/ftc-ai-chatbots), [MoFo](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai)
6. **Data rights.**
   - One-click JSON export at `/?v=mydata`. It includes circles and this device's feed settings.
   - Self-serve delete. The sign-in itself is removed by the team within 7 days.
   - Utah's Digital Choice Act (HB 418, effective July 1, 2026) requires social-graph portability. Our export is the start of compliance. [Bloomberg Law](https://news.bloomberglaw.com/privacy-and-data-security/utah-data-sharing-law-creates-path-to-upend-social-media-model)
7. **Age assurance for the UK.** The Online Safety Act has required age checks since July 25, 2025. Either geo-limit the UK or add an age-assurance vendor before marketing there. [The Register](https://www.theregister.com/2025/07/28/uk_vpn_demand_soars/)
8. **v27 SECURITY round (2026-10-23, red team, not yet run in production).** `supabase/_parts/v27-security.sql` adds: a hash-chained, append-only `audit_log` (every report, moderation action, hold/ban, DOB change, media status change, deletion, admin dashboard open; `audit_verify()` walks the chain); `safety_incidents` + `media_hashes` (sha256 / dHash now, PDQ / PhotoDNA columns reserved); `media_scan_result()` for the server-side scanner; a storage trigger that logs every object so uploads that bypass the app are never shown; read policies that hide any post / comment / Comm Hub item whose media is pending, removed, quarantined or unlogged; `delete_my_account()` (deletes the auth user, queues under legal hold); Realtime Authorization policies (world / positions / voice / Unity Call for confirmed adults, `dm:a:b` for the two people); username regex + tag neutralising on profiles; `mod_evidence_bundle()` signed exports. Flag `server_scan_required` is OFF by default so UX is unchanged until the scanner is deployed.
   - Edge Function `supabase/functions/media-scan/index.ts`: Hive (recommended: CSAM-class + NSFW) or AWS Rekognition (NSFW only) behind `SCAN_PROVIDER`; quarantines, snapshots, holds, alerts. Deploy steps, vendor choice and cost: **SAFETY-RUNBOOK.md §3**.
   - Client: private Realtime channels with one-time public fallback, Turnstile behind `CONFIG.TURNSTILE_SITE_KEY` (off), self-serve delete through the RPC with the old flow as fallback, Incidents + Evidence export + audit-chain status in Admin → Moderation, CSP allows `challenges.cloudflare.com`.
   - Migration proof (PGlite, full chain v4→v22→v26→v27, v27 run three times): a pre-v26 member with `adult=true` and no DOB keeps reading posts, lifeboard and pages, can delete own content, sees the DOB modal, regains posting after `set_my_dob()`; the founder stays admin and can post without a DOB; the sign-in profile upsert never renames or fails on legacy usernames.
   - Run order: v26-features → v26-safety → v27-security. Dashboard steps, the NCMEC procedure (18 U.S.C. 2258A), and the Cloudflare-in-front-of-GitHub-Pages header plan are in **SAFETY-RUNBOOK.md**.
   - Still open after v27: `profiles.blocked` / `profiles.home` are world-readable (needs a `set_block()` RPC + a small `aou-flat2.js` change), public rooms readable anonymously (by design, reconsider), no `frame-ancestors` without Cloudflare, age is self-declared, video has no server-side frame sampling, and the hash lists need NCMEC / Microsoft access.

---

## 5. What shipped today (2026-10-23, FEATURES round, not pushed)

| # | Feature | Files | Needs |
|---|---|---|---|
| 1 | **Grow your business launchpad** (`/?v=grow`), described below | `js/aou-bizhub.js` (new), 1 hook in `aou-flat2.js` | Nothing. Works now. |
| 2 | **Circles** (`/?v=circles`), described below | `js/aou-circles.js` (new); hooks in `aou-flat2.js` (composer and dispatch) | `v26-features.sql` |
| 3 | **Feed controls**, described below | `js/aou-circles.js`, 1 hook in `feedList` | Nothing. The circle filter needs SQL. |
| 4 | **Your data** (`/?v=mydata`), described below | `aou-circles.js`, small edits in `aou-flat3.js` | Nothing |
| 5 | **Our promise** on `/mission/#promise`, described below | `mission/index.html` | Nothing |
| 6 | **Ask allofus AI guide**, described below | `js/aou-ai-guide.js` (new), `aou-orbit.js` (AI-first `ask`, 4 new scripted intents, header renamed), `supabase/functions/aou-guide/index.ts` and `knowledge.ts` (new) | Deploy the function and add the secret (§11) |
| 7 | **KPI snapshots**, described below | `v26-features.sql` | SQL, optional pg_cron |

**1. Grow your business launchpad**
- One page linking Brand page and searchBOOST (internal) with the network tools:
  - AI Speed to Leads, plus the live demo
  - USA Business Search free listing
  - Colorado Business List free listing
  - World VR Mall lease
  - Eye To Ad Media
- Press release builder: drafts a release from the member's Brand page, copies it, and opens the PR site they choose:
  - Distribute Press Releases' free Release Builder
  - Press Release for Business plans
  - Action Global News distribution
- A 5-step checklist.
- All outbound links are `rel="sponsored noopener"`, open in a new tab, and carry `utm_source=allofus&utm_medium=referral&utm_campaign=grow&utm_content=<tool>`.
- None of the PR sites accept prefilled fields from another site. I checked on 2026-10-23: the Release Builder reads only its own localStorage. That is why it uses copy and open.

**2. Circles**
- Family, Inner Tribe, Professional and Local are seeded on first visit. Members can add custom circles (up to 24, with 500 people each).
- Members are added from your connections.
- The composer gets a "Who sees this" picker. A circle post sets `public=false` and `circle_id`.
- RLS is permissive for circle members and has a **restrictive** guard, so circle posts, and their comments and reactions, never leak through other read policies.

**3. Feed controls**
- A "Why am I seeing this?" explainer for the whole feed and for each post.
- Mute words, hide reposts, and show only one circle or "shared with me in circles".
- Settings are stored on the device (local-first).

**4. Your data**
- The promise cards, one-click export (now including circles and feed controls), and delete (now also deletes circles).

**5. Our promise**
- No ad tracking, never sold, no rage-bait ranking, you own your graph, audiences never mix, adults only and people first.

**6. Ask allofus AI guide**
- Orbit tries the AI first for real questions; short chip taps stay scripted.
- It falls back to the scripted answer if the function is missing, slow or rate-limited.
- Uses Claude Haiku 5.5 on the server. The key is a Supabase secret.

**7. KPI snapshots**
- `aou_kpi_daily` plus `aou_kpi_snapshot()`: members, new members, DAU, WAU, MAU, posts, comments, reactions, connections, Brand pages, guide questions.

**Out of scope today, and in the plan only:** creator tipping, micropayments and revenue share. These move money, so they need a payments partner, KYC and a legal review first.

---

## 6. Roadmap (Project Nexus phases, adapted to what already exists)

| Phase | Nexus idea | allofus.one reality | Status and next steps |
|---|---|---|---|
| **0. MVP** | Identity, a feed, no trackers | Feed, profiles, connections, DMs, groups, Brand pages, 3D/VR, LIFEboard | **DONE.** Next: polish the onboarding numbers (§10) |
| **1. Circles** | Contextual micro-spheres | Circles, the audience picker, the circle feed filter, why-am-I-seeing-this, mute words | **NEW-v26.** Next items are listed below the table. |
| **2. Open graph + portability** | Sovereign identity, one-click export | JSON export exists. **v27:** did:key identity + signed, verifiable exports. | Next items are listed below the table. |
| **2b. Creator economy** | Tipping and revenue share instead of ads | Spaces, Courses and Events exist, but no payments | Next items are listed below the table. |
| **3. Ambient AI + spatial** | On-device agents that summarize and schedule | Ask allofus (server AI, today); 3D world and WebXR are already shipped | Next items are listed below the table. |
| **4. Federation** | Open protocol | None | Next items are listed below the table. |
| **5. Displacement** | Mass migration from Facebook | — | Only after the retention numbers (§10) are proven. Don't spend on paid acquisition before then. |

**Phase 1 next steps (Circles):**
- Circle-only Spaces and events.
- Show "posted to Family" on your own posts.
- Circle digests.

**Phase 2 next steps (open graph and portability):**
- An import tool, starting with Facebook's "Export Your Information" JSON for friends and photos.
- An ActivityPub or AT Protocol read-only bridge for public posts.
- A `did:web` handle per member (`@name.allofus.one`).
- **Done in v27:** a browser-made Ed25519 key, `did:key` on the profile, signed exports and `/?v=verify` (see §14e).
- This matches Utah HB 418 and the EU DMA Art. 6(9) direction. [EU DMA portal](https://digital-markets-act.ec.europa.eu/developer-portal/end-user-data-portability_en)

**Phase 2b next steps (creator economy):**
- Stripe Connect (Express) for tips and paid Spaces and Courses.
- Price under the market:
  - Skool takes 10% on the $9 Hobby plan
  - Circle is $89/mo + 2%
  - Patreon takes 10%

  [Skool pricing](https://www.learningrevolution.net/skool-pricing/), [Circle pricing](https://schoolmaker.com/blog/circle-so-pricing), [Patreon](https://support.patreon.com/hc/en-us/articles/36426991446797)
- Proposal: 5% platform fee, no monthly fee for the first 100 members of a Space.
- **Needs** a legal review, KYC through Stripe, and a refund and chargeback policy.

**Phase 3 next steps (ambient AI and spatial):**
- "Catch me up" summaries of a group or Space, opt-in and run server-side with no training on member data.
- An event-scheduling helper.
- Ask allofus inside VR (Orbit 3D already exists).

**Phase 4 next steps (federation):**
- Publish public Brand pages and posts over ActivityPub, so Mastodon and Threads can follow businesses.
- Bluesky custom feed generator for "Denver local business news".

---

## 7. Gaps vs the big platforms (live research, 2026-10-23)

| Platform | What they have that we lack | Where they are weak (our opening) |
|---|---|---|
| **Facebook / Marketplace** | Scale, Marketplace inventory, identity graph | See notes below the table. |
| **Nextdoor** | 22.9M weekly users (Q2 2026), verified addresses, local news from 3,500+ publishers, safety alerts | ARPU of $3.26 comes from ads, and its AI "Faves" sits inside an ad feed. [SEC Q2 2026](https://www.sec.gov/Archives/edgar/data/0001846069/000184606926000154/exhibit991-pressreleasexq2.htm), [TechCrunch](https://techcrunch.com/2025/07/15/nextdoor-redesigns-app-with-ai-recommendations-local-news-and-real-time-emergency-alerts) |
| **Discord** | More than 200M monthly users, voice, bots, gaming culture | Hard for small businesses and older adults; filed confidentially for an IPO in Jan 2026, which brings monetization pressure. [Bloomberg Law](https://news.bloomberglaw.com/securities-law/chat-platform-discord-is-said-to-file-confidentially-for-ipo) |
| **Bluesky** | About 43.5M registered users, AT Protocol portability, custom feeds | Mobile daily users fell about 26% year over year to about 3M (Jul 2026), and it has no local or business layer. [Marketful](https://marketful.com/bluesky-statistics), [Gigazine](https://gigazine.net/gsc_news/en/20260812-blueskys-active-user/) |
| **Threads** | About 500M monthly users (secondary sources) and the Instagram graph | Meta says it is not a meaningful revenue driver in 2026; it is algorithmic and has the same data model as Meta. [Startupfeed](https://startupfeed.in/threads-tops-500-million-users-meta-milestone/) |
| **Skool / Circle** | Polished courses and communities, payments | $9 to $199 a month plus transaction fees, and no public social layer or local discovery. |

**Facebook / Marketplace: what they have and our gap.**
- They have Marketplace inventory we cannot match. Our gap is the volume of real local listings.

**Facebook / Marketplace: their weak spots.**
- Scams. The FTC says Americans reported **$2.1B** in losses to scams that started on social media in 2025, $794M of them from Facebook. [FTC](https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2026/04/reported-losses-scams-social-media-eight-times-higher-2020)
- Behavioral ads and a black-box feed.
- Groups bloat.

**Trend facts that shape the plan:**
- **Private sharing is the shift.** Instagram's head says people post less publicly and share in DMs and small groups. [Yahoo/Mosseri](https://www.yahoo.com/news/instagram-head-adam-mosseri-paradigm-100002931.html)
  - Yope raised a $12.3M seed in July 2026 for private small groups with no ads and no algorithm. [NewsBytes](https://www.newsbytesapp.com/news/business/yope-secures-123-million-seed-led-by-northzone-for-private-network/tldr)
  - **Circles is our answer.**
- **Chronological feeds are wanted but must be explained.**
  - YouGov: Americans prefer chronological to algorithmic feeds, 46% vs 26%. [YouGov](https://yougov.com/en-us/articles/55416-frequent-social-media-users-are-more-likely-to-prefer-the-algorithm-to-chronological-feeds)
  - But Meta's experiment showed engagement drops without good defaults. [Science Friday](https://www.sciencefriday.com/segments/sorting-out-social-media-feeds/)
  - **Our answer:** Circles, Dear Feed and per-post "why" make chronological feel curated by *you*.
- **Social VR is open ground.** Meta moved Horizon Worlds to mobile-first in 2026 and cut Reality Labs. [PocketGamer.biz](https://www.pocketgamer.biz/meta-pulls-horizon-worlds-from-vr-as-platform-shifts-to-mobile)
  - Browser WebXR (no app store) is a niche we already serve.
  - Demand is small. Keep VR as the wow factor, not the core.

**The top 8 gaps to close (in order):**
1. **Scam-resistant local marketplace.**
   - A verified-adult seller badge (the SAFETY round's DOB check plus email).
   - A "meet at a safe spot" helper.
   - Report-to-hold in 1 tap.
   - Never allow shipping or overpayment patterns.
   - Market it with the FTC numbers.
2. **Import from Facebook.** Friends list and photos from the FYI export, which lowers the switching cost.
3. **Local discovery for businesses without pay-to-play.** Brand pages are ranked by distance and freshness, never by spend.
4. **A native mobile shell** (PWA install prompt today; Capacitor wrapper later) and push that works on iOS.
5. **Payments for Spaces and Courses** (Phase 2b).
6. **Group admin tools.** Rules, approvals, auto-moderation, scheduled posts for groups.
7. **Federation of public Brand pages** (ActivityPub).
8. **Trust-and-safety staffing.** One human moderator on call before any paid growth.

---

## 8. Keyword targets (with intent and the page that should own each)

Volumes: public pages showed **no reliable numbers** for these exact phrases. Before choosing, pull real volumes from Google Keyword Planner, Semrush or Ahrefs, and record them here.

Intent codes:
- **I** = informational
- **C** = commercial
- **L** = local commercial
- **N** = navigational

**`?v=` views are thin for SEO.** The plan is to create static landing pages, marked *(to build)*. Use the eyetoad.com spec-page generator pattern.

| # | Keyword | Intent | Target page |
|---|---|---|---|
| 1 | facebook alternative | C | `/facebook-alternative/` *(to build)*: comparison page |
| 2 | facebook alternatives 2026 | C | same, plus a blog post |
| 3 | social media without algorithm | I/C | `/mission/#promise` → `/no-algorithm/` *(to build)* |
| 4 | chronological feed app | C | `/no-algorithm/` |
| 5 | ad free social media | C | `/mission/#promise` |
| 6 | social media no ads no tracking | C | `/mission/#promise` |
| 7 | privacy focused social network | C | `/privacy-first-social-network/` *(to build)* |
| 8 | private social network for family | C | `/circles/` *(to build, links into `/?v=circles`)* |
| 9 | private social media app | C | `/circles/` |
| 10 | close friends list for every post | I | `/circles/` |
| 11 | adults only social network / 18+ social media | C | `/adults-only/` *(to build; careful wording, it is not adult content)* |
| 12 | nextdoor alternative | C | `/nextdoor-alternative/` *(to build)* |
| 13 | facebook marketplace alternative | C | `/?v=groups` → `/buy-sell-trade/` *(to build)* |
| 14 | facebook marketplace scams | I | blog: "How to avoid Marketplace scams (FTC data)" |
| 15 | safe local marketplace app | C | `/buy-sell-trade/` |
| 16 | buy sell trade groups denver | L | `/buy-sell-trade/denver/` *(to build)* |
| 17 | denver buy sell trade | L | same |
| 18 | colorado marketplace online | L | `/buy-sell-trade/colorado/` *(to build)* |
| 19 | free business page | C | `/?v=brand` → `/free-brand-page/` *(to build)* |
| 20 | free business listing | C | `/free-brand-page/`, and send listings to usabusinesssearch.com |
| 21 | free business listing denver | L | `/free-brand-page/` → cobusinesslist.com |
| 22 | local business directory colorado | L | cobusinesslist.com (owner site), linked from `/?v=grow` |
| 23 | press release distribution | C | distributepressreleases.com, linked from `/?v=grow#pr` |
| 24 | free press release builder | C | distributepressreleases.com/tools/release-builder/ |
| 25 | ai lead response / speed to lead | C | aispeedtoleads.com, linked from `/?v=grow` |
| 26 | skool alternative | C | `/?v=spaces` → `/free-community-platform/` *(to build)* |
| 27 | circle community alternative | C | same |
| 28 | discord alternative for communities | C | same |
| 29 | free online course platform | C | `/?v=courses` landing *(to build)* |
| 30 | vr social platform | I/C | `/world/` |
| 31 | horizon worlds alternative | C | `/world/` plus a blog post (news hook) |
| 32 | webxr social / browser vr world | I | `/world/` |
| 33 | personal life dashboard app | C | `/?v=board` landing, plus ailifeboard.com |
| 34 | how to download facebook data / delete facebook | I | blog → `/?v=mydata` |
| 35 | 3d virtual mall | C | worldvrmall.com |
| 36 | free video call link | C | `/meet/` |

---

## 9. Traffic plan: real visits to allofus.one and Zach's sites

**Link policy (do not break):**
- Every outbound promo link from allofus to own sites is `rel="sponsored noopener"`: zero followed own-site links.
- At most one followed eyetoad.com credit per site.
- Never mention Bighorn Painting.
- Painter Hotline and Bighorn never share branding. **TODO:** `js/aou-brand.js` still lists "Bighorn Painting" among the network brands in its header comment and seed list. Review it and remove it in the next round.

1. **Launchpad loop (live now).** `/?v=grow` sends business members to the six tools, with UTM tags. Measure them in each site's analytics as `utm_source=allofus`, split by `utm_content` per tool.
2. **Press releases.** Every Brand page that launches gets a release:
   - Use the launchpad builder.
   - Publish on pressreleaseforbusiness.com, linking back to the Brand page with nofollow from the PR site.
   - Announce it on the member's own feed (the launchpad's "Announce it" button).
3. **Directory cross-listing.** Every USA Business Search and Colorado Business List listing gets an optional "Also on allofus.one" Brand-page link, nofollow per policy. Every allofus Brand page gets a "Get your free listing" nudge (launchpad).
4. **AI Speed to Leads.**
   - The launchpad and Ask allofus both explain it and link to the live demo.
   - Business members get it as the 5th checklist step.
   - Rules: consent-only. Never cold calling. Never name prospects publicly.
5. **Seeded local groups.** Denver, Aurora, Lakewood and Colorado Springs buy/sell/trade groups, posted to daily by real admins. The "200,000+ member local groups" claim in Orbit and searchBOOST needs a source on file; if it cannot be documented, soften it.
6. **Static SEO landing pages** from §8 (10 pages first: rows 1, 3, 8, 12, 13, 16, 19, 26, 31, 34). Add them to `sitemap.xml`, which today has **duplicate `<loc>` entries**, so fix it, and to `llms.txt`.
7. **AI search (AEO).** Expand `llms.txt` with Circles, Your data, the promise and the launchpad, and use FAQ JSON-LD on the landing pages.
8. **World VR Mall ↔ allofus SSO** already exists. Put an "Open my allofus page" door in the mall and a mall door in `/world/`.
9. **Founder content.** Zach's mission story (`/mission/`) as a short video, cross-posted, linking to `/mission/#promise`.

---

## 10. KPIs and how to pull them (run in Supabase → SQL Editor)

`aou_kpi_daily` begins filling once `v26-features.sql` runs, and daily if pg_cron is enabled. `presence` keeps only each member's *last* visit, which is why the snapshot table exists. Historical DAU before 2026-10-23 is **not recoverable.**

```sql
-- members and signups per week
select count(*) as members from auth.users;
select date_trunc('week', created_at)::date as week, count(*) as signups from auth.users group by 1 order by 1 desc limit 12;

-- active now / DAU / WAU / MAU (from last-seen)
select count(*) filter (where last_seen > now() - interval '1 day')  as dau,
       count(*) filter (where last_seen > now() - interval '7 days') as wau,
       count(*) filter (where last_seen > now() - interval '30 days') as mau
from public.presence;

-- posts, comments and reactions per day (last 30 days)
select d::date as day,
  (select count(*) from public.feed_posts p where p.created_at::date = d::date) as posts,
  (select count(*) from public.feed_comments c where c.created_at::date = d::date) as comments,
  (select count(*) from public.feed_reactions r where r.created_at::date = d::date) as reactions
from generate_series(now() - interval '29 days', now(), interval '1 day') d order by 1 desc;

-- creators: share of members who posted in the last 30 days
select round(100.0 * count(distinct user_id) / nullif((select count(*) from auth.users), 0), 1) as pct_posting_30d
from public.feed_posts where created_at > now() - interval '30 days';

-- week-1 retention by signup week (active = posted, commented or reacted 7-14 days after joining, or last_seen > day 7)
with u as (select id, created_at from auth.users),
act as (
  select user_id, created_at from public.feed_posts union all
  select user_id, created_at from public.feed_comments union all
  select user_id, created_at from public.feed_reactions)
select date_trunc('week', u.created_at)::date as cohort, count(*) as joined,
  count(*) filter (where exists (select 1 from act a where a.user_id = u.id and a.created_at between u.created_at + interval '7 days' and u.created_at + interval '14 days')
                    or exists (select 1 from public.presence p where p.user_id = u.id and p.last_seen > u.created_at + interval '7 days')) as active_w2
from u group by 1 order by 1 desc limit 12;

-- business side
select count(*) as brand_pages, count(*) filter (where created_at > now() - interval '30 days') as new_30d from public.pages;
select count(*) as page_follows from public.page_follows;

-- Circles adoption (after v26)
select count(distinct owner_id) as members_with_circles, count(*) as circles from public.circles;
select count(*) as circle_posts_30d from public.feed_posts where circle_id is not null and created_at > now() - interval '30 days';

-- AI guide usage and cost (after v26)
select date_trunc('day', at)::date as day, count(*) as questions, sum(tokens_in) as tin, sum(tokens_out) as tout,
       round((sum(tokens_in) * 0.10 + sum(tokens_out) * 0.50) / 1e6, 4) as usd_estimate
from public.aou_guide_hits group by 1 order by 1 desc limit 30;

-- daily snapshot history (investor chart)
select * from public.aou_kpi_daily order by day desc limit 90;
```

The guide's `usd_estimate` uses Claude Haiku 5.5 at $0.10 per million input tokens and $0.50 per million output tokens, for prompts under 100K tokens.

**Targets to set once the baseline is known.** Don't publish these as achievements.

| Metric | Target |
|---|---|
| DAU/MAU | ≥ 20% |
| Week-1 retention | ≥ 25% |
| Members posting monthly | ≥ 15% |
| Brand pages | +50 per month |
| Launchpad clicks per Brand page | ≥ 1 |
| Report response time | < 24 h |
| AI guide cost | < $1 a day |

Outbound visits are tracked in each destination's analytics (GSC and GA on those sites) by `utm_source=allofus`. allofus itself keeps no click logs, by promise.

---

## 11. AI guide: deploy steps for Zach (about 10 minutes)

1. **Get a key.** Go to console.anthropic.com → API Keys → Create key. Name it "allofus guide". Copy it.
   - Add a monthly spend limit in Console → Billing → Limits. **$10 is plenty**: the guide uses Haiku 5.5 at about $0.10/$0.50 per million tokens, with 500 max output tokens.
2. **Create the function.** In Supabase (project `izfccjaznlcffvjxawya`), go to **Edge Functions** → **Deploy a new function** → **Via Editor**.
   - Name it exactly `aou-guide`.
   - The editor shows a file tree. Replace `index.ts` with the full contents of `supabase/functions/aou-guide/index.ts`.
   - Click **Add file**, name it `knowledge.ts`, and paste the full contents of `supabase/functions/aou-guide/knowledge.ts`.
   - Click **Deploy function**.
3. **Add the secret.** Edge Functions → **Secrets** (Manage secrets) → Add:
   - `ANTHROPIC_API_KEY` = the key from step 1
   - optional: `GUIDE_SALT` = any random words (salts the visitor hash)

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
4. **Leave "Verify JWT" ON.** The site sends the anon key or the member's session, so visitors who are not signed in still work.
5. **Run `supabase/_parts/v26-features.sql`** in the SQL Editor. This creates the rate-limit counter; without it, the function falls back to a per-instance memory limit.
6. **Test.** Open allofus.one → the help hand (Orbit) → ask "how do I keep my work posts away from my family?" The answer should end with "AI answer, can be wrong".
   - If you get the scripted map answer instead, open Edge Functions → aou-guide → **Logs**.
7. **CLI alternative** (if the editor will not take two files):
   - `npx supabase login`
   - `npx supabase functions deploy aou-guide --project-ref izfccjaznlcffvjxawya`, run from the repo root
   - `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref izfccjaznlcffvjxawya`
8. **CSP note for the SAFETY round.** If a Content-Security-Policy is added, `connect-src` must include `https://izfccjaznlcffvjxawya.supabase.co`. That covers `/functions/v1/aou-guide` too.
9. **Editing what the guide knows.** Change `knowledge.ts`, then redeploy. The guide may only state facts that are in that file.

---

## 12. Investor section

**Problem.**
- Mainstream social is paid for by behavioral ads. That rewards outrage and scams:
  - $2.1B in reported social-media scam losses in 2025
  - $794M from Facebook alone, per the FTC
- Audiences mix: family, boss and neighbors all see everything.
- Portability is being forced by law (Utah HB 418, EU DMA) rather than offered.
- Small local businesses pay several vendors to get found.

**Solution.**
- One adult, ad-tracker-free network:
  - a chronological feed with visible reasons
  - Circles
  - one-click data export
  - local groups and Brand pages
  - free Spaces, Courses and Events
  - an AI guide
  - a walk-in 3D/VR world
- The business launchpad turns members into customers of existing, already-operating services.

**Why now.**
- The private-sharing shift (Mosseri, 2025).
- Portability laws are arriving (Utah, July 2026).
- Bluesky's daily use is falling while sign-ups grow, which shows demand for alternatives without retention.
- Meta is retreating from social VR.
- Funded comparables:
  - Bluesky $100M Series B (2025, disclosed 2026) [TNW](https://thenextweb.com/news/bluesky-raises-100m-series-b-as-new-ceo-takes-charge)
  - Yope $12.3M seed (2026)
  - Substack $100M Series C at about $1.1B (2025) [Variety](https://variety.com/2025/digital/news/substack-raises-100-million-chernin-group-skims-investors-1236463721)

**Moat.**
1. **Trust posture as product.** No trackers, a restrictive-RLS circle model, and export in one tap. This is hard for ad-funded incumbents to copy.
2. **Built-in revenue engine.** These are existing, operating services. Use their own revenue figures from Eye To Ad Media's books; none are stated here.
   - a directory network (USA Business Search, Colorado Business List)
   - PR sites (Press Release for Business, Distribute Press Releases, Action Global News)
   - AI Speed to Leads
   - World VR Mall
   - an agency with 14 years of local clients
3. **Cheap to run.** Static hosting plus Supabase. The AI costs fractions of a cent per question.
4. **Shipped surface area.** Feed, messaging, groups, Spaces, Courses, Events, LIFEboard, FLOWworks, a 3D world and WebXR are all live today, built by a tiny team with AI-assisted development.

**Traction.** **Do not quote numbers until the §10 queries are run.** Fill this table from SQL on the day of the meeting:

| Metric | Value (date) | Query |
|---|---|---|
| Members | ___ | §10 members |
| WAU / MAU | ___ | §10 DAU/WAU/MAU |
| Posts per day (30-day average) | ___ | §10 posts/day |
| Week-1 retention | ___ | §10 cohort |
| Brand pages | ___ | §10 business |
| Launchpad → partner visits | ___ | partner GA filtered by utm_source=allofus |

**Use of funds (outline, for a seed raise; size it to 18 months of runway).**
- 35%: engineering (two full-stack engineers, a mobile wrapper, the import tool, payments)
- 20%: trust and safety (moderators, age assurance, NCMEC SOP, legal counsel, policies)
- 20%: local growth in the Denver metro first (community managers for groups, events, business onboarding)
- 10%: infrastructure (Supabase Pro or Team, storage/CDN, AI usage, monitoring)
- 10%: brand and content (landing pages, video, PR)
- 5%: reserve

**Risks and mitigations.**

| Risk | Mitigation |
|---|---|
| Moderation failure, or child safety | 18+ gate with DOB; report → auto-hide; evidence preservation; NCMEC reporting; human moderator before paid growth |
| Legal: age-verification laws, UK OSA, AI companion laws | Adults-only; AI is a disclosed guide, not a companion; geo-fence the UK until age assurance is in place; counsel review of terms and privacy |
| Cold start / empty feed | Labeled seed posts; local groups; business members bring their customers; Circles make small networks feel full |
| Retention after novelty (Bluesky pattern) | Circles + groups + LIFEboard give daily reasons; KPI snapshots tell the truth early |
| Founder bandwidth (one-person company + AI) | This gameplan, feature-detected modules, and runbooks; hire engineering first |
| Brand confusion with Zach's other sites | Clear "built by Eye To Ad Media" credit; sponsored links; no shared client branding |
| 3D/VR cost and complexity | Keep VR as an opt-in showcase; the Feed is the front door |

---

## 13. Hand-off checklist

**Where things live**
- Repo: `Desktop\01 SEARCH CONVERTS LLC\Search Converts Website Network\09 SHOWCASE - VR, Games & Creative\allofus.one\allofus.one-main` (GitHub `seniorhelper/allofus.one`, branch `main`, GitHub Pages).
- SQL: `supabase/` (cumulative files), with today's parts in `supabase/_parts/`.
- Edge Function: `supabase/functions/aou-guide/`.
- Strategy copy: `Desktop\00 IDEAS & STRATEGY\allofus.one MASTER GAMEPLAN.md`. The repo root copy is the master; re-copy it after edits.
- Network repos for the linked sites: `Search Converts Website Network\05 TIER 3 - Authority - PR, News & Directories\` and `10 AI BOTS & TOOLS\aispeedtoleads.com`.

**How to deploy a round**
1. Run QA (§3).
2. Concatenate today's SQL parts into one `supabase/allofus-ALL-v26.sql` (safety first, then features).
3. Bump `sw.js` `const V`.
4. Commit and push `main`. Pages deploys in about 1 minute.
5. Zach runs the SQL in the SQL Editor. Run the SQL before the site push, or right after it: both orders are safe.
6. Deploy or redeploy the Edge Function if it changed (§11).
7. Check the site on a phone, a laptop and the Quest.

**Who runs what**
- Zach: SQL Editor runs, Supabase secrets, Anthropic key, git push. Claude cannot write repo secrets.
- Claude sessions: code, QA, docs. They never commit or push without Zach's go-ahead.

**Open TODOs (v26 and next)**
- [ ] Run `v26-safety.sql`, then `v26-features.sql`.
- [ ] Deploy `aou-guide` and set `ANTHROPIC_API_KEY`, with a spend limit.
- [ ] Optional: enable pg_cron and schedule `aou_kpi_snapshot()`.
- [ ] Add the new views to the DESIGN round's grouped menu (`js/aou-ux.js` `UX_GROUPS`):
  - `/?v=grow` in Create & Grow
  - `/?v=circles` in Connect
  - `/?v=mydata` in You
- [ ] Add titles and descriptions for `grow`, `circles` and `mydata` to the `TITLES` / `DESCS` maps in `aou-flat2.js`.
- [ ] Bump `sw.js` and push, in one push with the SAFETY and DESIGN rounds.
- [x] Remove `/hearts/` from `sitemap.xml`, `llms.txt`, `index.html` JSON-LD and the meta description after the SAFETY push. The home description still says "Hearts 18+ mind-first matching".
- [ ] Fix the duplicate entries in `sitemap.xml`.
- [ ] Remove the Bighorn Painting mention from `js/aou-brand.js`.
- [ ] Source or soften the "200,000+ member local groups" claim (Orbit, searchBOOST).
- [ ] Build the 10 static SEO landing pages (§9.6).
- [ ] Register with NCMEC as an ESP; write the moderation SOP.
- [ ] Decide on the UK: geo-fence or age assurance.
- [ ] Phase 2: Facebook import tool. Phase 2b: Stripe Connect for tips and paid Spaces, after legal review.

**Untested today (needs a signed-in adult test account after the SQL is run)**
- Circle create, add and remove member, posting to a circle, and the circle feed filter.
- That a non-member cannot read a circle post (RLS test with two accounts).
- The live AI answer path. The fallback path *was* tested: with the function not deployed, Orbit gives the scripted answer.


---

## 14. GROWTH round (v27, 2026-10-23): tour, LIFEspark, Discover, member email, your graph is yours

*Not pushed. Needs `supabase/_parts/v27-growth.sql` (run after the v26 files) and, for email, two Edge Functions plus a Resend account. Everything below feature-detects: the site works before the SQL and before any function is deployed.*

### 14a. What shipped

| # | Feature | Where | Files | Needs |
|---|---|---|---|---|
| 1 | **Take the tour**: 12-step spotlight tour (feed, Circles, LIFEboard, FLOWworks, Brand + Grow, Groups, Unity Call, Spaces + Global Room, 3D/VR + World VR Mall, Moments, Your data, Ask allofus). Keyboard, swipe, progress dots, a preview card with "Open it" when the element is off-screen. Offered once to a new member after the short onboarding and once to an anonymous visitor on their 2nd visit. | Header link (desktop), "Tour" quick-start bubble, More → Help, `/?tour=1` | `js/aou-tour.js` (new); 3 one-line hooks in `aou-flat2.js`; `aou-ux.js` menu | Nothing |
| 2 | **LIFEspark** ("your daily spark"): a daily spark from 125 original prompts (post it, or save it to the LIFEboard journal), three tiny wins per day, a 2-minute breathing timer, "Ask allofus" (the guide in `mode:'spark'`, scripted fallback when not deployed), and "Ideas for your business" from the Brand page category. | `/?v=spark` (`muse` is a silent alias), "Spark" bubble, Create & Grow menu | `js/aou-lifespark.js` (new), `aou-board.js` `lbAdd()` export, `aou-ai-guide.js` mode param | SQL for `spark_days` (else device storage); guide redeploy for the AI tab |
| 3 | **"Today on allofus" cards** in the home feed: daily spark, LIFEboard tip, feature spotlight (12 rotating, incl. World VR Mall), "Posting lately" (real counts only), Discover teaser. Labeled "allofus", at most 1 per 6 posts and 4 per load, with Dismiss and "Fewer like this" (device prefs; a `less` word of allofus / tips / cards in `aou_feedprefs` turns them off). | Home feed | `js/aou-content.js` (new); 1 hook after the circles hook in `feedList` | Nothing |
| 4 | **Discover**: NASA (APOD with `CONFIG.NASA_KEY` or `DEMO_KEY`; the keyless NASA Image Library as fallback), Wikipedia featured feed (featured article, picture of the day, most read, on this day), Action Global News, and Pixabay once `CONFIG.PIXABAY_KEY` exists. Allow-listed HTTPS hosts only; source + credit on every card; "Share to feed" opens the real composer with the link and credit prefilled. | `/?v=discover`, Explore menu | `js/aou-content.js` | Optional keys (14d) |
| 5 | **Email opt-in** at sign-up ("Email me the occasional allofus update"), stored to `profiles.email_optin`; a welcome email on join; a Sunday digest for opted-in members; one-click unsubscribe (`/?unsub=<token>` → `unsubscribe(token)` RPC); Admin → **Members + email** (counts, "Send test digest to me", "Send test welcome to me"). | Sign-up sheet, email, admin | `aou-feedplus.js` (checkbox + 2 lines), `aou-admin.js` (nav + section), `aou-content.js`, `supabase/functions/welcome-mail`, `supabase/functions/weekly-digest` | SQL + Resend (14c) |
| 6 | **What's new**: the last 5 release notes. | More → Help | `aou-content.js` `WHATS_NEW`, 1 line in `aou-flat3.js` moreSheet | Nothing |
| 7 | **Your graph is yours**: an Ed25519 key made in the browser (WebCrypto), the public half stored as a `did:key` in `profiles.pubkey`, the private key downloaded as a file, a **signed export** (export JSON + detached `.sig.json`), and **/?v=verify**, which checks a pair locally. Explained on `/mission/#yours`. | Your data page, mission page | `js/aou-identity.js` (new), 1 line in `aou-circles.js` myDataView, `mission/index.html` | SQL for `pubkey` (the key still works on-device without it) |
| 8 | **Content plan**: 30 original posts and a weekly rhythm for the founder account. | `content/seed-posts.md`, `content/weekly-rhythm.md` | | Zach posts them by hand; nothing was posted to production |

New view keys: `spark` (alias `muse`), `discover`, `verify`. `TITLES` / `DESCS` and the dispatch line sit in `aou-flat2.js` next to the v26 block.

### 14b. SQL and deploy order

1. `v26-safety.sql` → 2. `v26-features.sql` → 3. **`v27-growth.sql`** (also safe alone; it needs only `public.is_admin()`).
   - Adds `profiles.email_optin`, `email_optin_at`, `pubkey`, `pubkey_at`; `public.email_tokens` (RLS on, no policies: service role only); `public.spark_days` (RLS, own rows); `unsubscribe(uuid)` (anon may call it, by token only); `aou_email_stats()` (admin); `aou_digest_data()`, `aou_digest_recipients()`, `aou_member_mail()` (service role).
4. Redeploy **`aou-guide`** (it now reads `mode`; `knowledge.ts` has `SPARK_KNOWLEDGE` and the new features). Same steps as §11, two files.
5. Deploy **`welcome-mail`** and **`weekly-digest`** (14c).

### 14c. Comms: member email, step by step (Zach, about 30 minutes)

**Policy.** One welcome email to every new account (transactional). The weekly digest goes only to members with `email_optin = true`. Every email carries a one-click unsubscribe. No tracking pixels, no open tracking, no third-party lists. Account notices (password reset, confirmation) stay with Supabase Auth.

1. **Resend account.** resend.com → sign up with zach@eyetoad.com → **Domains → Add domain** `allofus.one`. Resend shows the DNS records to add where allofus.one's DNS lives (the registrar or Cloudflare):
   - an MX record on the `send` subdomain (exact host and value shown by Resend)
   - a TXT SPF record on that subdomain (`v=spf1 include:amazonses.com ~all`, as shown)
   - a TXT DKIM record (`resend._domainkey`, value shown)
   - optional DMARC: `_dmarc.allofus.one` TXT `v=DMARC1; p=none; rua=mailto:info@eyetoad.com`
   Click **Verify**. Then **API Keys → Create** ("allofus mail", sending access, domain allofus.one). Copy the key once.
   The free tier is 3,000 emails a month and 100 a day; the digest sends 50 per request. Make `hello@allofus.one` a real mailbox or a forward to info@eyetoad.com so replies land somewhere.
2. **Secrets.** Supabase → Edge Functions → Secrets:
   - `RESEND_API_KEY` = the key
   - `WEBHOOK_SECRET` = any long random string (welcome webhook)
   - `CRON_SECRET` = another long random string (digest schedule)
   - optional `MAIL_FROM` = `allofus <hello@allofus.one>`
3. **Deploy the functions** (CLI from the repo root; the editor route works too, one file each):
   - `npx supabase functions deploy welcome-mail --project-ref izfccjaznlcffvjxawya --no-verify-jwt`
   - `npx supabase functions deploy weekly-digest --project-ref izfccjaznlcffvjxawya --no-verify-jwt`
   - `npx supabase functions deploy aou-guide --project-ref izfccjaznlcffvjxawya` (JWT verification stays on for this one)
   `--no-verify-jwt` is needed because the webhook and pg_cron carry no user token; the shared secrets and the founder check are the auth. The admin buttons still send the admin's JWT, which is checked against the founder id.
4. **Welcome webhook.** Supabase → Database → Webhooks → **Create**: name `welcome-mail`, table `public.profiles`, event **Insert**, type **HTTP Request**, method POST, URL `https://izfccjaznlcffvjxawya.supabase.co/functions/v1/welcome-mail`, HTTP header `x-webhook-secret` = the `WEBHOOK_SECRET` value. Save.
5. **Digest schedule.** Database → Extensions → enable **pg_cron** and **pg_net**. Then run the commented `cron.schedule` block at the end of `v27-growth.sql` with `<CRON_SECRET>` filled in (Sundays 15:00 UTC = 8 am Denver in winter).
6. **Test.** Sign in as the founder → Admin → **Members + email** → "Send test welcome to me", then "Send test digest to me". Both land in the founder's email. The counts card shows members / opted in / new in 7 days.
7. **Unsubscribe check.** Open the unsubscribe link from the test email: the site shows "Done. You are unsubscribed" and `profiles.email_optin` flips to false. Re-opt-in is by the member only (a Control panel toggle is a TODO; until then a member emails info@eyetoad.com).

### 14d. Free API keys for Discover (optional)

- **NASA:** api.nasa.gov → "Generate API Key" form (name, email) → the key arrives by email at once. Put it in `js/aou-config.js` as `NASA_KEY: '...'`. Without it the site uses `DEMO_KEY` (30 requests an hour per IP, 50 a day; cached 6 hours in the visitor's session) and falls back to the keyless NASA Image Library, which is what ran during QA because APOD returned HTTP 500 on 2026-10-23.
- **Wikipedia:** no key. The featured feed is public (`api.wikimedia.org/feed/v1/wikipedia/en/featured/…`); the site sends `Api-User-Agent: allofus.one Discover (info@eyetoad.com)` as their policy asks. Text is CC BY-SA 4.0 and is credited on the card; images link to their Commons file page for the license.
- **Pixabay:** pixabay.com → create a free account → pixabay.com/api/docs/ shows your key at the top of the page while signed in. Put it in `aou-config.js` as `PIXABAY_KEY: '...'` and the Pixabay tab appears. Compliance is built in: results are shown only as temporary search results (cached 24 h as their terms require), never hot-linked into posts ("Share to feed" shares the Pixabay page URL plus "Photo: <user> via Pixabay"), a source line sits on every card, and the 100-requests-per-60-seconds limit is far above what the page can generate.
- **Own sites:** checked 2026-10-23, there is no RSS or JSON feed on eyetoad.com or aispeedtoleads.com (404/403), so they are not in Discover. Add a `feed.json` (JSON Feed 1.1, like actionglobalnews.com) to either site and it can be added to the allow-list in `aou-content.js` in one line.

### 14e. Nexus phase 2, "sovereign identity": what v27 did and what comes next

v27 ships the practical first step: a member can hold a key pair whose private half allofus never sees, publish the public half as a `did:key` (W3C did-core, Ed25519, multicodec `0xed01`, base58btc), and sign their one-click export so anyone can verify it with no allofus server in the loop (`/?v=verify`, or any Ed25519 library over the file bytes). This is deliberately **not** a blockchain, token, wallet or ICO, and it will not become one: the goal is portability and proof of authorship, which need a key, not a ledger. Next steps, in order: (1) `did:web` handles (`did:web:allofus.one:u:<name>`) that resolve to the same public key, so the identifier is readable; (2) signed posts (each post carries a signature over its canonical form, verifiable by third parties even from a screenshot); (3) an **import tool** for the exports other networks must now provide (Utah HB 418, EU DMA Art. 6(9)); (4) an AT Protocol or ActivityPub read-only bridge for public Brand pages and posts, so a member's public graph can be followed from Bluesky or Mastodon; (5) key rotation and recovery (a new key signed by the old one). Never a token, never a fee to hold your own identity.

### 14f. Untested today

- Anything that needs a signed-in member: posting a spark, "Save to LIFEboard" (`lbAdd`), `spark_days` saves, the email opt-in write at sign-up, storing `pubkey`, the signed export download, and the admin Members + email section with real counts.
- The live `mode:'spark'` AI path (the scripted fallback was tested; the function is not deployed).
- Welcome and digest emails end to end (no Resend account yet). Both functions were written against the Resend REST API (`/emails`, `/emails/batch`) and the SQL helpers; they are not type-checked by Deno here.
- NASA APOD itself (HTTP 500 all evening; the Image Library fallback was verified in the browser).
- Pixabay (off until a key exists).
- Verified in the browser: the tour end to end at 1280 px and 375 px, the second-visit offer, LIFEspark (Today, breathing timer, Ask allofus fallback), Discover with NASA + Wikipedia + World news, 4 system cards in the feed, the What's new sheet, the identity block and verify page, mission `#yours`, and no horizontal scroll on any of these.

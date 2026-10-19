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

## v3 upgrade (Oct 2 2026)
1. Upload this whole folder to the repo root (replace everything).
2. In Supabase → SQL Editor, run the private `allofus-admin-upgrade.sql` you received separately (never commit it: it lists owner emails). It adds the admin console, ownership for No. 1 Unity Road and 8 Silk Lane, reports, and bans.
3. Sign out and back in. The 🛡️ Admin tile appears under ✨ More for the admin email.

### Email me when someone joins (optional, about 10 minutes)
Supabase does not email you about new accounts by default. The 🛡️ Admin console shows "new since your last visit," and for real emails:
1. Make a free Zapier (or Make.com) account → new Zap → trigger **Webhooks by Zapier → Catch Hook** → copy the webhook URL.
2. Supabase → Database → Webhooks → **Create a new hook** → table `profiles`, event **Insert**, type **HTTP Request**, method POST, paste the URL.
3. Zap action **Gmail → Send Email** to yourself with the name and city fields. Turn it on.

## v4 upgrade (Oct 2 2026)
1. Upload this folder to the repo root.
2. Supabase → SQL Editor → run `supabase/v4-storage.sql` (conference uploads).
3. Voice chat works out of the box (peer-to-peer). On very strict networks add a TURN server in `js/aou-config.js`.
4. One login with World VR Mall: when the mall is upgraded it gets `js/aou-sso.js` and the same Supabase keys; travel links then carry your login over.

## v17 upgrade (Oct 9 2026) — pages you manage, pre-claimed client pages, auto-connect, hugs inbox
1. Upload this folder to the repo root (or merge the branch). Nothing in it removes or rewrites data.
2. Supabase → SQL Editor → run `supabase/allofus-v17.sql`. It is additive only (new columns with defaults, new policies, one trigger, one new table) and safe to re-run. Members who are online keep working through it.
3. Sign out and back in once. **Pages I manage** on your profile now lists the 11 network pages (owned by whichever of your two emails signed up first; both emails are admins).
4. To pre-claim a page for a client: open the page → ⚙ Manage → "Pre-link managers by email". The second they create an account with that email, the page is theirs (trigger) and the guided tour walks them through it.
5. Every new member starts connected to you (they can remove it from Connections). Members who joined before v17 are connected by the migration too.

## v18 upgrade (Oct 9 2026) — faster Feed, guided tour, connections panel, editable posts, widget dash
1. Upload this folder (or merge the branch). Static files only; nothing here removes or rewrites data.
2. Supabase → SQL Editor → run `supabase/allofus-v18.sql` **after** v17. Additive only: one new table (`page_follows` for the Follow button on Brand pages), defensive `add column if not exists` on `pages` / `feed_posts` (no-ops on an up-to-date project), indexes for the Feed's hot queries, and `feed_posts` / `presence` / `hugs` added to the realtime publication. Safe to re-run.
3. What changes for members, no action needed:
   - The Feed paints its shell (header, rail, skeleton cards) before any network call; if the Supabase CDN does not answer within 2.5 s the page opens in demo mode and upgrades itself when it arrives.
   - Every signup gets the 5-step tour (page & photo → connections → post → LIFEboard → 3D / VR). Existing accounts see it once; **Control panel → Preferences → Replay the tour** runs it again.
   - Anyone whose email was pre-linked to a Brand page (v17 `admin_emails`) gets the 4-step claim flow on their first sign-in: welcome → finish profile → review the page → their VR home spot. `?debugclaim=<slug>` previews it.
   - Home and Connections show a live Connections panel (online dot from `presence`, right-click / long-press / ⋯ for Hug, Crush, High five, Wave, Cheer, Message, View page, Disconnect). Hugs land in the `hugs` table and show as a toast + badge, live.
   - Posts have a visible ✎ edit button (text, link, price, location); edits set `edited_at` and show an "edited" marker.
   - "Happening now" shows real posts only — feed posts with photo / video thumbnails first, 3D-world posts merged in; filler only when there is not a single real post.
   - Life Dash on the LIFEboard is a widget board: every tool is a tile (S / M / L), with ⚙ options (size, colour, order, hide), drag to reorder, expand to full screen. The layout saves in `lifeboards.data.dash`.
4. Brand pages: the header is the ad now (full-bleed cover with the brand colour, logo badge, headline, proof chips, Call / Website / Message + Follow / Share / Visit in 3D). Managers get the **⚙ Manage** bar: cover, logo, tagline, main button, **Pre-link managers by email** (writes `admin_emails`), **VR home spot** (writes `vr_home`). **Pages I manage** (profile + Control panel) lists every page you own or manage; network admins also see the built-in brands with a one-tap **Set up network pages** that inserts the missing rows with the v17 columns.

## v19 (Oct 9 2026) — client accounts (Ritchie), founder connection fixes, 3D mailbox
**Run order in Supabase → SQL Editor** (each is additive and safe to re-run; run every one even if you ran an earlier one before):
1. `supabase/allofus-v17.sql` — `pages.admin_emails` / `vr_home` / `claimed_at`, the welcome trigger (new member → connected to Zach, pre-linked pages attached), `claim_my_pages()`, hugs, the network page seed.
2. `supabase/allofus-v18.sql` — `page_follows`, defensive columns, Feed indexes, realtime.
3. `supabase/allofus-v19-clients.sql` — the client accounts:
   - Raised In a Barn Furniture (`raised-in-a-barn`): pre-links **wasraisedinabarn@gmail.com** (both Zach emails stay), VR home **Art Garden** (`art`), phone, website and the World VR Mall store link. If Ritchie already has an account he is linked into `pages.admins` immediately. An older row saved under `raised-in-a-barn-furniture` is renamed if the short slug is free.
   - Anyone on any page's `admin_emails` who already has an account is linked now.
   - Pre-linked emails may edit and post as their page even before the account is linked (policy on the signed-in email). **Keep Authentication → Email → Confirm email ON** so nobody can sign up with an address they do not own.
   - Re-creates the welcome trigger and `claim_my_pages()` with fixes: `on conflict do nothing` (v11's unordered-pair index made v17's version fail with a unique violation for anyone who had already asked Zach to connect, so their pages never attached), NULL-safe `admins`, and a pending member → Zach request is accepted.
   - New table `page_edit_requests`: when an edit is not allowed yet the app files it here and tells the person "Saved for review — Zach will publish it". Review them in Table Editor → `page_edit_requests` (status `pending`), copy the `patch` onto the page, set status `published`.
4. `supabase/allofus-v19-comm.sql` — the Comm Hub upgrade (from the Comm work stream; see its own header).

**Works before any SQL is run:** the client accounts are also in `js/aou-onboard.js` (`VIP`), so their first sign-in guide, page editing (saved for review when the database refuses) and the built-in page previews work on the current database. Members with no connection to Zach send him a pending request and see "Request sent to Zach (the founder). He'll say hi." (the database trigger does the real auto-connect once v17/v19 are in).

### Client accounts
| Person | Sign-in email | Page | What they see on first sign-in | Re-open the guide |
|---|---|---|---|---|
| Ritchie (Raised In a Barn Furniture) | wasraisedinabarn@gmail.com | `/?page=raised-in-a-barn` | The **simple guide**: big type and buttons, one thing per screen, "Step N of 6", Back / Next, "I'll do this later", auto-save, and "Call Zach for help: 1-800-481-8638" + "Email Zach" on every screen. 1 Welcome ("Zach set this up for you") → 2 Add your photo → 3 A sentence about you (pre-written, he can keep it) → 4 His business page preview (cover, tagline, phone, website) with **Looks good** / **Change the picture** → 5 "Your store in the 3D mall": **Walk into my store** (worldvrmall.com/mall/?to=raised-in-a-barn) and **Explore allofus in 3D** → 6 "You're all set": Post a photo of my furniture · Invite a friend · Go to my page. Until he finishes, a **Help me get set up** button stays on screen. | allofus.one/?guide=1, the Help me get set up button, or the button on his page |

On any page they manage they see **You manage this page · Switch to my profile · Help me get set up** above the ⚙ Manage bar.

### 3D mailbox
Zach's giant mailbox (and the Classic style in the home builder) were missing the back quarter of the round lid; both are closed from every angle now. No action needed.

## v20 (Oct 14 2026) — every page reachable, real tags + alerts, photo editor, autoplay YouTube, admin delete, welcome posts
**Run once in Supabase → SQL Editor:** `supabase/allofus-v20.sql` (additive, safe to re-run). It:
- adds comments and reactions to realtime, so tags, comments and reactions pop up live;
- adds `admin_delete_user()` for the 🛡️ Admin → Signups → **Delete** button (pages the account owned move to you; you cannot delete the account you are signed in with);
- removes a cancelled client page and its follows;
- publishes the welcome posts as real rows (labeled **allofus AI**, **allofus System** or **Orbit** with a badge) so people can react, comment and vote. Until it runs, the same posts show from `js/aou-seed.js` (read-only).

What changed for members (no action needed):
- **Nothing is hidden:** desktop header has a **More** tile, the phone More sheet lists every page (Courses, Comm Hub, Global Room, Unity Call, Moments, Games, Match, Hearts…), and **Control panel → Everything on allofus.one** lists every page grouped, with 3D ones marked. Home quick-rail tiles added since a member saved their rail (Courses, Inbox…) now appear once.
- **Mission page** uses the exact home-page header (and the phone bottom bar).
- **Tags:** type @ anywhere (posts, comments, edits) for a list of real members; a post with an @name that is not a member is stopped with a clear message; only real members turn into links; tagged people get an Alert, a live toast and (if they allow it in Control panel → Notifications) a desktop / phone notification while allofus.one is open.
- **Photo editor:** filters, brightness / contrast / color / warmth, crop (square, 4:5, 16:9, cover), rotate, flip. Opens on a single photo, ✎ Edit on every thumbnail; profile and cover photos open it pre-cropped.
- **Video:** YouTube posts autoplay muted when on screen (one at a time), run edge to edge with no frame, Shorts fill the width like a reel; **Tap for sound**. Members can switch autoplay off in Control panel → Preferences.
- **Admins:** a **Post as** picker in the composer (me / allofus AI / allofus System / Orbit); the dashboard shows a Live dot and the last update time.
- **Eye To Ad Media** Brand page has an ad-style cover and the real logo (`/images/brands/`). Uploading a cover in ⚙ Manage replaces it.
- **SEO:** every Brand page, profile and post now has its own title, description and canonical URL (they all pointed at the list page before); one h1 per view; Brand pages added to the sitemap.

## v21 (Oct 19 2026) — phone notifications, real groups, the Profile menu, polls, FLOWworks pads, Gnomad Promotions
**Run once in Supabase → SQL Editor:** `supabase/allofus-ALL-v20-v21.sql`. It is ONE cumulative file (v20 never ran on the live project: the welcome posts and the admin Delete button were missing) and it is additive and safe to re-run. It never touches member data. It:
- re-creates `vote_poll()` (votes failed when it was missing), publishes the welcome posts, adds `admin_delete_user()`, the realtime tables;
- hides a scheduled post from everyone but its author until `publish_at`; private posts are visible to the author's accepted connections;
- re-creates the welcome trigger and `claim_my_pages()` so every member starts connected to you, and backfills anyone who was missed (the Oct 19 sign-ups). A member who removes you on purpose stays removed (`profiles.home.noFounder`);
- creates `push_subscriptions` and `notifications` and the triggers that queue a notification for comments, reactions, tags, connection requests, hugs and DMs, honoring each member's switches (Control panel → Notifications, saved to `profiles.home.notif`);
- creates the Gnomad Promotions page row (owner: you) and inserts your posts for the next two weeks: two now (an update and a poll) and nine scheduled between Oct 20 and Nov 2 (Zach, Zach + AI, allofus AI, System, polls). Scheduled posts show in your own feed with a ⏰ Scheduled badge until their time; edit or delete them like any post.

### Phone + desktop push notifications: what this stack can do
- **No native app is needed.** Android (Chrome, Samsung Internet, Firefox), Windows and Mac browsers receive Web Push with the site closed. iPhone and iPad receive it too (iOS 16.4+) **after the member adds allofus.one to the Home Screen** (Share → Add to Home Screen) and turns the switch on from there; Apple does not allow push for a plain Safari tab. A native app would only add: push without the Home-Screen step on iPhone, an App Store listing, and a badge count on the icon.
- The site side is done: `sw.js` shows the notification and opens the right page on tap; `js/aou-push.js` is the opt-in card on the feed and the switch in Control panel → Notifications; the database queues a `notifications` row for every event.
- **Delivery needs a sender with a secret key.** The GitHub Action in `_push/push-notifications.workflow.yml` runs `_push/send.mjs` every 10 minutes (and on demand from the Actions tab). Two one-time steps on GitHub → allofus.one:
  - **Install the workflow:** copy `_push/push-notifications.workflow.yml` to `.github/workflows/push-notifications.yml` (Add file → Create new file on github.com works; pushing a workflow from a computer needs a token with the `workflow` scope, which is why the file is parked here).
  - **Add three repository secrets** (Settings → Secrets and variables → Actions):
  1. `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API → service_role (never put it in the site).
  2. `VAPID_PUBLIC_KEY`: the value of `VAPID_PUBLIC_KEY` in `js/aou-config.js`.
  3. `VAPID_PRIVATE_KEY`: the private half of the same pair (kept outside the repo; ask for the file `allofus-vapid-keys.txt`). Or run `npx web-push generate-vapid-keys` and put the new public key in `js/aou-config.js`.
  Until the secrets exist the job exits quietly and nothing is sent; members still get live pop-ups while allofus.one is open, as before. For delivery within seconds instead of minutes, move `_push/send.mjs` into a Supabase Edge Function and call it from a Database Webhook on `notifications` insert.

### What changed for members
- **Groups** behave like groups: open one and the right column lists its members (search, online dots, 💬 Message, 🤝 Connect on every row), the header shows "✓ You are a member · Leave group" or "＋ Join this group", and a 👥 Members button jumps to the list on phones. One member is still a group ("just you so far. Invite someone.").
- **Profile:** the Profile tab (was "My page") lands on your own page with your feed. The ⋯ menu holds Edit page, name/@username, photo, cover, All tools, Invite, Copy link, Control panel, Admin, Sign out. Control panel stays a visible button.
- **Tools gateway** in three places: the ··· More tile, the new Tools card on the right of every page (and on your profile), and Control panel → Everything on allofus.one.
- **Polls** show your vote (✓, percentages, "N votes · you voted") and remember it on the device too.
- **Feed order** is a visible choice above the feed: New (default, no ranking) · Top · Hot, with the formula printed on the switch.
- **Public switch** on the composer follows Control panel → Privacy "My posts are public by default". Off = only you and your connections.
- **FLOWworks pads:** every pad has labeled buttons (Color · − · ＋ · Full · ⋯ More), resizes from the corner or either edge, a color palette with any custom color, Lock, and a **Tracing pad** mode (bright white light box, high contrast, mirror) on Sketch, Edits, Note and Camera pads.
- **Fake people are gone:** the fictional demo-resident posts were removed from the feed. Only real members, the labeled allofus AI / System / Orbit / Zach + AI voices, and real businesses post.
- **Brand pages** have ad-style covers (`/images/brands/*.svg`), and Gnomad Promotions has a page: `/?page=gnomad-promotions`.
- **Admin dashboard** reconnects its live channel by itself and refreshes when the tab comes back to the front.

## v22 (Oct 19 2026) — lockdown: admin by account, not e-mail; pads private; page layout
**Run once in Supabase → SQL Editor:** `supabase/allofus-v22-lockdown.sql` (after ALL-v20-v21). Additive, safe to re-run.
- Why: admin rights were tied to two e-mail addresses, and a second account that signed up with one of them (the "phoenix" account) was treated as the founder and auto-added as a manager of every Brand page. Now `is_admin()` and `founder_id()` are the @zach account id; the founder's e-mails pre-link nobody; every page's manager list is cut back to its owner plus real pre-linked client accounts (Raised In a Barn). The app checks the same id (`FOUNDER_ID` in `js/aou-brand.js` / `js/aou-flat2.js`), never an e-mail.
- Privacy: FLOWworks pads were saved in `profiles.home.work`, and profiles are world-readable, so anyone could read a member's pads (notes, CRM leads) through the API. The SQL moves them into `lifeboards` (private, row-level security) and the app saves there from now on.
- Still world-readable by design: profiles (name, @username, bio, avatar, city, 3D address, quick-rail tiles, group list, notification switches, `blocked` list), pages, posts marked public, comments, reactions, presence (where someone is right now), spaces and their member lists, event RSVPs. Private: lifeboards, connections, messages, hub requests, saves, hugs, notifications, push subscriptions, posts marked private or scheduled.
- Layout: "Pages I manage" shows only in Control panel (not on the profile page); Brand page buttons fill the width two per row on phones and the Manage bar buttons are finger-sized; Eye To Ad Media has six FAQs; feed filter and order buttons are squared, bigger segmented buttons; the Orbit help tab is about twice as big on phones.

## v23 (Oct 19 2026) — the Quest 3 round: VR that does not freeze, the Dawn arrival, the mall door
No SQL. `sw.js` is v118.
- **Why it froze:** one frame at the Gateway drew 5,337 objects (11,000 meshes, 5,500 materials, 1,260 canvas signs) and the headset canvases were drawn at 1.75× (about 2 GB of textures on a Quest 3). Entering VR added a light and swapped the avatar's materials, which recompiled every shader in the world (a multi-second stall), and the lazy zones were built one per frame behind the arrival.
- **What changed (js/aou-engine.js):** headset canvases at 1.0× (sharpness now comes from mipmaps + anisotropic filtering); the far-sign layer was layer 1, which WebXR renders in the LEFT eye only (signs that flickered in one eye) — now `HIDE_LAYER` 7; no vibrate before the first tap; no per-frame Vector2 in `_movePlayer`.
- **What changed (js/aou-xr.js, VR layer v6):** `prepare()` builds every zone, compiles every shader in parallel and computes bounding spheres on the 2D page as soon as a headset is likely (`?vr=1`, headset browser, immersive-vr supported, the simulator, or the Enter VR tap); nothing heavy happens at session start any more (the hemisphere light is raised instead of added, the chrome material swap is opt-in `opts.chrome`); per-mesh distance culling while presenting (`xrLod`: small meshes far away are parked on a layer no camera renders, ~700 checked per frame, restored on exit) — the Gateway went from 5,337 to ~730 draw calls; signs are listed every 30 s / on zone changes instead of every 3 s; signs and labels stuck in the ground are lifted (`liftSign`, 100+ at the Hub); VR labels are 0.8× (never under 0.5 m tall); the wrist watch face and corner MENU button are two-sided and count on a near miss; `menuGuard()` re-parks a menu that is behind you, far, over your head or under the floor; the Dawn arrival (`vrArrival` v6: sparks → emblem → ring window → horizon reveal with a real sunrise of the engine's lights → welcome beam → "Look around, pull the trigger when you are ready"); `🏬 Go to the World VR Mall` on the Go tab; `opts.ssoHref` carries the sign-in on hops; `🔔 Arrival sound` toggle under Me; QA hooks on `app._xrApi` (`prepare, goMall, teleport, grab, moveTo, lodStats`).
- **World (world/index.html):** a walkable green portal ring to the left of the Gateway path (-14, 146) → worldvrmall.com/mall/ with `?vr=1` + `#aou_sso=` sign-in; `app.go` is wrapped so every mall link (menu, portal, Worlds globe) carries the login; place `mall-portal` on the Go tab.
- **Coaster (js/aou-coaster.js v8):** centripetal Catmull-Rom loop (the old track repeated its first point, a kink at the station), banked rails and car, chain lift, gravity speed with brakes, comfort check printed once (`app._coasterCheck`: 532 m, 43° max bank, ~20 m/s top speed), FOV kick only on screen.
- **World VR Mall round — copy over:** `_mall/wvm-xr.js` is the drop-in `js/wvm-xr.js` (identical to `js/aou-xr.js` except the four module names at the top: wvm-engine, wvm-go, wvm-icons, wvm-lifevr; the mall already has those three modules). The mall's old wvm-xr.js had three local extras to re-apply if still wanted: Go-tab paging of stores by first letter (`storesByLetter` from wvm-go.js), `aouUrl()` for the allofus links on the Worlds tab, and `opts.chrome` for the steel body (now an option in the shared file). Pass `opts.lifeboard:false` where the mall has no LIFEboard. Also copy `js/aou-engine.js` changes by hand into `wvm-engine.js`: `TEX_SCALE` 1.0 on headsets, `HIDE_LAYER` 7 for the far-sprite cull (`sp.layers.set(... ? HIDE_LAYER : 0)`), the `buzz()` guard and the `_movePlayer` Vector2 reuse. In the mall's page call `initXR(app, { ..., logoUrl: '/images/<mall mark>.svg', mallUrl: null, ssoHref })` and bump the mall's sw.js.
- **Harness:** `/world/?xrsim=1` fakes the session; drive frames with `app._frame()` (set `app.sleep=true` first so the simulator's own loop stays out of the way), `app._xrApi.state._arrival.k()` is the arrival clock, `app._xrSim.aimAt(x,y,z)` + `app._xrApi.castNow()` + `app._xrSim.trigger()` click things.

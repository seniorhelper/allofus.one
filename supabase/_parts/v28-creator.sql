-- ============================================================
-- allofus.one · v28 · CREATOR TIPS, SOCIAL FEEDS, CONNECTED TOOLS (2026-10-24)
-- Idempotent. Run AFTER v27-ads.sql (needs public.is_admin(), safety_is_adult(), safety_flag(), safety_settings,
-- audit_write(), notify(), founder_id(), reports, pages).
-- Model (Zach's brief "Creator Payouts & Tip Model v1"): creators keep 100%. allofus never holds creator money:
-- a creator links their OWN payment handles (Venmo, PayPal.me, Cash App, Ko-fi, Buy Me a Coffee, Stripe / Square pay
-- links) and a Tip tap opens that app. Tipping allofus itself is a separate, optional line that starts at $0.
-- What this adds:
--   1. Flags in safety_settings: creator_tools (default OFF), feed_items_premod (default OFF).
--   2. creator_profiles: the creator switch + the Creator Terms version the member accepted.
--   3. creator_handles: one handle per app. Writes ONLY through creator_set_handle(): format checks, a 48-hour wait
--      before a CHANGED handle goes live (anti-swap), a fresh verify code, a notification + audit row on every change.
--      Admins mark a handle verified (admin_creator_verify) after seeing the code in the payment app's bio.
--   4. creator_card(user): the only public read path for handles (live, not hidden, adult creator, flag on).
--   5. creator_tip_taps + creator_tap() + creator_stats(): tap counts, since we never see the money.
--   6. creator_feeds + creator_feed_items: YouTube / podcast / blog RSS (filled by the feed-sync Edge Function through
--      feed_ingest(), service role only) and pasted single-post embeds (TikTok, Instagram, Vimeo, Spotify, SoundCloud,
--      YouTube, X). creator_feed(user) is the public read path. Reports hide items; admins can hide items or block feeds.
--   7. platform_tips: optional tips to allofus (card via Authorize.net Accept Hosted, or a Venmo Business / PayPal tap).
--      platform_tip_start() makes an 'AOU-T…' ref; platform_tip_paid_by_ref() is for the authnet-webhook (service role).
--   8. page_integrations: Brand-page "Connected tools" (AI Speed to Leads, CommercePlugs, any webhook, links).
-- RLS summary: members read and change only their own rows, and only through the RPCs where checks matter;
--              anon reads only creator_card / creator_feed / page_tools; service-role functions are revoked from clients.
-- ============================================================

-- ---------- 1. flags ----------
insert into public.safety_settings (key, value, secret) values
  ('creator_tools', 'false'::jsonb, false),
  ('feed_items_premod', 'false'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.creator_tools_on() returns boolean
language sql stable security definer set search_path = public as $$
  select public.safety_flag('creator_tools') or public.is_admin();
$$;
grant execute on function public.creator_tools_on() to anon, authenticated;

-- ---------- 2. creator profiles ----------
create table if not exists public.creator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  headline text,
  show_platform_tip boolean not null default true,   -- the optional "also tip allofus ($0 default)" line in the tip sheet
  terms_version text,
  terms_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now());
alter table public.creator_profiles add column if not exists show_platform_tip boolean not null default true;
alter table public.creator_profiles add column if not exists terms_version text;
alter table public.creator_profiles add column if not exists terms_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'creator_profiles_headline_len') then
    alter table public.creator_profiles add constraint creator_profiles_headline_len check (headline is null or char_length(headline) <= 140);
  end if;
end $$;
alter table public.creator_profiles enable row level security;
revoke all on public.creator_profiles from anon;
revoke insert, update, delete on public.creator_profiles from authenticated;
drop policy if exists "v28 creator read own" on public.creator_profiles;
create policy "v28 creator read own" on public.creator_profiles for select using (auth.uid() = user_id or public.is_admin());
-- writes go through creator_setup() (adult + terms checks)

create or replace function public.creator_setup(p_enabled boolean, p_headline text default null, p_show_platform_tip boolean default true, p_terms_version text default null)
returns public.creator_profiles language plpgsql security definer set search_path = public as $$
declare r public.creator_profiles; v_old text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.creator_tools_on() then raise exception 'creator tools are not open yet'; end if;
  if p_enabled and not public.safety_is_adult(auth.uid()) then raise exception 'creator tools are for confirmed adults (18+)'; end if;
  select terms_version into v_old from public.creator_profiles where user_id = auth.uid();
  if p_enabled and coalesce(p_terms_version, v_old) is null then raise exception 'please accept the Creator Terms first'; end if;
  insert into public.creator_profiles as c (user_id, enabled, headline, show_platform_tip, terms_version, terms_at, updated_at)
  values (auth.uid(), coalesce(p_enabled, false), nullif(left(btrim(coalesce(p_headline, '')), 140), ''), coalesce(p_show_platform_tip, true),
          p_terms_version, case when p_terms_version is not null then now() end, now())
  on conflict (user_id) do update set
    enabled = excluded.enabled, headline = excluded.headline, show_platform_tip = excluded.show_platform_tip,
    terms_version = coalesce(excluded.terms_version, c.terms_version),
    terms_at = case when excluded.terms_version is not null and excluded.terms_version is distinct from c.terms_version then now() else c.terms_at end,
    updated_at = now()
  returning * into r;
  return r;
end $$;
grant execute on function public.creator_setup(boolean, text, boolean, text) to authenticated;

-- ---------- 3. payout handles ----------
create table if not exists public.creator_handles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  handle text not null,
  is_business boolean not null default false,
  verify_code text not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  verified boolean not null default false,
  verified_at timestamptz,
  live_at timestamptz not null default now(),
  hidden boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, kind));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'creator_handles_kind_chk') then
    alter table public.creator_handles add constraint creator_handles_kind_chk check (kind in ('venmo', 'paypal', 'cashapp', 'kofi', 'bmac', 'stripe', 'square'));
  end if;
end $$;
alter table public.creator_handles enable row level security;
revoke all on public.creator_handles from anon;
revoke insert, update, delete on public.creator_handles from authenticated;
drop policy if exists "v28 handles read own" on public.creator_handles;
create policy "v28 handles read own" on public.creator_handles for select using (auth.uid() = user_id or public.is_admin());

-- normalize what the member typed; null = not acceptable
create or replace function public.creator_handle_clean(p_kind text, p_handle text) returns text
language plpgsql immutable as $$
declare h text := btrim(coalesce(p_handle, ''));
begin
  if p_kind in ('stripe', 'square') then
    h := regexp_replace(h, '\s', '', 'g');
    if p_kind = 'stripe' and h ~ '^https://(buy|donate)\.stripe\.com/[A-Za-z0-9_-]{6,80}$' then return h; end if;
    if p_kind = 'square' and h ~ '^https://(square\.link/u/[A-Za-z0-9_-]{4,40}|checkout\.square\.site/merchant/[A-Za-z0-9_/-]{4,120})$' then return h; end if;
    return null;
  end if;
  -- strip a pasted profile URL down to the handle, and the leading @ / $
  h := regexp_replace(h, '^https?://(www\.)?(account\.)?(venmo\.com/(u/)?|paypal\.me/|paypal\.com/paypalme/|cash\.app/|ko-fi\.com/|buymeacoffee\.com/)', '', 'i');
  h := regexp_replace(h, '[/?#].*$', '');
  h := regexp_replace(h, '^[@$]', '');
  if p_kind = 'venmo' and h ~ '^[A-Za-z0-9_-]{5,30}$' then return h; end if;
  if p_kind = 'paypal' and h ~ '^[A-Za-z0-9]{3,20}$' then return h; end if;
  if p_kind = 'cashapp' and h ~ '^[A-Za-z][A-Za-z0-9_-]{0,19}$' then return h; end if;
  if p_kind in ('kofi', 'bmac') and h ~ '^[A-Za-z0-9_]{3,40}$' then return h; end if;
  return null;
end $$;

create or replace function public.creator_handle_url(p_kind text, p_handle text) returns text
language sql immutable as $$
  select case p_kind
    when 'venmo' then 'https://venmo.com/u/' || p_handle
    when 'paypal' then 'https://paypal.me/' || p_handle
    when 'cashapp' then 'https://cash.app/$' || p_handle
    when 'kofi' then 'https://ko-fi.com/' || p_handle
    when 'bmac' then 'https://buymeacoffee.com/' || p_handle
    else p_handle end;
$$;

create or replace function public.creator_set_handle(p_kind text, p_handle text, p_is_business boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_h text; old public.creator_handles; r public.creator_handles; v_live timestamptz; v_new_acct boolean;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.creator_tools_on() then raise exception 'creator tools are not open yet'; end if;
  if not public.safety_is_adult(auth.uid()) then raise exception 'creator tools are for confirmed adults (18+)'; end if;
  if p_kind not in ('venmo', 'paypal', 'cashapp', 'kofi', 'bmac', 'stripe', 'square') then raise exception 'unknown payment app'; end if;
  v_h := public.creator_handle_clean(p_kind, p_handle);
  if v_h is null then raise exception 'that does not look like a % handle or link', p_kind; end if;
  select * into old from public.creator_handles where user_id = auth.uid() and kind = p_kind;
  v_new_acct := not coalesce((select u.created_at < now() - interval '72 hours' from auth.users u where u.id = auth.uid()), false);
  if old.id is not null and lower(old.handle) = lower(v_h) then
    update public.creator_handles set is_business = coalesce(p_is_business, false), updated_at = now() where id = old.id returning * into r;
    return jsonb_build_object('ok', true, 'kind', r.kind, 'live_at', r.live_at, 'verify_code', r.verify_code, 'changed', false);
  end if;
  -- a CHANGED handle (or any handle on a brand-new account) waits 48 hours, so a hijacked account can't swap money away quietly
  v_live := case when old.id is not null or v_new_acct then now() + interval '48 hours' else now() end;
  insert into public.creator_handles as c (user_id, kind, handle, is_business, live_at)
  values (auth.uid(), p_kind, v_h, coalesce(p_is_business, false), v_live)
  on conflict (user_id, kind) do update set handle = excluded.handle, is_business = excluded.is_business, live_at = excluded.live_at,
    verified = false, verified_at = null, hidden = false,
    verify_code = upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), updated_at = now()
  returning * into r;
  begin perform public.audit_write('creator.handle_set', 'creator_handle', r.id::text,
    jsonb_build_object('kind', p_kind, 'old', old.handle, 'new', v_h, 'live_at', v_live)); exception when others then null; end;
  if old.id is not null then
    begin perform public.notify(auth.uid(), 'security', 'Your ' || p_kind || ' tip handle was changed',
      'It goes live ' || to_char(v_live at time zone 'America/Denver', 'Mon DD at HH12:MI AM') || ' MT. If this was not you, remove it and change your password now.',
      '/?v=creator', null); exception when others then null; end;
  end if;
  return jsonb_build_object('ok', true, 'kind', r.kind, 'live_at', r.live_at, 'verify_code', r.verify_code, 'changed', old.id is not null);
end $$;
grant execute on function public.creator_set_handle(text, text, boolean) to authenticated;

create or replace function public.creator_remove_handle(p_kind text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.creator_handles where user_id = auth.uid() and kind = p_kind;
  get diagnostics n = row_count;
  if n > 0 then begin perform public.audit_write('creator.handle_removed', 'creator_handle', p_kind, '{}'::jsonb); exception when others then null; end; end if;
  return n > 0;
end $$;
grant execute on function public.creator_remove_handle(text) to authenticated;

create or replace function public.creator_hide_handle(p_kind text, p_hidden boolean) returns boolean
language sql security definer set search_path = public as $$
  update public.creator_handles set hidden = coalesce(p_hidden, false), updated_at = now() where user_id = auth.uid() and kind = p_kind returning true;
$$;
grant execute on function public.creator_hide_handle(text, boolean) to authenticated;

create or replace function public.admin_creator_verify(p_id bigint, p_ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.creator_handles set verified = coalesce(p_ok, false), verified_at = case when p_ok then now() end,
    hidden = case when p_ok then hidden else true end, updated_at = now() where id = p_id;
  begin perform public.audit_write(case when p_ok then 'creator.handle_verified' else 'creator.handle_rejected' end, 'creator_handle', p_id::text, '{}'::jsonb); exception when others then null; end;
  return found;
end $$;
grant execute on function public.admin_creator_verify(bigint, boolean) to authenticated;

create or replace function public.admin_creator_handles(p_only_unverified boolean default true) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'user_id', h.user_id, 'username', p.username, 'kind', h.kind, 'handle', h.handle,
      'url', public.creator_handle_url(h.kind, h.handle), 'verify_code', h.verify_code, 'verified', h.verified, 'business', h.is_business,
      'live_at', h.live_at, 'hidden', h.hidden, 'updated_at', h.updated_at) order by h.updated_at desc)
    from public.creator_handles h left join public.profiles p on p.id = h.user_id
    where not p_only_unverified or not h.verified), '[]'::jsonb);
end $$;
grant execute on function public.admin_creator_handles(boolean) to authenticated;

-- ---------- 4. the public payout card ----------
create or replace function public.creator_card(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.creator_profiles;
begin
  if not public.safety_flag('creator_tools') and not public.is_admin() then return null; end if;
  select * into c from public.creator_profiles where user_id = p_user and enabled;
  if not found or not public.safety_is_adult(p_user) then return null; end if;
  if auth.uid() is not null and public.safety_blocked(p_user, auth.uid()) then return null; end if;
  return jsonb_build_object('user_id', p_user, 'headline', c.headline, 'show_platform_tip', c.show_platform_tip,
    'handles', coalesce((select jsonb_agg(jsonb_build_object('kind', h.kind, 'url', public.creator_handle_url(h.kind, h.handle),
        'handle', case when h.kind in ('stripe', 'square') then null else h.handle end, 'verified', h.verified, 'business', h.is_business)
        order by array_position(array['venmo', 'paypal', 'cashapp', 'kofi', 'bmac', 'stripe', 'square'], h.kind))
      from public.creator_handles h where h.user_id = p_user and not h.hidden and h.live_at <= now()), '[]'::jsonb));
end $$;
grant execute on function public.creator_card(uuid) to anon, authenticated;

-- ---------- 5. tip taps (analytics only; we never see the money) ----------
create table if not exists public.creator_tip_taps (
  id bigint generated always as identity primary key,
  creator_id uuid references auth.users(id) on delete cascade,   -- null = a tap on "Tip allofus"
  tapper uuid,
  vh text,
  kind text not null,
  post_id text,
  at timestamptz not null default now());
create index if not exists creator_taps_creator_v28 on public.creator_tip_taps (creator_id, at desc);
alter table public.creator_tip_taps enable row level security;
revoke all on public.creator_tip_taps from anon, authenticated;
drop policy if exists "v28 taps admin read" on public.creator_tip_taps;
create policy "v28 taps admin read" on public.creator_tip_taps for select using (public.is_admin());

create or replace function public.creator_tap(p_creator uuid, p_kind text, p_vh text default null, p_post text default null) returns void
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(auth.uid()::text, left(coalesce(p_vh, ''), 64));
begin
  if who = '' or p_kind !~ '^[a-z]{2,12}$' then return; end if;
  if p_creator is not null and p_creator = auth.uid() then return; end if;   -- your own taps don't count
  if exists (select 1 from public.creator_tip_taps t where t.creator_id is not distinct from p_creator and t.kind = p_kind
               and coalesce(t.tapper::text, t.vh) = who and t.at > now() - interval '10 minutes') then return; end if;
  insert into public.creator_tip_taps (creator_id, tapper, vh, kind, post_id)
  values (p_creator, auth.uid(), case when auth.uid() is null then left(p_vh, 64) end, p_kind, left(p_post, 40));
end $$;
grant execute on function public.creator_tap(uuid, text, text, text) to anon, authenticated;

create or replace function public.creator_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'week', (select count(*) from public.creator_tip_taps where creator_id = auth.uid() and at > now() - interval '7 days'),
    'month', (select count(*) from public.creator_tip_taps where creator_id = auth.uid() and at > now() - interval '30 days'),
    'by_kind', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.creator_tip_taps
                 where creator_id = auth.uid() and at > now() - interval '30 days' group by kind) k), '{}'::jsonb),
    'top_posts', coalesce((select jsonb_agg(jsonb_build_object('post_id', post_id, 'taps', n)) from (select post_id, count(*) n from public.creator_tip_taps
                 where creator_id = auth.uid() and post_id is not null and at > now() - interval '30 days' group by post_id order by n desc limit 5) t), '[]'::jsonb));
$$;
grant execute on function public.creator_stats() to authenticated;

-- ---------- 6. social feeds ----------
create table if not exists public.creator_feeds (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                 -- youtube | podcast | blog
  source_url text not null,
  feed_url text not null,
  title text,
  status text not null default 'active',   -- active | paused (owner) | blocked (admin)
  last_fetched_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  fail_count int not null default 0,
  created_at timestamptz default now(),
  unique (user_id, feed_url));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'creator_feeds_kind_chk') then
    alter table public.creator_feeds add constraint creator_feeds_kind_chk check (kind in ('youtube', 'podcast', 'blog'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'creator_feeds_status_chk') then
    alter table public.creator_feeds add constraint creator_feeds_status_chk check (status in ('active', 'paused', 'blocked'));
  end if;
end $$;
alter table public.creator_feeds enable row level security;
revoke all on public.creator_feeds from anon;
revoke insert, update, delete on public.creator_feeds from authenticated;
drop policy if exists "v28 feeds read own" on public.creator_feeds;
create policy "v28 feeds read own" on public.creator_feeds for select using (auth.uid() = user_id or public.is_admin());

create table if not exists public.creator_feed_items (
  id bigint generated always as identity primary key,
  feed_id bigint references public.creator_feeds(id) on delete cascade,   -- null = a pasted single-post embed
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,       -- youtube | vimeo | tiktok | instagram | spotify | soundcloud | x | podcast | blog
  ext_id text,                  -- the provider's id used to build the official embed URL
  guid text not null,
  title text,
  link text not null,
  thumb text,
  media_url text,               -- podcast audio enclosure
  published_at timestamptz,
  mod_status text not null default 'ok',   -- ok | pending | hidden
  created_at timestamptz default now(),
  unique (user_id, provider, guid));
create index if not exists creator_items_user_v28 on public.creator_feed_items (user_id, coalesce(published_at, created_at) desc);
alter table public.creator_feed_items enable row level security;
revoke all on public.creator_feed_items from anon;
revoke insert, update, delete on public.creator_feed_items from authenticated;
drop policy if exists "v28 items read own" on public.creator_feed_items;
create policy "v28 items read own" on public.creator_feed_items for select using (auth.uid() = user_id or public.is_admin());

-- https only, no IP literals / localhost / internal names (the server fetches these URLs)
create or replace function public.creator_safe_url(u text) returns boolean
language sql immutable as $$
  select u is not null and char_length(u) <= 500
     and u ~* '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:443)?(/[^\s<>"'']*)?$'
     and u !~* '^https://([0-9.]+|\[[0-9a-f:]+\]|localhost|[^/]*\.(local|internal|localhost|lan|home|corp))([:/]|$)';
$$;

create or replace function public.creator_add_feed(p_kind text, p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text := btrim(coalesce(p_url, '')); v_feed text; m text[]; r public.creator_feeds;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.creator_tools_on() then raise exception 'creator tools are not open yet'; end if;
  if not public.safety_is_adult(auth.uid()) then raise exception 'creator tools are for confirmed adults (18+)'; end if;
  if (select count(*) from public.creator_feeds where user_id = auth.uid()) >= 8 then raise exception 'up to 8 feeds per member'; end if;
  if p_kind = 'youtube' then
    m := regexp_match(u, '^https://(www\.|m\.)?youtube\.com/channel/(UC[A-Za-z0-9_-]{22})');
    if m is not null then v_feed := 'https://www.youtube.com/feeds/videos.xml?channel_id=' || m[2]; end if;
    if v_feed is null then m := regexp_match(u, '^https://(www\.)?youtube\.com/feeds/videos\.xml\?(channel_id=UC[A-Za-z0-9_-]{22}|playlist_id=[A-Za-z0-9_-]{10,64})$');
      if m is not null then v_feed := 'https://www.youtube.com/feeds/videos.xml?' || m[2]; end if; end if;
    if v_feed is null then m := regexp_match(u, '^https://(www\.|m\.)?youtube\.com/playlist\?list=([A-Za-z0-9_-]{10,64})');
      if m is not null then v_feed := 'https://www.youtube.com/feeds/videos.xml?playlist_id=' || m[2]; end if; end if;
    if v_feed is null then raise exception 'paste your channel link with the UC… id (YouTube → Settings → Advanced settings → Channel ID), or a playlist link'; end if;
  elsif p_kind in ('podcast', 'blog') then
    if not public.creator_safe_url(u) then raise exception 'paste the https:// address of your RSS or Atom feed'; end if;
    v_feed := u;
  else raise exception 'unknown feed type';
  end if;
  insert into public.creator_feeds (user_id, kind, source_url, feed_url) values (auth.uid(), p_kind, u, v_feed)
  on conflict (user_id, feed_url) do update set status = case when creator_feeds.status = 'blocked' then 'blocked' else 'active' end
  returning * into r;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'feed_url', r.feed_url, 'status', r.status);
end $$;
grant execute on function public.creator_add_feed(text, text) to authenticated;

create or replace function public.creator_remove_feed(p_id bigint) returns boolean
language sql security definer set search_path = public as $$
  delete from public.creator_feeds where id = p_id and user_id = auth.uid() returning true;
$$;
grant execute on function public.creator_remove_feed(bigint) to authenticated;

create or replace function public.creator_pause_feed(p_id bigint, p_paused boolean) returns boolean
language sql security definer set search_path = public as $$
  update public.creator_feeds set status = case when p_paused then 'paused' else 'active' end
   where id = p_id and user_id = auth.uid() and status <> 'blocked' returning true;
$$;
grant execute on function public.creator_pause_feed(bigint, boolean) to authenticated;

-- a pasted single post (platforms with no public RSS). Returns the new item.
create or replace function public.creator_add_embed(p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text := btrim(coalesce(p_url, '')); m text[]; v_prov text; v_id text; r public.creator_feed_items;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not public.creator_tools_on() then raise exception 'creator tools are not open yet'; end if;
  if not public.safety_is_adult(auth.uid()) then raise exception 'creator tools are for confirmed adults (18+)'; end if;
  if (select count(*) from public.creator_feed_items where user_id = auth.uid() and feed_id is null) >= 60 then raise exception 'up to 60 pasted posts; remove an old one first'; end if;
  m := regexp_match(u, '^https://(www\.|m\.)?youtube\.com/(watch\?v=|shorts/|live/)([A-Za-z0-9_-]{11})'); if m is not null then v_prov := 'youtube'; v_id := m[3]; end if;
  if v_prov is null then m := regexp_match(u, '^https://youtu\.be/([A-Za-z0-9_-]{11})'); if m is not null then v_prov := 'youtube'; v_id := m[1]; end if; end if;
  if v_prov is null then m := regexp_match(u, '^https://(www\.)?vimeo\.com/([0-9]{5,12})'); if m is not null then v_prov := 'vimeo'; v_id := m[2]; end if; end if;
  if v_prov is null then m := regexp_match(u, '^https://(www\.)?tiktok\.com/@[A-Za-z0-9_.]{2,30}/video/([0-9]{8,25})'); if m is not null then v_prov := 'tiktok'; v_id := m[2]; end if; end if;
  if v_prov is null then m := regexp_match(u, '^https://(www\.)?instagram\.com/(p|reel)/([A-Za-z0-9_-]{5,40})'); if m is not null then v_prov := 'instagram'; v_id := m[2] || '/' || m[3]; end if; end if;
  if v_prov is null then m := regexp_match(u, '^https://open\.spotify\.com/(episode|track|show|album|playlist)/([A-Za-z0-9]{22})'); if m is not null then v_prov := 'spotify'; v_id := m[1] || '/' || m[2]; end if; end if;
  if v_prov is null then m := regexp_match(u, '^https://(www\.)?soundcloud\.com/([A-Za-z0-9_-]{2,60}/[A-Za-z0-9_-]{2,120})/?$'); if m is not null then v_prov := 'soundcloud'; v_id := m[2]; end if; end if;
  if v_prov is null then m := regexp_match(u, '^https://(www\.)?(x|twitter)\.com/([A-Za-z0-9_]{1,15})/status/([0-9]{8,25})'); if m is not null then v_prov := 'x'; v_id := m[3] || '/' || m[4]; end if; end if;
  if v_prov is null then raise exception 'paste a single post link from YouTube, TikTok, Instagram, Vimeo, Spotify, SoundCloud or X';
  end if;
  insert into public.creator_feed_items (user_id, provider, ext_id, guid, link, published_at, mod_status)
  values (auth.uid(), v_prov, v_id, v_prov || ':' || v_id, left(u, 500), now(), case when public.safety_flag('feed_items_premod') then 'pending' else 'ok' end)
  on conflict (user_id, provider, guid) do update set link = excluded.link
  returning * into r;
  return jsonb_build_object('id', r.id, 'provider', r.provider, 'ext_id', r.ext_id, 'mod_status', r.mod_status);
end $$;
grant execute on function public.creator_add_embed(text) to authenticated;

create or replace function public.creator_remove_item(p_id bigint) returns boolean
language sql security definer set search_path = public as $$
  delete from public.creator_feed_items where id = p_id and user_id = auth.uid() returning true;
$$;
grant execute on function public.creator_remove_item(bigint) to authenticated;

-- public read path for a profile's "From my channels" card
create or replace function public.creator_feed(p_user uuid, p_limit int default 12) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.safety_flag('creator_tools') and not public.is_admin() then return '[]'::jsonb; end if;
  if not public.safety_is_adult(p_user) then return '[]'::jsonb; end if;
  if auth.uid() is not null and public.safety_blocked(p_user, auth.uid()) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', i.id, 'provider', i.provider, 'ext_id', i.ext_id, 'title', i.title, 'link', i.link, 'thumb', i.thumb,
             'media_url', i.media_url, 'published_at', coalesce(i.published_at, i.created_at), 'feed_title', f.title) x
      from public.creator_feed_items i left join public.creator_feeds f on f.id = i.feed_id
     where i.user_id = p_user and i.mod_status = 'ok' and (i.feed_id is null or f.status = 'active')
     order by coalesce(i.published_at, i.created_at) desc limit greatest(1, least(coalesce(p_limit, 12), 40))) s), '[]'::jsonb);
end $$;
grant execute on function public.creator_feed(uuid, int) to anon, authenticated;

-- service role (feed-sync Edge Function): which feeds to fetch, and saving what it found
create or replace function public.feeds_due(p_limit int default 40) returns setof public.creator_feeds
language sql stable security definer set search_path = public as $$
  select f.* from public.creator_feeds f
   where f.status = 'active' and public.safety_is_adult(f.user_id)
     and (f.last_fetched_at is null or f.last_fetched_at < now() - (interval '55 minutes' * power(2, least(f.fail_count, 6))))
   order by f.last_fetched_at nulls first limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;
revoke all on function public.feeds_due(int) from public, anon, authenticated;

create or replace function public.feed_ingest(p_feed bigint, p_title text, p_items jsonb, p_error text default null) returns int
language plpgsql security definer set search_path = public as $$
declare f public.creator_feeds; it jsonb; n int := 0; v_status text;
begin
  select * into f from public.creator_feeds where id = p_feed;
  if not found then return 0; end if;
  if p_error is not null then
    update public.creator_feeds set last_fetched_at = now(), last_error = left(p_error, 300), fail_count = fail_count + 1 where id = p_feed;
    return 0;
  end if;
  v_status := case when public.safety_flag('feed_items_premod') then 'pending' else 'ok' end;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) limit 15 loop
    continue when not public.creator_safe_url(it->>'link');
    insert into public.creator_feed_items (feed_id, user_id, provider, ext_id, guid, title, link, thumb, media_url, published_at, mod_status)
    values (p_feed, f.user_id, case f.kind when 'youtube' then 'youtube' else f.kind end,
            case when f.kind = 'youtube' and (it->>'ext_id') ~ '^[A-Za-z0-9_-]{11}$' then it->>'ext_id' end,
            left(coalesce(nullif(it->>'guid', ''), it->>'link'), 300), left(it->>'title', 200), left(it->>'link', 500),
            case when public.creator_safe_url(it->>'thumb') then left(it->>'thumb', 500) end,
            case when f.kind = 'podcast' and public.creator_safe_url(it->>'media_url') then left(it->>'media_url', 500) end,
            case when (it->>'published_at') ~ '^\d{4}-\d{2}-\d{2}' then (it->>'published_at')::timestamptz end, v_status)
    on conflict (user_id, provider, guid) do update set title = excluded.title, thumb = excluded.thumb
    where creator_feed_items.mod_status <> 'hidden';
    n := n + 1;
  end loop;
  update public.creator_feeds set title = coalesce(left(nullif(p_title, ''), 120), title), last_fetched_at = now(), last_ok_at = now(),
    last_error = null, fail_count = 0 where id = p_feed;
  -- keep the newest 30 per feed
  delete from public.creator_feed_items i where i.feed_id = p_feed and i.id not in
    (select id from public.creator_feed_items where feed_id = p_feed order by coalesce(published_at, created_at) desc limit 30);
  return n;
end $$;
revoke all on function public.feed_ingest(bigint, text, jsonb, text) from public, anon, authenticated;

-- moderation hooks
create or replace function public.admin_feed_item(p_id bigint, p_status text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_status not in ('ok', 'pending', 'hidden') then raise exception 'bad status'; end if;
  update public.creator_feed_items set mod_status = p_status where id = p_id;
  begin perform public.audit_write('mod.feed_item', 'feed_item', p_id::text, jsonb_build_object('status', p_status)); exception when others then null; end;
  return found;
end $$;
grant execute on function public.admin_feed_item(bigint, text) to authenticated;

create or replace function public.admin_feed_status(p_id bigint, p_status text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_status not in ('active', 'paused', 'blocked') then raise exception 'bad status'; end if;
  update public.creator_feeds set status = p_status where id = p_id;
  begin perform public.audit_write('mod.feed', 'creator_feed', p_id::text, jsonb_build_object('status', p_status)); exception when others then null; end;
  return found;
end $$;
grant execute on function public.admin_feed_status(bigint, text) to authenticated;

create or replace function public.admin_pending_feed_items() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'username', p.username, 'provider', i.provider, 'title', i.title, 'link', i.link,
      'created_at', i.created_at) order by i.created_at)
    from public.creator_feed_items i left join public.profiles p on p.id = i.user_id where i.mod_status = 'pending'), '[]'::jsonb);
end $$;
grant execute on function public.admin_pending_feed_items() to authenticated;

-- reports on a feed item or a creator payout card: one report holds the item for review; child-safety holds it at once too
create or replace function public.creator_on_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.target_kind = 'feed_item' and new.target_id ~ '^\d+$' then
    update public.creator_feed_items set mod_status = 'pending' where id = new.target_id::bigint and mod_status = 'ok';
  elsif new.target_kind = 'creator' and new.target_id ~ '^[0-9a-f-]{36}$' and new.category in ('scam', 'child_safety', 'illegal') then
    update public.creator_handles set hidden = true where user_id = new.target_id::uuid and not verified;
  end if;
  return new;
exception when others then
  raise warning 'creator_on_report: %', sqlerrm;
  return new;
end $$;
drop trigger if exists creator_on_report_v28 on public.reports;
create trigger creator_on_report_v28 after insert on public.reports for each row execute function public.creator_on_report();

-- ---------- 7. optional tips to allofus ----------
create table if not exists public.platform_tips (
  id bigint generated always as identity primary key,
  ref text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  amount_cents int not null,
  method text not null,
  status text not null default 'started',   -- started | paid | canceled | refunded
  context text,
  authnet_trans_id text,
  created_at timestamptz default now(),
  paid_at timestamptz);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'platform_tips_amount_chk') then
    alter table public.platform_tips add constraint platform_tips_amount_chk check (amount_cents between 100 and 50000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'platform_tips_method_chk') then
    alter table public.platform_tips add constraint platform_tips_method_chk check (method in ('card', 'venmo', 'paypal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'platform_tips_status_chk') then
    alter table public.platform_tips add constraint platform_tips_status_chk check (status in ('started', 'paid', 'canceled', 'refunded'));
  end if;
end $$;
alter table public.platform_tips enable row level security;
revoke all on public.platform_tips from anon;
revoke insert, update, delete on public.platform_tips from authenticated;
drop policy if exists "v28 tips read own" on public.platform_tips;
create policy "v28 tips read own" on public.platform_tips for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.platform_tip_start(p_cents int, p_method text, p_context text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ref text; i int := 0;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_cents is null or p_cents < 100 or p_cents > 50000 then raise exception 'tips are $1 to $500'; end if;
  if p_method not in ('card', 'venmo', 'paypal') then raise exception 'unknown method'; end if;
  if (select count(*) from public.platform_tips where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then raise exception 'please try again later'; end if;
  loop
    v_ref := 'AOU-T' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
    exit when not exists (select 1 from public.platform_tips where ref = v_ref) and not exists (select 1 from public.ad_orders where ref = v_ref);
    i := i + 1; if i > 5 then raise exception 'try again'; end if;
  end loop;
  insert into public.platform_tips (ref, user_id, amount_cents, method, context) values (v_ref, auth.uid(), p_cents, p_method, left(p_context, 80));
  return jsonb_build_object('ref', v_ref, 'amount_cents', p_cents, 'method', p_method);
end $$;
grant execute on function public.platform_tip_start(int, text, text) to authenticated;

create or replace function public.platform_tip_cancel(p_ref text) returns boolean
language sql security definer set search_path = public as $$
  update public.platform_tips set status = 'canceled' where ref = upper(p_ref) and user_id = auth.uid() and status = 'started' returning true;
$$;
grant execute on function public.platform_tip_cancel(text) to authenticated;

-- authnet-webhook (service role): mark a card tip paid. Returns the tip id, or null when the ref is unknown / not a tip.
create or replace function public.platform_tip_paid_by_ref(p_ref text, p_trans text default null, p_amount_cents int default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare t public.platform_tips;
begin
  select * into t from public.platform_tips where ref = upper(p_ref) for update;
  if not found then return null; end if;
  if t.status = 'paid' then return t.id; end if;
  if p_amount_cents is not null and p_amount_cents <> t.amount_cents then
    update public.platform_tips set authnet_trans_id = p_trans where id = t.id;
    raise warning 'platform tip % amount mismatch (% vs %)', t.ref, p_amount_cents, t.amount_cents;
    return null;
  end if;
  update public.platform_tips set status = 'paid', paid_at = now(), authnet_trans_id = p_trans where id = t.id;
  begin perform public.audit_write('tip.paid', 'platform_tip', t.ref, jsonb_build_object('cents', t.amount_cents, 'trans', p_trans)); exception when others then null; end;
  if t.user_id is not null then
    begin perform public.notify(t.user_id, 'tip', 'Thank you for supporting allofus 💛', 'Your $' || to_char(t.amount_cents / 100.0, 'FM999990.00') || ' tip keeps allofus free and ad-light.', '/?v=support', null); exception when others then null; end;
  end if;
  return t.id;
end $$;
revoke all on function public.platform_tip_paid_by_ref(text, text, int) from public, anon, authenticated;

create or replace function public.platform_tip_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return jsonb_build_object(
    'paid_30d_cents', (select coalesce(sum(amount_cents), 0) from public.platform_tips where status = 'paid' and paid_at > now() - interval '30 days'),
    'paid_30d_count', (select count(*) from public.platform_tips where status = 'paid' and paid_at > now() - interval '30 days'),
    'paid_all_cents', (select coalesce(sum(amount_cents), 0) from public.platform_tips where status = 'paid'),
    'taps_30d', (select count(*) from public.creator_tip_taps where creator_id is null and at > now() - interval '30 days'),
    'creator_taps_30d', (select count(*) from public.creator_tip_taps where creator_id is not null and at > now() - interval '30 days'),
    'creators_on', (select count(*) from public.creator_profiles where enabled));
end $$;
grant execute on function public.platform_tip_stats() to authenticated;

-- ---------- 8. Brand page connected tools ----------
create table if not exists public.page_integrations (
  id bigint generated always as identity primary key,
  page_slug text not null references public.pages(slug) on delete cascade on update cascade,
  kind text not null,                 -- aispeedtoleads | commerceplugs | webhook | link
  label text,
  url text,                           -- public button link (link / commerceplugs / aispeedtoleads)
  webhook_url text,                   -- private: where allofus POSTs signed events
  events text[] not null default '{lead}'::text[],
  secret text not null default md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text),
  show_on_page boolean not null default false,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  last_sent_at timestamptz,
  last_status int);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'page_integrations_kind_chk') then
    alter table public.page_integrations add constraint page_integrations_kind_chk check (kind in ('aispeedtoleads', 'commerceplugs', 'webhook', 'link'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'page_integrations_urls_chk') then
    alter table public.page_integrations add constraint page_integrations_urls_chk check (
      (url is null or public.creator_safe_url(url)) and (webhook_url is null or public.creator_safe_url(webhook_url))
      and (label is null or char_length(label) <= 60)
      and events <@ array['lead', 'follow', 'test']::text[]);
  end if;
end $$;
create index if not exists page_integrations_slug_v28 on public.page_integrations (page_slug);
create or replace function public.page_can_manage(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.pages p where p.slug = p_slug and (p.owner_id = auth.uid() or auth.uid() = any (p.admins)));
$$;
grant execute on function public.page_can_manage(text) to authenticated;
alter table public.page_integrations enable row level security;
revoke all on public.page_integrations from anon;
drop policy if exists "v28 integrations manage read" on public.page_integrations;
create policy "v28 integrations manage read" on public.page_integrations for select using (public.page_can_manage(page_slug));
drop policy if exists "v28 integrations manage insert" on public.page_integrations;
create policy "v28 integrations manage insert" on public.page_integrations for insert to authenticated
  with check (public.page_can_manage(page_slug) and public.creator_tools_on()
              and (select count(*) from public.page_integrations x where x.page_slug = page_integrations.page_slug) < 10);
drop policy if exists "v28 integrations manage update" on public.page_integrations;
create policy "v28 integrations manage update" on public.page_integrations for update using (public.page_can_manage(page_slug)) with check (public.page_can_manage(page_slug));
drop policy if exists "v28 integrations manage delete" on public.page_integrations;
create policy "v28 integrations manage delete" on public.page_integrations for delete using (public.page_can_manage(page_slug));
-- the secret and the counters are never written by the client
create or replace function public.page_integrations_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.secret := old.secret; new.created_by := old.created_by; new.page_slug := old.page_slug;
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then new.last_sent_at := old.last_sent_at; new.last_status := old.last_status; end if;
  elsif current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.secret := md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text);
    new.created_by := auth.uid(); new.last_sent_at := null; new.last_status := null;
  end if;
  return new;
end $$;
drop trigger if exists page_integrations_guard_v28 on public.page_integrations;
create trigger page_integrations_guard_v28 before insert or update on public.page_integrations for each row execute function public.page_integrations_guard();

-- public: buttons a Brand page chose to show (never the webhook or secret)
create or replace function public.page_tools(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.safety_flag('creator_tools') or public.is_admin() then
    coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'label', label, 'url', url) order by id)
      from public.page_integrations where page_slug = p_slug and active and show_on_page and url is not null), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
grant execute on function public.page_tools(text) to anon, authenticated;

-- service role (biz-webhook Edge Function)
create or replace function public.page_hooks_for(p_slug text, p_event text) returns table (id bigint, webhook_url text, secret text)
language sql stable security definer set search_path = public as $$
  select i.id, i.webhook_url, i.secret from public.page_integrations i
   where i.page_slug = p_slug and i.active and i.webhook_url is not null and p_event = any (i.events || array['test']::text[]);
$$;
revoke all on function public.page_hooks_for(text, text) from public, anon, authenticated;

-- ---------- feed-sync schedule (run by hand once the Edge Function is deployed; needs pg_cron + pg_net) ----------
-- select cron.schedule('aou-feed-sync', '7 * * * *', $$ select net.http_post(
--   url := 'https://izfccjaznlcffvjxawya.supabase.co/functions/v1/feed-sync',
--   headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<FEED_SYNC_SECRET>'),
--   body := '{}'::jsonb) $$);
-- To open creator tools to everyone (after QA):  update public.safety_settings set value = 'true' where key = 'creator_tools';

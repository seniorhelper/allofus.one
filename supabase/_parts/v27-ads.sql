-- ============================================================
-- allofus.one · v27 · ADS, ORDERS, MARKETING DASH (2026-10-23)
-- Idempotent. Run after v26-features.sql (needs public.is_admin(), public.aou_kpi_daily, public.pages).
-- What this adds:
--   1. Member ad preferences:    profiles.ad_pref ('off' | 'local' | 'all', default 'local') + profiles.ad_filters text[]
--   2. ads + ad_events tables (the searchBOOST ad maker already writes `ads`; created here if the project never had them)
--   3. ads_for_me(p_group, p_city, p_limit): the ONLY read path for feed ads. Applies the viewer's prefs server-side.
--      Anonymous visitors get untargeted 'all' ads with the sensitive categories removed; the client caps them at 1 per 10 posts.
--   4. ad_orders: the paywall. Members insert their own order (always status 'awaiting_payment'); only admins change status.
--      admin_ad_order(p_id, p_action, p_note): mark_paid (goes live + creates the ad row) / pause / resume / end / refund.
--      ad_order_paid_by_ref(p_ref, p_trans): called by the Authorize.net webhook (service role only).
--   5. page_views: rate-limited bump_view(p_slug, p_vh) (one count per visitor hash per page per day), owner-only reads.
--   6. marketing_stats(p_slug): the Brand owner's dashboard numbers in one call (bypasses RLS, checks ownership).
--   7. ad_admin_stats(): revenue + order KPIs for the admin dashboard; aou_kpi_snapshot() extended with business metrics.
-- RLS summary: members read their own orders and their own pages' views; nothing here is writable by anon;
--              status changes go through admin-only RPCs; ads_for_me is the only anon-readable ad surface.
-- ============================================================

-- ---------- 1. member ad preferences ----------
alter table public.profiles add column if not exists ad_pref text not null default 'local';
alter table public.profiles add column if not exists ad_filters text[] not null default '{}'::text[];
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_ad_pref_chk') then
    alter table public.profiles add constraint profiles_ad_pref_chk check (ad_pref in ('off', 'local', 'all'));
  end if;
end $$;

-- ---------- 2. ads + ad_events ----------
create table if not exists public.ads (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'banner',
  status text not null default 'off',
  rating text not null default 'G',
  size text, template text, palette text,
  brand text, headline text, sub text, offer text, cta text, url text, img text, video text,
  page_slug text,
  created_at timestamptz default now());
-- projects whose `ads` table predates this file (made by the searchBOOST ad maker's v10 script) get any missing base columns
alter table public.ads add column if not exists kind text not null default 'banner';
alter table public.ads add column if not exists status text not null default 'off';
alter table public.ads add column if not exists rating text not null default 'G';
alter table public.ads add column if not exists size text;
alter table public.ads add column if not exists template text;
alter table public.ads add column if not exists palette text;
alter table public.ads add column if not exists brand text;
alter table public.ads add column if not exists headline text;
alter table public.ads add column if not exists sub text;
alter table public.ads add column if not exists offer text;
alter table public.ads add column if not exists cta text;
alter table public.ads add column if not exists url text;
alter table public.ads add column if not exists img text;
alter table public.ads add column if not exists video text;
alter table public.ads add column if not exists page_slug text;
alter table public.ads add column if not exists created_at timestamptz default now();
alter table public.ads add column if not exists category text not null default 'general';
alter table public.ads add column if not exists audience text not null default 'all';   -- all | city | groups | category
alter table public.ads add column if not exists city text;
alter table public.ads add column if not exists groups text[] not null default '{}'::text[];
alter table public.ads add column if not exists order_id bigint;
alter table public.ads add column if not exists starts_at timestamptz;
alter table public.ads add column if not exists ends_at timestamptz;
alter table public.ads add column if not exists verified boolean not null default false;
alter table public.ads add column if not exists updated_at timestamptz default now();
create index if not exists ads_live_idx on public.ads (status, ends_at);
alter table public.ads enable row level security;
-- owners manage their own ads; admins see all. The feed never reads this table directly (it calls ads_for_me).
-- the original ads table came from an older script whose policy names are not known here, so clear every
-- PERMISSIVE policy on public.ads (whatever it is called) and recreate the v27 set below. The RESTRICTIVE
-- "v26 adults only …" policies from v26-safety.sql are kept: they only ever narrow access.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'ads'
             and permissive = 'PERMISSIVE' and policyname not like 'v26 %' and policyname not like 'v27 %' loop
    execute format('drop policy if exists %I on public.ads', p.policyname);
  end loop;
end $$;
drop policy if exists "ads readable" on public.ads;
drop policy if exists "ads read own or admin v27" on public.ads;
create policy "ads read own or admin v27" on public.ads for select using (auth.uid() = owner_id or public.is_admin());
drop policy if exists "ads insert own" on public.ads;
drop policy if exists "ads insert own v27" on public.ads;
create policy "ads insert own v27" on public.ads for insert with check (auth.uid() = owner_id);
drop policy if exists "ads update own" on public.ads;
drop policy if exists "ads update own v27" on public.ads;
create policy "ads update own v27" on public.ads for update using (auth.uid() = owner_id or public.is_admin()) with check (auth.uid() = owner_id or public.is_admin());
drop policy if exists "ads delete own" on public.ads;
drop policy if exists "ads delete own v27" on public.ads;
create policy "ads delete own v27" on public.ads for delete using (auth.uid() = owner_id or public.is_admin());

create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  ad_id bigint references public.ads(id) on delete cascade,
  kind text not null default 'view',
  user_id uuid default auth.uid(),
  at timestamptz default now());
alter table public.ad_events add column if not exists user_id uuid default auth.uid();
alter table public.ad_events add column if not exists at timestamptz default now();
create index if not exists ad_events_ad_idx on public.ad_events (ad_id, at);
alter table public.ad_events enable row level security;
drop policy if exists "ad events insert" on public.ad_events;
drop policy if exists "ad events insert v27" on public.ad_events;
create policy "ad events insert v27" on public.ad_events for insert to authenticated with check (kind in ('view', 'click') and auth.uid() = user_id);
drop policy if exists "ad events read own ads v27" on public.ad_events;
create policy "ad events read own ads v27" on public.ad_events for select using (public.is_admin() or exists (select 1 from public.ads a where a.id = ad_id and a.owner_id = auth.uid()));

-- the categories a member can hide (the client shows the same list)
create or replace function public.ad_sensitive_categories() returns text[] language sql immutable as $$
  select array['alcohol', 'gambling', 'politics', 'cosmetic', 'finance', 'dating', 'weight-loss']::text[];
$$;

-- ---------- 3. ads_for_me: the only read path for feed ads ----------
create or replace function public.ads_for_me(p_group text default null, p_city text default null, p_limit int default 20)
returns setof public.ads language plpgsql stable security definer set search_path = public as $$
declare v_pref text := 'local'; v_filters text[] := '{}'; v_city text := null; v_uid uuid := auth.uid();
begin
  if v_uid is null then
    -- anonymous: untargeted ads only, sensitive categories removed; the client shows at most 1 per 10 posts
    return query select a.* from public.ads a
      where a.status = 'on' and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
        and a.audience = 'all' and not (a.category = any (public.ad_sensitive_categories()))
      order by random() limit greatest(1, least(p_limit, 20));
    return;
  end if;
  select coalesce(p.ad_pref, 'local'), coalesce(p.ad_filters, '{}'), coalesce(p_city, p.home #>> '{flat,city}', p.home ->> 'city')
    into v_pref, v_filters, v_city from public.profiles p where p.id = v_uid;
  if v_pref = 'off' then return; end if;
  return query select a.* from public.ads a
    where a.status = 'on' and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
      and a.owner_id <> v_uid
      and not (a.category = any (v_filters))
      and (
        v_pref = 'all'
        or (a.audience = 'city' and v_city is not null and a.city is not null and lower(a.city) = lower(v_city))
        or (a.audience = 'groups' and p_group is not null and p_group = any (a.groups))
        or (a.audience = 'all' and a.city is not null and v_city is not null and lower(a.city) = lower(v_city))
        or exists (select 1 from public.page_follows f where f.user_id = v_uid and f.page_slug = a.page_slug)
      )
    order by random() limit greatest(1, least(p_limit, 50));
end $$;
grant execute on function public.ads_for_me(text, text, int) to anon, authenticated;

-- ---------- 4. ad_orders: the paywall ----------
create table if not exists public.ad_orders (
  id bigint generated always as identity primary key,
  ref text not null unique default ('AOU-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7))),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_slug text,
  promo_kind text not null default 'page',           -- page | post | event | group
  target_id text,
  audience text not null default 'all',              -- all | city | groups | category
  city text, groups text[] not null default '{}'::text[],
  category text not null default 'general',
  plan text not null,                                -- see the ladder in js/aou-ads.js (PLANS)
  days int not null default 7,
  amount_cents int not null,
  verified boolean not null default false,
  headline text, sub text, cta text, url text, img text,
  status text not null default 'awaiting_payment',   -- awaiting_payment | paid | live | paused | ended | refunded | cancelled
  note text,                                         -- admin refund / notes
  pay_method text,                                   -- card (Authorize.net) | invoice
  authnet_trans_id text,
  paid_at timestamptz, started_at timestamptz, ends_at timestamptz,
  ad_id bigint,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists ad_orders_user_idx on public.ad_orders (user_id, created_at desc);
create index if not exists ad_orders_status_idx on public.ad_orders (status, created_at desc);
alter table public.ad_orders enable row level security;
drop policy if exists "ad orders read own or admin" on public.ad_orders;
create policy "ad orders read own or admin" on public.ad_orders for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "ad orders insert own awaiting" on public.ad_orders;
create policy "ad orders insert own awaiting" on public.ad_orders for insert to authenticated
  with check (auth.uid() = user_id and status = 'awaiting_payment' and amount_cents between 0 and 500000 and days between 1 and 366
              and paid_at is null and authnet_trans_id is null and ad_id is null and note is null);
-- no update/delete policy for members: status changes go through admin_ad_order() / ad_order_paid_by_ref() below.
-- a member may cancel an unpaid order of their own:
create or replace function public.cancel_ad_order(p_id bigint) returns boolean language sql security definer set search_path = public as $$
  update public.ad_orders set status = 'cancelled', updated_at = now()
   where id = p_id and user_id = auth.uid() and status = 'awaiting_payment' returning true;
$$;
grant execute on function public.cancel_ad_order(bigint) to authenticated;

-- turn a paid order into a live ad (shared by the admin RPC and the webhook)
create or replace function public.ad_order_activate(p_id bigint, p_trans text default null, p_method text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare o public.ad_orders; v_ad bigint;
begin
  select * into o from public.ad_orders where id = p_id for update;
  if o.id is null then raise exception 'order not found'; end if;
  if o.status in ('live', 'paid') and o.ad_id is not null then return o.ad_id; end if;
  if o.ad_id is null then
    insert into public.ads (owner_id, kind, status, rating, size, template, palette, brand, headline, sub, cta, url, img, page_slug,
                            category, audience, city, groups, order_id, starts_at, ends_at, verified)
    select o.user_id, 'banner', 'on', 'G', 'feed', 'gradient', 'Royal', coalesce(pg.name, o.headline), o.headline, o.sub, coalesce(o.cta, 'Learn more'),
           coalesce(o.url, case when o.page_slug is not null then 'https://allofus.one/?page=' || o.page_slug end), o.img, o.page_slug,
           o.category, o.audience, o.city, o.groups, o.id, now(), now() + make_interval(days => o.days), o.verified
      from (select 1) x left join public.pages pg on pg.slug = o.page_slug
    returning id into v_ad;
  else
    v_ad := o.ad_id;
    update public.ads set status = 'on', starts_at = coalesce(starts_at, now()), ends_at = now() + make_interval(days => o.days), updated_at = now() where id = v_ad;
  end if;
  if o.verified and o.page_slug is not null then
    update public.pages set extra = coalesce(extra, '{}'::jsonb) || jsonb_build_object('verified', true, 'verified_until', (now() + make_interval(days => greatest(o.days, 30)))::date) where slug = o.page_slug;
  end if;
  update public.ad_orders set status = 'live', ad_id = v_ad, paid_at = coalesce(paid_at, now()), started_at = now(),
         ends_at = now() + make_interval(days => days), authnet_trans_id = coalesce(p_trans, authnet_trans_id),
         pay_method = coalesce(p_method, pay_method), updated_at = now() where id = p_id;
  return v_ad;
end $$;
revoke all on function public.ad_order_activate(bigint, text, text) from public, anon, authenticated;

-- admin actions: mark_paid | pause | resume | end | refund | note
create or replace function public.admin_ad_order(p_id bigint, p_action text, p_note text default null) returns public.ad_orders
language plpgsql security definer set search_path = public as $$
declare o public.ad_orders;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_action = 'mark_paid' then perform public.ad_order_activate(p_id, null, 'invoice');
  elsif p_action = 'pause' then
    update public.ad_orders set status = 'paused', updated_at = now() where id = p_id and status = 'live';
    update public.ads set status = 'off', updated_at = now() where order_id = p_id;
  elsif p_action = 'resume' then
    update public.ad_orders set status = 'live', updated_at = now() where id = p_id and status = 'paused';
    update public.ads set status = 'on', updated_at = now() where order_id = p_id;
  elsif p_action = 'end' then
    update public.ad_orders set status = 'ended', ends_at = now(), updated_at = now() where id = p_id and status in ('live', 'paused');
    update public.ads set status = 'off', ends_at = now(), updated_at = now() where order_id = p_id;
  elsif p_action = 'refund' then
    update public.ad_orders set status = 'refunded', note = coalesce(p_note, note), updated_at = now() where id = p_id;
    update public.ads set status = 'off', ends_at = now(), updated_at = now() where order_id = p_id;
  elsif p_action = 'note' then
    update public.ad_orders set note = p_note, updated_at = now() where id = p_id;
  else raise exception 'unknown action %', p_action; end if;
  if p_note is not null and p_action <> 'note' then update public.ad_orders set note = p_note where id = p_id; end if;
  select * into o from public.ad_orders where id = p_id; return o;
end $$;
revoke all on function public.admin_ad_order(bigint, text, text) from public, anon;
grant execute on function public.admin_ad_order(bigint, text, text) to authenticated;  -- refuses non-admins itself

-- Authorize.net webhook (supabase/functions/authnet-webhook) calls this with the service role after verifying the signature
create or replace function public.ad_order_paid_by_ref(p_ref text, p_trans text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  select id into v_id from public.ad_orders where ref = upper(trim(p_ref)) and status in ('awaiting_payment', 'paid');
  if v_id is null then return null; end if;
  perform public.ad_order_activate(v_id, p_trans, 'card');
  return v_id;
end $$;
revoke all on function public.ad_order_paid_by_ref(text, text) from public, anon, authenticated;

-- ads whose time is up switch off (cheap; call from pg_cron with the KPI snapshot, or it runs inside ads_for_me reads rarely)
create or replace function public.ads_expire() returns int language sql security definer set search_path = public as $$
  with x as (update public.ads set status = 'off', updated_at = now() where status = 'on' and ends_at is not null and ends_at <= now() returning order_id),
       y as (update public.ad_orders set status = 'ended', updated_at = now() where status = 'live' and ends_at is not null and ends_at <= now() returning id)
  select (select count(*) from x)::int + (select count(*) from y)::int;
$$;
revoke all on function public.ads_expire() from public, anon, authenticated;

-- ---------- 5. page views: rate-limited, owner-only reads ----------
create table if not exists public.page_views (
  page_slug text not null, day date not null default current_date, n int not null default 0,
  primary key (page_slug, day));
create table if not exists public.page_view_hits (
  page_slug text not null, day date not null default current_date, vh text not null,
  primary key (page_slug, day, vh));
alter table public.page_views enable row level security;
alter table public.page_view_hits enable row level security;
drop policy if exists "views readable" on public.page_views;
drop policy if exists "views read owner or admin v27" on public.page_views;
create policy "views read owner or admin v27" on public.page_views for select using (
  public.is_admin() or exists (select 1 from public.pages p where p.slug = page_slug and (p.owner_id = auth.uid() or auth.uid() = any (p.admins))));
-- page_view_hits: no policies at all = nobody reads or writes it except the security-definer function below.
create or replace function public.bump_view(p_slug text, p_vh text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_slug is null or length(p_slug) = 0 then return; end if;
  if p_vh is not null and length(p_vh) between 6 and 64 then
    insert into public.page_view_hits (page_slug, day, vh) values (left(p_slug, 80), current_date, p_vh) on conflict do nothing;
    if not found then return; end if;  -- same visitor, same page, same day: counted already
  end if;
  insert into public.page_views (page_slug, day, n) values (left(p_slug, 80), current_date, 1)
  on conflict (page_slug, day) do update set n = public.page_views.n + 1;
  if random() < 0.01 then delete from public.page_view_hits where day < current_date - 1; end if;
end $$;
grant execute on function public.bump_view(text, text) to anon, authenticated;
-- the old one-argument version keeps working for cached clients (no dedupe)
create or replace function public.bump_view(p_slug text) returns void language sql security definer set search_path = public as $$
  select public.bump_view(p_slug, null);
$$;
grant execute on function public.bump_view(text) to anon, authenticated;

-- ---------- 6. marketing_stats: the Brand owner's dashboard in one call ----------
create or replace function public.marketing_stats(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pg public.pages; r jsonb;
begin
  select * into pg from public.pages where slug = p_slug;
  if pg.id is null then raise exception 'page not found'; end if;
  if not (pg.owner_id = auth.uid() or auth.uid() = any (pg.admins) or public.is_admin()) then raise exception 'not your page'; end if;
  select jsonb_build_object(
    'slug', pg.slug, 'name', pg.name,
    'views', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'n', n) order by day) from public.page_views where page_slug = pg.slug and day >= current_date - 29), '[]'::jsonb),
    'views_30', coalesce((select sum(n) from public.page_views where page_slug = pg.slug and day >= current_date - 29), 0),
    'views_prev_30', coalesce((select sum(n) from public.page_views where page_slug = pg.slug and day between current_date - 59 and current_date - 30), 0),
    'followers', (select count(*) from public.page_follows where page_slug = pg.slug),
    'followers_30', (select count(*) from public.page_follows where page_slug = pg.slug and created_at > now() - interval '30 days'),
    'posts', (select count(*) from public.feed_posts where page_slug = pg.slug),
    'posts_30', (select count(*) from public.feed_posts where page_slug = pg.slug and created_at > now() - interval '30 days'),
    'reactions', (select count(*) from public.feed_reactions x join public.feed_posts p on p.id = x.post_id where p.page_slug = pg.slug),
    'comments', (select count(*) from public.feed_comments x join public.feed_posts p on p.id = x.post_id where p.page_slug = pg.slug),
    'top_posts', coalesce((select jsonb_agg(t) from (
        select p.id, left(coalesce(p.text, ''), 90) as text, p.created_at,
               (select count(*) from public.feed_reactions x where x.post_id = p.id) as reactions,
               (select count(*) from public.feed_comments x where x.post_id = p.id) as comments
          from public.feed_posts p where p.page_slug = pg.slug order by (select count(*) from public.feed_reactions x where x.post_id = p.id) + (select count(*) from public.feed_comments x where x.post_id = p.id) desc, p.created_at desc limit 5) t), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(t order by t.created_at desc) from (
        select o.id, o.ref, o.status, o.plan, o.days, o.amount_cents, o.headline, o.audience, o.city, o.category, o.verified, o.created_at, o.started_at, o.ends_at, o.ad_id,
               (select count(*) from public.ad_events e where e.ad_id = o.ad_id and e.kind = 'view') as views,
               (select count(*) from public.ad_events e where e.ad_id = o.ad_id and e.kind = 'click') as clicks
          from public.ad_orders o where o.page_slug = pg.slug and o.status <> 'cancelled') t), '[]'::jsonb),
    'spend_cents', coalesce((select sum(amount_cents) from public.ad_orders where page_slug = pg.slug and status in ('paid', 'live', 'paused', 'ended')), 0),
    'clicks', coalesce((select count(*) from public.ad_events e join public.ads a on a.id = e.ad_id where a.page_slug = pg.slug and e.kind = 'click'), 0),
    'verified', coalesce((pg.extra ->> 'verified')::boolean, false)
  ) into r;
  return r;
end $$;
grant execute on function public.marketing_stats(text) to authenticated;

-- ---------- 7. admin business metrics + KPI snapshot ----------
create or replace function public.ad_admin_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select jsonb_build_object(
    'revenue_cents', coalesce((select sum(amount_cents) from public.ad_orders where status in ('paid', 'live', 'paused', 'ended')), 0),
    'revenue_30_cents', coalesce((select sum(amount_cents) from public.ad_orders where status in ('paid', 'live', 'paused', 'ended') and paid_at > now() - interval '30 days'), 0),
    'refunded_cents', coalesce((select sum(amount_cents) from public.ad_orders where status = 'refunded'), 0),
    'orders', (select count(*) from public.ad_orders where status <> 'cancelled'),
    'awaiting', (select count(*) from public.ad_orders where status = 'awaiting_payment'),
    'live', (select count(*) from public.ads where status = 'on' and (ends_at is null or ends_at > now())),
    'advertisers', (select count(distinct user_id) from public.ad_orders where status in ('paid', 'live', 'paused', 'ended')),
    'pages_with_views_30', (select count(distinct page_slug) from public.page_views where day >= current_date - 29),
    'views_30', coalesce((select sum(n) from public.page_views where day >= current_date - 29), 0),
    'clicks_30', (select count(*) from public.ad_events where kind = 'click' and at > now() - interval '30 days'),
    'revenue_by_day', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d) from (
        select paid_at::date as d, sum(amount_cents) as n from public.ad_orders where status in ('paid', 'live', 'paused', 'ended') and paid_at > now() - interval '30 days' group by 1) t), '[]'::jsonb),
    'ads_off_pref', (select count(*) from public.profiles where ad_pref = 'off'),
    'ads_all_pref', (select count(*) from public.profiles where ad_pref = 'all')
  ) into r;
  return r;
end $$;
revoke all on function public.ad_admin_stats() from public, anon;
grant execute on function public.ad_admin_stats() to authenticated;

alter table public.aou_kpi_daily add column if not exists ad_revenue_cents int;
alter table public.aou_kpi_daily add column if not exists ad_orders int;
alter table public.aou_kpi_daily add column if not exists ads_live int;
alter table public.aou_kpi_daily add column if not exists pages_with_views int;
create or replace function public.aou_kpi_snapshot() returns public.aou_kpi_daily
language plpgsql security definer set search_path = public as $$
declare r public.aou_kpi_daily; d date := (now() at time zone 'America/Denver')::date;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  perform public.ads_expire();
  r.day := d;
  select count(*) into r.members from auth.users;
  select count(*) into r.new_members from auth.users where created_at > now() - interval '1 day';
  select count(*) into r.dau from public.presence where last_seen > now() - interval '1 day';
  select count(*) into r.wau from public.presence where last_seen > now() - interval '7 days';
  select count(*) into r.mau from public.presence where last_seen > now() - interval '30 days';
  select count(*) into r.posts from public.feed_posts where created_at > now() - interval '1 day';
  select count(*) into r.comments from public.feed_comments where created_at > now() - interval '1 day';
  begin select count(*) into r.reactions from public.feed_reactions where created_at > now() - interval '1 day'; exception when others then r.reactions := null; end;
  begin select count(*) into r.connections_made from public.connections where status = 'accepted' and created_at > now() - interval '1 day'; exception when others then r.connections_made := null; end;
  select count(*) into r.brand_pages from public.pages;
  begin select count(*) into r.guide_questions from public.aou_guide_hits where at > now() - interval '1 day'; exception when others then r.guide_questions := null; end;
  -- v27 business metrics
  select coalesce(sum(amount_cents), 0) into r.ad_revenue_cents from public.ad_orders where status in ('paid', 'live', 'paused', 'ended') and paid_at::date = d;
  select count(*) into r.ad_orders from public.ad_orders where status <> 'cancelled' and created_at::date = d;
  select count(*) into r.ads_live from public.ads where status = 'on' and (ends_at is null or ends_at > now());
  select count(distinct page_slug) into r.pages_with_views from public.page_views where day = d;
  r.taken_at := now();
  insert into public.aou_kpi_daily (day, members, new_members, dau, wau, mau, posts, comments, reactions, connections_made, brand_pages, guide_questions, taken_at, ad_revenue_cents, ad_orders, ads_live, pages_with_views)
  values (r.day, r.members, r.new_members, r.dau, r.wau, r.mau, r.posts, r.comments, r.reactions, r.connections_made, r.brand_pages, r.guide_questions, r.taken_at, r.ad_revenue_cents, r.ad_orders, r.ads_live, r.pages_with_views)
  on conflict (day) do update set
    members = excluded.members, new_members = excluded.new_members, dau = excluded.dau, wau = excluded.wau, mau = excluded.mau,
    posts = excluded.posts, comments = excluded.comments, reactions = excluded.reactions, connections_made = excluded.connections_made,
    brand_pages = excluded.brand_pages, guide_questions = excluded.guide_questions, taken_at = excluded.taken_at,
    ad_revenue_cents = excluded.ad_revenue_cents, ad_orders = excluded.ad_orders, ads_live = excluded.ads_live, pages_with_views = excluded.pages_with_views;
  return r;
end $$;
revoke all on function public.aou_kpi_snapshot() from public, anon;
grant execute on function public.aou_kpi_snapshot() to authenticated;

-- realtime for the admin orders table (harmless if already added)
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.ad_orders'; exception when others then null; end;
end $$;

-- verify
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('ads', 'ad_events', 'ad_orders', 'page_views', 'page_view_hits');

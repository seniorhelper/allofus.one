-- allofus.one · v27 GROWTH (Oct 23 2026): member email opt-in + unsubscribe, LIFEspark daily tracker,
-- sovereign-identity public key, digest data for the weekly email, admin email stats.
-- Additive, idempotent, safe to re-run. Run in Supabase -> SQL Editor AFTER v26-safety.sql and v26-features.sql
-- (it only needs public.is_admin(), which v13/v22 created). The site works before and after: every client
-- module feature-detects these columns and tables and falls back to the device when they are missing.
--
-- What it adds
--   1. profiles.email_optin / email_optin_at   "Email me the occasional allofus update" (sign-up checkbox, off by default)
--      public.email_tokens                     one-click unsubscribe tokens (service-role only; never readable by members)
--      profiles.pubkey / pubkey_at             the member's did:key (Ed25519 public key) for signed exports
--   2. public.unsubscribe(token)               RPC for the one-click link in every email (anon may call it, token only)
--   3. public.spark_days                        LIFEspark "tiny wins" + spark saved, one row per member per day (RLS: own rows)
--   4. public.aou_email_stats()                admin-only counts for the "Members & email" admin section
--   5. public.aou_digest_data() / aou_digest_recipients()   service-role helpers for the weekly-digest Edge Function
--   6. optional pg_cron line for the weekly digest (commented; needs pg_net + the function deployed)

-- ---------- 1. profile columns ----------
alter table public.profiles add column if not exists email_optin boolean not null default false;
alter table public.profiles add column if not exists email_optin_at timestamptz;
alter table public.profiles add column if not exists pubkey text check (pubkey is null or (pubkey like 'did:key:z%' and char_length(pubkey) between 40 and 120));
alter table public.profiles add column if not exists pubkey_at timestamptz;

-- keep email_optin_at honest: stamp it when the flag turns on, clear it when it turns off
create or replace function public.growth_optin_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_optin and (tg_op = 'INSERT' or not coalesce(old.email_optin, false)) then new.email_optin_at := now(); end if;
  if not new.email_optin then new.email_optin_at := null; end if;
  if new.pubkey is distinct from old.pubkey then new.pubkey_at := case when new.pubkey is null then null else now() end; end if;
  return new;
end $$;
drop trigger if exists growth_optin_stamp_v27 on public.profiles;
create trigger growth_optin_stamp_v27 before insert or update of email_optin, pubkey on public.profiles
  for each row execute function public.growth_optin_stamp();

-- unsubscribe tokens live in their own table with RLS on and NO policies: only the service role (Edge Functions) and the
-- security-definer functions below can see them. (profiles is public-readable, so a token column there would leak.)
create table if not exists public.email_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.email_tokens enable row level security;
create or replace function public.aou_unsub_token(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  insert into public.email_tokens (user_id) values (p_user) on conflict (user_id) do nothing;
  select token into t from public.email_tokens where user_id = p_user;
  return t;
end $$;
revoke all on function public.aou_unsub_token(uuid) from public, anon, authenticated;

-- ---------- 2. one-click unsubscribe ----------
create or replace function public.unsubscribe(token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles p set email_optin = false
    from public.email_tokens t where t.token = unsubscribe.token and t.user_id = p.id and p.email_optin;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.unsubscribe(uuid) from public;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;

-- ---------- 3. spark_days ----------
create table if not exists public.spark_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  wins jsonb not null default '[]'::jsonb,        -- up to 3 of { "t": "text", "done": true }
  spark_id int,                                   -- which daily prompt was shown
  spark_saved boolean not null default false,
  breaths int not null default 0,                 -- completed 2-minute sessions that day
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  check (jsonb_typeof(wins) = 'array' and jsonb_array_length(wins) <= 3)
);
alter table public.spark_days enable row level security;
drop policy if exists "spark own rows" on public.spark_days;
create policy "spark own rows" on public.spark_days for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists spark_days_user_idx on public.spark_days (user_id, day desc);

-- ---------- 4. admin email stats ----------
create or replace function public.aou_email_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select jsonb_build_object(
    'members', (select count(*) from auth.users),
    'opted_in', (select count(*) from public.profiles where email_optin),
    'opted_in_7d', (select count(*) from public.profiles where email_optin and email_optin_at > now() - interval '7 days'),
    'new_members_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'with_pubkey', (select count(*) from public.profiles where pubkey is not null)
  ) into r;
  return r;
end $$;
revoke all on function public.aou_email_stats() from public, anon;
grant execute on function public.aou_email_stats() to authenticated;  -- the function itself refuses non-admins

-- ---------- 5. weekly digest helpers (service role only; the Edge Function calls these) ----------
create or replace function public.aou_digest_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  select jsonb_build_object(
    'week_start', (now() - interval '7 days')::date,
    'new_members', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_names', (select coalesce(jsonb_agg(display_name order by created_at desc), '[]'::jsonb) from (
        select p.display_name, p.created_at from public.profiles p where p.created_at > now() - interval '7 days' order by p.created_at desc limit 6) x),
    'posts', (select count(*) from public.feed_posts where created_at > now() - interval '7 days' and public and circle_id is null),
    'top_posts', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'text', left(t.text, 160), 'who', t.who, 'score', t.score) order by t.score desc), '[]'::jsonb) from (
        select p.id, p.text, coalesce(pr.display_name, 'A member') as who,
               (select count(*) from public.feed_reactions rx where rx.post_id = p.id) + 2 * (select count(*) from public.feed_comments c where c.post_id = p.id) as score
        from public.feed_posts p left join public.profiles pr on pr.id = p.user_id
        where p.created_at > now() - interval '7 days' and p.public and p.circle_id is null and p.group_slug is null and coalesce(p.text, '') <> ''
        order by score desc, p.created_at desc limit 3) t),
    'brand_pages', (select count(*) from public.pages)
  ) into r;
  return r;
end $$;
revoke all on function public.aou_digest_data() from public, anon;
grant execute on function public.aou_digest_data() to authenticated;  -- admins only inside (for the "send test digest" button)

create or replace function public.aou_digest_recipients() returns table (id uuid, email text, display_name text, unsub_token uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query select p.id, u.email::text, p.display_name, public.aou_unsub_token(p.id)
  from public.profiles p join auth.users u on u.id = p.id
  where p.email_optin and u.email is not null and u.email_confirmed_at is not null;
end $$;
revoke all on function public.aou_digest_recipients() from public, anon, authenticated;  -- service role only

-- a member's email + token for the welcome mail (service role only; the webhook payload has no email)
create or replace function public.aou_member_mail(p_user uuid) returns table (email text, display_name text, unsub_token uuid, email_optin boolean)
language plpgsql security definer set search_path = public as $$
begin
  return query select u.email::text, p.display_name, public.aou_unsub_token(p.id), p.email_optin
  from public.profiles p join auth.users u on u.id = p.id where p.id = p_user;
end $$;
revoke all on function public.aou_member_mail(uuid) from public, anon, authenticated;

-- ---------- 6. schedules (optional) ----------
-- Weekly digest, Sundays 15:00 UTC (8 am Denver in winter). Needs: Database -> Extensions -> pg_cron AND pg_net enabled,
-- the weekly-digest function deployed, and the CRON_SECRET secret set on the function. Replace <CRON_SECRET>, then run once:
--   select cron.schedule('aou-weekly-digest', '0 15 * * 0', $$
--     select net.http_post(
--       url := 'https://izfccjaznlcffvjxawya.supabase.co/functions/v1/weekly-digest',
--       headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--       body := '{"source":"pg_cron"}'::jsonb);
--   $$);
-- To stop it:  select cron.unschedule('aou-weekly-digest');

-- verify
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('email_optin','email_optin_at','pubkey','pubkey_at') order by 1;
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('spark_days','email_tokens');

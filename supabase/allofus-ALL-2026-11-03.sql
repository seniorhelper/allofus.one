-- ============================================================================================================
-- allofus.one · allofus-ALL-2026-11-03.sql · ONE cumulative file. Run it ONCE in Supabase → SQL Editor (paste all, Run).
-- Safe to re-run: every part is additive / idempotent ("create … if not exists", "create or replace", guarded inserts).
--
-- What it contains, in run order:
--   v26 safety + features · v27 security (self-serve account delete, audit log) · v27 ads · v27 growth
--   v28 lockdown · v29 match · v29b function keys · v30 rooms + constellations      (all previously shipped in the repo
--   under supabase/_parts/ and, as far as the repo shows, never confirmed run on the live project)
--   v31 (new, Nov 3 2026): Brand page delete that sticks (delete_page + page_retired, Bighorn retired), account delete
--   that can no longer get stuck on the sign-in row, admin_reset_dob for a typed-wrong birth date, 8 official posts.
--
-- Assumes the older files the SETUP.md run list names were run in October (schema → v11 … v19, ALL-v20-v21,
-- v22-lockdown). If a part errors on a missing table from those, run supabase/allofus-ALL-v20-v21.sql and
-- supabase/allofus-v22-lockdown.sql first, then this file again.
-- If the editor stops on an error: copy the error text and send it to Claude; nothing after the error ran.
-- ============================================================================================================



-- ################################ v26-safety.sql ################################
-- ============================================================
-- allofus.one · v26 SAFETY + SECURITY (Oct 23 2026)
-- Run in Supabase → SQL Editor AFTER allofus-ALL-v20-v21.sql and allofus-v22-lockdown.sql.
-- Additive, idempotent, safe to re-run. Drops no tables and deletes no rows.
--
-- What it does
--   1. 18+ only: private member_safety table (date of birth, restricted / held / banned flags), never public.
--      profiles.adult is now computed by the database (members cannot set it).
--      Posting, commenting, reacting, DMs, Comm Hub requests, connections, call/meeting requests, hugs,
--      groups, events, courses, Brand pages, ads and media uploads need a CONFIRMED adult (DOB on file,
--      18+, not restricted, not held, not banned). The person on the other end must be an adult too.
--   2. Hearts (dating) and Crush are retired: tables kept for records, all access denied, crush hugs refused.
--   3. Moderation: reports carry a target + category; 3 different reporters (or 1 child-safety report)
--      auto-hide a post/comment/DM and hold the account pending review. media_items logs every upload
--      with a moderation status. Private 'quarantine' bucket for evidence; mod_evidence snapshots for
--      NCMEC / law enforcement that admin_delete_user refuses to erase.
--   4. Rate limits (triggers) on DMs, new-conversation requests, connection requests, posts, comments,
--      reports, meeting requests and uploads.
--   5. Lockdown fixes: notify() was callable by anyone (spoofed notifications) → revoked; my_email()
--      and page claiming require a CONFIRMED e-mail; presence no longer leaks the page/query you are on
--      to everyone; bug reports private to the reporter + admin; storage buckets get MIME allowlists
--      (no SVG/HTML), uploads only into your own folder, nobody can list other members' files;
--      javascript:/data: links are stripped from posts, Comm Hub media and Brand page websites;
--      post / comment / DM media must come from our own storage (or Giphy / Tenor).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0 · helpers that later policies use
-- ─────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_banned') then
    execute 'create function public.is_banned(uid uuid) returns boolean language sql stable as $f$ select false $f$';
  end if;
end $$;

alter table public.profiles add column if not exists adult boolean default false;
alter table public.profiles alter column adult set default false;
alter table public.profiles add column if not exists blocked uuid[] default '{}'::uuid[];

create table if not exists public.member_safety (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dob date,
  dob_source text,                       -- 'signup' | 'prompt' | 'admin'
  dob_set_at timestamptz,
  restricted boolean not null default false,   -- under 18: read-only account
  restricted_reason text,
  held boolean not null default false,         -- reported / flagged: on hold until an admin reviews
  held_reason text,
  banned boolean not null default false,
  banned_reason text,
  flagged boolean not null default false,      -- shows in the admin moderation queue
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now());
alter table public.member_safety add column if not exists dob date;
alter table public.member_safety add column if not exists dob_source text;
alter table public.member_safety add column if not exists dob_set_at timestamptz;
alter table public.member_safety add column if not exists restricted boolean not null default false;
alter table public.member_safety add column if not exists restricted_reason text;
alter table public.member_safety add column if not exists held boolean not null default false;
alter table public.member_safety add column if not exists held_reason text;
alter table public.member_safety add column if not exists banned boolean not null default false;
alter table public.member_safety add column if not exists banned_reason text;
alter table public.member_safety add column if not exists flagged boolean not null default false;
alter table public.member_safety add column if not exists notes text;
alter table public.member_safety add column if not exists updated_at timestamptz default now();
alter table public.member_safety enable row level security;
revoke all on public.member_safety from anon;
drop policy if exists "v26 safety own or admin read" on public.member_safety;
create policy "v26 safety own or admin read" on public.member_safety for select using (auth.uid() = user_id or public.is_admin());
-- no insert / update / delete policies: only the security-definer functions below write here

create or replace function public.safety_is_adult(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null
     and coalesce((select s.dob is not null
                      and s.dob <= (current_date - interval '18 years')::date
                      and not s.restricted and not s.held and not s.banned
                    from public.member_safety s where s.user_id = uid), false)
     and not coalesce(public.is_banned(uid), false);
$$;
grant execute on function public.safety_is_adult(uuid) to anon, authenticated;

create or replace function public.safety_is_minor(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.restricted or (s.dob is not null and s.dob > (current_date - interval '18 years')::date)
                     from public.member_safety s where s.user_id = uid), false);
$$;
revoke all on function public.safety_is_minor(uuid) from public, anon, authenticated;

create or replace function public.safety_me_restricted() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.restricted from public.member_safety s where s.user_id = auth.uid()), false);
$$;
grant execute on function public.safety_me_restricted() to anon, authenticated;

create or replace function public.safety_blocked(owner_id uuid, actor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.blocked::text[] @> array[actor::text] from public.profiles p where p.id = owner_id), false);
$$;
grant execute on function public.safety_blocked(uuid, uuid) to anon, authenticated;

create or replace function public.safety_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.connections c where c.status = 'accepted' and c.kind = 'connect'
                   and ((c.requester = a and c.addressee = b) or (c.requester = b and c.addressee = a)));
$$;
grant execute on function public.safety_connected(uuid, uuid) to authenticated;

create or replace function public.safety_account_age_ok(uid uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select u.created_at < now() - interval '72 hours' from auth.users u where u.id = uid), false);
$$;
grant execute on function public.safety_account_age_ok(uuid) to authenticated;

-- uploads: admin, or a confirmed adult whose account is 72 h+ old, max 40 files an hour
create or replace function public.safety_can_upload(uid uuid) returns boolean
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if uid is null then return false; end if;
  if public.is_admin() then return true; end if;
  if not public.safety_is_adult(uid) then return false; end if;
  if not public.safety_account_age_ok(uid) then return false; end if;
  if (select count(*) from storage.objects o
       where o.bucket_id in ('posts', 'conference', 'quarantine')
         and o.name like uid::text || '/%'
         and o.created_at > now() - interval '1 hour') >= 40 then return false; end if;
  return true;
end $$;
grant execute on function public.safety_can_upload(uuid) to authenticated;

-- copy the date of birth given at sign-up (auth user_metadata.dob) into member_safety, once
create or replace function public.safety_capture_dob(uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_raw text; v_dob date;
begin
  if uid is null then return; end if;
  if exists (select 1 from public.member_safety s where s.user_id = uid and s.dob is not null) then return; end if;
  select u.raw_user_meta_data->>'dob' into v_raw from auth.users u where u.id = uid;
  if v_raw is null or v_raw !~ '^\d{4}-\d{2}-\d{2}$' then return; end if;
  begin v_dob := v_raw::date; exception when others then return; end;
  if v_dob < date '1900-01-01' or v_dob > current_date then return; end if;
  insert into public.member_safety (user_id, dob, dob_source, dob_set_at, restricted, restricted_reason, flagged)
    values (uid, v_dob, 'signup', now(),
            v_dob > (current_date - interval '18 years')::date,
            case when v_dob > (current_date - interval '18 years')::date then 'under 18 at sign-up' end,
            v_dob > (current_date - interval '18 years')::date)
  on conflict (user_id) do update
    set dob = excluded.dob, dob_source = excluded.dob_source, dob_set_at = excluded.dob_set_at,
        restricted = public.member_safety.restricted or excluded.restricted,
        restricted_reason = coalesce(public.member_safety.restricted_reason, excluded.restricted_reason),
        flagged = public.member_safety.flagged or excluded.flagged, updated_at = now()
    where public.member_safety.dob is null;
exception when others then
  raise warning 'safety_capture_dob skipped: %', sqlerrm;
end $$;
revoke all on function public.safety_capture_dob(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 1 · profiles.adult is computed by the database, never by the member
-- ─────────────────────────────────────────────────────────────

create or replace function public.safety_profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.safety_capture_dob(new.id); end if;
  new.adult := public.safety_is_adult(new.id);
  return new;
end $$;
drop trigger if exists safety_profiles_guard_v26 on public.profiles;
create trigger safety_profiles_guard_v26 before insert or update on public.profiles
  for each row execute function public.safety_profiles_guard();

create or replace function public.safety_sync_profile(uid uuid) returns void
language sql security definer set search_path = public as $$
  update public.profiles set adult = public.safety_is_adult(uid) where id = uid;
$$;
revoke all on function public.safety_sync_profile(uuid) from public, anon, authenticated;

-- member: what is my safety status? (the client's DOB gate reads this)
create or replace function public.my_safety() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); s public.member_safety%rowtype; v_created timestamptz;
begin
  if uid is null then return jsonb_build_object('sql', 26, 'signed_in', false); end if;
  perform public.safety_capture_dob(uid);
  select * into s from public.member_safety where user_id = uid;
  select created_at into v_created from auth.users where id = uid;
  return jsonb_build_object(
    'sql', 26, 'signed_in', true,
    'dob_set', s.dob is not null,
    'adult', public.safety_is_adult(uid),
    'minor', coalesce(s.restricted, false) or (s.dob is not null and s.dob > (current_date - interval '18 years')::date),
    'restricted', coalesce(s.restricted, false),
    'held', coalesce(s.held, false),
    'banned', coalesce(s.banned, false) or coalesce(public.is_banned(uid), false),
    'account_created', v_created,
    'new_account', coalesce(v_created > now() - interval '72 hours', true),
    'can_upload', public.safety_can_upload(uid),
    'admin', public.is_admin());
end $$;
grant execute on function public.my_safety() to authenticated;

-- member: give my date of birth (once; only an admin can change it after that)
create or replace function public.set_my_dob(p_dob date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_old date; v_minor boolean;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if p_dob is null or p_dob < date '1900-01-01' or p_dob > current_date then raise exception 'Please enter a real date of birth.'; end if;
  select dob into v_old from public.member_safety where user_id = uid;
  if v_old is not null then return public.my_safety(); end if;   -- locked once set
  v_minor := p_dob > (current_date - interval '18 years')::date;
  insert into public.member_safety (user_id, dob, dob_source, dob_set_at, restricted, restricted_reason, flagged)
    values (uid, p_dob, 'prompt', now(), v_minor, case when v_minor then 'under 18 (date of birth prompt)' end, v_minor)
  on conflict (user_id) do update
    set dob = excluded.dob, dob_source = 'prompt', dob_set_at = now(),
        restricted = public.member_safety.restricted or excluded.restricted,
        restricted_reason = coalesce(public.member_safety.restricted_reason, excluded.restricted_reason),
        flagged = public.member_safety.flagged or excluded.flagged, updated_at = now();
  perform public.safety_sync_profile(uid);
  if v_minor then
    perform public.notify(public.founder_id(), 'mod', 'Under-18 account restricted', 'An account entered a date of birth under 18 and was set to read-only. Review it in Admin → Moderation.', '/?v=admin&what=mod', null);
  end if;
  return public.my_safety();
end $$;
grant execute on function public.set_my_dob(date) to authenticated;

-- backfill: capture any DOB already in user metadata, then recompute profiles.adult for everyone
do $$ declare r record; begin
  for r in select id from auth.users loop perform public.safety_capture_dob(r.id); end loop;
  update public.profiles set adult = public.safety_is_adult(id);
exception when others then raise warning 'v26 backfill: %', sqlerrm; end $$;

-- ─────────────────────────────────────────────────────────────
-- 2 · Hearts (dating) + Crush retired. Tables and rows are KEPT (records), all access denied.
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['hearts_profiles', 'hearts_yes', 'hearts_messages', 'hearts_reports'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
      execute format('drop policy if exists %I on public.%I', 'v26 hearts retired', t);
      execute format('create policy %I on public.%I as restrictive for all to public using (false) with check (false)', 'v26 hearts retired', t);
    end if;
  end loop;
  if to_regclass('public.hearts_matches') is not null then
    execute 'revoke all on public.hearts_matches from anon, authenticated';
  end if;
end $$;
create or replace function public.hearts_rate_ok() returns trigger language plpgsql as $$
begin
  raise exception 'Hearts has been retired.';
end $$;

do $$ begin
  if to_regclass('public.hugs') is not null then
    execute 'drop policy if exists "v26 no crush" on public.hugs';
    execute 'create policy "v26 no crush" on public.hugs as restrictive for insert to public with check (kind <> ''crush'')';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3 · adults only, server-side (RESTRICTIVE policies are ANDed with every existing policy)
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  -- writes that publish something or reach other people
  foreach t in array array['feed_posts', 'feed_comments', 'feed_reactions', 'posts', 'match_posts', 'wishes',
                           'spaces', 'space_members', 'events', 'event_rsvps', 'courses', 'lessons',
                           'pages', 'page_edit_requests', 'ads', 'hub_messages', 'plots'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', 'v26 adults only insert', t);
      execute format('create policy %I on public.%I as restrictive for insert to public with check (public.is_admin() or public.safety_is_adult(auth.uid()))', 'v26 adults only insert', t);
    end if;
  end loop;
  -- edits of published things (deletes stay allowed so anyone can take their own content down)
  foreach t in array array['feed_posts', 'feed_comments', 'match_posts', 'spaces', 'events', 'courses', 'lessons', 'pages', 'ads'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', 'v26 adults only update', t);
      execute format('create policy %I on public.%I as restrictive for update to public using (public.is_admin() or public.safety_is_adult(auth.uid())) with check (public.is_admin() or public.safety_is_adult(auth.uid()))', 'v26 adults only update', t);
    end if;
  end loop;
end $$;

-- person-to-person: BOTH sides must be confirmed adults, and the other person must not have blocked you
drop policy if exists "v26 dm adults both sides" on public.messages;
create policy "v26 dm adults both sides" on public.messages as restrictive for insert to public with check (
  public.is_admin() or (
    public.safety_is_adult(auth.uid())
    and (recipient is null or (public.safety_is_adult(recipient) and not public.safety_blocked(recipient, auth.uid())))));
drop policy if exists "v26 dm update adults" on public.messages;
create policy "v26 dm update adults" on public.messages as restrictive for update to public
  using (public.is_admin() or public.safety_is_adult(auth.uid())) with check (public.is_admin() or public.safety_is_adult(auth.uid()));

drop policy if exists "v26 hub adults both sides" on public.hub_requests;
create policy "v26 hub adults both sides" on public.hub_requests as restrictive for insert to public with check (
  public.is_admin() or (public.safety_is_adult(auth.uid()) and public.safety_is_adult(to_user) and not public.safety_blocked(to_user, auth.uid())));
drop policy if exists "v26 hub update adults" on public.hub_requests;
create policy "v26 hub update adults" on public.hub_requests as restrictive for update to public
  using (public.is_admin() or public.safety_is_adult(auth.uid())) with check (public.is_admin() or public.safety_is_adult(auth.uid()));

drop policy if exists "v26 connect adults both sides" on public.connections;
create policy "v26 connect adults both sides" on public.connections as restrictive for insert to public with check (
  public.is_admin() or (public.safety_is_adult(auth.uid()) and public.safety_is_adult(addressee) and not public.safety_blocked(addressee, auth.uid())));
drop policy if exists "v26 connect update adults" on public.connections;
create policy "v26 connect update adults" on public.connections as restrictive for update to public
  using (public.is_admin() or public.safety_is_adult(auth.uid())) with check (public.is_admin() or public.safety_is_adult(auth.uid()));

drop policy if exists "v26 meetings adults both sides" on public.meeting_requests;
create policy "v26 meetings adults both sides" on public.meeting_requests as restrictive for insert to public with check (
  public.is_admin() or (public.safety_is_adult(auth.uid()) and public.safety_is_adult(to_user) and not public.safety_blocked(to_user, auth.uid())));
drop policy if exists "v26 meetings update adults" on public.meeting_requests;
create policy "v26 meetings update adults" on public.meeting_requests as restrictive for update to public
  using (public.is_admin() or public.safety_is_adult(auth.uid())) with check (public.is_admin() or public.safety_is_adult(auth.uid()));

do $$ begin
  if to_regclass('public.hugs') is not null then
    execute 'drop policy if exists "v26 hugs adults both sides" on public.hugs';
    execute 'create policy "v26 hugs adults both sides" on public.hugs as restrictive for insert to public with check (public.is_admin() or (public.safety_is_adult(auth.uid()) and public.safety_is_adult(to_id) and not public.safety_blocked(to_id, auth.uid())))';
  end if;
end $$;

-- Circles (v26-features.sql): only adults create circles, and only adults can be added to one.
-- Run v26-features.sql first; if you ran this file first, simply run it again afterwards.
do $$ begin
  if to_regclass('public.circles') is not null then
    execute 'drop policy if exists "v26 adults only insert" on public.circles';
    execute 'create policy "v26 adults only insert" on public.circles as restrictive for insert to public with check (public.is_admin() or public.safety_is_adult(auth.uid()))';
  end if;
  if to_regclass('public.circle_members') is not null then
    execute 'drop policy if exists "v26 circle members adults" on public.circle_members';
    execute 'create policy "v26 circle members adults" on public.circle_members as restrictive for insert to public with check (public.is_admin() or (public.safety_is_adult(auth.uid()) and public.safety_is_adult(member_id) and not public.safety_blocked(member_id, auth.uid())))';
  end if;
end $$;

-- a restricted (under-18) account cannot read private person-to-person rows either
drop policy if exists "v26 minors no private reads" on public.messages;
create policy "v26 minors no private reads" on public.messages as restrictive for select to public
  using (room is not null or public.is_admin() or not public.safety_me_restricted());
drop policy if exists "v26 minors no private reads" on public.hub_requests;
create policy "v26 minors no private reads" on public.hub_requests as restrictive for select to public
  using (public.is_admin() or not public.safety_me_restricted());
drop policy if exists "v26 minors no private reads" on public.meeting_requests;
create policy "v26 minors no private reads" on public.meeting_requests as restrictive for select to public
  using (public.is_admin() or not public.safety_me_restricted());
do $$ begin
  if to_regclass('public.hugs') is not null then
    execute 'drop policy if exists "v26 minors no private reads" on public.hugs';
    execute 'create policy "v26 minors no private reads" on public.hugs as restrictive for select to public using (public.is_admin() or not public.safety_me_restricted())';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4 · moderation status on content (members cannot change it) + safe links / media
-- ─────────────────────────────────────────────────────────────
alter table public.feed_posts add column if not exists mod_status text not null default 'ok';
alter table public.feed_comments add column if not exists mod_status text not null default 'ok';
alter table public.messages add column if not exists mod_status text not null default 'ok';
alter table public.hub_requests add column if not exists mod_status text not null default 'ok';

drop policy if exists "v26 hide moderated" on public.feed_posts;
create policy "v26 hide moderated" on public.feed_posts as restrictive for select to public
  using (mod_status = 'ok' or auth.uid() = user_id or public.is_admin());
drop policy if exists "v26 hide moderated" on public.feed_comments;
create policy "v26 hide moderated" on public.feed_comments as restrictive for select to public
  using (mod_status = 'ok' or auth.uid() = user_id or public.is_admin());
drop policy if exists "v26 hide moderated" on public.messages;
create policy "v26 hide moderated" on public.messages as restrictive for select to public
  using (mod_status = 'ok' or auth.uid() = sender or public.is_admin());
drop policy if exists "v26 hide moderated" on public.hub_requests;
create policy "v26 hide moderated" on public.hub_requests as restrictive for select to public
  using (mod_status = 'ok' or auth.uid() = from_user or public.is_admin());

-- http(s) only; anything else (javascript:, data:, vbscript:, file:) becomes null
create or replace function public.safety_clean_url(u text) returns text language sql immutable as $$
  select case when u is null or btrim(u) = '' then null
              when btrim(u) ~* '^https?://[^\s<>"]+$' then btrim(u)
              when btrim(u) ~ '^/[^/\s<>"][^\s<>"]*$' then btrim(u)
              else null end;
$$;
-- media must be ours (storage 'posts' bucket or /images/) or a Giphy / Tenor GIF
create or replace function public.safety_ok_media(u text) returns boolean language sql immutable as $$
  select u is null or btrim(u) = ''
      or u like '/images/%'
      or u like 'https://izfccjaznlcffvjxawya.supabase.co/storage/v1/object/public/posts/%'
      or u ~* '^https://(media[0-9]*|i)\.giphy\.com/'
      or u ~* '^https://media[0-9]*\.tenor\.com/';
$$;
create or replace function public.safety_media_list_ok(m jsonb) returns boolean language plpgsql immutable as $$
declare e jsonb; u text;
begin
  if m is null or jsonb_typeof(m) <> 'array' then return true; end if;
  for e in select * from jsonb_array_elements(m) loop
    u := case jsonb_typeof(e) when 'string' then e #>> '{}' when 'object' then coalesce(e->>'url', e->>'src') else null end;
    if not public.safety_ok_media(u) then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.safety_posts_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  -- members (anon / authenticated) cannot change mod_status; the admin and database-internal code can
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then new.mod_status := 'ok'; else new.mod_status := old.mod_status; end if;
  end if;
  new.link := public.safety_clean_url(new.link);
  if not public.safety_media_list_ok(to_jsonb(new.media)) then
    raise exception 'Photos and videos must be uploaded here (links to outside pictures are not allowed).';
  end if;
  return new;
end $$;
drop trigger if exists safety_posts_guard_v26 on public.feed_posts;
create trigger safety_posts_guard_v26 before insert or update on public.feed_posts for each row execute function public.safety_posts_guard();

create or replace function public.safety_comments_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  -- members (anon / authenticated) cannot change mod_status; the admin and database-internal code can
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then new.mod_status := 'ok'; else new.mod_status := old.mod_status; end if;
  end if;
  if not public.safety_ok_media(new.media) then
    raise exception 'Photos and videos must be uploaded here (links to outside pictures are not allowed).';
  end if;
  return new;
end $$;
drop trigger if exists safety_comments_guard_v26 on public.feed_comments;
create trigger safety_comments_guard_v26 before insert or update on public.feed_comments for each row execute function public.safety_comments_guard();

create or replace function public.safety_messages_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  -- members (anon / authenticated) cannot change mod_status; the admin and database-internal code can
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then new.mod_status := 'ok'; else new.mod_status := old.mod_status; end if;
  end if;
  return new;
end $$;
drop trigger if exists safety_messages_guard_v26 on public.messages;
create trigger safety_messages_guard_v26 before insert or update on public.messages for each row execute function public.safety_messages_guard();

create or replace function public.safety_hub_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  -- members (anon / authenticated) cannot change mod_status; the admin and database-internal code can
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then new.mod_status := 'ok'; else new.mod_status := old.mod_status; end if;
  end if;
  new.media := public.safety_clean_url(new.media);
  if new.media is not null and not public.safety_ok_media(new.media) then
    raise exception 'Files must be uploaded here, or be a Giphy / Tenor GIF.';
  end if;
  return new;
end $$;
drop trigger if exists safety_hub_guard_v26 on public.hub_requests;
create trigger safety_hub_guard_v26 before insert or update on public.hub_requests for each row execute function public.safety_hub_guard();

create or replace function public.safety_pages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.website := public.safety_clean_url(new.website);
  return new;
end $$;
drop trigger if exists safety_pages_guard_v26 on public.pages;
create trigger safety_pages_guard_v26 before insert or update on public.pages for each row execute function public.safety_pages_guard();

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'spaces' and column_name = 'pay_link') then
    execute $f$create or replace function public.safety_spaces_guard() returns trigger language plpgsql security definer set search_path = public as $g$
      begin new.pay_link := public.safety_clean_url(new.pay_link); return new; end $g$ $f$;
    execute 'drop trigger if exists safety_spaces_guard_v26 on public.spaces';
    execute 'create trigger safety_spaces_guard_v26 before insert or update on public.spaces for each row execute function public.safety_spaces_guard()';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5 · reports → auto-hide, hold, admin queue
-- ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references auth.users(id) on delete set null,
  reported uuid,
  reason text,
  resolved boolean default false,
  created_at timestamptz default now());
alter table public.reports add column if not exists target_kind text;   -- post | comment | dm | hub | profile | media | page | other
alter table public.reports add column if not exists target_id text;
alter table public.reports add column if not exists category text;      -- child_safety | sexual | harassment | threat | illegal | scam | spam | other
alter table public.reports add column if not exists details text;
alter table public.reports add column if not exists evidence jsonb;
alter table public.reports add column if not exists status text default 'open';   -- open | actioned | dismissed
alter table public.reports add column if not exists reviewed_by uuid;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists resolved boolean default false;
create unique index if not exists reports_one_per_reporter_v26 on public.reports (reporter, target_kind, target_id) where target_id is not null;
create index if not exists reports_target_v26 on public.reports (target_kind, target_id);
create index if not exists reports_reported_v26 on public.reports (reported, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "v26 reports insert own" on public.reports;
create policy "v26 reports insert own" on public.reports for insert to authenticated with check (reporter = auth.uid());
drop policy if exists "v26 reports insert is mine" on public.reports;
create policy "v26 reports insert is mine" on public.reports as restrictive for insert to public with check (reporter = auth.uid());
drop policy if exists "v26 reports read own or admin" on public.reports;
create policy "v26 reports read own or admin" on public.reports for select using (reporter = auth.uid() or public.is_admin());
drop policy if exists "v26 reports private" on public.reports;
create policy "v26 reports private" on public.reports as restrictive for select to public using (reporter = auth.uid() or public.is_admin());
drop policy if exists "v26 reports admin update" on public.reports;
create policy "v26 reports admin update" on public.reports for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "v26 reports admin only update" on public.reports;
create policy "v26 reports admin only update" on public.reports as restrictive for update to public using (public.is_admin()) with check (public.is_admin());

create or replace function public.safety_hold_user(uid uuid, why text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if uid is null or uid = public.founder_id() then return; end if;
  insert into public.member_safety (user_id, held, held_reason, flagged) values (uid, true, why, true)
  on conflict (user_id) do update set held = true, held_reason = coalesce(public.member_safety.held_reason, excluded.held_reason), flagged = true, updated_at = now();
  perform public.safety_sync_profile(uid);
end $$;
revoke all on function public.safety_hold_user(uuid, text) from public, anon, authenticated;

create or replace function public.safety_on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; n_user int; v_id bigint;
begin
  if new.target_kind is null then return new; end if;
  select count(distinct r.reporter) into n from public.reports r
   where r.target_kind = new.target_kind and r.target_id = new.target_id and coalesce(r.status, 'open') = 'open';
  if (n >= 3 or new.category = 'child_safety') and new.target_id ~ '^\d+$' then
    v_id := new.target_id::bigint;
    if new.target_kind = 'post' then update public.feed_posts set mod_status = 'hidden' where id = v_id and mod_status = 'ok';
    elsif new.target_kind = 'comment' then update public.feed_comments set mod_status = 'hidden' where id = v_id and mod_status = 'ok';
    elsif new.target_kind = 'dm' then update public.messages set mod_status = 'hidden' where id = v_id and mod_status = 'ok';
    elsif new.target_kind = 'hub' then update public.hub_requests set mod_status = 'hidden' where id = v_id and mod_status = 'ok';
    elsif new.target_kind = 'media' then update public.media_items set status = 'pending' where id = v_id and status = 'ok';
    end if;
  end if;
  if new.target_kind = 'media' and (n >= 3 or new.category = 'child_safety') and new.target_id !~ '^\d+$' then
    update public.media_items set status = 'pending' where url = new.target_id and status = 'ok';
  end if;
  -- the account: 3 different reporters on anything they did (or one child-safety report) puts it on hold
  if new.reported is not null then
    select count(distinct r.reporter) into n_user from public.reports r where r.reported = new.reported and coalesce(r.status, 'open') = 'open';
    if n_user >= 3 or new.category = 'child_safety' then
      perform public.safety_hold_user(new.reported, case when new.category = 'child_safety' then 'child-safety report' else n_user || ' members reported this account' end);
    end if;
  end if;
  perform public.notify(public.founder_id(), 'mod',
    case when new.category = 'child_safety' then '🚨 CHILD SAFETY report' else '🚩 New report' end || ' · ' || coalesce(new.target_kind, 'item'),
    left(coalesce(new.category, '') || ' · ' || coalesce(new.details, new.reason, ''), 180), '/?v=admin&what=mod', null);
  return new;
exception when others then
  raise warning 'safety_on_report: %', sqlerrm;
  return new;
end $$;

-- media log (every upload) — created before the report trigger is attached so the function compiles cleanly
create table if not exists public.media_items (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  bucket text not null,
  path text not null,
  url text,
  mime text,
  bytes bigint,
  kind text,                          -- image | video | file
  surface text,                       -- post | comment | dm | avatar | cover | page | ad | course | other
  scores jsonb,                       -- client-side NSFW scores (nsfwjs)
  status text not null default 'ok',  -- ok | pending | removed | quarantined
  reason text,
  created_at timestamptz default now(),
  reviewed_by uuid,
  reviewed_at timestamptz);
create unique index if not exists media_items_bucket_path_v26 on public.media_items (bucket, path);
create index if not exists media_items_status_v26 on public.media_items (status, created_at desc);
create index if not exists media_items_url_v26 on public.media_items (url);
alter table public.media_items enable row level security;
drop policy if exists "v26 media insert own" on public.media_items;
create policy "v26 media insert own" on public.media_items for insert to authenticated
  with check (user_id = auth.uid() and status in ('ok', 'pending') and reviewed_by is null);
drop policy if exists "v26 media read own or admin" on public.media_items;
create policy "v26 media read own or admin" on public.media_items for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "v26 media admin update" on public.media_items;
create policy "v26 media admin update" on public.media_items for update using (public.is_admin()) with check (public.is_admin());

drop trigger if exists safety_on_report_v26 on public.reports;
create trigger safety_on_report_v26 after insert on public.reports for each row execute function public.safety_on_report();

-- evidence snapshots: never deleted by the app; admin_delete_user refuses while a hold exists
create table if not exists public.mod_evidence (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  created_by uuid,
  user_id uuid,                -- no foreign key on purpose: evidence outlives the account
  kind text,
  target_id text,
  snapshot jsonb,
  hold boolean not null default true,
  ncmec_report_id text,
  note text);
alter table public.mod_evidence enable row level security;
revoke all on public.mod_evidence from anon;
drop policy if exists "v26 evidence admin read" on public.mod_evidence;
create policy "v26 evidence admin read" on public.mod_evidence for select using (public.is_admin());
drop policy if exists "v26 evidence admin update" on public.mod_evidence;
create policy "v26 evidence admin update" on public.mod_evidence for update using (public.is_admin()) with check (public.is_admin());

-- ── admin actions (all check is_admin(): the founder account id) ──
create or replace function public.mod_set_content(p_kind text, p_id text, p_status text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_status not in ('ok', 'hidden', 'removed') then raise exception 'bad status'; end if;
  if p_id !~ '^\d+$' then raise exception 'bad id'; end if;
  v_id := p_id::bigint;
  if p_kind = 'post' then update public.feed_posts set mod_status = p_status where id = v_id;
  elsif p_kind = 'comment' then update public.feed_comments set mod_status = p_status where id = v_id;
  elsif p_kind = 'dm' then update public.messages set mod_status = p_status where id = v_id;
  elsif p_kind = 'hub' then update public.hub_requests set mod_status = p_status where id = v_id;
  elsif p_kind = 'media' then update public.media_items set status = case p_status when 'ok' then 'ok' when 'hidden' then 'pending' else 'removed' end, reviewed_by = auth.uid(), reviewed_at = now() where id = v_id;
  else raise exception 'unknown kind %', p_kind; end if;
  update public.reports set status = case when p_status = 'ok' then 'dismissed' else 'actioned' end, resolved = true, reviewed_by = auth.uid(), reviewed_at = now()
   where target_kind = p_kind and target_id = p_id and coalesce(status, 'open') = 'open';
  return p_kind || ' ' || p_id || ' → ' || p_status;
end $$;
revoke all on function public.mod_set_content(text, text, text, text) from public, anon;
grant execute on function public.mod_set_content(text, text, text, text) to authenticated;

create or replace function public.mod_resolve_report(p_report bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.reports set status = p_status, resolved = p_status <> 'open', reviewed_by = auth.uid(), reviewed_at = now() where id = p_report;
end $$;
revoke all on function public.mod_resolve_report(bigint, text) from public, anon;
grant execute on function public.mod_resolve_report(bigint, text) to authenticated;

create or replace function public.mod_set_user(p_user uuid, p_action text, p_reason text default null) returns text
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_user is null or p_user = public.founder_id() then raise exception 'not allowed'; end if;
  insert into public.member_safety (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_action = 'hold' then update public.member_safety set held = true, held_reason = coalesce(p_reason, 'admin hold'), flagged = true, updated_at = now() where user_id = p_user;
  elsif p_action = 'release' then update public.member_safety set held = false, held_reason = null, flagged = false, updated_at = now() where user_id = p_user;
  elsif p_action = 'restrict' then update public.member_safety set restricted = true, restricted_reason = coalesce(p_reason, 'admin'), flagged = true, updated_at = now() where user_id = p_user;
  elsif p_action = 'unrestrict' then update public.member_safety set restricted = false, restricted_reason = null, updated_at = now() where user_id = p_user;
  elsif p_action = 'ban' then
    update public.member_safety set banned = true, banned_reason = coalesce(p_reason, 'admin ban'), flagged = true, updated_at = now() where user_id = p_user;
    begin update auth.users set banned_until = now() + interval '100 years' where id = p_user; exception when others then raise warning 'banned_until: %', sqlerrm; end;
    begin
      if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_set_ban') then
        execute 'select public.admin_set_ban($1, true)' using p_user;
      end if;
    exception when others then null; end;
  elsif p_action = 'unban' then
    update public.member_safety set banned = false, banned_reason = null, updated_at = now() where user_id = p_user;
    begin update auth.users set banned_until = null where id = p_user; exception when others then null; end;
    begin
      if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_set_ban') then
        execute 'select public.admin_set_ban($1, false)' using p_user;
      end if;
    exception when others then null; end;
  elsif p_action = 'clear_flag' then update public.member_safety set flagged = false, updated_at = now() where user_id = p_user;
  else raise exception 'unknown action %', p_action; end if;
  perform public.safety_sync_profile(p_user);
  if p_action in ('ban', 'hold') then
    update public.reports set status = 'actioned', resolved = true, reviewed_by = auth.uid(), reviewed_at = now() where reported = p_user and coalesce(status, 'open') = 'open';
  end if;
  return p_action || ' ' || p_user;
end $$;
revoke all on function public.mod_set_user(uuid, text, text) from public, anon;
grant execute on function public.mod_set_user(uuid, text, text) to authenticated;

-- freeze evidence about an account / item (for NCMEC CyberTipline or police). Holds the account too.
create or replace function public.mod_preserve_evidence(p_user uuid, p_kind text default null, p_id text default null, p_note text default null) returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare v_snap jsonb := '{}'::jsonb; v_id bigint; v_target jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  begin
    select jsonb_build_object('id', u.id, 'email', u.email, 'phone', u.phone, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                              'email_confirmed_at', u.email_confirmed_at, 'user_metadata', u.raw_user_meta_data)
      into v_target from auth.users u where u.id = p_user;
    v_snap := v_snap || jsonb_build_object('account', v_target);
  exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('profile', (select to_jsonb(p) from public.profiles p where p.id = p_user)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('safety', (select to_jsonb(s) from public.member_safety s where s.user_id = p_user)); exception when others then null; end;
  begin
    v_snap := v_snap || jsonb_build_object('sign_ins', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select a.created_at, a.ip_address, a.payload->>'action' as action from auth.audit_log_entries a
       where a.payload->>'actor_id' = p_user::text order by a.created_at desc limit 50) x));
  exception when others then null; end;
  begin
    if p_kind = 'post' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.feed_posts t where t.id = p_id::bigint));
    elsif p_kind = 'comment' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.feed_comments t where t.id = p_id::bigint));
    elsif p_kind = 'dm' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.messages t where t.id = p_id::bigint));
    elsif p_kind = 'hub' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.hub_requests t where t.id = p_id::bigint));
    elsif p_kind = 'media' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.media_items t where t.id = p_id::bigint));
    end if;
  exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('media', (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]'::jsonb) from (select * from public.media_items where user_id = p_user order by created_at desc limit 200) m)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('reports', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reports r where r.reported = p_user)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('recent_dms_sent', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from (select id, recipient, room, body, created_at from public.messages where sender = p_user order by created_at desc limit 200) m)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('recent_posts', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from (select * from public.feed_posts where user_id = p_user order by created_at desc limit 100) m)); exception when others then null; end;
  insert into public.mod_evidence (created_by, user_id, kind, target_id, snapshot, hold, note)
    values (auth.uid(), p_user, p_kind, p_id, v_snap, true, p_note) returning id into v_id;
  if p_user is not null and p_user <> public.founder_id() then perform public.safety_hold_user(p_user, 'evidence preserved'); end if;
  return v_id;
end $$;
revoke all on function public.mod_preserve_evidence(uuid, text, text, text) from public, anon;
grant execute on function public.mod_preserve_evidence(uuid, text, text, text) to authenticated;

-- admin_delete_user (v20) + refuses while evidence is on hold
create or replace function public.admin_delete_user(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_pages int := 0;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_user is null then raise exception 'no user'; end if;
  if p_user = auth.uid() then raise exception 'you cannot delete the account you are signed in with'; end if;
  if exists (select 1 from public.mod_evidence e where e.user_id = p_user and e.hold) then
    raise exception 'This account has evidence on hold (NCMEC / law enforcement). Ban it instead; release the hold in Moderation first if you really must delete.';
  end if;
  select email into v_email from auth.users where id = p_user;
  if v_email is null and not exists (select 1 from public.profiles where id = p_user) then return 'not found'; end if;
  begin
    update public.pages set owner_id = auth.uid() where owner_id = p_user;
    get diagnostics v_pages = row_count;
    update public.pages set admins = array_remove(admins, p_user) where p_user = any(admins);
  exception when others then null; end;
  delete from auth.users where id = p_user;
  delete from public.profiles where id = p_user;
  return 'deleted ' || coalesce(v_email, p_user::text) || case when v_pages > 0 then ' · ' || v_pages || ' page(s) moved to you' else '' end;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6 · rate limits (skipped for the admin and for database-internal inserts)
-- ─────────────────────────────────────────────────────────────
create or replace function public.safety_rate_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or public.is_admin() then return new; end if;
  if tg_table_name = 'messages' then
    if new.recipient is null then
      select count(*) into n from public.messages where sender = uid and created_at > now() - interval '1 minute';
      if n >= 20 then raise exception 'Slow down: 20 messages a minute is the limit.'; end if;
    else
      select count(*) into n from public.messages where sender = uid and recipient is not null and created_at > now() - interval '1 hour';
      if n >= 150 then raise exception 'Slow down: that is a lot of messages for one hour.'; end if;
      if not public.safety_connected(uid, new.recipient) then
        -- strangers: at most 3 messages until they reply, at most 5 new people an hour
        if not exists (select 1 from public.messages where sender = new.recipient and recipient = uid) then
          select count(*) into n from public.messages where sender = uid and recipient = new.recipient;
          if n >= 3 then raise exception 'Wait for them to reply (or connect) before sending more.'; end if;
        end if;
        select count(distinct m.recipient) into n from public.messages m
         where m.sender = uid and m.recipient is not null and m.recipient <> new.recipient
           and m.created_at > now() - interval '1 hour' and not public.safety_connected(uid, m.recipient);
        if n >= 5 then raise exception 'You can start up to 5 new conversations an hour with people you are not connected to.'; end if;
      end if;
    end if;
  elsif tg_table_name = 'hub_requests' then
    select count(*) into n from public.hub_requests where from_user = uid and created_at > now() - interval '1 hour';
    if n >= 40 then raise exception 'Slow down: that is a lot of requests for one hour.'; end if;
    if not public.safety_connected(uid, new.to_user) then
      select count(distinct h.to_user) into n from public.hub_requests h
       where h.from_user = uid and h.to_user <> new.to_user and h.created_at > now() - interval '1 hour' and not public.safety_connected(uid, h.to_user);
      if n >= 5 then raise exception 'You can reach up to 5 new people an hour.'; end if;
    end if;
  elsif tg_table_name = 'connections' then
    select count(*) into n from public.connections where requester = uid and created_at > now() - interval '24 hours';
    if n >= 30 then raise exception 'That is 30 connection requests today. Try again tomorrow.'; end if;
  elsif tg_table_name = 'meeting_requests' then
    select count(*) into n from public.meeting_requests where from_user = uid and created_at > now() - interval '1 hour';
    if n >= 20 then raise exception 'Slow down: that is a lot of call requests for one hour.'; end if;
  elsif tg_table_name = 'feed_posts' then
    select count(*) into n from public.feed_posts where user_id = uid and created_at > now() - interval '1 hour';
    if n >= 20 then raise exception 'That is 20 posts this hour. Take a breather and try again soon.'; end if;
  elsif tg_table_name = 'feed_comments' then
    select count(*) into n from public.feed_comments where user_id = uid and created_at > now() - interval '1 hour';
    if n >= 80 then raise exception 'Slow down: that is a lot of comments for one hour.'; end if;
  elsif tg_table_name = 'reports' then
    select count(*) into n from public.reports where reporter = uid and created_at > now() - interval '24 hours';
    if n >= 40 then raise exception 'Report limit reached for today. For emergencies call 911.'; end if;
  elsif tg_table_name = 'media_items' then
    select count(*) into n from public.media_items where user_id = uid and created_at > now() - interval '1 hour';
    if n >= 40 then raise exception 'Upload limit reached for this hour.'; end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['messages', 'hub_requests', 'connections', 'meeting_requests', 'feed_posts', 'feed_comments', 'reports', 'media_items'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists safety_rate_v26 on public.%I', t);
      execute format('create trigger safety_rate_v26 before insert on public.%I for each row execute function public.safety_rate_guard()', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 7 · storage: MIME allowlists, own-folder uploads, no listing, private quarantine bucket
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('quarantine', 'quarantine', false, 52428800)
on conflict (id) do update set public = false;

do $$ begin
  update storage.buckets set allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'] where id = 'posts';
  update storage.buckets set allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm',
    'application/pdf',
    'application/vnd.ms-powerpoint', 'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'] where id = 'conference';
  update storage.buckets set allowed_mime_types = null where id = 'quarantine';
exception when others then raise warning 'allowed_mime_types not set: %', sqlerrm; end $$;

-- every upload into our buckets: own folder + confirmed adult + 72 h old account + under the hourly cap
drop policy if exists "v26 uploads gate" on storage.objects;
create policy "v26 uploads gate" on storage.objects as restrictive for insert to public with check (
  bucket_id not in ('posts', 'conference', 'quarantine')
  or public.is_admin()
  or ((storage.foldername(name))[1] = auth.uid()::text and public.safety_can_upload(auth.uid())));
-- nobody lists other members' files (public URLs still work: public buckets do not need a select policy)
drop policy if exists "v26 no listing others" on storage.objects;
create policy "v26 no listing others" on storage.objects as restrictive for select to public using (
  bucket_id not in ('posts', 'conference', 'quarantine')
  or public.is_admin()
  or (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "v26 no overwrite" on storage.objects;
create policy "v26 no overwrite" on storage.objects as restrictive for update to public using (
  bucket_id not in ('posts', 'conference', 'quarantine') or public.is_admin());
drop policy if exists "v26 quarantine insert" on storage.objects;
create policy "v26 quarantine insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'quarantine' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "v26 quarantine admin read" on storage.objects;
create policy "v26 quarantine admin read" on storage.objects for select to authenticated using (bucket_id = 'quarantine' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
drop policy if exists "v26 admin put public media" on storage.objects;
create policy "v26 admin put public media" on storage.objects for insert to authenticated with check (bucket_id in ('posts', 'conference') and public.is_admin());
drop policy if exists "v26 admin remove public media" on storage.objects;
create policy "v26 admin remove public media" on storage.objects for delete to authenticated using (bucket_id in ('posts', 'conference') and public.is_admin());
-- flagged files are evidence: nobody (not even the uploader) deletes from quarantine through the API
drop policy if exists "v26 quarantine no delete" on storage.objects;
create policy "v26 quarantine no delete" on storage.objects as restrictive for delete to public using (bucket_id <> 'quarantine');

-- ─────────────────────────────────────────────────────────────
-- 8 · lockdown fixes
-- ─────────────────────────────────────────────────────────────
-- 8a notify(): add the minor check, and nobody can call it through the API any more (it let anyone send
--     any member a fake notification with any link). Triggers still call it as the database owner.
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_url text, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_kind <> 'mod' and public.safety_is_minor(p_user) then return; end if;
  if p_kind <> 'mod' and p_actor is not null and public.safety_is_minor(p_actor) then return; end if;
  if not public.notif_wanted(p_user, p_kind) then return; end if;
  if p_actor is not null and exists (select 1 from public.profiles p where p.id = p_user and p.blocked @> array[p_actor]) then return; end if;
  if exists (select 1 from public.notifications n where n.user_id = p_user and n.kind = p_kind and n.title = p_title and coalesce(n.url, '') = coalesce(p_url, '') and n.created_at > now() - interval '1 minute') then return; end if;
  insert into public.notifications (user_id, kind, title, body, url, actor) values (p_user, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 200), p_url, p_actor);
exception when others then null;
end $$;
do $$ begin
  begin execute 'revoke all on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.notify_mentions(text, uuid, text, text) from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.notif_wanted(uuid, text) from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.safety_hold_user(uuid, text) from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.safety_on_report() from public, anon, authenticated'; exception when others then null; end;
end $$;

-- 8b my_email(): only a CONFIRMED e-mail counts (it unlocks Brand page editing for pre-linked clients)
create or replace function public.my_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null), '');
$$;

-- 8c page claiming / welcome linking: CONFIRMED e-mail only (v20-21 bodies + that one condition)
create or replace function public.welcome_new_member() returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_founder uuid;
begin
  begin
    select lower(email) into v_email from auth.users where id = new.id and email_confirmed_at is not null;
    v_founder := public.founder_id();
    if v_founder is not null and v_founder <> new.id then
      insert into public.connections (requester, addressee, kind, status) values (v_founder, new.id, 'connect', 'accepted') on conflict do nothing;
    end if;
    if v_email is not null then
      update public.pages set admins = array_append(coalesce(admins, '{}'), new.id), claimed_at = coalesce(claimed_at, now())
       where v_email = any(admin_emails) and not (new.id = any(coalesce(admins, '{}')));
    end if;
  exception when others then raise warning 'welcome_new_member skipped: %', sqlerrm; end;
  return new;
end $$;
create or replace function public.claim_my_pages() returns int language plpgsql security definer set search_path = public as $$
declare v_email text; n int := 0; v_founder uuid;
begin
  if auth.uid() is null then return 0; end if;
  begin
    select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
    if v_email is not null then
      update public.pages set admins = array_append(coalesce(admins, '{}'), auth.uid()), claimed_at = coalesce(claimed_at, now())
       where v_email = any(admin_emails) and not (auth.uid() = any(coalesce(admins, '{}')));
      get diagnostics n = row_count;
    end if;
  exception when others then null; end;
  begin
    v_founder := public.founder_id();
    if v_founder is not null and v_founder <> auth.uid() then
      if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce((p.home->>'noFounder')::boolean, false)) then
        insert into public.connections (requester, addressee, kind, status) values (v_founder, auth.uid(), 'connect', 'accepted') on conflict do nothing;
        update public.connections set status = 'accepted' where requester = auth.uid() and addressee = v_founder and status = 'pending';
      end if;
    end if;
  exception when others then null; end;
  return n;
end $$;
grant execute on function public.claim_my_pages() to authenticated;

-- 8d presence: only you, your connections and the admin see it; the stored page drops its ?query
--     (it used to show everyone e.g. "/?v=dm&with=someone")
drop policy if exists "v26 presence connections only" on public.presence;
create policy "v26 presence connections only" on public.presence as restrictive for select to public
  using (auth.uid() = user_id or public.is_admin() or public.safety_connected(auth.uid(), user_id));
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'presence' and column_name = 'page') then
    execute $f$create or replace function public.safety_presence_guard() returns trigger language plpgsql as $g$
      begin new.page := left(split_part(coalesce(new.page, ''), '?', 1), 80); return new; end $g$ $f$;
    execute 'drop trigger if exists safety_presence_guard_v26 on public.presence';
    execute 'create trigger safety_presence_guard_v26 before insert or update on public.presence for each row execute function public.safety_presence_guard()';
    execute $f$update public.presence set page = left(split_part(coalesce(page, ''), '?', 1), 80) where page like '%?%'$f$;
  end if;
end $$;

-- 8e bug reports can hold screenshots: the reporter and the admin only
do $$ begin
  if to_regclass('public.bugs') is not null then
    execute 'alter table public.bugs enable row level security';
    execute 'drop policy if exists "v26 bugs private" on public.bugs';
    execute 'create policy "v26 bugs private" on public.bugs as restrictive for select to public using (public.is_admin() or (user_id is not null and user_id = auth.uid()))';
  end if;
end $$;

-- 8f views run as their owner and skip RLS: the retired Hearts view is closed above. member_stats only
--     exposes counts and is left as is.

-- 8g realtime: new safety tables are NOT added to supabase_realtime on purpose.

-- ─────────────────────────────────────────────────────────────
-- 9 · done. Quick self-check you can run afterwards:
--   select public.my_safety();                         -- as a signed-in member (from the app)
--   select count(*) from public.member_safety;          -- rows appear as members enter their DOB
--   select polname, polpermissive from pg_policy where polname like 'v26%';
-- ─────────────────────────────────────────────────────────────


-- ################################ v26-features.sql ################################
-- allofus.one · v26 FEATURES (Oct 23 2026): Circles, circle-scoped posts, AI guide usage counter.
-- Additive, idempotent, safe to re-run. Run in Supabase -> SQL Editor (any time; the site works before and after).
-- Nothing here drops or rewrites member data. Every new table has RLS on.
--
-- What it adds
--   1. public.circles          a member's own audiences (Family, Inner Tribe, Professional, Local + custom)
--   2. public.circle_members   who is in each circle (only the circle owner can add/remove)
--   3. feed_posts.circle_id    a post shared to ONE circle; only the author, that circle's members and admins can read it
--   4. a RESTRICTIVE read policy on feed_posts and feed_comments so circle posts never leak through the
--      existing "public or connections" policy, whatever that policy looks like after other rounds
--   5. public.aou_guide_hits   counter rows for the AI guide Edge Function's rate limit (no question text, no IPs:
--      only a salted hash). Service-role only: no client policies at all.

-- ---------- 1. circles ----------
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'custom' check (kind in ('family','tribe','pro','local','custom')),
  color text default '#0ea5e9',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists circles_owner_idx on public.circles (owner_id, sort);
alter table public.circles enable row level security;

-- ---------- 2. circle_members ----------
create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (circle_id, member_id)
);
create index if not exists circle_members_member_idx on public.circle_members (member_id);
create index if not exists circle_members_owner_idx on public.circle_members (owner_id);
alter table public.circle_members enable row level security;

-- helpers (security definer so policies never recurse through RLS)
create or replace function public.owns_circle(p_circle uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid());
$$;
create or replace function public.in_circle(p_circle uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = auth.uid())
      or exists (select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid());
$$;
grant execute on function public.owns_circle(uuid) to authenticated;
grant execute on function public.in_circle(uuid) to authenticated, anon;

-- circles: the owner reads and writes; a member may read the name of a circle they were put in
drop policy if exists "circles owner all" on public.circles;
create policy "circles owner all" on public.circles for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "circles member read" on public.circles;
create policy "circles member read" on public.circles for select
  using (exists (select 1 from public.circle_members m where m.circle_id = circles.id and m.member_id = auth.uid()));

-- circle_members: only the circle owner writes; owner and the member themself can read the row
drop policy if exists "circle members owner write" on public.circle_members;
create policy "circle members owner write" on public.circle_members for insert
  with check (owner_id = auth.uid() and public.owns_circle(circle_id) and member_id <> auth.uid());
drop policy if exists "circle members owner delete" on public.circle_members;
create policy "circle members owner delete" on public.circle_members for delete
  using (owner_id = auth.uid() or member_id = auth.uid());  -- a member may also leave
drop policy if exists "circle members read" on public.circle_members;
create policy "circle members read" on public.circle_members for select
  using (owner_id = auth.uid() or member_id = auth.uid());

-- cap: 24 circles and 500 members per circle (stops abuse, plenty for real life)
create or replace function public.circle_caps() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'circles' then
    if (select count(*) from public.circles where owner_id = new.owner_id) >= 24 then raise exception 'You can have up to 24 circles.'; end if;
  else
    if (select count(*) from public.circle_members where circle_id = new.circle_id) >= 500 then raise exception 'A circle holds up to 500 people.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists circles_cap on public.circles;
create trigger circles_cap before insert on public.circles for each row execute function public.circle_caps();
drop trigger if exists circle_members_cap on public.circle_members;
create trigger circle_members_cap before insert on public.circle_members for each row execute function public.circle_caps();

-- ---------- 3. circle-scoped posts ----------
alter table public.feed_posts add column if not exists circle_id uuid references public.circles(id) on delete set null;
create index if not exists feed_posts_circle_idx on public.feed_posts (circle_id, created_at desc) where circle_id is not null;

-- you may only post into a circle you own (insert + update)
drop policy if exists "circle posts own circle v26" on public.feed_posts;
create policy "circle posts own circle v26" on public.feed_posts as restrictive for insert
  with check (circle_id is null or public.owns_circle(circle_id));
drop policy if exists "circle posts own circle upd v26" on public.feed_posts;
create policy "circle posts own circle upd v26" on public.feed_posts as restrictive for update
  using (true) with check (circle_id is null or public.owns_circle(circle_id));

-- 4. READ: permissive branch lets circle members (who may not be connections) see the post;
--    restrictive branch makes sure a circle post is NEVER visible to anyone outside the circle,
--    no matter what the other (permissive) read policies say.
drop policy if exists "circle members read circle posts v26" on public.feed_posts;
create policy "circle members read circle posts v26" on public.feed_posts for select
  using (circle_id is not null and public.in_circle(circle_id) and (publish_at is null or publish_at <= now()));
drop policy if exists "circle posts stay in circle v26" on public.feed_posts;
create policy "circle posts stay in circle v26" on public.feed_posts as restrictive for select
  using (circle_id is null or auth.uid() = user_id or public.in_circle(circle_id) or public.is_admin());

-- comments and reactions on a circle post follow the post (the sub-select runs under feed_posts RLS)
do $$ begin
  if to_regclass('public.feed_comments') is not null then
    execute 'drop policy if exists "comments follow circle post v26" on public.feed_comments';
    execute 'create policy "comments follow circle post v26" on public.feed_comments as restrictive for select using (exists (select 1 from public.feed_posts p where p.id = feed_comments.post_id))';
  end if;
  if to_regclass('public.feed_reactions') is not null then
    execute 'drop policy if exists "reactions follow circle post v26" on public.feed_reactions';
    execute 'create policy "reactions follow circle post v26" on public.feed_reactions as restrictive for select using (exists (select 1 from public.feed_posts p where p.id = feed_reactions.post_id))';
  end if;
end $$;

-- ---------- 5. AI guide rate-limit counter (Edge Function aou-guide uses the service role) ----------
create table if not exists public.aou_guide_hits (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text not null,            -- 'u:<user uuid>' or 'ip:<salted sha-256, 16 hex>' - never a raw IP
  tokens_in int default 0,
  tokens_out int default 0,
  ok boolean default true
);
create index if not exists aou_guide_hits_who_idx on public.aou_guide_hits (who, at desc);
create index if not exists aou_guide_hits_at_idx on public.aou_guide_hits (at desc);
alter table public.aou_guide_hits enable row level security;
-- no policies on purpose: only the service role (the Edge Function) can read or write.
-- admins read usage with the stats queries in MASTER-GAMEPLAN.md (SQL Editor runs as postgres).

-- keep 30 days of counter rows (call any time; optional pg_cron line in the gameplan)
create or replace function public.aou_guide_prune() returns void language sql security definer set search_path = public as $$
  delete from public.aou_guide_hits where at < now() - interval '30 days';
$$;
revoke all on function public.aou_guide_prune() from public, anon, authenticated;

-- ---------- realtime (optional, harmless if already added) ----------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.circles'; exception when others then null; end;
end $$;

-- verify (should list the new tables with rowsecurity = true)
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('circles','circle_members','aou_guide_hits');

-- ---------- 6. daily KPI snapshot (investor metrics; presence only keeps the LAST visit, so history must be snapshotted) ----------
create table if not exists public.aou_kpi_daily (
  day date primary key,
  members int, new_members int, dau int, wau int, mau int,
  posts int, comments int, reactions int, connections_made int, brand_pages int, guide_questions int,
  taken_at timestamptz default now()
);
alter table public.aou_kpi_daily enable row level security;
drop policy if exists "kpi admins read" on public.aou_kpi_daily;
create policy "kpi admins read" on public.aou_kpi_daily for select using (public.is_admin());

create or replace function public.aou_kpi_snapshot() returns public.aou_kpi_daily
language plpgsql security definer set search_path = public as $$
declare r public.aou_kpi_daily; d date := (now() at time zone 'America/Denver')::date;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
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
  select count(*) into r.guide_questions from public.aou_guide_hits where at > now() - interval '1 day';
  r.taken_at := now();
  insert into public.aou_kpi_daily values (r.*) on conflict (day) do update set
    members = excluded.members, new_members = excluded.new_members, dau = excluded.dau, wau = excluded.wau, mau = excluded.mau,
    posts = excluded.posts, comments = excluded.comments, reactions = excluded.reactions, connections_made = excluded.connections_made,
    brand_pages = excluded.brand_pages, guide_questions = excluded.guide_questions, taken_at = excluded.taken_at;
  return r;
end $$;
revoke all on function public.aou_kpi_snapshot() from public, anon;
grant execute on function public.aou_kpi_snapshot() to authenticated;  -- the function itself refuses non-admins
-- Optional, once: Database -> Extensions -> enable pg_cron, then run:
--   select cron.schedule('aou-kpi-daily', '55 5 * * *', $$select public.aou_kpi_snapshot(); select public.aou_guide_prune();$$);
-- (05:55 UTC = 11:55 pm Denver in winter / 10:55 pm in summer.) Until then, run  select public.aou_kpi_snapshot();  by hand.
select public.aou_kpi_snapshot();


-- ################################ v27-security.sql ################################
-- ============================================================
-- allofus.one · v27 SECURITY (Oct 23 2026) · red-team round 2
-- Run in Supabase → SQL Editor AFTER v26-features.sql and v26-safety.sql. Additive, idempotent, safe to re-run.
-- Drops no tables, deletes no member rows. Tested in PGlite (sequence v4…v22 → v26-features → v26-safety → v27 twice).
--
-- What it adds
--   1. safety_settings       feature flags + server secrets (admin / SQL-editor only). Flag server_scan_required (default OFF)
--                            makes every new upload 'pending' (hidden from others) until the media-scan Edge Function clears it.
--   2. audit_log             append-only, hash-chained (sha256(prev_hash || row)). Nobody can UPDATE / DELETE / TRUNCATE it, not
--                            even through the SQL editor without first dropping the guard trigger (which the chain exposes).
--                            audit_verify() walks the chain. Every report, moderation action, evidence snapshot, hold / ban,
--                            DOB change, media status change, account deletion and admin dashboard open writes a row.
--   3. media_hashes          blocklist (sha256 + perceptual + reserved PhotoDNA / PDQ columns for NCMEC hash-list access).
--      safety_incidents      one row per CSAM-suspect / hash-match / NSFW event, with NCMEC report id.
--      media_items           + sha256, phash, scan, scanned_at, scanner, incident_id. media_scan_result() (service role only)
--                            applies the Edge Function verdict: CSAM → quarantine + evidence snapshot + account hold + incident + founder alert.
--      storage trigger       every object in posts / conference gets a media_items row even when the uploader skipped the app
--                            (direct REST upload with the anon key), and a webhook (pg_net) fires to the scanner when configured.
--      read policies         a post / comment / Comm Hub message whose media is pending, removed or quarantined is hidden from
--                            everyone but its author and the admin. Media hosted in our bucket MUST have a media_items row
--                            (backfilled here for existing files), so uploads that bypassed the app are invisible to others.
--   4. delete_my_account()   self-serve: anonymizes, deletes content + storage rows + push subscriptions, writes the audit row
--                            and deletes the auth user. If evidence is on hold for the account it is queued instead (legal hold).
--   5. Realtime authorization: realtime.messages policies. world / pos-* / voice-* / meet:* channels are for confirmed adults
--                            only; dm:<a>:<b> only for the two participants (both adults, neither blocked).
--   6. Profile text guard    usernames must match ^[a-z0-9_.-]{1,20}$ when (re)set; < > in names / bios become ‹ › (XSS belt
--                            and braces: the clients escape, the database now also refuses raw tags). Existing rows untouched.
--   7. Evidence export       mod_evidence_bundle(user) → signed JSON text + sha256 for NCMEC / law enforcement, audited.
--   8. Lockdown              claim_my_pages / admin_stats not callable by anon; set_my_dob audited; mod_preserve_evidence
--                            refactored onto safety_snapshot() so the scanner can snapshot without an admin session.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1 · settings + flags
-- ─────────────────────────────────────────────────────────────
create table if not exists public.safety_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  secret boolean not null default false,
  updated_at timestamptz default now(),
  updated_by uuid);
alter table public.safety_settings enable row level security;
revoke all on public.safety_settings from anon, authenticated;
drop policy if exists "v27 settings admin read" on public.safety_settings;
create policy "v27 settings admin read" on public.safety_settings for select using (public.is_admin() and not secret);

insert into public.safety_settings (key, value, secret) values
  ('server_scan_required', 'false'::jsonb, false),
  ('media_scan_url', 'null'::jsonb, true),
  ('media_scan_secret', 'null'::jsonb, true)
on conflict (key) do nothing;

-- read a NON-secret setting (clients may read flags, e.g. to say "your photo is being checked")
create or replace function public.safety_setting(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select s.value from public.safety_settings s where s.key = k and not s.secret;
$$;
grant execute on function public.safety_setting(text) to anon, authenticated;
create or replace function public.safety_flag(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.value = 'true'::jsonb from public.safety_settings s where s.key = k), false);
$$;
grant execute on function public.safety_flag(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2 · append-only, hash-chained audit log
-- ─────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_role text,
  action text not null,
  target_kind text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  prev_hash text,
  hash text not null);
create index if not exists audit_log_action_v27 on public.audit_log (action, at desc);
create index if not exists audit_log_target_v27 on public.audit_log (target_kind, target_id);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
drop policy if exists "v27 audit admin read" on public.audit_log;
create policy "v27 audit admin read" on public.audit_log for select using (public.is_admin());
-- no insert / update / delete policies for anyone: rows arrive only through audit_write() (security definer)

create or replace function public.audit_log_guard() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only (%). Tampering is detectable: see audit_verify().', tg_op;
end $$;
drop trigger if exists audit_log_immutable_v27 on public.audit_log;
create trigger audit_log_immutable_v27 before update or delete on public.audit_log for each row execute function public.audit_log_guard();
drop trigger if exists audit_log_no_truncate_v27 on public.audit_log;
create trigger audit_log_no_truncate_v27 before truncate on public.audit_log for each statement execute function public.audit_log_guard();

-- canonical string that is hashed (the verifier rebuilds exactly this)
create or replace function public.audit_canon(p_prev text, p_id bigint, p_at timestamptz, p_actor uuid, p_role text, p_action text, p_kind text, p_target text, p_payload jsonb) returns text
language sql immutable as $$
  select coalesce(p_prev, '') || '|' || p_id || '|' || to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || coalesce(p_actor::text, '') || '|' || coalesce(p_role, '')
      || '|' || p_action || '|' || coalesce(p_kind, '') || '|' || coalesce(p_target, '') || '|' || coalesce(p_payload, '{}'::jsonb)::text;
$$;

create or replace function public.audit_write(p_action text, p_kind text, p_id text, p_payload jsonb default '{}'::jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_prev text; v_id bigint; v_at timestamptz := clock_timestamp(); v_actor uuid; v_role text; v_hash text; v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  begin v_actor := auth.uid(); exception when others then v_actor := null; end;
  begin v_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text); exception when others then v_role := current_user::text; end;
  perform pg_advisory_xact_lock(hashtext('aou_audit_chain'));
  select a.hash into v_prev from public.audit_log a order by a.id desc limit 1;
  v_id := nextval(pg_get_serial_sequence('public.audit_log', 'id'));
  v_hash := encode(sha256(convert_to(public.audit_canon(v_prev, v_id, v_at, v_actor, v_role, p_action, p_kind, p_id, v_payload), 'UTF8')), 'hex');
  insert into public.audit_log (id, at, actor, actor_role, action, target_kind, target_id, payload, prev_hash, hash)
    overriding system value values (v_id, v_at, v_actor, v_role, p_action, p_kind, p_id, v_payload, v_prev, v_hash);
  return v_id;
end $$;
revoke all on function public.audit_write(text, text, text, jsonb) from public, anon, authenticated;

-- admin: walk the chain. Returns {checked, ok, first_bad_id, last_id, last_hash}
create or replace function public.audit_verify(p_from bigint default 0, p_limit int default 200000) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; v_prev text; v_n int := 0; v_bad bigint; v_last bigint; v_last_hash text; v_expect text;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  if p_from > 0 then select a.hash into v_prev from public.audit_log a where a.id = p_from; end if;
  for r in select * from public.audit_log a where a.id > p_from order by a.id limit p_limit loop
    v_n := v_n + 1;
    v_expect := encode(sha256(convert_to(public.audit_canon(r.prev_hash, r.id, r.at, r.actor, r.actor_role, r.action, r.target_kind, r.target_id, r.payload), 'UTF8')), 'hex');
    if r.hash <> v_expect or (v_n > 1 or p_from > 0) and r.prev_hash is distinct from v_prev then
      v_bad := coalesce(v_bad, r.id);
    end if;
    v_prev := r.hash; v_last := r.id; v_last_hash := r.hash;
  end loop;
  return jsonb_build_object('checked', v_n, 'ok', v_bad is null, 'first_bad_id', v_bad, 'last_id', v_last, 'last_hash', v_last_hash, 'from', p_from);
end $$;
revoke all on function public.audit_verify(bigint, int) from public, anon;
grant execute on function public.audit_verify(bigint, int) to authenticated;

-- admin dashboard opened (the client calls this when the moderation queue loads; deduped to one row per 10 minutes)
create or replace function public.audit_admin_open(p_page text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return; end if;
  if exists (select 1 from public.audit_log a where a.action = 'admin.open' and a.actor = auth.uid() and a.at > now() - interval '10 minutes') then return; end if;
  perform public.audit_write('admin.open', 'admin', auth.uid()::text, jsonb_build_object('page', left(coalesce(p_page, ''), 120)));
end $$;
revoke all on function public.audit_admin_open(text) from public, anon;
grant execute on function public.audit_admin_open(text) to authenticated;

-- the trigger that feeds the log from every safety table
create or replace function public.audit_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_action text; v_id text; v_payload jsonb; v_kind text := tg_table_name;
begin
  if tg_table_name = 'reports' then
    v_id := new.id::text;
    if tg_op = 'INSERT' then
      v_action := 'report.create';
      v_payload := jsonb_build_object('reporter', new.reporter, 'reported', new.reported, 'target_kind', new.target_kind, 'target_id', new.target_id, 'category', new.category, 'details', left(new.details, 500), 'evidence_sha256', encode(sha256(convert_to(coalesce(new.evidence::text, ''), 'UTF8')), 'hex'));
    else
      if new.status is not distinct from old.status and new.resolved is not distinct from old.resolved then return new; end if;
      v_action := 'report.' || coalesce(new.status, case when new.resolved then 'resolved' else 'update' end);
      v_payload := jsonb_build_object('status', new.status, 'resolved', new.resolved, 'reviewed_by', new.reviewed_by, 'reported', new.reported, 'target_kind', new.target_kind, 'target_id', new.target_id);
    end if;
  elsif tg_table_name = 'mod_evidence' then
    v_id := new.id::text;
    if tg_op = 'INSERT' then v_action := 'evidence.preserve';
      v_payload := jsonb_build_object('user_id', new.user_id, 'kind', new.kind, 'target_id', new.target_id, 'hold', new.hold, 'note', left(new.note, 500), 'created_by', new.created_by, 'snapshot_sha256', encode(sha256(convert_to(coalesce(new.snapshot::text, ''), 'UTF8')), 'hex'));
    else v_action := 'evidence.update';
      v_payload := jsonb_build_object('user_id', new.user_id, 'hold', new.hold, 'ncmec_report_id', new.ncmec_report_id, 'note', left(new.note, 500), 'snapshot_changed', new.snapshot is distinct from old.snapshot);
    end if;
  elsif tg_table_name = 'member_safety' then
    v_id := new.user_id::text;
    if tg_op = 'INSERT' then v_action := 'safety.create';
      v_payload := jsonb_build_object('dob', new.dob, 'dob_source', new.dob_source, 'restricted', new.restricted, 'held', new.held, 'banned', new.banned, 'flagged', new.flagged, 'reasons', array_remove(array[new.restricted_reason, new.held_reason, new.banned_reason], null));
    else
      v_payload := '{}'::jsonb;
      if new.dob is distinct from old.dob then v_payload := v_payload || jsonb_build_object('dob', jsonb_build_object('from', old.dob, 'to', new.dob, 'source', new.dob_source)); end if;
      if new.restricted is distinct from old.restricted then v_payload := v_payload || jsonb_build_object('restricted', new.restricted, 'restricted_reason', new.restricted_reason); end if;
      if new.held is distinct from old.held then v_payload := v_payload || jsonb_build_object('held', new.held, 'held_reason', new.held_reason); end if;
      if new.banned is distinct from old.banned then v_payload := v_payload || jsonb_build_object('banned', new.banned, 'banned_reason', new.banned_reason); end if;
      if new.flagged is distinct from old.flagged then v_payload := v_payload || jsonb_build_object('flagged', new.flagged); end if;
      if v_payload = '{}'::jsonb then return new; end if;
      v_action := case when v_payload ? 'banned' then 'safety.ban' when v_payload ? 'held' then 'safety.hold' when v_payload ? 'restricted' then 'safety.restrict' when v_payload ? 'dob' then 'safety.dob' else 'safety.update' end;
    end if;
  elsif tg_table_name = 'media_items' then
    v_id := new.id::text;
    if tg_op = 'INSERT' then
      if new.status = 'ok' then return new; end if;
      v_action := 'media.flag'; v_payload := jsonb_build_object('user_id', new.user_id, 'bucket', new.bucket, 'path', new.path, 'status', new.status, 'reason', new.reason, 'scores', new.scores);
    else
      if new.status is not distinct from old.status then return new; end if;
      v_action := 'media.status'; v_payload := jsonb_build_object('user_id', new.user_id, 'bucket', new.bucket, 'path', new.path, 'from', old.status, 'to', new.status, 'reason', new.reason, 'reviewed_by', new.reviewed_by);
    end if;
  elsif tg_table_name in ('feed_posts', 'feed_comments', 'messages', 'hub_requests') then
    if new.mod_status is not distinct from old.mod_status then return new; end if;
    v_id := new.id::text; v_action := 'content.mod_status';
    v_payload := jsonb_build_object('from', old.mod_status, 'to', new.mod_status);
  elsif tg_table_name = 'profiles' then
    v_id := old.id::text; v_action := 'profile.delete'; v_payload := jsonb_build_object('username', old.username);
    perform public.audit_write(v_action, v_kind, v_id, v_payload);
    return old;
  elsif tg_table_name = 'safety_incidents' then
    v_id := new.id::text; v_action := case when tg_op = 'INSERT' then 'incident.open' else 'incident.update' end;
    v_payload := jsonb_build_object('kind', new.kind, 'user_id', new.user_id, 'media_id', new.media_id, 'status', new.status, 'ncmec_report_id', new.ncmec_report_id, 'evidence_id', new.evidence_id);
  elsif tg_table_name = 'media_hashes' then
    v_id := new.sha256; v_action := 'hash.add'; v_payload := jsonb_build_object('label', new.label, 'source', new.source);
  elsif tg_table_name = 'safety_settings' then
    v_id := new.key; v_action := 'settings.set'; v_payload := jsonb_build_object('value', case when new.secret then '"(secret)"'::jsonb else new.value end);
  else
    return new;
  end if;
  perform public.audit_write(v_action, v_kind, v_id, v_payload);
  return new;
end $$;
revoke all on function public.audit_tg() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['reports', 'mod_evidence', 'member_safety', 'media_items', 'safety_settings'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_v27 on public.%I', t);
      execute format('create trigger audit_v27 after insert or update on public.%I for each row execute function public.audit_tg()', t);
    end if;
  end loop;
  foreach t in array array['feed_posts', 'feed_comments', 'messages', 'hub_requests'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_v27 on public.%I', t);
      execute format('create trigger audit_v27 after update of mod_status on public.%I for each row execute function public.audit_tg()', t);
    end if;
  end loop;
  execute 'drop trigger if exists audit_v27 on public.profiles';
  execute 'create trigger audit_v27 after delete on public.profiles for each row execute function public.audit_tg()';
end $$;

-- settings writer (admin from the app, or the SQL editor where auth.uid() is null)
create or replace function public.safety_set_setting(k text, v jsonb, p_secret boolean default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  if k !~ '^[a-z0-9_]{1,60}$' then raise exception 'bad key'; end if;
  insert into public.safety_settings (key, value, secret, updated_at, updated_by) values (k, coalesce(v, 'null'::jsonb), coalesce(p_secret, false), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, secret = coalesce(p_secret, public.safety_settings.secret), updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.safety_set_setting(text, jsonb, boolean) from public, anon;
grant execute on function public.safety_set_setting(text, jsonb, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3 · media: hash blocklist, incidents, scanner result, storage intake, read gating
-- ─────────────────────────────────────────────────────────────
create table if not exists public.media_hashes (
  sha256 text primary key,
  phash text,                 -- 64-bit dHash (hex) from the scanner, for near-duplicate matching
  pdq text,                   -- reserved: PDQ 256-bit hex (NCMEC / Meta hash lists)
  photodna text,              -- reserved: PhotoDNA (Microsoft, licence required)
  label text not null default 'csam' check (label in ('csam', 'nsfw', 'banned')),
  source text not null default 'internal',   -- internal | ncmec | hive | manual
  note text,
  added_by uuid,
  added_at timestamptz default now());
create index if not exists media_hashes_phash_v27 on public.media_hashes (phash) where phash is not null;
alter table public.media_hashes enable row level security;
revoke all on public.media_hashes from anon, authenticated;
-- no policies: the service role (scanner) and SQL editor read it; admins add through mod_block_hash()

create table if not exists public.safety_incidents (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  kind text not null,                 -- csam_suspect | hash_match | nsfw | manual
  user_id uuid,                       -- no FK: outlives the account
  media_id bigint,
  evidence_id bigint,
  status text not null default 'open',   -- open | reported_ncmec | law_enforcement | closed
  ncmec_report_id text,
  details jsonb,
  updated_at timestamptz default now(),
  updated_by uuid);
create index if not exists safety_incidents_status_v27 on public.safety_incidents (status, created_at desc);
alter table public.safety_incidents enable row level security;
revoke all on public.safety_incidents from anon;
drop policy if exists "v27 incidents admin read" on public.safety_incidents;
create policy "v27 incidents admin read" on public.safety_incidents for select using (public.is_admin());
drop policy if exists "v27 incidents admin update" on public.safety_incidents;
create policy "v27 incidents admin update" on public.safety_incidents for update using (public.is_admin()) with check (public.is_admin());
do $$ begin
  execute 'drop trigger if exists audit_v27 on public.safety_incidents';
  execute 'create trigger audit_v27 after insert or update on public.safety_incidents for each row execute function public.audit_tg()';
  execute 'drop trigger if exists audit_v27 on public.media_hashes';
  execute 'create trigger audit_v27 after insert on public.media_hashes for each row execute function public.audit_tg()';
end $$;

alter table public.media_items add column if not exists sha256 text;
alter table public.media_items add column if not exists phash text;
alter table public.media_items add column if not exists scan jsonb;
alter table public.media_items add column if not exists scanned_at timestamptz;
alter table public.media_items add column if not exists scanner text;
alter table public.media_items add column if not exists incident_id bigint;
create index if not exists media_items_sha256_v27 on public.media_items (sha256) where sha256 is not null;
create index if not exists media_items_user_v27 on public.media_items (user_id, created_at desc);

-- admin: add a hash to the blocklist (e.g. after a confirmed incident) and retro-check existing uploads
create or replace function public.mod_block_hash(p_sha256 text, p_label text default 'csam', p_note text default null, p_phash text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'sha256 must be 64 hex chars'; end if;
  insert into public.media_hashes (sha256, phash, label, source, note, added_by) values (p_sha256, p_phash, p_label, 'manual', p_note, auth.uid())
  on conflict (sha256) do update set label = excluded.label, note = coalesce(excluded.note, public.media_hashes.note), phash = coalesce(excluded.phash, public.media_hashes.phash);
  update public.media_items set status = case when p_label = 'csam' then 'csam_suspect' else 'pending' end, reason = 'hash blocklist (' || p_label || ')'
   where sha256 = p_sha256 and status = 'ok';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mod_block_hash(text, text, text, text) from public, anon;
grant execute on function public.mod_block_hash(text, text, text, text) to authenticated;

-- the evidence snapshot builder (admin RPC and the scanner both use it)
create or replace function public.safety_snapshot(p_user uuid, p_kind text default null, p_id text default null) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_snap jsonb := jsonb_build_object('taken_at', now(), 'sql', 27); v_target jsonb;
begin
  begin
    select jsonb_build_object('id', u.id, 'email', u.email, 'phone', u.phone, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                              'email_confirmed_at', u.email_confirmed_at, 'user_metadata', u.raw_user_meta_data)
      into v_target from auth.users u where u.id = p_user;
    v_snap := v_snap || jsonb_build_object('account', v_target);
  exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('profile', (select to_jsonb(p) from public.profiles p where p.id = p_user)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('safety', (select to_jsonb(s) from public.member_safety s where s.user_id = p_user)); exception when others then null; end;
  begin
    v_snap := v_snap || jsonb_build_object('sign_ins', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select a.created_at, a.ip_address, a.payload->>'action' as action from auth.audit_log_entries a
       where a.payload->>'actor_id' = p_user::text order by a.created_at desc limit 50) x));
  exception when others then null; end;
  begin
    if p_kind = 'post' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.feed_posts t where t.id = p_id::bigint));
    elsif p_kind = 'comment' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.feed_comments t where t.id = p_id::bigint));
    elsif p_kind = 'dm' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.messages t where t.id = p_id::bigint));
    elsif p_kind = 'hub' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.hub_requests t where t.id = p_id::bigint));
    elsif p_kind = 'media' and p_id ~ '^\d+$' then v_snap := v_snap || jsonb_build_object('item', (select to_jsonb(t) from public.media_items t where t.id = p_id::bigint));
    end if;
  exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('media', (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]'::jsonb) from (select * from public.media_items where user_id = p_user order by created_at desc limit 200) m)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('storage_objects', (select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name, 'created_at', o.created_at)), '[]'::jsonb) from (select * from storage.objects where name like p_user::text || '/%' order by created_at desc limit 500) o)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('reports', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reports r where r.reported = p_user)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('recent_dms_sent', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from (select id, recipient, room, body, created_at from public.messages where sender = p_user order by created_at desc limit 200) m)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('recent_posts', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from (select * from public.feed_posts where user_id = p_user order by created_at desc limit 100) m)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('recent_comments', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from (select * from public.feed_comments where user_id = p_user order by created_at desc limit 100) m)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('connections', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from (select * from public.connections where requester = p_user or addressee = p_user limit 500) c)); exception when others then null; end;
  begin v_snap := v_snap || jsonb_build_object('push_subscriptions', (select coalesce(jsonb_agg(jsonb_build_object('endpoint_host', split_part(split_part(ps.endpoint, '://', 2), '/', 1), 'ua', ps.ua, 'created_at', ps.created_at)), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = p_user)); exception when others then null; end;
  return v_snap;
end $$;
revoke all on function public.safety_snapshot(uuid, text, text) from public, anon, authenticated;

-- admin RPC (same signature as v26) now built on safety_snapshot()
create or replace function public.mod_preserve_evidence(p_user uuid, p_kind text default null, p_id text default null, p_note text default null) returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.mod_evidence (created_by, user_id, kind, target_id, snapshot, hold, note)
    values (auth.uid(), p_user, p_kind, p_id, public.safety_snapshot(p_user, p_kind, p_id), true, p_note) returning id into v_id;
  if p_user is not null and p_user <> public.founder_id() then perform public.safety_hold_user(p_user, 'evidence preserved'); end if;
  return v_id;
end $$;
revoke all on function public.mod_preserve_evidence(uuid, text, text, text) from public, anon;
grant execute on function public.mod_preserve_evidence(uuid, text, text, text) to authenticated;

-- is this request the service role (Edge Function) or the SQL editor?
create or replace function public.safety_is_service() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role text;
begin
  begin v_role := nullif(current_setting('request.jwt.claim.role', true), ''); exception when others then v_role := null; end;
  if v_role is null then begin v_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'; exception when others then v_role := null; end; end if;
  -- service role key (Edge Function), or a session with no JWT at all (SQL editor, pg_cron). A member's JWT is never "service".
  return coalesce(v_role, current_user::text) = 'service_role' or (v_role is null and auth.uid() is null and current_user not in ('anon', 'authenticated'));
end $$;
revoke all on function public.safety_is_service() from public, anon, authenticated;

-- the scanner's verdict. p_result: { verdict: 'ok'|'nsfw'|'csam'|'error', sha256, phash, provider, scores, matched: [sha256…], note }
create or replace function public.media_scan_result(p_media bigint, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare m public.media_items%rowtype; v_verdict text := lower(coalesce(p_result->>'verdict', 'error')); v_sha text := p_result->>'sha256'; v_ph text := p_result->>'phash';
        v_ev bigint; v_inc bigint; v_status text; v_blocked public.media_hashes%rowtype; v_qpath text;
begin
  if not (public.safety_is_service() or public.is_admin()) then raise exception 'service role only'; end if;
  select * into m from public.media_items where id = p_media;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'no such media'); end if;
  -- hash blocklist check (done here too, so a manual re-scan or a new list entry is honoured)
  if v_sha ~ '^[0-9a-f]{64}$' then
    select * into v_blocked from public.media_hashes h where h.sha256 = v_sha;
    if v_blocked.sha256 is not null then v_verdict := case when v_blocked.label = 'csam' then 'csam' else 'nsfw' end; p_result := p_result || jsonb_build_object('hash_match', v_blocked.label, 'hash_source', v_blocked.source); end if;
  end if;
  if v_blocked.sha256 is null and v_ph ~ '^[0-9a-f]{16}$' then
    select * into v_blocked from public.media_hashes h where h.phash = v_ph and h.label = 'csam' limit 1;
    if v_blocked.sha256 is not null then v_verdict := 'csam'; p_result := p_result || jsonb_build_object('hash_match', 'csam-phash', 'hash_source', v_blocked.source); end if;
  end if;
  v_status := case v_verdict when 'ok' then 'ok' when 'nsfw' then 'pending' when 'csam' then 'csam_suspect' else coalesce(nullif(m.status, 'ok'), 'pending') end;
  -- a scan error must not publish: keep it pending for a human if the flag requires server scans, else leave as is
  if v_verdict not in ('ok', 'nsfw', 'csam') and not public.safety_flag('server_scan_required') then v_status := m.status; end if;
  update public.media_items set status = v_status, sha256 = coalesce(v_sha, sha256), phash = coalesce(v_ph, phash), scan = p_result, scanned_at = now(),
         scanner = coalesce(p_result->>'provider', 'media-scan'), reason = case when v_verdict = 'ok' then reason else coalesce(p_result->>'note', v_verdict) end
   where id = p_media;
  if v_verdict in ('nsfw', 'csam') then
    -- the public object moves to the private quarantine bucket: the Edge Function does the byte copy (service role);
    -- here we make sure the row points at quarantine when the function reports it did (moved: true)
    if coalesce((p_result->>'moved')::boolean, false) then
      v_qpath := coalesce(p_result->>'quarantine_path', m.path);
      update public.media_items set bucket = 'quarantine', path = v_qpath where id = p_media;
    end if;
  end if;
  if v_verdict = 'csam' then
    insert into public.mod_evidence (created_by, user_id, kind, target_id, snapshot, hold, note)
      values (null, m.user_id, 'media', m.id::text, public.safety_snapshot(m.user_id, 'media', m.id::text) || jsonb_build_object('scan', p_result), true, 'automatic: CSAM-class classifier / hash match')
      returning id into v_ev;
    insert into public.safety_incidents (kind, user_id, media_id, evidence_id, status, details)
      values (case when p_result ? 'hash_match' then 'hash_match' else 'csam_suspect' end, m.user_id, m.id, v_ev, 'open', p_result) returning id into v_inc;
    update public.media_items set incident_id = v_inc where id = p_media;
    if m.user_id is not null and m.user_id <> public.founder_id() then perform public.safety_hold_user(m.user_id, 'automatic hold: CSAM-class media scan'); end if;
    perform public.notify(public.founder_id(), 'mod', '🚨 CSAM-class upload detected · incident #' || v_inc, 'Account held, evidence preserved, file quarantined. Open Admin → Moderation, then report to NCMEC (SAFETY-RUNBOOK.md).', '/?v=admin&what=mod', null);
  elsif v_verdict = 'nsfw' then
    perform public.notify(public.founder_id(), 'mod', '🔞 Upload held for review (media #' || m.id || ')', left(coalesce(p_result->>'note', 'nudity / sexual content'), 180), '/?v=admin&what=mod', null);
  end if;
  return jsonb_build_object('ok', true, 'media_id', m.id, 'status', v_status, 'incident_id', v_inc, 'evidence_id', v_ev);
end $$;
revoke all on function public.media_scan_result(bigint, jsonb) from public, anon;
grant execute on function public.media_scan_result(bigint, jsonb) to authenticated, service_role;

-- intake: when the flag is on, every new upload row starts 'pending' (hidden from others) until the scanner clears it
create or replace function public.safety_media_intake() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bucket <> 'quarantine' and public.safety_flag('server_scan_required') and not public.is_admin() and not public.safety_is_service() then
    new.status := 'pending';
    new.reason := case when coalesce(new.reason, '') = '' then 'awaiting server scan' else new.reason || ' · awaiting server scan' end;
  end if;
  return new;
end $$;
drop trigger if exists safety_media_intake_v27 on public.media_items;
create trigger safety_media_intake_v27 before insert on public.media_items for each row execute function public.safety_media_intake();

-- webhook to the scanner (pg_net), when media_scan_url is set. Also works through Database → Webhooks in the dashboard.
create or replace function public.safety_media_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'media_scan_url';
  if v_url is null or v_url = '' or to_regnamespace('net') is null then return new; end if;
  select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
  begin
    execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 8000)',
      v_url,
      jsonb_build_object('type', tg_op, 'table', 'media_items', 'record', to_jsonb(new)),
      jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, '')));
  exception when others then raise warning 'media webhook: %', sqlerrm; end;
  return new;
end $$;
drop trigger if exists safety_media_webhook_v27 on public.media_items;
create trigger safety_media_webhook_v27 after insert on public.media_items for each row execute function public.safety_media_webhook();

-- storage intake: every object in posts / conference gets a media_items row even if the uploader bypassed the app
create or replace function public.safety_storage_intake() returns trigger
language plpgsql security definer set search_path = public, storage as $$
declare v_uid uuid; v_folder text; v_url text;
begin
  if new.bucket_id not in ('posts', 'conference') then return new; end if;
  v_folder := (storage.foldername(new.name))[1];
  begin v_uid := v_folder::uuid; exception when others then v_uid := null; end;
  v_url := 'https://izfccjaznlcffvjxawya.supabase.co/storage/v1/object/public/' || new.bucket_id || '/' || new.name;
  begin
    insert into public.media_items (user_id, bucket, path, url, mime, kind, surface, status, reason)
      values (v_uid, new.bucket_id, new.name, v_url, coalesce(new.metadata->>'mimetype', null),
              case when coalesce(new.metadata->>'mimetype', '') like 'image/%' then 'image' when coalesce(new.metadata->>'mimetype', '') like 'video/%' then 'video' else 'file' end,
              'storage', 'ok', 'storage intake')
    on conflict (bucket, path) do nothing;
  exception when others then raise warning 'storage intake: %', sqlerrm; end;
  return new;
end $$;
do $$ begin
  execute 'drop trigger if exists safety_storage_intake_v27 on storage.objects';
  execute 'create trigger safety_storage_intake_v27 after insert on storage.objects for each row execute function public.safety_storage_intake()';
exception when others then raise warning 'storage trigger not installed (%). Uploads that bypass the app stay invisible anyway (see safety_media_clear).', sqlerrm; end $$;

-- backfill: every existing public object gets a row, so the "must have a row" rule below hides nothing that is already live
do $$ begin
  insert into public.media_items (user_id, bucket, path, url, status, reason, surface)
    select case when (storage.foldername(o.name))[1] ~ '^[0-9a-f-]{36}$' then (storage.foldername(o.name))[1]::uuid end, o.bucket_id, o.name,
           'https://izfccjaznlcffvjxawya.supabase.co/storage/v1/object/public/' || o.bucket_id || '/' || o.name, 'ok', 'backfill v27', 'storage'
      from storage.objects o where o.bucket_id in ('posts', 'conference')
    on conflict (bucket, path) do nothing;
exception when others then raise warning 'v27 media backfill: %', sqlerrm; end $$;

-- percent-decoding (getPublicUrl encodes file names; storage.objects.name is raw)
create or replace function public.safety_urldecode(s text) returns text
language plpgsql immutable as $$
declare o bytea := ''::bytea; i int := 1; n int; c text;
begin
  if s is null or position('%' in s) = 0 then return s; end if;
  n := length(s);
  while i <= n loop
    c := substr(s, i, 1);
    if c = '%' and i + 2 <= n and substr(s, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then o := o || decode(substr(s, i + 1, 2), 'hex'); i := i + 3;
    else o := o || convert_to(c, 'UTF8'); i := i + 1; end if;
  end loop;
  begin return convert_from(o, 'UTF8'); exception when others then return s; end;
end $$;

-- is every media URL in this list clear to show? Our own storage URLs need a media_items row with status 'ok';
-- anything pending / removed / quarantined / csam_suspect (or missing) hides the item from everyone but its author.
create or replace function public.safety_media_clear(m jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e jsonb; u text; urls text[] := '{}'; pub constant text := 'https://izfccjaznlcffvjxawya.supabase.co/storage/v1/object/public/';
begin
  if m is null or m = 'null'::jsonb then return true; end if;
  if jsonb_typeof(m) = 'string' then urls := array[m #>> '{}'];
  elsif jsonb_typeof(m) = 'array' then
    for e in select * from jsonb_array_elements(m) loop
      u := case jsonb_typeof(e) when 'string' then e #>> '{}' when 'object' then coalesce(e->>'url', e->>'src') else null end;
      if u is not null then urls := urls || u; end if;
    end loop;
  else return true; end if;
  urls := array(select split_part(x, '?', 1) from unnest(urls) x where x like pub || '%');
  if coalesce(array_length(urls, 1), 0) = 0 then return true; end if;
  return not exists (
    select 1 from unnest(urls) x
     where not exists (select 1 from public.media_items mi where (mi.url = x or mi.url = public.safety_urldecode(x)) and mi.status = 'ok'));
end $$;
grant execute on function public.safety_media_clear(jsonb) to anon, authenticated;

drop policy if exists "v27 media must be clear" on public.feed_posts;
create policy "v27 media must be clear" on public.feed_posts as restrictive for select to public
  using (auth.uid() = user_id or public.is_admin() or media is null or public.safety_media_clear(to_jsonb(media)));
drop policy if exists "v27 media must be clear" on public.feed_comments;
create policy "v27 media must be clear" on public.feed_comments as restrictive for select to public
  using (auth.uid() = user_id or public.is_admin() or media is null or public.safety_media_clear(to_jsonb(media)));
drop policy if exists "v27 media must be clear" on public.hub_requests;
create policy "v27 media must be clear" on public.hub_requests as restrictive for select to public
  using (auth.uid() = from_user or public.is_admin() or media is null or public.safety_media_clear(to_jsonb(media)));

-- v26's mod_set_content gains the csam_suspect state (admin can clear a false positive back to 'ok')
create or replace function public.mod_set_content(p_kind text, p_id text, p_status text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_status not in ('ok', 'hidden', 'removed') then raise exception 'bad status'; end if;
  if p_id !~ '^\d+$' then raise exception 'bad id'; end if;
  v_id := p_id::bigint;
  if p_kind = 'post' then update public.feed_posts set mod_status = p_status where id = v_id;
  elsif p_kind = 'comment' then update public.feed_comments set mod_status = p_status where id = v_id;
  elsif p_kind = 'dm' then update public.messages set mod_status = p_status where id = v_id;
  elsif p_kind = 'hub' then update public.hub_requests set mod_status = p_status where id = v_id;
  elsif p_kind = 'media' then update public.media_items set status = case p_status when 'ok' then 'ok' when 'hidden' then 'pending' else 'removed' end, reviewed_by = auth.uid(), reviewed_at = now(), reason = coalesce(p_note, reason) where id = v_id;
  else raise exception 'unknown kind %', p_kind; end if;
  update public.reports set status = case when p_status = 'ok' then 'dismissed' else 'actioned' end, resolved = true, reviewed_by = auth.uid(), reviewed_at = now()
   where target_kind = p_kind and target_id = p_id and coalesce(status, 'open') = 'open';
  return p_kind || ' ' || p_id || ' → ' || p_status;
end $$;

-- admin: close / annotate an incident (NCMEC report id)
create or replace function public.mod_incident(p_id bigint, p_status text, p_ncmec text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_status not in ('open', 'reported_ncmec', 'law_enforcement', 'closed') then raise exception 'bad status'; end if;
  update public.safety_incidents set status = p_status, ncmec_report_id = coalesce(p_ncmec, ncmec_report_id),
         details = coalesce(details, '{}'::jsonb) || case when p_note is null then '{}'::jsonb else jsonb_build_object('note_' || to_char(now(), 'YYYYMMDDHH24MI'), left(p_note, 1000)) end,
         updated_at = now(), updated_by = auth.uid()
   where id = p_id;
  if p_ncmec is not null then update public.mod_evidence set ncmec_report_id = p_ncmec where id = (select evidence_id from public.safety_incidents where id = p_id) and ncmec_report_id is null; end if;
end $$;
revoke all on function public.mod_incident(bigint, text, text, text) from public, anon;
grant execute on function public.mod_incident(bigint, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4 · self-serve account deletion
-- ─────────────────────────────────────────────────────────────
alter table public.member_safety add column if not exists delete_requested_at timestamptz;

create or replace function public.delete_my_account(p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, storage as $$
declare uid uuid := auth.uid(); v_email text; v_user text; v_pages int := 0; v_hold boolean;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if uid = public.founder_id() then raise exception 'The founder account cannot delete itself here.'; end if;
  select exists (select 1 from public.mod_evidence e where e.user_id = uid and e.hold) or exists (select 1 from public.safety_incidents i where i.user_id = uid and i.status <> 'closed') into v_hold;
  select lower(email) into v_email from auth.users where id = uid;
  select username into v_user from public.profiles where id = uid;
  if v_hold then
    insert into public.member_safety (user_id, delete_requested_at) values (uid, now())
      on conflict (user_id) do update set delete_requested_at = coalesce(public.member_safety.delete_requested_at, now()), updated_at = now();
    perform public.audit_write('account.delete_queued', 'user', uid::text, jsonb_build_object('email_sha256', encode(sha256(convert_to(coalesce(v_email, ''), 'UTF8')), 'hex'), 'username', v_user, 'reason', left(p_reason, 300)));
    perform public.notify(public.founder_id(), 'mod', 'Deletion request on a held account', 'A member with evidence on hold asked to delete their account. It is queued until the hold is released (Admin → Moderation).', '/?v=admin&what=mod', null);
    return jsonb_build_object('deleted', false, 'queued', true, 'message', 'Your request is recorded. This account is under review, so the deletion completes when the review closes. Nothing you post can be seen meanwhile.');
  end if;
  -- the audit row first (the chain proves the member asked)
  perform public.audit_write('account.delete', 'user', uid::text, jsonb_build_object('email_sha256', encode(sha256(convert_to(coalesce(v_email, ''), 'UTF8')), 'hex'), 'username', v_user, 'reason', left(p_reason, 300)));
  -- Brand pages survive for their other managers (owner → founder)
  begin update public.pages set owner_id = public.founder_id() where owner_id = uid; get diagnostics v_pages = row_count; update public.pages set admins = array_remove(admins, uid) where uid = any(admins); exception when others then null; end;
  -- content (each step independent; missing tables are skipped)
  begin delete from public.feed_reactions where user_id = uid; exception when others then null; end;
  begin delete from public.feed_saves where user_id = uid; exception when others then null; end;
  begin delete from public.feed_comments where user_id = uid; exception when others then null; end;
  begin delete from public.feed_posts where user_id = uid; exception when others then null; end;
  begin delete from public.posts where author = uid; exception when others then null; end;
  begin delete from public.hugs where from_id = uid or to_id = uid; exception when others then null; end;
  begin delete from public.messages where sender = uid; exception when others then null; end;
  begin delete from public.hub_requests where from_user = uid; exception when others then null; end;
  begin delete from public.meeting_requests where from_user = uid or to_user = uid; exception when others then null; end;
  begin delete from public.hub_messages where user_id = uid; exception when others then null; end;
  begin delete from public.event_rsvps where user_id = uid; exception when others then null; end;
  begin delete from public.circle_members where owner_id = uid or member_id = uid; exception when others then null; end;
  begin delete from public.circles where owner_id = uid; exception when others then null; end;
  begin delete from public.connections where requester = uid or addressee = uid; exception when others then null; end;
  begin delete from public.lifeboards where id = uid; exception when others then null; end;
  begin delete from public.push_subscriptions where user_id = uid; exception when others then null; end;
  begin delete from public.notifications where user_id = uid or actor = uid; exception when others then null; end;
  begin delete from public.presence where user_id = uid; exception when others then null; end;
  begin delete from public.page_follows where user_id = uid; exception when others then null; end;
  begin delete from public.wishes where user_id = uid; exception when others then null; end;
  begin delete from public.match_posts where user_id = uid; exception when others then null; end;
  begin delete from public.media_items where user_id = uid and status = 'ok'; exception when others then null; end;
  -- storage rows for the member's folders (the client removes the files through the Storage API first; this catches leftovers)
  begin delete from storage.objects where bucket_id in ('posts', 'conference') and name like uid::text || '/%'; exception when others then null; end;
  -- profile: anonymize, then remove (the auth delete cascades too)
  begin update public.profiles set display_name = 'Deleted member', username = 'deleted-' || left(uid::text, 8), bio = null, city = null, looking_for = null, attractor = null, avatar = '{}'::jsonb, home = '{}'::jsonb, blocked = '{}'::uuid[], paths = '{}', causes = '{}' where id = uid; exception when others then null; end;
  begin delete from public.profiles where id = uid; exception when others then null; end;
  begin delete from public.member_safety where user_id = uid; exception when others then null; end;
  delete from auth.users where id = uid;
  return jsonb_build_object('deleted', true, 'queued', false, 'pages_moved', v_pages, 'message', 'Your account and sign-in are deleted.');
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- admin: a queued deletion completes when the hold is released
create or replace function public.mod_release_and_delete(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if exists (select 1 from public.safety_incidents i where i.user_id = p_user and i.status <> 'closed') then raise exception 'Close the open incident first (mod_incident).'; end if;
  update public.mod_evidence set hold = false where user_id = p_user and hold;
  perform public.audit_write('account.delete_by_admin', 'user', p_user::text, jsonb_build_object('after_hold', true));
  return public.admin_delete_user(p_user);
end $$;
revoke all on function public.mod_release_and_delete(uuid) from public, anon;
grant execute on function public.mod_release_and_delete(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5 · Realtime authorization (private channels)
-- ─────────────────────────────────────────────────────────────
create or replace function public.rt_topic_allowed(t text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); parts text[]; other uuid;
begin
  if uid is null or t is null then return false; end if;
  if public.is_admin() then return true; end if;
  if t = 'world' or t like 'pos-%' or t like 'voice-%' or t like 'meet:%' or t like 'room:%' then return public.safety_is_adult(uid); end if;
  if t like 'dm:%' then
    parts := string_to_array(substr(t, 4), ':');
    if coalesce(array_length(parts, 1), 0) <> 2 or not (uid::text = any(parts)) then return false; end if;
    begin other := (case when parts[1] = uid::text then parts[2] else parts[1] end)::uuid; exception when others then return false; end;
    return public.safety_is_adult(uid) and public.safety_is_adult(other) and not public.safety_blocked(other, uid) and not public.safety_blocked(uid, other);
  end if;
  if t like 'u:' || uid::text || '%' then return true; end if;
  return false;
end $$;
revoke all on function public.rt_topic_allowed(text) from public, anon;
grant execute on function public.rt_topic_allowed(text) to authenticated;

do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "v27 rt adults read" on realtime.messages';
    execute 'create policy "v27 rt adults read" on realtime.messages for select to authenticated using (public.rt_topic_allowed(realtime.topic()))';
    execute 'drop policy if exists "v27 rt adults write" on realtime.messages';
    execute 'create policy "v27 rt adults write" on realtime.messages for insert to authenticated with check (public.rt_topic_allowed(realtime.topic()))';
  else
    raise notice 'realtime.messages not present here; private-channel policies skipped (Supabase has it).';
  end if;
exception when others then raise warning 'realtime policies: %', sqlerrm; end $$;

-- ─────────────────────────────────────────────────────────────
-- 6 · profile text guard (usernames + tags)
-- ─────────────────────────────────────────────────────────────
create or replace function public.safety_profile_text_guard() returns trigger
language plpgsql set search_path = public as $$
declare clean constant text := '[\x01-\x08\x0B\x0C\x0E-\x1F]';
begin
  -- an upsert on an existing profile (the sign-in path) must never fail or rename: validate real changes only
  if tg_op = 'INSERT' and exists (select 1 from public.profiles p where p.id = new.id) then return new; end if;
  if tg_op = 'INSERT' or new.username is distinct from old.username then
    if new.username is not null then
      new.username := lower(btrim(new.username));
      if new.username !~ '^[a-z0-9_.-]{1,20}$' then raise exception 'Usernames can use letters, numbers, dots, dashes and underscores (up to 20).'; end if;
    end if;
  end if;
  if tg_op = 'INSERT' or new.display_name is distinct from old.display_name then
    new.display_name := left(regexp_replace(translate(coalesce(new.display_name, 'Someone'), '<>', '‹›'), clean, '', 'g'), 60);
    if btrim(new.display_name) = '' then new.display_name := 'Someone'; end if;
  end if;
  if tg_op = 'INSERT' or new.bio is distinct from old.bio then new.bio := left(regexp_replace(translate(new.bio, '<>', '‹›'), clean, '', 'g'), 2000); end if;
  if tg_op = 'INSERT' or new.city is distinct from old.city then new.city := left(regexp_replace(translate(new.city, '<>', '‹›'), clean, '', 'g'), 80); end if;
  if tg_op = 'INSERT' or new.looking_for is distinct from old.looking_for then new.looking_for := left(translate(new.looking_for, '<>', '‹›'), 300); end if;
  if tg_op = 'INSERT' or new.attractor is distinct from old.attractor then new.attractor := left(translate(new.attractor, '<>', '‹›'), 300); end if;
  return new;
end $$;
drop trigger if exists safety_profile_text_guard_v27 on public.profiles;
create trigger safety_profile_text_guard_v27 before insert or update on public.profiles for each row execute function public.safety_profile_text_guard();

-- ─────────────────────────────────────────────────────────────
-- 7 · evidence export bundle (NCMEC / law enforcement)
-- ─────────────────────────────────────────────────────────────
create or replace function public.mod_evidence_bundle(p_user uuid, p_incident bigint default null) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare b jsonb; t text; h text; v_id bigint;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  b := jsonb_build_object(
    'bundle', 'allofus.one evidence export', 'format', 1, 'generated_at', now(), 'generated_by', auth.uid(), 'subject_user', p_user, 'incident_id', p_incident,
    'current', public.safety_snapshot(p_user),
    'evidence', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb) from public.mod_evidence e where e.user_id = p_user),
    'incidents', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) from public.safety_incidents i where i.user_id = p_user or i.id = p_incident),
    'reports_about', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.reports r where r.reported = p_user),
    'media', (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb) from public.media_items m where m.user_id = p_user),
    'hidden_content', jsonb_build_object(
       'posts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.feed_posts x where x.user_id = p_user and x.mod_status <> 'ok'),
       'comments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.feed_comments x where x.user_id = p_user and x.mod_status <> 'ok'),
       'dms', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.messages x where x.sender = p_user and x.mod_status <> 'ok')),
    'audit_trail', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) from (
        select * from public.audit_log a where a.actor = p_user or a.target_id = p_user::text or a.payload::text like '%' || p_user::text || '%' order by a.id limit 5000) a),
    'audit_chain_check', public.audit_verify(0, 200000));
  t := b::text;
  h := encode(sha256(convert_to(t, 'UTF8')), 'hex');
  v_id := public.audit_write('evidence.export', 'user', p_user::text, jsonb_build_object('incident_id', p_incident, 'sha256', h, 'bytes', length(t)));
  return jsonb_build_object('text', t, 'sha256', h, 'audit_id', v_id);
end $$;
revoke all on function public.mod_evidence_bundle(uuid, bigint) from public, anon;
grant execute on function public.mod_evidence_bundle(uuid, bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8 · lockdown odds and ends
-- ─────────────────────────────────────────────────────────────
do $$ begin
  begin execute 'revoke all on function public.claim_my_pages() from public, anon'; execute 'grant execute on function public.claim_my_pages() to authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.admin_stats(int) from public, anon'; execute 'grant execute on function public.admin_stats(int) to authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.aou_kpi_snapshot() from public, anon'; execute 'grant execute on function public.aou_kpi_snapshot() to authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.safety_snapshot(uuid, text, text) from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.audit_write(text, text, text, jsonb) from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.audit_tg() from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.safety_is_service() from public, anon, authenticated'; exception when others then null; end;
  begin execute 'revoke all on function public.media_scan_result(bigint, jsonb) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.rt_topic_allowed(text) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.mod_evidence_bundle(uuid, bigint) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.delete_my_account(text) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.mod_release_and_delete(uuid) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.mod_incident(bigint, text, text, text) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.mod_block_hash(text, text, text, text) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.safety_set_setting(text, jsonb, boolean) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.audit_verify(bigint, int) from public, anon'; exception when others then null; end;
  begin execute 'revoke all on function public.audit_admin_open(text) from public, anon'; exception when others then null; end;
end $$;
-- the quarantine bucket must stay private and the scanner's objects must never be publicly readable
update storage.buckets set public = false where id = 'quarantine';

-- ─────────────────────────────────────────────────────────────
-- 9 · self-check (run afterwards)
--   select public.audit_verify();                          -- {"ok": true, ...}
--   select key, value from public.safety_settings where not secret;
--   select count(*) from public.media_items where reason = 'backfill v27';
--   select polname from pg_policy where polname like 'v27%';
-- ─────────────────────────────────────────────────────────────


-- ################################ v27-ads.sql ################################
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


-- ################################ v27-growth.sql ################################
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


-- ################################ v28-lockdown.sql ################################
-- ============================================================
-- allofus.one · v28 LOCKDOWN (Oct 25 2026) · Brand page manager e-mails
-- Run in Supabase → SQL Editor AFTER v27-security.sql. Additive, idempotent, safe to re-run. Deletes no member rows.
--
-- Found on production (anonymous, read-only probe 2026-10-25):
--   a. pages.admin_emails (pre-linked manager e-mails) was readable by anyone with the public key.
--   b. Supabase "Confirm email" is OFF (mailer_autoconfirm = true), so every sign-up gets email_confirmed_at at once.
--      my_email(), claim_my_pages() and welcome_new_member() trusted email_confirmed_at, so anyone could sign up with a
--      client's e-mail (readable per a.) and become a manager of that client's Brand page, edit it and post as it.
-- Fix:
--   1. email_proven(uid): an e-mail counts only if a confirmation e-mail was actually SENT and then confirmed
--      (confirmation_sent_at set, email_confirmed_at set). Auto-confirmed sign-ups prove nothing.
--      my_email(), claim_my_pages(), welcome_new_member() use it. Until "Confirm email" is turned on, new
--      pre-linked clients are linked by Zach by hand (Manage → managers) instead of automatically.
--   2. Pre-link e-mails move to a private table public.page_prelinks; pages.admin_emails is always stored empty
--      (a trigger moves whatever the app writes). Owners / managers / the admin read and set the list through
--      page_prelinks_get() / page_prelinks_set().
--   3. The two v19 e-mail policies (edit a page / post as a page by e-mail) read page_prelinks + proven e-mail.
-- ============================================================

-- 1 · proven e-mail
create or replace function public.email_proven(p_uid uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select u.email_confirmed_at is not null and u.confirmation_sent_at is not null
                     from auth.users u where u.id = p_uid), false);
$$;
revoke all on function public.email_proven(uuid) from public, anon, authenticated;

create or replace function public.my_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select lower(u.email) from auth.users u where u.id = auth.uid() and public.email_proven(u.id)), '');
$$;

-- 2 · private pre-link list
create table if not exists public.page_prelinks (
  page_id bigint not null references public.pages(id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  added_by uuid,
  added_at timestamptz default now(),
  primary key (page_id, email));
alter table public.page_prelinks enable row level security;
revoke all on public.page_prelinks from anon, authenticated;
-- no policies: only the security-definer functions below touch it

-- founder e-mails never pre-link anyone (v22 rule)
create or replace function public.prelink_clean(p_list text[]) returns text[]
language sql immutable as $$
  select coalesce(array(select distinct lower(trim(e)) from unnest(coalesce(p_list, '{}')) e
                         where lower(trim(e)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                           and lower(trim(e)) not in ('zach@eyetoad.com', 'zachwennstedt@gmail.com')), '{}');
$$;

-- move existing lists, then empty the public column
insert into public.page_prelinks (page_id, email)
  select p.id, e from public.pages p, unnest(public.prelink_clean(p.admin_emails)) e
  on conflict do nothing;
update public.pages set admin_emails = '{}' where coalesce(array_length(admin_emails, 1), 0) > 0;

-- whatever the app writes into pages.admin_emails lands in page_prelinks; the public column stays empty.
-- On insert: the list is the page's pre-links. On update with a non-empty list: it REPLACES the page's pre-links
-- (the old Manage sheet sent the whole list). Empty list on update = no change (use page_prelinks_set to clear).
create or replace function public.pages_prelink_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text[] := public.prelink_clean(new.admin_emails);
begin
  if tg_op = 'INSERT' then
    new.admin_emails := '{}';
    if array_length(v, 1) > 0 then
      -- the row id exists only after insert: stash in a transaction-local setting, the AFTER trigger saves it
      perform set_config('aou.prelink_pending', array_to_string(v, ','), true);
    end if;
  elsif new.admin_emails is distinct from old.admin_emails and coalesce(array_length(new.admin_emails, 1), 0) > 0 then
    delete from public.page_prelinks where page_id = new.id;
    insert into public.page_prelinks (page_id, email, added_by) select new.id, e, auth.uid() from unnest(v) e on conflict do nothing;
    new.admin_emails := '{}';
  else
    new.admin_emails := coalesce(old.admin_emails, '{}');
  end if;
  return new;
end $$;
create or replace function public.pages_prelink_after_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text := nullif(current_setting('aou.prelink_pending', true), '');
begin
  if v is not null then
    insert into public.page_prelinks (page_id, email, added_by) select new.id, e, auth.uid() from unnest(string_to_array(v, ',')) e on conflict do nothing;
    perform set_config('aou.prelink_pending', '', true);
  end if;
  return new;
end $$;
revoke all on function public.pages_prelink_tg() from public, anon, authenticated;
revoke all on function public.pages_prelink_after_tg() from public, anon, authenticated;
drop trigger if exists pages_prelink_v28 on public.pages;
create trigger pages_prelink_v28 before insert or update on public.pages for each row execute function public.pages_prelink_tg();
drop trigger if exists pages_prelink_after_v28 on public.pages;
create trigger pages_prelink_after_v28 after insert on public.pages for each row execute function public.pages_prelink_after_tg();

-- who may see / change a page's pre-links: its owner, its managers, the admin
create or replace function public.page_can_manage(p_page bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.pages p where p.id = p_page and auth.uid() is not null
                                       and (p.owner_id = auth.uid() or auth.uid() = any(coalesce(p.admins, '{}'))));
$$;
revoke all on function public.page_can_manage(bigint) from public, anon;
grant execute on function public.page_can_manage(bigint) to authenticated;

create or replace function public.page_prelinks_get(p_page bigint) returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.page_can_manage(p_page) then raise exception 'not your page'; end if;
  return coalesce((select array_agg(email order by email) from public.page_prelinks where page_id = p_page), '{}');
end $$;
revoke all on function public.page_prelinks_get(bigint) from public, anon;
grant execute on function public.page_prelinks_get(bigint) to authenticated;

create or replace function public.page_prelinks_set(p_page bigint, p_emails text[]) returns int
language plpgsql security definer set search_path = public as $$
declare v text[] := public.prelink_clean(p_emails);
begin
  if not public.page_can_manage(p_page) then raise exception 'not your page'; end if;
  if coalesce(array_length(v, 1), 0) > 20 then raise exception 'at most 20 e-mails'; end if;
  delete from public.page_prelinks where page_id = p_page;
  insert into public.page_prelinks (page_id, email, added_by) select p_page, e, auth.uid() from unnest(v) e on conflict do nothing;
  begin perform public.audit_write('page.prelinks', 'page', p_page::text, jsonb_build_object('count', coalesce(array_length(v, 1), 0))); exception when others then null; end;
  return coalesce(array_length(v, 1), 0);
end $$;
revoke all on function public.page_prelinks_set(bigint, text[]) from public, anon;
grant execute on function public.page_prelinks_set(bigint, text[]) to authenticated;

-- is my PROVEN e-mail pre-linked to this page?
create or replace function public.my_prelinked_page(p_page bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_email() <> '' and exists (select 1 from public.page_prelinks l where l.page_id = p_page and l.email = public.my_email());
$$;
revoke all on function public.my_prelinked_page(bigint) from public, anon;
grant execute on function public.my_prelinked_page(bigint) to authenticated;

-- 3 · the v19 e-mail policies, now on the private list + proven e-mail
drop policy if exists "pages update prelinked email v19" on public.pages;
create policy "pages update prelinked email v19" on public.pages for update
  using (public.my_prelinked_page(id)) with check (public.my_prelinked_page(id));
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feed_posts' and column_name = 'page_slug') then
    execute 'drop policy if exists "page email admins post v19" on public.feed_posts';
    execute 'create policy "page email admins post v19" on public.feed_posts for insert with check (auth.uid() = user_id and page_slug is not null and exists (select 1 from public.pages p where p.slug = feed_posts.page_slug and public.my_prelinked_page(p.id)))';
    -- the v6 "write own posts" policy let ANY member post with ANY page_slug (= post as someone else's Brand page).
    -- Restrictive: a post that names a page must come from its owner, a manager, a proven pre-linked e-mail or the admin.
    execute 'drop policy if exists "v28 page posts only by its managers" on public.feed_posts';
    execute 'create policy "v28 page posts only by its managers" on public.feed_posts as restrictive for insert to public with check (page_slug is null or public.is_admin() or exists (select 1 from public.pages p where p.slug = feed_posts.page_slug and (p.owner_id = auth.uid() or auth.uid() = any(coalesce(p.admins, ''{}'')) or public.my_prelinked_page(p.id))))';
    execute 'drop policy if exists "v28 page posts only by its managers upd" on public.feed_posts';
    execute 'create policy "v28 page posts only by its managers upd" on public.feed_posts as restrictive for update to public with check (page_slug is null or public.is_admin() or exists (select 1 from public.pages p where p.slug = feed_posts.page_slug and (p.owner_id = auth.uid() or auth.uid() = any(coalesce(p.admins, ''{}'')) or public.my_prelinked_page(p.id))))';
  end if;
end $$;

-- 4 · claiming: proven e-mail + private list (v26 bodies otherwise unchanged)
create or replace function public.welcome_new_member() returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_founder uuid;
begin
  begin
    select lower(email) into v_email from auth.users where id = new.id and public.email_proven(id);
    v_founder := public.founder_id();
    if v_founder is not null and v_founder <> new.id then
      insert into public.connections (requester, addressee, kind, status) values (v_founder, new.id, 'connect', 'accepted') on conflict do nothing;
    end if;
    if v_email is not null then
      update public.pages p set admins = array_append(coalesce(p.admins, '{}'), new.id), claimed_at = coalesce(p.claimed_at, now())
       where exists (select 1 from public.page_prelinks l where l.page_id = p.id and l.email = v_email) and not (new.id = any(coalesce(p.admins, '{}')));
    end if;
  exception when others then raise warning 'welcome_new_member skipped: %', sqlerrm; end;
  return new;
end $$;

create or replace function public.claim_my_pages() returns int language plpgsql security definer set search_path = public as $$
declare v_email text; n int := 0; v_founder uuid;
begin
  if auth.uid() is null then return 0; end if;
  begin
    select lower(email) into v_email from auth.users where id = auth.uid() and public.email_proven(id);
    if v_email is not null then
      update public.pages p set admins = array_append(coalesce(p.admins, '{}'), auth.uid()), claimed_at = coalesce(p.claimed_at, now())
       where exists (select 1 from public.page_prelinks l where l.page_id = p.id and l.email = v_email) and not (auth.uid() = any(coalesce(p.admins, '{}')));
      get diagnostics n = row_count;
    end if;
  exception when others then null; end;
  begin
    v_founder := public.founder_id();
    if v_founder is not null and v_founder <> auth.uid() then
      if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce((p.home->>'noFounder')::boolean, false)) then
        insert into public.connections (requester, addressee, kind, status) values (v_founder, auth.uid(), 'connect', 'accepted') on conflict do nothing;
        update public.connections set status = 'accepted' where requester = auth.uid() and addressee = v_founder and status = 'pending';
      end if;
    end if;
  exception when others then null; end;
  return n;
end $$;
revoke all on function public.claim_my_pages() from public, anon;
grant execute on function public.claim_my_pages() to authenticated;

-- check afterwards (all three should be true / 0):
--   select count(*) = 0 as emails_hidden from public.pages where coalesce(array_length(admin_emails, 1), 0) > 0;
--   select count(*) as prelinks from public.page_prelinks;
--   select public.audit_verify();


-- ################################ v29-match.sql ################################
-- ============================================================================
-- allofus.one · v29 · Global Match 2.0 + Match Shield (Oct 25 2026)
-- Run AFTER v28-lockdown.sql. Additive and re-runnable (safe to run twice).
--
-- 1. match_posts grows up: topic, exchange (give/sell/trade/lend/borrow/teach…), reach (nearby → worldwide),
--    urgency, tags (AI keywords for matching), screen + ai verdicts, 'held' / 'removed' states.
-- 2. The Match Shield in the database: the same BLOCK rules as js/aou-match-safety.js run on every insert/update.
--    A blocked post is saved as 'removed' (never shown), logged as a strike + safety incident.
--    3 strikes in 90 days = posting paused + account held for an admin. Admins are never blocked.
-- 3. Rate limits: accounts younger than 7 days may post 3 per 24 h, everyone else 15 per 24 h.
-- 4. match_links ("this is a match") + match_stats() for honest live counters on /match/.
-- 5. Claude review: after each new post, pg_net calls the match-ai Edge Function (if match_ai_url is set),
--    which can hold the post. safety-sweep re-reads the last 13 h at 7am + 7pm Denver (pg_cron).
--    Both reuse the media_scan_secret already stored in safety_settings, so no key is copied by hand.
-- ============================================================================

-- ---------- 0. Rooms backend (hub_messages) was never created on production (button audit 10-25: /?v=room got 404) ----------
create table if not exists public.hub_messages (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  user_id uuid not null references auth.users(id) on delete cascade,
  body text check (char_length(body) <= 2000),
  post_id bigint,
  created_at timestamptz default now());
create index if not exists hub_messages_room_idx on public.hub_messages (room, created_at desc);
alter table public.hub_messages enable row level security;
drop policy if exists "rooms readable" on public.hub_messages;
create policy "rooms readable" on public.hub_messages for select using (true);
drop policy if exists "rooms post own" on public.hub_messages;
create policy "rooms post own" on public.hub_messages for insert with check (auth.uid() = user_id);
drop policy if exists "rooms delete own" on public.hub_messages;
create policy "rooms delete own" on public.hub_messages for delete using (auth.uid() = user_id);
drop policy if exists "v26 adults only insert" on public.hub_messages;
create policy "v26 adults only insert" on public.hub_messages as restrictive for insert to public with check (public.is_admin() or public.safety_is_adult(auth.uid()));
do $$ begin begin execute 'alter publication supabase_realtime add table public.hub_messages'; exception when others then null; end; end $$;

-- ---------- 0b. video uploads up to 50 MB (the client checks the same limit; Supabase's project-wide cap must be 50 MB or more) ----------
update storage.buckets set file_size_limit = 52428800 where id in ('posts', 'quarantine');

-- ---------- 1. columns ----------
alter table public.match_posts add column if not exists topic text;
alter table public.match_posts add column if not exists exchange text;
alter table public.match_posts add column if not exists reach text default 'city';
alter table public.match_posts alter column reach set default 'city';
update public.match_posts set reach = 'city' where reach is null or reach = 'local';
alter table public.match_posts add column if not exists urgency text;
alter table public.match_posts add column if not exists tags text[] default '{}';
alter table public.match_posts add column if not exists screen jsonb;
alter table public.match_posts add column if not exists ai jsonb;
alter table public.match_posts add column if not exists updated_at timestamptz default now();
alter table public.match_posts drop constraint if exists match_posts_status_check;
alter table public.match_posts add constraint match_posts_status_check check (status in ('open', 'matched', 'closed', 'held', 'removed'));
alter table public.match_posts drop constraint if exists match_posts_details_len_v29;
alter table public.match_posts add constraint match_posts_details_len_v29 check (details is null or char_length(details) <= 1000) not valid;
alter table public.match_posts drop constraint if exists match_posts_v29_enums;
alter table public.match_posts add constraint match_posts_v29_enums check (
  (topic is null or topic in ('things', 'rides', 'skills', 'time', 'space', 'work', 'food', 'pets', 'kids', 'tech', 'home', 'health', 'other'))
  and (exchange is null or exchange in ('give', 'sell', 'trade', 'lend', 'teach', 'volunteer', 'free', 'buy', 'borrow', 'hire', 'learn', 'swap'))
  and (reach is null or reach in ('nearby', 'city', 'country', 'world'))
  and (urgency is null or urgency in ('now', 'week', 'month', 'anytime'))
  and (cardinality(tags) <= 24)) not valid;
create index if not exists match_posts_open_v29 on public.match_posts (status, kind, created_at desc);
create index if not exists match_posts_user_v29 on public.match_posts (user_id, created_at desc);

-- only open/matched posts are public; owners still see their own held/removed posts (so they know why)
drop policy if exists "match readable" on public.match_posts;
create policy "match readable" on public.match_posts for select using (status in ('open', 'matched') or auth.uid() = user_id or public.is_admin());

-- ---------- 2. strikes ----------
create table if not exists public.match_strikes (
  id bigint generated always as identity primary key,
  user_id uuid not null,              -- no FK: outlives the account (evidence)
  created_at timestamptz default now(),
  source text not null default 'shield',   -- shield | ai | sweep | admin
  rules text[] not null default '{}',
  excerpt text,
  post_id bigint);
create index if not exists match_strikes_user_v29 on public.match_strikes (user_id, created_at desc);
alter table public.match_strikes enable row level security;
drop policy if exists "match strikes own or admin read" on public.match_strikes;
create policy "match strikes own or admin read" on public.match_strikes for select using (auth.uid() = user_id or public.is_admin());
revoke insert, update, delete on public.match_strikes from anon, authenticated;

-- ---------- 3. the shield in SQL (rules generated from js/aou-match-safety.js) ----------
create or replace function public.match_norm(p text, p_leet boolean default true) returns text
language plpgsql immutable set search_path = public as $$
declare t text := lower(coalesce(p, '')); prev text; w text; buf text := ''; outp text := '';
begin
  t := regexp_replace(t, '[' || chr(8203) || '-' || chr(8207) || chr(8288) || chr(65279) || ']', '', 'g');
  t := translate(t, 'аеорсухіјѕԁɡαορτνκ', 'aeopcyxijsdgaoptvk');
  if p_leet then
    -- digits/symbols inside words become letters (w33d → weed), numbers on their own stay numbers
    loop prev := t;
      t := regexp_replace(t, '([a-z])[0]|[0]([a-z])', '\1o\2', 'g'); t := regexp_replace(t, '([a-z])[1!|]|[1!|]([a-z])', '\1i\2', 'g');
      t := regexp_replace(t, '([a-z])[3]|[3]([a-z])', '\1e\2', 'g'); t := regexp_replace(t, '([a-z])[4@]|[4@]([a-z])', '\1a\2', 'g');
      t := regexp_replace(t, '([a-z])[5$]|[5$]([a-z])', '\1s\2', 'g'); t := regexp_replace(t, '([a-z])[7+]|[7+]([a-z])', '\1t\2', 'g');
      exit when t = prev; end loop;
  end if;
  t := regexp_replace(t, '[._*~-]+([a-z])', '\1', 'g');
  -- "k u s h" → "kush" (only runs of 3+ single letters, so "i need a bike" is untouched)
  foreach w in array regexp_split_to_array(t, ' ') loop
    if w ~ '^[a-z]$' then buf := buf || w;
    else
      if buf <> '' then outp := outp || ' ' || case when length(buf) >= 3 then buf else array_to_string(regexp_split_to_array(buf, ''), ' ') end; buf := ''; end if;
      outp := outp || ' ' || w;
    end if;
  end loop;
  if buf <> '' then outp := outp || ' ' || case when length(buf) >= 3 then buf else array_to_string(regexp_split_to_array(buf, ''), ' ') end; end if;
  t := ltrim(outp);
  t := regexp_replace(t, '([a-z])\1{2,}', '\1\1', 'g');
  return t;
end $$;

create or replace function public.match_screen(p text) returns text[]
language plpgsql immutable set search_path = public as $$
declare plain text := public.match_norm(p, false); t text := public.match_norm(p, true); hits text[] := '{}'; r record;
begin
  for r in select * from (values
-- @@RULES-BEGIN@@ (generated from js/aou-match-safety.js: block rules only, word boundaries written as \y)
    ('drugs', '\y(kush|zaza|mdma|ecstasy|xanax|xans|percocets?|percs|oxycodone|oxycontin|oxys?|roxys?|fentanyl|fent|m30s?|cocaine|crack rock|meth|methamphetamine|heroin|shrooms|psilocybin|lsd|dmt|ketamine|ket|thc carts?|dab pens?|wax pens?|adderall|vicodin|hydrocodone|codeine|lean|promethazine|tramadol|suboxone|steroids|tren|anavar|clenbuterol|kratom|pressies|blues pills?)\y'),
    ('drugs-sale', '\y(no (rx|script|prescription)|without (a )?prescription|rx (meds|pills) for sale|pills? for sale|420 friendly|weed (for sale|delivery)|(sell|selling|got|have) (weed|bud|flower|pot|grass|edibles|carts))\y|\y(oz|ozs|qp|zip|8th|eighth|grams?|g) (of )?(weed|bud|flower|loud|gas|za)\y'),
    ('weapons', '\y(guns?|firearms?|handguns?|pistols?|rifles?|shotguns?|revolvers?|ammo|ammunition|rounds of|glock|ar ?15|ak ?47|9mm|ghost guns?|80 ?% lower|lower receivers?|suppressors?|silencers?|auto sears?|glock switch|bump stocks?|drum mags?|high capacity mags?|3d printed guns?|tasers?|brass knuckles|switchblades?|grenades?|explosives?|pipe bombs?|detonators?|tannerite|thermite)\y'),
    ('sex', '\y(escorts?|escorting|gfe|pse|incall|outcall|happy ending|full service|sugar (daddy|baby|mama)|onlyfans|only fans|nudes?|sexting|hook ?ups?|nsfw|fetish|bdsm|porn|xxx|cam ?girls?|strip(per|tease)|erotic massage|body rubs?|qv|hhr|roses for)\y'),
    ('minors', '\y(underage|barely legal|young (girls?|boys?)|teen (girls?|boys?|pics|nudes)|jailbait|loli|cp|minors? (for|wanted|available)|kids? (for sale|available))\y'),
    ('trafficking', '\y(new in town|fresh (girls?|faces?)|(girls?|women|workers?) available|visa (work|sponsor) (no|without) papers|passport (held|kept)|human (organs?|remains)|kidneys? (for sale|wanted)|organs? for sale|buy a (baby|child|kid)|babies? for sale|surrogacy cash)\y'),
    ('fraud', '\y(fullz|cvv|dumps|carding|cash ?out (method|service)|bank (logs?|logins?)|fake (ids?|passports?|licen[cs]es?|diplomas?|degrees?|documents?|checks?|money|bills)|scannable|novelty (ids?|licen[cs]es?)|counterfeit|ssns? for sale|social security numbers?|stolen|no serial|hacked accounts?|account takeover|ddos|phishing kits?|ransomware|malware|botnet|keyloggers?|essay (writing )?service|take (my|your) exam)\y'),
    ('knockoff', '\y(replicas?|reps|1 ?: ?1 (quality|copy)|aaa (quality|grade)|mirror quality|super ?fake|knock ?offs?|dupes? of (rolex|gucci|lv|louis))\y'),
    ('violence', '\y(hitman|hit man|kill (him|her|them|someone|you)|murder for hire|beat (him|her|them|someone) up|(hurt|harm) (him|her|them|someone)|revenge (on|for)|swatting|dox(x)?(ing)?)\y'),
    ('hate', '\y(n[i]gg(a|er|ers|as)|f[a]gg?ots?|k[i]kes?|sp[i]cs?|ch[i]nks?|tr[a]nn(y|ies)|wetbacks?|g[o]oks?|raghead|towelhead|white power|heil hitler|14 ?88)\y'),
    ('wildlife', '\y(ivory|rhino horn|tiger (skin|bone|parts)|pangolin|shark fin|bear bile)\y')
-- @@RULES-END@@
  ) as x(id, rx) loop
    if plain ~ r.rx or t ~ r.rx then hits := hits || r.id; end if;
  end loop;
  return hits;
end $$;
grant execute on function public.match_screen(text) to anon, authenticated;
grant execute on function public.match_norm(text, boolean) to anon, authenticated;

create or replace function public.match_can_post(uid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare n_strikes int; n_day int; joined timestamptz; ms record;
begin
  if uid is null then return 'Sign in to post.'; end if;
  if public.is_admin() then return null; end if;
  select * into ms from public.member_safety where user_id = uid;
  if found and (ms.banned or ms.held) then return 'Posting is paused on this account while a moderator reviews it.'; end if;
  select count(*) into n_strikes from public.match_strikes where user_id = uid and created_at > now() - interval '90 days';
  if n_strikes >= 3 then return 'Posting is paused: this account tripped the safety shield 3 times.'; end if;
  select created_at into joined from auth.users where id = uid;
  select count(*) into n_day from public.match_posts where user_id = uid and created_at > now() - interval '24 hours';
  if joined is not null and joined > now() - interval '7 days' and n_day >= 3 then return 'New accounts can post 3 matches a day. Try again tomorrow.'; end if;
  if n_day >= 15 then return 'That is 15 posts today. Try again tomorrow.'; end if;
  return null;
end $$;
grant execute on function public.match_can_post(uuid) to authenticated;

create or replace function public.match_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare why text; hits text[];
begin
  if tg_op = 'INSERT' then
    why := public.match_can_post(new.user_id);
    if why is not null then raise exception 'MATCH_PAUSED: %', why using errcode = 'P0001'; end if;
    new.status := 'open';
    new.ai := null;
    select coalesce(nullif(display_name, ''), username) into new.user_name from public.profiles where id = new.user_id;
  else
    -- members cannot reopen a post the shield / AI / an admin took down, and cannot rewrite verdicts
    if not public.is_admin() and coalesce(current_setting('aou.match_sys', true), '') <> '1' then
      if old.status in ('held', 'removed') then new.status := old.status; end if;
      if new.status not in ('open', 'matched', 'closed', old.status) then new.status := old.status; end if;
      new.ai := old.ai; new.user_id := old.user_id; new.user_name := old.user_name;
    end if;
  end if;
  new.tags := (select coalesce(array_agg(distinct lower(left(x, 32))), '{}') from unnest(coalesce(new.tags, '{}')) x where x ~ '^[[:alnum:] -]{2,32}$');
  hits := public.match_screen(coalesce(new.title, '') || ' ' || coalesce(new.details, '') || ' ' || coalesce(new.city, '') || ' ' || array_to_string(new.tags, ' '));
  new.screen := jsonb_build_object('rules', to_jsonb(hits), 'at', now());
  if cardinality(hits) > 0 and not public.is_admin() then new.status := 'removed'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_guard_v29 on public.match_posts;
create trigger match_guard_v29 before insert or update on public.match_posts for each row execute function public.match_guard();

create or replace function public.match_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; v_url text; v_secret text;
begin
  if new.status = 'removed' and jsonb_array_length(coalesce(new.screen -> 'rules', '[]')) > 0
     and (tg_op = 'INSERT' or old.status is distinct from 'removed') then
    insert into public.match_strikes (user_id, source, rules, excerpt, post_id)
      values (new.user_id, 'shield', array(select jsonb_array_elements_text(new.screen -> 'rules')), left(new.title || ' / ' || coalesce(new.details, ''), 400), new.id);
    begin
      insert into public.safety_incidents (kind, user_id, details) values ('match_block', new.user_id, jsonb_build_object('post_id', new.id, 'rules', new.screen -> 'rules', 'title', left(new.title, 120)));
    exception when others then null; end;
    select count(*) into n from public.match_strikes where user_id = new.user_id and created_at > now() - interval '90 days';
    if n >= 3 then
      begin
        insert into public.member_safety (user_id, held, held_reason) values (new.user_id, true, 'Match Shield: 3 strikes')
          on conflict (user_id) do update set held = true, held_reason = 'Match Shield: 3 strikes';
      exception when others then null; end;
    end if;
  end if;
  -- ask Claude to read every new open post (async; never blocks the member)
  if tg_op = 'INSERT' and new.status = 'open' and to_regnamespace('net') is not null then
    select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'match_ai_url';
    select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
    if coalesce(v_url, '') <> '' then
      begin
        execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 8000)', v_url,
          jsonb_build_object('mode', 'review', 'post_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, ''), 'apikey', 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF'));
      exception when others then raise warning 'match-ai webhook: %', sqlerrm; end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists match_after_v29 on public.match_posts;
create trigger match_after_v29 after insert or update on public.match_posts for each row execute function public.match_after();

-- service role (match-ai / safety-sweep) records an AI verdict; 'hold' takes the post down + a strike for 'block'
create or replace function public.match_ai_verdict(p_post bigint, p_verdict text, p_reason text, p_source text default 'ai') returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.match_posts where id = p_post;
  if not found then return; end if;
  perform set_config('aou.match_sys', '1', true);
  update public.match_posts set ai = jsonb_build_object('verdict', p_verdict, 'reason', left(p_reason, 300), 'source', p_source, 'at', now()),
    status = case when p_verdict in ('hold', 'block') and status in ('open', 'matched') then 'held' else status end
    where id = p_post;
  if p_verdict = 'block' then
    insert into public.match_strikes (user_id, source, rules, excerpt, post_id) values (p.user_id, p_source, array['ai:' || left(p_reason, 60)], left(p.title || ' / ' || coalesce(p.details, ''), 400), p.id);
  end if;
  if p_verdict in ('hold', 'block') then
    begin
      insert into public.safety_incidents (kind, user_id, details) values ('match_' || p_verdict, p.user_id, jsonb_build_object('post_id', p.id, 'reason', p_reason, 'source', p_source, 'title', left(p.title, 120)));
    exception when others then null; end;
  end if;
end $$;
revoke all on function public.match_ai_verdict(bigint, text, text, text) from public, anon, authenticated;

-- a member searched the board for something the shield blocks: logged for moderators (not a strike; the page shows a warning)
create or replace function public.match_search_flag(p_q text) returns boolean
language plpgsql security definer set search_path = public as $$
declare hits text[] := public.match_screen(left(coalesce(p_q, ''), 200)); n int;
begin
  if auth.uid() is null or cardinality(hits) = 0 then return false; end if;
  select count(*) into n from public.safety_incidents where kind = 'match_search' and user_id = auth.uid() and created_at > now() - interval '24 hours';
  if n < 20 then
    insert into public.safety_incidents (kind, user_id, details) values ('match_search', auth.uid(), jsonb_build_object('rules', to_jsonb(hits), 'q', left(p_q, 120)));
  end if;
  return true;
end $$;
revoke all on function public.match_search_flag(text) from public, anon;
grant execute on function public.match_search_flag(text) to authenticated;

-- ---------- 4. links + honest counters ----------
create table if not exists public.match_links (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  need_id bigint references public.match_posts(id) on delete cascade,
  have_id bigint references public.match_posts(id) on delete cascade,
  by_user uuid not null default auth.uid(),
  unique (need_id, have_id));
alter table public.match_links enable row level security;
drop policy if exists "match links insert own" on public.match_links;
create policy "match links insert own" on public.match_links for insert to authenticated with check (by_user = auth.uid() and public.safety_is_adult(auth.uid()));
drop policy if exists "match links read" on public.match_links;
create policy "match links read" on public.match_links for select using (true);

create or replace function public.match_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'needs', (select count(*) from public.match_posts where status = 'open' and kind = 'need'),
    'haves', (select count(*) from public.match_posts where status = 'open' and kind = 'have'),
    'matches', (select count(*) from public.match_links) + (select count(*) from public.match_posts where status = 'matched'),
    'today', (select count(*) from public.match_posts where status in ('open', 'matched') and created_at > now() - interval '24 hours'),
    'places', (select count(distinct lower(city)) from public.match_posts where status in ('open', 'matched') and coalesce(city, '') <> ''));
$$;
grant execute on function public.match_stats() to anon, authenticated;

-- ---------- 5. settings + schedule ----------
insert into public.safety_settings (key, value, secret) values ('match_ai_url', '""'::jsonb, false) on conflict (key) do nothing;
insert into public.safety_settings (key, value, secret) values ('safety_sweep_url', '""'::jsonb, false) on conflict (key) do nothing;
-- After deploying the two Edge Functions (verify-JWT OFF), turn them on:
--   update public.safety_settings set value = '"https://izfccjaznlcffvjxawya.supabase.co/functions/v1/match-ai"' where key = 'match_ai_url';
--   update public.safety_settings set value = '"https://izfccjaznlcffvjxawya.supabase.co/functions/v1/safety-sweep"' where key = 'safety_sweep_url';

create or replace function public.safety_sweep_kick() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'safety_sweep_url';
  select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
  if coalesce(v_url, '') = '' or to_regnamespace('net') is null then return; end if;
  execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 60000)', v_url,
    jsonb_build_object('hours', 13), jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, ''), 'apikey', 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF'));
end $$;
revoke all on function public.safety_sweep_kick() from public, anon, authenticated;

-- 7am + 7pm Denver (13:00 + 01:00 UTC while on daylight time; 6am/6pm in winter). Does nothing until safety_sweep_url is set.
do $$ begin
  if to_regnamespace('cron') is not null then
    begin perform cron.unschedule('aou-safety-sweep'); exception when others then null; end;
    perform cron.schedule('aou-safety-sweep', '0 1,13 * * *', 'select public.safety_sweep_kick()');
  end if;
end $$;

-- verify
select public.match_screen('selling w33d 1 oz') as should_block, public.match_screen('free couch, gently used') as should_be_empty;


-- ################################ v29b-function-keys.sql ################################
-- v29b: the database calls to match-ai and safety-sweep carry the public (publishable) key so the gateway lets them through
create or replace function public.match_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; v_url text; v_secret text;
begin
  if new.status = 'removed' and jsonb_array_length(coalesce(new.screen -> 'rules', '[]')) > 0
     and (tg_op = 'INSERT' or old.status is distinct from 'removed') then
    insert into public.match_strikes (user_id, source, rules, excerpt, post_id)
      values (new.user_id, 'shield', array(select jsonb_array_elements_text(new.screen -> 'rules')), left(new.title || ' / ' || coalesce(new.details, ''), 400), new.id);
    begin
      insert into public.safety_incidents (kind, user_id, details) values ('match_block', new.user_id, jsonb_build_object('post_id', new.id, 'rules', new.screen -> 'rules', 'title', left(new.title, 120)));
    exception when others then null; end;
    select count(*) into n from public.match_strikes where user_id = new.user_id and created_at > now() - interval '90 days';
    if n >= 3 then
      begin
        insert into public.member_safety (user_id, held, held_reason) values (new.user_id, true, 'Match Shield: 3 strikes')
          on conflict (user_id) do update set held = true, held_reason = 'Match Shield: 3 strikes';
      exception when others then null; end;
    end if;
  end if;
  -- ask Claude to read every new open post (async; never blocks the member)
  if tg_op = 'INSERT' and new.status = 'open' and to_regnamespace('net') is not null then
    select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'match_ai_url';
    select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
    if coalesce(v_url, '') <> '' then
      begin
        execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 8000)', v_url,
          jsonb_build_object('mode', 'review', 'post_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, ''), 'apikey', 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF'));
      exception when others then raise warning 'match-ai webhook: %', sqlerrm; end;
    end if;
  end if;
  return null;
end $$;


create or replace function public.safety_sweep_kick() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'safety_sweep_url';
  select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
  if coalesce(v_url, '') = '' or to_regnamespace('net') is null then return; end if;
  execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 60000)', v_url,
    jsonb_build_object('hours', 13), jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, ''), 'apikey', 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF'));
end $$;

revoke all on function public.safety_sweep_kick() from public, anon, authenticated;
select 1 as patched;


-- ################################ v30-rooms-constellations.sql ################################
-- ============================================================================
-- allofus.one · v30 · Rooms (live chat, rebuilt) + Constellations (Oct 25 2026)
-- Run AFTER v29-match.sql (uses match_screen / match_strikes / hub_messages from v29). Additive, re-runnable.
--
-- ROOMS: a real room list (public.rooms), messages screened by the Match Shield rules, a 20-per-minute flood limit,
--   /me actions, replies, and soft delete. Who-is-here, typing and door chimes run on Supabase Realtime presence on the
--   private channel 'room:<slug>' (already allowed for adults by rt_topic_allowed in v27), so they need no tables.
-- CONSTELLATIONS: what members used to call Groups and Spaces. Built on public.spaces (members, events, posts through
--   feed_posts.group_slug keep working). Adds a genre, keeps the creator's own title (spaces.name), and an approval step:
--   every new Constellation starts 'pending' until an admin approves it. The ten old buy/sell/trade Groups become official
--   'market' Constellations with the same slugs, so every old post stays where it was.
-- ============================================================================

-- ---------- ROOMS ----------
create table if not exists public.rooms (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  topic text check (char_length(topic) <= 200),
  theme text not null default 'dusk' check (theme in ('dusk', 'dawn', 'ocean', 'forest', 'ember', 'aurora', 'paper')),
  kind text not null default 'topic' check (kind in ('lobby', 'topic', 'constellation')),
  space_slug text references public.spaces(slug) on delete cascade,
  sort int not null default 100,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid,
  created_at timestamptz default now());
alter table public.rooms enable row level security;
drop policy if exists "rooms list readable" on public.rooms;
create policy "rooms list readable" on public.rooms for select using (status = 'open' or public.is_admin());
drop policy if exists "rooms admin write" on public.rooms;
create policy "rooms admin write" on public.rooms for all using (public.is_admin()) with check (public.is_admin());

insert into public.rooms (slug, name, topic, theme, kind, sort) values
  ('general', 'The Lobby', 'Say hi. Everyone starts here.', 'dawn', 'lobby', 1),
  ('help', 'Help Desk', 'Ask how anything on allofus works. Members and the team answer.', 'paper', 'topic', 10),
  ('kindness', 'Kindness Corner', 'Good news, small wins, gratitude.', 'aurora', 'topic', 20),
  ('business', 'Shop Talk', 'Owners, makers and side hustles trading notes.', 'ember', 'topic', 30),
  ('night-owls', 'Night Owls', 'For the ones still up.', 'dusk', 'topic', 40),
  ('denver', 'Denver Live', 'Colorado people, plans and places.', 'forest', 'topic', 50),
  ('creators', 'Studio', 'Music, art, video, writing: share what you are making.', 'ocean', 'topic', 60),
  ('banquet', 'The Banquet Hall', 'Big conversations, one table.', 'ember', 'topic', 70)
on conflict (slug) do nothing;

alter table public.hub_messages add column if not exists kind text not null default 'say';
alter table public.hub_messages add column if not exists reply_to bigint;
alter table public.hub_messages add column if not exists status text not null default 'ok';
alter table public.hub_messages drop constraint if exists hub_messages_v30_enums;
alter table public.hub_messages add constraint hub_messages_v30_enums check (kind in ('say', 'me', 'system') and status in ('ok', 'removed', 'deleted')) not valid;

drop policy if exists "rooms readable" on public.hub_messages;
create policy "rooms readable" on public.hub_messages for select using (status = 'ok' or auth.uid() = user_id or public.is_admin());
drop policy if exists "rooms own soft delete" on public.hub_messages;
create policy "rooms own soft delete" on public.hub_messages for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

create or replace function public.room_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; hits text[]; ms record;
begin
  if tg_op = 'UPDATE' then
    -- members may only delete their own line (status ok -> deleted); nothing else changes
    if not public.is_admin() then
      if new.status = 'deleted' and old.status = 'ok' then new := old; new.status := 'deleted'; return new; end if;
      return old;
    end if;
    return new;
  end if;
  if public.is_admin() then new.status := 'ok'; return new; end if;
  if new.kind = 'system' then new.kind := 'say'; end if;
  select * into ms from public.member_safety where user_id = new.user_id;
  if found and (ms.banned or ms.held) then raise exception 'ROOM_PAUSED: chat is paused on this account while a moderator reviews it' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.rooms r where r.slug = new.room and r.status = 'open') then raise exception 'ROOM_CLOSED: that room is not open' using errcode = 'P0001'; end if;
  select count(*) into n from public.hub_messages where user_id = new.user_id and created_at > now() - interval '1 minute';
  if n >= 20 then raise exception 'ROOM_SLOW: slow down a little (20 lines a minute)' using errcode = 'P0001'; end if;
  new.status := 'ok';
  hits := public.match_screen(coalesce(new.body, ''));
  if cardinality(hits) > 0 then new.status := 'removed'; end if;
  return new;
end $$;
drop trigger if exists room_guard_v30 on public.hub_messages;
create trigger room_guard_v30 before insert or update on public.hub_messages for each row execute function public.room_guard();

create or replace function public.room_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.status = 'removed' then
    insert into public.match_strikes (user_id, source, rules, excerpt) values (new.user_id, 'room', public.match_screen(new.body), left(new.room || ': ' || coalesce(new.body, ''), 400));
    begin insert into public.safety_incidents (kind, user_id, details) values ('room_block', new.user_id, jsonb_build_object('room', new.room, 'message_id', new.id)); exception when others then null; end;
    select count(*) into n from public.match_strikes where user_id = new.user_id and created_at > now() - interval '90 days';
    if n >= 3 then
      begin insert into public.member_safety (user_id, held, held_reason) values (new.user_id, true, 'Shield: 3 strikes')
        on conflict (user_id) do update set held = true, held_reason = 'Shield: 3 strikes'; exception when others then null; end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists room_after_v30 on public.hub_messages;
create trigger room_after_v30 after insert on public.hub_messages for each row execute function public.room_after();

-- ---------- CONSTELLATIONS (public.spaces) ----------
alter table public.spaces add column if not exists genre text default 'gathering';
alter table public.spaces add column if not exists status text default 'approved';   -- existing ones stay live
alter table public.spaces alter column status set default 'pending';                -- new ones wait for review
alter table public.spaces add column if not exists reviewed_by uuid;
alter table public.spaces add column if not exists reviewed_at timestamptz;
alter table public.spaces add column if not exists review_note text;
alter table public.spaces add column if not exists icon text;
update public.spaces set status = 'approved' where status is null;
alter table public.spaces drop constraint if exists spaces_v30_enums;
alter table public.spaces add constraint spaces_v30_enums check (
  genre in ('gathering', 'party', 'guild', 'salon', 'jam', 'summit', 'market', 'quest', 'haven', 'kin', 'lab', 'arena')
  and status in ('pending', 'approved', 'rejected', 'paused')) not valid;
create index if not exists spaces_status_v30 on public.spaces (status, genre);

drop policy if exists "spaces readable" on public.spaces;
create policy "spaces readable" on public.spaces for select using (status = 'approved' or auth.uid() = owner or public.is_admin());
drop policy if exists "v30 spaces adults create" on public.spaces;
create policy "v30 spaces adults create" on public.spaces as restrictive for insert to public with check (public.is_admin() or public.safety_is_adult(auth.uid()));
-- joining only once a Constellation is approved (owners and admins excepted)
drop policy if exists "v30 join approved only" on public.space_members;
create policy "v30 join approved only" on public.space_members as restrictive for insert to public with check (
  public.is_admin() or exists (select 1 from public.spaces s where s.slug = space_slug and (s.status = 'approved' or s.owner = auth.uid())));

create or replace function public.constellation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- the SQL editor / service role (no signed-in member) and admins are not held to member rules
  if auth.uid() is null or public.is_admin() then return new; end if;
  if cardinality(public.match_screen(coalesce(new.name, '') || ' ' || coalesce(new.about, ''))) > 0 then
    raise exception 'SHIELD: that name or description is not allowed on allofus' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.spaces where owner = new.owner and status = 'pending';
    if n >= 3 then raise exception 'You already have 3 Constellations waiting for review.' using errcode = 'P0001'; end if;
    new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
  else
    new.status := old.status; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note; new.owner := old.owner;
    -- a renamed or re-described Constellation goes back to review
    if (new.name is distinct from old.name or new.about is distinct from old.about) and old.status = 'approved' then new.status := 'pending'; end if;
  end if;
  return new;
end $$;
drop trigger if exists constellation_guard_v30 on public.spaces;
create trigger constellation_guard_v30 before insert or update on public.spaces for each row execute function public.constellation_guard();

create or replace function public.constellation_review(p_slug text, p_decision text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_decision not in ('approved', 'rejected', 'paused') then raise exception 'decision must be approved, rejected or paused'; end if;
  update public.spaces set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 300) where slug = p_slug;
  if not found then raise exception 'no such Constellation'; end if;
  -- every approved Constellation gets its own chat Room (closed again if it is paused or rejected)
  insert into public.rooms (slug, name, topic, theme, kind, space_slug, sort, created_by)
    select left('c-' || s.slug, 40), left(s.name, 60), left(coalesce(s.about, ''), 200), 'aurora', 'constellation', s.slug, 500, auth.uid() from public.spaces s where s.slug = p_slug
    on conflict (slug) do update set status = case when p_decision = 'approved' then 'open' else 'closed' end;
  update public.rooms set status = case when p_decision = 'approved' then 'open' else 'closed' end where space_slug = p_slug;
  begin perform public.audit_add('constellation_review', jsonb_build_object('slug', p_slug, 'decision', p_decision)); exception when others then null; end;
  return p_decision;
end $$;
revoke all on function public.constellation_review(text, text, text) from public, anon;
grant execute on function public.constellation_review(text, text, text) to authenticated;

-- the ten classic Groups become official Market Constellations (same slugs, so old posts stay put)
do $$ declare f uuid := '320bf5d4-2d2d-482e-8633-87ced55e4155'; begin
  if exists (select 1 from auth.users where id = f) then
    insert into public.spaces (slug, owner, name, about, genre, status, color, kind) values
      ('general', f, 'Trading Post', 'Buy, sell and trade anything legal and kind.', 'market', 'approved', '#0f766e', 'official'),
      ('vehicles', f, 'Wheels', 'Cars, bikes, boats and parts.', 'market', 'approved', '#1d4ed8', 'official'),
      ('furniture', f, 'Home + Nest', 'Furniture, decor and home goods.', 'market', 'approved', '#b45309', 'official'),
      ('electronics', f, 'Gadget Bench', 'Phones, computers, audio and tech.', 'market', 'approved', '#4338ca', 'official'),
      ('tools', f, 'The Workshop', 'Tools and equipment, to sell or lend.', 'market', 'approved', '#57534e', 'official'),
      ('kids', f, 'Little Ones', 'Baby and kids gear, handed down with love.', 'kin', 'approved', '#db2777', 'official'),
      ('free', f, 'Free Table', 'Free stuff. Take what helps, give what you can.', 'market', 'approved', '#15803d', 'official'),
      ('services', f, 'Skills + Pros', 'Hire, offer or swap services.', 'guild', 'approved', '#7c3aed', 'official'),
      ('business', f, 'Main Street', 'Local businesses announcing what is new.', 'summit', 'approved', '#c2410c', 'official'),
      ('wishes', f, 'Lantern Wishes', 'Send a wish into the sky.', 'haven', 'approved', '#d97706', 'official')
    on conflict (slug) do nothing;
  end if;
end $$;

-- ---------- CONSTELLATION GUESTBOOKS (old-school, Shield-screened) ----------
create table if not exists public.constellation_guestbook (
  id bigint generated always as identity primary key,
  space_slug text not null references public.spaces(slug) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'ok' check (status in ('ok', 'removed', 'deleted')),
  created_at timestamptz default now());
create index if not exists cgb_space_v30 on public.constellation_guestbook (space_slug, created_at desc);
alter table public.constellation_guestbook enable row level security;
drop policy if exists "cgb read" on public.constellation_guestbook;
create policy "cgb read" on public.constellation_guestbook for select using (status = 'ok' or auth.uid() = user_id or public.is_admin());
drop policy if exists "cgb sign" on public.constellation_guestbook;
create policy "cgb sign" on public.constellation_guestbook for insert to authenticated with check (user_id = auth.uid() and public.safety_is_adult(auth.uid())
  and exists (select 1 from public.spaces s where s.slug = space_slug and s.status = 'approved'));
drop policy if exists "cgb own delete" on public.constellation_guestbook;
create policy "cgb own delete" on public.constellation_guestbook for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create or replace function public.cgb_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tg_op = 'UPDATE' then
    if public.is_admin() then return new; end if;
    if new.status = 'deleted' and old.status = 'ok' then new := old; new.status := 'deleted'; return new; end if;
    return old;
  end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  select count(*) into n from public.constellation_guestbook where user_id = new.user_id and created_at > now() - interval '1 hour';
  if n >= 10 then raise exception 'Ten guestbook notes an hour is the limit.' using errcode = 'P0001'; end if;
  new.status := case when cardinality(public.match_screen(new.body)) > 0 then 'removed' else 'ok' end;
  if new.status = 'removed' then
    insert into public.match_strikes (user_id, source, rules, excerpt) values (new.user_id, 'guestbook', public.match_screen(new.body), left(new.space_slug || ': ' || new.body, 400));
  end if;
  return new;
end $$;
drop trigger if exists cgb_guard_v30 on public.constellation_guestbook;
create trigger cgb_guard_v30 before insert or update on public.constellation_guestbook for each row execute function public.cgb_guard();

-- public counts for the star map (members per Constellation)
create or replace function public.constellation_counts() returns table (slug text, members bigint, notes bigint)
language sql stable security definer set search_path = public as $$
  select s.slug,
    (select count(*) from public.space_members m where m.space_slug = s.slug and m.status = 'in'),
    (select count(*) from public.constellation_guestbook g where g.space_slug = s.slug and g.status = 'ok')
  from public.spaces s where s.status = 'approved';
$$;
grant execute on function public.constellation_counts() to anon, authenticated;

-- verify
select (select count(*) from public.rooms) as rooms, (select count(*) from public.spaces where kind = 'official') as official_constellations;


-- ################################ v31 (Nov 3 2026) ################################
-- ============================================================================
-- allofus.one · v31 · Nov 3 2026 · delete pages for real, sturdier account delete, age-answer fixes, new official posts
-- Additive and safe to re-run. Runs after v30 (it is the last section of allofus-ALL-2026-11-03.sql).
-- ============================================================================

-- ---------- 1 · Brand page delete (owner or site admin) ----------
-- Built-in network brands render from the site code; a retired slug tells every visitor's browser to stop showing it.
create table if not exists public.page_retired (
  slug text primary key,
  retired_at timestamptz not null default now(),
  retired_by uuid);
alter table public.page_retired enable row level security;
drop policy if exists "page_retired readable" on public.page_retired;
create policy "page_retired readable" on public.page_retired for select using (true);
-- no insert/update/delete policies: only the functions below write it
insert into public.page_retired (slug) values ('bighorn-painting') on conflict (slug) do nothing;

create or replace function public.delete_page(p_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_slug text := lower(trim(coalesce(p_slug, ''))); v_page public.pages%rowtype; v_admin boolean := false; v_posts int := 0;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if v_slug = '' then raise exception 'Which page?'; end if;
  begin v_admin := coalesce(public.is_admin(), false); exception when others then v_admin := false; end;
  select * into v_page from public.pages where slug = v_slug;
  if found then
    if v_page.owner_id <> uid and not v_admin then raise exception 'Only the page owner can delete this page.'; end if;
  elsif not v_admin then
    raise exception 'That page is not in the database, so there is nothing of yours to delete.';
  end if;
  begin delete from public.feed_posts where page_slug = v_slug; get diagnostics v_posts = row_count; exception when others then null; end;
  begin delete from public.page_follows where page_slug = v_slug; exception when others then null; end;
  if v_page.id is not null then delete from public.pages where id = v_page.id; end if;
  -- site admins retire the address too, so a built-in network brand stops rendering from the site code; an owner's own page just goes
  if v_admin then insert into public.page_retired (slug, retired_by) values (v_slug, uid) on conflict (slug) do update set retired_at = now(), retired_by = excluded.retired_by; end if;
  begin perform public.audit_write('page.delete', 'page', v_slug, jsonb_build_object('posts', v_posts, 'by_admin', v_admin and (v_page.owner_id is distinct from uid))); exception when others then null; end;
  return jsonb_build_object('deleted', true, 'slug', v_slug, 'posts_removed', v_posts, 'message', 'Page deleted.');
end $$;
revoke all on function public.delete_page(text) from public, anon;
grant execute on function public.delete_page(text) to authenticated;

-- admin: bring a retired slug back (a built-in brand shows again; a deleted page can be rebuilt under the same address)
create or replace function public.restore_page_slug(p_slug text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'admins only'; end if;
  delete from public.page_retired where slug = lower(trim(p_slug));
  return found;
end $$;
revoke all on function public.restore_page_slug(text) from public, anon;
grant execute on function public.restore_page_slug(text) to authenticated;

-- ---------- 2 · Account delete that cannot get stuck (replaces the v27 version) ----------
create or replace function public.delete_my_account(p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, auth, storage as $$
declare uid uuid := auth.uid(); v_email text; v_user text; v_pages int := 0; v_hold boolean; r record;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if uid = public.founder_id() then raise exception 'The founder account cannot delete itself here.'; end if;
  select exists (select 1 from public.mod_evidence e where e.user_id = uid and e.hold) or exists (select 1 from public.safety_incidents i where i.user_id = uid and i.status <> 'closed') into v_hold;
  select lower(email) into v_email from auth.users where id = uid;
  select username into v_user from public.profiles where id = uid;
  if v_hold then
    insert into public.member_safety (user_id, delete_requested_at) values (uid, now())
      on conflict (user_id) do update set delete_requested_at = coalesce(public.member_safety.delete_requested_at, now()), updated_at = now();
    perform public.audit_write('account.delete_queued', 'user', uid::text, jsonb_build_object('email_sha256', encode(sha256(convert_to(coalesce(v_email, ''), 'UTF8')), 'hex'), 'username', v_user, 'reason', left(p_reason, 300)));
    perform public.notify(public.founder_id(), 'mod', 'Deletion request on a held account', 'A member with evidence on hold asked to delete their account. It is queued until the hold is released (Admin → Moderation).', '/?v=admin&what=mod', null);
    return jsonb_build_object('deleted', false, 'queued', true, 'message', 'Your request is recorded. This account is under review, so the deletion completes when the review closes. Nothing you post can be seen meanwhile.');
  end if;
  -- the audit row first (the chain proves the member asked)
  perform public.audit_write('account.delete', 'user', uid::text, jsonb_build_object('email_sha256', encode(sha256(convert_to(coalesce(v_email, ''), 'UTF8')), 'hex'), 'username', v_user, 'reason', left(p_reason, 300)));
  -- Brand pages survive for their other managers (owner → founder)
  begin update public.pages set owner_id = public.founder_id() where owner_id = uid; get diagnostics v_pages = row_count; update public.pages set admins = array_remove(admins, uid) where uid = any(admins); exception when others then null; end;
  -- content (each step independent; missing tables are skipped)
  begin delete from public.feed_reactions where user_id = uid; exception when others then null; end;
  begin delete from public.feed_saves where user_id = uid; exception when others then null; end;
  begin delete from public.feed_comments where user_id = uid; exception when others then null; end;
  begin delete from public.feed_posts where user_id = uid; exception when others then null; end;
  begin delete from public.posts where author = uid; exception when others then null; end;
  begin delete from public.hugs where from_id = uid or to_id = uid; exception when others then null; end;
  begin delete from public.messages where sender = uid; exception when others then null; end;
  begin delete from public.hub_requests where from_user = uid; exception when others then null; end;
  begin delete from public.meeting_requests where from_user = uid or to_user = uid; exception when others then null; end;
  begin delete from public.hub_messages where user_id = uid; exception when others then null; end;
  begin delete from public.event_rsvps where user_id = uid; exception when others then null; end;
  begin delete from public.circle_members where owner_id = uid or member_id = uid; exception when others then null; end;
  begin delete from public.circles where owner_id = uid; exception when others then null; end;
  begin delete from public.connections where requester = uid or addressee = uid; exception when others then null; end;
  begin delete from public.lifeboards where id = uid; exception when others then null; end;
  begin delete from public.push_subscriptions where user_id = uid; exception when others then null; end;
  begin delete from public.notifications where user_id = uid or actor = uid; exception when others then null; end;
  begin delete from public.presence where user_id = uid; exception when others then null; end;
  begin delete from public.page_follows where user_id = uid; exception when others then null; end;
  begin delete from public.wishes where user_id = uid; exception when others then null; end;
  begin delete from public.match_posts where user_id = uid; exception when others then null; end;
  begin delete from public.media_items where user_id = uid and status = 'ok'; exception when others then null; end;
  -- storage rows for the member's folders (the client removes the files through the Storage API first; this catches leftovers)
  begin delete from storage.objects where bucket_id in ('posts', 'conference') and name like uid::text || '/%'; exception when others then null; end;
  -- profile: anonymize, then remove (the auth delete cascades too)
  begin update public.profiles set display_name = 'Deleted member', username = 'deleted-' || left(uid::text, 8), bio = null, city = null, looking_for = null, attractor = null, avatar = '{}'::jsonb, home = '{}'::jsonb, blocked = '{}'::uuid[], paths = '{}', causes = '{}' where id = uid; exception when others then null; end;
  begin delete from public.profiles where id = uid; exception when others then null; end;
  begin delete from public.member_safety where user_id = uid; exception when others then null; end;
  -- v31: any other table that points at this member without ON DELETE CASCADE would block the sign-in delete; clear those rows first
  for r in select c.conrelid::regclass as tbl, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and array_length(c.conkey, 1) = 1 and c.confdeltype not in ('c', 'n', 'd')
              and c.confrelid in ('auth.users'::regclass, coalesce(to_regclass('public.profiles'), 'auth.users'::regclass))
              and c.conrelid::regclass::text not in ('public.pages', 'public.audit_log') loop
    begin execute format('delete from %s where %I = $1', r.tbl, r.col) using uid; exception when others then null; end;
  end loop;
  begin
    delete from auth.users where id = uid;
  exception when others then
    -- content is gone; the sign-in removal is queued for the team instead of failing the whole request
    begin insert into public.member_safety (user_id, delete_requested_at) values (uid, now())
      on conflict (user_id) do update set delete_requested_at = coalesce(public.member_safety.delete_requested_at, now()), updated_at = now(); exception when others then null; end;
    begin perform public.notify(public.founder_id(), 'mod', 'Finish an account deletion', 'A member deleted their account; the sign-in row could not be removed automatically (' || left(sqlerrm, 120) || '). Delete it in Supabase → Authentication → Users.', '/?v=admin&what=mod', null); exception when others then null; end;
    return jsonb_build_object('deleted', false, 'queued', true, 'message', 'Your posts, profile and data are deleted. Removing the sign-in itself is queued with our team (done within 7 days).');
  end;
  return jsonb_build_object('deleted', true, 'queued', false, 'pages_moved', v_pages, 'message', 'Your account and sign-in are deleted.');
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- ---------- 3 · Age answer: an admin can reset a typed-wrong date of birth ----------
-- "Lift restriction" alone keeps an under-18 date on file (so the account still is not an adult). This clears the date,
-- the restriction and the copy on the sign-in, so the member is simply asked again. Admins only; the founder runs it
-- from Admin -> Moderation -> "Reset date of birth (typo)" only after confirming the person is an adult.
create or replace function public.admin_reset_dob(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'admins only'; end if;
  if p_user is null then raise exception 'which member?'; end if;
  update public.member_safety set dob = null, dob_source = null, dob_set_at = null, restricted = false, restricted_reason = null, flagged = false, updated_at = now() where user_id = p_user;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'dob' - 'restricted' - 'adult_ack' where id = p_user;
  begin perform public.safety_sync_profile(p_user); exception when others then null; end;
  begin perform public.audit_write('safety.dob_reset', 'user', p_user::text, '{}'::jsonb); exception when others then null; end;
  return 'dob reset ' || p_user;
end $$;
revoke all on function public.admin_reset_dob(uuid) from public, anon;
grant execute on function public.admin_reset_dob(uuid) to authenticated;

-- One account by e-mail (for example the Phoenix test account). Left commented on purpose: only run it for an adult who
-- typed the wrong date. Put the account's e-mail in both places, remove the two leading dashes on each line, run.
-- update public.member_safety set dob = null, dob_source = null, dob_set_at = null, restricted = false, restricted_reason = null, flagged = false, updated_at = now() where user_id = (select id from auth.users where lower(email) = lower('PUT-THE-EMAIL-HERE'));
-- update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'dob' - 'restricted' - 'adult_ack' where lower(email) = lower('PUT-THE-EMAIL-HERE');


-- ---------- 4 · Eight official allofus.one posts (labeled by voice: allofus System / allofus AI / Orbit) ----------
-- Posted by the founder account with extra.voice so each card shows who wrote it. No fake members, no fake counts.
-- Each one is inserted once (skipped when a row with the same extra.seed already exists), so re-running is safe.
do $$ declare v_founder uuid; r record; v_media_type text;
begin
  begin v_founder := public.founder_id(); exception when others then v_founder := null; end;
  if v_founder is null then select id into v_founder from auth.users where lower(email) in ('zachwennstedt@gmail.com','zach@eyetoad.com') order by created_at limit 1; end if;
  if v_founder is null then raise notice 'Founder account not found; v31 posts skipped.'; return; end if;
  select data_type into v_media_type from information_schema.columns where table_schema = 'public' and table_name = 'feed_posts' and column_name = 'media';
  for r in select * from (values
  ('v31-house-builder', 'post', 'Build your own home in the 3D World. Control panel → House builder + character → Build / design my house. Claim a lot with a green stake on Unity Road first, then pick a shape, walls, roof, garden and solar, and draw your own pool or pond: tap points or press and drag on the drawing pad. Save + build puts it on your lot for everyone walking by.', 'https://allofus.one/?v=panel#p-house', '[]'::jsonb, '{"big": "none"}'::jsonb, '{"voice": "system", "seed": "v31-house-builder", "official": true}'::jsonb, null::jsonb, '2026-11-03T07:30:00Z'::timestamptz, null::timestamptz),
  ('v31-world-open', 'post', 'The 3D World is open to everyone, no account needed: walk Unity Road, ride the coaster, swim the lakes, step into the mall. Accounts, chat, voice, messages and connections are for adults 18 and older.', 'https://allofus.one/world/', '[]'::jsonb, '{"big": "none"}'::jsonb, '{"voice": "system", "seed": "v31-world-open", "official": true}'::jsonb, null::jsonb, '2026-11-03T07:20:00Z'::timestamptz, null::timestamptz),
  ('v31-your-data', 'post', 'You are in control of your data here. Control panel → Account: download everything you posted as a file, or delete your account, sign-in included. Run a Brand page? Each page has its own Delete page button in its Manage bar.', 'https://allofus.one/?v=panel#p-account', '[]'::jsonb, '{"big": "none"}'::jsonb, '{"voice": "system", "seed": "v31-your-data", "official": true}'::jsonb, null::jsonb, '2026-11-03T07:10:00Z'::timestamptz, null::timestamptz),
  ('v31-orbit-shortcuts', 'post', 'Orbit here with three shortcuts people miss:
1. The search bar finds people, posts, Brand pages and Constellations at once.
2. Control panel → Everything on allofus lists every page in one place.
3. In the 3D World, the map button jumps you anywhere. No long walks unless you want one.', null, '[]'::jsonb, '{"big": "none"}'::jsonb, '{"voice": "orbit", "seed": "v31-orbit-shortcuts", "official": true}'::jsonb, null::jsonb, '2026-11-03T07:00:00Z'::timestamptz, null::timestamptz),
  ('v31-safety-habits', 'post', 'Five habits that keep you safe online:
1. Never share a sign-in code someone texts or emails you, even if they say they are support.
2. Check the full web address before you type a password.
3. Give your email its own password. It is the key to every other account.
4. Meeting someone from the internet? Pick a public place and tell a friend where you will be.
5. If something feels off, report it. On allofus.one a person reads every report.', null, '[]'::jsonb, '{"big": "none"}'::jsonb, '{"voice": "ai", "seed": "v31-safety-habits", "official": true}'::jsonb, null::jsonb, '2026-11-03T06:45:00Z'::timestamptz, null::timestamptz),
  ('v31-q-teach', 'post', 'Question of the day: what is one thing you could teach someone in ten minutes? A recipe, a shortcut, a knot, a phrase in another language. Drop it below. Someone here wants to learn it.', null, '[]'::jsonb, '{"big": "sky"}'::jsonb, '{"voice": "ai", "seed": "v31-q-teach", "official": true}'::jsonb, null::jsonb, '2026-11-03T06:30:00Z'::timestamptz, null::timestamptz),
  ('v31-poll-house', 'poll', 'What should the House builder get next?', null, '[]'::jsonb, '{"big": "none"}'::jsonb, '{"voice": "ai", "seed": "v31-poll-house", "official": true}'::jsonb, '{"options": ["Rooms you can walk into", "Furniture you place yourself", "A visitor guestbook by the door", "Seasonal decorations"], "counts": [0, 0, 0, 0], "voters": {}}'::jsonb, '2026-11-03T06:15:00Z'::timestamptz, null::timestamptz),
  ('v31-three-good', 'post', 'Weekly reset: write down three things that went right this week, however small. A good coffee counts. Writing them down makes them easier to notice next week. Share one here if you like.', null, '[]'::jsonb, '{"big": "sunset"}'::jsonb, '{"voice": "ai", "seed": "v31-three-good", "official": true}'::jsonb, null::jsonb, '2026-11-03T06:00:00Z'::timestamptz, null::timestamptz)
  ) as t(seed, kind, body, link, media, style, extra, poll, at, pub) loop
    if exists (select 1 from public.feed_posts where extra->>'seed' = r.seed) then continue; end if;
    begin
      if v_media_type = 'jsonb' then
        execute 'insert into public.feed_posts (user_id, kind, text, link, media, style, extra, poll, public, created_at, publish_at) values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)' using v_founder, r.kind, r.body, r.link, r.media, r.style, r.extra, r.poll, r.at, r.pub;
      else
        execute 'insert into public.feed_posts (user_id, kind, text, link, media, style, extra, poll, public, created_at, publish_at) values ($1,$2,$3,$4,array(select jsonb_array_elements_text($5)),$6,$7,$8,true,$9,$10)' using v_founder, r.kind, r.body, r.link, r.media, r.style, r.extra, r.poll, r.at, r.pub;
      end if;
    exception when others then raise notice 'v31 post % skipped: %', r.seed, sqlerrm; end;
  end loop;
end $$;

-- ---------- quick checks (read-only; run after the file if you like) ----------
-- select count(*) from public.page_retired;                               -- 1 or more (bighorn-painting)
-- select proname from pg_proc where proname in ('delete_page','delete_my_account','admin_reset_dob','restore_page_slug');  -- 4 rows
-- select count(*) from public.feed_posts where extra->>'seed' like 'v31-%';  -- 8

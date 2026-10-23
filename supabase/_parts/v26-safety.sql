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

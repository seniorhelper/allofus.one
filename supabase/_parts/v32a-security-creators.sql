-- ============================================================================================================
-- allofus.one · v32a (Nov 7 2026) · ADDITIVE part. Safe to run BEFORE the v32 site push (old pages keep working).
-- Run order on production: v31-pages-accounts.sql → v28-creator.sql → THIS FILE → push site + redeploy media-scan
--                          → v32b-lockdown.sql (the part that changes what old pages may read/write).
-- Idempotent: create … if not exists / create or replace / drop policy if exists. Drops no tables, deletes no rows.
--   1. Upload intake: new private bucket 'intake'. Pictures/videos/files wait there until the server scan says ok,
--      then the media-scan function publishes them into 'posts' / 'conference'. (Approved security finding #2.)
--   2. media_scan_result understands 'published' + keeps client-flagged (quarantine) items held for a human even when
--      the server scan is clean. (Finding #1; the function change is in supabase/functions/media-scan.)
--   3. my_profile() + my_referral_count(): own private profile fields through a function (needed before #3's grants).
--   4. Comment reactions (heart + allofus emblem) with a notification to the comment's author.
--   5. Creators Corner: logged clickwrap terms acceptance (version, time, user), applications that wait for Zach's
--      manual approval, admin queue + pending count. Tip buttons only for APPROVED creators. Money stays with creators.
--   6. Anonymous insert limits for bugs and ad_events (finding #6, part 1).
-- ============================================================================================================

-- ---------- 1 · upload intake bucket ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('intake', 'intake', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
do $$ begin
  update storage.buckets set allowed_mime_types = (
    select array_agg(distinct m) from (
      select unnest(allowed_mime_types) m from storage.buckets where id in ('posts', 'conference')) x)
   where id = 'intake';
exception when others then raise warning 'intake mime list not set: %', sqlerrm; end $$;

-- members put files at intake/<posts|conference>/<their id>/<name>; nobody reads or lists intake from the browser
drop policy if exists "v32 intake insert" on storage.objects;
create policy "v32 intake insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'intake'
  and (storage.foldername(name))[1] in ('posts', 'conference')
  and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
  and (public.is_admin() or public.safety_can_upload(auth.uid())));

-- storage intake trigger: intake objects get a media_items row whose url is the FUTURE public address;
-- the publish copy into posts/conference (done by the scanner) does not create a second row.
create or replace function public.safety_storage_intake() returns trigger
language plpgsql security definer set search_path = public, storage as $$
declare v_uid uuid; v_folder text; v_url text; v_target text; v_rest text;
        pub constant text := 'https://izfccjaznlcffvjxawya.supabase.co/storage/v1/object/public/';
begin
  if new.bucket_id = 'intake' then
    v_target := (storage.foldername(new.name))[1];
    if v_target not in ('posts', 'conference') then return new; end if;
    v_rest := substr(new.name, length(v_target) + 2);
    begin v_uid := ((storage.foldername(new.name))[2])::uuid; exception when others then v_uid := null; end;
    v_url := pub || v_target || '/' || v_rest;
    begin
      insert into public.media_items (user_id, bucket, path, url, mime, kind, surface, status, reason)
        values (v_uid, 'intake', new.name, v_url, coalesce(new.metadata->>'mimetype', null),
                case when coalesce(new.metadata->>'mimetype', '') like 'image/%' then 'image' when coalesce(new.metadata->>'mimetype', '') like 'video/%' then 'video' else 'file' end,
                'storage', 'pending', 'storage intake')
      on conflict (bucket, path) do nothing;
    exception when others then raise warning 'storage intake: %', sqlerrm; end;
    return new;
  end if;
  if new.bucket_id not in ('posts', 'conference') then return new; end if;
  v_folder := (storage.foldername(new.name))[1];
  begin v_uid := v_folder::uuid; exception when others then v_uid := null; end;
  v_url := pub || new.bucket_id || '/' || new.name;
  -- the scanner publishing an intake file: its row already exists (url = this address), so do nothing
  if exists (select 1 from public.media_items mi where mi.url = v_url and mi.bucket in ('intake', new.bucket_id)) then return new; end if;
  begin
    insert into public.media_items (user_id, bucket, path, url, mime, kind, surface, status, reason)
      values (v_uid, new.bucket_id, new.name, v_url, coalesce(new.metadata->>'mimetype', null),
              case when coalesce(new.metadata->>'mimetype', '') like 'image/%' then 'image' when coalesce(new.metadata->>'mimetype', '') like 'video/%' then 'video' else 'file' end,
              'storage', 'ok', 'storage intake')
    on conflict (bucket, path) do nothing;
  exception when others then raise warning 'storage intake: %', sqlerrm; end;
  return new;
end $$;

-- ---------- 2 · scan result: publish step + held items stay held ----------
create or replace function public.media_scan_result(p_media bigint, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare m public.media_items%rowtype; v_verdict text := lower(coalesce(p_result->>'verdict', 'error')); v_sha text := p_result->>'sha256'; v_ph text := p_result->>'phash';
        v_ev bigint; v_inc bigint; v_status text; v_blocked public.media_hashes%rowtype; v_qpath text; v_pb text := p_result->>'published_bucket'; v_pp text := p_result->>'published_path';
begin
  if not (public.safety_is_service() or public.is_admin()) then raise exception 'service role only'; end if;
  select * into m from public.media_items where id = p_media;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'no such media'); end if;
  if v_sha ~ '^[0-9a-f]{64}$' then
    select * into v_blocked from public.media_hashes h where h.sha256 = v_sha;
    if v_blocked.sha256 is not null then v_verdict := case when v_blocked.label = 'csam' then 'csam' else 'nsfw' end; p_result := p_result || jsonb_build_object('hash_match', v_blocked.label, 'hash_source', v_blocked.source); end if;
  end if;
  if v_blocked.sha256 is null and v_ph ~ '^[0-9a-f]{16}$' then
    select * into v_blocked from public.media_hashes h where h.phash = v_ph and h.label = 'csam' limit 1;
    if v_blocked.sha256 is not null then v_verdict := 'csam'; p_result := p_result || jsonb_build_object('hash_match', 'csam-phash', 'hash_source', v_blocked.source); end if;
  end if;
  v_status := case v_verdict when 'ok' then 'ok' when 'nsfw' then 'pending' when 'csam' then 'csam_suspect' else coalesce(nullif(m.status, 'ok'), 'pending') end;
  if v_verdict not in ('ok', 'nsfw', 'csam') and not public.safety_flag('server_scan_required') then v_status := m.status; end if;
  -- v32: a file the browser already flagged (quarantine bucket) stays held for a moderator even when the server scan is clean
  if m.bucket = 'quarantine' and v_verdict = 'ok' then v_status := m.status; end if;
  -- v32: an intake file that was NOT published (copy failed) must not go live
  if m.bucket = 'intake' and v_verdict = 'ok' and coalesce(v_pb, '') = '' then v_status := 'pending'; v_verdict := 'error'; p_result := p_result || '{"note":"scan ok but publish step failed"}'::jsonb; end if;
  update public.media_items set status = v_status, sha256 = coalesce(v_sha, sha256), phash = coalesce(v_ph, phash), scan = p_result, scanned_at = now(),
         scanner = coalesce(p_result->>'provider', 'media-scan'),
         reason = case when v_verdict = 'ok' then reason when m.bucket = 'quarantine' and lower(coalesce(p_result->>'verdict', '')) = 'ok' then 'server scan clean · waiting for a moderator (browser flagged it)' else coalesce(p_result->>'note', v_verdict) end
   where id = p_media;
  if v_verdict = 'ok' and m.bucket = 'intake' and v_pb in ('posts', 'conference') and coalesce(v_pp, '') <> '' then
    delete from public.media_items where bucket = v_pb and path = v_pp and id <> p_media;   -- an older row for a replaced file
    update public.media_items set bucket = v_pb, path = v_pp where id = p_media;
  end if;
  if v_verdict in ('nsfw', 'csam') then
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

-- ---------- 3 · own private profile fields through functions ----------
create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

create or replace function public.my_referral_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles p, public.profiles me
   where me.id = auth.uid() and me.username is not null and p.referred_by = me.username;
$$;
revoke all on function public.my_referral_count() from public, anon;
grant execute on function public.my_referral_count() to authenticated;

-- which of these members blocked ME (answers only about the caller; block lists themselves stay private)
create or replace function public.blocked_me_among(p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id), '{}'::uuid[]) from public.profiles p
   where auth.uid() is not null and p.id = any(p_ids[1:500]) and p.blocked::text[] @> array[auth.uid()::text];
$$;
revoke all on function public.blocked_me_among(uuid[]) from public, anon;
grant execute on function public.blocked_me_among(uuid[]) to authenticated;

-- ---------- 4 · comment reactions ----------
create table if not exists public.feed_comment_reactions (
  comment_id bigint not null references public.feed_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  emoji text not null check (emoji in ('heart', 'aou')),
  created_at timestamptz default now(),
  primary key (comment_id, user_id, emoji));
create index if not exists feed_comment_reactions_c on public.feed_comment_reactions (comment_id);
alter table public.feed_comment_reactions enable row level security;
revoke all on public.feed_comment_reactions from anon;
grant select, insert, delete on public.feed_comment_reactions to authenticated;
drop policy if exists "v32 cr read" on public.feed_comment_reactions;
create policy "v32 cr read" on public.feed_comment_reactions for select to authenticated
  using (exists (select 1 from public.feed_comments c where c.id = comment_id));   -- follows what the reader can see
drop policy if exists "v32 cr add" on public.feed_comment_reactions;
create policy "v32 cr add" on public.feed_comment_reactions for insert to authenticated
  with check (user_id = auth.uid() and (public.is_admin() or public.safety_is_adult(auth.uid()))
              and exists (select 1 from public.feed_comments c where c.id = comment_id and not public.safety_blocked(c.user_id, auth.uid())));
drop policy if exists "v32 cr remove" on public.feed_comment_reactions;
create policy "v32 cr remove" on public.feed_comment_reactions for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.feed_comment_reacted() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.feed_comments%rowtype; who text;
begin
  select * into c from public.feed_comments where id = new.comment_id;
  if c.id is null or c.user_id is null or c.user_id = new.user_id then return new; end if;
  -- one alert per person per comment
  if (select count(*) from public.feed_comment_reactions where comment_id = new.comment_id and user_id = new.user_id) > 1 then return new; end if;
  select coalesce(display_name, username, 'Someone') into who from public.profiles where id = new.user_id;
  begin
    perform public.notify(c.user_id, 'react', coalesce(who, 'Someone') || case when new.emoji = 'heart' then ' ❤️ your comment' else ' gave your comment an allofus ✦' end,
                          left(coalesce(c.body, ''), 120), '/?post=' || c.post_id, new.user_id);
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists feed_comment_reacted_v32 on public.feed_comment_reactions;
create trigger feed_comment_reacted_v32 after insert on public.feed_comment_reactions for each row execute function public.feed_comment_reacted();

-- rate limit: 300 comment reactions an hour per member
create or replace function public.feed_comment_react_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select count(*) into n from public.feed_comment_reactions where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if n >= 300 then raise exception 'Slow down: that is a lot of reactions for one hour.'; end if;
  return new;
end $$;
drop trigger if exists feed_comment_react_rate_v32 on public.feed_comment_reactions;
create trigger feed_comment_react_rate_v32 before insert on public.feed_comment_reactions for each row execute function public.feed_comment_react_rate();

-- ---------- 5 · Creators Corner: terms clickwrap + manual approval ----------
insert into public.safety_settings (key, value, secret) values ('creator_terms_version', '"creator-v2-2026-11-07"'::jsonb, false)
on conflict (key) do update set value = excluded.value;
-- open Creators Corner (v28 shipped the switch OFF); approval still gates every creator
insert into public.safety_settings (key, value, secret) values ('creator_tools', 'true'::jsonb, false)
on conflict (key) do update set value = 'true'::jsonb;

create table if not exists public.creator_terms_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  context text not null default 'apply');
create index if not exists creator_terms_acceptances_u on public.creator_terms_acceptances (user_id, accepted_at desc);
alter table public.creator_terms_acceptances enable row level security;
revoke all on public.creator_terms_acceptances from anon, authenticated;
grant select on public.creator_terms_acceptances to authenticated;
drop policy if exists "v32 terms own or admin" on public.creator_terms_acceptances;
create policy "v32 terms own or admin" on public.creator_terms_acceptances for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- append-only: no insert/update/delete policies; rows come only from creator_apply()

create table if not exists public.creator_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  about text, links text,
  terms_version text not null,
  terms_acceptance_id bigint references public.creator_terms_acceptances(id),
  applied_at timestamptz not null default now(),
  decided_at timestamptz, decided_by uuid, decision_note text);
alter table public.creator_applications enable row level security;
revoke all on public.creator_applications from anon, authenticated;
grant select on public.creator_applications to authenticated;
drop policy if exists "v32 apps own or admin" on public.creator_applications;
create policy "v32 apps own or admin" on public.creator_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.creator_is_approved(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creator_applications a where a.user_id = p_user and a.status = 'approved');
$$;
grant execute on function public.creator_is_approved(uuid) to anon, authenticated;

create or replace function public.creator_apply(p_about text, p_links text, p_terms_version text, p_user_agent text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_cur text; v_acc bigint; a public.creator_applications%rowtype; who text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if not (public.safety_is_adult(uid) or public.is_admin()) then raise exception 'Creators Corner is for confirmed adults (18+).'; end if;
  select value #>> '{}' into v_cur from public.safety_settings where key = 'creator_terms_version';
  if p_terms_version is null or p_terms_version <> v_cur then raise exception 'Please read and accept the current Creator Terms first.'; end if;
  if length(btrim(coalesce(p_about, ''))) < 10 then raise exception 'Tell us a little about what you create (a sentence or two).'; end if;
  select * into a from public.creator_applications where user_id = uid;
  if a.status = 'approved' then return jsonb_build_object('ok', true, 'status', 'approved'); end if;
  if a.status = 'pending' and a.applied_at > now() - interval '1 minute' then raise exception 'Already sent. Please wait for a reply.'; end if;
  if a.status = 'declined' and a.decided_at > now() - interval '7 days' then raise exception 'You can apply again 7 days after a decision.'; end if;
  insert into public.creator_terms_acceptances (user_id, terms_version, user_agent, context) values (uid, v_cur, left(p_user_agent, 300), 'apply') returning id into v_acc;
  insert into public.creator_applications as c (user_id, status, about, links, terms_version, terms_acceptance_id, applied_at, decided_at, decided_by, decision_note)
  values (uid, 'pending', left(btrim(p_about), 1000), left(btrim(coalesce(p_links, '')), 600), v_cur, v_acc, now(), null, null, null)
  on conflict (user_id) do update set status = 'pending', about = excluded.about, links = excluded.links, terms_version = excluded.terms_version,
     terms_acceptance_id = excluded.terms_acceptance_id, applied_at = now(), decided_at = null, decided_by = null, decision_note = null;
  select coalesce(display_name, username, 'A member') into who from public.profiles where id = uid;
  begin perform public.notify(public.founder_id(), 'mod', '🎨 New Creators Corner application: ' || coalesce(who, 'a member'), left(btrim(p_about), 160), '/?v=creator#cr-admin', uid); exception when others then null; end;
  begin perform public.audit_write('creator_apply', 'creator', uid::text, jsonb_build_object('terms_version', v_cur, 'acceptance_id', v_acc)); exception when others then null; end;
  return jsonb_build_object('ok', true, 'status', 'pending', 'acceptance_id', v_acc);
end $$;
revoke all on function public.creator_apply(text, text, text, text) from public, anon;
grant execute on function public.creator_apply(text, text, text, text) to authenticated;

create or replace function public.creator_my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'terms_version', (select value #>> '{}' from public.safety_settings where key = 'creator_terms_version'),
    'application', (select to_jsonb(a) - 'decided_by' from public.creator_applications a where a.user_id = auth.uid()),
    'accepted', (select jsonb_build_object('version', t.terms_version, 'at', t.accepted_at) from public.creator_terms_acceptances t where t.user_id = auth.uid() order by t.accepted_at desc limit 1));
$$;
revoke all on function public.creator_my_status() from public, anon;
grant execute on function public.creator_my_status() to authenticated;

create or replace function public.creator_pending_count() returns integer
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select count(*)::int from public.creator_applications where status = 'pending') else 0 end;
$$;
revoke all on function public.creator_pending_count() from public, anon;
grant execute on function public.creator_pending_count() to authenticated;

create or replace function public.admin_creator_applications(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'username', p.username, 'name', p.display_name, 'status', a.status,
            'about', a.about, 'links', a.links, 'terms_version', a.terms_version, 'applied_at', a.applied_at,
            'accepted_at', t.accepted_at, 'decided_at', a.decided_at, 'note', a.decision_note) order by a.applied_at)
     from public.creator_applications a left join public.profiles p on p.id = a.user_id
     left join public.creator_terms_acceptances t on t.id = a.terms_acceptance_id
    where p_status is null or a.status = p_status), '[]'::jsonb);
end $$;
revoke all on function public.admin_creator_applications(text) from public, anon;
grant execute on function public.admin_creator_applications(text) to authenticated;

create or replace function public.admin_creator_decide(p_user uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.creator_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.creator_applications set status = case when p_approve then 'approved' else 'declined' end, decided_at = now(), decided_by = auth.uid(), decision_note = left(p_note, 500)
   where user_id = p_user returning * into a;
  if a.user_id is null then raise exception 'no application from that member'; end if;
  if not p_approve then update public.creator_profiles set enabled = false, updated_at = now() where user_id = p_user; end if;
  begin perform public.notify(p_user, 'mod', case when p_approve then '🎉 You are in Creators Corner' else 'Your Creators Corner application' end,
     case when p_approve then 'Approved. Open Creators Corner to add your tip links and channels.' else coalesce(nullif(btrim(p_note), ''), 'Not approved this time. You can apply again in 7 days.') end, '/?v=creator', auth.uid()); exception when others then null; end;
  begin perform public.audit_write(case when p_approve then 'creator_approve' else 'creator_decline' end, 'creator', p_user::text, jsonb_build_object('note', p_note)); exception when others then null; end;
  return jsonb_build_object('ok', true, 'status', a.status);
end $$;
revoke all on function public.admin_creator_decide(uuid, boolean, text) from public, anon;
grant execute on function public.admin_creator_decide(uuid, boolean, text) to authenticated;

-- only approved creators can switch the Tip button on, connect channels or add posts to their profile
create or replace function public.creator_require_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.safety_is_service() or public.is_admin() then return new; end if;
  if tg_table_name = 'creator_profiles' and not coalesce(new.enabled, false) then return new; end if;
  if not public.creator_is_approved(new.user_id) then raise exception 'Creators Corner: your application is waiting for approval.'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['creator_profiles', 'creator_feeds', 'creator_feed_items'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists creator_require_approved_v32 on public.%I', t);
      execute format('create trigger creator_require_approved_v32 before insert or update on public.%I for each row execute function public.creator_require_approved()', t);
    end if;
  end loop;
end $$;

-- the public tip card: approved creators only; the "also tip allofus" line stays off until allofus has a live way to receive it
do $$ begin
  if to_regprocedure('public.creator_handle_url(text, text)') is not null then
    execute $f$
    create or replace function public.creator_card(p_user uuid) returns jsonb
    language plpgsql stable security definer set search_path = public as $b$
    declare c public.creator_profiles;
    begin
      if not public.safety_flag('creator_tools') and not public.is_admin() then return null; end if;
      if not public.creator_is_approved(p_user) then return null; end if;
      select * into c from public.creator_profiles where user_id = p_user and enabled;
      if not found or not public.safety_is_adult(p_user) then return null; end if;
      if auth.uid() is not null and public.safety_blocked(p_user, auth.uid()) then return null; end if;
      return jsonb_build_object('user_id', p_user, 'headline', c.headline, 'show_platform_tip', false,
        'handles', coalesce((select jsonb_agg(jsonb_build_object('kind', h.kind, 'url', public.creator_handle_url(h.kind, h.handle),
            'handle', case when h.kind in ('stripe', 'square') then null else h.handle end, 'verified', h.verified, 'business', h.is_business)
            order by array_position(array['venmo', 'paypal', 'cashapp', 'kofi', 'bmac', 'stripe', 'square'], h.kind))
          from public.creator_handles h where h.user_id = p_user and not h.hidden and h.live_at <= now()), '[]'::jsonb));
    end $b$;
    $f$;
    execute 'grant execute on function public.creator_card(uuid) to anon, authenticated';
  end if;
end $$;

-- ---------- 6 · anonymous insert limits (bugs, ad_events) ----------
create or replace function public.safety_anon_rate_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null or public.safety_is_service() then return new; end if;
  if tg_table_name = 'bugs' then
    begin execute 'select count(*) from public.bugs where user_id is null and created_at > now() - interval ''10 minutes''' into n; exception when others then n := 0; end;
    if n >= 20 then raise exception 'Too many reports right now. Please try again in a few minutes.'; end if;
  elsif tg_table_name = 'ad_events' then
    select count(*) into n from public.ad_events where at > now() - interval '1 minute';
    if n >= 600 then return null; end if;   -- drop silently: impressions are best-effort
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['bugs', 'ad_events'] loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('drop trigger if exists safety_anon_rate_v32 on public.%I', t);
        execute format('create trigger safety_anon_rate_v32 before insert on public.%I for each row execute function public.safety_anon_rate_guard()', t);
      exception when others then raise warning 'anon rate guard on %: %', t, sqlerrm; end;
    end if;
  end loop;
end $$;

-- ---------- quick checks (read-only) ----------
-- select id, public from storage.buckets order by id;
-- select public.creator_pending_count();

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

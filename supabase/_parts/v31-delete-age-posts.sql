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

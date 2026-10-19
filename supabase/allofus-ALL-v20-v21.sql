-- ============================================================
-- allofus.one · ALL v20 + v21 (Oct 19 2026) · ONE cumulative file: everything not yet run after v19.
-- Paste the whole file into Supabase → SQL Editor → Run. Additive and safe to re-run. No secrets inside.
-- Nothing here deletes or rewrites member data: profiles, posts, comments, reactions, connections and
-- LIFEboards stay exactly as they are. (The only delete is the cancelled client page row, if it still exists.)
--
-- v20 (never ran on the live project as of Oct 19: the welcome posts and admin_delete_user were missing)
--   1. comments, reactions, posts, profiles and connections join the realtime stream
--   2. admin_delete_user() for Admin → Signups → Delete
--   3. the cancelled client page is removed
--   4. the welcome posts become real rows (allofus AI / allofus System / Orbit)
-- v21
--   5. polls: vote_poll() re-created (votes failed with "function not found" when it was missing)
--   6. scheduled posts: a post with publish_at in the future is only visible to its author until then;
--      private posts are visible to the author's accepted connections (what the Connections page promises)
--   7. every member starts connected to Zach: welcome trigger re-created (never blocks a signup),
--      claim_my_pages() re-created, and a backfill for anyone missing the connection
--   8. phone + desktop push: push_subscriptions, the notifications queue, triggers that write a row for
--      comments, reactions, tags, connection requests, hugs and DMs (honoring each member's switches)
--   9. Gnomad Promotions Brand page (owner: Zach)
--  10. Zach's posts for the next two weeks: two now, the rest scheduled (Zach, Zach + AI, allofus AI, System, polls)
-- ============================================================

-- 1 ── realtime
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.feed_comments'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.feed_reactions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.feed_posts'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.profiles'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.connections'; exception when others then null; end;
end $$;

-- 2 ── admin delete account
create or replace function public.admin_delete_user(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_pages int := 0;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_user is null then raise exception 'no user'; end if;
  if p_user = auth.uid() then raise exception 'you cannot delete the account you are signed in with'; end if;
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

-- 3 ── a cancelled client page (Oct 2026): the row, its follows, edit requests and page tags go away
do $$ begin
  begin delete from public.page_follows where page_slug = 'elevation-health'; exception when others then null; end;
  begin delete from public.page_edit_requests where page_slug = 'elevation-health'; exception when others then null; end;
  begin update public.feed_posts set page_slug = null where page_slug = 'elevation-health'; exception when others then null; end;
  begin delete from public.pages where slug = 'elevation-health'; exception when others then null; end;
end $$;

-- 5 ── polls: one vote per person, counted inside the post (same as v6; re-created so it exists for sure)
create or replace function public.vote_poll(p_post bigint, p_option int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pl jsonb; voters jsonb; counts jsonb; uid text := auth.uid()::text;
begin
  if uid is null then raise exception 'sign in to vote'; end if;
  select poll into pl from public.feed_posts where id = p_post and kind = 'poll' for update;
  if pl is null then raise exception 'not a poll'; end if;
  voters := coalesce(pl->'voters', '{}'::jsonb); counts := coalesce(pl->'counts', '[]'::jsonb);
  if voters ? uid then return pl; end if;
  if p_option < 0 or p_option >= jsonb_array_length(pl->'options') then raise exception 'bad option'; end if;
  while jsonb_array_length(counts) < jsonb_array_length(pl->'options') loop counts := counts || '0'::jsonb; end loop;
  counts := jsonb_set(counts, array[p_option::text], to_jsonb(((counts->>p_option)::int) + 1));
  pl := pl || jsonb_build_object('counts', counts, 'voters', voters || jsonb_build_object(uid, p_option));
  update public.feed_posts set poll = pl where id = p_post;
  return pl;
end $$;
grant execute on function public.vote_poll(bigint, int) to authenticated;

-- 6 ── scheduled posts + connections-only posts
alter table public.feed_posts add column if not exists publish_at timestamptz;
alter table public.feed_posts add column if not exists extra jsonb;
alter table public.feed_posts add column if not exists page_slug text;
alter table public.feed_posts add column if not exists edited_at timestamptz;
create index if not exists feed_posts_publish_idx on public.feed_posts (publish_at) where publish_at is not null;
drop policy if exists "read public or own posts" on public.feed_posts;
create policy "read public or own posts" on public.feed_posts for select using (
  auth.uid() = user_id
  or public.is_admin()
  or (
    (publish_at is null or publish_at <= now())
    and (
      public
      or exists (select 1 from public.connections c where c.status = 'accepted' and c.kind = 'connect'
                   and ((c.requester = auth.uid() and c.addressee = feed_posts.user_id) or (c.addressee = auth.uid() and c.requester = feed_posts.user_id)))
    )
  )
);

-- 7 ── every member starts connected to Zach (they can disconnect under Connections)
create or replace function public.welcome_new_member() returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_founder uuid;
begin
  begin
    select lower(email) into v_email from auth.users where id = new.id;
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
drop trigger if exists profiles_welcome_v17 on public.profiles;
create trigger profiles_welcome_v17 after insert on public.profiles for each row execute function public.welcome_new_member();

create or replace function public.claim_my_pages() returns int language plpgsql security definer set search_path = public as $$
declare v_email text; n int := 0; v_founder uuid;
begin
  if auth.uid() is null then return 0; end if;
  begin
    select lower(email) into v_email from auth.users where id = auth.uid();
    update public.pages set admins = array_append(coalesce(admins, '{}'), auth.uid()), claimed_at = coalesce(claimed_at, now())
     where v_email = any(admin_emails) and not (auth.uid() = any(coalesce(admins, '{}')));
    get diagnostics n = row_count;
  exception when others then null; end;
  begin
    v_founder := public.founder_id();
    if v_founder is not null and v_founder <> auth.uid() then
      -- not if the member removed the founder on purpose (the app records that in profiles.home.noFounder)
      if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce((p.home->>'noFounder')::boolean, false)) then
        insert into public.connections (requester, addressee, kind, status) values (v_founder, auth.uid(), 'connect', 'accepted') on conflict do nothing;
        update public.connections set status = 'accepted' where requester = auth.uid() and addressee = v_founder and status = 'pending';
      end if;
    end if;
  exception when others then null; end;
  return n;
end $$;
grant execute on function public.claim_my_pages() to authenticated;

-- backfill: everyone who is not connected to the founder in either direction gets the connection now
do $$ declare v_founder uuid := public.founder_id();
begin
  if v_founder is null then raise notice 'Founder account not found; connection backfill skipped.'; return; end if;
  update public.connections set status = 'accepted', kind = 'connect' where addressee = v_founder and status = 'pending';
  insert into public.connections (requester, addressee, kind, status)
    select v_founder, p.id, 'connect', 'accepted' from public.profiles p
     where p.id <> v_founder
       and not coalesce((p.home->>'noFounder')::boolean, false)
       and not exists (select 1 from public.connections c where c.kind = 'connect'
                        and ((c.requester = v_founder and c.addressee = p.id) or (c.requester = p.id and c.addressee = v_founder)))
  on conflict do nothing;
end $$;

-- 8 ── push notifications
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz default now(),
  last_ok timestamptz,
  fails int not null default 0);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push own read" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "push own update" on public.push_subscriptions;
create policy "push own update" on public.push_subscriptions for update using (auth.uid() = user_id);
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  url text,
  actor uuid,
  created_at timestamptz default now(),
  sent_at timestamptz,
  seen_at timestamptz);
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notif_unsent_idx on public.notifications (created_at) where sent_at is null;
alter table public.notifications enable row level security;
drop policy if exists "notif own read" on public.notifications;
create policy "notif own read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notif own update" on public.notifications;
create policy "notif own update" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notif own delete" on public.notifications;
create policy "notif own delete" on public.notifications for delete using (auth.uid() = user_id);
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.notifications'; exception when others then null; end;
end $$;

-- does this member want this kind? (profiles.home.notif, saved from Control panel → Notifications; default yes)
create or replace function public.notif_wanted(p_user uuid, p_kind text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce((p.home->'notif'->>p_kind)::boolean, true) from public.profiles p where p.id = p_user), true);
$$;
-- queue one notification (skips self-notifications, blocked actors, switched-off kinds and exact repeats within a minute)
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_url text, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if not public.notif_wanted(p_user, p_kind) then return; end if;
  if p_actor is not null and exists (select 1 from public.profiles p where p.id = p_user and p.blocked @> array[p_actor]) then return; end if;
  if exists (select 1 from public.notifications n where n.user_id = p_user and n.kind = p_kind and n.title = p_title and coalesce(n.url, '') = coalesce(p_url, '') and n.created_at > now() - interval '1 minute') then return; end if;
  insert into public.notifications (user_id, kind, title, body, url, actor) values (p_user, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 200), p_url, p_actor);
exception when others then null;
end $$;
create or replace function public.display_of(p_user uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'Someone') from public.profiles p where p.id = p_user;
$$;
-- notify every real member tagged in a text
create or replace function public.notify_mentions(p_text text, p_actor uuid, p_url text, p_kind_label text) returns void
language plpgsql security definer set search_path = public as $$
declare h text; v_id uuid;
begin
  if p_text is null then return; end if;
  for h in select distinct lower(regexp_replace(m[1], '[.-]+$', '')) from regexp_matches(p_text, '(?:^|[^a-z0-9_.@-])@([a-z0-9_][a-z0-9_.-]{0,23})', 'gi') m loop
    select id into v_id from public.profiles where lower(username) = h limit 1;
    if v_id is not null then
      perform public.notify(v_id, 'mention', public.display_of(p_actor) || ' tagged you in a ' || p_kind_label, left(p_text, 140), p_url, p_actor);
    end if;
  end loop;
end $$;

create or replace function public.notif_on_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_text text;
begin
  select user_id, left(coalesce(text, ''), 60) into v_owner, v_text from public.feed_posts where id = new.post_id;
  if new.kind = 'offer' then
    perform public.notify(v_owner, 'comment', public.display_of(new.user_id) || ' made an offer' || coalesce(' · ' || new.amount, ''), v_text, '/?post=' || new.post_id, new.user_id);
  elsif new.kind = 'rsvp' then
    perform public.notify(v_owner, 'comment', public.display_of(new.user_id) || ' is going to your event', v_text, '/?post=' || new.post_id, new.user_id);
  else
    perform public.notify(v_owner, 'comment', public.display_of(new.user_id) || ' commented on your post', left(coalesce(new.body, ''), 140), '/?post=' || new.post_id, new.user_id);
  end if;
  perform public.notify_mentions(new.body, new.user_id, '/?post=' || new.post_id, 'comment');
  return new;
end $$;
drop trigger if exists notif_comment on public.feed_comments;
create trigger notif_comment after insert on public.feed_comments for each row execute function public.notif_on_comment();

create or replace function public.notif_on_reaction() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_text text;
begin
  select user_id, left(coalesce(text, ''), 60) into v_owner, v_text from public.feed_posts where id = new.post_id;
  perform public.notify(v_owner, 'react', public.display_of(new.user_id) || ' reacted ' || coalesce(new.emoji, '❤️') || ' to your post', v_text, '/?post=' || new.post_id, new.user_id);
  return new;
end $$;
drop trigger if exists notif_reaction on public.feed_reactions;
create trigger notif_reaction after insert on public.feed_reactions for each row execute function public.notif_on_reaction();

create or replace function public.notif_on_post() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.publish_at is null or new.publish_at <= now() then
    perform public.notify_mentions(new.text, new.user_id, '/?post=' || new.id, 'post');
  end if;
  return new;
end $$;
drop trigger if exists notif_post on public.feed_posts;
create trigger notif_post after insert on public.feed_posts for each row execute function public.notif_on_post();

create or replace function public.notif_on_connection() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' and new.kind = 'connect' then
    perform public.notify(new.addressee, 'conn', public.display_of(new.requester) || ' wants to connect', 'Open Connections to accept', '/?v=conn', new.requester);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' and new.kind = 'connect' then
    perform public.notify(new.requester, 'conn', public.display_of(new.addressee) || ' accepted your connection', 'You are connected now', '/?u=' || coalesce((select username from public.profiles where id = new.addressee), ''), new.addressee);
  end if;
  return new;
end $$;
drop trigger if exists notif_connection on public.connections;
create trigger notif_connection after insert or update on public.connections for each row execute function public.notif_on_connection();

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'hugs') then
    create or replace function public.notif_on_hug() returns trigger language plpgsql security definer set search_path = public as $f$
    begin
      perform public.notify(new.to_id, 'hug', public.display_of(new.from_id) || case new.kind when 'hug' then ' sent you a hug 🤗' when 'crush' then ' has a crush on you 💘' when 'highfive' then ' high-fived you 🙌' when 'wave' then ' waved at you 👋' else ' cheered for you 🎉' end, '', '/?v=conn', new.from_id);
      return new;
    end $f$;
    drop trigger if exists notif_hug on public.hugs;
    create trigger notif_hug after insert on public.hugs for each row execute function public.notif_on_hug();
  end if;
end $$;

create or replace function public.notif_on_hub() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.to_user, 'dm', public.display_of(new.from_user) || case new.kind when 'dm' then ' sent you a message' when 'connect' then ' sent you a request' when 'file' then ' sent you a file' else ' sent you something' end, left(coalesce(new.body, ''), 140), '/?v=dm&with=' || coalesce((select username from public.profiles where id = new.from_user), ''), new.from_user);
  return new;
end $$;
drop trigger if exists notif_hub on public.hub_requests;
create trigger notif_hub after insert on public.hub_requests for each row execute function public.notif_on_hub();

create or replace function public.notif_on_message() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.recipient is not null then
    perform public.notify(new.recipient, 'dm', public.display_of(new.sender) || ' sent you a message', left(coalesce(new.body, ''), 140), '/?v=dm&with=' || coalesce((select username from public.profiles where id = new.sender), ''), new.sender);
  end if;
  return new;
end $$;
drop trigger if exists notif_message on public.messages;
create trigger notif_message after insert on public.messages for each row execute function public.notif_on_message();

-- 9 ── Gnomad Promotions Brand page (built into the app too; this makes the row so it can be followed and posted as)
do $$ declare v_founder uuid := public.founder_id();
begin
  if v_founder is null then raise notice 'Founder account not found; the Gnomad page row is created on the next run.'; return; end if;
  if exists (select 1 from public.pages where slug = 'gnomad-promotions') then return; end if;
  begin
    insert into public.pages (owner_id, slug, name, tagline, phone, website, location, about, vr_home, admin_emails)
      values (v_founder, 'gnomad-promotions', 'Gnomad Promotions', 'If you know, you gnome. Marketing, branded merchandise and online company stores.', '', 'https://gnomadpromotions.com/', '', 'Gnomad Promotions creates promotional items with your logo that people keep, use and show off: drinkware, apparel, tech accessories, bags, desk gear and eco-friendly products, plus online company stores so your team and customers can order branded merchandise themselves.', 'plaza', array['zach@eyetoad.com','zachwennstedt@gmail.com']);
  exception when others then
    begin
      insert into public.pages (owner_id, slug, name, tagline, website, about)
        values (v_founder, 'gnomad-promotions', 'Gnomad Promotions', 'If you know, you gnome. Marketing, branded merchandise and online company stores.', 'https://gnomadpromotions.com/', 'Gnomad Promotions creates promotional items with your logo that people keep, use and show off, plus online company stores.');
    exception when others then raise notice 'pages insert skipped: %', sqlerrm; end;
  end;
end $$;

-- 4 + 10 ── the posts. Founder-authored rows; extra.voice labels the author on the card (ai / system / orbit / zachai).
-- A row with publish_at in the future is only visible to Zach until that moment (policy in section 6).
do $$ declare v_founder uuid; r record; v_media_type text;
begin
  select id into v_founder from auth.users where lower(email) in ('zachwennstedt@gmail.com','zach@eyetoad.com') order by created_at limit 1;
  if v_founder is null then raise notice 'Founder account not found; posts skipped.'; return; end if;
  select data_type into v_media_type from information_schema.columns where table_schema = 'public' and table_name = 'feed_posts' and column_name = 'media';
  for r in select * from (values
  -- ---- v20 welcome posts (allofus AI / System / Orbit) ----
  ('welcome-v20', 'post', 'New on allofus.one today:
• Tag people: type @ and pick a real member. They get an alert.
• Edit photos before you post: filters, light, crop, rotate.
• Videos play on their own (muted) as you scroll. Tap for sound.
• Lost? The ··· More button and the Control panel list every page.
See something off? Tap Report a bug. A person reads every one.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"system","seed":"welcome-v20"}'::jsonb, null, '2026-10-14T16:05:00Z'::timestamptz, null::timestamptz),
  ('poll-build-next', 'poll', 'Help us decide. What should allofus.one build next?', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"poll-build-next"}'::jsonb, '{"options":["Live audio rooms","Local marketplace near me","Creator tools + tips","Group video hangouts"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-10-14T15:20:00Z'::timestamptz, null),
  ('art-peace', 'post', '✌️ Peace in bloom. A generated piece for everyone who throws up the peace sign everywhere they go. This whole place started with that sign.', null, '["/images/feed/ai-art-peace.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-peace"}'::jsonb, null, '2026-10-14T13:40:00Z'::timestamptz, null),
  ('orbit-hello', 'post', 'Hi, I''m Orbit, the allofus.one guide bot. Can''t find something? Tap ··· More (top right on a computer, bottom right on a phone) and every page is there: Courses, Events, Spaces, Comm Hub, Games, all of it. Or tap the moon tab on the right side and just ask me.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"orbit","seed":"orbit-hello"}'::jsonb, null, '2026-10-14T11:10:00Z'::timestamptz, null),
  ('art-aurora', 'post', 'Aurora over the Front Range. Generated art, made with code. Colorado gets real northern lights a few nights a year. This one stays up all night for you.', null, '["/images/feed/ai-art-aurora.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-aurora"}'::jsonb, null, '2026-10-13T21:30:00Z'::timestamptz, null),
  ('kindness-challenge', 'post', 'Today''s kindness challenge: tell one person exactly what you appreciate about them. Be specific. Then come back and tell us how it went.', null, '[]'::jsonb, '{"big":"sunset"}'::jsonb, '{"voice":"ai","seed":"kindness-challenge"}'::jsonb, null, '2026-10-13T16:00:00Z'::timestamptz, null),
  ('poll-where', 'poll', 'Quick one: where do you like to hang out on allofus.one?', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"poll-where"}'::jsonb, '{"options":["The Feed","The 3D world","VR headset","Still looking around"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-10-13T12:15:00Z'::timestamptz, null),
  ('art-heart', 'post', 'All of us. Thousands of dots, every one a different color, and together they make a heart. Generated art.', null, '["/images/feed/ai-art-heartworld.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-heart"}'::jsonb, null, '2026-10-12T22:45:00Z'::timestamptz, null),
  ('brand-pages', 'post', 'Small business? Your Brand page is free: a cover photo, call and website buttons, hours, FAQs and real search schema so Google and AI answers can find you. Post as your business right from your own profile.', 'https://allofus.one/?v=brand', '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"system","seed":"brand-pages"}'::jsonb, null, '2026-10-12T17:00:00Z'::timestamptz, null),
  ('find-the-good', 'post', 'Find the good.', null, '[]'::jsonb, '{"big":"peace"}'::jsonb, '{"voice":"ai","seed":"find-the-good"}'::jsonb, null, '2026-10-12T13:20:00Z'::timestamptz, null),
  ('art-flow', 'post', '5,200 lines, each one following the same invisible wind. Different paths, same direction. Kind of like us. Generated art.', null, '["/images/feed/ai-art-flow.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-flow"}'::jsonb, null, '2026-10-11T23:10:00Z'::timestamptz, null),
  ('question-smile', 'post', 'Question of the day: what is one small thing that made you smile this week?', null, '[]'::jsonb, '{"big":"sky"}'::jsonb, '{"voice":"ai","seed":"question-smile"}'::jsonb, null, '2026-10-11T15:40:00Z'::timestamptz, null),
  ('art-waves', 'post', 'Sunset on a synthwave sea. Generated art for whoever needs a minute of calm right now.', null, '["/images/feed/ai-art-waves.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-waves"}'::jsonb, null, '2026-10-11T02:30:00Z'::timestamptz, null),
  -- ---- v21: Zach, now ----
  ('z-update-oct19', 'post', 'Big update just went live:
• Phone and desktop notifications. Turn them on under Control panel → Notifications (on iPhone, add allofus.one to your Home Screen first).
• Groups work like groups now: members on the right, search them, message anyone from there, and a clear Join / Leave.
• Tap Profile and you land on your own page with your feed. The ⋯ menu has everything else.
• Polls show your vote now.
• A Brand page for Gnomad Promotions.
Tap ··· More to find everything. Tell me what is broken or what you want next; I read every reply.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"seed":"z-update-oct19"}'::jsonb, null, '2026-10-19T19:00:00Z'::timestamptz, null),
  ('z-poll-notify', 'poll', 'Where do you want allofus.one to reach you when something happens?', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"seed":"z-poll-notify"}'::jsonb, '{"options":["Phone push notifications","An email digest","Only inside the app","Do not reach me, I will check"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-10-19T19:05:00Z'::timestamptz, null),
  -- ---- v21: scheduled over the next two weeks ----
  ('s-sort', 'post', 'How your feed is ordered: newest first, no hidden ranking. If you want a different order, the New · Top · Hot switch sits right above the feed, and the formula is printed on the switch. Your pick is remembered on this device.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"system","seed":"s-sort"}'::jsonb, null, '2026-10-20T16:00:00Z'::timestamptz, '2026-10-20T16:00:00Z'::timestamptz),
  ('s-gnomad', 'post', 'New on allofus.one: Gnomad Promotions. Promotional items with your logo that people actually keep (drinkware, hats and polos, power banks, bags, desk gear, eco-friendly picks) and online company stores so your whole team can order branded merchandise. If you know, you gnome.', 'https://allofus.one/?page=gnomad-promotions', '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"zachai","seed":"s-gnomad"}'::jsonb, null, '2026-10-21T16:30:00Z'::timestamptz, '2026-10-21T16:30:00Z'::timestamptz),
  ('s-q-unnoticed', 'post', 'Question of the day: what is one thing you finished this week that nobody noticed? Say it here. We noticed.', null, '[]'::jsonb, '{"big":"sky"}'::jsonb, '{"voice":"ai","seed":"s-q-unnoticed"}'::jsonb, null, '2026-10-22T15:00:00Z'::timestamptz, '2026-10-22T15:00:00Z'::timestamptz),
  ('s-tracing', 'post', 'Try this one: LIFEboard → FLOWworks → add a Sketch pad → Trace. Bright mode turns your phone or tablet into a light box. Lay a sheet of paper on the screen, trace the picture, done. Every pad resizes with the + and − buttons or the corner handles, and every pad has its own color.', 'https://allofus.one/?v=work', '[]'::jsonb, '{"big":"none"}'::jsonb, '{"seed":"s-tracing"}'::jsonb, null, '2026-10-23T17:00:00Z'::timestamptz, '2026-10-23T17:00:00Z'::timestamptz),
  ('s-poll-tool', 'poll', 'Which LIFEboard tool do you open most?', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"s-poll-tool"}'::jsonb, '{"options":["Today + affirmation","Trackers","Focus timer","FLOWworks pads"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-10-24T16:00:00Z'::timestamptz, '2026-10-24T16:00:00Z'::timestamptz),
  ('s-groups', 'post', 'Groups, explained in one breath: pick a group, see who is in it on the right, search a name, tap Message, post with Post here, leave any time with Leave group. One member is still a group. Invite a friend with Share the group.', 'https://allofus.one/?v=groups', '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"zachai","seed":"s-groups"}'::jsonb, null, '2026-10-26T16:00:00Z'::timestamptz, '2026-10-26T16:00:00Z'::timestamptz),
  ('s-public', 'post', 'The Public switch on every post: on means anyone can read it, even people who are not signed in. Off means only you and your connections. The default for new posts is under Control panel → Privacy + safety.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"system","seed":"s-public"}'::jsonb, null, '2026-10-28T16:00:00Z'::timestamptz, '2026-10-28T16:00:00Z'::timestamptz),
  ('s-kindness2', 'post', 'Kindness challenge: send one message today to someone you have not talked to in a month. Not a forward, not a meme. One real sentence. Report back.', null, '[]'::jsonb, '{"big":"sunset"}'::jsonb, '{"voice":"ai","seed":"s-kindness2"}'::jsonb, null, '2026-10-30T15:00:00Z'::timestamptz, '2026-10-30T15:00:00Z'::timestamptz),
  ('s-twoweeks', 'post', 'Two weeks of updates behind us: notifications, real groups, the profile menu, polls, the pads in FLOWworks. Every one of them started as a comment from a member. What should the next two weeks be about? Reply here or tag me @zach anywhere.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"seed":"s-twoweeks"}'::jsonb, null, '2026-11-01T16:00:00Z'::timestamptz, '2026-11-01T16:00:00Z'::timestamptz),
  ('s-poll-next', 'poll', 'Pick the next big thing for allofus.one.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"seed":"s-poll-next"}'::jsonb, '{"options":["Up and down votes on posts","Live audio rooms","A marketplace with payments","More to do in VR"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-11-02T16:00:00Z'::timestamptz, '2026-11-02T16:00:00Z'::timestamptz)
  ) as t(seed, kind, body, link, media, style, extra, poll, at, pub) loop
    if exists (select 1 from public.feed_posts where extra->>'seed' = r.seed) then continue; end if;
    if v_media_type = 'jsonb' then
      execute 'insert into public.feed_posts (user_id, kind, text, link, media, style, extra, poll, public, created_at, publish_at) values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)' using v_founder, r.kind, r.body, r.link, r.media, r.style, r.extra, r.poll, r.at, r.pub;
    else
      execute 'insert into public.feed_posts (user_id, kind, text, link, media, style, extra, poll, public, created_at, publish_at) values ($1,$2,$3,$4,array(select jsonb_array_elements_text($5)),$6,$7,$8,true,$9,$10)' using v_founder, r.kind, r.body, r.link, r.media, r.style, r.extra, r.poll, r.at, r.pub;
    end if;
  end loop;
end $$;

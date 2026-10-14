-- allofus.one v20 (Oct 14 2026) · additive and safe to re-run. Run in Supabase → SQL Editor after v19.
-- 1. Live alerts: comments and reactions join the realtime stream (tags, comments and reactions pop up live).
-- 2. Admin: delete an account from the dashboard (Signups → Delete). Pages the account owns move to you first.
-- 3. Elevation Health cancelled: its Brand page, follows and pre-linked emails are removed.
-- 4. The welcome posts: labeled allofus AI / allofus System posts so the feed is not empty (real rows, so people can
--    react, comment and vote). Posted from the founder account and marked in extra.voice; delete any of them like a normal post.

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
  -- Brand pages are kept: the signed-in admin becomes the owner
  begin
    update public.pages set owner_id = auth.uid() where owner_id = p_user;
    get diagnostics v_pages = row_count;
    update public.pages set admins = array_remove(admins, p_user) where p_user = any(admins);
  exception when others then null; end;
  delete from auth.users where id = p_user;          -- cascades to profiles, posts, comments, reactions, connections…
  delete from public.profiles where id = p_user;     -- a profile without a sign-in row
  return 'deleted ' || coalesce(v_email, p_user::text) || case when v_pages > 0 then ' · ' || v_pages || ' page(s) moved to you' else '' end;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 3 ── Elevation Health (cancelled Oct 13 2026)
do $$ begin
  begin delete from public.page_follows where page_slug = 'elevation-health'; exception when others then null; end;
  begin delete from public.page_edit_requests where page_slug = 'elevation-health'; exception when others then null; end;
  begin update public.feed_posts set page_slug = null where page_slug = 'elevation-health'; exception when others then null; end;
  begin delete from public.pages where slug = 'elevation-health'; exception when others then null; end;
end $$;

-- 4 ── the welcome posts (labeled allofus AI / allofus System / Orbit). Skips any that already exist (extra->>'seed').
do $$ declare v_founder uuid; r record; v_media_type text;
begin
  select id into v_founder from auth.users where lower(email) in ('zachwennstedt@gmail.com','zach@eyetoad.com') order by created_at limit 1;
  if v_founder is null then raise notice 'Founder account not found; welcome posts skipped.'; return; end if;
  select data_type into v_media_type from information_schema.columns where table_schema = 'public' and table_name = 'feed_posts' and column_name = 'media';
  for r in select * from (values
  ('welcome-v20', 'post', 'New on allofus.one today:
• Tag people: type @ and pick a real member. They get an alert.
• Edit photos before you post: filters, light, crop, rotate.
• Videos play on their own (muted) as you scroll. Tap for sound.
• Lost? The ··· More button and the Control panel list every page.
See something off? Tap Report a bug. A person reads every one.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"system","seed":"welcome-v20"}'::jsonb, null, '2026-10-14T16:05:00Z'::timestamptz),
  ('poll-build-next', 'poll', 'Help us decide. What should allofus.one build next?', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"poll-build-next"}'::jsonb, '{"options":["Live audio rooms","Local marketplace near me","Creator tools + tips","Group video hangouts"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-10-14T15:20:00Z'::timestamptz),
  ('art-peace', 'post', '✌️ Peace in bloom. A generated piece for everyone who throws up the peace sign everywhere they go. This whole place started with that sign.', null, '["/images/feed/ai-art-peace.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-peace"}'::jsonb, null, '2026-10-14T13:40:00Z'::timestamptz),
  ('orbit-hello', 'post', 'Hi, I''m Orbit, the allofus.one guide bot. Can''t find something? Tap ··· More (top right on a computer, bottom right on a phone) and every page is there: Courses, Events, Spaces, Comm Hub, Games, all of it. Or tap the moon tab on the right side and just ask me.', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"orbit","seed":"orbit-hello"}'::jsonb, null, '2026-10-14T11:10:00Z'::timestamptz),
  ('art-aurora', 'post', 'Aurora over the Front Range. Generated art, made with code. Colorado gets real northern lights a few nights a year. This one stays up all night for you.', null, '["/images/feed/ai-art-aurora.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-aurora"}'::jsonb, null, '2026-10-13T21:30:00Z'::timestamptz),
  ('kindness-challenge', 'post', 'Today''s kindness challenge: tell one person exactly what you appreciate about them. Be specific. Then come back and tell us how it went.', null, '[]'::jsonb, '{"big":"sunset"}'::jsonb, '{"voice":"ai","seed":"kindness-challenge"}'::jsonb, null, '2026-10-13T16:00:00Z'::timestamptz),
  ('poll-where', 'poll', 'Quick one: where do you like to hang out on allofus.one?', null, '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"poll-where"}'::jsonb, '{"options":["The Feed","The 3D world","VR headset","Still looking around"],"counts":[0,0,0,0],"voters":{}}'::jsonb, '2026-10-13T12:15:00Z'::timestamptz),
  ('art-heart', 'post', 'All of us. Thousands of dots, every one a different color, and together they make a heart. Generated art.', null, '["/images/feed/ai-art-heartworld.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-heart"}'::jsonb, null, '2026-10-12T22:45:00Z'::timestamptz),
  ('brand-pages', 'post', 'Small business? Your Brand page is free: a cover photo, call and website buttons, hours, FAQs and real search schema so Google and AI answers can find you. Post as your business right from your own profile.', 'https://allofus.one/?v=brand', '[]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"system","seed":"brand-pages"}'::jsonb, null, '2026-10-12T17:00:00Z'::timestamptz),
  ('find-the-good', 'post', 'Find the good.', null, '[]'::jsonb, '{"big":"peace"}'::jsonb, '{"voice":"ai","seed":"find-the-good"}'::jsonb, null, '2026-10-12T13:20:00Z'::timestamptz),
  ('art-flow', 'post', '5,200 lines, each one following the same invisible wind. Different paths, same direction. Kind of like us. Generated art.', null, '["/images/feed/ai-art-flow.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-flow"}'::jsonb, null, '2026-10-11T23:10:00Z'::timestamptz),
  ('question-smile', 'post', 'Question of the day: what is one small thing that made you smile this week?', null, '[]'::jsonb, '{"big":"sky"}'::jsonb, '{"voice":"ai","seed":"question-smile"}'::jsonb, null, '2026-10-11T15:40:00Z'::timestamptz),
  ('art-waves', 'post', 'Sunset on a synthwave sea. Generated art for whoever needs a minute of calm right now.', null, '["/images/feed/ai-art-waves.webp"]'::jsonb, '{"big":"none"}'::jsonb, '{"voice":"ai","seed":"art-waves"}'::jsonb, null, '2026-10-11T02:30:00Z'::timestamptz)
  ) as t(seed, kind, body, link, media, style, extra, poll, at) loop
    if exists (select 1 from public.feed_posts where extra->>'seed' = r.seed) then continue; end if;
    if v_media_type = 'jsonb' then
      execute 'insert into public.feed_posts (user_id, kind, text, link, media, style, extra, poll, public, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)' using v_founder, r.kind, r.body, r.link, r.media, r.style, r.extra, r.poll, r.at;
    else
      execute 'insert into public.feed_posts (user_id, kind, text, link, media, style, extra, poll, public, created_at) values ($1,$2,$3,$4,array(select jsonb_array_elements_text($5)),$6,$7,$8,true,$9)' using v_founder, r.kind, r.body, r.link, r.media, r.style, r.extra, r.poll, r.at;
    end if;
  end loop;
end $$;

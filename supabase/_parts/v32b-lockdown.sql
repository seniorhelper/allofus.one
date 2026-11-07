-- ============================================================================================================
-- allofus.one · v32b (Nov 7 2026) · LOCKDOWN part. Run AFTER the v32 site push (allofus.one and worldvrmall.com)
-- and after the media-scan function is redeployed. Older cached pages may show errors until they reload.
-- Idempotent. Approved by Zach Nov 7 2026 (security findings #2, #3, #6).
--   1. Profiles: everyone may read only the public profile fields. Private fields (block list, age level, e-mail opt-in,
--      ad preferences, who referred you) are readable only by their owner through my_profile().
--   2. Feed, comments, reactions, Rooms chat and room messages: signed-in confirmed adults only (own rows always).
--   3. Uploads: members can no longer write straight into the public posts / conference buckets; everything goes
--      through the private intake bucket and the server scan (v32a). Admins and the scanner still can.
--   4. store_scans: signed-in members only.
-- ============================================================================================================

-- ---------- 1 · profile column grants ----------
do $$ declare cols text; begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('blocked', 'email_optin', 'email_optin_at', 'ad_pref', 'ad_filters', 'age_level', 'referred_by');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to anon, authenticated', cols);
end $$;

-- ---------- 2 · members-only reading (restrictive policies AND with the existing ones) ----------
do $$ declare t text; begin
  foreach t in array array['feed_posts', 'feed_comments', 'feed_reactions', 'hub_messages'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', 'v32 members 18+ read', t);
      execute format('create policy %I on public.%I as restrictive for select to public using (auth.uid() is not null and (user_id = auth.uid() or (select public.is_admin()) or (select public.safety_is_adult(auth.uid()))))', 'v32 members 18+ read', t);
    end if;
  end loop;
  if to_regclass('public.messages') is not null then
    drop policy if exists "v32 members 18+ read" on public.messages;
    create policy "v32 members 18+ read" on public.messages as restrictive for select to public
      using (auth.uid() is not null and (auth.uid() = sender or auth.uid() = recipient or (select public.is_admin()) or (select public.safety_is_adult(auth.uid()))));
  end if;
end $$;
revoke select on public.feed_posts, public.feed_comments, public.feed_reactions, public.hub_messages, public.messages from anon;

-- ---------- 3 · uploads only through intake ----------
drop policy if exists "posts upload own" on storage.objects;
drop policy if exists "conference upload own folder" on storage.objects;
-- (kept: "v26 admin put public media" for admins; the service role used by media-scan bypasses policies)

-- ---------- 4 · store_scans: signed-in only ----------
do $$ begin
  if to_regclass('public.store_scans') is not null then
    drop policy if exists "scans insert anyone signed in or anon" on public.store_scans;
    drop policy if exists "v32 scans insert signed in" on public.store_scans;
    create policy "v32 scans insert signed in" on public.store_scans for insert to authenticated with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));
    revoke insert on public.store_scans from anon;
  end if;
end $$;

-- ---------- quick checks (read-only) ----------
-- select has_column_privilege('anon', 'public.profiles', 'blocked', 'select') as anon_blocked, has_column_privilege('anon', 'public.profiles', 'username', 'select') as anon_username;
-- select policyname from pg_policies where policyname like 'v32%';

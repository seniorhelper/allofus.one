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

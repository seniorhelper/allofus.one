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

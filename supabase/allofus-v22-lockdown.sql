-- ============================================================
-- allofus.one · v22 lockdown (Oct 19 2026). Run once in Supabase → SQL Editor after allofus-ALL-v20-v21.sql.
-- Additive and safe to re-run. Touches no posts, comments, reactions, connections or LIFEboard goals.
--
-- Why: admin rights were tied to two e-mail addresses. A second account that signed up with one of those
-- addresses (the "phoenix" account) was therefore treated as the founder and silently added as a manager
-- of every Brand page. From now on:
--   1. the founder is ONE account id (the @zach profile), not an e-mail; is_admin() checks that id;
--   2. the founder's e-mails no longer pre-link anyone; only real clients stay in admin_emails;
--   3. every Brand page's manager list is reduced to its owner plus accounts whose e-mail is a real
--      pre-linked client e-mail (today: Raised In a Barn);
--   4. FLOWworks pads move from profiles.home.work (world-readable) into lifeboards (private to the member).
-- ============================================================

-- 1 ── the founder is an account, not an e-mail
create or replace function public.founder_id() returns uuid language sql stable as $$
  select '320bf5d4-2d2d-482e-8633-87ced55e4155'::uuid;
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() = '320bf5d4-2d2d-482e-8633-87ced55e4155'::uuid, false);
$$;

-- 2 ── the founder's e-mails pre-link nobody
update public.pages
   set admin_emails = array(select e from unnest(coalesce(admin_emails, '{}')) e where lower(e) not in ('zach@eyetoad.com', 'zachwennstedt@gmail.com'))
 where admin_emails is not null;

-- 3 ── managers = the owner + accounts whose e-mail is a real pre-linked client e-mail
update public.pages p
   set admins = array(
     select a from unnest(coalesce(p.admins, '{}')) a
      where a = p.owner_id
         or exists (select 1 from auth.users u where u.id = a and lower(u.email) = any(coalesce(p.admin_emails, '{}')))
   );
-- any page not owned by the founder stays with its owner; nothing else changes

-- 4 ── FLOWworks pads: private table, not the public profile
insert into public.lifeboards (id, data, updated_at)
  select id, jsonb_build_object('work', home->'work'), now() from public.profiles where home ? 'work'
  on conflict (id) do update
    set data = coalesce(public.lifeboards.data, '{}'::jsonb)
             || case when coalesce(public.lifeboards.data, '{}'::jsonb) ? 'work' then '{}'::jsonb else jsonb_build_object('work', excluded.data->'work') end,
        updated_at = now();
update public.profiles set home = home - 'work' where home ? 'work';

-- 5 ── the welcome trigger and claim_my_pages keep working: with the founder e-mails gone from admin_emails,
--      only real client e-mails attach a manager. Re-run of ALL-v20-v21 later is still safe.

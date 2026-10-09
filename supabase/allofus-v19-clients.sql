-- allofus.one v19 · clients · Oct 9 2026 · Safe to re-run. Run AFTER v17 and v18 (then allofus-v19-comm.sql).
-- ADDITIVE ONLY: no table is dropped, no column removed, no row deleted. Existing accounts, posts,
-- connections, pages and land are untouched. Every statement is `if not exists`, `on conflict`,
-- `create or replace` or `drop policy if exists` + recreate. New policies only widen what is allowed.
--
-- What it does
--   1. Defensive columns on `pages` (no-ops after v17/v18).
--   2. Raised In a Barn Furniture (slug raised-in-a-barn): Ritchie's email is pre-linked as a manager,
--      Zach's two emails stay, VR home = 'art' (the Art Garden: handcrafted work). If an older row was saved
--      under the built-in slug raised-in-a-barn-furniture and no raised-in-a-barn row exists, it is renamed.
--   3. Elevation Health: Meredith + Lindsay stay pre-linked (owner stays Zach).
--   4. Anyone on any page's admin_emails who ALREADY has an account is linked into pages.admins right now.
--   5. Pre-linked emails may edit (and post as) their page even before the account is linked
--      (policy on the signed-in email claim). Keep "Confirm email" ON in Supabase Auth so nobody can
--      sign up with an address they do not own.
--   6. welcome_new_member / claim_my_pages re-created with three fixes:
--      a. `on conflict do nothing` (no target): v11's connections_pair_uidx is an UNORDERED pair index, so
--         v17's `on conflict (requester, addressee)` did not cover it. If a member had already asked Zach to
--         connect (member -> founder row), claim_my_pages() raised a unique violation on every sign-in and
--         their pre-claimed pages never attached (and v17's backfill statement aborted as a whole).
--      b. pages whose admins column is NULL now claim correctly (NULL = any() never matched).
--      c. a pending member -> founder request (the client fallback sends one before v17 exists) is accepted.
--   7. page_edit_requests: when an edit is not allowed yet, the app files it here ("Saved for review —
--      Zach will publish it"). Zach (is_admin) sees them all.

-- ---------- 1. defensive columns ----------
alter table public.pages add column if not exists extra jsonb not null default '{}'::jsonb;
alter table public.pages add column if not exists admins uuid[] not null default '{}'::uuid[];
alter table public.pages add column if not exists admin_emails text[] not null default '{}'::text[];
alter table public.pages add column if not exists vr_home text;
alter table public.pages add column if not exists claimed_at timestamptz;
update public.pages set admins = '{}'::uuid[] where admins is null;
update public.pages set admin_emails = '{}'::text[] where admin_emails is null;

-- founder lookup (same as v17; re-created so this file also works on its own)
create or replace function public.founder_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) in ('zach@eyetoad.com','zachwennstedt@gmail.com') order by created_at asc limit 1;
$$;

-- ---------- 2 + 3. client pages ----------
do $$
declare
  v_founder uuid := public.founder_id();
  v_ritchie uuid := (select id from auth.users where lower(email) = 'wasraisedinabarn@gmail.com' order by created_at limit 1);
  v_owner uuid;
begin
  -- an older row saved from the built-in brand under the long slug: rename it if the short one is free
  if exists (select 1 from public.pages where slug = 'raised-in-a-barn-furniture')
     and not exists (select 1 from public.pages where slug = 'raised-in-a-barn') then
    update public.pages set slug = 'raised-in-a-barn' where slug = 'raised-in-a-barn-furniture';
  end if;

  v_owner := coalesce(v_founder, v_ritchie);
  if v_owner is null then
    raise notice 'Neither Zach nor Ritchie has an account yet: the Raised In a Barn row is created on the next run (the app shows the built-in page meanwhile).';
  else
    insert into public.pages (owner_id, slug, name, tagline, about, phone, website, location, hours, vr_home, admin_emails, extra)
    values (v_owner, 'raised-in-a-barn', 'Raised In a Barn Furniture',
            'Reclaimed barnwood furniture, handcrafted in Colorado. Free shipping, lower 48.',
            'Raised In A Barn builds tables, benches, beds, vanities and shelving from reclaimed barnwood, handcrafted in Colorado. Every board has a history, every piece is made to order, and shipping is free across the lower 48.',
            '(970) 518-2883', 'https://rusticbarnwoodfurniture.com/', 'Colorado · ships free, lower 48', 'Mon-Fri 9am-5pm MT', 'art',
            array['wasraisedinabarn@gmail.com','zach@eyetoad.com','zachwennstedt@gmail.com'],
            jsonb_build_object('color', '#b45309', 'cat', 'Furniture', 'mall', 'https://worldvrmall.com/mall/?to=raised-in-a-barn'))
    on conflict (slug) do nothing;
  end if;

  update public.pages
     set admin_emails = (select array(select distinct e from unnest(coalesce(admin_emails, '{}') || array['wasraisedinabarn@gmail.com','zach@eyetoad.com','zachwennstedt@gmail.com']) e)),
         vr_home  = case when vr_home is null or vr_home in ('', 'plaza') then 'art' else vr_home end,
         phone    = coalesce(nullif(phone, ''), '(970) 518-2883'),
         website  = coalesce(nullif(website, ''), 'https://rusticbarnwoodfurniture.com/'),
         extra    = coalesce(extra, '{}'::jsonb) || jsonb_build_object('mall', 'https://worldvrmall.com/mall/?to=raised-in-a-barn')
   where slug in ('raised-in-a-barn', 'raised-in-a-barn-furniture');

  if v_founder is not null then
    insert into public.pages (owner_id, slug, name, tagline, about, phone, website, location, hours, vr_home, admin_emails, extra)
    values (v_founder, 'elevation-health', 'Elevation Health',
            'GLP-1 weight loss with real dietitian support. Telehealth, 503A pharmacies, a 90-day transformation.',
            'Elevation Health was founded by registered dietitians Lindsay Gayman and Meredith Cross. The 90-Day Transformation pairs GLP-1 medication from 503A pharmacies with the GLP-1 360 Plan: nutrition, habits and 1-on-1 support so the weight stays off.',
            '', 'https://loseweightonglp1.com/', 'Telehealth · United States', 'By appointment', 'falls',
            array['meredith@elevationhealth.co','lindsay@elevationhealth.co','zach@eyetoad.com','zachwennstedt@gmail.com'],
            jsonb_build_object('color', '#f43f5e', 'cat', 'Health and wellness'))
    on conflict (slug) do nothing;
  end if;
  update public.pages
     set admin_emails = (select array(select distinct e from unnest(coalesce(admin_emails, '{}') || array['meredith@elevationhealth.co','lindsay@elevationhealth.co','zach@eyetoad.com','zachwennstedt@gmail.com']) e)),
         vr_home = coalesce(nullif(vr_home, ''), 'falls')
   where slug = 'elevation-health';
end $$;

-- ---------- 4. link everyone who already has an account (idempotent) ----------
update public.pages p set admins = coalesce(p.admins, '{}') || x.ids, claimed_at = coalesce(p.claimed_at, now())
  from (select pg.id, array_agg(u.id) as ids from public.pages pg
          join auth.users u on lower(u.email) = any(pg.admin_emails)
                           and not (u.id = any(coalesce(pg.admins, '{}')))
                           and u.id <> pg.owner_id
         group by pg.id) x
 where x.id = p.id;

-- ---------- 5. pre-linked emails may edit / post as their page ----------
create or replace function public.my_email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
drop policy if exists "pages update prelinked email v19" on public.pages;
create policy "pages update prelinked email v19" on public.pages for update
  using (public.my_email() <> '' and public.my_email() = any(admin_emails))
  with check (public.my_email() <> '' and public.my_email() = any(admin_emails));
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feed_posts' and column_name = 'page_slug') then
    execute 'drop policy if exists "page email admins post v19" on public.feed_posts';
    execute 'create policy "page email admins post v19" on public.feed_posts for insert with check (auth.uid() = user_id and page_slug is not null and exists (select 1 from public.pages p where p.slug = feed_posts.page_slug and public.my_email() <> '''' and public.my_email() = any(p.admin_emails)))';
  end if;
end $$;

-- ---------- 6. welcome trigger + claim, NULL-safe ----------
create or replace function public.welcome_new_member() returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_founder uuid;
begin
  select lower(email) into v_email from auth.users where id = new.id;
  v_founder := public.founder_id();
  if v_founder is not null and v_founder <> new.id then
    insert into public.connections (requester, addressee, kind, status)
      values (v_founder, new.id, 'connect', 'accepted')
      on conflict do nothing;
  end if;
  if v_email is not null then
    update public.pages
       set admins = array_append(coalesce(admins, '{}'), new.id),
           claimed_at = coalesce(claimed_at, now())
     where v_email = any(admin_emails) and not (new.id = any(coalesce(admins, '{}')));
  end if;
  return new;
end $$;
drop trigger if exists profiles_welcome_v17 on public.profiles;
create trigger profiles_welcome_v17 after insert on public.profiles for each row execute function public.welcome_new_member();

create or replace function public.claim_my_pages() returns int language plpgsql security definer set search_path = public as $$
declare v_email text; n int := 0; v_founder uuid;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  update public.pages set admins = array_append(coalesce(admins, '{}'), auth.uid()), claimed_at = coalesce(claimed_at, now())
   where v_email = any(admin_emails) and not (auth.uid() = any(coalesce(admins, '{}')));
  get diagnostics n = row_count;
  v_founder := public.founder_id();
  if v_founder is not null and v_founder <> auth.uid() then
    insert into public.connections (requester, addressee, kind, status) values (v_founder, auth.uid(), 'connect', 'accepted')
      on conflict do nothing;
    -- the client fallback may have sent member -> founder as 'pending' before v17 existed: accept it
    update public.connections set status = 'accepted'
     where requester = auth.uid() and addressee = v_founder and status = 'pending';
  end if;
  return n;
end $$;
grant execute on function public.claim_my_pages() to authenticated;

-- pending member -> founder requests that are already waiting: accept them (one time, idempotent)
update public.connections set status = 'accepted'
 where addressee = public.founder_id() and status = 'pending' and public.founder_id() is not null;
-- and every member is connected to the founder (same as v17's backfill)
insert into public.connections (requester, addressee, kind, status)
  select public.founder_id(), p.id, 'connect', 'accepted' from public.profiles p
   where public.founder_id() is not null and p.id <> public.founder_id()
  on conflict do nothing;

-- ---------- 7. edits waiting for review ----------
create table if not exists public.page_edit_requests (
  id bigint generated always as identity primary key,
  page_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  patch jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','published','declined')),
  created_at timestamptz default now());
create index if not exists page_edit_requests_slug_idx on public.page_edit_requests (page_slug, created_at desc);
alter table public.page_edit_requests enable row level security;
drop policy if exists "edit requests add" on public.page_edit_requests;
create policy "edit requests add" on public.page_edit_requests for insert with check (auth.uid() = user_id);
drop policy if exists "edit requests see" on public.page_edit_requests;
create policy "edit requests see" on public.page_edit_requests for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "edit requests review" on public.page_edit_requests;
create policy "edit requests review" on public.page_edit_requests for update using (public.is_admin()) with check (public.is_admin());

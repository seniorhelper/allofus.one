-- allofus.one: v17 + v18 + v19-clients + v19-comm in one file. Paste all of it into Supabase SQL Editor and click Run. Additive only, safe to re-run.

-- ===================== 1-allofus-v17.sql =====================
-- allofus.one v17 · Oct 2026 · Safe to re-run. Run AFTER v16.
-- ADDITIVE ONLY: no table is dropped, no column removed, no row deleted. Existing accounts, posts,
-- connections, pages and land are untouched. Members who are online while this runs keep working;
-- the new columns have defaults, the new policies only widen what is allowed.
--
-- What it adds
--   1. pages.admin_emails  — pre-claim a business page for people who have not signed up yet
--      (e.g. meredith@elevationhealth.co + lindsay@elevationhealth.co for Elevation Health).
--      The moment that email creates an account, the account is added to pages.admins automatically.
--   2. Every new member starts connected to the founder (Zach). They can remove the connection
--      (new delete policy) — it is a default, not a lock.
--   3. feed_posts.edited_at — posts are editable everywhere; edits are marked.
--   4. hugs table — hugs / crushes / waves that land even when the other person is offline.
--   5. claim_my_pages() — fallback for members who signed up BEFORE this migration.
--   6. The 11 Eye To Ad Media network pages are seeded for the founder account (whichever of the two
--      founder emails exists), so "Pages I manage" is no longer empty.

-- ---------- 1. pages: admin_emails ----------
alter table public.pages add column if not exists admin_emails text[] not null default '{}'::text[];
alter table public.pages add column if not exists vr_home text;            -- world spot the page owners get as their VR home
alter table public.pages add column if not exists claimed_at timestamptz;  -- first time a pre-linked admin signed in
create index if not exists pages_admin_emails_idx on public.pages using gin (admin_emails);

-- founder lookup (either login email)
create or replace function public.founder_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) in ('zach@eyetoad.com','zachwennstedt@gmail.com') order by created_at asc limit 1;
$$;

-- ---------- 2 + 1. welcome trigger: runs once per new profile ----------
create or replace function public.welcome_new_member() returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_founder uuid;
begin
  select lower(email) into v_email from auth.users where id = new.id;
  v_founder := public.founder_id();

  -- (2) start connected to the founder; member may delete it later
  if v_founder is not null and v_founder <> new.id then
    insert into public.connections (requester, addressee, kind, status)
      values (v_founder, new.id, 'connect', 'accepted')
      on conflict do nothing;
  end if;

  -- (1) pre-claimed business pages
  if v_email is not null then
    update public.pages
       set admins = array_append(admins, new.id),
           claimed_at = coalesce(claimed_at, now())
     where v_email = any(admin_emails) and not (coalesce(new.id = any(admins), false));
  end if;
  return new;
exception when others then
  -- never block a signup because of the welcome extras
  raise warning 'welcome_new_member skipped: %', sqlerrm;
  return new;
end $$;
drop trigger if exists profiles_welcome_v17 on public.profiles;
create trigger profiles_welcome_v17 after insert on public.profiles for each row execute function public.welcome_new_member();

-- (5) members who already had an account before v17: call this on sign-in (the app does it)
create or replace function public.claim_my_pages() returns int language plpgsql security definer set search_path = public as $$
declare v_email text; n int := 0; v_founder uuid;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  update public.pages set admins = array_append(admins, auth.uid()), claimed_at = coalesce(claimed_at, now())
   where v_email = any(admin_emails) and not (auth.uid() = any(admins));
  get diagnostics n = row_count;
  v_founder := public.founder_id();
  if v_founder is not null and v_founder <> auth.uid() then
    insert into public.connections (requester, addressee, kind, status) values (v_founder, auth.uid(), 'connect', 'accepted')
      on conflict do nothing;
  end if;
  return n;
end $$;
grant execute on function public.claim_my_pages() to authenticated;

-- members may remove a connection (either side)
drop policy if exists "remove my connections v17" on public.connections;
create policy "remove my connections v17" on public.connections for delete using (auth.uid() in (requester, addressee));

-- ---------- 3. editable posts ----------
alter table public.feed_posts add column if not exists edited_at timestamptz;
drop policy if exists "edit own posts" on public.feed_posts;
create policy "edit own posts" on public.feed_posts for update
  using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

-- ---------- 4. hugs that land even when the other person is offline ----------
-- is_banned() lives in the private admin upgrade; if it was never installed, define a permissive stand-in
-- so nothing below fails. (The real one is NOT replaced if it exists.)
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_banned') then
    execute 'create function public.is_banned(uid uuid) returns boolean language sql stable as $f$ select false $f$';
  end if;
end $$;
create table if not exists public.hugs (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'hug' check (kind in ('hug','crush','wave','highfive','cheer')),
  msg text check (char_length(msg) <= 240),
  created_at timestamptz default now(),
  seen_at timestamptz);
create index if not exists hugs_to_idx on public.hugs (to_id, seen_at, created_at desc);
alter table public.hugs enable row level security;
drop policy if exists "hugs send" on public.hugs;
create policy "hugs send" on public.hugs for insert with check (auth.uid() = from_id and from_id <> to_id and not public.is_banned(auth.uid()));
drop policy if exists "hugs mine" on public.hugs;
create policy "hugs mine" on public.hugs for select using (auth.uid() in (from_id, to_id));
drop policy if exists "hugs seen" on public.hugs;
create policy "hugs seen" on public.hugs for update using (auth.uid() = to_id) with check (auth.uid() = to_id);
-- max 60 hugs per hour per sender
create or replace function public.hugs_rate_ok() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.hugs where from_id = new.from_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Slow down — that is a lot of hugs for one hour.';
  end if;
  return new;
end $$;
drop trigger if exists hugs_rate on public.hugs;
create trigger hugs_rate before insert on public.hugs for each row execute function public.hugs_rate_ok();
-- live delivery
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'hugs') then
    alter publication supabase_realtime add table public.hugs;
  end if;
exception when others then null; end $$;

-- ---------- 6. seed the network pages for the founder ----------
do $$
declare v_founder uuid := public.founder_id(); r record;
begin
  if v_founder is null then raise notice 'Founder account not found yet — pages will be seeded next run.'; return; end if;
  for r in select * from (values
    ('eye-to-ad-media','Eye To Ad Media','Denver SEO, AI search optimization and custom websites since 2012.','1-800-481-8638','https://eyetoad.com/','Denver, CO','gate',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('search-converts','Search Converts','Conversion-first marketing: CRO, paid search, funnels, websites.','1-800-481-8638','https://searchconverts.com/','Denver, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('aging-safely-baths','Aging Safely Baths','Walk-in tubs and accessible showers since 2012.','888-779-2284','https://www.agingsafelybaths.com/','Denver, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('showers4less','Showers4Less','Roll-in and ADA showers, made in the USA, shipped nationwide.','888-779-2284','https://showers4less.com/','Denver, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('elevation-health','Elevation Health','GLP-1 weight loss with real dietitian support. The 90-Day Transformation.','','https://loseweightonglp1.com/','Telehealth · United States','falls',array['meredith@elevationhealth.co','lindsay@elevationhealth.co','zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('bighorn-painting','Bighorn Painting','Interior and exterior painting across the Denver metro.','','https://denverpaintcontractors.com/','Arvada, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('painting-brighton','Painting Brighton','House painting in Brighton and the north metro.','','https://paintingbrighton.com/','Brighton, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('raised-in-a-barn','Raised In a Barn Furniture','Handcrafted barnwood furniture, free shipping.','(970) 518-2883','https://rusticbarnwoodfurniture.com/','Colorado','plaza',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('bear-creek-auto-glass','Bear Creek Auto Glass','Windshields and auto glass, Littleton.','','https://bearcreekautoglass.com/','Littleton, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('my-sales-help','My Sales Help','Sales training that actually gets used.','','https://mysaleshelp.com/','Denver, CO','library',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('world-vr-mall','World VR Mall','The free 3D mall you walk through. Built in Denver, open to the world.','1-800-481-8638','https://worldvrmall.com/','Everywhere','starport',array['zach@eyetoad.com','zachwennstedt@gmail.com'])
  ) as t(slug,name,tagline,phone,website,location,vr_home,admin_emails) loop
    insert into public.pages (owner_id, slug, name, tagline, phone, website, location, about, vr_home, admin_emails)
      values (v_founder, r.slug, r.name, r.tagline, r.phone, r.website, r.location, r.tagline, r.vr_home, r.admin_emails)
      on conflict (slug) do update set admin_emails = (select array(select distinct unnest(public.pages.admin_emails || excluded.admin_emails))),
                                      vr_home = coalesce(public.pages.vr_home, excluded.vr_home);
  end loop;
  -- anyone on those email lists who already has an account gets linked right now
  update public.pages p set admins = p.admins || x.ids, claimed_at = coalesce(p.claimed_at, now())
    from (select pg.id, array_agg(u.id) as ids from public.pages pg
            join auth.users u on lower(u.email) = any(pg.admin_emails) and not (u.id = any(pg.admins))
           group by pg.id) x
   where x.id = p.id;  -- (no-op if nobody matches)
end $$;

-- ---------- existing members: connect everyone who joined before v17 to the founder (one time, idempotent) ----------
insert into public.connections (requester, addressee, kind, status)
  select public.founder_id(), p.id, 'connect', 'accepted' from public.profiles p
   where public.founder_id() is not null and p.id <> public.founder_id()
  on conflict do nothing;


-- ===================== 2-allofus-v18.sql =====================
-- allofus.one v18 · Oct 2026 · Safe to re-run. Run AFTER v17.
-- ADDITIVE ONLY: no table is dropped, no column removed, no row deleted. Existing accounts, posts, pages,
-- connections and land are untouched. Every statement is `if not exists` / `drop policy if exists` + recreate.
--
-- What it adds
--   1. page_follows — "Follow" on a Brand page (the client keeps a local copy too, so the button works before this runs).
--   2. Defensive columns the flat client reads on `pages` and `feed_posts` (no-ops where v9-v17 already created them),
--      so a project that skipped a file still gets Pages-I-manage, editable posts and the Happening-now carousel.
--   3. Indexes for the Feed's hot queries (public posts by time, pages by admin, hugs inbox).
--   4. feed_posts in the realtime publication (the carousel and the "new posts" pill pick up posts live).

-- ---------- 1. follows ----------
create table if not exists public.page_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  page_slug text not null,
  created_at timestamptz default now(),
  primary key (user_id, page_slug));
alter table public.page_follows enable row level security;
drop policy if exists "follows mine" on public.page_follows;
create policy "follows mine" on public.page_follows for select using (auth.uid() = user_id);
drop policy if exists "follows add" on public.page_follows;
create policy "follows add" on public.page_follows for insert with check (auth.uid() = user_id);
drop policy if exists "follows remove" on public.page_follows;
create policy "follows remove" on public.page_follows for delete using (auth.uid() = user_id);
create index if not exists page_follows_slug_idx on public.page_follows (page_slug);
-- how many people follow a page (public, count only)
create or replace function public.page_follow_count(p_slug text) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.page_follows where page_slug = p_slug;
$$;
grant execute on function public.page_follow_count(text) to anon, authenticated;

-- ---------- 2. defensive columns (all no-ops on an up-to-date project) ----------
alter table public.pages add column if not exists extra jsonb not null default '{}'::jsonb;
alter table public.pages add column if not exists admins uuid[] not null default '{}'::uuid[];
alter table public.pages add column if not exists admin_emails text[] not null default '{}'::text[];
alter table public.pages add column if not exists vr_home text;
alter table public.pages add column if not exists world_spot text;
alter table public.pages add column if not exists claimed_at timestamptz;
alter table public.pages add column if not exists hours text;
alter table public.pages add column if not exists logo text;
alter table public.pages add column if not exists cover text;
alter table public.feed_posts add column if not exists extra jsonb;
alter table public.feed_posts add column if not exists page_slug text;
alter table public.feed_posts add column if not exists publish_at timestamptz;
alter table public.feed_posts add column if not exists edited_at timestamptz;

-- ---------- 3. indexes ----------
create index if not exists feed_posts_public_time_idx on public.feed_posts (created_at desc) where public = true;
create index if not exists feed_posts_user_time_idx on public.feed_posts (user_id, created_at desc);
create index if not exists feed_posts_page_idx on public.feed_posts (page_slug) where page_slug is not null;
create index if not exists pages_admins_idx on public.pages using gin (admins);
create index if not exists pages_owner_idx on public.pages (owner_id);
do $$ begin if to_regclass('public.hugs') is not null then execute 'create index if not exists hugs_from_time_idx on public.hugs (from_id, created_at desc)'; end if; end $$;
create index if not exists connections_addressee_idx on public.connections (addressee, status);
create index if not exists connections_requester_idx on public.connections (requester, status);

-- ---------- 4. realtime ----------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.feed_posts'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.presence'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.hugs'; exception when others then null; end;
end $$;


-- ===================== 3-allofus-v19-clients.sql =====================
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


-- ===================== 4-allofus-v19-comm.sql =====================
-- allofus.one v19 · Comm Hub upgrade (Oct 2026). Additive and safe to re-run. Never deletes or rewrites existing rows.
-- Paste into Supabase → SQL Editor → Run. The site already works without it (archive / pin / mute / read state fall
-- back to the browser, editing and deleting messages show a gentle "needs the v19 update" note). After this runs:
--   1. messages: edited_at, read_at; senders can edit/delete their own messages, recipients can mark them read
--      (a guard trigger keeps each side to its own columns).
--   2. hub_requests: edited_at, read_at; senders can edit/delete their own notes (status stays the recipient's call).
--   3. comm_state: per-person thread state (archived, pinned, muted, last read, marked unread, request accepted).
--   4. realtime for messages, hub_requests, meeting_requests, connections (the Hub updates live).

-- ---------- 1. messages ----------
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists read_at timestamptz;
drop policy if exists "edit own messages v19" on public.messages;
create policy "edit own messages v19" on public.messages for update using (auth.uid() in (sender, recipient)) with check (auth.uid() in (sender, recipient));
drop policy if exists "delete own messages v19" on public.messages;
create policy "delete own messages v19" on public.messages for delete using (auth.uid() = sender);

create or replace function public.messages_guard_v19() returns trigger language plpgsql as $$
begin
  if new.sender is distinct from old.sender or new.recipient is distinct from old.recipient or new.room is distinct from old.room or new.created_at is distinct from old.created_at then
    raise exception 'Only the text of a message can change.';
  end if;
  if auth.uid() = old.sender and auth.uid() is distinct from old.recipient then
    if new.read_at is distinct from old.read_at then new.read_at := old.read_at; end if;           -- the sender cannot fake a read receipt
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  elsif auth.uid() = old.recipient and auth.uid() is distinct from old.sender then
    if new.body is distinct from old.body or new.edited_at is distinct from old.edited_at then
      raise exception 'You can only mark someone else''s message as read.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists messages_guard_v19 on public.messages;
create trigger messages_guard_v19 before update on public.messages for each row execute function public.messages_guard_v19();

-- ---------- 2. hub_requests ----------
alter table public.hub_requests add column if not exists edited_at timestamptz;
alter table public.hub_requests add column if not exists read_at timestamptz;
drop policy if exists "hub edit own v19" on public.hub_requests;
create policy "hub edit own v19" on public.hub_requests for update using (auth.uid() = from_user) with check (auth.uid() = from_user);
drop policy if exists "hub delete own v19" on public.hub_requests;
create policy "hub delete own v19" on public.hub_requests for delete using (auth.uid() = from_user);

create or replace function public.hub_requests_guard_v19() returns trigger language plpgsql as $$
begin
  if new.from_user is distinct from old.from_user or new.to_user is distinct from old.to_user or new.kind is distinct from old.kind or new.created_at is distinct from old.created_at then
    raise exception 'Only the note of a request can change.';
  end if;
  if auth.uid() = old.from_user and auth.uid() is distinct from old.to_user then
    if new.status is distinct from old.status then raise exception 'Only the person you sent it to can answer a request.'; end if;
    if new.read_at is distinct from old.read_at then new.read_at := old.read_at; end if;
    if new.body is distinct from old.body or new.media is distinct from old.media then new.edited_at := now(); end if;
  elsif auth.uid() = old.to_user and auth.uid() is distinct from old.from_user then
    if new.body is distinct from old.body or new.media is distinct from old.media or new.edited_at is distinct from old.edited_at then
      raise exception 'You can answer a request, not change it.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists hub_requests_guard_v19 on public.hub_requests;
create trigger hub_requests_guard_v19 before update on public.hub_requests for each row execute function public.hub_requests_guard_v19();

-- ---------- 3. comm_state (one row per person per conversation, owner-only) ----------
create table if not exists public.comm_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null check (char_length(thread_key) between 1 and 120),
  archived boolean not null default false,
  archived_at timestamptz,
  pinned boolean not null default false,
  muted boolean not null default false,
  last_read_at timestamptz,
  marked_unread boolean not null default false,
  accepted boolean not null default false,
  updated_at timestamptz default now(),
  primary key (user_id, thread_key));
alter table public.comm_state add column if not exists archived_at timestamptz;
alter table public.comm_state add column if not exists marked_unread boolean not null default false;
alter table public.comm_state add column if not exists accepted boolean not null default false;
alter table public.comm_state add column if not exists updated_at timestamptz default now();
alter table public.comm_state enable row level security;
drop policy if exists "comm state read own" on public.comm_state;
create policy "comm state read own" on public.comm_state for select using (auth.uid() = user_id);
drop policy if exists "comm state insert own" on public.comm_state;
create policy "comm state insert own" on public.comm_state for insert with check (auth.uid() = user_id);
drop policy if exists "comm state update own" on public.comm_state;
create policy "comm state update own" on public.comm_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "comm state delete own" on public.comm_state;
create policy "comm state delete own" on public.comm_state for delete using (auth.uid() = user_id);

-- ---------- 4. meeting_requests: the person who sent an invitation can see its answer change live ----------
create index if not exists meeting_requests_to_idx on public.meeting_requests (to_user, created_at desc);
create index if not exists meeting_requests_from_idx on public.meeting_requests (from_user, created_at desc);
create index if not exists hub_from_idx on public.hub_requests (from_user, created_at desc);

-- ---------- 5. realtime ----------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.messages'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.hub_requests'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.meeting_requests'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.connections'; exception when others then null; end;
end $$;


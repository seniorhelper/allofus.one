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
      on conflict (requester, addressee) do nothing;
  end if;

  -- (1) pre-claimed business pages
  if v_email is not null then
    update public.pages
       set admins = array_append(admins, new.id),
           claimed_at = coalesce(claimed_at, now())
     where v_email = any(admin_emails) and not (new.id = any(admins));
  end if;
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
      on conflict (requester, addressee) do nothing;
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
    ('eye-to-ad-media','Eye To Ad Media','Denver SEO, AI search optimization and custom websites since 2012.','1-800-481-8638','https://eyetoad.com/','Denver, CO','gateway',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('search-converts','Search Converts','Conversion-first marketing: CRO, paid search, funnels, websites.','1-800-481-8638','https://searchconverts.com/','Denver, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('aging-safely-baths','Aging Safely Baths','Walk-in tubs and accessible showers since 2012.','888-779-2284','https://www.agingsafelybaths.com/','Denver, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('showers4less','Showers4Less','Roll-in and ADA showers, made in the USA, shipped nationwide.','888-779-2284','https://showers4less.com/','Denver, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('elevation-health','Elevation Health','GLP-1 weight loss with real dietitian support. The 90-Day Transformation.','','https://loseweightonglp1.com/','Telehealth · United States','waterfall',array['meredith@elevationhealth.co','lindsay@elevationhealth.co','zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('bighorn-painting','Bighorn Painting','Interior and exterior painting across the Denver metro.','','https://denverpaintcontractors.com/','Arvada, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('painting-brighton','Painting Brighton','House painting in Brighton and the north metro.','','https://paintingbrighton.com/','Brighton, CO','city',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
    ('raised-in-a-barn','Raised In a Barn Furniture','Handcrafted barnwood furniture, free shipping.','(970) 518-2883','https://rusticbarnwoodfurniture.com/','Colorado','market',array['zach@eyetoad.com','zachwennstedt@gmail.com']),
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
  on conflict (requester, addressee) do nothing;

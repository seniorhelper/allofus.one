-- allofus.one · v26 FEATURES (Oct 23 2026): Circles, circle-scoped posts, AI guide usage counter.
-- Additive, idempotent, safe to re-run. Run in Supabase -> SQL Editor (any time; the site works before and after).
-- Nothing here drops or rewrites member data. Every new table has RLS on.
--
-- What it adds
--   1. public.circles          a member's own audiences (Family, Inner Tribe, Professional, Local + custom)
--   2. public.circle_members   who is in each circle (only the circle owner can add/remove)
--   3. feed_posts.circle_id    a post shared to ONE circle; only the author, that circle's members and admins can read it
--   4. a RESTRICTIVE read policy on feed_posts and feed_comments so circle posts never leak through the
--      existing "public or connections" policy, whatever that policy looks like after other rounds
--   5. public.aou_guide_hits   counter rows for the AI guide Edge Function's rate limit (no question text, no IPs:
--      only a salted hash). Service-role only: no client policies at all.

-- ---------- 1. circles ----------
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'custom' check (kind in ('family','tribe','pro','local','custom')),
  color text default '#0ea5e9',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists circles_owner_idx on public.circles (owner_id, sort);
alter table public.circles enable row level security;

-- ---------- 2. circle_members ----------
create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (circle_id, member_id)
);
create index if not exists circle_members_member_idx on public.circle_members (member_id);
create index if not exists circle_members_owner_idx on public.circle_members (owner_id);
alter table public.circle_members enable row level security;

-- helpers (security definer so policies never recurse through RLS)
create or replace function public.owns_circle(p_circle uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid());
$$;
create or replace function public.in_circle(p_circle uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = auth.uid())
      or exists (select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid());
$$;
grant execute on function public.owns_circle(uuid) to authenticated;
grant execute on function public.in_circle(uuid) to authenticated, anon;

-- circles: the owner reads and writes; a member may read the name of a circle they were put in
drop policy if exists "circles owner all" on public.circles;
create policy "circles owner all" on public.circles for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "circles member read" on public.circles;
create policy "circles member read" on public.circles for select
  using (exists (select 1 from public.circle_members m where m.circle_id = circles.id and m.member_id = auth.uid()));

-- circle_members: only the circle owner writes; owner and the member themself can read the row
drop policy if exists "circle members owner write" on public.circle_members;
create policy "circle members owner write" on public.circle_members for insert
  with check (owner_id = auth.uid() and public.owns_circle(circle_id) and member_id <> auth.uid());
drop policy if exists "circle members owner delete" on public.circle_members;
create policy "circle members owner delete" on public.circle_members for delete
  using (owner_id = auth.uid() or member_id = auth.uid());  -- a member may also leave
drop policy if exists "circle members read" on public.circle_members;
create policy "circle members read" on public.circle_members for select
  using (owner_id = auth.uid() or member_id = auth.uid());

-- cap: 24 circles and 500 members per circle (stops abuse, plenty for real life)
create or replace function public.circle_caps() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'circles' then
    if (select count(*) from public.circles where owner_id = new.owner_id) >= 24 then raise exception 'You can have up to 24 circles.'; end if;
  else
    if (select count(*) from public.circle_members where circle_id = new.circle_id) >= 500 then raise exception 'A circle holds up to 500 people.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists circles_cap on public.circles;
create trigger circles_cap before insert on public.circles for each row execute function public.circle_caps();
drop trigger if exists circle_members_cap on public.circle_members;
create trigger circle_members_cap before insert on public.circle_members for each row execute function public.circle_caps();

-- ---------- 3. circle-scoped posts ----------
alter table public.feed_posts add column if not exists circle_id uuid references public.circles(id) on delete set null;
create index if not exists feed_posts_circle_idx on public.feed_posts (circle_id, created_at desc) where circle_id is not null;

-- you may only post into a circle you own (insert + update)
drop policy if exists "circle posts own circle v26" on public.feed_posts;
create policy "circle posts own circle v26" on public.feed_posts as restrictive for insert
  with check (circle_id is null or public.owns_circle(circle_id));
drop policy if exists "circle posts own circle upd v26" on public.feed_posts;
create policy "circle posts own circle upd v26" on public.feed_posts as restrictive for update
  using (true) with check (circle_id is null or public.owns_circle(circle_id));

-- 4. READ: permissive branch lets circle members (who may not be connections) see the post;
--    restrictive branch makes sure a circle post is NEVER visible to anyone outside the circle,
--    no matter what the other (permissive) read policies say.
drop policy if exists "circle members read circle posts v26" on public.feed_posts;
create policy "circle members read circle posts v26" on public.feed_posts for select
  using (circle_id is not null and public.in_circle(circle_id) and (publish_at is null or publish_at <= now()));
drop policy if exists "circle posts stay in circle v26" on public.feed_posts;
create policy "circle posts stay in circle v26" on public.feed_posts as restrictive for select
  using (circle_id is null or auth.uid() = user_id or public.in_circle(circle_id) or public.is_admin());

-- comments and reactions on a circle post follow the post (the sub-select runs under feed_posts RLS)
do $$ begin
  if to_regclass('public.feed_comments') is not null then
    execute 'drop policy if exists "comments follow circle post v26" on public.feed_comments';
    execute 'create policy "comments follow circle post v26" on public.feed_comments as restrictive for select using (exists (select 1 from public.feed_posts p where p.id = feed_comments.post_id))';
  end if;
  if to_regclass('public.feed_reactions') is not null then
    execute 'drop policy if exists "reactions follow circle post v26" on public.feed_reactions';
    execute 'create policy "reactions follow circle post v26" on public.feed_reactions as restrictive for select using (exists (select 1 from public.feed_posts p where p.id = feed_reactions.post_id))';
  end if;
end $$;

-- ---------- 5. AI guide rate-limit counter (Edge Function aou-guide uses the service role) ----------
create table if not exists public.aou_guide_hits (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text not null,            -- 'u:<user uuid>' or 'ip:<salted sha-256, 16 hex>' - never a raw IP
  tokens_in int default 0,
  tokens_out int default 0,
  ok boolean default true
);
create index if not exists aou_guide_hits_who_idx on public.aou_guide_hits (who, at desc);
create index if not exists aou_guide_hits_at_idx on public.aou_guide_hits (at desc);
alter table public.aou_guide_hits enable row level security;
-- no policies on purpose: only the service role (the Edge Function) can read or write.
-- admins read usage with the stats queries in MASTER-GAMEPLAN.md (SQL Editor runs as postgres).

-- keep 30 days of counter rows (call any time; optional pg_cron line in the gameplan)
create or replace function public.aou_guide_prune() returns void language sql security definer set search_path = public as $$
  delete from public.aou_guide_hits where at < now() - interval '30 days';
$$;
revoke all on function public.aou_guide_prune() from public, anon, authenticated;

-- ---------- realtime (optional, harmless if already added) ----------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.circles'; exception when others then null; end;
end $$;

-- verify (should list the new tables with rowsecurity = true)
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('circles','circle_members','aou_guide_hits');

-- ---------- 6. daily KPI snapshot (investor metrics; presence only keeps the LAST visit, so history must be snapshotted) ----------
create table if not exists public.aou_kpi_daily (
  day date primary key,
  members int, new_members int, dau int, wau int, mau int,
  posts int, comments int, reactions int, connections_made int, brand_pages int, guide_questions int,
  taken_at timestamptz default now()
);
alter table public.aou_kpi_daily enable row level security;
drop policy if exists "kpi admins read" on public.aou_kpi_daily;
create policy "kpi admins read" on public.aou_kpi_daily for select using (public.is_admin());

create or replace function public.aou_kpi_snapshot() returns public.aou_kpi_daily
language plpgsql security definer set search_path = public as $$
declare r public.aou_kpi_daily; d date := (now() at time zone 'America/Denver')::date;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  r.day := d;
  select count(*) into r.members from auth.users;
  select count(*) into r.new_members from auth.users where created_at > now() - interval '1 day';
  select count(*) into r.dau from public.presence where last_seen > now() - interval '1 day';
  select count(*) into r.wau from public.presence where last_seen > now() - interval '7 days';
  select count(*) into r.mau from public.presence where last_seen > now() - interval '30 days';
  select count(*) into r.posts from public.feed_posts where created_at > now() - interval '1 day';
  select count(*) into r.comments from public.feed_comments where created_at > now() - interval '1 day';
  begin select count(*) into r.reactions from public.feed_reactions where created_at > now() - interval '1 day'; exception when others then r.reactions := null; end;
  begin select count(*) into r.connections_made from public.connections where status = 'accepted' and created_at > now() - interval '1 day'; exception when others then r.connections_made := null; end;
  select count(*) into r.brand_pages from public.pages;
  select count(*) into r.guide_questions from public.aou_guide_hits where at > now() - interval '1 day';
  r.taken_at := now();
  insert into public.aou_kpi_daily values (r.*) on conflict (day) do update set
    members = excluded.members, new_members = excluded.new_members, dau = excluded.dau, wau = excluded.wau, mau = excluded.mau,
    posts = excluded.posts, comments = excluded.comments, reactions = excluded.reactions, connections_made = excluded.connections_made,
    brand_pages = excluded.brand_pages, guide_questions = excluded.guide_questions, taken_at = excluded.taken_at;
  return r;
end $$;
revoke all on function public.aou_kpi_snapshot() from public, anon;
grant execute on function public.aou_kpi_snapshot() to authenticated;  -- the function itself refuses non-admins
-- Optional, once: Database -> Extensions -> enable pg_cron, then run:
--   select cron.schedule('aou-kpi-daily', '55 5 * * *', $$select public.aou_kpi_snapshot(); select public.aou_guide_prune();$$);
-- (05:55 UTC = 11:55 pm Denver in winter / 10:55 pm in summer.) Until then, run  select public.aou_kpi_snapshot();  by hand.
select public.aou_kpi_snapshot();

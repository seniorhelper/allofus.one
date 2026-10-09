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

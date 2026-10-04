-- allofus.one v11 · Brand pages (sections + admins), connections unique index. Safe to re-run.
-- Run AFTER allofus-ALL-v9-v10.sql (pages / bugs / feed_saves tables). If v9 was never run, the pages table is created here.
create table if not exists public.pages (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  tagline text, about text, phone text, website text, location text, hours text, world_spot text, logo text, cover text,
  created_at timestamptz default now());
alter table public.pages add column if not exists extra jsonb not null default '{}'::jsonb;
alter table public.pages add column if not exists admins uuid[] not null default '{}'::uuid[];
alter table public.pages add column if not exists updated_at timestamptz default now();
alter table public.pages enable row level security;
drop policy if exists "pages readable" on public.pages;
create policy "pages readable" on public.pages for select using (true);
drop policy if exists "pages insert own" on public.pages;
create policy "pages insert own" on public.pages for insert with check (auth.uid() = owner_id);
drop policy if exists "pages update own or admin v11" on public.pages;
create policy "pages update own or admin v11" on public.pages for update using (auth.uid() = owner_id or auth.uid() = any(admins)) with check (auth.uid() = owner_id or auth.uid() = any(admins));
drop policy if exists "pages delete own v11" on public.pages;
create policy "pages delete own v11" on public.pages for delete using (auth.uid() = owner_id);
-- admins (up to 2) may post as the brand: feed_posts rows carrying page_slug
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feed_posts' and column_name = 'page_slug') then
    execute 'drop policy if exists "page admins post v11" on public.feed_posts';
    execute 'create policy "page admins post v11" on public.feed_posts for insert with check (auth.uid() = user_id and (page_slug is null or exists (select 1 from public.pages p where p.slug = feed_posts.page_slug and (p.owner_id = auth.uid() or auth.uid() = any(p.admins)))))';
  end if;
end $$;
-- one connection row per pair (lets the app find and update the existing request instead of duplicating it)
do $$ begin
  begin
    execute 'create unique index if not exists connections_pair_uidx on public.connections (least(requester, addressee), greatest(requester, addressee))';
  exception when others then raise notice 'connections_pair_uidx skipped: %', sqlerrm;
  end;
end $$;
-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

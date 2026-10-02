-- ============================================================
-- allofus.one v6 · FLAT social: feed posts, groups, reactions, polls,
-- the Global Communication Hub (requests + inbox) and post photos.
-- Run once in Supabase → SQL Editor. Safe to re-run. No secrets inside.
-- ============================================================
create table if not exists public.feed_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post','sale','poll','ad','wish')),
  text text check (char_length(text) <= 3000),
  style jsonb default '{}'::jsonb,
  media jsonb default '[]'::jsonb,
  link text, price text, location text, business text,
  poll jsonb,
  group_slug text,
  public boolean not null default true,
  created_at timestamptz default now());
create index if not exists feed_posts_user_idx on public.feed_posts (user_id, created_at desc);
create index if not exists feed_posts_group_idx on public.feed_posts (group_slug, created_at desc);
alter table public.feed_posts enable row level security;
drop policy if exists "read public or own posts" on public.feed_posts;
create policy "read public or own posts" on public.feed_posts for select using (public or auth.uid() = user_id or public.is_admin());
drop policy if exists "write own posts" on public.feed_posts;
create policy "write own posts" on public.feed_posts for insert with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
drop policy if exists "edit own posts" on public.feed_posts;
create policy "edit own posts" on public.feed_posts for update using (auth.uid() = user_id or public.is_admin());
drop policy if exists "delete own posts" on public.feed_posts;
create policy "delete own posts" on public.feed_posts for delete using (auth.uid() = user_id or public.is_admin());

create table if not exists public.feed_reactions (post_id bigint references public.feed_posts(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, emoji text not null, created_at timestamptz default now(), primary key (post_id, user_id));
alter table public.feed_reactions enable row level security;
drop policy if exists "reactions readable" on public.feed_reactions;
create policy "reactions readable" on public.feed_reactions for select using (true);
drop policy if exists "react as me" on public.feed_reactions;
create policy "react as me" on public.feed_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "change my reaction" on public.feed_reactions;
create policy "change my reaction" on public.feed_reactions for update using (auth.uid() = user_id);
drop policy if exists "remove my reaction" on public.feed_reactions;
create policy "remove my reaction" on public.feed_reactions for delete using (auth.uid() = user_id);

-- one vote per person per poll, counted inside the post
create or replace function public.vote_poll(p_post bigint, p_option int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pl jsonb; voters jsonb; counts jsonb; uid text := auth.uid()::text;
begin
  if uid is null then raise exception 'sign in to vote'; end if;
  select poll into pl from public.feed_posts where id = p_post and kind = 'poll' for update;
  if pl is null then raise exception 'not a poll'; end if;
  voters := coalesce(pl->'voters', '{}'::jsonb); counts := coalesce(pl->'counts', '[]'::jsonb);
  if voters ? uid then return pl; end if;
  if p_option < 0 or p_option >= jsonb_array_length(pl->'options') then raise exception 'bad option'; end if;
  while jsonb_array_length(counts) < jsonb_array_length(pl->'options') loop counts := counts || '0'::jsonb; end loop;
  counts := jsonb_set(counts, array[p_option::text], to_jsonb(((counts->>p_option)::int) + 1));
  pl := pl || jsonb_build_object('counts', counts, 'voters', voters || jsonb_build_object(uid, p_option));
  update public.feed_posts set poll = pl where id = p_post;
  return pl;
end $$;
grant execute on function public.vote_poll(bigint, int) to authenticated;

-- the Global Communication Hub: connection, phone, package, pic and file requests between people
create table if not exists public.hub_requests (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('dm','connect','phone','package','pic','file','gif')),
  body text check (char_length(body) <= 2000),
  media text,
  status text not null default 'new' check (status in ('new','seen','accepted','declined')),
  created_at timestamptz default now());
create index if not exists hub_to_idx on public.hub_requests (to_user, created_at desc);
alter table public.hub_requests enable row level security;
drop policy if exists "hub read mine" on public.hub_requests;
create policy "hub read mine" on public.hub_requests for select using (auth.uid() = to_user or auth.uid() = from_user);
drop policy if exists "hub send" on public.hub_requests;
create policy "hub send" on public.hub_requests for insert with check (auth.uid() = from_user and not public.is_banned(auth.uid()));
drop policy if exists "hub respond" on public.hub_requests;
create policy "hub respond" on public.hub_requests for update using (auth.uid() = to_user);

-- look up someone by username (public info only)
create or replace function public.find_user(p_username text) returns table (id uuid, username text, display_name text, home jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, coalesce(p.home, '{}'::jsonb) from public.profiles p where lower(p.username) = lower(p_username) limit 1;
$$;
grant execute on function public.find_user(text) to anon, authenticated;

-- photos and files for posts and the hub
insert into storage.buckets (id, name, public, file_size_limit) values ('posts', 'posts', true, 20971520) on conflict (id) do update set public = true, file_size_limit = 20971520;
drop policy if exists "posts read" on storage.objects;
create policy "posts read" on storage.objects for select using (bucket_id = 'posts');
drop policy if exists "posts upload own" on storage.objects;
create policy "posts upload own" on storage.objects for insert to authenticated with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts delete own" on storage.objects;
create policy "posts delete own" on storage.objects for delete to authenticated using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

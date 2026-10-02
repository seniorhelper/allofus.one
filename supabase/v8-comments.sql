-- allofus.one v8 · comments and offers on feed posts (how people buy, ask, and haggle). Safe to re-run.
create table if not exists public.feed_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'comment' check (kind in ('comment','offer')),
  body text check (char_length(body) <= 1000),
  amount text,
  created_at timestamptz default now());
create index if not exists feed_comments_post_idx on public.feed_comments (post_id, created_at);
alter table public.feed_comments enable row level security;
drop policy if exists "comments readable" on public.feed_comments;
create policy "comments readable" on public.feed_comments for select using (true);
drop policy if exists "comment as me" on public.feed_comments;
create policy "comment as me" on public.feed_comments for insert with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
drop policy if exists "delete my comment" on public.feed_comments;
create policy "delete my comment" on public.feed_comments for delete using (auth.uid() = user_id or public.is_admin());

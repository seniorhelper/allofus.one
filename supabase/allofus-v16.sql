-- allofus.one v16 · Spaces, Events, Courses, video replies, scheduled posts. Safe to re-run. Run after v14.
create table if not exists public.spaces (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,40}$'),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  about text check (char_length(about) <= 2000),
  cover text, color text default '#6366f1',
  visibility text not null default 'public' check (visibility in ('public','request','private')),
  price text, kind text default 'community',
  created_at timestamptz default now());
alter table public.spaces enable row level security;
drop policy if exists "spaces readable" on public.spaces;
create policy "spaces readable" on public.spaces for select using (true);
drop policy if exists "spaces own" on public.spaces;
create policy "spaces own" on public.spaces for all using (auth.uid() = owner) with check (auth.uid() = owner);

create table if not exists public.space_members (
  space_slug text not null references public.spaces(slug) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','mod','member')),
  status text not null default 'in' check (status in ('in','requested','banned')),
  joined_at timestamptz default now(),
  primary key (space_slug, user_id));
alter table public.space_members enable row level security;
drop policy if exists "members readable" on public.space_members;
create policy "members readable" on public.space_members for select using (true);
drop policy if exists "members self" on public.space_members;
create policy "members self" on public.space_members for insert with check (auth.uid() = user_id);
drop policy if exists "members leave" on public.space_members;
create policy "members leave" on public.space_members for delete using (auth.uid() = user_id or exists (select 1 from public.spaces s where s.slug = space_slug and s.owner = auth.uid()));
drop policy if exists "members owner update" on public.space_members;
create policy "members owner update" on public.space_members for update using (exists (select 1 from public.spaces s where s.slug = space_slug and s.owner = auth.uid()));

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  space_slug text references public.spaces(slug) on delete set null,
  title text not null check (char_length(title) <= 120),
  starts_at timestamptz not null, ends_at timestamptz,
  where_text text, meet_room text, details text check (char_length(details) <= 2000),
  public boolean default true,
  created_at timestamptz default now());
create index if not exists events_time_idx on public.events (starts_at);
alter table public.events enable row level security;
drop policy if exists "events readable" on public.events;
create policy "events readable" on public.events for select using (public or auth.uid() = user_id);
drop policy if exists "events own" on public.events;
create policy "events own" on public.events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.event_rsvps (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going','maybe','no')),
  created_at timestamptz default now(),
  primary key (event_id, user_id));
alter table public.event_rsvps enable row level security;
drop policy if exists "rsvps readable" on public.event_rsvps;
create policy "rsvps readable" on public.event_rsvps for select using (true);
drop policy if exists "rsvps own" on public.event_rsvps;
create policy "rsvps own" on public.event_rsvps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.courses (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  space_slug text references public.spaces(slug) on delete set null,
  title text not null check (char_length(title) <= 120),
  about text check (char_length(about) <= 2000),
  public boolean default true,
  created_at timestamptz default now());
alter table public.courses enable row level security;
drop policy if exists "courses readable" on public.courses;
create policy "courses readable" on public.courses for select using (public or auth.uid() = owner);
drop policy if exists "courses own" on public.courses;
create policy "courses own" on public.courses for all using (auth.uid() = owner) with check (auth.uid() = owner);

create table if not exists public.lessons (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  pos int not null default 0,
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 8000),
  video_url text, meet_room text,
  homework text check (char_length(homework) <= 500),
  created_at timestamptz default now());
create index if not exists lessons_course_idx on public.lessons (course_id, pos);
alter table public.lessons enable row level security;
drop policy if exists "lessons readable" on public.lessons;
create policy "lessons readable" on public.lessons for select using (exists (select 1 from public.courses c where c.id = course_id and (c.public or c.owner = auth.uid())));
drop policy if exists "lessons own" on public.lessons;
create policy "lessons own" on public.lessons for all using (exists (select 1 from public.courses c where c.id = course_id and c.owner = auth.uid())) with check (exists (select 1 from public.courses c where c.id = course_id and c.owner = auth.uid()));

create table if not exists public.lesson_done (
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  done_at timestamptz default now(),
  primary key (lesson_id, user_id));
alter table public.lesson_done enable row level security;
drop policy if exists "done own" on public.lesson_done;
create policy "done own" on public.lesson_done for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- video replies: a comment can carry a Moment (image or short clip)
alter table public.feed_comments add column if not exists media text;
alter table public.feed_comments add column if not exists media_kind text;
-- scheduled posts: hidden from everyone but the author until publish_at
alter table public.feed_posts add column if not exists publish_at timestamptz;
drop policy if exists "read public or own posts" on public.feed_posts;
create policy "read public or own posts" on public.feed_posts for select using (((public and (publish_at is null or publish_at <= now())) or auth.uid() = user_id or public.is_admin()));

-- badges: one view, computed, nothing to maintain
create or replace view public.member_stats as
  select p.id,
    (select count(*) from public.feed_posts f where f.user_id = p.id) as posts,
    (select count(*) from public.feed_comments c where c.user_id = p.id) as comments,
    (select count(*) from public.connections k where (k.requester = p.id or k.addressee = p.id) and k.status = 'accepted') as connections,
    (select count(*) from public.events e where e.user_id = p.id) as events,
    (select count(*) from public.spaces s where s.owner = p.id) as spaces,
    coalesce((select jsonb_array_length(coalesce(l.data->'shelf','[]'::jsonb)) from public.lifeboards l where l.id = p.id), 0) as trophies
  from public.profiles p;
grant select on public.member_stats to anon, authenticated;
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.events'; exception when others then null; end;
end $$;

-- paid spaces: a payment link the owner pastes (Stripe Payment Link, PayPal, Square — no keys on our side); brand page views for analytics
alter table public.spaces add column if not exists pay_link text;
create table if not exists public.page_views (
  page_slug text not null, day date not null default current_date, n int not null default 0,
  primary key (page_slug, day));
alter table public.page_views enable row level security;
drop policy if exists "views readable" on public.page_views;
create policy "views readable" on public.page_views for select using (true);
create or replace function public.bump_view(p_slug text) returns void language sql security definer set search_path = public as $$
  insert into public.page_views (page_slug, day, n) values (left(p_slug, 80), current_date, 1)
  on conflict (page_slug, day) do update set n = public.page_views.n + 1;
$$;
grant execute on function public.bump_view(text) to anon, authenticated;

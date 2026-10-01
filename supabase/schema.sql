-- ============================================================
-- allofus.one · Supabase schema (paste the WHOLE file into
-- Supabase → SQL Editor → New query → Run). Safe to re-run.
-- ============================================================

-- PROFILES (one per account)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (char_length(username) between 1 and 20),
  display_name text not null default 'Someone',
  mode text not null default 'hanging' check (mode in ('home','hanging','working','exploring','dnd')),
  paths text[] default '{}',
  city text, bio text, causes text[] default '{}',
  looking_for text, attractor text,
  avatar jsonb default '{}'::jsonb,
  home jsonb default '{}'::jsonb,
  referred_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
-- LIFEBOARDS are private: only you can read or write yours
create table if not exists public.lifeboards (
  id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.lifeboards enable row level security;
drop policy if exists "own lifeboard" on public.lifeboards;
create policy "own lifeboard" on public.lifeboards for all using (auth.uid() = id) with check (auth.uid() = id);

-- CONNECTIONS (waves + connect requests)
create table if not exists public.connections (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'connect' check (kind in ('wave','connect')),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique (requester, addressee)
);
alter table public.connections enable row level security;
drop policy if exists "see my connections" on public.connections;
create policy "see my connections" on public.connections for select using (auth.uid() in (requester, addressee));
drop policy if exists "send requests" on public.connections;
create policy "send requests" on public.connections for insert with check (auth.uid() = requester and requester <> addressee);
drop policy if exists "update my connections" on public.connections;
create policy "update my connections" on public.connections for update using (auth.uid() in (requester, addressee));

-- MESSAGES (direct when recipient is set, room chat when room is set)
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references public.profiles(id) on delete cascade,
  sender_name text,
  recipient uuid references public.profiles(id) on delete cascade,
  room text,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz default now(),
  check (recipient is not null or room is not null)
);
alter table public.messages enable row level security;
drop policy if exists "read my messages and rooms" on public.messages;
create policy "read my messages and rooms" on public.messages for select using (room is not null or auth.uid() in (sender, recipient));
drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages for insert with check (
  auth.uid() = sender and (
    room is not null
    or exists (select 1 from public.connections c where c.status = 'accepted' and ((c.requester = sender and c.addressee = recipient) or (c.addressee = sender and c.requester = recipient)))
    or body like '📨%'   -- message requests from strangers
  ));
create index if not exists messages_room_idx on public.messages(room, created_at desc);
create index if not exists messages_pair_idx on public.messages(sender, recipient, created_at);

-- GLOBAL MATCH (items + services only)
create table if not exists public.match_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  kind text not null check (kind in ('have','need')),
  category text not null check (category in ('item','service')),
  title text not null check (char_length(title) between 2 and 90),
  details text, city text,
  status text not null default 'open' check (status in ('open','matched','closed')),
  created_at timestamptz default now()
);
alter table public.match_posts enable row level security;
drop policy if exists "match readable" on public.match_posts;
create policy "match readable" on public.match_posts for select using (true);
drop policy if exists "match own insert" on public.match_posts;
create policy "match own insert" on public.match_posts for insert with check (auth.uid() = user_id);
drop policy if exists "match own update" on public.match_posts;
create policy "match own update" on public.match_posts for update using (auth.uid() = user_id);
drop policy if exists "match own delete" on public.match_posts;
create policy "match own delete" on public.match_posts for delete using (auth.uid() = user_id);

-- LAND (one lot per person; lot id = "x_z")
create table if not exists public.plots (
  id text primary key,
  owner uuid not null unique references public.profiles(id) on delete cascade,
  name text, style text default 'deco', skin text,
  x double precision not null, z double precision not null,
  claimed_at timestamptz default now()
);
alter table public.plots enable row level security;
drop policy if exists "plots readable" on public.plots;
create policy "plots readable" on public.plots for select using (true);
drop policy if exists "claim own plot" on public.plots;
create policy "claim own plot" on public.plots for insert with check (auth.uid() = owner);
drop policy if exists "edit own plot" on public.plots;
create policy "edit own plot" on public.plots for update using (auth.uid() = owner);
drop policy if exists "release own plot" on public.plots;
create policy "release own plot" on public.plots for delete using (auth.uid() = owner);

-- MEETING REQUESTS (call / meeting / VR visit)
create table if not exists public.meeting_requests (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('call','meeting','vr')),
  when_at text, note text,
  status text not null default 'sent' check (status in ('sent','accepted','declined')),
  created_at timestamptz default now()
);
alter table public.meeting_requests enable row level security;
drop policy if exists "see my meetings" on public.meeting_requests;
create policy "see my meetings" on public.meeting_requests for select using (auth.uid() in (from_user, to_user));
drop policy if exists "request meetings" on public.meeting_requests;
create policy "request meetings" on public.meeting_requests for insert with check (auth.uid() = from_user);
drop policy if exists "answer meetings" on public.meeting_requests;
create policy "answer meetings" on public.meeting_requests for update using (auth.uid() = to_user);

-- FEED POSTS
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  author uuid not null references public.profiles(id) on delete cascade,
  author_name text,
  kind text default 'update' check (kind in ('update','win','ask','offer')),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz default now()
);
alter table public.posts enable row level security;
drop policy if exists "posts readable" on public.posts;
create policy "posts readable" on public.posts for select using (true);
drop policy if exists "post own" on public.posts;
create policy "post own" on public.posts for insert with check (auth.uid() = author);
drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts for delete using (auth.uid() = author);

-- WISH LANTERNS
create table if not exists public.wishes (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  text text not null check (char_length(text) between 1 and 80),
  created_at timestamptz default now()
);
alter table public.wishes enable row level security;
drop policy if exists "wishes readable" on public.wishes;
create policy "wishes readable" on public.wishes for select using (true);
drop policy if exists "make wishes" on public.wishes;
create policy "make wishes" on public.wishes for insert with check (auth.uid() = user_id);

-- REALTIME: push new messages, connections and plots to the browser instantly
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.connections; exception when others then null; end;
  begin alter publication supabase_realtime add table public.plots; exception when others then null; end;
end $$;

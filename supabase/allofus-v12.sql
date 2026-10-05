-- allofus.one v12 · Hearts (18+ mind-first matching) tables. Safe to re-run. Run after v11.
create table if not exists public.hearts_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null, age int not null check (age >= 18 and age <= 99),
  sex text not null check (sex in ('m','f')), want text not null check (want in ('m','f')),
  city text, height text, bio text check (char_length(bio) <= 240),
  answers jsonb not null default '{}'::jsonb,      -- the 12 trait questions
  love jsonb not null default '{}'::jsonb,         -- love-gevity answers (attachment, conflict, values, affection)
  prefs jsonb not null default '{}'::jsonb,        -- match preferences
  photos jsonb not null default '[]'::jsonb,       -- unlocked only after a match + 3 questions each
  active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now());
alter table public.hearts_profiles enable row level security;
drop policy if exists "hearts profiles readable by members" on public.hearts_profiles;
create policy "hearts profiles readable by members" on public.hearts_profiles for select using (auth.uid() is not null and active);
drop policy if exists "hearts profile own insert" on public.hearts_profiles;
create policy "hearts profile own insert" on public.hearts_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "hearts profile own update" on public.hearts_profiles;
create policy "hearts profile own update" on public.hearts_profiles for update using (auth.uid() = user_id);
drop policy if exists "hearts profile own delete" on public.hearts_profiles;
create policy "hearts profile own delete" on public.hearts_profiles for delete using (auth.uid() = user_id);

-- a "yes" from one person to another; two yeses = a match
create table if not exists public.hearts_yes (
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  yes boolean not null default true,
  created_at timestamptz default now(),
  primary key (from_id, to_id));
alter table public.hearts_yes enable row level security;
drop policy if exists "hearts yes own rows" on public.hearts_yes;
create policy "hearts yes own rows" on public.hearts_yes for select using (auth.uid() = from_id or auth.uid() = to_id);
drop policy if exists "hearts yes insert own" on public.hearts_yes;
create policy "hearts yes insert own" on public.hearts_yes for insert with check (auth.uid() = from_id);
drop policy if exists "hearts yes update own" on public.hearts_yes;
create policy "hearts yes update own" on public.hearts_yes for update using (auth.uid() = from_id);

-- mutual matches, computed (no table to keep in sync)
create or replace view public.hearts_matches as
  select a.from_id as user_a, a.to_id as user_b, greatest(a.created_at, b.created_at) as matched_at
  from public.hearts_yes a join public.hearts_yes b on a.from_id = b.to_id and a.to_id = b.from_id
  where a.yes and b.yes and a.from_id < a.to_id;

-- guided questions + messages between matched people only
create table if not exists public.hearts_messages (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'msg' check (kind in ('msg','answer','photo-unlock','call','date')),
  body text check (char_length(body) <= 2000),
  created_at timestamptz default now());
create index if not exists hearts_messages_pair_idx on public.hearts_messages (least(from_id, to_id), greatest(from_id, to_id), created_at);
alter table public.hearts_messages enable row level security;
drop policy if exists "hearts msgs between matched" on public.hearts_messages;
create policy "hearts msgs between matched" on public.hearts_messages for select using (auth.uid() = from_id or auth.uid() = to_id);
drop policy if exists "hearts msgs insert if matched" on public.hearts_messages;
create policy "hearts msgs insert if matched" on public.hearts_messages for insert with check (
  auth.uid() = from_id and exists (select 1 from public.hearts_yes y1 join public.hearts_yes y2 on y1.from_id = y2.to_id and y1.to_id = y2.from_id
    where y1.yes and y2.yes and y1.from_id = from_id and y1.to_id = to_id));

-- reports: anyone signed in can file one; only the reporter sees their own
create table if not exists public.hearts_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users(id) on delete cascade,
  about uuid references auth.users(id) on delete cascade,
  about_sample text,
  reason text not null check (char_length(reason) <= 600),
  created_at timestamptz default now());
alter table public.hearts_reports enable row level security;
drop policy if exists "hearts reports insert" on public.hearts_reports;
create policy "hearts reports insert" on public.hearts_reports for insert with check (auth.uid() = reporter);
drop policy if exists "hearts reports own select" on public.hearts_reports;
create policy "hearts reports own select" on public.hearts_reports for select using (auth.uid() = reporter);

-- spam protection: max 40 yeses per day, max 60 messages per hour
create or replace function public.hearts_rate_ok() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'hearts_yes' and (select count(*) from public.hearts_yes where from_id = new.from_id and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Slow down — 40 yeses a day is plenty.'; end if;
  if tg_table_name = 'hearts_messages' and (select count(*) from public.hearts_messages where from_id = new.from_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Slow down — 60 messages an hour is plenty.'; end if;
  return new;
end $$;
drop trigger if exists hearts_yes_rate on public.hearts_yes;
create trigger hearts_yes_rate before insert on public.hearts_yes for each row execute function public.hearts_rate_ok();
drop trigger if exists hearts_msg_rate on public.hearts_messages;
create trigger hearts_msg_rate before insert on public.hearts_messages for each row execute function public.hearts_rate_ok();
drop trigger if exists hearts_profiles_touch on public.hearts_profiles;
create trigger hearts_profiles_touch before update on public.hearts_profiles for each row execute function public.touch_updated_at();

-- allofus.one v14 · plumbing gaps found in the audit: rooms (hub_messages), saved posts (feed_saves), expert-build leads. Safe to re-run.
create table if not exists public.hub_messages (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  user_id uuid not null references auth.users(id) on delete cascade,
  body text check (char_length(body) <= 2000),
  post_id bigint,
  created_at timestamptz default now());
create index if not exists hub_messages_room_idx on public.hub_messages (room, created_at desc);
alter table public.hub_messages enable row level security;
drop policy if exists "rooms readable" on public.hub_messages;
create policy "rooms readable" on public.hub_messages for select using (true);
drop policy if exists "rooms post own" on public.hub_messages;
create policy "rooms post own" on public.hub_messages for insert with check (auth.uid() = user_id);
drop policy if exists "rooms delete own" on public.hub_messages;
create policy "rooms delete own" on public.hub_messages for delete using (auth.uid() = user_id);

create table if not exists public.feed_saves (
  post_id bigint not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id));
alter table public.feed_saves enable row level security;
drop policy if exists "saves own" on public.feed_saves;
create policy "saves own" on public.feed_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.leads (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'brand-build',
  name text, business text, email text, phone text, website text, details text,
  created_at timestamptz default now());
alter table public.leads add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.leads add column if not exists kind text not null default 'brand-build';
alter table public.leads add column if not exists name text;
alter table public.leads add column if not exists business text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists website text;
alter table public.leads add column if not exists details jsonb;
alter table public.leads add column if not exists created_at timestamptz default now();
alter table public.leads enable row level security;
drop policy if exists "leads admin read" on public.leads;
create policy "leads admin read" on public.leads for select using (public.is_admin());
drop function if exists public.submit_lead(text,text,text,text,text,text,text);
create or replace function public.submit_lead(p_kind text, p_name text, p_business text, p_email text, p_phone text, p_website text, p_details text) returns bigint
language sql security definer set search_path = public as $$
  insert into public.leads (user_id, kind, name, business, email, phone, website, details) values (auth.uid(), coalesce(p_kind, 'brand-build'), left(p_name, 120), left(p_business, 160), left(p_email, 160), left(p_phone, 60), left(p_website, 240), to_jsonb(left(p_details, 2000))) returning id;
$$;
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.hub_messages'; exception when others then null; end;
end $$;

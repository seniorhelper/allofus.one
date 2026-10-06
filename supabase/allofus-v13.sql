-- allofus.one v13 · the real admin dashboard: signups with emails, who is online, daily stats. Safe to re-run. Run after v12.
-- Admins are identified by login email. Edit this list if it ever changes.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select lower(email) in ('zach@eyetoad.com','zachwennstedt@gmail.com') from auth.users where id = auth.uid()), false);
$$;

-- presence: every signed-in client heartbeats once a minute with where it is (feed / 3d / vr / mall)
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  "where" text not null default 'feed',
  page text,
  last_seen timestamptz not null default now());
alter table public.presence enable row level security;
drop policy if exists "presence own upsert" on public.presence;
create policy "presence own upsert" on public.presence for insert with check (auth.uid() = user_id);
drop policy if exists "presence own update" on public.presence;
create policy "presence own update" on public.presence for update using (auth.uid() = user_id);
drop policy if exists "presence readable" on public.presence;
create policy "presence readable" on public.presence for select using (auth.uid() is not null);

-- signups with email, join date, last sign-in, last seen — admins only
create or replace function public.admin_signups(p_limit int default 200) returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, username text, display_name text, last_seen timestamptz, "where" text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, p.username, p.display_name, pr.last_seen, pr."where"
  from auth.users u left join public.profiles p on p.id = u.id left join public.presence pr on pr.user_id = u.id
  where public.is_admin() order by u.created_at desc limit p_limit;
$$;

-- daily stats for charts — admins only
create or replace function public.admin_stats(p_days int default 30) returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not public.is_admin() then return '{}'::json; end if;
  select json_build_object(
    'members', (select count(*) from auth.users),
    'online', (select count(*) from public.presence where last_seen > now() - interval '3 minutes'),
    'online_by', (select coalesce(json_object_agg("where", c), '{}'::json) from (select "where", count(*) c from public.presence where last_seen > now() - interval '3 minutes' group by "where") q),
    'today', (select count(*) from auth.users where created_at > date_trunc('day', now())),
    'week', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'posts24', (select count(*) from public.feed_posts where created_at > now() - interval '24 hours'),
    'posts', (select count(*) from public.feed_posts),
    'comments24', (select count(*) from public.feed_comments where created_at > now() - interval '24 hours'),
    'pages', (select count(*) from public.pages),
    'hearts', (select count(*) from public.hearts_profiles),
    'hearts_matches', (select count(*) from public.hearts_matches),
    'bugs7', (select count(*) from public.bugs where created_at > now() - interval '7 days'),
    'signups_by_day', (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]'::json) from (select date_trunc('day', created_at)::date d, count(*) n from auth.users where created_at > now() - (p_days || ' days')::interval group by 1) s),
    'posts_by_day', (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]'::json) from (select date_trunc('day', created_at)::date d, count(*) n from public.feed_posts where created_at > now() - (p_days || ' days')::interval group by 1) s),
    'active_by_day', (select coalesce(json_agg(json_build_object('d', d, 'n', n) order by d), '[]'::json) from (select date_trunc('day', last_sign_in_at)::date d, count(*) n from auth.users where last_sign_in_at > now() - (p_days || ' days')::interval group by 1) s),
    'top_groups', (select coalesce(json_agg(json_build_object('g', group_slug, 'n', n) order by n desc), '[]'::json) from (select group_slug, count(*) n from public.feed_posts where group_slug is not null group by 1 order by 2 desc limit 8) s)
  ) into r;
  return r;
end $$;

-- recent activity for the live ticker — admins only
create or replace function public.admin_activity(p_limit int default 40) returns table (kind text, who text, what text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'signup'::text as kind, coalesce(p.display_name, split_part(u.email, '@', 1))::text as who, ''::text as what, u.created_at as at from auth.users u left join public.profiles p on p.id = u.id
    union all select 'post', coalesce(p.display_name, 'someone'), left(coalesce(f.text, ''), 90), f.created_at from public.feed_posts f left join public.profiles p on p.id = f.user_id
    union all select 'comment', coalesce(p.display_name, 'someone'), left(coalesce(c.body, ''), 90), c.created_at from public.feed_comments c left join public.profiles p on p.id = c.user_id
    union all select 'page', coalesce(p.display_name, 'someone'), g.name, g.created_at from public.pages g left join public.profiles p on p.id = g.owner_id
    union all select 'hearts', coalesce(p.display_name, 'someone'), 'joined Hearts', h.created_at from public.hearts_profiles h left join public.profiles p on p.id = h.user_id
    union all select 'bug', coalesce(p.display_name, 'anon'), left(coalesce(b.note, ''), 90), b.created_at from public.bugs b left join public.profiles p on p.id = b.user_id
  ) x where public.is_admin() order by x.at desc limit p_limit;
$$;

-- live updates: let the admin page subscribe to new rows
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.presence'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.profiles'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.feed_posts'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.bugs'; exception when others then null; end;
end $$;

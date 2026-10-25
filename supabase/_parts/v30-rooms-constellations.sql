-- ============================================================================
-- allofus.one · v30 · Rooms (live chat, rebuilt) + Constellations (Oct 25 2026)
-- Run AFTER v29-match.sql (uses match_screen / match_strikes / hub_messages from v29). Additive, re-runnable.
--
-- ROOMS: a real room list (public.rooms), messages screened by the Match Shield rules, a 20-per-minute flood limit,
--   /me actions, replies, and soft delete. Who-is-here, typing and door chimes run on Supabase Realtime presence on the
--   private channel 'room:<slug>' (already allowed for adults by rt_topic_allowed in v27), so they need no tables.
-- CONSTELLATIONS: what members used to call Groups and Spaces. Built on public.spaces (members, events, posts through
--   feed_posts.group_slug keep working). Adds a genre, keeps the creator's own title (spaces.name), and an approval step:
--   every new Constellation starts 'pending' until an admin approves it. The ten old buy/sell/trade Groups become official
--   'market' Constellations with the same slugs, so every old post stays where it was.
-- ============================================================================

-- ---------- ROOMS ----------
create table if not exists public.rooms (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  topic text check (char_length(topic) <= 200),
  theme text not null default 'dusk' check (theme in ('dusk', 'dawn', 'ocean', 'forest', 'ember', 'aurora', 'paper')),
  kind text not null default 'topic' check (kind in ('lobby', 'topic', 'constellation')),
  space_slug text references public.spaces(slug) on delete cascade,
  sort int not null default 100,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid,
  created_at timestamptz default now());
alter table public.rooms enable row level security;
drop policy if exists "rooms list readable" on public.rooms;
create policy "rooms list readable" on public.rooms for select using (status = 'open' or public.is_admin());
drop policy if exists "rooms admin write" on public.rooms;
create policy "rooms admin write" on public.rooms for all using (public.is_admin()) with check (public.is_admin());

insert into public.rooms (slug, name, topic, theme, kind, sort) values
  ('general', 'The Lobby', 'Say hi. Everyone starts here.', 'dawn', 'lobby', 1),
  ('help', 'Help Desk', 'Ask how anything on allofus works. Members and the team answer.', 'paper', 'topic', 10),
  ('kindness', 'Kindness Corner', 'Good news, small wins, gratitude.', 'aurora', 'topic', 20),
  ('business', 'Shop Talk', 'Owners, makers and side hustles trading notes.', 'ember', 'topic', 30),
  ('night-owls', 'Night Owls', 'For the ones still up.', 'dusk', 'topic', 40),
  ('denver', 'Denver Live', 'Colorado people, plans and places.', 'forest', 'topic', 50),
  ('creators', 'Studio', 'Music, art, video, writing: share what you are making.', 'ocean', 'topic', 60),
  ('banquet', 'The Banquet Hall', 'Big conversations, one table.', 'ember', 'topic', 70)
on conflict (slug) do nothing;

alter table public.hub_messages add column if not exists kind text not null default 'say';
alter table public.hub_messages add column if not exists reply_to bigint;
alter table public.hub_messages add column if not exists status text not null default 'ok';
alter table public.hub_messages drop constraint if exists hub_messages_v30_enums;
alter table public.hub_messages add constraint hub_messages_v30_enums check (kind in ('say', 'me', 'system') and status in ('ok', 'removed', 'deleted')) not valid;

drop policy if exists "rooms readable" on public.hub_messages;
create policy "rooms readable" on public.hub_messages for select using (status = 'ok' or auth.uid() = user_id or public.is_admin());
drop policy if exists "rooms own soft delete" on public.hub_messages;
create policy "rooms own soft delete" on public.hub_messages for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

create or replace function public.room_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; hits text[]; ms record;
begin
  if tg_op = 'UPDATE' then
    -- members may only delete their own line (status ok -> deleted); nothing else changes
    if not public.is_admin() then
      if new.status = 'deleted' and old.status = 'ok' then new := old; new.status := 'deleted'; return new; end if;
      return old;
    end if;
    return new;
  end if;
  if public.is_admin() then new.status := 'ok'; return new; end if;
  if new.kind = 'system' then new.kind := 'say'; end if;
  select * into ms from public.member_safety where user_id = new.user_id;
  if found and (ms.banned or ms.held) then raise exception 'ROOM_PAUSED: chat is paused on this account while a moderator reviews it' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.rooms r where r.slug = new.room and r.status = 'open') then raise exception 'ROOM_CLOSED: that room is not open' using errcode = 'P0001'; end if;
  select count(*) into n from public.hub_messages where user_id = new.user_id and created_at > now() - interval '1 minute';
  if n >= 20 then raise exception 'ROOM_SLOW: slow down a little (20 lines a minute)' using errcode = 'P0001'; end if;
  new.status := 'ok';
  hits := public.match_screen(coalesce(new.body, ''));
  if cardinality(hits) > 0 then new.status := 'removed'; end if;
  return new;
end $$;
drop trigger if exists room_guard_v30 on public.hub_messages;
create trigger room_guard_v30 before insert or update on public.hub_messages for each row execute function public.room_guard();

create or replace function public.room_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.status = 'removed' then
    insert into public.match_strikes (user_id, source, rules, excerpt) values (new.user_id, 'room', public.match_screen(new.body), left(new.room || ': ' || coalesce(new.body, ''), 400));
    begin insert into public.safety_incidents (kind, user_id, details) values ('room_block', new.user_id, jsonb_build_object('room', new.room, 'message_id', new.id)); exception when others then null; end;
    select count(*) into n from public.match_strikes where user_id = new.user_id and created_at > now() - interval '90 days';
    if n >= 3 then
      begin insert into public.member_safety (user_id, held, held_reason) values (new.user_id, true, 'Shield: 3 strikes')
        on conflict (user_id) do update set held = true, held_reason = 'Shield: 3 strikes'; exception when others then null; end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists room_after_v30 on public.hub_messages;
create trigger room_after_v30 after insert on public.hub_messages for each row execute function public.room_after();

-- ---------- CONSTELLATIONS (public.spaces) ----------
alter table public.spaces add column if not exists genre text default 'gathering';
alter table public.spaces add column if not exists status text default 'approved';   -- existing ones stay live
alter table public.spaces alter column status set default 'pending';                -- new ones wait for review
alter table public.spaces add column if not exists reviewed_by uuid;
alter table public.spaces add column if not exists reviewed_at timestamptz;
alter table public.spaces add column if not exists review_note text;
alter table public.spaces add column if not exists icon text;
update public.spaces set status = 'approved' where status is null;
alter table public.spaces drop constraint if exists spaces_v30_enums;
alter table public.spaces add constraint spaces_v30_enums check (
  genre in ('gathering', 'party', 'guild', 'salon', 'jam', 'summit', 'market', 'quest', 'haven', 'kin', 'lab', 'arena')
  and status in ('pending', 'approved', 'rejected', 'paused')) not valid;
create index if not exists spaces_status_v30 on public.spaces (status, genre);

drop policy if exists "spaces readable" on public.spaces;
create policy "spaces readable" on public.spaces for select using (status = 'approved' or auth.uid() = owner or public.is_admin());
drop policy if exists "v30 spaces adults create" on public.spaces;
create policy "v30 spaces adults create" on public.spaces as restrictive for insert to public with check (public.is_admin() or public.safety_is_adult(auth.uid()));
-- joining only once a Constellation is approved (owners and admins excepted)
drop policy if exists "v30 join approved only" on public.space_members;
create policy "v30 join approved only" on public.space_members as restrictive for insert to public with check (
  public.is_admin() or exists (select 1 from public.spaces s where s.slug = space_slug and (s.status = 'approved' or s.owner = auth.uid())));

create or replace function public.constellation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- the SQL editor / service role (no signed-in member) and admins are not held to member rules
  if auth.uid() is null or public.is_admin() then return new; end if;
  if cardinality(public.match_screen(coalesce(new.name, '') || ' ' || coalesce(new.about, ''))) > 0 then
    raise exception 'SHIELD: that name or description is not allowed on allofus' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.spaces where owner = new.owner and status = 'pending';
    if n >= 3 then raise exception 'You already have 3 Constellations waiting for review.' using errcode = 'P0001'; end if;
    new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
  else
    new.status := old.status; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note; new.owner := old.owner;
    -- a renamed or re-described Constellation goes back to review
    if (new.name is distinct from old.name or new.about is distinct from old.about) and old.status = 'approved' then new.status := 'pending'; end if;
  end if;
  return new;
end $$;
drop trigger if exists constellation_guard_v30 on public.spaces;
create trigger constellation_guard_v30 before insert or update on public.spaces for each row execute function public.constellation_guard();

create or replace function public.constellation_review(p_slug text, p_decision text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_decision not in ('approved', 'rejected', 'paused') then raise exception 'decision must be approved, rejected or paused'; end if;
  update public.spaces set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 300) where slug = p_slug;
  if not found then raise exception 'no such Constellation'; end if;
  -- every approved Constellation gets its own chat Room (closed again if it is paused or rejected)
  insert into public.rooms (slug, name, topic, theme, kind, space_slug, sort, created_by)
    select left('c-' || s.slug, 40), left(s.name, 60), left(coalesce(s.about, ''), 200), 'aurora', 'constellation', s.slug, 500, auth.uid() from public.spaces s where s.slug = p_slug
    on conflict (slug) do update set status = case when p_decision = 'approved' then 'open' else 'closed' end;
  update public.rooms set status = case when p_decision = 'approved' then 'open' else 'closed' end where space_slug = p_slug;
  begin perform public.audit_add('constellation_review', jsonb_build_object('slug', p_slug, 'decision', p_decision)); exception when others then null; end;
  return p_decision;
end $$;
revoke all on function public.constellation_review(text, text, text) from public, anon;
grant execute on function public.constellation_review(text, text, text) to authenticated;

-- the ten classic Groups become official Market Constellations (same slugs, so old posts stay put)
do $$ declare f uuid := '320bf5d4-2d2d-482e-8633-87ced55e4155'; begin
  if exists (select 1 from auth.users where id = f) then
    insert into public.spaces (slug, owner, name, about, genre, status, color, kind) values
      ('general', f, 'Trading Post', 'Buy, sell and trade anything legal and kind.', 'market', 'approved', '#0f766e', 'official'),
      ('vehicles', f, 'Wheels', 'Cars, bikes, boats and parts.', 'market', 'approved', '#1d4ed8', 'official'),
      ('furniture', f, 'Home + Nest', 'Furniture, decor and home goods.', 'market', 'approved', '#b45309', 'official'),
      ('electronics', f, 'Gadget Bench', 'Phones, computers, audio and tech.', 'market', 'approved', '#4338ca', 'official'),
      ('tools', f, 'The Workshop', 'Tools and equipment, to sell or lend.', 'market', 'approved', '#57534e', 'official'),
      ('kids', f, 'Little Ones', 'Baby and kids gear, handed down with love.', 'kin', 'approved', '#db2777', 'official'),
      ('free', f, 'Free Table', 'Free stuff. Take what helps, give what you can.', 'market', 'approved', '#15803d', 'official'),
      ('services', f, 'Skills + Pros', 'Hire, offer or swap services.', 'guild', 'approved', '#7c3aed', 'official'),
      ('business', f, 'Main Street', 'Local businesses announcing what is new.', 'summit', 'approved', '#c2410c', 'official'),
      ('wishes', f, 'Lantern Wishes', 'Send a wish into the sky.', 'haven', 'approved', '#d97706', 'official')
    on conflict (slug) do nothing;
  end if;
end $$;

-- ---------- CONSTELLATION GUESTBOOKS (old-school, Shield-screened) ----------
create table if not exists public.constellation_guestbook (
  id bigint generated always as identity primary key,
  space_slug text not null references public.spaces(slug) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'ok' check (status in ('ok', 'removed', 'deleted')),
  created_at timestamptz default now());
create index if not exists cgb_space_v30 on public.constellation_guestbook (space_slug, created_at desc);
alter table public.constellation_guestbook enable row level security;
drop policy if exists "cgb read" on public.constellation_guestbook;
create policy "cgb read" on public.constellation_guestbook for select using (status = 'ok' or auth.uid() = user_id or public.is_admin());
drop policy if exists "cgb sign" on public.constellation_guestbook;
create policy "cgb sign" on public.constellation_guestbook for insert to authenticated with check (user_id = auth.uid() and public.safety_is_adult(auth.uid())
  and exists (select 1 from public.spaces s where s.slug = space_slug and s.status = 'approved'));
drop policy if exists "cgb own delete" on public.constellation_guestbook;
create policy "cgb own delete" on public.constellation_guestbook for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create or replace function public.cgb_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tg_op = 'UPDATE' then
    if public.is_admin() then return new; end if;
    if new.status = 'deleted' and old.status = 'ok' then new := old; new.status := 'deleted'; return new; end if;
    return old;
  end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  select count(*) into n from public.constellation_guestbook where user_id = new.user_id and created_at > now() - interval '1 hour';
  if n >= 10 then raise exception 'Ten guestbook notes an hour is the limit.' using errcode = 'P0001'; end if;
  new.status := case when cardinality(public.match_screen(new.body)) > 0 then 'removed' else 'ok' end;
  if new.status = 'removed' then
    insert into public.match_strikes (user_id, source, rules, excerpt) values (new.user_id, 'guestbook', public.match_screen(new.body), left(new.space_slug || ': ' || new.body, 400));
  end if;
  return new;
end $$;
drop trigger if exists cgb_guard_v30 on public.constellation_guestbook;
create trigger cgb_guard_v30 before insert or update on public.constellation_guestbook for each row execute function public.cgb_guard();

-- public counts for the star map (members per Constellation)
create or replace function public.constellation_counts() returns table (slug text, members bigint, notes bigint)
language sql stable security definer set search_path = public as $$
  select s.slug,
    (select count(*) from public.space_members m where m.space_slug = s.slug and m.status = 'in'),
    (select count(*) from public.constellation_guestbook g where g.space_slug = s.slug and g.status = 'ok')
  from public.spaces s where s.status = 'approved';
$$;
grant execute on function public.constellation_counts() to anon, authenticated;

-- verify
select (select count(*) from public.rooms) as rooms, (select count(*) from public.spaces where kind = 'official') as official_constellations;

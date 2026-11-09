-- ============================================================================================================
-- allofus.one · v34 (Nov 8 2026, RAN on production Nov 10 2026 with Zach's OK; @sm added) · PRIVATE ROOMS + the "Producers" room. Additive, idempotent, safe to re-run.
-- Asked for by Zach Nov 8 2026: a private producers-only chat room, open to members of every tier, invite only.
-- Before this, every open Room was readable by every signed-in adult; nothing enforced "private".
--   1. rooms.private flag + public.room_members (who may enter a private room). Only admins add or remove people.
--   2. room_can_see(slug): open room, or a private room you were added to, or you are an admin.
--   3. RESTRICTIVE policies: private rooms are hidden from the room list, their messages can't be read or written,
--      and their live channel 'room:<slug>' (presence, typing) refuses everyone else.
--   4. Creates the room 'producers' (private) and adds the founder.
-- Add a member:    select public.room_add('producers', '<username>');
-- Remove a member: select public.room_remove('producers', '<username>');
-- ============================================================================================================
alter table public.rooms add column if not exists private boolean not null default false;

create table if not exists public.room_members (
  room_slug text not null references public.rooms(slug) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid,
  added_at timestamptz not null default now(),
  primary key (room_slug, user_id));
create index if not exists room_members_user_idx on public.room_members (user_id);
alter table public.room_members enable row level security;
drop policy if exists "room members read own" on public.room_members;
create policy "room members read own" on public.room_members for select to authenticated
  using (user_id = auth.uid() or (select public.is_admin()));
drop policy if exists "room members admin write" on public.room_members;
create policy "room members admin write" on public.room_members for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.room_members from anon;

create or replace function public.room_can_see(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when not exists (select 1 from public.rooms r where r.slug = p_slug and r.private) then true
    else exists (select 1 from public.room_members m where m.room_slug = p_slug and m.user_id = auth.uid()) end;
$$;
revoke all on function public.room_can_see(text) from public, anon;
grant execute on function public.room_can_see(text) to authenticated;

-- room list: private rooms only for their members (and admins)
drop policy if exists "v34 private rooms list" on public.rooms;
create policy "v34 private rooms list" on public.rooms as restrictive for select to public
  using (not private or (select public.room_can_see(slug)));

-- messages: no reading or writing in a private room you are not in
drop policy if exists "v34 private rooms read" on public.hub_messages;
create policy "v34 private rooms read" on public.hub_messages as restrictive for select to public
  using (public.room_can_see(room));
drop policy if exists "v34 private rooms write" on public.hub_messages;
create policy "v34 private rooms write" on public.hub_messages as restrictive for insert to public
  with check (public.room_can_see(room));

-- live channel 'room:<slug>' (who's here, typing): same rule. Leaves the v27 adults-only policies as they are.
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "v34 private rooms rt read" on realtime.messages';
    execute $p$create policy "v34 private rooms rt read" on realtime.messages as restrictive for select to authenticated
      using (realtime.topic() not like 'room:%' or public.room_can_see(substr(realtime.topic(), 6)))$p$;
    execute 'drop policy if exists "v34 private rooms rt write" on realtime.messages';
    execute $p$create policy "v34 private rooms rt write" on realtime.messages as restrictive for insert to authenticated
      with check (realtime.topic() not like 'room:%' or public.room_can_see(substr(realtime.topic(), 6)))$p$;
  end if;
exception when others then raise warning 'realtime policies: %', sqlerrm; end $$;

-- admin helpers (by username), each tells the member
create or replace function public.room_add(p_slug text, p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid; rname text;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  select id into u from public.profiles where lower(username) = lower(p_username);
  if u is null then raise exception 'no member with username %', p_username; end if;
  select name into rname from public.rooms where slug = p_slug;
  if rname is null then raise exception 'no room %', p_slug; end if;
  insert into public.room_members (room_slug, user_id, added_by) values (p_slug, u, auth.uid()) on conflict do nothing;
  begin perform public.notify(u, 'mod', 'You were added to the private room ' || rname, 'Only invited members can see it.', '/chat/?r=' || p_slug, coalesce(auth.uid(), public.founder_id())); exception when others then null; end;
  begin perform public.audit_write('room_add', 'member', u::text, jsonb_build_object('room', p_slug)); exception when others then null; end;
  return 'added';
end $$;
create or replace function public.room_remove(p_slug text, p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admins only'; end if;
  select id into u from public.profiles where lower(username) = lower(p_username);
  delete from public.room_members where room_slug = p_slug and user_id = u;
  begin perform public.audit_write('room_remove', 'member', coalesce(u::text, p_username), jsonb_build_object('room', p_slug)); exception when others then null; end;
  return 'removed';
end $$;
revoke all on function public.room_add(text, text) from public, anon;
revoke all on function public.room_remove(text, text) from public, anon;
grant execute on function public.room_add(text, text) to authenticated;
grant execute on function public.room_remove(text, text) to authenticated;

-- the Producers room
insert into public.rooms (slug, name, topic, theme, kind, sort, private, status)
values ('producers', 'Producers Room', 'Private: invited producers and creators only. Shows, music, films and ideas.', 'ocean', 'topic', 65, true, 'open')
on conflict (slug) do update set private = true;
insert into public.room_members (room_slug, user_id) select 'producers', public.founder_id() on conflict do nothing;

-- self-check
select r.slug, r.private, (select count(*) from public.room_members m where m.room_slug = r.slug) as members from public.rooms r where r.slug = 'producers';

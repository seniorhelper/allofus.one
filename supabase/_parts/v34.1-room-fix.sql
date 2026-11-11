-- allofus.one · v34.1 (Nov 10 2026): fix for v34. Logged-out visitors got "Could not reach the rooms" because the v34
-- policies call room_can_see(), which anon could not execute and which returned false for anon even on open rooms.
-- Now: open rooms -> true for everyone (as before v34); private rooms -> members and admins only.
create or replace function public.room_can_see(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.rooms r where r.slug = p_slug and r.private) then true
    when auth.uid() is null then false
    when public.is_admin() then true
    else exists (select 1 from public.room_members m where m.room_slug = p_slug and m.user_id = auth.uid()) end;
$$;
grant execute on function public.room_can_see(text) to anon, authenticated;

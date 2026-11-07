-- ============================================================================================================
-- allofus.one · v33 (Nov 7 2026) · ON-DEVICE FACE AGE CHECK. Additive, idempotent. Approved by Zach Nov 7 2026.
-- Every member does a one-time selfie age estimate (js/aou-agecheck.js). The picture stays on the device; only the
-- estimated age is stored here. 25+ = done. 18-24 = flagged for a person. Under 18 = held (restricted) until reviewed.
-- This is a first filter only: it never sets age_level 'adult_verified' (that stays for a real provider such as Yoti).
-- ============================================================================================================
alter table public.member_safety add column if not exists face_est_age numeric;
alter table public.member_safety add column if not exists face_result text;          -- pass | review | under18 | cleared | held
alter table public.member_safety add column if not exists face_samples int;
alter table public.member_safety add column if not exists face_checked_at timestamptz;

insert into public.safety_settings (key, value, secret) values ('face_check_required', 'true'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.safety_face_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'required', public.safety_flag('face_check_required') and not public.is_admin(),
    'done', s.face_checked_at is not null or coalesce(s.age_level, '') = 'adult_verified',
    'result', s.face_result)
  from (select auth.uid() as uid) u left join public.member_safety s on s.user_id = u.uid
  where u.uid is not null;
$$;
revoke all on function public.safety_face_status() from public, anon;
grant execute on function public.safety_face_status() to authenticated;

create or replace function public.safety_face_check(p_age numeric, p_samples int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.member_safety%rowtype; v_res text; who text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  select * into s from public.member_safety where user_id = uid;
  if s.face_checked_at is not null then return jsonb_build_object('ok', true, 'result', s.face_result, 'already', true); end if;   -- one try; a person resets it
  if p_age is null or p_age < 3 or p_age > 100 or coalesce(p_samples, 0) < 5 then raise exception 'That check did not work. Please try again.'; end if;
  v_res := case when p_age < 18 then 'under18' when p_age < 25 then 'review' else 'pass' end;
  insert into public.member_safety as m (user_id, face_est_age, face_result, face_samples, face_checked_at, flagged, restricted, restricted_reason, updated_at)
  values (uid, round(p_age, 1), v_res, p_samples, now(), v_res <> 'pass', v_res = 'under18',
          case when v_res = 'under18' then 'Face age estimate under 18: held for a person to review' end, now())
  on conflict (user_id) do update set face_est_age = excluded.face_est_age, face_result = excluded.face_result, face_samples = excluded.face_samples,
     face_checked_at = excluded.face_checked_at, flagged = m.flagged or excluded.flagged,
     restricted = m.restricted or excluded.restricted,
     restricted_reason = coalesce(excluded.restricted_reason, m.restricted_reason), updated_at = now();
  if v_res <> 'pass' then
    select coalesce(display_name, username, 'A member') into who from public.profiles where id = uid;
    begin perform public.notify(public.founder_id(), 'mod', case when v_res = 'under18' then '🛑 Age check: ' || who || ' looks under 18 (held)' else '👀 Age check: ' || who || ' looks 18-24' end,
      'Estimate ' || round(p_age) || '. Review in Age checks.', '/?v=agereview', uid); exception when others then null; end;
  end if;
  begin perform public.audit_write('face_age_check', 'member', uid::text, jsonb_build_object('result', v_res, 'est', round(p_age, 1), 'samples', p_samples)); exception when others then null; end;
  return jsonb_build_object('ok', true, 'result', v_res);
end $$;
revoke all on function public.safety_face_check(numeric, int) from public, anon;
grant execute on function public.safety_face_check(numeric, int) to authenticated;

create or replace function public.admin_face_reviews() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'username', p.username, 'name', p.display_name, 'est', s.face_est_age,
      'result', s.face_result, 'at', s.face_checked_at, 'dob_age', case when s.dob is null then null else date_part('year', age(s.dob))::int end) order by s.face_checked_at desc)
    from public.member_safety s left join public.profiles p on p.id = s.user_id
   where s.face_result in ('review', 'under18')), '[]'::jsonb);
end $$;
revoke all on function public.admin_face_reviews() from public, anon;
grant execute on function public.admin_face_reviews() to authenticated;

create or replace function public.admin_face_decide(p_user uuid, p_adult boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_adult then
    update public.member_safety set face_result = 'cleared', flagged = false,
      restricted = case when restricted_reason like 'Face age estimate%' then false else restricted end,
      restricted_reason = case when restricted_reason like 'Face age estimate%' then null else restricted_reason end, updated_at = now()
     where user_id = p_user;
    begin perform public.notify(p_user, 'mod', 'Your account is all set ✅', 'A person reviewed your age check. Thanks for your patience.', '/', auth.uid()); exception when others then null; end;
  else
    update public.member_safety set face_result = 'held', restricted = true, updated_at = now() where user_id = p_user;
  end if;
  begin perform public.audit_write(case when p_adult then 'face_clear' else 'face_hold' end, 'member', p_user::text, '{}'::jsonb); exception when others then null; end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_face_decide(uuid, boolean) from public, anon;
grant execute on function public.admin_face_decide(uuid, boolean) to authenticated;
-- an admin can let someone redo the check: update public.member_safety set face_checked_at = null, face_result = null where user_id = '…';

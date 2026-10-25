-- v29b: the database calls to match-ai and safety-sweep carry the public (publishable) key so the gateway lets them through
create or replace function public.match_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; v_url text; v_secret text;
begin
  if new.status = 'removed' and jsonb_array_length(coalesce(new.screen -> 'rules', '[]')) > 0
     and (tg_op = 'INSERT' or old.status is distinct from 'removed') then
    insert into public.match_strikes (user_id, source, rules, excerpt, post_id)
      values (new.user_id, 'shield', array(select jsonb_array_elements_text(new.screen -> 'rules')), left(new.title || ' / ' || coalesce(new.details, ''), 400), new.id);
    begin
      insert into public.safety_incidents (kind, user_id, details) values ('match_block', new.user_id, jsonb_build_object('post_id', new.id, 'rules', new.screen -> 'rules', 'title', left(new.title, 120)));
    exception when others then null; end;
    select count(*) into n from public.match_strikes where user_id = new.user_id and created_at > now() - interval '90 days';
    if n >= 3 then
      begin
        insert into public.member_safety (user_id, held, held_reason) values (new.user_id, true, 'Match Shield: 3 strikes')
          on conflict (user_id) do update set held = true, held_reason = 'Match Shield: 3 strikes';
      exception when others then null; end;
    end if;
  end if;
  -- ask Claude to read every new open post (async; never blocks the member)
  if tg_op = 'INSERT' and new.status = 'open' and to_regnamespace('net') is not null then
    select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'match_ai_url';
    select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
    if coalesce(v_url, '') <> '' then
      begin
        execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 8000)', v_url,
          jsonb_build_object('mode', 'review', 'post_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, ''), 'apikey', 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF'));
      exception when others then raise warning 'match-ai webhook: %', sqlerrm; end;
    end if;
  end if;
  return null;
end $$;


create or replace function public.safety_sweep_kick() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'safety_sweep_url';
  select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
  if coalesce(v_url, '') = '' or to_regnamespace('net') is null then return; end if;
  execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 60000)', v_url,
    jsonb_build_object('hours', 13), jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, ''), 'apikey', 'sb_publishable_b6KPHJ3aPWaxl3yVz93sTw_c47NzfOF'));
end $$;

revoke all on function public.safety_sweep_kick() from public, anon, authenticated;
select 1 as patched;

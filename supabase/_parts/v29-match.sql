-- ============================================================================
-- allofus.one · v29 · Global Match 2.0 + Match Shield (Oct 25 2026)
-- Run AFTER v28-lockdown.sql. Additive and re-runnable (safe to run twice).
--
-- 1. match_posts grows up: topic, exchange (give/sell/trade/lend/borrow/teach…), reach (nearby → worldwide),
--    urgency, tags (AI keywords for matching), screen + ai verdicts, 'held' / 'removed' states.
-- 2. The Match Shield in the database: the same BLOCK rules as js/aou-match-safety.js run on every insert/update.
--    A blocked post is saved as 'removed' (never shown), logged as a strike + safety incident.
--    3 strikes in 90 days = posting paused + account held for an admin. Admins are never blocked.
-- 3. Rate limits: accounts younger than 7 days may post 3 per 24 h, everyone else 15 per 24 h.
-- 4. match_links ("this is a match") + match_stats() for honest live counters on /match/.
-- 5. Claude review: after each new post, pg_net calls the match-ai Edge Function (if match_ai_url is set),
--    which can hold the post. safety-sweep re-reads the last 13 h at 7am + 7pm Denver (pg_cron).
--    Both reuse the media_scan_secret already stored in safety_settings, so no key is copied by hand.
-- ============================================================================

-- ---------- 0. Rooms backend (hub_messages) was never created on production (button audit 10-25: /?v=room got 404) ----------
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
drop policy if exists "v26 adults only insert" on public.hub_messages;
create policy "v26 adults only insert" on public.hub_messages as restrictive for insert to public with check (public.is_admin() or public.safety_is_adult(auth.uid()));
do $$ begin begin execute 'alter publication supabase_realtime add table public.hub_messages'; exception when others then null; end; end $$;

-- ---------- 0b. video uploads up to 50 MB (the client checks the same limit; Supabase's project-wide cap must be 50 MB or more) ----------
update storage.buckets set file_size_limit = 52428800 where id in ('posts', 'quarantine');

-- ---------- 1. columns ----------
alter table public.match_posts add column if not exists topic text;
alter table public.match_posts add column if not exists exchange text;
alter table public.match_posts add column if not exists reach text default 'city';
alter table public.match_posts alter column reach set default 'city';
update public.match_posts set reach = 'city' where reach is null or reach = 'local';
alter table public.match_posts add column if not exists urgency text;
alter table public.match_posts add column if not exists tags text[] default '{}';
alter table public.match_posts add column if not exists screen jsonb;
alter table public.match_posts add column if not exists ai jsonb;
alter table public.match_posts add column if not exists updated_at timestamptz default now();
alter table public.match_posts drop constraint if exists match_posts_status_check;
alter table public.match_posts add constraint match_posts_status_check check (status in ('open', 'matched', 'closed', 'held', 'removed'));
alter table public.match_posts drop constraint if exists match_posts_details_len_v29;
alter table public.match_posts add constraint match_posts_details_len_v29 check (details is null or char_length(details) <= 1000) not valid;
alter table public.match_posts drop constraint if exists match_posts_v29_enums;
alter table public.match_posts add constraint match_posts_v29_enums check (
  (topic is null or topic in ('things', 'rides', 'skills', 'time', 'space', 'work', 'food', 'pets', 'kids', 'tech', 'home', 'health', 'other'))
  and (exchange is null or exchange in ('give', 'sell', 'trade', 'lend', 'teach', 'volunteer', 'free', 'buy', 'borrow', 'hire', 'learn', 'swap'))
  and (reach is null or reach in ('nearby', 'city', 'country', 'world'))
  and (urgency is null or urgency in ('now', 'week', 'month', 'anytime'))
  and (cardinality(tags) <= 24)) not valid;
create index if not exists match_posts_open_v29 on public.match_posts (status, kind, created_at desc);
create index if not exists match_posts_user_v29 on public.match_posts (user_id, created_at desc);

-- only open/matched posts are public; owners still see their own held/removed posts (so they know why)
drop policy if exists "match readable" on public.match_posts;
create policy "match readable" on public.match_posts for select using (status in ('open', 'matched') or auth.uid() = user_id or public.is_admin());

-- ---------- 2. strikes ----------
create table if not exists public.match_strikes (
  id bigint generated always as identity primary key,
  user_id uuid not null,              -- no FK: outlives the account (evidence)
  created_at timestamptz default now(),
  source text not null default 'shield',   -- shield | ai | sweep | admin
  rules text[] not null default '{}',
  excerpt text,
  post_id bigint);
create index if not exists match_strikes_user_v29 on public.match_strikes (user_id, created_at desc);
alter table public.match_strikes enable row level security;
drop policy if exists "match strikes own or admin read" on public.match_strikes;
create policy "match strikes own or admin read" on public.match_strikes for select using (auth.uid() = user_id or public.is_admin());
revoke insert, update, delete on public.match_strikes from anon, authenticated;

-- ---------- 3. the shield in SQL (rules generated from js/aou-match-safety.js) ----------
create or replace function public.match_norm(p text, p_leet boolean default true) returns text
language plpgsql immutable set search_path = public as $$
declare t text := lower(coalesce(p, '')); prev text; w text; buf text := ''; outp text := '';
begin
  t := regexp_replace(t, '[' || chr(8203) || '-' || chr(8207) || chr(8288) || chr(65279) || ']', '', 'g');
  t := translate(t, 'аеорсухіјѕԁɡαορτνκ', 'aeopcyxijsdgaoptvk');
  if p_leet then
    -- digits/symbols inside words become letters (w33d → weed), numbers on their own stay numbers
    loop prev := t;
      t := regexp_replace(t, '([a-z])[0]|[0]([a-z])', '\1o\2', 'g'); t := regexp_replace(t, '([a-z])[1!|]|[1!|]([a-z])', '\1i\2', 'g');
      t := regexp_replace(t, '([a-z])[3]|[3]([a-z])', '\1e\2', 'g'); t := regexp_replace(t, '([a-z])[4@]|[4@]([a-z])', '\1a\2', 'g');
      t := regexp_replace(t, '([a-z])[5$]|[5$]([a-z])', '\1s\2', 'g'); t := regexp_replace(t, '([a-z])[7+]|[7+]([a-z])', '\1t\2', 'g');
      exit when t = prev; end loop;
  end if;
  t := regexp_replace(t, '[._*~-]+([a-z])', '\1', 'g');
  -- "k u s h" → "kush" (only runs of 3+ single letters, so "i need a bike" is untouched)
  foreach w in array regexp_split_to_array(t, ' ') loop
    if w ~ '^[a-z]$' then buf := buf || w;
    else
      if buf <> '' then outp := outp || ' ' || case when length(buf) >= 3 then buf else array_to_string(regexp_split_to_array(buf, ''), ' ') end; buf := ''; end if;
      outp := outp || ' ' || w;
    end if;
  end loop;
  if buf <> '' then outp := outp || ' ' || case when length(buf) >= 3 then buf else array_to_string(regexp_split_to_array(buf, ''), ' ') end; end if;
  t := ltrim(outp);
  t := regexp_replace(t, '([a-z])\1{2,}', '\1\1', 'g');
  return t;
end $$;

create or replace function public.match_screen(p text) returns text[]
language plpgsql immutable set search_path = public as $$
declare plain text := public.match_norm(p, false); t text := public.match_norm(p, true); hits text[] := '{}'; r record;
begin
  for r in select * from (values
-- @@RULES-BEGIN@@ (generated from js/aou-match-safety.js: block rules only, word boundaries written as \y)
    ('drugs', '\y(kush|zaza|mdma|ecstasy|xanax|xans|percocets?|percs|oxycodone|oxycontin|oxys?|roxys?|fentanyl|fent|m30s?|cocaine|crack rock|meth|methamphetamine|heroin|shrooms|psilocybin|lsd|dmt|ketamine|ket|thc carts?|dab pens?|wax pens?|adderall|vicodin|hydrocodone|codeine|lean|promethazine|tramadol|suboxone|steroids|tren|anavar|clenbuterol|kratom|pressies|blues pills?)\y'),
    ('drugs-sale', '\y(no (rx|script|prescription)|without (a )?prescription|rx (meds|pills) for sale|pills? for sale|420 friendly|weed (for sale|delivery)|(sell|selling|got|have) (weed|bud|flower|pot|grass|edibles|carts))\y|\y(oz|ozs|qp|zip|8th|eighth|grams?|g) (of )?(weed|bud|flower|loud|gas|za)\y'),
    ('weapons', '\y(guns?|firearms?|handguns?|pistols?|rifles?|shotguns?|revolvers?|ammo|ammunition|rounds of|glock|ar ?15|ak ?47|9mm|ghost guns?|80 ?% lower|lower receivers?|suppressors?|silencers?|auto sears?|glock switch|bump stocks?|drum mags?|high capacity mags?|3d printed guns?|tasers?|brass knuckles|switchblades?|grenades?|explosives?|pipe bombs?|detonators?|tannerite|thermite)\y'),
    ('sex', '\y(escorts?|escorting|gfe|pse|incall|outcall|happy ending|full service|sugar (daddy|baby|mama)|onlyfans|only fans|nudes?|sexting|hook ?ups?|nsfw|fetish|bdsm|porn|xxx|cam ?girls?|strip(per|tease)|erotic massage|body rubs?|qv|hhr|roses for)\y'),
    ('minors', '\y(underage|barely legal|young (girls?|boys?)|teen (girls?|boys?|pics|nudes)|jailbait|loli|cp|minors? (for|wanted|available)|kids? (for sale|available))\y'),
    ('trafficking', '\y(new in town|fresh (girls?|faces?)|(girls?|women|workers?) available|visa (work|sponsor) (no|without) papers|passport (held|kept)|human (organs?|remains)|kidneys? (for sale|wanted)|organs? for sale|buy a (baby|child|kid)|babies? for sale|surrogacy cash)\y'),
    ('fraud', '\y(fullz|cvv|dumps|carding|cash ?out (method|service)|bank (logs?|logins?)|fake (ids?|passports?|licen[cs]es?|diplomas?|degrees?|documents?|checks?|money|bills)|scannable|novelty (ids?|licen[cs]es?)|counterfeit|ssns? for sale|social security numbers?|stolen|no serial|hacked accounts?|account takeover|ddos|phishing kits?|ransomware|malware|botnet|keyloggers?|essay (writing )?service|take (my|your) exam)\y'),
    ('knockoff', '\y(replicas?|reps|1 ?: ?1 (quality|copy)|aaa (quality|grade)|mirror quality|super ?fake|knock ?offs?|dupes? of (rolex|gucci|lv|louis))\y'),
    ('violence', '\y(hitman|hit man|kill (him|her|them|someone|you)|murder for hire|beat (him|her|them|someone) up|(hurt|harm) (him|her|them|someone)|revenge (on|for)|swatting|dox(x)?(ing)?)\y'),
    ('hate', '\y(n[i]gg(a|er|ers|as)|f[a]gg?ots?|k[i]kes?|sp[i]cs?|ch[i]nks?|tr[a]nn(y|ies)|wetbacks?|g[o]oks?|raghead|towelhead|white power|heil hitler|14 ?88)\y'),
    ('wildlife', '\y(ivory|rhino horn|tiger (skin|bone|parts)|pangolin|shark fin|bear bile)\y')
-- @@RULES-END@@
  ) as x(id, rx) loop
    if plain ~ r.rx or t ~ r.rx then hits := hits || r.id; end if;
  end loop;
  return hits;
end $$;
grant execute on function public.match_screen(text) to anon, authenticated;
grant execute on function public.match_norm(text, boolean) to anon, authenticated;

create or replace function public.match_can_post(uid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare n_strikes int; n_day int; joined timestamptz; ms record;
begin
  if uid is null then return 'Sign in to post.'; end if;
  if public.is_admin() then return null; end if;
  select * into ms from public.member_safety where user_id = uid;
  if found and (ms.banned or ms.held) then return 'Posting is paused on this account while a moderator reviews it.'; end if;
  select count(*) into n_strikes from public.match_strikes where user_id = uid and created_at > now() - interval '90 days';
  if n_strikes >= 3 then return 'Posting is paused: this account tripped the safety shield 3 times.'; end if;
  select created_at into joined from auth.users where id = uid;
  select count(*) into n_day from public.match_posts where user_id = uid and created_at > now() - interval '24 hours';
  if joined is not null and joined > now() - interval '7 days' and n_day >= 3 then return 'New accounts can post 3 matches a day. Try again tomorrow.'; end if;
  if n_day >= 15 then return 'That is 15 posts today. Try again tomorrow.'; end if;
  return null;
end $$;
grant execute on function public.match_can_post(uuid) to authenticated;

create or replace function public.match_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare why text; hits text[];
begin
  if tg_op = 'INSERT' then
    why := public.match_can_post(new.user_id);
    if why is not null then raise exception 'MATCH_PAUSED: %', why using errcode = 'P0001'; end if;
    new.status := 'open';
    new.ai := null;
    select coalesce(nullif(display_name, ''), username) into new.user_name from public.profiles where id = new.user_id;
  else
    -- members cannot reopen a post the shield / AI / an admin took down, and cannot rewrite verdicts
    if not public.is_admin() and coalesce(current_setting('aou.match_sys', true), '') <> '1' then
      if old.status in ('held', 'removed') then new.status := old.status; end if;
      if new.status not in ('open', 'matched', 'closed', old.status) then new.status := old.status; end if;
      new.ai := old.ai; new.user_id := old.user_id; new.user_name := old.user_name;
    end if;
  end if;
  new.tags := (select coalesce(array_agg(distinct lower(left(x, 32))), '{}') from unnest(coalesce(new.tags, '{}')) x where x ~ '^[[:alnum:] -]{2,32}$');
  hits := public.match_screen(coalesce(new.title, '') || ' ' || coalesce(new.details, '') || ' ' || coalesce(new.city, '') || ' ' || array_to_string(new.tags, ' '));
  new.screen := jsonb_build_object('rules', to_jsonb(hits), 'at', now());
  if cardinality(hits) > 0 and not public.is_admin() then new.status := 'removed'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_guard_v29 on public.match_posts;
create trigger match_guard_v29 before insert or update on public.match_posts for each row execute function public.match_guard();

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
          jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, '')));
      exception when others then raise warning 'match-ai webhook: %', sqlerrm; end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists match_after_v29 on public.match_posts;
create trigger match_after_v29 after insert or update on public.match_posts for each row execute function public.match_after();

-- service role (match-ai / safety-sweep) records an AI verdict; 'hold' takes the post down + a strike for 'block'
create or replace function public.match_ai_verdict(p_post bigint, p_verdict text, p_reason text, p_source text default 'ai') returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.match_posts where id = p_post;
  if not found then return; end if;
  perform set_config('aou.match_sys', '1', true);
  update public.match_posts set ai = jsonb_build_object('verdict', p_verdict, 'reason', left(p_reason, 300), 'source', p_source, 'at', now()),
    status = case when p_verdict in ('hold', 'block') and status in ('open', 'matched') then 'held' else status end
    where id = p_post;
  if p_verdict = 'block' then
    insert into public.match_strikes (user_id, source, rules, excerpt, post_id) values (p.user_id, p_source, array['ai:' || left(p_reason, 60)], left(p.title || ' / ' || coalesce(p.details, ''), 400), p.id);
  end if;
  if p_verdict in ('hold', 'block') then
    begin
      insert into public.safety_incidents (kind, user_id, details) values ('match_' || p_verdict, p.user_id, jsonb_build_object('post_id', p.id, 'reason', p_reason, 'source', p_source, 'title', left(p.title, 120)));
    exception when others then null; end;
  end if;
end $$;
revoke all on function public.match_ai_verdict(bigint, text, text, text) from public, anon, authenticated;

-- a member searched the board for something the shield blocks: logged for moderators (not a strike; the page shows a warning)
create or replace function public.match_search_flag(p_q text) returns boolean
language plpgsql security definer set search_path = public as $$
declare hits text[] := public.match_screen(left(coalesce(p_q, ''), 200)); n int;
begin
  if auth.uid() is null or cardinality(hits) = 0 then return false; end if;
  select count(*) into n from public.safety_incidents where kind = 'match_search' and user_id = auth.uid() and created_at > now() - interval '24 hours';
  if n < 20 then
    insert into public.safety_incidents (kind, user_id, details) values ('match_search', auth.uid(), jsonb_build_object('rules', to_jsonb(hits), 'q', left(p_q, 120)));
  end if;
  return true;
end $$;
revoke all on function public.match_search_flag(text) from public, anon;
grant execute on function public.match_search_flag(text) to authenticated;

-- ---------- 4. links + honest counters ----------
create table if not exists public.match_links (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  need_id bigint references public.match_posts(id) on delete cascade,
  have_id bigint references public.match_posts(id) on delete cascade,
  by_user uuid not null default auth.uid(),
  unique (need_id, have_id));
alter table public.match_links enable row level security;
drop policy if exists "match links insert own" on public.match_links;
create policy "match links insert own" on public.match_links for insert to authenticated with check (by_user = auth.uid() and public.safety_is_adult(auth.uid()));
drop policy if exists "match links read" on public.match_links;
create policy "match links read" on public.match_links for select using (true);

create or replace function public.match_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'needs', (select count(*) from public.match_posts where status = 'open' and kind = 'need'),
    'haves', (select count(*) from public.match_posts where status = 'open' and kind = 'have'),
    'matches', (select count(*) from public.match_links) + (select count(*) from public.match_posts where status = 'matched'),
    'today', (select count(*) from public.match_posts where status in ('open', 'matched') and created_at > now() - interval '24 hours'),
    'places', (select count(distinct lower(city)) from public.match_posts where status in ('open', 'matched') and coalesce(city, '') <> ''));
$$;
grant execute on function public.match_stats() to anon, authenticated;

-- ---------- 5. settings + schedule ----------
insert into public.safety_settings (key, value, secret) values ('match_ai_url', '""'::jsonb, false) on conflict (key) do nothing;
insert into public.safety_settings (key, value, secret) values ('safety_sweep_url', '""'::jsonb, false) on conflict (key) do nothing;
-- After deploying the two Edge Functions (verify-JWT OFF), turn them on:
--   update public.safety_settings set value = '"https://izfccjaznlcffvjxawya.supabase.co/functions/v1/match-ai"' where key = 'match_ai_url';
--   update public.safety_settings set value = '"https://izfccjaznlcffvjxawya.supabase.co/functions/v1/safety-sweep"' where key = 'safety_sweep_url';

create or replace function public.safety_sweep_kick() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select s.value #>> '{}' into v_url from public.safety_settings s where s.key = 'safety_sweep_url';
  select s.value #>> '{}' into v_secret from public.safety_settings s where s.key = 'media_scan_secret';
  if coalesce(v_url, '') = '' or to_regnamespace('net') is null then return; end if;
  execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 60000)', v_url,
    jsonb_build_object('hours', 13), jsonb_build_object('Content-Type', 'application/json', 'x-aou-secret', coalesce(v_secret, '')));
end $$;
revoke all on function public.safety_sweep_kick() from public, anon, authenticated;

-- 7am + 7pm Denver (13:00 + 01:00 UTC while on daylight time; 6am/6pm in winter). Does nothing until safety_sweep_url is set.
do $$ begin
  if to_regnamespace('cron') is not null then
    begin perform cron.unschedule('aou-safety-sweep'); exception when others then null; end;
    perform cron.schedule('aou-safety-sweep', '0 1,13 * * *', 'select public.safety_sweep_kick()');
  end if;
end $$;

-- verify
select public.match_screen('selling w33d 1 oz') as should_block, public.match_screen('free couch, gently used') as should_be_empty;

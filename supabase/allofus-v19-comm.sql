-- allofus.one v19 · Comm Hub upgrade (Oct 2026). Additive and safe to re-run. Never deletes or rewrites existing rows.
-- Paste into Supabase → SQL Editor → Run. The site already works without it (archive / pin / mute / read state fall
-- back to the browser, editing and deleting messages show a gentle "needs the v19 update" note). After this runs:
--   1. messages: edited_at, read_at; senders can edit/delete their own messages, recipients can mark them read
--      (a guard trigger keeps each side to its own columns).
--   2. hub_requests: edited_at, read_at; senders can edit/delete their own notes (status stays the recipient's call).
--   3. comm_state: per-person thread state (archived, pinned, muted, last read, marked unread, request accepted).
--   4. realtime for messages, hub_requests, meeting_requests, connections (the Hub updates live).

-- ---------- 1. messages ----------
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists read_at timestamptz;
drop policy if exists "edit own messages v19" on public.messages;
create policy "edit own messages v19" on public.messages for update using (auth.uid() in (sender, recipient)) with check (auth.uid() in (sender, recipient));
drop policy if exists "delete own messages v19" on public.messages;
create policy "delete own messages v19" on public.messages for delete using (auth.uid() = sender);

create or replace function public.messages_guard_v19() returns trigger language plpgsql as $$
begin
  if new.sender is distinct from old.sender or new.recipient is distinct from old.recipient or new.room is distinct from old.room or new.created_at is distinct from old.created_at then
    raise exception 'Only the text of a message can change.';
  end if;
  if auth.uid() = old.sender and auth.uid() is distinct from old.recipient then
    if new.read_at is distinct from old.read_at then new.read_at := old.read_at; end if;           -- the sender cannot fake a read receipt
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  elsif auth.uid() = old.recipient and auth.uid() is distinct from old.sender then
    if new.body is distinct from old.body or new.edited_at is distinct from old.edited_at then
      raise exception 'You can only mark someone else''s message as read.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists messages_guard_v19 on public.messages;
create trigger messages_guard_v19 before update on public.messages for each row execute function public.messages_guard_v19();

-- ---------- 2. hub_requests ----------
alter table public.hub_requests add column if not exists edited_at timestamptz;
alter table public.hub_requests add column if not exists read_at timestamptz;
drop policy if exists "hub edit own v19" on public.hub_requests;
create policy "hub edit own v19" on public.hub_requests for update using (auth.uid() = from_user) with check (auth.uid() = from_user);
drop policy if exists "hub delete own v19" on public.hub_requests;
create policy "hub delete own v19" on public.hub_requests for delete using (auth.uid() = from_user);

create or replace function public.hub_requests_guard_v19() returns trigger language plpgsql as $$
begin
  if new.from_user is distinct from old.from_user or new.to_user is distinct from old.to_user or new.kind is distinct from old.kind or new.created_at is distinct from old.created_at then
    raise exception 'Only the note of a request can change.';
  end if;
  if auth.uid() = old.from_user and auth.uid() is distinct from old.to_user then
    if new.status is distinct from old.status then raise exception 'Only the person you sent it to can answer a request.'; end if;
    if new.read_at is distinct from old.read_at then new.read_at := old.read_at; end if;
    if new.body is distinct from old.body or new.media is distinct from old.media then new.edited_at := now(); end if;
  elsif auth.uid() = old.to_user and auth.uid() is distinct from old.from_user then
    if new.body is distinct from old.body or new.media is distinct from old.media or new.edited_at is distinct from old.edited_at then
      raise exception 'You can answer a request, not change it.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists hub_requests_guard_v19 on public.hub_requests;
create trigger hub_requests_guard_v19 before update on public.hub_requests for each row execute function public.hub_requests_guard_v19();

-- ---------- 3. comm_state (one row per person per conversation, owner-only) ----------
create table if not exists public.comm_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null check (char_length(thread_key) between 1 and 120),
  archived boolean not null default false,
  archived_at timestamptz,
  pinned boolean not null default false,
  muted boolean not null default false,
  last_read_at timestamptz,
  marked_unread boolean not null default false,
  accepted boolean not null default false,
  updated_at timestamptz default now(),
  primary key (user_id, thread_key));
alter table public.comm_state add column if not exists archived_at timestamptz;
alter table public.comm_state add column if not exists marked_unread boolean not null default false;
alter table public.comm_state add column if not exists accepted boolean not null default false;
alter table public.comm_state add column if not exists updated_at timestamptz default now();
alter table public.comm_state enable row level security;
drop policy if exists "comm state read own" on public.comm_state;
create policy "comm state read own" on public.comm_state for select using (auth.uid() = user_id);
drop policy if exists "comm state insert own" on public.comm_state;
create policy "comm state insert own" on public.comm_state for insert with check (auth.uid() = user_id);
drop policy if exists "comm state update own" on public.comm_state;
create policy "comm state update own" on public.comm_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "comm state delete own" on public.comm_state;
create policy "comm state delete own" on public.comm_state for delete using (auth.uid() = user_id);

-- ---------- 4. meeting_requests: the person who sent an invitation can see its answer change live ----------
create index if not exists meeting_requests_to_idx on public.meeting_requests (to_user, created_at desc);
create index if not exists meeting_requests_from_idx on public.meeting_requests (from_user, created_at desc);
create index if not exists hub_from_idx on public.hub_requests (from_user, created_at desc);

-- ---------- 5. realtime ----------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.messages'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.hub_requests'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.meeting_requests'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.connections'; exception when others then null; end;
end $$;

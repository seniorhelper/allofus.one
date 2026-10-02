-- ============================================================
-- allofus.one · v4: conference uploads (Supabase Storage)
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Public bucket so everyone in the hall can view what is presented.
-- Signed-in people upload only into their own folder; 50 MB max.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('conference', 'conference', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "conference read" on storage.objects;
create policy "conference read" on storage.objects for select using (bucket_id = 'conference');
drop policy if exists "conference upload own folder" on storage.objects;
create policy "conference upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'conference' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "conference delete own" on storage.objects;
create policy "conference delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'conference' and (storage.foldername(name))[1] = auth.uid()::text);

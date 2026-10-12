-- Run once in your Supabase project's SQL Editor.
-- Private bucket, so voice recordings are only available with signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jim-voices', 'jim-voices', false, 2097152,
        array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Each signed-in owner can access only recordings in their own first folder.
create policy "jim voice owner select" on storage.objects for select to authenticated
using (bucket_id = 'jim-voices' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "jim voice owner insert" on storage.objects for insert to authenticated
with check (bucket_id = 'jim-voices' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "jim voice owner update" on storage.objects for update to authenticated
using (bucket_id = 'jim-voices' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'jim-voices' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "jim voice owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'jim-voices' and (storage.foldername(name))[1] = (select auth.uid()::text));

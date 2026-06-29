-- ═══ AVATAR STORAGE ═══════════════════════════════════════════════════════
-- Creates a public-read, authenticated-write storage bucket for user
-- profile pictures.
--
-- Path convention: `{user_id}/{timestamp}.{ext}`
--
-- Security model:
--   - Anyone can READ avatars (they're meant to be displayed on public profiles).
--   - Only the authenticated user matching the first path segment can WRITE
--     to their own folder. This prevents user A from overwriting user B's
--     avatar even if they craft a malicious upload request.
--   - File size + mime type are enforced at the bucket level so a
--     pathological client can't upload a 50MB executable disguised as a PNG.
-- ═════════════════════════════════════════════════════════════════════════

-- ─── Bucket ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                                            -- public read
  2 * 1024 * 1024,                                 -- 2 MB max
  array['image/jpeg', 'image/png', 'image/webp']   -- only sensible image formats
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── RLS policies on storage.objects for this bucket ──────────────────────
-- Storage uses the standard RLS system on storage.objects.
-- The first path segment is checked against auth.uid() for writes.

-- Anyone (including unauthenticated visitors) can READ avatars.
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can INSERT only into their own folder
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can UPDATE only their own avatar
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can DELETE their own avatar
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

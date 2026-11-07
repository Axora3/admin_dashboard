-- ---------------------------------------------------------------------------
-- AXORA — storage bucket for product logos/images
-- Objects are stored as <store_id>/<random>.<ext>. Reads are public because
-- the URLs are embedded in the public storefront; writes require store access.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists store_assets_public_read on storage.objects;
create policy store_assets_public_read on storage.objects
  for select using (bucket_id = 'store-assets');

drop policy if exists store_assets_insert on storage.objects;
create policy store_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_store_access(((storage.foldername(name))[1])::uuid)
      )
    )
  );

drop policy if exists store_assets_update on storage.objects;
create policy store_assets_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_store_access(((storage.foldername(name))[1])::uuid)
      )
    )
  )
  with check (
    bucket_id = 'store-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_store_access(((storage.foldername(name))[1])::uuid)
      )
    )
  );

drop policy if exists store_assets_delete on storage.objects;
create policy store_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-assets'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and public.has_store_access(((storage.foldername(name))[1])::uuid)
      )
    )
  );

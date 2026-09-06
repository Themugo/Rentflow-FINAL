-- Core flow upload buckets used by properties, tenants, leases, contracts, and platform billing.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-images', 'property-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('tenant-photos', 'tenant-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('signed-contracts', 'signed-contracts', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('contracts', 'contracts', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_delete" ON storage.objects;

CREATE POLICY "property_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

CREATE POLICY "property_images_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "property_images_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-images')
  WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "property_images_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "tenant_photos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_authenticated_delete" ON storage.objects;

CREATE POLICY "tenant_photos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tenant-photos');

CREATE POLICY "tenant_photos_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-photos');

CREATE POLICY "tenant_photos_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-photos')
  WITH CHECK (bucket_id = 'tenant-photos');

CREATE POLICY "tenant_photos_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-photos');

DROP POLICY IF EXISTS "signed_contracts_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "signed_contracts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "signed_contracts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "signed_contracts_authenticated_delete" ON storage.objects;

CREATE POLICY "signed_contracts_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signed-contracts');

CREATE POLICY "signed_contracts_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signed-contracts');

CREATE POLICY "signed_contracts_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signed-contracts')
  WITH CHECK (bucket_id = 'signed-contracts');

CREATE POLICY "signed_contracts_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signed-contracts');

DROP POLICY IF EXISTS "contracts_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "contracts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "contracts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "contracts_authenticated_delete" ON storage.objects;

CREATE POLICY "contracts_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "contracts_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "contracts_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts')
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "contracts_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');

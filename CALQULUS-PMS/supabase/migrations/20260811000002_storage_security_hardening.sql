-- ══════════════════════════════════════════════════════════════
-- CALQULUS RMS — PHASE 4: STORAGE & DOCUMENT SECURITY HARDENING
-- Migration: 20260811000002_storage_security_hardening.sql
-- Description: Hardens storage.objects policies for all buckets.
-- ══════════════════════════════════════════════════════════════

-- 1. Ensure all buckets exist with correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-photos', 'profile-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('company-logos', 'company-logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('property-images', 'property-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('tenant-photos', 'tenant-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('contracts', 'contracts', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('signed-contracts', 'signed-contracts', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('maintenance-photos', 'maintenance-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ══════════════════════════════════════════════════════════════
-- 2. Clean Up Legacy Over-Permissive Storage Policies
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tenant_photos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "tenant_photos_authenticated_delete" ON storage.objects;

DROP POLICY IF EXISTS "signed_contracts_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "signed_contracts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "signed_contracts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "signed_contracts_authenticated_delete" ON storage.objects;

DROP POLICY IF EXISTS "contracts_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "contracts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "contracts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "contracts_authenticated_delete" ON storage.objects;

DROP POLICY IF EXISTS "property_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_delete" ON storage.objects;

DROP POLICY IF EXISTS "Manager_upload_maintenance_photos" ON storage.objects;

-- ══════════════════════════════════════════════════════════════
-- 3. Tenant Photos (Private — Tenant PII)
-- ══════════════════════════════════════════════════════════════

-- SELECT: Tenant (own photo), Manager (their tenant), Submanager (their manager's tenant)
DROP POLICY IF EXISTS "tenant_photos_scoped_select" ON storage.objects;
CREATE POLICY "tenant_photos_scoped_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tenant-photos' AND (
      -- 1. Tenant reading own photo (matching owner, auth.uid, or tenant_id folder)
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] IN (
        SELECT ur.tenant_id::text FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'tenant' AND ur.tenant_id IS NOT NULL
      )
      OR
      -- 2. Manager or Submanager managing the tenant
      EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND (
            t.manager_id = auth.uid()
            OR t.manager_id IN (
              SELECT sp.manager_id FROM public.submanager_permissions sp
              WHERE sp.submanager_user_id = auth.uid()
            )
          )
      )
    )
  );

-- INSERT / UPDATE / DELETE: Tenant (own folder) or Manager/Submanager
DROP POLICY IF EXISTS "tenant_photos_scoped_insert" ON storage.objects;
CREATE POLICY "tenant_photos_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-photos' AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] IN (
        SELECT ur.tenant_id::text FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'tenant' AND ur.tenant_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND (
            t.manager_id = auth.uid()
            OR t.manager_id IN (
              SELECT sp.manager_id FROM public.submanager_permissions sp
              WHERE sp.submanager_user_id = auth.uid()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "tenant_photos_scoped_update" ON storage.objects;
CREATE POLICY "tenant_photos_scoped_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-photos' AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = (storage.foldername(name))[1] AND t.manager_id = auth.uid()
      )
    )
  )
  WITH CHECK (bucket_id = 'tenant-photos');

DROP POLICY IF EXISTS "tenant_photos_scoped_delete" ON storage.objects;
CREATE POLICY "tenant_photos_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-photos' AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = (storage.foldername(name))[1] AND t.manager_id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 4. Signed Contracts (Private — Confidential Agreements)
-- ══════════════════════════════════════════════════════════════

-- SELECT: Tenant (own lease/contract), Manager/Submanager (their property), Landlord (their property)
DROP POLICY IF EXISTS "signed_contracts_scoped_select" ON storage.objects;
CREATE POLICY "signed_contracts_scoped_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signed-contracts' AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] IN (
        SELECT ur.tenant_id::text FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'tenant' AND ur.tenant_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (t.id::text = (storage.foldername(name))[2] OR t.id::text = (storage.foldername(name))[1])
          AND (
            t.manager_id = auth.uid()
            OR t.manager_id IN (
              SELECT sp.manager_id FROM public.submanager_permissions sp
              WHERE sp.submanager_user_id = auth.uid()
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.property_landlords pl
        JOIN public.leases l ON l.property_id = pl.property_id
        WHERE pl.landlord_user_id = auth.uid()
          AND l.tenant_id::text = (storage.foldername(name))[2]
      )
    )
  );

DROP POLICY IF EXISTS "signed_contracts_scoped_insert" ON storage.objects;
CREATE POLICY "signed_contracts_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signed-contracts' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('manager', 'submanager', 'tenant')
      )
    )
  );

DROP POLICY IF EXISTS "signed_contracts_scoped_update" ON storage.objects;
CREATE POLICY "signed_contracts_scoped_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signed-contracts' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'signed-contracts');

DROP POLICY IF EXISTS "signed_contracts_scoped_delete" ON storage.objects;
CREATE POLICY "signed_contracts_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'signed-contracts' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'manager'
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 5. Contracts (Private — Manager Subscription & Lease Templates)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "contracts_scoped_select" ON storage.objects;
CREATE POLICY "contracts_scoped_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts' AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'manager-contracts' AND (
          (storage.foldername(name))[2] = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'webhost'
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.uploaded_contract_url LIKE '%' || name
          AND (
            c.tenant_id IN (
              SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'tenant'
            )
            OR EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = c.property_id
                AND (
                  p.manager_id = auth.uid()
                  OR p.manager_id IN (
                    SELECT manager_id FROM public.submanager_permissions WHERE submanager_user_id = auth.uid()
                  )
                )
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "contracts_scoped_insert" ON storage.objects;
CREATE POLICY "contracts_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('manager', 'submanager', 'webhost', 'tenant')
      )
    )
  );

DROP POLICY IF EXISTS "contracts_scoped_update" ON storage.objects;
CREATE POLICY "contracts_scoped_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'contracts');

DROP POLICY IF EXISTS "contracts_scoped_delete" ON storage.objects;
CREATE POLICY "contracts_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('manager', 'webhost')
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 6. Maintenance Photos (Private — Tickets, Inspections, Meters)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "maintenance_photos_scoped_select" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_photos_scoped_select" ON storage.objects;
CREATE POLICY "maintenance_photos_scoped_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'maintenance-photos' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('tenant', 'manager', 'submanager')
      )
      OR EXISTS (
        SELECT 1 FROM public.property_landlords pl
        WHERE pl.landlord_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "maintenance_photos_scoped_insert" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_photos_scoped_insert" ON storage.objects;
CREATE POLICY "maintenance_photos_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-photos' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('tenant', 'manager', 'submanager')
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 7. Property Images (Public Read, Manager/Submanager Write)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "property_images_scoped_write" ON storage.objects;
CREATE POLICY "property_images_scoped_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('manager', 'submanager', 'webhost')
      )
    )
  );

DROP POLICY IF EXISTS "property_images_scoped_delete" ON storage.objects;
CREATE POLICY "property_images_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'manager'
      )
    )
  );

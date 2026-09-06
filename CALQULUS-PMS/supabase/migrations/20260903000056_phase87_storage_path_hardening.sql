-- Phase 87: storage namespace and relationship hardening
-- Private buckets remain private; writes are restricted to relationship-scoped paths.

-- Remove historical broad write/read policies so final state is defined only by the scoped rules below.
DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_read" ON storage.objects;


-- Property images: manager namespace for property forms, unit namespace for unit media.
DROP POLICY IF EXISTS "property_images_scoped_write" ON storage.objects;
CREATE POLICY "property_images_scoped_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images' AND (
      (
        (storage.foldername(name))[1] = 'managers'
        AND (storage.foldername(name))[2] = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='manager')
      )
      OR (
        (storage.foldername(name))[1] = 'units'
        AND EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON p.id=u.property_id
          WHERE u.id::text=(storage.foldername(name))[2]
            AND (p.manager_id=auth.uid() OR p.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
        )
      )
      OR (
        (storage.foldername(name))[1] = 'properties'
        AND EXISTS (
          SELECT 1 FROM public.properties p
          WHERE p.id::text=(storage.foldername(name))[2]
            AND (p.manager_id=auth.uid() OR p.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='webhost')
        AND (storage.foldername(name))[1] IN ('properties','managers')
      )
    )
  );

DROP POLICY IF EXISTS "property_images_scoped_delete" ON storage.objects;
CREATE POLICY "property_images_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images' AND (
      owner = auth.uid()
      OR (
        (storage.foldername(name))[1] = 'managers' AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR EXISTS (
        SELECT 1 FROM public.units u JOIN public.properties p ON p.id=u.property_id
        WHERE (storage.foldername(name))[1]='units' AND u.id::text=(storage.foldername(name))[2]
          AND (p.manager_id=auth.uid() OR p.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
      )
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='webhost')
    )
  );

-- Contracts: manager contract/signature namespaces only. Do not allow arbitrary role-wide uploads.
DROP POLICY IF EXISTS "contracts_scoped_insert" ON storage.objects;
CREATE POLICY "contracts_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts' AND (
      owner = auth.uid()
      OR (
        (storage.foldername(name))[1]='manager-contracts'
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='webhost')
        AND (storage.foldername(name))[2] IS NOT NULL
      )
      OR (
        (storage.foldername(name))[1]='signatures'
        AND (storage.foldername(name))[2]=auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('manager','submanager'))
      )
    )
  );

DROP POLICY IF EXISTS "contracts_scoped_delete" ON storage.objects;
CREATE POLICY "contracts_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id='contracts' AND (
      owner=auth.uid()
      OR (
        (storage.foldername(name))[1]='manager-contracts'
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='webhost')
      )
    )
  );

-- Signed contracts: lease documents must be namespaced by tenant id and tied to the tenant's manager.
DROP POLICY IF EXISTS "signed_contracts_scoped_insert" ON storage.objects;
CREATE POLICY "signed_contracts_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id='signed-contracts' AND (
      owner=auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id=auth.uid() AND ur.role='tenant'
          AND ur.tenant_id IS NOT NULL
          AND (storage.foldername(name))[1]='leases'
          AND (storage.foldername(name))[2]=ur.tenant_id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (storage.foldername(name))[1]='leases'
          AND t.id::text=(storage.foldername(name))[2]
          AND (t.manager_id=auth.uid() OR t.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "signed_contracts_scoped_delete" ON storage.objects;
CREATE POLICY "signed_contracts_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id='signed-contracts' AND (
      owner=auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE (storage.foldername(name))[1]='leases'
          AND t.id::text=(storage.foldername(name))[2]
          AND (t.manager_id=auth.uid() OR t.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
      )
    )
  );

-- Profile photos: only the authenticated user may write their own namespace.
DROP POLICY IF EXISTS "profile_photos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_scoped_insert" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_scoped_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_scoped_delete" ON storage.objects;
CREATE POLICY "profile_photos_scoped_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "profile_photos_scoped_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text)
WITH CHECK (bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "profile_photos_scoped_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);

-- Company logos: manager-owned namespace only.
DROP POLICY IF EXISTS "company_logos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_scoped_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_scoped_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_scoped_delete" ON storage.objects;
CREATE POLICY "company_logos_scoped_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='company-logos' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('manager','agency')));
CREATE POLICY "company_logos_scoped_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='company-logos' AND (storage.foldername(name))[1]=auth.uid()::text)
WITH CHECK (bucket_id='company-logos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "company_logos_scoped_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='company-logos' AND (storage.foldername(name))[1]=auth.uid()::text);

-- Make the three previously public buckets definitively private in the final migration state.
UPDATE storage.buckets SET public=false WHERE id IN ('profile-photos','company-logos','property-images');

CREATE POLICY "profile_photos_scoped_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='profile-photos');
CREATE POLICY "company_logos_scoped_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='company-logos');
CREATE POLICY "property_images_scoped_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='property-images');

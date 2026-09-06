-- Phase 85: storage path/role boundary hardening for maintenance media.
-- Tenant uploads use an auth-owned path; manager uploads are limited to units in their portfolio.

DROP POLICY IF EXISTS "maintenance_photos_scoped_insert" ON storage.objects;
CREATE POLICY "maintenance_photos_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-photos' AND (
      owner = auth.uid()
      OR (
        (storage.foldername(name))[1] IN ('maintenance','orphan-receipts','condition-photos')
        AND (storage.foldername(name))[2] = auth.uid()::text
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='tenant')
      )
      OR (
        (storage.foldername(name))[1] = 'inspections'
        AND EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON p.id=u.property_id
          WHERE u.id::text=(storage.foldername(name))[2]
            AND (p.manager_id=auth.uid() OR p.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
        )
      )
      OR (
        (storage.foldername(name))[1] = 'water-meters'
        AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.unit_id::text=(storage.foldername(name))[2]
            AND t.status='active'
            AND (t.manager_id=auth.uid() OR t.manager_id IN (SELECT sp.manager_id FROM public.submanager_permissions sp WHERE sp.submanager_user_id=auth.uid()))
        )
      )
    )
  );

-- Prevent authenticated users from overwriting/deleting media they do not own.
DROP POLICY IF EXISTS "maintenance_photos_owner_update" ON storage.objects;
CREATE POLICY "maintenance_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='maintenance-photos' AND owner=auth.uid())
  WITH CHECK (bucket_id='maintenance-photos' AND owner=auth.uid());

DROP POLICY IF EXISTS "maintenance_photos_owner_delete" ON storage.objects;
CREATE POLICY "maintenance_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='maintenance-photos' AND owner=auth.uid());

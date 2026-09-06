-- Phase 3 leftovers:
-- 1. Tenant visibility uses caller_tenant_ids() (auth.uid → user_roles), not email match.
-- 2. profile-photos / company-logos / property-images are private; SELECT is authenticated-only.
-- Invitation claim still binds to the JWT email claim (invitee identity), not tenants.email.

CREATE OR REPLACE FUNCTION public.caller_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = 'tenant'
    AND tenant_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.caller_tenant_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caller_tenant_ids() TO authenticated;

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select"
  ON public.tenants FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      auth.jwt() ->> 'role' = 'service_role' OR
      (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'manager'
        ) AND
        EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON u.property_id = p.id
          WHERE u.id = tenants.unit_id AND p.manager_id = auth.uid()
        )
      ) OR
      (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'agency'
        ) AND
        EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON u.property_id = p.id
          WHERE u.id = tenants.unit_id AND p.manager_id = auth.uid()
        )
      ) OR
      id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Deposit deductions view policy" ON public.deposit_deductions;
CREATE POLICY "Deposit deductions view policy" ON public.deposit_deductions
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Deposit refunds view policy" ON public.deposit_refunds;
CREATE POLICY "Deposit refunds view policy" ON public.deposit_refunds
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Tenant history view policy" ON public.tenant_history;
CREATE POLICY "Tenant history view policy" ON public.tenant_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Vacation notices view policy" ON public.vacation_notices;
CREATE POLICY "Vacation notices view policy" ON public.vacation_notices
  FOR SELECT USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Users manage vacation notices" ON public.vacation_notices;
CREATE POLICY "Users manage vacation notices" ON public.vacation_notices
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Water meter readings view policy" ON public.water_meter_readings;
CREATE POLICY "Water meter readings view policy" ON public.water_meter_readings
  FOR SELECT USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR unit_id IN (
      SELECT unit_id FROM public.tenants WHERE id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Tenant unit links access policy" ON public.tenant_unit_links;
CREATE POLICY "Tenant unit links access policy" ON public.tenant_unit_links
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Tenant guarantors access policy" ON public.tenant_guarantors;
CREATE POLICY "Tenant guarantors access policy" ON public.tenant_guarantors
  FOR ALL USING (
    manager_id = auth.uid()
    OR tenant_id IN (SELECT id FROM public.tenants WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Unit utility meters access policy" ON public.unit_utility_meters;
CREATE POLICY "Unit utility meters access policy" ON public.unit_utility_meters
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "tenant_invitations_invitee_claim" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_invitee_claim"
  ON public.tenant_invitations FOR UPDATE
  USING (
    status = 'pending'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

UPDATE storage.buckets
SET public = false
WHERE id IN ('profile-photos', 'company-logos', 'property-images');

DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;

DROP POLICY IF EXISTS "profile_photos_authenticated_read" ON storage.objects;
CREATE POLICY "profile_photos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "company_logos_authenticated_read" ON storage.objects;
CREATE POLICY "company_logos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "property_images_authenticated_read" ON storage.objects;
CREATE POLICY "property_images_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-images' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('manager', 'submanager', 'agency', 'landlord', 'webhost', 'tenant')
      )
    )
  );

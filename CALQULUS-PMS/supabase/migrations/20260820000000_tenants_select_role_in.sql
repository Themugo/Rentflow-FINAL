-- Rewrite tenants SELECT so it does not sub-query user_roles under RLS.
-- Live 42P17 on GET /rest/v1/tenants was caused when tenants policies
-- and user_roles policies re-entered each other. role_in() is SECURITY
-- DEFINER and does not re-apply RLS on user_roles.

GRANT EXECUTE ON FUNCTION public.role_in(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.caller_tenant_ids() TO authenticated;

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select"
  ON public.tenants FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      auth.jwt() ->> 'role' = 'service_role' OR
      (
        public.role_in('manager') AND
        EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON u.property_id = p.id
          WHERE u.id = tenants.unit_id AND p.manager_id = auth.uid()
        )
      ) OR
      (
        public.role_in('agency') AND
        EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON u.property_id = p.id
          WHERE u.id = tenants.unit_id AND p.manager_id = auth.uid()
        )
      ) OR
      id IN (SELECT public.caller_tenant_ids())
    )
  );

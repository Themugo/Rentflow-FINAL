-- 1. Remove webhost SELECT on sensitive M-Pesa credentials
DROP POLICY IF EXISTS "Webhost can view all mpesa settings" ON public.manager_mpesa_settings;

-- 2. Allow tenants to view their own unit
DROP POLICY IF EXISTS "Tenants can view their own unit" ON public.units;
CREATE POLICY "Tenants can view their own unit"
ON public.units
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'tenant'
      AND (t.unit_id = units.id OR (t.property_id = units.property_id AND t.unit = units.unit_number))
  )
);

-- 3. Revoke anonymous read access on public schema (kills pg_graphql anon introspection of app tables)
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

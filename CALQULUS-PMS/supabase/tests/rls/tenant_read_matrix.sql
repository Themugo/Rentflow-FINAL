-- RLS smoke test (run against local replay DB):
--   docker cp supabase/tests/rls/tenant_read_matrix.sql calqulus-pg:/tmp/ && \
--   docker exec -e PGPASSWORD=postgres calqulus-pg psql -U supabase_admin -d postgres -f /tmp/tenant_read_matrix.sql
-- Requires: bash supabase/tests/harness/replay-migrations.sh completed first.

BEGIN;
INSERT INTO auth.users (id, email) VALUES ('caca1111-3333-3333-3333-333333333333','tenantA@test.dev');
INSERT INTO public.user_roles (user_id, role, tenant_id, approval_status) VALUES
  ('caca1111-3333-3333-3333-333333333333','tenant',NULL,'approved');
SET ROLE authenticated;
SET request.jwt.claim.sub = 'caca1111-3333-3333-3333-333333333333';
SELECT 'A: user_roles self-read' AS step, count(*) FROM public.user_roles;
SELECT 'B: user_roles tenant_id' AS step, tenant_id FROM public.user_roles WHERE user_id = auth.uid();
SELECT 'C: tenants read' AS step, count(*) FROM public.tenants;
SELECT 'D: invoices read' AS step, count(*) FROM public.invoices;
RESET ROLE;
ROLLBACK;

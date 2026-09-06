-- RLS smoke test (run against local replay DB):
--   docker cp supabase/tests/rls/tenant_isolation.sql calqulus-pg:/tmp/ && \
--   docker exec -e PGPASSWORD=postgres calqulus-pg psql -U supabase_admin -d postgres -f /tmp/tenant_isolation.sql
-- Requires: bash supabase/tests/harness/replay-migrations.sh completed first.

BEGIN;
-- two managers, one property each, one unit each, one tenant each, one invoice each
INSERT INTO auth.users (id, email) VALUES
  ('a1a1a1a1-1111-1111-1111-111111111111','mgrA@test.dev'),
  ('b2b2b2b2-2222-2222-2222-222222222222','mgrB@test.dev'),
  ('caca1111-3333-3333-3333-333333333333','tenantA@test.dev'),
  ('caca2222-4444-4444-4444-444444444444','tenantB@test.dev');
INSERT INTO public.properties (id, manager_id, name, address) VALUES
  ('c1c1c1c1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','PropA','1 A Way'),
  ('c2c2c2c2-2222-2222-2222-222222222222','b2b2b2b2-2222-2222-2222-222222222222','PropB','2 B Way');
INSERT INTO public.units (id, property_id, unit_number, status) VALUES
  ('d1d1d1d1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','A1','occupied'),
  ('d2d2d2d2-2222-2222-2222-222222222222','c2c2c2c2-2222-2222-2222-222222222222','B1','occupied');
INSERT INTO public.tenants (id, manager_id, property_id, name, email, status) VALUES
  ('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','Tenant A','tenantA@test.dev','active'),
  ('e2e2e2e2-2222-2222-2222-222222222222','b2b2b2b2-2222-2222-2222-222222222222','c2c2c2c2-2222-2222-2222-222222222222','Tenant B','tenantB@test.dev','active');
INSERT INTO public.user_roles (user_id, role, tenant_id, approval_status) VALUES
  ('caca1111-3333-3333-3333-333333333333','tenant','e1e1e1e1-1111-1111-1111-111111111111','approved'),
  ('caca2222-4444-4444-4444-444444444444','tenant','e2e2e2e2-2222-2222-2222-222222222222','approved');
INSERT INTO public.invoices (id, manager_id, tenant_id, unit_id, invoice_number, amount, due_date, status) VALUES
  ('f1f1f1f1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','e1e1e1e1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','INV-A-001',1000,'2026-09-01','pending'),
  ('f2f2f2f2-2222-2222-2222-222222222222','b2b2b2b2-2222-2222-2222-222222222222','e2e2e2e2-2222-2222-2222-222222222222','d2d2d2d2-2222-2222-2222-222222222222','INV-B-001',2000,'2026-09-01','pending');

SET ROLE authenticated;
SET request.jwt.claim.sub = 'caca1111-3333-3333-3333-333333333333';
SELECT 'tenantA invoices:' AS check, invoice_number, amount FROM public.invoices;
SELECT 'tenantA tenants visible:' AS check, name FROM public.tenants;
RESET ROLE;
ROLLBACK;

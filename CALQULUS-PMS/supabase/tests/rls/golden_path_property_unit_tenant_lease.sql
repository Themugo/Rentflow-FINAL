-- Phase 5: Golden path — Property → Unit → Tenant → Lease behavioral test
-- Run against local replay DB:
--   docker cp supabase/tests/rls/golden_path_property_unit_tenant_lease.sql calqulus-pg:/tmp/ && \
--   docker exec -e PGPASSWORD=postgres calqulus-pg psql -U supabase_admin -d postgres -f /tmp/golden_path_property_unit_tenant_lease.sql
-- Requires: bash supabase/tests/harness/replay-migrations.sh completed first.
--
-- Walks the full onboarding chain as the service role (what create-tenant-account
-- does) and asserts occupancy auto-sync + referential integrity at each hop.

BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

-- ── G1: manager creates a property ─────────────────────────────────
INSERT INTO auth.users (id, email) VALUES ('a1a1a1a1-1111-1111-1111-111111111111','mgrA@test.dev');
INSERT INTO public.properties (id, manager_id, name, address, units) VALUES
  ('c1c1c1c1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','Golden Villas','12 Gold St', 3);
SELECT 'G1 property created' AS check,
  (name='Golden Villas' AND units=3 AND occupied=0 AND status='active') AS pass
  FROM public.properties WHERE id='c1c1c1c1-1111-1111-1111-111111111111';

-- ── G2: manager adds a unit (starts vacant) ────────────────────────
INSERT INTO public.units (id, property_id, unit_number, status, monthly_rent) VALUES
  ('d1d1d1d1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','A1','vacant',15000);
SELECT 'G2 unit vacant' AS check, (status='vacant') AS pass
  FROM public.units WHERE id='d1d1d1d1-1111-1111-1111-111111111111';
SELECT 'G2 property still 0 occupied' AS check, (occupied=0) AS pass
  FROM public.properties WHERE id='c1c1c1c1-1111-1111-1111-111111111111';

-- ── G3: tenant assigned to unit → unit auto-occupied → property count syncs ──
INSERT INTO public.tenants (id, manager_id, property_id, unit_id, property, unit, name, email, status, monthly_rent) VALUES
  ('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','Golden Villas','A1','Tenant One','t1@test.dev','active',15000);
SELECT 'G3 unit auto-occupied' AS check, (status='occupied') AS pass
  FROM public.units WHERE id='d1d1d1d1-1111-1111-1111-111111111111';
SELECT 'G3 property occupied=1 (trigger)' AS check, (occupied=1) AS pass
  FROM public.properties WHERE id='c1c1c1c1-1111-1111-1111-111111111111';

-- ── G4: lease links tenant + unit + property ───────────────────────
INSERT INTO public.leases (id, tenant_id, unit_id, property_id, manager_id, property, unit, monthly_rent, start_date, end_date, status) VALUES
  ('a7a7a7a7-7777-7777-7777-777777777777','e1e1e1e1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','Golden Villas','A1',15000,'2026-08-01','2027-07-31','active');
SELECT 'G4 lease references resolve' AS check, (
  (SELECT count(*) FROM public.leases l
     JOIN public.tenants t ON t.id=l.tenant_id
     JOIN public.units u ON u.id=l.unit_id
     JOIN public.properties p ON p.id=l.property_id
     WHERE l.id='a7a7a7a7-7777-7777-7777-777777777777') = 1
) AS pass;

-- ── G5: cross-entity consistency — lease.unit_id must belong to lease.property_id ──
SELECT 'G5 unit belongs to property' AS check, (
  EXISTS (SELECT 1 FROM public.units u JOIN public.leases l ON l.unit_id=u.id
          WHERE l.id='a7a7a7a7-7777-7777-7777-777777777777' AND u.property_id=l.property_id)
) AS pass;

-- ── G6: tenant moves out → unit freed → property count decrements ──
UPDATE public.tenants SET status='vacated' WHERE id='e1e1e1e1-1111-1111-1111-111111111111';
SELECT 'G6 unit freed on vacate' AS check, (status='vacant') AS pass
  FROM public.units WHERE id='d1d1d1d1-1111-1111-1111-111111111111';
SELECT 'G6 property occupied back to 0' AS check, (occupied=0) AS pass
  FROM public.properties WHERE id='c1c1c1c1-1111-1111-1111-111111111111';

-- ── G7: referential integrity — cannot delete unit with active tenant ──
INSERT INTO public.tenants (id, manager_id, property_id, unit_id, property, unit, name, email, status) VALUES
  ('e2e2e2e2-2222-2222-2222-222222222222','a1a1a1a1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','Golden Villas','A1','Tenant Two','t2@test.dev','active');
DO $$
BEGIN
  BEGIN
    DELETE FROM public.units WHERE id='d1d1d1d1-1111-1111-1111-111111111111';
    RAISE NOTICE 'G7 referential integrity | FAIL (delete succeeded)';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'G7 referential integrity | PASS (delete blocked by FK)';
  END;
END $$;


-- ── G8: financial ledger cannot be orphaned by tenant delete ──
INSERT INTO public.invoices (id, manager_id, tenant_id, unit_id, invoice_number, amount, paid_amount, balance_due, due_date, status) VALUES
  ('f8f8f8f8-8888-8888-8888-888888888888','a1a1a1a1-1111-1111-1111-111111111111','e2e2e2e2-2222-2222-2222-222222222222','d1d1d1d1-1111-1111-1111-111111111111','INV-G8',5000,0,5000,'2026-09-01','pending');
DO $$
BEGIN
  BEGIN
    DELETE FROM public.tenants WHERE id='e2e2e2e2-2222-2222-2222-222222222222';
    RAISE NOTICE 'G8 ledger orphan | FAIL (tenant with invoice deleted)';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'G8 ledger orphan | PASS (delete blocked, invoice preserved)';
  END;
END $$;

ROLLBACK;

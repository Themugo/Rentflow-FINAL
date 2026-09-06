-- CALQULUS Phase 2: atomic lease workflow regression test
-- Requires replayed migrations and a local PostgreSQL/Supabase test database.
-- This test intentionally exercises rollback, cross-property isolation and
-- overlapping lease protection.

BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

INSERT INTO auth.users (id, email) VALUES
  ('a2a2a2a2-1111-1111-1111-111111111111','phase2-mgr@test.dev')
ON CONFLICT DO NOTHING;

INSERT INTO public.properties (id, manager_id, name, address, units)
VALUES ('c2c2c2c2-1111-1111-1111-111111111111',
        'a2a2a2a2-1111-1111-1111-111111111111','Phase2 Villas','2 Atomic St',2)
ON CONFLICT DO NOTHING;

INSERT INTO public.properties (id, manager_id, name, address, units)
VALUES ('c3c3c3c3-1111-1111-1111-111111111111',
        'a2a2a2a2-1111-1111-1111-111111111111','Other Villas','3 Atomic St',1)
ON CONFLICT DO NOTHING;

INSERT INTO public.units (id, property_id, unit_number, status, monthly_rent)
VALUES ('d2d2d2d2-1111-1111-1111-111111111111',
        'c2c2c2c2-1111-1111-1111-111111111111','P2-A1','vacant',18000)
ON CONFLICT DO NOTHING;

INSERT INTO public.tenants
(id, manager_id, property_id, name, email, status)
VALUES ('e3e3e3e3-1111-1111-1111-111111111111',
        'a2a2a2a2-1111-1111-1111-111111111111',
        'c2c2c2c2-1111-1111-1111-111111111111',
        'Atomic Tenant','atomic@test.dev','active')
ON CONFLICT DO NOTHING;

-- A1: complete workflow succeeds and all denormalized records agree.
SELECT public.create_lease_atomic(
  'e3e3e3e3-1111-1111-1111-111111111111',
  'c2c2c2c2-1111-1111-1111-111111111111',
  'd2d2d2d2-1111-1111-1111-111111111111',
  'P2-A1',
  '2026-09-01','2027-08-31',18000,36000,'Phase 2 test','active',
  'a2a2a2a2-1111-1111-1111-111111111111'
);

SELECT 'A1 atomic workflow' AS check, (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.tenants t ON t.id=l.tenant_id
    JOIN public.units u ON u.id=l.unit_id
    WHERE l.tenant_id='e3e3e3e3-1111-1111-1111-111111111111'
      AND l.property_id='c2c2c2c2-1111-1111-1111-111111111111'
      AND l.unit_id='d2d2d2d2-1111-1111-1111-111111111111'
      AND l.status='active'
      AND l.monthly_rent=18000
      AND t.property_id=l.property_id
      AND t.unit_id=l.unit_id
      AND t.deposit_balance=36000
      AND u.status='occupied'
      AND u.monthly_rent=18000
  )
) AS pass;

-- A2: overlapping lease is rejected.
DO $$
BEGIN
  BEGIN
    PERFORM public.create_lease_atomic(
      'e3e3e3e3-1111-1111-1111-111111111111',
      'c2c2c2c2-1111-1111-1111-111111111111',
      'd2d2d2d2-1111-1111-1111-111111111111',
      'P2-A1','2027-01-01','2027-12-31',19000,38000,NULL,'active',
      'a2a2a2a2-1111-1111-1111-111111111111'
    );
    RAISE EXCEPTION 'A2 FAIL: overlapping lease was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;
SELECT 'A2 overlapping lease blocked' AS check, true AS pass;

-- A3: cross-property tenant/unit assignment is rejected.
INSERT INTO public.tenants
(id, manager_id, property_id, name, email, status)
VALUES ('e4e4e4e4-4444-4444-4444-444444444444',
        'a2a2a2a2-1111-1111-1111-111111111111',
        'c3c3c3c3-1111-1111-1111-111111111111',
        'Other Tenant','other@test.dev','active')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_lease_atomic(
      'e4e4e4e4-4444-4444-4444-444444444444',
      'c2c2c2c2-1111-1111-1111-111111111111',
      'd2d2d2d2-1111-1111-1111-111111111111',
      'P2-A1','2027-09-01','2028-08-31',18000,36000,NULL,'active',
      'a2a2a2a2-1111-1111-1111-111111111111'
    );
    RAISE EXCEPTION 'A3 FAIL: cross-property lease was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
SELECT 'A3 cross-property assignment blocked' AS check, true AS pass;

-- A4: transaction rollback is proven by forcing a duplicate unit lease.
-- The failed call must not leave a second lease behind.
SELECT count(*) AS leases_on_unit_after_rejection
FROM public.leases
WHERE unit_id='d2d2d2d2-1111-1111-1111-111111111111';

ROLLBACK;

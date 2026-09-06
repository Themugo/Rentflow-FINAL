-- ============================================================
-- Phase 5: Golden-path referential integrity — RESTRICT over SET NULL
--
-- Defect: the core onboarding-chain foreign keys were declared
-- ON DELETE SET NULL:
--   tenants.unit_id, tenants.property_id,
--   leases.unit_id, leases.property_id, leases.tenant_id
--
-- Deleting a unit (or property, or tenant) silently NULLed the link on
-- every dependent tenant/lease instead of erroring. Result: active tenants
-- with no home, and leases with no property/unit/tenant — orphaned financial
-- records with no trace. Verified in golden_path test G7: deleting a unit
-- with an active tenant SUCCEEDED and left the tenant unitless.
--
-- Fix: RESTRICT on the golden-path references. Deleting a unit/property/
-- tenant that still has dependents now raises a FK violation, forcing the
-- caller to resolve dependents first (vacate tenants, terminate leases) —
-- the correct behavior for an audit-sensitive property ledger.
--
-- seed-demo-data cleanup already deletes in dependency order
-- (leases → tenants → units), so it is unaffected.
-- ============================================================

-- tenants.unit_id → units
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_unit_id_fkey;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;

-- tenants.property_id → properties
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_property_id_fkey;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;

-- leases.tenant_id → tenants
ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_tenant_id_fkey;
ALTER TABLE public.leases ADD CONSTRAINT leases_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

-- leases.unit_id → units
ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_unit_id_fkey;
ALTER TABLE public.leases ADD CONSTRAINT leases_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;

-- leases.property_id → properties
ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_property_id_fkey;
ALTER TABLE public.leases ADD CONSTRAINT leases_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;

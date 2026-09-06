-- CALQULUS PMS — Utilities, Amenities & Contract Document Control
-- Complete end-to-end foundation: provenance, verification, charge catalogues and immutable contract versions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Utility integrations + external sync ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.utility_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id uuid,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  utility_type text NOT NULL CHECK (utility_type IN ('water','electricity','gas','internet','other')),
  provider text NOT NULL,
  connector_type text NOT NULL DEFAULT 'manual' CHECK (connector_type IN ('manual','tenant_photo','api','webhook','iot')),
  external_system_id text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','disabled')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS utility_integrations_property_idx ON public.utility_integrations(property_id, utility_type);
CREATE UNIQUE INDEX IF NOT EXISTS utility_integrations_external_uidx
  ON public.utility_integrations(manager_id, provider, external_system_id)
  WHERE external_system_id IS NOT NULL;
ALTER TABLE public.utility_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS utility_integrations_read ON public.utility_integrations;
CREATE POLICY utility_integrations_read ON public.utility_integrations FOR SELECT USING (
  manager_id = public.get_effective_manager_id()
  OR (agency_id IS NOT NULL AND public.can_manage_agency_admin(agency_id,'view_settings'))
);
REVOKE INSERT, UPDATE, DELETE ON public.utility_integrations FROM authenticated;

CREATE TABLE IF NOT EXISTS public.utility_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.utility_integrations(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_reading_id text,
  meter_id uuid REFERENCES public.unit_utility_meters(id) ON DELETE SET NULL,
  reading_date date,
  previous_reading numeric,
  current_reading numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_status text NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('pending','mapped','rejected','duplicate','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS utility_sync_events_integration_idx ON public.utility_sync_events(integration_id, created_at DESC);
ALTER TABLE public.utility_sync_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS utility_sync_events_read ON public.utility_sync_events;
CREATE POLICY utility_sync_events_read ON public.utility_sync_events FOR SELECT USING (
  manager_id = public.get_effective_manager_id()
);
REVOKE INSERT, UPDATE, DELETE ON public.utility_sync_events FROM authenticated;

-- Provenance fields on the existing canonical meter/reading tables.
ALTER TABLE public.unit_utility_meters
  ADD COLUMN IF NOT EXISTS meter_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_meter_id text,
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.utility_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reading_unit text NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.water_meter_readings
  ADD COLUMN IF NOT EXISTS reading_source text NOT NULL DEFAULT 'manager_manual',
  ADD COLUMN IF NOT EXISTS tenant_photo_path text,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS ocr_reading numeric,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  ADD COLUMN IF NOT EXISTS verification_reason text,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS water_meter_readings_verification_idx ON public.water_meter_readings(property_id, status, reading_date DESC);

-- -----------------------------------------------------------------------------
-- Amenity/service charge catalogue (separate from unit_amenities facts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.amenity_charge_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'amenity',
  calculation_method text NOT NULL DEFAULT 'fixed' CHECK (calculation_method IN ('fixed','per_unit','metered','percentage','manual')),
  rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  unit text,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('one_off','monthly','quarterly','annual','custom')),
  included_in_rent boolean NOT NULL DEFAULT false,
  auto_generate boolean NOT NULL DEFAULT false,
  invoice_mode text NOT NULL DEFAULT 'separate' CHECK (invoice_mode IN ('bundled','separate')),
  effective_from date,
  effective_until date,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS amenity_charge_catalog_code_uidx
  ON public.amenity_charge_catalog(manager_id, property_id, COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid), code);
CREATE INDEX IF NOT EXISTS amenity_charge_catalog_property_idx ON public.amenity_charge_catalog(property_id, is_active, display_order);
ALTER TABLE public.amenity_charge_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS amenity_charge_catalog_read ON public.amenity_charge_catalog;
CREATE POLICY amenity_charge_catalog_read ON public.amenity_charge_catalog FOR SELECT USING (
  manager_id = public.get_effective_manager_id()
  OR unit_id IN (SELECT t.unit_id FROM public.tenants t WHERE t.id::text = auth.uid()::text AND t.status = 'active')
);
REVOKE INSERT, UPDATE, DELETE ON public.amenity_charge_catalog FROM authenticated;

CREATE OR REPLACE FUNCTION public.save_amenity_charge_catalog_atomic(
  p_catalog_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_code text,
  p_name text,
  p_category text,
  p_calculation_method text,
  p_rate numeric,
  p_unit text,
  p_billing_cycle text,
  p_included_in_rent boolean,
  p_auto_generate boolean,
  p_invoice_mode text,
  p_effective_from date,
  p_effective_until date,
  p_is_active boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_id uuid;
BEGIN
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Manager context required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_manager) THEN
    RAISE EXCEPTION 'Property access denied' USING ERRCODE='42501';
  END IF;
  IF p_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id=p_unit_id AND u.property_id=p_property_id) THEN
    RAISE EXCEPTION 'Unit does not belong to property';
  END IF;
  IF p_catalog_id IS NULL THEN
    INSERT INTO public.amenity_charge_catalog(manager_id,property_id,unit_id,code,name,category,calculation_method,rate,unit,billing_cycle,included_in_rent,auto_generate,invoice_mode,effective_from,effective_until,is_active)
    VALUES(v_manager,p_property_id,p_unit_id,trim(p_code),trim(p_name),p_category,p_calculation_method,p_rate,p_unit,p_billing_cycle,p_included_in_rent,p_auto_generate,p_invoice_mode,p_effective_from,p_effective_until,p_is_active)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.amenity_charge_catalog SET unit_id=p_unit_id,code=trim(p_code),name=trim(p_name),category=p_category,calculation_method=p_calculation_method,rate=p_rate,unit=p_unit,billing_cycle=p_billing_cycle,included_in_rent=p_included_in_rent,auto_generate=p_auto_generate,invoice_mode=p_invoice_mode,effective_from=p_effective_from,effective_until=p_effective_until,is_active=p_is_active,updated_at=now()
    WHERE id=p_catalog_id AND manager_id=v_manager AND property_id=p_property_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Charge catalogue record not found or access denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_amenity_charge_catalog_atomic(uuid,uuid,uuid,text,text,text,text,numeric,text,text,boolean,boolean,text,date,date,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_amenity_charge_catalog_atomic(uuid,uuid,uuid,text,text,text,text,numeric,text,text,boolean,boolean,text,date,date,boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- Water reading verification: approve, reject or adjust without creating a second source of truth.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_water_meter_reading_atomic(
  p_reading_id uuid,
  p_action text,
  p_current_reading numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS public.water_meter_readings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_row public.water_meter_readings;
BEGIN
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Manager context required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.water_meter_readings WHERE id=p_reading_id FOR UPDATE;
  IF NOT FOUND OR v_row.manager_id <> v_manager THEN RAISE EXCEPTION 'Reading not found or access denied' USING ERRCODE='42501'; END IF;
  IF p_action NOT IN ('approve','reject','adjust') THEN RAISE EXCEPTION 'Unsupported verification action'; END IF;
  IF p_action IN ('reject','adjust') AND nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_action='adjust' THEN
    IF p_current_reading IS NULL OR p_current_reading < v_row.previous_reading THEN RAISE EXCEPTION 'Adjusted reading must be at least the previous reading'; END IF;
    v_row.current_reading := p_current_reading;
    v_row.consumption := p_current_reading - v_row.previous_reading;
    v_row.total_amount := v_row.consumption * v_row.rate_per_unit;
  END IF;
  v_row.status := CASE WHEN p_action='reject' THEN 'rejected' ELSE 'verified' END;
  v_row.verification_reason := nullif(trim(p_reason),'');
  v_row.verified_by := auth.uid();
  v_row.verified_at := now();
  UPDATE public.water_meter_readings SET current_reading=v_row.current_reading, consumption=v_row.consumption,total_amount=v_row.total_amount,status=v_row.status,verification_reason=v_row.verification_reason,verified_by=v_row.verified_by,verified_at=v_row.verified_at,updated_at=now() WHERE id=p_reading_id RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.verify_water_meter_reading_atomic(uuid,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_water_meter_reading_atomic(uuid,text,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.build_water_invoice_line_item(p_reading_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('source','water_meter_reading','source_id',w.id,'description','Water consumption','quantity',COALESCE(w.consumption,0),'unit','m³','rate',w.rate_per_unit,'amount',COALESCE(w.total_amount,0),'reading_date',w.reading_date,'status',w.status)
  FROM public.water_meter_readings w
  WHERE w.id=p_reading_id AND (w.manager_id=public.get_effective_manager_id() OR w.tenant_id::text=auth.uid()::text);
$$;
REVOKE ALL ON FUNCTION public.build_water_invoice_line_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_water_invoice_line_item(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Contract document versions + amendments. Signed contracts become immutable; changes use amendments.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text NOT NULL,
  document_url text,
  content_hash text NOT NULL,
  source_type text NOT NULL DEFAULT 'system' CHECK (source_type IN ('system','uploaded','amendment')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, version_number),
  UNIQUE(contract_id, content_hash)
);
CREATE INDEX IF NOT EXISTS contract_document_versions_contract_idx ON public.contract_document_versions(contract_id, version_number DESC);

CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  base_version_number integer NOT NULL,
  proposed_version_number integer NOT NULL,
  proposed_content text NOT NULL,
  reason text NOT NULL,
  proposed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tenant_signature text,
  tenant_signed_at timestamptz,
  manager_signature text,
  manager_signed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','effective')),
  effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_amendments_contract_idx ON public.contract_amendments(contract_id, created_at DESC);
ALTER TABLE public.contract_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_document_versions_read ON public.contract_document_versions;
CREATE POLICY contract_document_versions_read ON public.contract_document_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id AND (c.manager_id=public.get_effective_manager_id() OR c.tenant_id::text=auth.uid()::text))
);
DROP POLICY IF EXISTS contract_amendments_read ON public.contract_amendments;
CREATE POLICY contract_amendments_read ON public.contract_amendments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id AND (c.manager_id=public.get_effective_manager_id() OR c.tenant_id::text=auth.uid()::text))
);
REVOKE INSERT, UPDATE, DELETE ON public.contract_document_versions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.contract_amendments FROM authenticated;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_hash text,
  ADD COLUMN IF NOT EXISTS executed_version_number integer,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'system';

CREATE OR REPLACE FUNCTION public.guard_executed_contract_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='signed' THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.tenant_signature IS DISTINCT FROM OLD.tenant_signature
       OR NEW.manager_signature IS DISTINCT FROM OLD.manager_signature
       OR NEW.uploaded_contract_url IS DISTINCT FROM OLD.uploaded_contract_url
       OR NEW.lease_id IS DISTINCT FROM OLD.lease_id
       OR NEW.property_id IS DISTINCT FROM OLD.property_id
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Signed contract is immutable; create an amendment instead' USING ERRCODE='55000';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_executed_contract_update ON public.contracts;
CREATE TRIGGER trg_guard_executed_contract_update BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.guard_executed_contract_update();

CREATE OR REPLACE FUNCTION public.lock_signed_contract_atomic(p_contract_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id(); v_contract public.contracts; v_hash text; v_version integer;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND OR v_contract.manager_id<>v_manager THEN RAISE EXCEPTION 'Contract not found or access denied' USING ERRCODE='42501'; END IF;
  IF v_contract.status<>'signed' THEN RAISE EXCEPTION 'Only signed contracts can be locked'; END IF;
  v_hash:=encode(digest(v_contract.content,'sha256'),'hex');
  SELECT COALESCE(MAX(version_number),0)+1 INTO v_version FROM public.contract_document_versions WHERE contract_id=p_contract_id;
  INSERT INTO public.contract_document_versions(contract_id,version_number,content,document_url,content_hash,source_type,created_by)
  VALUES(p_contract_id,v_version,v_contract.content,v_contract.uploaded_contract_url,v_hash,COALESCE(v_contract.source_type,'system'),auth.uid())
  ON CONFLICT(contract_id,content_hash) DO UPDATE SET document_url=EXCLUDED.document_url
  RETURNING version_number INTO v_version;
  UPDATE public.contracts SET executed_at=COALESCE(executed_at,now()),executed_hash=v_hash,executed_version_number=v_version WHERE id=p_contract_id;
  RETURN p_contract_id;
END; $$;
REVOKE ALL ON FUNCTION public.lock_signed_contract_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_signed_contract_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_contract_amendment_atomic(p_contract_id uuid,p_reason text,p_proposed_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id(); v_contract public.contracts; v_base integer; v_id uuid;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND OR (v_contract.manager_id<>v_manager AND v_contract.tenant_id::text<>auth.uid()::text) THEN RAISE EXCEPTION 'Contract access denied' USING ERRCODE='42501'; END IF;
  IF v_contract.status NOT IN ('signed','active') THEN RAISE EXCEPTION 'Only executed contracts can be amended'; END IF;
  IF nullif(trim(p_reason),'') IS NULL OR nullif(trim(p_proposed_content),'') IS NULL THEN RAISE EXCEPTION 'Reason and proposed content are required'; END IF;
  SELECT COALESCE(MAX(version_number),1) INTO v_base FROM public.contract_document_versions WHERE contract_id=p_contract_id;
  INSERT INTO public.contract_amendments(contract_id,base_version_number,proposed_version_number,proposed_content,reason,proposed_by)
  VALUES(p_contract_id,v_base,v_base+1,p_proposed_content,trim(p_reason),auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_contract_amendment_atomic(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_contract_amendment_atomic(uuid,text,text) TO authenticated;

COMMENT ON TABLE public.utility_integrations IS 'Canonical external utility integration registry; no parallel meter source is introduced.';
COMMENT ON TABLE public.utility_sync_events IS 'Idempotent audit ledger for external utility readings.';
COMMENT ON TABLE public.amenity_charge_catalog IS 'Chargeable amenity/service definitions; unit_amenities remains the occupancy/fact record.';
COMMENT ON TABLE public.contract_document_versions IS 'Immutable contract document versions and hashes.';
COMMENT ON TABLE public.contract_amendments IS 'Two-party amendment proposals for immutable executed contracts.';

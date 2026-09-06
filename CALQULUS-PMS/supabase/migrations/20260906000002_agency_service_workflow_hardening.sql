-- CALQULUS PMS — Agency service workflow hardening
--
-- Extends the three-model agency service matrix into the workflows agencies
-- actually perform every day. The rule is simple:
--   FULL MANAGEMENT                        -> operate + collect + enforce
--   MANAGE / OWNER COLLECTS               -> operate + enforce (owner collects)
--   COLLECTIONS / ENFORCEMENT ONLY       -> collect + enforce (owner operates)
--
-- The agency relationship survives service-model changes; only authority
-- changes. This migration adds database-boundary guards around payment capture,
-- recovery, inspections, unit setup and compliance work so an agent can work
-- directly from the system without accidentally performing an out-of-scope
-- operation.

-- ---------------------------------------------------------------------------
-- 1. Guard payment allocation/capture for collection authority.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_agency_collection_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_role text;
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY CASE WHEN ur.role = 'agency' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_role <> 'agency' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'payment_transactions' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    IF v_property_id IS NULL AND COALESCE(NEW.invoice_id, OLD.invoice_id) IS NOT NULL THEN
      SELECT property_id INTO v_property_id
      FROM public.invoices
      WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    END IF;
    IF v_property_id IS NULL AND COALESCE(NEW.tenant_id, OLD.tenant_id) IS NOT NULL THEN
      SELECT property_id INTO v_property_id
      FROM public.tenants
      WHERE id = COALESCE(NEW.tenant_id, OLD.tenant_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'payment_allocations' THEN
    SELECT property_id INTO v_property_id
    FROM public.invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  ELSE
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF v_property_id IS NOT NULL
     AND NOT public.agency_service_capability(v_property_id, 'collect') THEN
    RAISE EXCEPTION 'This Agency service mandate does not permit rent collection for this property' USING ERRCODE='42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS agency_service_guard_payment_transactions ON public.payment_transactions;
CREATE TRIGGER agency_service_guard_payment_transactions
BEFORE INSERT OR UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_collection_write();

DROP TRIGGER IF EXISTS agency_service_guard_payment_allocations ON public.payment_allocations;
CREATE TRIGGER agency_service_guard_payment_allocations
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_collection_write();

-- ---------------------------------------------------------------------------
-- 2. Enforce enforcement authority inside recovery workflows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_agency_recovery_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_role text;
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY CASE WHEN ur.role = 'agency' THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_role <> 'agency' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'collection_recovery_cases' THEN
    SELECT property_id INTO v_property_id FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  ELSE
    SELECT i.property_id INTO v_property_id
    FROM public.collection_recovery_cases c
    JOIN public.invoices i ON i.id = c.invoice_id
    WHERE c.id = COALESCE(NEW.recovery_case_id, OLD.recovery_case_id);
  END IF;

  IF v_property_id IS NOT NULL
     AND NOT public.agency_service_capability(v_property_id, 'enforce') THEN
    RAISE EXCEPTION 'This Agency service mandate does not permit payment enforcement for this property' USING ERRCODE='42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS agency_service_guard_recovery_cases ON public.collection_recovery_cases;
CREATE TRIGGER agency_service_guard_recovery_cases
BEFORE INSERT OR UPDATE OR DELETE ON public.collection_recovery_cases
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_recovery_write();

DROP TRIGGER IF EXISTS agency_service_guard_recovery_communications ON public.collection_recovery_communications;
CREATE TRIGGER agency_service_guard_recovery_communications
BEFORE INSERT OR UPDATE OR DELETE ON public.collection_recovery_communications
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_recovery_write();

-- ---------------------------------------------------------------------------
-- 3. Guard the property-operations surfaces that matter in a managed agency
--    book: inspections, compliance, safety, risks and unit setup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_agency_property_operations_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_property_id uuid;
BEGIN
  IF auth.role() = 'service_role' OR v_uid IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY CASE WHEN ur.role = 'agency' THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_role <> 'agency' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME IN ('unit_inspections','unit_amenities','unit_utility_meters','unit_photos') THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    IF v_property_id IS NULL AND COALESCE(NEW.unit_id, OLD.unit_id) IS NOT NULL THEN
      SELECT property_id INTO v_property_id FROM public.units WHERE id = COALESCE(NEW.unit_id, OLD.unit_id);
    END IF;
  ELSIF TG_TABLE_NAME IN (
    'property_inspection_programs',
    'property_inspection_runs',
    'property_compliance_requirements',
    'property_safety_certificates',
    'property_risk_register',
    'vendor_contracts'
  ) THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
  ELSIF TG_TABLE_NAME = 'property_inspection_findings' THEN
    SELECT r.property_id INTO v_property_id
    FROM public.property_inspection_runs r
    WHERE r.id = COALESCE(NEW.inspection_run_id, OLD.inspection_run_id);
  ELSIF TG_TABLE_NAME = 'vendor_performance_reviews' THEN
    SELECT vc.property_id INTO v_property_id
    FROM public.vendor_contracts vc
    WHERE vc.id = COALESCE(NEW.contract_id, OLD.contract_id);
  ELSE
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF v_property_id IS NOT NULL
     AND NOT public.agency_service_capability(v_property_id, 'maintenance_write') THEN
    RAISE EXCEPTION 'This Agency service mandate does not permit property operations for this property' USING ERRCODE='42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'unit_inspections',
    'unit_amenities',
    'unit_utility_meters',
    'unit_photos',
    'property_inspection_programs',
    'property_inspection_runs',
    'property_inspection_findings',
    'property_compliance_requirements',
    'property_safety_certificates',
    'property_risk_register',
    'vendor_contracts',
    'vendor_performance_reviews'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS agency_service_guard_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER agency_service_guard_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_agency_property_operations_write()', t, t);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Property-level billing and utility configuration is an operating action,
--    not a read-only finance view. Collection-only agencies cannot change it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_agency_billing_config_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text; v_property_id uuid;
BEGIN
  IF auth.role()='service_role' OR auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  SELECT ur.role::text INTO v_role FROM public.user_roles ur WHERE ur.user_id=auth.uid() ORDER BY CASE WHEN ur.role='agency' THEN 0 ELSE 1 END LIMIT 1;
  IF v_role <> 'agency' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_property_id := COALESCE(NEW.property_id, OLD.property_id);
  IF v_property_id IS NOT NULL AND NOT public.agency_service_capability(v_property_id,'property_write') THEN
    RAISE EXCEPTION 'This Agency service mandate does not permit billing-policy changes for this property' USING ERRCODE='42501';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS agency_service_guard_property_billing_config ON public.property_billing_config;
CREATE TRIGGER agency_service_guard_property_billing_config
BEFORE INSERT OR UPDATE OR DELETE ON public.property_billing_config
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_billing_config_write();

-- ---------------------------------------------------------------------------
-- 5. Independent / shared-owner service visibility helpers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_property_service_summary(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_links jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='agency'
  ) THEN
    RAISE EXCEPTION 'Agency authorization required' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.property_landlords pl
    WHERE pl.property_id=p_property_id AND pl.manager_id=v_uid
  ) THEN
    RAISE EXCEPTION 'Property is outside this Agency portfolio' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'link_id', pl.id,
    'landlord_user_id', pl.landlord_user_id,
    'service_model', COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)),
    'fee_model', pl.agency_fee_model,
    'fee_value', pl.agency_fee_value,
    'payment_arrangements_enabled', COALESCE(pl.agency_payment_arrangements_enabled,true),
    'enforcement_enabled', COALESCE(pl.agency_enforcement_enabled,true),
    'payment_destination', pl.payment_destination,
    'effective_from', pl.agency_mandate_effective_from,
    'notes', pl.agency_service_notes
  ) ORDER BY pl.assigned_at NULLS LAST, pl.id), '[]'::jsonb)
  INTO v_links
  FROM public.property_landlords pl
  WHERE pl.property_id=p_property_id AND pl.manager_id=v_uid;

  RETURN jsonb_build_object('property_id',p_property_id,'relationships',v_links);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_agency_property_service_summary(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_agency_property_service_summary(uuid) FROM PUBLIC, anon;

COMMENT ON FUNCTION public.get_agency_property_service_summary(uuid) IS
  'Returns the authenticated Agency service mandates for one property, including collection destination and enabled payment/enforcement controls.';

-- ---------------------------------------------------------------------------
-- 6. Explicit service-model labels keep the UI language aligned with the
--    operating truth.
-- ---------------------------------------------------------------------------
COMMENT ON FUNCTION public.agency_service_capability(uuid,text) IS
  'Agency authority resolver. full_management = operate/collect/enforce; managed_direct_landlord_collection = operate/enforce with landlord collection; collections_enforcement_only = collect/enforce with landlord operations.';

-- ---------------------------------------------------------------------------
-- 7. Blacklist enforcement must resolve the property's tenant relationship
--    before checking Agency authority. This keeps collection/enforcement-only
--    agencies usable while preventing them from creating unrelated blacklist
--    records with no property context.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tenant_blacklist_atomic(
  p_tenant_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_tenant_name text DEFAULT NULL,
  p_tenant_email text DEFAULT NULL,
  p_tenant_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_category text DEFAULT 'other',
  p_severity text DEFAULT 'medium',
  p_incident_date date DEFAULT NULL,
  p_amount_owed numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_expires_at date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_manager uuid;
  v_resolved_property uuid := p_property_id;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  IF p_reason IS NULL OR trim(p_reason)='' THEN RAISE EXCEPTION 'Reason is required'; END IF;
  IF p_amount_owed < 0 THEN RAISE EXCEPTION 'Amount owed cannot be negative'; END IF;
  IF p_severity NOT IN ('low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid severity'; END IF;

  IF p_tenant_id IS NOT NULL THEN
    SELECT t.property_id, t.manager_id
      INTO v_resolved_property, v_manager
    FROM public.tenants t
    WHERE t.id=p_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE='P0002'; END IF;
    IF p_property_id IS NOT NULL AND v_resolved_property IS DISTINCT FROM p_property_id THEN
      RAISE EXCEPTION 'Tenant is not attached to the supplied property' USING ERRCODE='42501';
    END IF;
  ELSIF p_property_id IS NOT NULL THEN
    SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id FOR UPDATE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='agency') THEN
    IF v_resolved_property IS NULL THEN
      RAISE EXCEPTION 'Property context is required for Agency enforcement workflows' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.property_landlords pl
      WHERE pl.property_id=v_resolved_property AND pl.manager_id=v_uid
    ) THEN
      RAISE EXCEPTION 'Property is outside your Agency portfolio' USING ERRCODE='42501';
    END IF;
    IF NOT public.agency_service_capability(v_resolved_property,'enforce') THEN
      RAISE EXCEPTION 'Payment enforcement is disabled for this Agency property mandate' USING ERRCODE='42501';
    END IF;
  ELSE
    IF v_manager IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501';
    END IF;
  END IF;

  INSERT INTO public.tenant_blacklist(
    manager_id,tenant_id,property_id,tenant_name,tenant_email,tenant_phone,national_id,
    reason,category,severity,incident_date,amount_owed,notes,expires_at,is_active
  ) VALUES (
    COALESCE(v_manager, v_uid),
    p_tenant_id,
    v_resolved_property,
    NULLIF(trim(p_tenant_name),''),
    NULLIF(trim(p_tenant_email),''),
    NULLIF(trim(p_tenant_phone),''),
    NULLIF(trim(p_national_id),''),
    trim(p_reason),p_category,p_severity,p_incident_date,p_amount_owed,
    NULLIF(trim(p_notes),''),p_expires_at,true
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_blacklist_atomic(uuid,uuid,text,text,text,text,text,text,text,date,numeric,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_blacklist_atomic(uuid,uuid,text,text,text,text,text,text,text,date,numeric,text,date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Record the agency operating model directly on service rows when possible
--    so downstream analytics can explain why a collection action is or is not
--    available. No duplicate source of truth is introduced.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.payment_transactions.property_id IS
  'Property context for payment capture. For Agency users this is validated against the Agency service mandate.';
COMMENT ON TABLE public.payment_allocations IS
  'Invoice allocations are subject to Agency collection authority when an Agency records a payment.';

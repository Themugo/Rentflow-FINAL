-- CALQULUS PMS — Agency service runtime enforcement
--
-- One Agency can legitimately run multiple commercial models at the same time,
-- but each property/owner relationship must expose a single, unambiguous
-- operating mandate. This migration makes that mandate operational:
--   1. owner relationships cannot carry conflicting service models for one property;
--   2. payment destination follows the selected service model;
--   3. payment-arrangement / enforcement toggles are respected;
--   4. agency write capabilities are enforced at the database boundary for
--      property, unit, tenant, lease and maintenance records.

-- ---------------------------------------------------------------------------
-- 1. Keep payment routing synchronized with the agency service model.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_agency_service_payment_destination()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.agency_service_model = 'managed_direct_landlord_collection' THEN
    NEW.payment_destination := 'landlord';
  ELSIF NEW.agency_service_model IN ('full_management','collections_enforcement_only') THEN
    NEW.payment_destination := 'manager';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_landlords_agency_service_destination ON public.property_landlords;
CREATE TRIGGER property_landlords_agency_service_destination
BEFORE INSERT OR UPDATE OF agency_service_model ON public.property_landlords
FOR EACH ROW EXECUTE FUNCTION public.sync_agency_service_payment_destination();

UPDATE public.property_landlords
SET payment_destination = CASE agency_service_model
  WHEN 'managed_direct_landlord_collection' THEN 'landlord'
  WHEN 'full_management' THEN 'manager'
  WHEN 'collections_enforcement_only' THEN 'manager'
  ELSE payment_destination
END
WHERE agency_service_model IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Prevent ambiguous collection routing across shared owners.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_agency_property_service_model()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_other_model text;
BEGIN
  IF NEW.agency_service_model IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model))
  INTO v_other_model
  FROM public.property_landlords pl
  WHERE pl.property_id = NEW.property_id
    AND pl.id <> NEW.id
    AND COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IS NOT NULL
  LIMIT 1;

  IF v_other_model IS NOT NULL AND v_other_model IS DISTINCT FROM NEW.agency_service_model THEN
    RAISE EXCEPTION 'All owners on one property must use the same Agency service model so collection routing and operational authority remain unambiguous' USING ERRCODE='22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_landlords_agency_service_model_guard ON public.property_landlords;
CREATE TRIGGER property_landlords_agency_service_model_guard
BEFORE INSERT OR UPDATE OF property_id, agency_service_model, operating_model ON public.property_landlords
FOR EACH ROW EXECUTE FUNCTION public.validate_agency_property_service_model();

-- ---------------------------------------------------------------------------
-- 3. Strengthen the capability helper for mixed agency books.
--    Capabilities are property-level because the core PMS operational records
--    are property scoped. For shared ownership, write rights are granted when
--    at least one owner mandate grants them; collection permission is granted
--    only when at least one mandate actually collects.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_service_capability(
  p_property_id uuid,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_can_write boolean := false;
  v_can_collect boolean := false;
  v_can_arrange boolean := false;
  v_can_enforce boolean := false;
  v_has_model boolean := false;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RETURN false;
  END IF;

  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY CASE WHEN ur.role = 'agency' THEN 0 WHEN ur.role = 'manager' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_role <> 'agency' THEN
    RETURN false;
  END IF;

  SELECT
    bool_or(COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IS NOT NULL),
    bool_or(COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) = 'full_management'),
    bool_or(COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IN ('full_management','collections_enforcement_only','managed_direct_landlord_collection') AND COALESCE(pl.agency_payment_arrangements_enabled,true)),
    bool_or(COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IN ('full_management','collections_enforcement_only','managed_direct_landlord_collection') AND COALESCE(pl.agency_enforcement_enabled,true))
  INTO v_has_model, v_can_write, v_can_arrange, v_can_enforce
  FROM public.property_landlords pl
  WHERE pl.property_id = p_property_id
    AND pl.manager_id = v_uid;

  -- Legacy agency relationships, which predate the explicit service model,
  -- remain fully operational rather than being accidentally locked.
  IF NOT COALESCE(v_has_model,false) THEN
    RETURN true;
  END IF;

  IF p_action IN ('view','financial','tenant_contact','reports') THEN
    RETURN true;
  END IF;

  IF p_action = 'collect' THEN
    SELECT bool_or(COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IN ('full_management','collections_enforcement_only'))
      INTO v_can_collect
    FROM public.property_landlords pl
    WHERE pl.property_id = p_property_id AND pl.manager_id = v_uid;
    RETURN COALESCE(v_can_collect,false);
  END IF;

  IF p_action = 'payment_arrangement' THEN
    SELECT bool_or(
      COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IN ('full_management','collections_enforcement_only','managed_direct_landlord_collection')
      AND COALESCE(pl.agency_payment_arrangements_enabled,true)
    ) INTO v_can_arrange
    FROM public.property_landlords pl
    WHERE pl.property_id = p_property_id AND pl.manager_id = v_uid;
    RETURN COALESCE(v_can_arrange,false);
  END IF;

  IF p_action = 'enforce' THEN
    SELECT bool_or(
      COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model)) IN ('full_management','collections_enforcement_only','managed_direct_landlord_collection')
      AND COALESCE(pl.agency_enforcement_enabled,true)
    ) INTO v_can_enforce
    FROM public.property_landlords pl
    WHERE pl.property_id = p_property_id AND pl.manager_id = v_uid;
    RETURN COALESCE(v_can_enforce,false);
  END IF;

  IF p_action IN ('property_write','unit_write','lease_write','tenant_write','maintenance_write','caretaker_write') THEN
    RETURN COALESCE(v_can_write,false);
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Maintenance requests need a real property FK so the service mandate can
--    govern property-level work even when the request has no unit.
-- ---------------------------------------------------------------------------
ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;

UPDATE public.maintenance_requests mr
SET property_id = u.property_id
FROM public.units u
WHERE mr.property_id IS NULL
  AND mr.unit_id = u.id;

CREATE INDEX IF NOT EXISTS maintenance_requests_manager_property_idx
  ON public.maintenance_requests(manager_id, property_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Enforce Agency write authority on the core property-scoped tables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_agency_service_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_property_id uuid;
  v_action text;
BEGIN
  IF auth.role() = 'service_role' OR v_uid IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY CASE WHEN ur.role='agency' THEN 0 WHEN ur.role='manager' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_role <> 'agency' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'properties' THEN
    v_property_id := COALESCE(NEW.id, OLD.id);
    v_action := 'property_write';
    -- New property creation is allowed; an agency can establish a property
    -- before an owner mandate is attached.
    IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'units' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    v_action := 'unit_write';
  ELSIF TG_TABLE_NAME = 'leases' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    v_action := 'lease_write';
  ELSIF TG_TABLE_NAME = 'tenants' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    v_action := 'tenant_write';
  ELSIF TG_TABLE_NAME = 'maintenance_requests' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    IF v_property_id IS NULL AND COALESCE(NEW.unit_id, OLD.unit_id) IS NOT NULL THEN
      SELECT property_id INTO v_property_id FROM public.units WHERE id = COALESCE(NEW.unit_id, OLD.unit_id);
    END IF;
    v_action := 'maintenance_write';
  ELSIF TG_TABLE_NAME = 'maintenance_preventive_plans' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    v_action := 'maintenance_write';
  ELSIF TG_TABLE_NAME = 'maintenance_assets' THEN
    v_property_id := COALESCE(NEW.property_id, OLD.property_id);
    v_action := 'maintenance_write';
  ELSE
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF v_property_id IS NOT NULL AND NOT public.agency_service_capability(v_property_id, v_action) THEN
    RAISE EXCEPTION 'Agency mandate does not permit this operation for this property' USING ERRCODE='42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS agency_service_guard_properties ON public.properties;
CREATE TRIGGER agency_service_guard_properties
BEFORE UPDATE OR DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

DROP TRIGGER IF EXISTS agency_service_guard_units ON public.units;
CREATE TRIGGER agency_service_guard_units
BEFORE INSERT OR UPDATE OR DELETE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

DROP TRIGGER IF EXISTS agency_service_guard_leases ON public.leases;
CREATE TRIGGER agency_service_guard_leases
BEFORE INSERT OR UPDATE OR DELETE ON public.leases
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

DROP TRIGGER IF EXISTS agency_service_guard_tenants ON public.tenants;
CREATE TRIGGER agency_service_guard_tenants
BEFORE INSERT OR UPDATE OR DELETE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

DROP TRIGGER IF EXISTS agency_service_guard_maintenance_requests ON public.maintenance_requests;
CREATE TRIGGER agency_service_guard_maintenance_requests
BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

DROP TRIGGER IF EXISTS agency_service_guard_preventive_plans ON public.maintenance_preventive_plans;
CREATE TRIGGER agency_service_guard_preventive_plans
BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_preventive_plans
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

DROP TRIGGER IF EXISTS agency_service_guard_maintenance_assets ON public.maintenance_assets;
CREATE TRIGGER agency_service_guard_maintenance_assets
BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_assets
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_service_write();

-- ---------------------------------------------------------------------------
-- 6. Populate property_id for future maintenance requests generated through
--    the canonical lifecycle RPC and keep the data relationship explicit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_maintenance_request_atomic(
  p_title text,
  p_description text,
  p_property_name text,
  p_unit_number text DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_tenant_name text DEFAULT '',
  p_tenant_email text DEFAULT '',
  p_priority text DEFAULT 'medium',
  p_category text DEFAULT 'other',
  p_expected_completion_date date DEFAULT NULL,
  p_budget numeric DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_created_by_role text DEFAULT 'manager'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_manager uuid; v_role text; v_unit_property uuid; v_property_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_title IS NULL OR nullif(trim(p_title),'') IS NULL OR p_description IS NULL OR nullif(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Title and description are required' USING ERRCODE='22023'; END IF;
  IF p_priority NOT IN ('low','medium','high','urgent') THEN RAISE EXCEPTION 'Invalid priority' USING ERRCODE='22023'; END IF;
  IF p_budget IS NOT NULL AND p_budget < 0 THEN RAISE EXCEPTION 'Budget cannot be negative' USING ERRCODE='22023'; END IF;

  SELECT COALESCE(ur.role::text,''), ur.tenant_id INTO v_role, v_unit_property
  FROM public.user_roles ur WHERE ur.user_id=auth.uid() ORDER BY CASE WHEN ur.role='tenant' THEN 0 ELSE 1 END LIMIT 1;

  IF v_role='tenant' THEN
    IF p_manager_id IS NOT NULL THEN
      SELECT t.manager_id INTO v_manager FROM public.tenants t WHERE t.id=v_unit_property;
      IF v_manager IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Invalid manager scope' USING ERRCODE='42501'; END IF;
    ELSE
      SELECT t.manager_id INTO v_manager FROM public.tenants t WHERE t.id=v_unit_property;
    END IF;
    IF v_manager IS NULL THEN RAISE EXCEPTION 'Tenant manager not found' USING ERRCODE='42501'; END IF;
    IF p_tenant_email IS DISTINCT FROM (SELECT email FROM public.tenants WHERE id=v_unit_property) THEN RAISE EXCEPTION 'Tenant identity mismatch' USING ERRCODE='42501'; END IF;
    IF p_created_by_role <> 'tenant' THEN RAISE EXCEPTION 'Invalid creator role' USING ERRCODE='42501'; END IF;
  ELSE
    v_manager := public.get_effective_manager_id();
    IF v_manager IS NULL OR p_manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
    IF v_role NOT IN ('manager','submanager','agency') THEN RAISE EXCEPTION 'Maintenance creation not permitted' USING ERRCODE='42501'; END IF;
    IF p_created_by_role <> 'manager' THEN RAISE EXCEPTION 'Invalid creator role' USING ERRCODE='42501'; END IF;
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT property_id INTO v_unit_property FROM public.units WHERE id=p_unit_id;
    v_property_id := v_unit_property;
    IF v_unit_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v_unit_property AND p.manager_id=v_manager) THEN
      RAISE EXCEPTION 'Unit is outside manager portfolio' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT p.id INTO v_property_id
    FROM public.properties p
    WHERE p.manager_id=v_manager AND lower(p.name)=lower(trim(p_property_name))
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  INSERT INTO public.maintenance_requests(property_id,title,description,property_name,unit_number,unit_id,tenant_name,tenant_email,priority,category,requested_date,expected_completion_date,budget,created_by_role,manager_id,status)
  VALUES(v_property_id,trim(p_title),trim(p_description),trim(p_property_name),nullif(trim(p_unit_number),''),p_unit_id,trim(p_tenant_name),trim(p_tenant_email),p_priority,p_category,CURRENT_DATE,p_expected_completion_date,p_budget,p_created_by_role,v_manager,'open')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'request_id',v_id,'status','open');
END; $$;

-- ---------------------------------------------------------------------------
-- 7. Invoice installment plans are the canonical agency payment-arrangement
--    mechanism; enforce the per-property toggle when an agency uses them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_invoice_installment_plan_atomic(
  p_invoice_id uuid,
  p_plan jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice public.invoices%ROWTYPE;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN RAISE EXCEPTION 'Installment plan must be an object' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id=p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_invoice.manager_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF auth.role() <> 'service_role' AND v_invoice.property_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='agency'
  ) AND NOT public.agency_service_capability(v_invoice.property_id,'payment_arrangement') THEN
    RAISE EXCEPTION 'Payment arrangements are disabled for this Agency property mandate' USING ERRCODE='42501';
  END IF;
  IF v_invoice.status IN ('paid','cancelled','refunded','failed') THEN RAISE EXCEPTION 'Invoice cannot receive an installment plan in its current state' USING ERRCODE='55000'; END IF;
  UPDATE public.invoices SET installment_plan=p_plan, updated_at=now() WHERE id=v_invoice.id;
  RETURN jsonb_build_object('success',true,'invoice_id',v_invoice.id);
END; $$;

-- ---------------------------------------------------------------------------
-- 8. Operational documentation / discoverability.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.property_landlords.agency_service_model IS
  'Agency commercial mandate per property-owner relationship: full_management, managed_direct_landlord_collection, or collections_enforcement_only.';
COMMENT ON COLUMN public.property_landlords.agency_fee_model IS
  'Agency fee model attached to the service mandate: none, percent_of_collections, flat_monthly, or flat_per_invoice.';
COMMENT ON COLUMN public.property_landlords.agency_payment_arrangements_enabled IS
  'Whether the agency may formulate installment/arrears arrangements for this property.';
COMMENT ON COLUMN public.property_landlords.agency_enforcement_enabled IS
  'Whether the agency may use payment enforcement workflows for this property.';
COMMENT ON TABLE public.agency_service_mandate_history IS
  'Immutable audit history of agency service-model changes by property-owner relationship.';
COMMENT ON COLUMN public.maintenance_requests.property_id IS
  'Canonical property scope for maintenance work; retained even when a request is not tied to a unit.';

-- ---------------------------------------------------------------------------
-- 9. Enforcement workflows remain available in all three models, subject to
--    the mandate's enforcement toggle.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tenant_notice_atomic(
  p_tenant_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_tenancy_id uuid DEFAULT NULL,
  p_notice_type text DEFAULT 'general',
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_current_rent numeric DEFAULT NULL,
  p_new_rent numeric DEFAULT NULL,
  p_effective_date date DEFAULT NULL,
  p_notice_period_days integer DEFAULT NULL,
  p_delivery_method text DEFAULT 'email',
  p_status text DEFAULT 'sent'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid; v_manager uuid; v_property_id uuid; v_tenant public.tenants%ROWTYPE;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  IF p_title IS NULL OR trim(p_title)='' OR p_body IS NULL OR trim(p_body)='' THEN RAISE EXCEPTION 'Notice title and body are required'; END IF;
  IF p_status NOT IN ('draft','sent') THEN RAISE EXCEPTION 'Invalid notice status'; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;
  v_manager:=v_tenant.manager_id;
  v_property_id:=COALESCE(p_property_id,v_tenant.property_id);
  IF v_manager<>v_uid OR (p_property_id IS NOT NULL AND v_tenant.property_id IS DISTINCT FROM p_property_id) THEN
    RAISE EXCEPTION 'Tenant is outside your portfolio' USING ERRCODE='42501';
  END IF;
  IF p_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units WHERE id=p_unit_id AND property_id=v_tenant.property_id) THEN
    RAISE EXCEPTION 'Unit does not belong to tenant property' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='agency')
     AND v_property_id IS NOT NULL
     AND NOT public.agency_service_capability(v_property_id,'enforce') THEN
    RAISE EXCEPTION 'Payment enforcement is disabled for this Agency property mandate' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.tenant_notices(tenant_id,unit_id,property_id,manager_id,tenancy_id,notice_type,title,body,current_rent,new_rent,effective_date,notice_period_days,delivery_method,status,sent_at)
  VALUES(p_tenant_id,p_unit_id,v_tenant.property_id,v_uid,p_tenancy_id,p_notice_type,trim(p_title),trim(p_body),p_current_rent,p_new_rent,p_effective_date,p_notice_period_days,p_delivery_method,p_status,CASE WHEN p_status='sent' THEN now() ELSE NULL END)
  RETURNING id INTO v_id; RETURN v_id;
END; $$;

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
DECLARE v_uid uuid:=auth.uid(); v_id uuid; v_manager uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  IF p_reason IS NULL OR trim(p_reason)='' THEN RAISE EXCEPTION 'Reason is required'; END IF;
  IF p_amount_owed < 0 THEN RAISE EXCEPTION 'Amount owed cannot be negative'; END IF;
  IF p_severity NOT IN ('low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid severity'; END IF;
  IF p_property_id IS NOT NULL THEN
    SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id FOR UPDATE;
    IF NOT FOUND OR v_manager<>v_uid THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='agency')
       AND NOT public.agency_service_capability(p_property_id,'enforce') THEN
      RAISE EXCEPTION 'Payment enforcement is disabled for this Agency property mandate' USING ERRCODE='42501';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') THEN RAISE EXCEPTION 'Manager role required' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND (manager_id=v_uid OR property_id=p_property_id)) THEN RAISE EXCEPTION 'Tenant is outside your portfolio' USING ERRCODE='42501'; END IF;
  INSERT INTO public.tenant_blacklist(manager_id,tenant_id,property_id,tenant_name,tenant_email,tenant_phone,national_id,reason,category,severity,incident_date,amount_owed,notes,expires_at,is_active)
  VALUES(v_uid,p_tenant_id,p_property_id,NULLIF(trim(p_tenant_name),''),NULLIF(trim(p_tenant_email),''),NULLIF(trim(p_tenant_phone),''),NULLIF(trim(p_national_id),''),trim(p_reason),p_category,p_severity,p_incident_date,p_amount_owed,NULLIF(trim(p_notes),''),p_expires_at,true)
  RETURNING id INTO v_id; RETURN v_id;
END; $$;

-- Unit access/key issuance is an operational write, therefore unavailable to a
-- collection/enforcement-only agency mandate.
CREATE OR REPLACE FUNCTION public.issue_unit_key_atomic(
  p_unit_id uuid,
  p_key_type text,
  p_key_label text DEFAULT NULL,
  p_serial_number text DEFAULT NULL,
  p_issued_date date DEFAULT CURRENT_DATE,
  p_issued_to_name text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_property uuid; v_id uuid;
BEGIN
  SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id FOR UPDATE;
  IF v_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_property AND manager_id=v_uid) THEN
    RAISE EXCEPTION 'Unit not found or unauthorized' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='agency')
     AND NOT public.agency_service_capability(v_property,'unit_write') THEN
    RAISE EXCEPTION 'This Agency mandate does not permit operational unit access changes' USING ERRCODE='42501';
  END IF;
  IF p_key_type IS NULL OR trim(p_key_type)='' THEN RAISE EXCEPTION 'Key type is required'; END IF;
  IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND property_id=v_property AND unit_id=p_unit_id AND status='active') THEN RAISE EXCEPTION 'Tenant is not active in this unit' USING ERRCODE='42501'; END IF;
  INSERT INTO public.unit_key_records(unit_id,property_id,manager_id,tenant_id,key_type,key_label,serial_number,issued_date,issued_by,issued_to_name,notes,status)
  VALUES(p_unit_id,v_property,v_uid,p_tenant_id,trim(p_key_type),NULLIF(trim(p_key_label),''),NULLIF(trim(p_serial_number),''),p_issued_date,v_uid,NULLIF(trim(p_issued_to_name),''),NULLIF(trim(p_notes),''),'active')
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Key records can also be written through other lifecycle paths; protect the
-- table itself when those paths execute as the Agency.
CREATE OR REPLACE FUNCTION public.guard_agency_unit_key_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_property_id uuid;
BEGIN
  IF auth.role()='service_role' OR auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='agency') THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_property_id:=COALESCE(NEW.property_id,OLD.property_id);
  IF v_property_id IS NOT NULL AND NOT public.agency_service_capability(v_property_id,'unit_write') THEN
    RAISE EXCEPTION 'Agency mandate does not permit unit access changes' USING ERRCODE='42501';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS agency_service_guard_unit_keys ON public.unit_key_records;
CREATE TRIGGER agency_service_guard_unit_keys
BEFORE INSERT OR UPDATE OR DELETE ON public.unit_key_records
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_unit_key_write();

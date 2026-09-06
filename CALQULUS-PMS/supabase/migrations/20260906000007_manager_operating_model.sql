-- CALQULUS PMS — Independent Property Manager operating model
--
-- This is intentionally additive. It reuses the existing property_landlords,
-- properties, tenants, leases, maintenance, billing and reporting systems.
-- A manager mandate controls *authority*; it does not create a second PMS.

CREATE TABLE IF NOT EXISTS public.manager_owner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_type text NOT NULL DEFAULT 'individual'
    CHECK (client_type IN ('individual','family','company','institution','staff_quarters','nonprofit','other')),
  display_name text,
  client_reference text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id, owner_user_id)
);

CREATE TABLE IF NOT EXISTS public.manager_management_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_landlord_id uuid NOT NULL REFERENCES public.property_landlords(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Commercial relationship
  mandate_status text NOT NULL DEFAULT 'active'
    CHECK (mandate_status IN ('draft','active','paused','ended')),
  management_fee_model text NOT NULL DEFAULT 'flat_monthly'
    CHECK (management_fee_model IN ('none','flat_monthly','percent_of_collections','flat_per_unit','custom')),
  management_fee_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (management_fee_value >= 0),

  -- Authority boundary. Default = manager operates; owner controls money.
  owner_controls_collections boolean NOT NULL DEFAULT true,
  owner_controls_financials boolean NOT NULL DEFAULT true,
  owner_controls_distributions boolean NOT NULL DEFAULT true,
  manager_can_collect boolean NOT NULL DEFAULT false,
  manager_can_approve_financials boolean NOT NULL DEFAULT false,
  manager_can_distribute boolean NOT NULL DEFAULT false,

  -- Property/occupant operations remain manager-led by default.
  manager_can_manage_tenants boolean NOT NULL DEFAULT true,
  manager_can_manage_leases boolean NOT NULL DEFAULT true,
  manager_can_manage_maintenance boolean NOT NULL DEFAULT true,
  manager_can_manage_vendors boolean NOT NULL DEFAULT true,
  manager_can_communicate_with_tenants boolean NOT NULL DEFAULT true,
  manager_can_approve_operational_spend boolean NOT NULL DEFAULT true,
  operational_spend_limit numeric(12,2) NOT NULL DEFAULT 0 CHECK (operational_spend_limit >= 0),
  owner_approval_required_above_limit boolean NOT NULL DEFAULT true,

  -- Owner portal and reporting configuration.
  owner_portal_enabled boolean NOT NULL DEFAULT true,
  owner_visibility jsonb NOT NULL DEFAULT jsonb_build_object(
    'property', true,
    'units', true,
    'occupancy', true,
    'tenants', true,
    'maintenance', true,
    'vendors', true,
    'documents', true,
    'contracts', true,
    'leases', true,
    'collections', true,
    'financials', true,
    'distributions', true
  ),
  reporting_frequency text NOT NULL DEFAULT 'monthly'
    CHECK (reporting_frequency IN ('none','exception_only','weekly','monthly','quarterly')),
  reporting_delivery text NOT NULL DEFAULT 'portal'
    CHECK (reporting_delivery IN ('portal','email','portal_and_email')),
  report_sections jsonb NOT NULL DEFAULT jsonb_build_object(
    'occupancy', true,
    'tenant_service', true,
    'maintenance', true,
    'vendors', true,
    'compliance', true,
    'financial_summary', false,
    'collections', false,
    'distributions', false,
    'documents', true
  ),

  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_landlord_id)
);

CREATE INDEX IF NOT EXISTS manager_owner_profiles_manager_idx
  ON public.manager_owner_profiles(manager_id, active);
CREATE INDEX IF NOT EXISTS manager_owner_profiles_owner_idx
  ON public.manager_owner_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS manager_management_mandates_manager_idx
  ON public.manager_management_mandates(manager_id, mandate_status);
CREATE INDEX IF NOT EXISTS manager_management_mandates_owner_idx
  ON public.manager_management_mandates(owner_user_id);
CREATE INDEX IF NOT EXISTS manager_management_mandates_property_idx
  ON public.manager_management_mandates(property_id);

ALTER TABLE public.manager_owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_management_mandates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manager_owner_profiles_manager_read ON public.manager_owner_profiles;
CREATE POLICY manager_owner_profiles_manager_read
  ON public.manager_owner_profiles FOR SELECT
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS manager_owner_profiles_owner_read ON public.manager_owner_profiles;
CREATE POLICY manager_owner_profiles_owner_read
  ON public.manager_owner_profiles FOR SELECT
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS manager_management_mandates_manager_read ON public.manager_management_mandates;
CREATE POLICY manager_management_mandates_manager_read
  ON public.manager_management_mandates FOR SELECT
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS manager_management_mandates_owner_read ON public.manager_management_mandates;
CREATE POLICY manager_management_mandates_owner_read
  ON public.manager_management_mandates FOR SELECT
  USING (owner_user_id = auth.uid() AND owner_portal_enabled = true);

-- Mutations are deliberately RPC-only so authority changes are audited and
-- validated against the manager ↔ property ↔ owner relationship.
REVOKE INSERT, UPDATE, DELETE ON public.manager_owner_profiles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.manager_management_mandates FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.save_manager_owner_profile_atomic(
  p_owner_user_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS public.manager_owner_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := auth.uid();
  v public.manager_owner_profiles%ROWTYPE;
BEGIN
  IF v_manager IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved'
  ) THEN
    RAISE EXCEPTION 'Manager authorization required' USING ERRCODE='42501';
  END IF;
  IF p_owner_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.property_landlords
    WHERE manager_id=v_manager AND landlord_user_id=p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Owner is not linked to a property managed by this manager' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.manager_owner_profiles(manager_id, owner_user_id, client_type, display_name, client_reference, notes)
  VALUES (
    v_manager,
    p_owner_user_id,
    COALESCE(NULLIF(p_payload->>'client_type',''),'individual'),
    NULLIF(trim(p_payload->>'display_name'),''),
    NULLIF(trim(p_payload->>'client_reference'),''),
    NULLIF(trim(p_payload->>'notes'),'')
  )
  ON CONFLICT (manager_id, owner_user_id) DO UPDATE SET
    client_type=EXCLUDED.client_type,
    display_name=EXCLUDED.display_name,
    client_reference=EXCLUDED.client_reference,
    notes=EXCLUDED.notes,
    active=true,
    updated_at=now()
  RETURNING * INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_manager_management_mandate_atomic(
  p_property_landlord_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS public.manager_management_mandates
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := auth.uid();
  v_link public.property_landlords%ROWTYPE;
  v public.manager_management_mandates%ROWTYPE;
  v_owner_portal boolean;
BEGIN
  IF v_manager IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved'
  ) THEN
    RAISE EXCEPTION 'Manager authorization required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_link
  FROM public.property_landlords
  WHERE id=p_property_landlord_id AND manager_id=v_manager
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Managed owner relationship not found or unauthorized' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_link.property_id AND manager_id=v_manager) THEN
    RAISE EXCEPTION 'Property is not managed by this manager' USING ERRCODE='42501';
  END IF;

  v_owner_portal := COALESCE((p_payload->>'owner_portal_enabled')::boolean, true);

  INSERT INTO public.manager_management_mandates(
    manager_id, property_landlord_id, property_id, owner_user_id,
    mandate_status, management_fee_model, management_fee_value,
    owner_controls_collections, owner_controls_financials, owner_controls_distributions,
    manager_can_collect, manager_can_approve_financials, manager_can_distribute,
    manager_can_manage_tenants, manager_can_manage_leases, manager_can_manage_maintenance,
    manager_can_manage_vendors, manager_can_communicate_with_tenants, manager_can_approve_operational_spend,
    operational_spend_limit, owner_approval_required_above_limit,
    owner_portal_enabled, owner_visibility, reporting_frequency, reporting_delivery, report_sections,
    effective_from, effective_to, notes
  ) VALUES (
    v_manager, v_link.id, v_link.property_id, v_link.landlord_user_id,
    COALESCE(NULLIF(p_payload->>'mandate_status',''),'active'),
    COALESCE(NULLIF(p_payload->>'management_fee_model',''),'flat_monthly'),
    GREATEST(COALESCE((p_payload->>'management_fee_value')::numeric,0),0),
    COALESCE((p_payload->>'owner_controls_collections')::boolean,true),
    COALESCE((p_payload->>'owner_controls_financials')::boolean,true),
    COALESCE((p_payload->>'owner_controls_distributions')::boolean,true),
    COALESCE((p_payload->>'manager_can_collect')::boolean,false),
    COALESCE((p_payload->>'manager_can_approve_financials')::boolean,false),
    COALESCE((p_payload->>'manager_can_distribute')::boolean,false),
    COALESCE((p_payload->>'manager_can_manage_tenants')::boolean,true),
    COALESCE((p_payload->>'manager_can_manage_leases')::boolean,true),
    COALESCE((p_payload->>'manager_can_manage_maintenance')::boolean,true),
    COALESCE((p_payload->>'manager_can_manage_vendors')::boolean,true),
    COALESCE((p_payload->>'manager_can_communicate_with_tenants')::boolean,true),
    COALESCE((p_payload->>'manager_can_approve_operational_spend')::boolean,true),
    GREATEST(COALESCE((p_payload->>'operational_spend_limit')::numeric,0),0),
    COALESCE((p_payload->>'owner_approval_required_above_limit')::boolean,true),
    v_owner_portal,
    COALESCE(p_payload->'owner_visibility', '{}'::jsonb),
    COALESCE(NULLIF(p_payload->>'reporting_frequency',''),'monthly'),
    COALESCE(NULLIF(p_payload->>'reporting_delivery',''),'portal'),
    COALESCE(p_payload->'report_sections','{}'::jsonb),
    COALESCE(NULLIF(p_payload->>'effective_from','')::date,CURRENT_DATE),
    NULLIF(p_payload->>'effective_to','')::date,
    NULLIF(trim(p_payload->>'notes'),'')
  )
  ON CONFLICT (property_landlord_id) DO UPDATE SET
    mandate_status=EXCLUDED.mandate_status,
    management_fee_model=EXCLUDED.management_fee_model,
    management_fee_value=EXCLUDED.management_fee_value,
    owner_controls_collections=EXCLUDED.owner_controls_collections,
    owner_controls_financials=EXCLUDED.owner_controls_financials,
    owner_controls_distributions=EXCLUDED.owner_controls_distributions,
    manager_can_collect=EXCLUDED.manager_can_collect,
    manager_can_approve_financials=EXCLUDED.manager_can_approve_financials,
    manager_can_distribute=EXCLUDED.manager_can_distribute,
    manager_can_manage_tenants=EXCLUDED.manager_can_manage_tenants,
    manager_can_manage_leases=EXCLUDED.manager_can_manage_leases,
    manager_can_manage_maintenance=EXCLUDED.manager_can_manage_maintenance,
    manager_can_manage_vendors=EXCLUDED.manager_can_manage_vendors,
    manager_can_communicate_with_tenants=EXCLUDED.manager_can_communicate_with_tenants,
    manager_can_approve_operational_spend=EXCLUDED.manager_can_approve_operational_spend,
    operational_spend_limit=EXCLUDED.operational_spend_limit,
    owner_approval_required_above_limit=EXCLUDED.owner_approval_required_above_limit,
    owner_portal_enabled=EXCLUDED.owner_portal_enabled,
    owner_visibility=EXCLUDED.owner_visibility,
    reporting_frequency=EXCLUDED.reporting_frequency,
    reporting_delivery=EXCLUDED.reporting_delivery,
    report_sections=EXCLUDED.report_sections,
    effective_from=EXCLUDED.effective_from,
    effective_to=EXCLUDED.effective_to,
    notes=EXCLUDED.notes,
    updated_at=now()
  RETURNING * INTO v;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_property_authority(
  p_property_id uuid,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := auth.uid();
  v public.manager_management_mandates%ROWTYPE;
BEGIN
  IF v_manager IS NULL OR auth.role() <> 'authenticated' THEN RETURN false; END IF;
  SELECT * INTO v
  FROM public.manager_management_mandates
  WHERE manager_id=v_manager AND property_id=p_property_id AND mandate_status='active'
  LIMIT 1;
  IF NOT FOUND THEN
    -- Existing manager properties remain operational while a mandate is being configured.
    RETURN EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=v_manager);
  END IF;
  RETURN CASE p_action
    WHEN 'tenant' THEN v.manager_can_manage_tenants
    WHEN 'lease' THEN v.manager_can_manage_leases
    WHEN 'maintenance' THEN v.manager_can_manage_maintenance
    WHEN 'vendor' THEN v.manager_can_manage_vendors
    WHEN 'tenant_communication' THEN v.manager_can_communicate_with_tenants
    WHEN 'operational_spend' THEN v.manager_can_approve_operational_spend
    WHEN 'collect' THEN v.manager_can_collect
    WHEN 'financial_approval' THEN v.manager_can_approve_financials
    WHEN 'distribution' THEN v.manager_can_distribute
    ELSE false
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.save_manager_owner_profile_atomic(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_manager_management_mandate_atomic(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_property_authority(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_manager_owner_profile_atomic(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_manager_management_mandate_atomic(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manager_property_authority(uuid,text) TO authenticated, service_role;

COMMENT ON TABLE public.manager_management_mandates IS
  'Independent property-manager mandate: operations are delegated to the manager while collections/financials/distributions can remain with the owner.';
COMMENT ON COLUMN public.manager_management_mandates.owner_visibility IS
  'Owner portal visibility by capability; this controls presentation/access policy, not ownership of the underlying records.';
COMMENT ON COLUMN public.manager_management_mandates.report_sections IS
  'Manager-configured owner reporting sections; reuses the existing reporting engine/data sources.';

-- CALQULUS PMS — Shared management configuration hierarchy
-- One configuration model across Agency, Property Manager and Landlord.
-- Agency remains the source of client-contract rules; this table stores only
-- manager-owned or independent-landlord-owned overrides/configuration.

CREATE TABLE IF NOT EXISTS public.management_rule_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('manager','landlord')),
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','superseded','expired')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK ((scope_type='manager' AND manager_user_id IS NOT NULL AND landlord_user_id IS NULL)
      OR (scope_type='landlord' AND landlord_user_id IS NOT NULL AND manager_user_id IS NULL)),
  CHECK (unit_id IS NULL OR property_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS management_rule_profiles_manager_scope_uidx
  ON public.management_rule_profiles(scope_type, manager_user_id, COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid))
  WHERE scope_type='manager' AND status='active';
CREATE UNIQUE INDEX IF NOT EXISTS management_rule_profiles_landlord_scope_uidx
  ON public.management_rule_profiles(scope_type, landlord_user_id, COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid))
  WHERE scope_type='landlord' AND status='active';
CREATE INDEX IF NOT EXISTS management_rule_profiles_property_idx ON public.management_rule_profiles(property_id,status,effective_from DESC);

ALTER TABLE public.management_rule_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS management_rule_profiles_read ON public.management_rule_profiles;
CREATE POLICY management_rule_profiles_read ON public.management_rule_profiles FOR SELECT TO authenticated
USING (manager_user_id=auth.uid() OR landlord_user_id=auth.uid());
REVOKE INSERT,UPDATE,DELETE ON public.management_rule_profiles FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.management_default_rules()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT jsonb_build_object(
  'management_modules', jsonb_build_object(
    'property_operations', true,'unit_operations',true,'lease_operations',true,'tenant_operations',true,
    'maintenance_operations',true,'caretaker_operations',false,'inspection_operations',true,
    'utility_operations',true,'compliance_operations',true,'vendor_operations',true
  ),
  'financial_modules', jsonb_build_object(
    'track_expenses',true,'break_down_charges',true,'include_external_evidence',true,'close_books',true,
    'owner_statements',true,'settlements',true,'reconciliation',true
  ),
  'payment_rules', jsonb_build_object(
    'allow_payment_arrangements',true,'allow_partial_payments',true,'auto_allocate_rent',true,
    'allow_third_party_payers',true,'require_evidence',true,'allow_bank_transfer',true,
    'allow_cash',true,'allow_external_consolidation',true,'manual_payment_review',true
  ),
  'billing_rules', jsonb_build_object(
    'auto_generate_rent',true,'rent_due_day',1,'grace_period_days',0,'late_fee_enabled',false,
    'allow_metered_charges',true,'allow_property_charges',true,'allow_unit_charges',true
  ),
  'amenity_rules', jsonb_build_object(
    'allow_unit_amenities',true,'allow_chargeable_amenities',true,'tenant_visible',true,
    'require_approval_for_new_charge',true
  ),
  'enforcement_rules', jsonb_build_object('enabled',true,'block_unapproved_mutations',true,'require_audit_reason',true),
  'approval_rules', jsonb_build_object(
    'manual_payments_require_review',true,'external_consolidation_requires_review',true,
    'expense_above_threshold_requires_approval',true,'lease_changes_require_approval',false
  ),
  'settlement_rules', jsonb_build_object('fee_model','none','fee_value',0,'distribution_requires_close',true),
  'tenant_rules', jsonb_build_object('tenant_can_view_billing',true,'tenant_can_submit_payment_evidence',true,'tenant_can_raise_maintenance',true),
  'maintenance_rules', jsonb_build_object('require_work_order',true,'vendor_assignment_requires_scope',true,'completion_requires_evidence',true),
  'vendor_rules', jsonb_build_object('require_vendor_record',true,'require_quote_for_major_work',true),
  'document_rules', jsonb_build_object('require_signed_contract',true,'preserve_versions',true,'immutable_executed_documents',true),
  'communication_rules', jsonb_build_object('notify_material_changes',true,'allow_selected_reach',true,'allow_global_reach',true),
  'owner_visibility', jsonb_build_object('property',true,'units',true,'occupancy',true,'tenants',true,'maintenance',true,'vendors',true,'documents',true,'contracts',true,'leases',true,'collections',true,'financials',true,'distributions',true),
  'reporting', jsonb_build_object('frequency','monthly','delivery','portal','occupancy',true,'tenant_service',true,'maintenance',true,'vendors',true,'compliance',true,'financial_summary',true,'collections',true,'distributions',true,'documents',true),
  'security_rules', jsonb_build_object('deny_cross_scope_access',true,'require_server_authority',true,'protect_closed_periods',true,'protect_paid_invoices',true)
);
$$;

CREATE OR REPLACE FUNCTION public.get_effective_management_configuration(p_property_id uuid DEFAULT NULL, p_unit_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_role text; v_config jsonb:=public.management_default_rules(); v_source text:='platform_defaults'; v_link public.property_landlords%ROWTYPE;
  v_profile jsonb; v_agency_rule public.agency_contract_rules%ROWTYPE; v_mandate public.manager_management_mandates%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id=v_uid ORDER BY CASE role WHEN 'agency' THEN 1 WHEN 'manager' THEN 2 WHEN 'landlord' THEN 3 ELSE 9 END LIMIT 1;

  IF v_role='manager' THEN
    SELECT * INTO v_mandate FROM public.manager_management_mandates WHERE manager_id=v_uid AND (p_property_id IS NULL OR property_id=p_property_id) AND mandate_status='active' ORDER BY updated_at DESC LIMIT 1;
    SELECT config INTO v_profile FROM public.management_rule_profiles WHERE scope_type='manager' AND manager_user_id=v_uid AND status='active' AND (property_id IS NULL OR property_id=p_property_id) AND (unit_id IS NULL OR unit_id=p_unit_id) ORDER BY (unit_id IS NOT NULL)::int DESC,(property_id IS NOT NULL)::int DESC,updated_at DESC LIMIT 1;
    IF v_mandate.id IS NOT NULL THEN
      v_config:=v_config || jsonb_build_object('management_modules', jsonb_build_object('tenant_operations',v_mandate.manager_can_manage_tenants,'lease_operations',v_mandate.manager_can_manage_leases,'maintenance_operations',v_mandate.manager_can_manage_maintenance,'vendor_operations',v_mandate.manager_can_manage_vendors),'owner_visibility',v_mandate.owner_visibility,'reporting',v_mandate.report_sections || jsonb_build_object('frequency',v_mandate.reporting_frequency,'delivery',v_mandate.reporting_delivery),'financial_authority',jsonb_build_object('manager_can_collect',v_mandate.manager_can_collect,'manager_can_approve_financials',v_mandate.manager_can_approve_financials,'manager_can_distribute',v_mandate.manager_can_distribute,'owner_controls_collections',v_mandate.owner_controls_collections,'owner_controls_financials',v_mandate.owner_controls_financials,'owner_controls_distributions',v_mandate.owner_controls_distributions));
      v_source:='manager_mandate';
    END IF;
    IF v_profile IS NOT NULL THEN v_config:=v_config || v_profile; v_source:='manager_configuration'; END IF;
  ELSIF v_role='landlord' AND p_property_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.property_landlords WHERE property_id=p_property_id AND landlord_user_id=v_uid ORDER BY updated_at DESC LIMIT 1;
    IF v_link.id IS NULL THEN RAISE EXCEPTION 'Property ownership scope required' USING ERRCODE='42501'; END IF;
    IF v_link.manager_id IS NOT NULL THEN
      SELECT * INTO v_agency_rule
      FROM public.agency_contract_rules r
      WHERE r.property_landlord_id=v_link.id AND r.status='active'
        AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=r.agency_id AND a.manager_id=v_link.manager_id)
      ORDER BY r.effective_from DESC,r.updated_at DESC LIMIT 1;
      IF v_agency_rule.id IS NOT NULL THEN
        v_config:=v_config || jsonb_build_object('management_modules',v_agency_rule.management_modules,'financial_modules',v_agency_rule.financial_modules,'payment_rules',v_agency_rule.payment_rules,'enforcement_rules',v_agency_rule.enforcement_rules,'settlement_rules',v_agency_rule.settlement_rules,'approval_rules',v_agency_rule.approval_rules,'agency_contract',jsonb_build_object('contract_name',v_agency_rule.contract_name,'service_model',v_agency_rule.service_model,'collection_destination',v_agency_rule.collection_destination,'effective_from',v_agency_rule.effective_from));
        v_source:='agency_client_contract';
      ELSE
        SELECT * INTO v_mandate FROM public.manager_management_mandates WHERE property_landlord_id=v_link.id AND mandate_status='active' LIMIT 1;
        IF v_mandate.id IS NOT NULL THEN v_config:=v_config || jsonb_build_object('owner_visibility',v_mandate.owner_visibility,'reporting',v_mandate.report_sections,'manager_mandate',jsonb_build_object('manager_can_collect',v_mandate.manager_can_collect,'manager_can_approve_financials',v_mandate.manager_can_approve_financials,'manager_can_distribute',v_mandate.manager_can_distribute)); v_source:='manager_mandate'; END IF;
      END IF;
    ELSE
      SELECT config INTO v_profile FROM public.management_rule_profiles WHERE scope_type='landlord' AND landlord_user_id=v_uid AND status='active' AND (property_id IS NULL OR property_id=p_property_id) AND (unit_id IS NULL OR unit_id=p_unit_id) ORDER BY (unit_id IS NOT NULL)::int DESC,(property_id IS NOT NULL)::int DESC,updated_at DESC LIMIT 1;
      IF v_profile IS NOT NULL THEN v_config:=v_config || v_profile; v_source:='independent_landlord_configuration'; ELSE v_source:='independent_landlord_defaults'; END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('source',v_source,'scope',CASE WHEN p_unit_id IS NOT NULL THEN 'unit' WHEN p_property_id IS NOT NULL THEN 'property' ELSE 'account' END,'config',v_config);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_management_configuration_atomic(p_scope_type text, p_property_id uuid DEFAULT NULL, p_unit_id uuid DEFAULT NULL, p_config jsonb DEFAULT '{}'::jsonb, p_notes text DEFAULT NULL)
RETURNS public.management_rule_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_id uuid; v public.management_rule_profiles%ROWTYPE; v_property_owner uuid; v_manager uuid; v_link public.property_landlords%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_scope_type NOT IN ('manager','landlord') THEN RAISE EXCEPTION 'Invalid management configuration scope' USING ERRCODE='22023'; END IF;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id=v_uid ORDER BY CASE role WHEN 'manager' THEN 1 WHEN 'landlord' THEN 2 ELSE 9 END LIMIT 1;
  IF p_scope_type='manager' THEN
    IF v_role<>'manager' OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required' USING ERRCODE='42501'; END IF;
    IF p_property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=v_uid) THEN RAISE EXCEPTION 'Manager property scope required' USING ERRCODE='42501'; END IF;
    INSERT INTO public.management_rule_profiles(scope_type,manager_user_id,property_id,unit_id,config,notes,created_by,updated_by) VALUES('manager',v_uid,p_property_id,p_unit_id,COALESCE(p_config,'{}'::jsonb),NULLIF(trim(COALESCE(p_notes,'')),''),v_uid,v_uid) ON CONFLICT (scope_type,manager_user_id,COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid),COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status='active' DO UPDATE SET config=EXCLUDED.config,notes=EXCLUDED.notes,updated_by=v_uid,updated_at=now() RETURNING * INTO v;
  ELSE
    IF v_role<>'landlord' THEN RAISE EXCEPTION 'Landlord authorization required' USING ERRCODE='42501'; END IF;
    IF p_property_id IS NULL THEN RAISE EXCEPTION 'Property is required for landlord configuration' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_link FROM public.property_landlords WHERE property_id=p_property_id AND landlord_user_id=v_uid ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Property ownership scope required' USING ERRCODE='42501'; END IF;
    IF v_link.manager_id IS NOT NULL THEN RAISE EXCEPTION 'Managed landlord configuration is controlled by the appointed manager or agency' USING ERRCODE='42501'; END IF;
    INSERT INTO public.management_rule_profiles(scope_type,landlord_user_id,property_id,unit_id,config,notes,created_by,updated_by) VALUES('landlord',v_uid,p_property_id,p_unit_id,COALESCE(p_config,'{}'::jsonb),NULLIF(trim(COALESCE(p_notes,'')),''),v_uid,v_uid) ON CONFLICT (scope_type,landlord_user_id,COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid),COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status='active' DO UPDATE SET config=EXCLUDED.config,notes=EXCLUDED.notes,updated_by=v_uid,updated_at=now() RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.management_default_rules(), public.get_effective_management_configuration(uuid,uuid), public.save_management_configuration_atomic(text,uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.management_default_rules(), public.get_effective_management_configuration(uuid,uuid), public.save_management_configuration_atomic(text,uuid,uuid,jsonb,text) TO authenticated,service_role;
COMMENT ON TABLE public.management_rule_profiles IS 'Shared manager/independent-landlord configuration store. Agency client contracts remain authoritative for managed landlords; this table never overrides an agency contract.';

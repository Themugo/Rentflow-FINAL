-- CALQULUS PMS — Phases 41–42
-- Converge landlord-team and payment-payer client mutations onto atomic RPCs.

CREATE OR REPLACE FUNCTION public.save_landlord_team_member_atomic(
  p_member_user_id uuid,
  p_member_label text DEFAULT NULL,
  p_assigned_property_ids uuid[] DEFAULT '{}',
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_landlord uuid := auth.uid();
  v_member jsonb := coalesce(p_permissions, '{}'::jsonb);
  v_props uuid[] := coalesce(p_assigned_property_ids, '{}');
BEGIN
  IF v_landlord IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_member_user_id IS NULL OR p_member_user_id = v_landlord THEN RAISE EXCEPTION 'Invalid team member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.landlord_user_id = v_landlord) THEN
    RAISE EXCEPTION 'Landlord relationship required';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_props) x WHERE NOT EXISTS (
    SELECT 1 FROM public.property_landlords pl WHERE pl.landlord_user_id = v_landlord AND pl.property_id = x
  )) THEN RAISE EXCEPTION 'Assigned property is not linked to this landlord'; END IF;

  INSERT INTO public.landlord_team_members (
    landlord_user_id, member_user_id, member_label, assigned_property_ids,
    can_view_properties, can_view_tenants, can_view_leases, can_view_invoices,
    can_view_maintenance, can_view_contracts, can_view_activity_logs,
    can_record_payments, can_edit_tenants, can_manage_maintenance,
    can_create_invoices, can_approve_moveouts, can_send_notices,
    can_upload_documents, restrict_to_assigned_properties
  ) VALUES (
    v_landlord, p_member_user_id, nullif(trim(p_member_label), ''), v_props,
    coalesce((v_member->>'can_view_properties')::boolean, true),
    coalesce((v_member->>'can_view_tenants')::boolean, true),
    coalesce((v_member->>'can_view_leases')::boolean, true),
    coalesce((v_member->>'can_view_invoices')::boolean, true),
    coalesce((v_member->>'can_view_maintenance')::boolean, true),
    coalesce((v_member->>'can_view_contracts')::boolean, false),
    coalesce((v_member->>'can_view_activity_logs')::boolean, false),
    coalesce((v_member->>'can_record_payments')::boolean, false),
    coalesce((v_member->>'can_edit_tenants')::boolean, false),
    coalesce((v_member->>'can_manage_maintenance')::boolean, false),
    coalesce((v_member->>'can_create_invoices')::boolean, false),
    coalesce((v_member->>'can_approve_moveouts')::boolean, false),
    coalesce((v_member->>'can_send_notices')::boolean, false),
    coalesce((v_member->>'can_upload_documents')::boolean, true),
    coalesce((v_member->>'restrict_to_assigned_properties')::boolean, true)
  )
  ON CONFLICT (landlord_user_id, member_user_id) DO UPDATE SET
    member_label = EXCLUDED.member_label,
    assigned_property_ids = EXCLUDED.assigned_property_ids,
    can_view_properties = EXCLUDED.can_view_properties,
    can_view_tenants = EXCLUDED.can_view_tenants,
    can_view_leases = EXCLUDED.can_view_leases,
    can_view_invoices = EXCLUDED.can_view_invoices,
    can_view_maintenance = EXCLUDED.can_view_maintenance,
    can_view_contracts = EXCLUDED.can_view_contracts,
    can_view_activity_logs = EXCLUDED.can_view_activity_logs,
    can_record_payments = EXCLUDED.can_record_payments,
    can_edit_tenants = EXCLUDED.can_edit_tenants,
    can_manage_maintenance = EXCLUDED.can_manage_maintenance,
    can_create_invoices = EXCLUDED.can_create_invoices,
    can_approve_moveouts = EXCLUDED.can_approve_moveouts,
    can_send_notices = EXCLUDED.can_send_notices,
    can_upload_documents = EXCLUDED.can_upload_documents,
    restrict_to_assigned_properties = EXCLUDED.restrict_to_assigned_properties
  RETURNING id INTO v_id;

  INSERT INTO public.manager_submanagers (manager_id, submanager_user_id)
  VALUES (v_landlord, p_member_user_id)
  ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.submanager_permissions WHERE submanager_user_id = p_member_user_id) THEN
    UPDATE public.submanager_permissions SET
      manager_id=v_landlord, assigned_property_ids=v_props,
      can_view_properties=coalesce((v_member->>'can_view_properties')::boolean,true),
      can_view_tenants=coalesce((v_member->>'can_view_tenants')::boolean,true),
      can_view_leases=coalesce((v_member->>'can_view_leases')::boolean,true),
      can_view_invoices=coalesce((v_member->>'can_view_invoices')::boolean,true),
      can_view_maintenance=coalesce((v_member->>'can_view_maintenance')::boolean,true),
      can_view_contracts=coalesce((v_member->>'can_view_contracts')::boolean,false),
      can_view_activity_logs=coalesce((v_member->>'can_view_activity_logs')::boolean,false),
      restrict_to_assigned_properties=coalesce((v_member->>'restrict_to_assigned_properties')::boolean,true),
      can_record_payments=coalesce((v_member->>'can_record_payments')::boolean,false),
      can_edit_tenants=coalesce((v_member->>'can_edit_tenants')::boolean,false),
      can_manage_maintenance=coalesce((v_member->>'can_manage_maintenance')::boolean,false),
      can_create_invoices=coalesce((v_member->>'can_create_invoices')::boolean,false),
      can_approve_moveouts=coalesce((v_member->>'can_approve_moveouts')::boolean,false),
      can_send_notices=coalesce((v_member->>'can_send_notices')::boolean,false),
      can_upload_documents=coalesce((v_member->>'can_upload_documents')::boolean,true), updated_at=now()
    WHERE submanager_user_id=p_member_user_id;
  ELSE
    INSERT INTO public.submanager_permissions (manager_id, submanager_user_id, assigned_property_ids,
      can_view_properties, can_view_tenants, can_view_leases, can_view_invoices, can_view_maintenance,
      can_view_contracts, can_view_activity_logs, restrict_to_assigned_properties, can_record_payments,
      can_edit_tenants, can_manage_maintenance, can_create_invoices, can_approve_moveouts, can_send_notices, can_upload_documents)
    VALUES (v_landlord,p_member_user_id,v_props,
      coalesce((v_member->>'can_view_properties')::boolean,true),coalesce((v_member->>'can_view_tenants')::boolean,true),
      coalesce((v_member->>'can_view_leases')::boolean,true),coalesce((v_member->>'can_view_invoices')::boolean,true),
      coalesce((v_member->>'can_view_maintenance')::boolean,true),coalesce((v_member->>'can_view_contracts')::boolean,false),
      coalesce((v_member->>'can_view_activity_logs')::boolean,false),coalesce((v_member->>'restrict_to_assigned_properties')::boolean,true),
      coalesce((v_member->>'can_record_payments')::boolean,false),coalesce((v_member->>'can_edit_tenants')::boolean,false),
      coalesce((v_member->>'can_manage_maintenance')::boolean,false),coalesce((v_member->>'can_create_invoices')::boolean,false),
      coalesce((v_member->>'can_approve_moveouts')::boolean,false),coalesce((v_member->>'can_send_notices')::boolean,false),
      coalesce((v_member->>'can_upload_documents')::boolean,true));
  END IF;

  DELETE FROM public.submanager_property_assignments
   WHERE manager_id = v_landlord AND submanager_user_id = p_member_user_id;
  INSERT INTO public.submanager_property_assignments (manager_id, property_id, submanager_user_id)
  SELECT v_landlord, x, p_member_user_id FROM unnest(v_props) x;

  INSERT INTO public.user_roles (user_id, role, approval_status, tenant_id)
  VALUES (p_member_user_id, 'submanager', 'approved', NULL)
  ON CONFLICT (user_id, role) DO UPDATE SET approval_status = 'approved';
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_landlord_team_member_atomic(p_team_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_landlord uuid := auth.uid(); v_member uuid;
BEGIN
  SELECT member_user_id INTO v_member FROM public.landlord_team_members
   WHERE id = p_team_member_id AND landlord_user_id = v_landlord FOR UPDATE;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Team member not found'; END IF;
  DELETE FROM public.landlord_team_members WHERE id = p_team_member_id;
  DELETE FROM public.submanager_property_assignments WHERE manager_id = v_landlord AND submanager_user_id = v_member;
  DELETE FROM public.submanager_permissions WHERE manager_id = v_landlord AND submanager_user_id = v_member;
  DELETE FROM public.manager_submanagers WHERE manager_id = v_landlord AND submanager_user_id = v_member;
  DELETE FROM public.user_roles WHERE user_id = v_member AND role = 'submanager';
END;
$$;

CREATE OR REPLACE FUNCTION public.save_payment_payer_atomic(p_payer_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tenant uuid; v_manager uuid := auth.uid(); v jsonb := coalesce(p_payload, '{}'::jsonb);
BEGIN
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_tenant := nullif(v->>'tenant_id','')::uuid;
  IF p_payer_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.payment_payers WHERE id = p_payer_id FOR UPDATE;
  END IF;
  IF v_tenant IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = v_tenant AND (
      t.manager_id = v_manager OR EXISTS (
        SELECT 1 FROM public.property_landlords pl WHERE pl.landlord_user_id = v_manager AND pl.property_id = t.property_id
      )
    )
  ) THEN RAISE EXCEPTION 'Tenant access denied'; END IF;

  INSERT INTO public.payment_payers (
    id, tenant_id, manager_id, property_id, unit_id, payer_type, payer_name, payer_email,
    payer_phone, payer_organisation, payer_address, national_id, pays_amount, pays_percentage,
    payment_day, preferred_method, mpesa_number, bank_account, bank_name, standing_order_ref,
    letter_of_undertaking_url, contract_url, is_active, start_date, end_date, notes
  ) VALUES (
    coalesce(p_payer_id, gen_random_uuid()), v_tenant, v_manager,
    nullif(v->>'property_id','')::uuid, nullif(v->>'unit_id','')::uuid,
    coalesce(v->>'payer_type','self'), nullif(v->>'payer_name',''), nullif(v->>'payer_email',''),
    nullif(v->>'payer_phone',''), nullif(v->>'payer_organisation',''), nullif(v->>'payer_address',''),
    nullif(v->>'national_id',''), nullif(v->>'pays_amount','')::numeric, nullif(v->>'pays_percentage','')::numeric,
    nullif(v->>'payment_day','')::integer, coalesce(v->>'preferred_method','mpesa'), nullif(v->>'mpesa_number',''),
    nullif(v->>'bank_account',''), nullif(v->>'bank_name',''), nullif(v->>'standing_order_ref',''),
    nullif(v->>'letter_of_undertaking_url',''), nullif(v->>'contract_url',''), coalesce((v->>'is_active')::boolean,true),
    nullif(v->>'start_date','')::date, nullif(v->>'end_date','')::date, nullif(v->>'notes','')
  )
  ON CONFLICT (id) DO UPDATE SET
    payer_type=EXCLUDED.payer_type, payer_name=EXCLUDED.payer_name, payer_email=EXCLUDED.payer_email,
    payer_phone=EXCLUDED.payer_phone, payer_organisation=EXCLUDED.payer_organisation, payer_address=EXCLUDED.payer_address,
    national_id=EXCLUDED.national_id, pays_amount=EXCLUDED.pays_amount, pays_percentage=EXCLUDED.pays_percentage,
    payment_day=EXCLUDED.payment_day, preferred_method=EXCLUDED.preferred_method, mpesa_number=EXCLUDED.mpesa_number,
    bank_account=EXCLUDED.bank_account, bank_name=EXCLUDED.bank_name, standing_order_ref=EXCLUDED.standing_order_ref,
    letter_of_undertaking_url=EXCLUDED.letter_of_undertaking_url, contract_url=EXCLUDED.contract_url,
    is_active=EXCLUDED.is_active, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
    notes=EXCLUDED.notes, updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_payment_payer_atomic(p_payer_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_manager uuid := auth.uid();
BEGIN
  UPDATE public.payment_payers pp SET is_active = p_active, updated_at = now()
  WHERE pp.id = p_payer_id AND (
    pp.manager_id = v_manager OR EXISTS (
      SELECT 1 FROM public.tenants t JOIN public.property_landlords pl ON pl.property_id = t.property_id
      WHERE t.id = pp.tenant_id AND pl.landlord_user_id = v_manager
    )
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment payer not found or access denied'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_payment_payer_atomic(p_payer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_manager uuid := auth.uid();
BEGIN
  DELETE FROM public.payment_payers pp WHERE pp.id = p_payer_id AND (
    pp.manager_id = v_manager OR EXISTS (
      SELECT 1 FROM public.tenants t JOIN public.property_landlords pl ON pl.property_id = t.property_id
      WHERE t.id = pp.tenant_id AND pl.landlord_user_id = v_manager
    )
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment payer not found or access denied'; END IF;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.landlord_team_members, public.manager_submanagers,
  public.submanager_permissions, public.submanager_property_assignments, public.payment_payers FROM authenticated;

GRANT EXECUTE ON FUNCTION public.save_landlord_team_member_atomic(uuid,text,uuid[],jsonb),
  public.remove_landlord_team_member_atomic(uuid),
  public.save_payment_payer_atomic(uuid,jsonb),
  public.transition_payment_payer_atomic(uuid,boolean),
  public.delete_payment_payer_atomic(uuid) TO authenticated, service_role;

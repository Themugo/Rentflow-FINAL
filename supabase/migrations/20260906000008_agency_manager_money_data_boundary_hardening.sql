-- CALQULUS PMS — Agency + Property Manager end-to-end money/data boundary hardening.
-- Reuses existing payment lifecycle and mandate systems; no parallel ledger/payment path.

CREATE OR REPLACE FUNCTION public.manager_payment_authority_for_property(
  p_manager_id uuid,
  p_property_id uuid,
  p_caller uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_link public.property_landlords%ROWTYPE;
  v_mandate public.manager_management_mandates%ROWTYPE;
  v_is_manager boolean;
BEGIN
  IF p_manager_id IS NULL OR p_property_id IS NULL OR p_caller IS NULL THEN RETURN false; END IF;
  v_is_manager := p_caller = p_manager_id OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    JOIN public.submanager_permissions sp ON sp.manager_id=ms.manager_id AND sp.submanager_user_id=ms.submanager_user_id
    WHERE ms.manager_id=p_manager_id AND ms.submanager_user_id=p_caller
      AND COALESCE(sp.can_record_payments,false)=true
      AND (COALESCE(sp.restrict_to_assigned_properties,true)=false OR p_property_id=ANY(COALESCE(sp.assigned_property_ids,'{}'::uuid[])))
  );
  IF NOT v_is_manager THEN RETURN false; END IF;

  SELECT * INTO v_link
  FROM public.property_landlords
  WHERE manager_id=p_manager_id AND property_id=p_property_id
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  -- Legacy relationships remain operational until explicitly governed by a mandate.
  IF v_link.id IS NULL THEN
    RETURN EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=p_manager_id);
  END IF;

  SELECT * INTO v_mandate
  FROM public.manager_management_mandates
  WHERE property_landlord_id=v_link.id AND mandate_status='active'
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_mandate.id IS NULL THEN RETURN true; END IF;
  RETURN COALESCE(v_mandate.manager_can_collect,false);
END;
$$;

ALTER FUNCTION public.process_payment_atomic(uuid,uuid,numeric,text,date,text,uuid,uuid[],uuid,uuid,text,text,uuid,text,uuid) RENAME TO process_payment_atomic_core;
-- Payment processing is canonical. Tenant/service-role flows remain valid; manager
-- and submanager callers are additionally constrained by the active management mandate.
CREATE OR REPLACE FUNCTION public.process_payment_atomic(
  p_tenant_id uuid, p_manager_id uuid, p_amount numeric, p_payment_method text,
  p_payment_date date, p_reference text, p_invoice_id uuid DEFAULT NULL,
  p_invoice_ids uuid[] DEFAULT NULL, p_unit_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL, p_unit_number text DEFAULT NULL,
  p_phone text DEFAULT NULL, p_recorded_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL, p_existing_transaction_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_property uuid := p_property_id;
  v_caller uuid := auth.uid();
  v_is_service boolean := auth.role()='service_role';
  v_is_tenant boolean := false;
  v_is_manager boolean := false;
  v_is_submanager boolean := false;
BEGIN
  IF v_caller IS NULL AND NOT v_is_service THEN RAISE EXCEPTION 'Unauthenticated payment processing' USING ERRCODE='28000'; END IF;
  IF v_property IS NULL AND p_invoice_id IS NOT NULL THEN
    SELECT property_id INTO v_property FROM public.invoices WHERE id=p_invoice_id;
  END IF;
  IF v_property IS NULL THEN
    SELECT property_id INTO v_property FROM public.tenants WHERE id=p_tenant_id;
  END IF;

  IF NOT v_is_service THEN
    v_is_tenant := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_caller AND tenant_id=p_tenant_id AND role='tenant') OR v_caller=p_tenant_id;
    v_is_manager := v_caller=p_manager_id;
    v_is_submanager := EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      JOIN public.submanager_permissions sp ON sp.manager_id=ms.manager_id AND sp.submanager_user_id=ms.submanager_user_id
      WHERE ms.manager_id=p_manager_id AND ms.submanager_user_id=v_caller
        AND COALESCE(sp.can_record_payments,false)=true
        AND (COALESCE(sp.restrict_to_assigned_properties,true)=false OR v_property=ANY(COALESCE(sp.assigned_property_ids,'{}'::uuid[])))
    );
    IF v_is_manager OR v_is_submanager THEN
      IF NOT public.manager_payment_authority_for_property(p_manager_id,v_property,v_caller) THEN
        RAISE EXCEPTION 'Manager mandate does not permit payment collection for this property' USING ERRCODE='42501';
      END IF;
    ELSIF NOT v_is_tenant THEN
      RAISE EXCEPTION 'Unauthorized payment processing attempt' USING ERRCODE='42501';
    END IF;
  END IF;

  -- Delegate to the renamed existing canonical implementation; this wrapper only adds the authority gate.
  RETURN public.process_payment_atomic_core(
    p_tenant_id,p_manager_id,p_amount,p_payment_method,p_payment_date,p_reference,
    p_invoice_id,p_invoice_ids,p_unit_id,p_property_id,p_unit_number,p_phone,
    p_recorded_by,p_notes,p_existing_transaction_id
  );
END;
$$;

-- The previous canonical implementation is renamed above; no second payment engine is created.
REVOKE ALL ON FUNCTION public.manager_payment_authority_for_property(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_payment_authority_for_property(uuid,uuid,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.process_payment_atomic(uuid,uuid,numeric,text,date,text,uuid,uuid[],uuid,uuid,text,text,uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payment_atomic(uuid,uuid,numeric,text,date,text,uuid,uuid[],uuid,uuid,text,text,uuid,text,uuid) TO authenticated, service_role;

-- Physical receipts are a separate document-capture surface but still represent
-- money received. Apply the same manager mandate boundary before a receipt exists.
CREATE OR REPLACE FUNCTION public.guard_manager_physical_receipt_collection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role()='service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT public.manager_payment_authority_for_property(NEW.manager_id,NEW.property_id,auth.uid()) THEN
    RAISE EXCEPTION 'Manager mandate does not permit payment collection for this property' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_manager_physical_receipt_collection ON public.physical_receipts;
CREATE TRIGGER guard_manager_physical_receipt_collection
BEFORE INSERT OR UPDATE OF manager_id,property_id,tenant_id,amount ON public.physical_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_manager_physical_receipt_collection();

REVOKE ALL ON FUNCTION public.guard_manager_physical_receipt_collection() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_manager_physical_receipt_collection() TO authenticated, service_role;

COMMENT ON FUNCTION public.manager_payment_authority_for_property(uuid,uuid,uuid) IS
  'Canonical manager/submanager collection authority: active mandate wins; legacy relationships remain compatible until a mandate explicitly restricts collection.';

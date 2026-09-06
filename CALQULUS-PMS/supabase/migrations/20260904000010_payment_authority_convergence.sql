-- CALQULUS PMS — Payment authority convergence
-- One source of truth for payment destinations exposed to occupants, managers and payment initiation.

ALTER TABLE public.payment_collection_accounts
  ADD COLUMN IF NOT EXISTS account_reference text;

CREATE INDEX IF NOT EXISTS pca_property_unit_active_idx
  ON public.payment_collection_accounts(property_id,unit_id,is_active,priority);

DROP POLICY IF EXISTS pca_management_read ON public.payment_collection_accounts;
CREATE POLICY pca_management_read ON public.payment_collection_accounts
  FOR SELECT TO authenticated
  USING (
    manager_id = auth.uid()
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = payment_collection_accounts.property_id
          AND (
            p.manager_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.manager_submanagers ms
              WHERE ms.manager_id = p.manager_id
                AND ms.submanager_user_id = auth.uid()
            )
          )
      )
    )
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.property_landlords pl
        WHERE pl.property_id = payment_collection_accounts.property_id
          AND pl.landlord_user_id = auth.uid()
      )
    )
    OR (
      agency_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.agency_members am
        WHERE am.agency_id = payment_collection_accounts.agency_id
          AND am.member_user_id = auth.uid()
          AND am.is_active
      )
    )
  );

CREATE OR REPLACE FUNCTION public.save_payment_collection_account_atomic(p_id uuid, p_payload jsonb)
RETURNS public.payment_collection_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.payment_collection_accounts%ROWTYPE;
  v_uid uuid:=auth.uid();
  v_property uuid:=NULLIF(p_payload->>'property_id','')::uuid;
  v_unit uuid:=NULLIF(p_payload->>'unit_id','')::uuid;
  v_agency uuid:=NULLIF(p_payload->>'agency_id','')::uuid;
  v_landlord uuid:=NULLIF(p_payload->>'landlord_user_id','')::uuid;
  v_lease uuid:=NULLIF(p_payload->>'lease_id','')::uuid;
  v_tenant uuid:=NULLIF(p_payload->>'tenant_id','')::uuid;
  v_method text:=COALESCE(p_payload->>'payment_method','');
  v_id uuid:=COALESCE(p_id,gen_random_uuid());
  v_account_reference text:=NULLIF(trim(p_payload->>'account_reference'),'');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  IF v_unit IS NOT NULL THEN
    SELECT property_id INTO v_property FROM public.units WHERE id=v_unit;
    IF v_property IS NULL THEN RAISE EXCEPTION 'Unit not found' USING ERRCODE='P0002'; END IF;
  END IF;

  IF v_property IS NULL AND v_agency IS NULL AND v_uid IS NULL THEN
    RAISE EXCEPTION 'A property, unit or agency scope is required' USING ERRCODE='22023';
  END IF;

  IF v_agency IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=v_agency) THEN
    RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002';
  END IF;

  IF v_property IS NOT NULL AND v_agency IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.properties p JOIN public.manager_profiles mp ON mp.manager_user_id=p.manager_id WHERE p.id=v_property AND mp.agency_id=v_agency) THEN
    RAISE EXCEPTION 'Agency is not assigned to this property' USING ERRCODE='42501';
  END IF;

  IF v_property IS NOT NULL AND NOT public.can_manage_payment_scope(v_property,v_unit,v_agency,v_landlord) THEN
    RAISE EXCEPTION 'Payment configuration scope unauthorized' USING ERRCODE='42501';
  END IF;

  IF v_property IS NULL AND v_agency IS NOT NULL AND NOT public.can_manage_payment_scope(NULL,NULL,v_agency,NULL) THEN
    RAISE EXCEPTION 'Agency payment configuration unauthorized' USING ERRCODE='42501';
  END IF;

  IF v_property IS NULL AND v_agency IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.manager_id=v_uid
  ) THEN
    RAISE EXCEPTION 'Payment configuration scope unauthorized' USING ERRCODE='42501';
  END IF;

  IF v_landlord IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.property_landlords pl
    WHERE pl.property_id=v_property AND pl.landlord_user_id=v_landlord
  ) THEN
    RAISE EXCEPTION 'Payment owner is not linked to this property' USING ERRCODE='42501';
  END IF;

  IF v_method NOT IN ('mpesa_paybill','mpesa_till','bank_transfer','cash') THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE='22023';
  END IF;
  IF v_method='mpesa_paybill' AND NULLIF(trim(p_payload->>'paybill_number'),'') IS NULL THEN
    RAISE EXCEPTION 'Paybill number is required' USING ERRCODE='22023';
  END IF;
  IF v_method='mpesa_till' AND NULLIF(trim(p_payload->>'till_number'),'') IS NULL THEN
    RAISE EXCEPTION 'Till number is required' USING ERRCODE='22023';
  END IF;
  IF v_method='bank_transfer' AND (
    NULLIF(trim(p_payload->>'bank_name'),'') IS NULL
    OR NULLIF(trim(p_payload->>'bank_account_number'),'') IS NULL
  ) THEN
    RAISE EXCEPTION 'Bank name and account number are required' USING ERRCODE='22023';
  END IF;

  IF v_unit IS NOT NULL AND (v_lease IS NOT NULL OR v_tenant IS NOT NULL) THEN
    RAISE EXCEPTION 'Unit routing cannot be combined with tenancy-specific routing' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.payment_collection_accounts(
    id,agency_id,manager_id,landlord_user_id,property_id,unit_id,lease_id,tenant_id,
    account_label,account_reference,payment_method,paybill_number,till_number,
    bank_name,bank_account_name,bank_account_number,bank_branch,payment_instructions,
    is_default,priority,is_active
  ) VALUES (
    v_id,v_agency,
    COALESCE((SELECT manager_id FROM public.properties WHERE id=v_property),v_uid),
    v_landlord,v_property,v_unit,v_lease,v_tenant,
    COALESCE(NULLIF(trim(p_payload->>'account_label'),''),'Rent collection'),
    v_account_reference,
    v_method,NULLIF(trim(p_payload->>'paybill_number'),''),NULLIF(trim(p_payload->>'till_number'),''),
    NULLIF(trim(p_payload->>'bank_name'),''),NULLIF(trim(p_payload->>'bank_account_name'),''),
    NULLIF(trim(p_payload->>'bank_account_number'),''),NULLIF(trim(p_payload->>'bank_branch'),''),
    NULLIF(trim(p_payload->>'payment_instructions'),''),
    COALESCE((p_payload->>'is_default')::boolean,false),
    COALESCE((p_payload->>'priority')::int,100),
    COALESCE((p_payload->>'is_active')::boolean,true)
  )
  ON CONFLICT(id) DO UPDATE SET
    agency_id=EXCLUDED.agency_id,
    manager_id=EXCLUDED.manager_id,
    landlord_user_id=EXCLUDED.landlord_user_id,
    property_id=EXCLUDED.property_id,
    unit_id=EXCLUDED.unit_id,
    lease_id=EXCLUDED.lease_id,
    tenant_id=EXCLUDED.tenant_id,
    account_label=EXCLUDED.account_label,
    account_reference=EXCLUDED.account_reference,
    payment_method=EXCLUDED.payment_method,
    paybill_number=EXCLUDED.paybill_number,
    till_number=EXCLUDED.till_number,
    bank_name=EXCLUDED.bank_name,
    bank_account_name=EXCLUDED.bank_account_name,
    bank_account_number=EXCLUDED.bank_account_number,
    bank_branch=EXCLUDED.bank_branch,
    payment_instructions=EXCLUDED.payment_instructions,
    is_default=EXCLUDED.is_default,
    priority=EXCLUDED.priority,
    is_active=EXCLUDED.is_active,
    updated_at=now()
  RETURNING * INTO v;

  IF v.is_default THEN
    UPDATE public.payment_collection_accounts SET is_default=false,updated_at=now()
    WHERE id<>v.id AND is_active
      AND (
        CASE
          WHEN v.unit_id IS NOT NULL THEN unit_id=v.unit_id AND lease_id IS NULL AND tenant_id IS NULL
          WHEN v.property_id IS NOT NULL THEN property_id=v.property_id AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL
          WHEN v.agency_id IS NOT NULL THEN agency_id=v.agency_id AND property_id IS NULL AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL
          ELSE false
        END
      );
  END IF;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_payment_collection_account_atomic(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tenant_payment_routes()
RETURNS TABLE(
  tenant_id uuid,
  lease_id uuid,
  unit_id uuid,
  unit_number text,
  property_id uuid,
  property_name text,
  payment_account_id uuid,
  account_label text,
  account_reference text,
  payment_method text,
  paybill_number text,
  till_number text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  payment_instructions text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT ur.tenant_id INTO v_tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id=auth.uid() AND ur.role='tenant'
  LIMIT 1;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;

  RETURN QUERY
  SELECT
    l.tenant_id,
    l.id,
    COALESCE(l.unit_id,t.unit_id),
    u.unit_number,
    l.property_id,
    p.name,
    a.id,
    a.account_label,
    COALESCE(a.account_reference,u.unit_number),
    a.payment_method,
    a.paybill_number,
    a.till_number,
    a.bank_name,
    a.bank_account_name,
    a.bank_account_number,
    a.bank_branch,
    a.payment_instructions
  FROM public.leases l
  JOIN public.properties p ON p.id=l.property_id
  LEFT JOIN public.tenants t ON t.id=l.tenant_id
  LEFT JOIN public.units u ON u.id=COALESCE(l.unit_id,t.unit_id)
  LEFT JOIN LATERAL (
    SELECT a.*,
      CASE
        WHEN a.tenant_id=l.tenant_id AND a.lease_id=l.id THEN 1
        WHEN a.lease_id=l.id THEN 2
        WHEN a.unit_id=COALESCE(l.unit_id,t.unit_id) THEN 3
        WHEN a.property_id=l.property_id THEN 4
        WHEN a.agency_id=(SELECT mp.agency_id FROM public.manager_profiles mp WHERE mp.manager_user_id=p.manager_id LIMIT 1) AND a.property_id IS NULL THEN 5
        WHEN a.landlord_user_id=COALESCE(l.billing_landlord_user_id,(SELECT pl.landlord_user_id FROM public.property_landlords pl WHERE pl.property_id=l.property_id ORDER BY pl.revenue_share_pct DESC NULLS LAST LIMIT 1)) THEN 6
        WHEN a.manager_id=p.manager_id THEN 7
        ELSE 99
      END AS route_rank
    FROM public.payment_collection_accounts a
    WHERE a.is_active
      AND (
        a.tenant_id=l.tenant_id
        OR a.lease_id=l.id
        OR a.unit_id=COALESCE(l.unit_id,t.unit_id)
        OR a.property_id=l.property_id
        OR (a.agency_id=(SELECT mp.agency_id FROM public.manager_profiles mp WHERE mp.manager_user_id=p.manager_id LIMIT 1) AND a.property_id IS NULL)
        OR a.landlord_user_id=COALESCE(l.billing_landlord_user_id,(SELECT pl.landlord_user_id FROM public.property_landlords pl WHERE pl.property_id=l.property_id ORDER BY pl.revenue_share_pct DESC NULLS LAST LIMIT 1))
        OR (a.manager_id=p.manager_id AND a.property_id IS NULL AND a.unit_id IS NULL AND a.lease_id IS NULL AND a.tenant_id IS NULL)
      )
    ORDER BY route_rank, CASE WHEN a.is_default THEN 0 ELSE 1 END, a.priority, a.created_at
    LIMIT 1
  ) a ON true
  WHERE l.tenant_id=v_tenant_id
    AND l.status='active'
    AND l.archived_at IS NULL
  ORDER BY p.name,u.unit_number;
END $$;
GRANT EXECUTE ON FUNCTION public.get_tenant_payment_routes() TO authenticated;

COMMENT ON COLUMN public.payment_collection_accounts.account_reference IS
  'Reference occupants should enter when paying this configured destination; defaults to the unit number when omitted.';
COMMENT ON FUNCTION public.get_tenant_payment_routes() IS
  'Returns only the authenticated tenant''s active unit/lease payment destinations from the canonical payment routing hierarchy.';

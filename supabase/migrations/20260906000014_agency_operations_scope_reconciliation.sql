-- Agency Operations Desk scope reconciliation
-- Ensures agency members can read the agency-owned operating book through
-- server-side, membership-validated snapshots instead of manager-only RLS paths.

CREATE OR REPLACE FUNCTION public.get_agency_portfolio_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agency uuid;
  v_manager uuid;
  v_authorized boolean := false;
  v_landlord_ids uuid[] := ARRAY[]::uuid[];
  v_properties jsonb;
  v_links jsonb;
  v_invoices jsonb;
  v_tenants jsonb;
  v_profiles jsonb;
  v_expiring integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  v_agency := public.agency_id_for_user(v_uid);
  IF v_agency IS NULL THEN
    RAISE EXCEPTION 'Agency membership required' USING ERRCODE='42501';
  END IF;

  SELECT a.manager_id
    INTO v_manager
  FROM public.agencies a
  WHERE a.id = v_agency;

  IF v_manager IS NULL THEN
    RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002';
  END IF;

  v_authorized := v_manager = v_uid
    OR EXISTS (
      SELECT 1
      FROM public.agency_members am
      WHERE am.agency_id = v_agency
        AND am.member_user_id = v_uid
        AND am.is_active
    );

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Agency access denied' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT pl.landlord_user_id) FILTER (WHERE pl.landlord_user_id IS NOT NULL), ARRAY[]::uuid[])
    INTO v_landlord_ids
  FROM public.property_landlords pl
  WHERE pl.manager_id = v_manager;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.name), '[]'::jsonb)
    INTO v_properties
  FROM (
    SELECT id, name, address, units, occupied
    FROM public.properties
    WHERE manager_id = v_manager
  ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(pl)), '[]'::jsonb)
    INTO v_links
  FROM public.property_landlords pl
  WHERE pl.manager_id = v_manager;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    INTO v_invoices
  FROM (
    SELECT property_id, amount, paid_amount, balance_due, status, paid_date, due_date
    FROM public.invoices
    WHERE manager_id = v_manager
  ) i;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_tenants
  FROM (
    SELECT id, property_id
    FROM public.tenants
    WHERE manager_id = v_manager
      AND status = 'active'
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(pr)), '[]'::jsonb)
    INTO v_profiles
  FROM (
    SELECT id, full_name, email
    FROM public.profiles
    WHERE id = ANY(v_landlord_ids)
  ) pr;

  SELECT count(*)
    INTO v_expiring
  FROM public.leases l
  WHERE l.manager_id = v_manager
    AND l.status = 'active'
    AND l.end_date <= (CURRENT_DATE + 30);

  RETURN jsonb_build_object(
    'agency_id', v_agency,
    'manager_id', v_manager,
    'properties', v_properties,
    'links', v_links,
    'invoices', v_invoices,
    'tenants', v_tenants,
    'profiles', v_profiles,
    'expiring_leases', v_expiring
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_activity_log(p_limit integer DEFAULT 8, p_landlord_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agency uuid;
  v_manager uuid;
  v_can_view boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  v_agency := public.agency_id_for_user(v_uid);
  IF v_agency IS NULL THEN
    RAISE EXCEPTION 'Agency membership required' USING ERRCODE='42501';
  END IF;

  SELECT a.manager_id INTO v_manager
  FROM public.agencies a
  WHERE a.id = v_agency;

  v_can_view := v_manager = v_uid
    OR EXISTS (
      SELECT 1
      FROM public.agency_members am
      WHERE am.agency_id = v_agency
        AND am.member_user_id = v_uid
        AND am.is_active
        AND (
          lower(am.role_in_agency) IN ('owner','admin','manager')
          OR COALESCE((am.permissions ->> 'can_view_activity_logs')::boolean, false)
        )
    );

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'Agency activity permission required' USING ERRCODE='42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, created_at
      FROM public.activity_logs al
      WHERE al.manager_id = v_manager
        AND (p_landlord_user_id IS NULL OR al.property_id IN (SELECT pl.property_id FROM public.property_landlords pl WHERE pl.manager_id = v_manager AND pl.landlord_user_id = p_landlord_user_id))
      ORDER BY created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 50)
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_agency_portfolio_snapshot() FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.get_agency_member_profiles()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agency uuid;
  v_manager uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_agency := public.agency_id_for_user(v_uid);
  IF v_agency IS NULL THEN RAISE EXCEPTION 'Agency membership required' USING ERRCODE='42501'; END IF;
  SELECT manager_id INTO v_manager FROM public.agencies WHERE id=v_agency;
  IF NOT (v_manager=v_uid OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=v_agency AND am.member_user_id=v_uid AND am.is_active)) THEN
    RAISE EXCEPTION 'Agency access denied' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email) ORDER BY p.full_name NULLS LAST,p.email NULLS LAST)
    FROM public.profiles p
    WHERE p.id IN (SELECT am.member_user_id FROM public.agency_members am WHERE am.agency_id=v_agency AND am.is_active)
       OR p.id=v_manager
  ), '[]'::jsonb);
END;
$$;


CREATE OR REPLACE FUNCTION public.get_agency_payment_invoice_options(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT a.manager_id INTO v_manager FROM public.agencies a WHERE a.id=p_agency_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002'; END IF;
  IF NOT (v_manager=v_uid OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=p_agency_id AND am.member_user_id=v_uid AND am.is_active)) THEN
    RAISE EXCEPTION 'Agency access denied' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.due_date ASC)
    FROM (
      SELECT i.id,i.invoice_number,i.amount,i.balance_due,i.tenant_id,i.property_id,i.unit_id,i.due_date,i.status
      FROM public.invoices i
      WHERE i.manager_id=v_manager
        AND i.status IN ('pending','overdue','partially_paid')
      ORDER BY i.due_date ASC
      LIMIT 250
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_agency_activity_log(integer,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agency_member_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agency_payment_invoice_options(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agency_portfolio_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_activity_log(integer,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_member_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_payment_invoice_options(uuid) TO authenticated, service_role;

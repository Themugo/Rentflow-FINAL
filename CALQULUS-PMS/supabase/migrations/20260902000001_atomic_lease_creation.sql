-- CALQULUS Phase 2: Atomic lease creation
-- Purpose: make lease creation one transaction across lease, tenant, unit and
-- tenant payment details. Client-supplied manager_id is never trusted.
--
-- Golden path:
--   manager/submanager -> property -> tenant -> unit -> lease
-- All writes below commit together or roll back together.

CREATE OR REPLACE FUNCTION public.create_lease_atomic(
  p_tenant_id uuid,
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_unit text DEFAULT '',
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_monthly_rent numeric DEFAULT NULL,
  p_deposit numeric DEFAULT NULL,
  p_terms text DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_manager_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_manager_id uuid;
  v_lease_id uuid;
  v_property_name text;
  v_unit_number text;
  v_tenant_manager_id uuid;
  v_unit_property_id uuid;
  v_existing_active_lease uuid;
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
  END IF;

  -- Resolve the real manager. A submanager may act only for their assigned manager.
  IF auth.role() = 'service_role' THEN
    v_manager_id := p_manager_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_auth_user AND ur.role = 'manager'
    ) THEN
      v_manager_id := v_auth_user;
    ELSE
      RAISE EXCEPTION 'Unauthorized: only managers can create leases'
        USING ERRCODE = '42501';
    END IF;


    IF p_manager_id IS NOT NULL AND p_manager_id <> v_manager_id THEN
      RAISE EXCEPTION 'Unauthorized: manager mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_manager_id IS NULL THEN
    RAISE EXCEPTION 'Manager is required' USING ERRCODE = '22023';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid lease dates' USING ERRCODE = '22023';
  END IF;

  IF p_monthly_rent IS NULL OR p_monthly_rent < 0 THEN
    RAISE EXCEPTION 'Monthly rent must be zero or greater' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(trim(p_status), ''), 'pending') NOT IN
     ('draft', 'pending', 'active', 'expired', 'terminated') THEN
    RAISE EXCEPTION 'Invalid lease status' USING ERRCODE = '22023';
  END IF;

  IF p_deposit IS NOT NULL AND p_deposit < 0 THEN
    RAISE EXCEPTION 'Deposit must be zero or greater' USING ERRCODE = '22023';
  END IF;

  -- Lock the property row for the duration of this transaction.
  SELECT p.name
  INTO v_property_name
  FROM public.properties p
  WHERE p.id = p_property_id
    AND p.manager_id = v_manager_id
  FOR UPDATE;

  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property does not belong to this manager' USING ERRCODE = '42501';
  END IF;

  -- Tenant must belong to the same manager and property.
  SELECT t.manager_id
  INTO v_tenant_manager_id
  FROM public.tenants t
  WHERE t.id = p_tenant_id
    AND t.manager_id = v_manager_id
    AND t.property_id = p_property_id
  FOR UPDATE;

  IF v_tenant_manager_id IS NULL THEN
    RAISE EXCEPTION 'Tenant does not belong to this manager and property' USING ERRCODE = '42501';
  END IF;

  IF p_unit_id IS NOT NULL THEN
    -- Serialize lease claims for the same unit so concurrent requests cannot
    -- both pass the overlap check.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_unit_id::text, 20260902));

    SELECT u.property_id, u.unit_number
    INTO v_unit_property_id, v_unit_number
    FROM public.units u
    WHERE u.id = p_unit_id
      AND u.property_id = p_property_id
    FOR UPDATE;

    IF v_unit_property_id IS NULL THEN
      RAISE EXCEPTION 'Unit does not belong to the selected property' USING ERRCODE = '42501';
    END IF;

    -- Prevent two live leases from claiming the same unit.
    SELECT l.id
    INTO v_existing_active_lease
    FROM public.leases l
    WHERE l.unit_id = p_unit_id
      AND l.status IN ('pending', 'active')
      AND (p_end_date IS NULL OR l.end_date >= p_start_date)
      AND l.start_date <= p_end_date
    LIMIT 1
    FOR UPDATE;

    IF v_existing_active_lease IS NOT NULL THEN
      RAISE EXCEPTION 'Unit already has an overlapping pending or active lease'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    v_unit_number := COALESCE(NULLIF(trim(p_unit), ''), '');
  END IF;

  INSERT INTO public.leases (
    tenant_id, property_id, unit_id, manager_id,
    property, unit, start_date, end_date,
    monthly_rent, deposit, terms, status
  )
  VALUES (
    p_tenant_id, p_property_id, p_unit_id, v_manager_id,
    v_property_name, COALESCE(NULLIF(trim(p_unit), ''), v_unit_number),
    p_start_date, p_end_date,
    p_monthly_rent, COALESCE(p_deposit, p_monthly_rent * 2),
    NULLIF(trim(p_terms), ''), COALESCE(NULLIF(trim(p_status), ''), 'pending')
  )
  RETURNING id INTO v_lease_id;

  -- Keep the tenant's denormalized occupancy/billing fields in the same transaction.
  UPDATE public.tenants
  SET
    property_id = p_property_id,
    property = v_property_name,
    unit_id = p_unit_id,
    unit = COALESCE(NULLIF(trim(p_unit), ''), v_unit_number),
    monthly_rent = p_monthly_rent,
    deposit_amount = COALESCE(p_deposit, p_monthly_rent * 2),
    deposit_balance = COALESCE(p_deposit, p_monthly_rent * 2),
    updated_at = now()
  WHERE id = p_tenant_id;

  IF p_unit_id IS NOT NULL THEN
    UPDATE public.units
    SET status = CASE
                   WHEN COALESCE(NULLIF(trim(p_status), ''), 'pending') = 'active'
                     THEN 'occupied'
                   ELSE status
                 END,
        monthly_rent = p_monthly_rent,
        updated_at = now()
    WHERE id = p_unit_id;
  END IF;

  PERFORM public.sync_tenant_payment_details(
    p_tenant_id,
    v_manager_id,
    p_property_id,
    p_unit_id,
    p_monthly_rent,
    COALESCE(p_deposit, p_monthly_rent * 2),
    NULL, NULL, NULL, 1, NULL,
    COALESCE(NULLIF(trim(p_unit), ''), v_unit_number),
    'standard'
  );

  RETURN v_lease_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lease_atomic(
  uuid, uuid, uuid, text, date, date, numeric, numeric, text, text, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_lease_atomic(
  uuid, uuid, uuid, text, date, date, numeric, numeric, text, text, uuid
) TO authenticated, service_role;

-- Lease creation is now a server-side transaction. Prevent authenticated
-- clients from bypassing it with direct INSERTs.
REVOKE INSERT ON TABLE public.leases FROM authenticated;

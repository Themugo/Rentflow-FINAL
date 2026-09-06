-- CALQULUS PMS — Property & Tenancy Operations Ecosystem
--
-- Establishes one authoritative operational state machine across:
--   property -> unit -> tenant -> lease -> tenancy history
--
-- The existing UI is retained. These RPCs make the lifecycle transactional so
-- a successful operation cannot leave the tenant, lease, unit and property
-- counters disagreeing with one another.

-- ---------------------------------------------------------------------------
-- Shared manager scope helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_property_scope(p_manager_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'manager'
      AND ur.approval_status = 'approved'
  ) AND auth.uid() = p_manager_id
  OR EXISTS (
    SELECT 1
    FROM public.manager_submanagers ms
    WHERE ms.manager_id = p_manager_id
      AND ms.submanager_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_property_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_property_scope(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authoritative property occupancy/revenue projection
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_property_occupancy_atomic(p_property_id uuid)
RETURNS public.properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
BEGIN
  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.properties p
  SET
    units = (
      SELECT count(*)::numeric
      FROM public.units u
      WHERE u.property_id = p.id
        AND u.status <> 'inactive'
    ),
    occupied = (
      SELECT count(*)::numeric
      FROM public.units u
      WHERE u.property_id = p.id
        AND u.status = 'occupied'
    ),
    revenue = (
      SELECT COALESCE(sum(l.monthly_rent), 0)
      FROM public.leases l
      WHERE l.property_id = p.id
        AND l.status = 'active'
        AND l.archived_at IS NULL
    ),
    updated_at = now()
  WHERE p.id = p_property_id
  RETURNING * INTO v_property;

  RETURN v_property;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_property_occupancy_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_property_occupancy_atomic(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Lease lifecycle: lease + tenant + unit + tenancy history + property
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_lease_atomic(
  p_lease_id uuid,
  p_target_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_tenant public.tenants%ROWTYPE;
  v_unit public.units%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_manager uuid;
  v_other_active uuid;
  v_other_tenancy uuid;
  v_tenancy_id uuid;
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
  END IF;

  IF p_target_status NOT IN ('draft', 'pending', 'active', 'expired', 'terminated') THEN
    RAISE EXCEPTION 'Invalid lease status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lease
  FROM public.leases
  WHERE id = p_lease_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease not found' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() = 'service_role' THEN
    v_manager := v_lease.manager_id;
  ELSE
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_uid AND role = 'manager'
      ) THEN v_uid
      ELSE (
        SELECT ms.manager_id
        FROM public.manager_submanagers ms
        WHERE ms.submanager_user_id = v_uid
        LIMIT 1
      )
    END INTO v_manager;

    IF v_manager IS NULL OR v_lease.manager_id IS DISTINCT FROM v_manager THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_lease.status = p_target_status THEN
    RETURN jsonb_build_object('id', v_lease.id, 'status', v_lease.status, 'idempotent', true);
  END IF;

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = v_lease.property_id
  FOR UPDATE;

  IF NOT FOUND OR v_property.manager_id IS DISTINCT FROM v_manager THEN
    RAISE EXCEPTION 'Lease property is outside manager scope' USING ERRCODE = '42501';
  END IF;

  IF v_lease.tenant_id IS NOT NULL THEN
    SELECT * INTO v_tenant
    FROM public.tenants
    WHERE id = v_lease.tenant_id
    FOR UPDATE;

    IF NOT FOUND OR v_tenant.manager_id IS DISTINCT FROM v_manager
       OR v_tenant.property_id IS DISTINCT FROM v_lease.property_id THEN
      RAISE EXCEPTION 'Lease tenant is outside property scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_lease.unit_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lease.unit_id::text, 20260904));

    SELECT * INTO v_unit
    FROM public.units
    WHERE id = v_lease.unit_id
      AND property_id = v_lease.property_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lease unit does not belong to lease property' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_target_status = 'active' THEN
    IF v_lease.tenant_id IS NULL OR v_lease.property_id IS NULL OR v_lease.unit_id IS NULL THEN
      RAISE EXCEPTION 'An active lease requires tenant, property and unit' USING ERRCODE = '22023';
    END IF;

    IF v_unit.status = 'inactive' THEN
      RAISE EXCEPTION 'Inactive unit cannot be occupied' USING ERRCODE = '55000';
    END IF;

    SELECT id INTO v_other_active
    FROM public.leases
    WHERE unit_id = v_lease.unit_id
      AND id <> v_lease.id
      AND status = 'active'
      AND archived_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_other_active IS NOT NULL THEN
      RAISE EXCEPTION 'Unit already has another active lease' USING ERRCODE = '23505';
    END IF;

    SELECT id INTO v_other_tenancy
    FROM public.unit_tenancy_history
    WHERE unit_id = v_lease.unit_id
      AND status = 'active'
      AND tenant_id <> v_lease.tenant_id
    LIMIT 1
    FOR UPDATE;

    IF v_other_tenancy IS NOT NULL THEN
      RAISE EXCEPTION 'Unit already has another active tenancy' USING ERRCODE = '23505';
    END IF;

    SELECT id INTO v_other_active
    FROM public.leases
    WHERE tenant_id = v_lease.tenant_id
      AND id <> v_lease.id
      AND status = 'active'
      AND archived_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_other_active IS NOT NULL THEN
      RAISE EXCEPTION 'Tenant already has another active lease' USING ERRCODE = '23505';
    END IF;

    SELECT id INTO v_tenancy_id
    FROM public.unit_tenancy_history
    WHERE unit_id = v_lease.unit_id
      AND tenant_id = v_lease.tenant_id
      AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    IF v_tenancy_id IS NULL THEN
      INSERT INTO public.unit_tenancy_history (
        unit_id, property_id, manager_id, tenant_id,
        tenant_name, tenant_email, tenant_phone,
        move_in_date, monthly_rent, deposit_paid, status
      ) VALUES (
        v_lease.unit_id, v_lease.property_id, v_manager, v_lease.tenant_id,
        v_tenant.name, v_tenant.email, v_tenant.phone,
        v_lease.start_date, v_lease.monthly_rent, COALESCE(v_lease.deposit, 0), 'active'
      )
      RETURNING id INTO v_tenancy_id;
    ELSE
      UPDATE public.unit_tenancy_history
      SET property_id = v_lease.property_id,
          manager_id = v_manager,
          tenant_name = v_tenant.name,
          tenant_email = v_tenant.email,
          tenant_phone = v_tenant.phone,
          move_in_date = v_lease.start_date,
          monthly_rent = v_lease.monthly_rent,
          deposit_paid = COALESCE(v_lease.deposit, deposit_paid, 0),
          move_out_date = NULL,
          archived_at = NULL,
          archived_by = NULL,
          updated_at = now()
      WHERE id = v_tenancy_id;
    END IF;

    UPDATE public.leases
    SET status = 'active', archived_at = NULL, archived_by = NULL, updated_at = now()
    WHERE id = v_lease.id;

    UPDATE public.tenants
    SET status = 'active',
        property_id = v_lease.property_id,
        property = v_property.name,
        unit_id = v_lease.unit_id,
        unit = v_unit.unit_number,
        monthly_rent = v_lease.monthly_rent,
        move_in_date = v_lease.start_date,
        updated_at = now()
    WHERE id = v_lease.tenant_id;

    UPDATE public.units
    SET status = 'occupied', monthly_rent = v_lease.monthly_rent, updated_at = now()
    WHERE id = v_lease.unit_id;

    INSERT INTO public.unit_activity_log (
      unit_id, property_id, tenancy_id, tenant_id, triggered_by, triggered_by_role,
      event_type, title, description, reference_id, reference_type
    ) VALUES (
      v_lease.unit_id, v_lease.property_id, v_tenancy_id, v_lease.tenant_id, v_uid,
      CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE 'manager' END,
      'lease_created', 'Lease activated',
      'Lease activated and tenancy opened; unit marked occupied.',
      v_lease.id, 'lease'
    );
  ELSE
    UPDATE public.leases
    SET status = p_target_status,
        moved_out_at = CASE WHEN p_target_status IN ('terminated', 'expired') THEN COALESCE(moved_out_at, now()) ELSE moved_out_at END,
        archived_at = CASE WHEN p_target_status IN ('terminated', 'expired') THEN COALESCE(archived_at, now()) ELSE archived_at END,
        archived_by = CASE WHEN p_target_status IN ('terminated', 'expired') THEN COALESCE(archived_by, v_uid) ELSE archived_by END,
        end_reason = CASE WHEN p_target_status = 'terminated' THEN COALESCE(end_reason, 'terminated')
                          WHEN p_target_status = 'expired' THEN COALESCE(end_reason, 'expired')
                          ELSE end_reason END,
        updated_at = now()
    WHERE id = v_lease.id;

    IF p_target_status IN ('terminated', 'expired') AND v_lease.unit_id IS NOT NULL THEN
      UPDATE public.unit_tenancy_history
      SET status = 'archived',
          move_out_date = COALESCE(move_out_date, CASE WHEN p_target_status = 'expired' THEN v_lease.end_date ELSE CURRENT_DATE END),
          archived_at = COALESCE(archived_at, now()),
          archived_by = COALESCE(archived_by, v_uid),
          updated_at = now()
      WHERE unit_id = v_lease.unit_id
        AND tenant_id = v_lease.tenant_id
        AND status = 'active';

      IF NOT EXISTS (
        SELECT 1 FROM public.leases
        WHERE tenant_id = v_lease.tenant_id
          AND id <> v_lease.id
          AND status = 'active'
          AND archived_at IS NULL
      ) THEN
        UPDATE public.tenants
        SET status = 'inactive',
            move_out_date = CASE WHEN p_target_status = 'expired' THEN v_lease.end_date ELSE CURRENT_DATE END,
            updated_at = now()
        WHERE id = v_lease.tenant_id;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.leases
        WHERE unit_id = v_lease.unit_id
          AND id <> v_lease.id
          AND status = 'active'
          AND archived_at IS NULL
      ) THEN
        UPDATE public.units
        SET status = 'vacant', updated_at = now()
        WHERE id = v_lease.unit_id;
      END IF;

      INSERT INTO public.unit_activity_log (
        unit_id, property_id, tenant_id, triggered_by, triggered_by_role,
        event_type, title, description, reference_id, reference_type
      ) VALUES (
        v_lease.unit_id, v_lease.property_id, v_lease.tenant_id, v_uid,
        CASE WHEN auth.role() = 'service_role' THEN 'system' ELSE 'manager' END,
        CASE WHEN p_target_status = 'expired' THEN 'lease_expired' ELSE 'lease_terminated' END,
        CASE WHEN p_target_status = 'expired' THEN 'Lease expired' ELSE 'Lease terminated' END,
        'Lease closed and tenancy/unit state reconciled.', v_lease.id, 'lease'
      );
    END IF;
  END IF;

  PERFORM public.refresh_property_occupancy_atomic(v_lease.property_id);

  RETURN jsonb_build_object(
    'id', v_lease.id,
    'status', p_target_status,
    'tenancy_id', v_tenancy_id,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_lease_atomic(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_lease_atomic(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tenant/unit assignment is pre-tenancy only. Occupancy is lease-driven.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_tenant_unit_atomic(
  p_tenant_id uuid,
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_unit_number text DEFAULT NULL
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.tenants%ROWTYPE;
  u public.units%ROWTYPE;
  p public.properties%ROWTYPE;
  v_uid uuid := auth.uid();
  v_unit_number text;
BEGIN
  IF auth.role() <> 'authenticated' OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p
  FROM public.properties
  WHERE id = p_property_id
    AND public.can_manage_property_scope(manager_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO t
  FROM public.tenants
  WHERE id = p_tenant_id
    AND public.can_manage_property_scope(manager_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_unit_id IS NULL AND nullif(trim(p_unit_number), '') IS NULL THEN
    UPDATE public.tenants
    SET property_id = p.id, property = p.name, unit = NULL, unit_id = NULL, updated_at = now()
    WHERE id = t.id
    RETURNING * INTO t;
    RETURN t;
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT * INTO u
    FROM public.units
    WHERE id = p_unit_id AND property_id = p_property_id
    FOR UPDATE;
  ELSE
    v_unit_number := trim(p_unit_number);
    SELECT * INTO u
    FROM public.units
    WHERE property_id = p_property_id
      AND lower(unit_number) = lower(v_unit_number)
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    IF p_unit_id IS NOT NULL THEN
      RAISE EXCEPTION 'Unit not found in property' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.units(property_id, unit_number, status)
    VALUES (p_property_id, v_unit_number, 'vacant')
    RETURNING * INTO u;
  END IF;

  IF u.status = 'inactive' THEN
    RAISE EXCEPTION 'Inactive unit cannot be assigned' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leases
    WHERE unit_id = u.id AND status = 'active' AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Unit is already occupied by an active lease' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE unit_id = u.id AND id <> t.id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unit already has an active tenant' USING ERRCODE = '23505';
  END IF;

  UPDATE public.tenants
  SET property_id = p.id,
      property = p.name,
      unit = u.unit_number,
      unit_id = u.id,
      updated_at = now()
  WHERE id = t.id
  RETURNING * INTO t;

  -- A pre-lease assignment never creates occupancy.
  IF u.status <> 'occupied' THEN
    UPDATE public.units SET status = 'vacant', updated_at = now() WHERE id = u.id;
  END IF;

  PERFORM public.refresh_property_occupancy_atomic(p.id);
  RETURN t;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_tenant_unit_atomic(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_tenant_unit_atomic(uuid, uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Move-out is the terminal transaction for a tenancy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_unit_moveout(
  p_unit_id uuid,
  p_tenant_id uuid,
  p_manager_id uuid,
  p_move_out_date date,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_notice_id uuid DEFAULT NULL,
  p_grant_portal_days integer DEFAULT 90
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenancy_id uuid;
  v_tenant public.tenants%ROWTYPE;
  v_unit public.units%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_total_paid numeric;
  v_arrears numeric;
BEGIN
  IF auth.role() <> 'authenticated' OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE = '42501';
  END IF;

  IF p_move_out_date IS NULL OR p_grant_portal_days < 0 THEN
    RAISE EXCEPTION 'Invalid move-out values' USING ERRCODE = '22023';
  END IF;

  IF p_manager_id IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id AND manager_id = p_manager_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_unit
  FROM public.units
  WHERE id = p_unit_id
  FOR UPDATE;

  IF NOT FOUND OR v_unit.property_id IS DISTINCT FROM v_tenant.property_id THEN
    RAISE EXCEPTION 'Unit does not belong to tenant property' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = v_unit.property_id AND manager_id = p_manager_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property is outside manager scope' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_unit_id::text, 20260904));

  SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue') THEN COALESCE(balance_due, amount) ELSE 0 END), 0)
  INTO v_total_paid, v_arrears
  FROM public.invoices
  WHERE tenant_id = p_tenant_id;

  SELECT id INTO v_tenancy_id
  FROM public.unit_tenancy_history
  WHERE unit_id = p_unit_id AND tenant_id = p_tenant_id AND status = 'active'
  LIMIT 1
  FOR UPDATE;

  IF v_tenancy_id IS NULL THEN
    -- Repair a legacy tenancy gap while still refusing an inconsistent move-out.
    INSERT INTO public.unit_tenancy_history (
      unit_id, property_id, manager_id, tenant_id,
      tenant_name, tenant_email, tenant_phone,
      move_in_date, move_out_date, monthly_rent,
      deposit_paid, total_paid, arrears_at_moveout,
      status, move_out_reason, move_out_notes, notice_id,
      archived_at, archived_by
    ) VALUES (
      p_unit_id, v_property.id, p_manager_id, p_tenant_id,
      v_tenant.name, v_tenant.email, v_tenant.phone,
      COALESCE(v_tenant.move_in_date, p_move_out_date), p_move_out_date,
      v_tenant.monthly_rent, COALESCE(v_tenant.deposit_amount, 0),
      v_total_paid, v_arrears, 'archived', p_reason, p_notes, p_notice_id,
      now(), v_uid
    )
    RETURNING id INTO v_tenancy_id;
  ELSE
    UPDATE public.unit_tenancy_history
    SET status = 'archived',
        move_out_date = p_move_out_date,
        move_out_reason = p_reason,
        move_out_notes = p_notes,
        notice_id = p_notice_id,
        total_paid = v_total_paid,
        arrears_at_moveout = v_arrears,
        archived_at = now(),
        archived_by = v_uid,
        updated_at = now()
    WHERE id = v_tenancy_id;
  END IF;

  UPDATE public.leases
  SET status = 'terminated',
      moved_out_at = now(),
      archived_at = now(),
      archived_by = v_uid,
      end_reason = COALESCE(NULLIF(trim(p_reason), ''), 'notice_given'),
      updated_at = now()
  WHERE unit_id = p_unit_id
    AND tenant_id = p_tenant_id
    AND status IN ('active', 'pending');

  UPDATE public.contracts
  SET status = 'archived', archived_at = now(), archived_by = v_uid,
      archive_reason = 'tenant_moved_out'
  WHERE unit_id = p_unit_id
    AND tenant_id = p_tenant_id
    AND status IN ('active', 'pending_signature', 'draft');

  UPDATE public.tenants
  SET status = 'inactive',
      move_out_date = p_move_out_date,
      move_out_reason = p_reason,
      portal_access_until = now() + (p_grant_portal_days || ' days')::interval,
      updated_at = now()
  WHERE id = p_tenant_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.leases
    WHERE unit_id = p_unit_id AND status = 'active' AND archived_at IS NULL
  ) THEN
    UPDATE public.units
    SET status = 'vacant', updated_at = now()
    WHERE id = p_unit_id;
  END IF;

  INSERT INTO public.unit_activity_log (
    unit_id, property_id, tenancy_id, tenant_id, triggered_by, triggered_by_role,
    event_type, title, description, reference_id, reference_type
  ) VALUES (
    p_unit_id, v_property.id, v_tenancy_id, p_tenant_id, v_uid, 'manager',
    'tenant_moved_out', v_tenant.name || ' moved out',
    'Move-out completed. Lease and tenancy history archived; unit reconciled.',
    v_tenancy_id, 'unit_tenancy_history'
  );

  PERFORM public.refresh_property_occupancy_atomic(v_property.id);
  RETURN v_tenancy_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_unit_moveout(uuid, uuid, uuid, date, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_unit_moveout(uuid, uuid, uuid, date, text, text, uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Database-level guards. These protect the same invariants even if a future
-- code path accidentally bypasses the lifecycle RPCs.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE status <> 'inactive'
    GROUP BY property_id, lower(trim(unit_number))
    HAVING count(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS units_property_unit_number_ci_uidx ON public.units (property_id, lower(trim(unit_number))) WHERE status <> ''inactive''';
  ELSE
    RAISE NOTICE 'Skipped unique active unit-number index because legacy duplicates require reconciliation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leases
    WHERE unit_id IS NOT NULL AND status = 'active' AND archived_at IS NULL
    GROUP BY unit_id HAVING count(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS leases_one_active_per_unit_uidx ON public.leases (unit_id) WHERE unit_id IS NOT NULL AND status = ''active'' AND archived_at IS NULL';
  ELSE
    RAISE NOTICE 'Skipped unique active-lease index because legacy duplicate active leases require reconciliation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.unit_tenancy_history
    WHERE status = 'active'
    GROUP BY unit_id HAVING count(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS tenancy_one_active_per_unit_uidx ON public.unit_tenancy_history (unit_id) WHERE status = ''active''';
  ELSE
    RAISE NOTICE 'Skipped unique active-tenancy-per-unit index because legacy duplicates require reconciliation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.unit_tenancy_history
    WHERE status = 'active'
    GROUP BY tenant_id HAVING count(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS tenancy_one_active_per_tenant_uidx ON public.unit_tenancy_history (tenant_id) WHERE status = ''active''';
  ELSE
    RAISE NOTICE 'Skipped unique active-tenancy-per-tenant index because legacy duplicates require reconciliation';
  END IF;
END $$;

-- Existing clients should no longer be able to mutate lifecycle tables directly.
REVOKE INSERT, UPDATE, DELETE ON public.leases FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.unit_tenancy_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.unit_activity_log FROM authenticated;

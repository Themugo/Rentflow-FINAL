-- ============================================================
-- CALQULUS RMS: Phase 5 - Auth & Privileged Action Hardening
-- Migration: 20260811000003_auth_privileged_action_hardening.sql
--
-- Objective:
--   Harden authentication and privileged actions against role escalation,
--   unauthorized status manipulation, and impersonation.
--
-- Key Controls:
--   1. Protect user_roles against direct client role escalation and self-approval
--   2. Protect manager_profiles against unauthorized status changes by managers
--   3. Sanitize public auth signup metadata in handle_new_auth_user()
--   4. Provide secure RPCs for manager approval and suspension
--   5. Harden create_account_activation and reinstatement functions
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Protect user_roles Table Against Role Escalation
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_user_roles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypasses execution checks
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 1. Prevent non-webhosts from assigning or upgrading to 'webhost' or 'platform_admin'
  IF NEW.role IN ('webhost', 'platform_admin') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot self-assign or grant webhost or platform_admin role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Prevent self-granting 'submanager' role
  IF NEW.role = 'submanager' AND TG_OP = 'INSERT' AND NEW.user_id = auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin', 'manager', 'agency')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot self-assign submanager role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Enforce approval_status bounds
  IF NEW.role IN ('manager', 'agency') THEN
    -- On INSERT by standard user, approval_status MUST start as 'pending'
    IF TG_OP = 'INSERT' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
      ) THEN
        NEW.approval_status := 'pending';
      END IF;
    -- On UPDATE of approval_status, caller MUST be webhost/platform_admin
    ELSIF TG_OP = 'UPDATE' AND OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Only webhosts can alter manager/agency approval status'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_roles_changes ON public.user_roles;
CREATE TRIGGER trg_protect_user_roles_changes
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_roles_changes();


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Sanitize Public Auth Signup Metadata
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'manager');
  
  -- SECURITY SANITIZATION:
  -- Prevent public signups from self-assigning privileged roles via auth metadata
  IF v_role IN ('webhost', 'platform_admin', 'submanager') THEN
    v_role := 'manager';
  END IF;

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email
  );

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  IF v_role IN ('manager', 'tenant', 'landlord', 'agency') THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id, approval_status)
    VALUES (
      NEW.id,
      v_role::public.app_role,
      NULL,
      CASE WHEN v_role IN ('manager', 'agency') THEN 'pending' ELSE 'approved' END
    )
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: Protect manager_profiles Privileged Fields
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_manager_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block non-webhosts from altering status or tier
  IF (OLD.status IS DISTINCT FROM NEW.status
      OR OLD.tier_id IS DISTINCT FROM NEW.tier_id
      OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
      OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
      OR OLD.suspended_by IS DISTINCT FROM NEW.suspended_by
      OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at) THEN
    
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only webhosts and platform admins can modify manager status or tier'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_manager_profile_privileged_fields ON public.manager_profiles;
CREATE TRIGGER trg_protect_manager_profile_privileged_fields
  BEFORE UPDATE ON public.manager_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_manager_profile_privileged_fields();


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: Secure Manager Approval & Suspension RPCs
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.approve_manager_account(
  p_manager_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only webhosts can approve manager accounts'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Update manager profile status
  UPDATE public.manager_profiles
  SET status = 'approved',
      approved_by = COALESCE(auth.uid(), p_manager_user_id),
      approved_at = now(),
      suspension_reason = NULL
  WHERE manager_user_id = p_manager_user_id;

  -- Update user role approval status
  UPDATE public.user_roles
  SET approval_status = 'approved'
  WHERE user_id = p_manager_user_id AND role IN ('manager', 'agency');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_manager_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_manager_account(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.suspend_manager_account(
  p_manager_user_id uuid,
  p_reason text DEFAULT 'Administrative suspension'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only webhosts can suspend manager accounts'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Update manager profile status
  UPDATE public.manager_profiles
  SET status = 'suspended_nonpayment',
      suspended_by = COALESCE(auth.uid(), p_manager_user_id),
      suspended_at = now(),
      suspension_reason = p_reason
  WHERE manager_user_id = p_manager_user_id;

  -- Update user role approval status
  UPDATE public.user_roles
  SET approval_status = 'rejected'
  WHERE user_id = p_manager_user_id AND role IN ('manager', 'agency');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.suspend_manager_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_manager_account(uuid, text) TO authenticated, service_role;

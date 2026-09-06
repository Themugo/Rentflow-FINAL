-- ============================================================
-- Phase 7 — Tenant invitation + registration hardening
--
-- 1. validate_invitation_token now also returns inviter_name
--    (company_settings.company_name -> profiles.full_name fallback)
--    so the invitation page can show "Invited by: <organization>"
--    without an unauthenticated query against profiles.
--
-- 2. New invitation_token_state(token) classifies a token as
--    'pending' | 'expired' | 'used' | 'invalid' with NO PII, so
--    the UI can show a distinct, honest state for each case.
-- ============================================================

-- 1. Recreate validate_invitation_token with inviter_name.
-- Return type changes, so it must be dropped first (same pattern as
-- 20260819000005).
DROP FUNCTION IF EXISTS public.validate_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  tenant_name   text,
  phone         text,
  property_id   uuid,
  property_name text,
  unit          text,
  invited_by    text,
  inviter_name  text,
  status        text,
  expires_at    timestamptz,
  monthly_rent  numeric,
  house_deposit numeric,
  water_deposit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.email,
    ti.tenant_name,
    ti.phone,
    ti.property_id,
    ti.property_name,
    ti.unit,
    ti.invited_by::text,
    COALESCE(
      (SELECT cs.company_name FROM public.company_settings cs
        WHERE cs.manager_user_id::text = ti.invited_by LIMIT 1),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.id::text = ti.invited_by LIMIT 1),
      'Your property manager'
    ) AS inviter_name,
    ti.status,
    ti.expires_at,
    ti.monthly_rent,
    ti.house_deposit,
    ti.water_deposit
  FROM public.tenant_invitations ti
  WHERE ti.token = token_value
    AND ti.status = 'pending'
    AND ti.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;

-- 2. PII-free token classifier. Never returns invitation contents —
-- only enough for the UI to pick the right screen.
CREATE OR REPLACE FUNCTION public.invitation_token_state(token_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.tenant_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.tenant_invitations ti WHERE ti.token = token_value;
  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;
  IF inv.status = 'pending' AND inv.expires_at > now() THEN
    RETURN 'pending';
  END IF;
  IF inv.status = 'pending' THEN
    RETURN 'expired';
  END IF;
  IF inv.status = 'used' THEN
    RETURN 'used';
  END IF;
  RETURN 'invalid';
END;
$$;

REVOKE ALL ON FUNCTION public.invitation_token_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_token_state(text) TO anon, authenticated;

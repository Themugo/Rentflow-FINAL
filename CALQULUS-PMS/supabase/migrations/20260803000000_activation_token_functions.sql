-- ============================================================
-- CALQULUS RMS: Account Activation Token RPCs
-- Migration: 20260803000000_activation_token_functions.sql
--
-- Adds the two RPC functions referenced by the activate-account
-- edge function and the ActivateAccount page but never defined:
--   - validate_activation_token
--   - use_activation_token
--
-- Preconditions (already present in base schema):
--   public.account_activations (token, user_id, expires_at, used_at, ...)
--   RLS policy "Service_only_account_activations" blocks all direct
--   access, so these functions MUST be SECURITY DEFINER.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- validate_activation_token
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_activation_token(
  token_value text
) RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT aa.user_id, u.email::text AS email
  FROM public.account_activations aa
  JOIN auth.users u ON u.id = aa.user_id
  WHERE aa.token = token_value
    AND aa.used_at IS NULL
    AND aa.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_activation_token(text)
  TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════
-- use_activation_token
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.use_activation_token(
  token_value text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used boolean;
BEGIN
  UPDATE public.account_activations
  SET used_at = now()
  WHERE token = token_value
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING true INTO v_used;

  RETURN COALESCE(v_used, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_activation_token(text)
  TO authenticated, service_role;

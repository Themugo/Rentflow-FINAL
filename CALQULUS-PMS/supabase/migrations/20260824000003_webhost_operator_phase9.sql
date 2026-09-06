-- ============================================================
-- Phase 9 — Secure operator (WebHost) onboarding
--
-- WebHost is NOT public registration. Operators are onboarded only
-- through an authorized invitation. This migration:
--
-- 1. Adds admin_type to admin_invitations so the inviter chooses the
--    operator tier (business | admin) at issuance. 'owner' can never
--    be granted through an invitation — there is exactly one owner.
--
-- 2. Replaces validate_admin_invitation_token to also return the
--    admin_type so the invitee sees the operator tier they are
--    accepting before they set credentials.
--
-- The platform_admins row itself is seeded server-side by the
-- accept-admin-invitation edge function (service role), never by the
-- client.
-- ============================================================

-- ── 1. admin_type on invitations ─────────────────────────────
ALTER TABLE public.admin_invitations
  ADD COLUMN IF NOT EXISTS admin_type text NOT NULL DEFAULT 'admin'
    CHECK (admin_type IN ('business', 'admin'));

-- ── 2. validate_admin_invitation_token returns admin_type ────
DROP FUNCTION IF EXISTS public.validate_admin_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_admin_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  inviter_name  text,
  admin_type    text,
  status        text,
  expires_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.id,
    ai.email,
    ai.display_name,
    COALESCE(
      (SELECT cs.company_name FROM public.company_settings cs
        WHERE cs.manager_user_id = ai.invited_by LIMIT 1),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.id = ai.invited_by LIMIT 1),
      'CALQULUS Platform'
    ) AS inviter_name,
    ai.admin_type,
    ai.status,
    ai.expires_at
  FROM public.admin_invitations ai
  WHERE ai.token = token_value
    AND ai.status = 'pending'
    AND ai.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_admin_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_admin_invitation_token(text) TO anon, authenticated;

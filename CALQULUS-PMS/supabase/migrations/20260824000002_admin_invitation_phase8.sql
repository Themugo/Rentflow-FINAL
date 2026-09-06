-- ============================================================
-- Phase 8 — Admin invitation flow
--
-- Admin (webhost) access is invitation/authorization controlled.
-- There is NO public admin registration. This migration adds:
--
-- 1. admin_invitations — the invitation lifecycle (secure token,
--    expiry, single-use status) with RLS that keeps rows readable
--    only by webhosts. The acceptance path never touches the table
--    directly; it goes through SECURITY DEFINER RPCs.
--
-- 2. validate_admin_invitation_token(token) — pending + unexpired
--    rows only, returns exactly what the acceptance page needs
--    (email, display name, inviter name). No other PII.
--
-- 3. admin_invitation_token_state(token) — PII-free classifier:
--    'pending' | 'expired' | 'used' | 'revoked' | 'invalid'.
-- ============================================================

-- ── 1. admin_invitations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  display_name text NOT NULL,
  token        text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'revoked')),
  invited_by   uuid NOT NULL REFERENCES auth.users(id),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_invitations_token  ON public.admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email  ON public.admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_status ON public.admin_invitations(status);

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Only webhosts can read invitations (management screens). Nobody else —
-- including the invitee — reads rows directly; acceptance uses the RPCs.
DROP POLICY IF EXISTS "admin_invitations_webhost_select" ON public.admin_invitations;
CREATE POLICY "admin_invitations_webhost_select"
  ON public.admin_invitations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- Only webhosts can insert invitations.
DROP POLICY IF EXISTS "admin_invitations_webhost_insert" ON public.admin_invitations;
CREATE POLICY "admin_invitations_webhost_insert"
  ON public.admin_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- Only webhosts can revoke (update status away from pending).
DROP POLICY IF EXISTS "admin_invitations_webhost_update" ON public.admin_invitations;
CREATE POLICY "admin_invitations_webhost_update"
  ON public.admin_invitations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- ── 2. validate_admin_invitation_token ───────────────────────
-- Returns the invitation for a pending, unexpired token. Inviter name
-- resolved server-side (company_settings → profiles fallback).
CREATE OR REPLACE FUNCTION public.validate_admin_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  inviter_name  text,
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

-- ── 3. admin_invitation_token_state ──────────────────────────
-- PII-free classifier so the UI can show the right screen without
-- exposing invitation contents.
CREATE OR REPLACE FUNCTION public.admin_invitation_token_state(token_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.admin_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.admin_invitations ai WHERE ai.token = token_value;
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
  IF inv.status = 'revoked' THEN
    RETURN 'revoked';
  END IF;
  RETURN 'invalid';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_invitation_token_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_invitation_token_state(text) TO anon, authenticated;

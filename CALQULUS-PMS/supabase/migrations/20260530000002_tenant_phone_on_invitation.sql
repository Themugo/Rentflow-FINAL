-- Add phone column to tenant_invitations for pre-filled tenant data
ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS phone text;

-- Allow landlord role to also invite tenants (RLS already allows authenticated users)
-- The RPC validate_invitation_token already works for any auth user

-- Update RLS to ensure landlords can create invitations
DROP POLICY IF EXISTS "managers_create_invitations" ON public.tenant_invitations;
CREATE POLICY "authenticated_create_invitations"
  ON public.tenant_invitations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_select_invitations" ON public.tenant_invitations;
CREATE POLICY "authenticated_select_invitations"
  ON public.tenant_invitations FOR SELECT
  USING (auth.role() = 'authenticated');

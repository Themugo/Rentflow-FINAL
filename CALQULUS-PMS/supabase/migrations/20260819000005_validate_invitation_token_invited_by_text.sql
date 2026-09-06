-- Live PostgREST returned:
--   PGRST: "Returned type text does not match expected type uuid" (column invited_by)
-- tenant_invitations.invited_by is text in base_schema (and in live). A later
-- function declared it uuid. Recreate the RPC so the return type matches the
-- column. Cast keeps this safe if the column is ever migrated to uuid.

DROP FUNCTION IF EXISTS public.validate_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  tenant_name   text,
  property_id   uuid,
  property_name text,
  unit          text,
  invited_by    text,
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
    ti.property_id,
    ti.property_name,
    ti.unit,
    ti.invited_by::text,
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

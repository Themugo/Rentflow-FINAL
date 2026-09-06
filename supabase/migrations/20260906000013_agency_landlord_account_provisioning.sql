-- Agency landlord account provisioning
-- Builds on the existing auth/profile/user_roles/property_landlords lifecycle.
-- Auth user creation remains service-role-only inside the edge function; this
-- RPC only authorizes and atomically links the newly-created landlord account.

CREATE OR REPLACE FUNCTION public.provision_agency_landlord_links_atomic(
  p_agency_user_id uuid,
  p_landlord_user_id uuid,
  p_property_ids uuid[],
  p_revenue_share_pct numeric DEFAULT 100
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
  v_count integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=p_agency_user_id
      AND role='agency'
      AND COALESCE(approval_status,'approved')='approved'
  ) THEN
    RAISE EXCEPTION 'Agency account is not authorized' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=p_landlord_user_id
      AND role='landlord'
      AND COALESCE(approval_status,'approved')='approved'
  ) THEN
    RAISE EXCEPTION 'Landlord account is not provisioned' USING ERRCODE='42501';
  END IF;

  IF p_revenue_share_pct < 0 OR p_revenue_share_pct > 100 THEN
    RAISE EXCEPTION 'Revenue share must be between 0 and 100' USING ERRCODE='22023';
  END IF;

  IF p_property_ids IS NULL OR cardinality(p_property_ids)=0 THEN
    RAISE EXCEPTION 'At least one property is required' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_property_ids) AS requested(id)
    LEFT JOIN public.properties p ON p.id=requested.id
    WHERE p.id IS NULL OR p.manager_id IS DISTINCT FROM p_agency_user_id
  ) THEN
    RAISE EXCEPTION 'One or more properties are outside the agency portfolio' USING ERRCODE='42501';
  END IF;

  FOREACH v_property_id IN ARRAY p_property_ids LOOP
    INSERT INTO public.property_landlords(
      property_id,
      landlord_user_id,
      manager_id,
      revenue_share_pct,
      updated_at
    )
    VALUES(
      v_property_id,
      p_landlord_user_id,
      p_agency_user_id,
      p_revenue_share_pct,
      now()
    )
    ON CONFLICT(property_id) DO UPDATE
      SET landlord_user_id=EXCLUDED.landlord_user_id,
          manager_id=EXCLUDED.manager_id,
          revenue_share_pct=EXCLUDED.revenue_share_pct,
          updated_at=now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_agency_landlord_links_atomic(uuid,uuid,uuid[],numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_agency_landlord_links_atomic(uuid,uuid,uuid[],numeric) TO service_role;

COMMENT ON FUNCTION public.provision_agency_landlord_links_atomic(uuid,uuid,uuid[],numeric)
IS 'Service-role-only atomic relationship step for agency-created landlord accounts; property scope is revalidated server-side.';

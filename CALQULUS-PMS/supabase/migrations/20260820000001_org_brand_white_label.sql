-- CALQULUS CORE: org brand overlay for the white-label engine.
-- Platform chrome (webhost, marketing, login) stays CALQULUS.
-- Manager / Agency / their landlords / tenants / submanagers receive
-- company_settings when white_label_enabled is true.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS brand_primary_hex text,
  ADD COLUMN IF NOT EXISTS white_label_enabled boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_settings_brand_primary_hex_chk'
  ) THEN
    ALTER TABLE public.company_settings
      ADD CONSTRAINT company_settings_brand_primary_hex_chk
      CHECK (brand_primary_hex IS NULL OR brand_primary_hex ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

COMMENT ON COLUMN public.company_settings.brand_primary_hex IS
  'Optional interaction color (#RRGGBB). Applied only when white_label_enabled.';
COMMENT ON COLUMN public.company_settings.white_label_enabled IS
  'When true, Manager/Landlord/Agency/Tenant desks use company name, logo, and primary color instead of the CALQULUS platform mark.';

CREATE OR REPLACE FUNCTION public.get_org_brand()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_manager uuid;
  v_row public.company_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ur.role INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY CASE ur.role
    WHEN 'webhost' THEN 0
    WHEN 'manager' THEN 1
    WHEN 'agency' THEN 1
    WHEN 'submanager' THEN 2
    WHEN 'landlord' THEN 3
    WHEN 'tenant' THEN 4
    ELSE 9
  END
  LIMIT 1;

  IF v_role IS NULL OR v_role = 'webhost' THEN
    RETURN NULL;
  END IF;

  IF v_role IN ('manager', 'agency') THEN
    v_manager := v_uid;
  ELSIF v_role = 'submanager' THEN
    SELECT ms.manager_id INTO v_manager
    FROM public.manager_submanagers ms
    WHERE ms.submanager_user_id = v_uid
    LIMIT 1;
  ELSIF v_role = 'landlord' THEN
    SELECT pl.manager_id INTO v_manager
    FROM public.property_landlords pl
    WHERE pl.landlord_user_id = v_uid
      AND pl.manager_id IS NOT NULL
    LIMIT 1;
  ELSIF v_role = 'tenant' THEN
    SELECT t.manager_id INTO v_manager
    FROM public.user_roles ur
    JOIN public.tenants t ON t.id = ur.tenant_id
    WHERE ur.user_id = v_uid
      AND ur.role = 'tenant'
      AND t.manager_id IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_manager IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.company_settings
  WHERE manager_user_id = v_manager
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'manager_user_id', v_manager,
    'company_name', v_row.company_name,
    'logo_url', v_row.logo_url,
    'brand_primary_hex', v_row.brand_primary_hex,
    'white_label_enabled', COALESCE(v_row.white_label_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_brand() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_brand() TO authenticated, service_role;

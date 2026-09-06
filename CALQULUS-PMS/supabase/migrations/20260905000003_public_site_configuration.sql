-- CALQULUS Public Experience + Portal Configuration.
-- Public presentation is persisted separately from customer/portfolio data.
-- The public reader is an intentionally narrow SECURITY DEFINER function;
-- mutations are restricted to platform administrators explicitly allowed to
-- manage platform settings.

CREATE TABLE IF NOT EXISTS public.platform_public_site_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_public_site_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_public_site_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_site_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_config jsonb;
BEGIN
  SELECT CASE WHEN published THEN config ELSE '{}'::jsonb END
    INTO v_config
  FROM public.platform_public_site_config
  WHERE id = true;
  RETURN COALESCE(v_config, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_public_site_config(p_config jsonb, p_published boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.platform_public_site_config;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = v_uid
      AND NOT suspended
      AND can_manage_platform_settings = true
  ) THEN
    RAISE EXCEPTION 'Platform settings permission required';
  END IF;

  IF jsonb_typeof(COALESCE(p_config, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Public site configuration must be an object';
  END IF;
  IF octet_length(COALESCE(p_config, '{}'::jsonb)::text) > 250000 THEN
    RAISE EXCEPTION 'Public site configuration is too large';
  END IF;
  IF p_config ? 'version' AND (p_config->>'version') <> '1' THEN
    RAISE EXCEPTION 'Unsupported public site configuration version';
  END IF;

  INSERT INTO public.platform_public_site_config(id, config, published, updated_at, updated_by)
  VALUES (true, COALESCE(p_config, '{}'::jsonb), COALESCE(p_published, true), now(), v_uid)
  ON CONFLICT (id) DO UPDATE SET
    config = EXCLUDED.config,
    published = EXCLUDED.published,
    updated_at = now(),
    updated_by = v_uid
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('config', v_row.config, 'published', v_row.published, 'updated_at', v_row.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_config() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_public_site_config(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_public_site_config(jsonb, boolean) TO authenticated, service_role;

INSERT INTO public.platform_public_site_config(id, config, published)
VALUES (true, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public-site-media', 'public-site-media', true, 8388608, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "Public site media is publicly readable" ON storage.objects;
CREATE POLICY "Public site media is publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public-site-media');

DROP POLICY IF EXISTS "Platform settings admins manage public site media" ON storage.objects;
CREATE POLICY "Platform settings admins manage public site media"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'public-site-media'
    AND EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND NOT suspended AND can_manage_platform_settings = true
    )
  )
  WITH CHECK (
    bucket_id = 'public-site-media'
    AND EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND NOT suspended AND can_manage_platform_settings = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_platform_public_site_config_updated_at
  ON public.platform_public_site_config(updated_at DESC);

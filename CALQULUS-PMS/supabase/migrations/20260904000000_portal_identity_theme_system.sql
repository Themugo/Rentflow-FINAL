-- Portal identity + visual theme defaults.
-- Publicly readable presentation data; writes are restricted to platform admins.

CREATE TABLE IF NOT EXISTS public.platform_portal_identities (
  portal_id text PRIMARY KEY CHECK (portal_id IN ('manager','landlord','agency','tenant','platform_admin')),
  display_name text NOT NULL,
  short_name text NOT NULL,
  tagline text NOT NULL,
  primary_hex text NOT NULL CHECK (primary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  background_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_portal_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal identities are publicly readable" ON public.platform_portal_identities;
CREATE POLICY "Portal identities are publicly readable"
  ON public.platform_portal_identities FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.platform_portal_identities (portal_id, display_name, short_name, tagline, primary_hex, background_image_url)
VALUES
  ('manager', 'Manager Desk', 'Manager', 'Run your properties from one connected desk.', '#356FE5', NULL),
  ('landlord', 'Owner View', 'Landlord', 'See how your properties are performing.', '#2F9B74', NULL),
  ('agency', 'Agency Desk', 'Agency', 'Run your client portfolio with control.', '#0F766E', NULL),
  ('tenant', 'Resident Portal', 'Tenant', 'Your home, connected.', '#0284C7', NULL),
  ('platform_admin', 'Platform Administration', 'Admin', 'Control the entire CALQULUS platform.', '#2C9183', NULL)
ON CONFLICT (portal_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_platform_portal_identity(p_portal_id text, p_payload jsonb)
RETURNS public.platform_portal_identities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_portal_identities;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'webhost'
  ) THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;

  IF p_portal_id NOT IN ('manager','landlord','agency','tenant','platform_admin') THEN
    RAISE EXCEPTION 'Unsupported portal identity';
  END IF;

  UPDATE public.platform_portal_identities
  SET display_name = COALESCE(NULLIF(left(trim(p_payload->>'display_name'), 80), ''), display_name),
      short_name = COALESCE(NULLIF(left(trim(p_payload->>'short_name'), 32), ''), short_name),
      tagline = COALESCE(NULLIF(left(trim(p_payload->>'tagline'), 140), ''), tagline),
      primary_hex = CASE WHEN (p_payload->>'primary_hex') ~ '^#[0-9A-Fa-f]{6}$' THEN upper(p_payload->>'primary_hex') ELSE primary_hex END,
      background_image_url = NULLIF(left(trim(p_payload->>'background_image_url'), 1000), ''),
      updated_at = now(),
      updated_by = v_uid
  WHERE portal_id = p_portal_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portal identity not found';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.save_platform_portal_identity(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_platform_portal_identity(text, jsonb) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_platform_portal_identities_updated_at ON public.platform_portal_identities(updated_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portal-media', 'portal-media', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "Portal media is publicly readable" ON storage.objects;
CREATE POLICY "Portal media is publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'portal-media');

DROP POLICY IF EXISTS "Platform admins manage portal media" ON storage.objects;
CREATE POLICY "Platform admins manage portal media"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'portal-media'
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'webhost')
  )
  WITH CHECK (
    bucket_id = 'portal-media'
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'webhost')
  );

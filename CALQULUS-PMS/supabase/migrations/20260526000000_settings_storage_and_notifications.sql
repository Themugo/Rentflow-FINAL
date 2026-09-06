-- Settings assets and manager notification preferences

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-photos', 'profile-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('company-logos', 'company-logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_owner_delete" ON storage.objects;

CREATE POLICY "profile_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "profile_photos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_owner_delete" ON storage.objects;

CREATE POLICY "company_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "company_logos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "company_logos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS public.manager_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT true,
  notify_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_provider text DEFAULT 'twilio',
  whatsapp_from_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_manages_own_notification_settings" ON public.manager_notification_settings;
CREATE POLICY "manager_manages_own_notification_settings"
  ON public.manager_notification_settings FOR ALL
  USING (manager_user_id = auth.uid())
  WITH CHECK (manager_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_manager_notification_settings_updated_at
  ON public.manager_notification_settings;
CREATE TRIGGER update_manager_notification_settings_updated_at
  BEFORE UPDATE ON public.manager_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

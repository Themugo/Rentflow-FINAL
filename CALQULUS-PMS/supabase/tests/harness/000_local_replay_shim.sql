-- Local migration-replay harness shim (TEST ONLY — never applied to production).
--
-- Some migrations reference objects that exist on hosted Supabase but not in the
-- minimal `supabase/postgres` Docker image used for local certification:
--   * auth.jwt()                      — provided by GoTrue on hosted Supabase
--   * storage.buckets.public          — storage-api schema on hosted Supabase
--   * storage.buckets.file_size_limit / allowed_mime_types
--
-- This shim reproduces the hosted definitions verbatim so an EMPTY local database
-- can replay all migrations. It is applied BEFORE migration 1 in the local
-- certification harness only.

-- Hosted Supabase grants default table privileges to authenticated/anon via
-- platform defaults (not migrations). Mirror that here so RLS behavior tests
-- match production. Migration 22c revokes anon defaults as intended.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- auth.jwt(): hosted Supabase exposes the decoded JWT claims as jsonb.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    nullif(current_setting('request.jwt.claim', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- storage schema gaps relative to hosted Supabase storage-api
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'public') THEN
      ALTER TABLE storage.buckets ADD COLUMN public boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit') THEN
      ALTER TABLE storage.buckets ADD COLUMN file_size_limit bigint;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types') THEN
      ALTER TABLE storage.buckets ADD COLUMN allowed_mime_types text[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'avif_autodetection') THEN
      ALTER TABLE storage.buckets ADD COLUMN avif_autodetection boolean NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;

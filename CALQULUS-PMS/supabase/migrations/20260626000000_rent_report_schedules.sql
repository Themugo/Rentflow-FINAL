-- ─────────────────────────────────────────────────────────────
-- Rent Collection Report: scheduled auto-send configuration
-- One row per manager. Stores recipient list, enabled flag,
-- and send_day (which day of the month the cron fires).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rent_report_schedules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipients  text[]      NOT NULL DEFAULT '{}',
  enabled     boolean     NOT NULL DEFAULT true,
  send_day    smallint    NOT NULL DEFAULT 1 CHECK (send_day BETWEEN 1 AND 28),
  last_sent_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id)
);

CREATE INDEX IF NOT EXISTS idx_rrs_manager ON rent_report_schedules (manager_id);
CREATE INDEX IF NOT EXISTS idx_rrs_enabled ON rent_report_schedules (enabled) WHERE enabled = true;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION set_rrs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER rrs_updated_at
  BEFORE UPDATE ON rent_report_schedules
  FOR EACH ROW EXECUTE FUNCTION set_rrs_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE rent_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rrs_manager_own"
  ON rent_report_schedules
  USING     (auth.uid() = manager_id)
  WITH CHECK (auth.uid() = manager_id);

-- ── pg_cron schedule (run after applying this migration) ─────
-- Requires pg_cron + pg_net extensions (available on Supabase Pro).
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with your values
-- from Supabase Dashboard → Settings → API.
--
-- SELECT cron.schedule(
--   'monthly-rent-collection-report',
--   '0 7 1 * *',                          -- 07:00 EAT on the 1st of every month
--   $$
--   SELECT net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-send-rent-report',
--     headers := jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--                ),
--     body    := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );
--
-- To verify: SELECT * FROM cron.job;
-- To remove:  SELECT cron.unschedule('monthly-rent-collection-report');

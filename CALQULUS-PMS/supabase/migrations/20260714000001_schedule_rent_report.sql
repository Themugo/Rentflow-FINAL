-- ============================================================
-- CALQULUS RMS: Schedule auto-send-rent-report via pg_cron
-- ============================================================
-- 20260626000000_rent_report_schedules.sql created the
-- rent_report_schedules table (one row per manager, with a
-- configurable send_day 1-28) and the auto-send-rent-report
-- function, but only left a commented-out manual SQL template
-- for actually scheduling it — requiring the project ref and
-- service role key to be substituted by hand in the Supabase
-- SQL editor. That step appears to have never been completed,
-- so the "auto-send" toggle in RentCollectionSummary.tsx has
-- had no cron backing it.
--
-- Separately, that template scheduled the job for the 1st of
-- the month only ('0 7 1 * *'). auto-send-rent-report's own
-- code (see supabase/functions/auto-send-rent-report/index.ts)
-- reads `schedule.send_day` per manager and compares it against
-- today's date — it's written to be invoked daily, with each
-- manager's report only actually going out on their chosen day.
-- A monthly-only cron would have silently dropped every manager
-- who picked a send_day other than 1.
--
-- This migration schedules it daily at 07:00 EAT (04:00 UTC),
-- matching the "07:00 EAT" time referenced in the original
-- template, and lets the function's own send_day filter decide
-- who actually receives an email on a given day.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('calqulusrms-auto-send-rent-report');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule calqulusrms-auto-send-rent-report (job may not exist)';
    END;
    PERFORM cron.schedule(
      'calqulusrms-auto-send-rent-report',
      '0 4 * * *',
      $cron$
        SELECT net.http_post(
          url    := current_setting('app.supabase_url') || '/functions/v1/auto-send-rent-report',
          headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '", "Content-Type": "application/json"}'::jsonb,
          body   := '{}'::jsonb
        );
      $cron$
    );
    RAISE NOTICE 'Scheduled calqulusrms-auto-send-rent-report';
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule auto-send-rent-report via Supabase Dashboard (Daily, 04:00 UTC)';
  END IF;
END;
$$;

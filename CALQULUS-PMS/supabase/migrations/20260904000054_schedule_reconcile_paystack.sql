-- CALQULUS PMS — schedule the Paystack reconciliation sweep
-- Runs every 10 minutes to catch any Paystack payment whose webhook
-- delivery was lost, delayed, or failed to process. See
-- supabase/functions/reconcile-paystack/index.ts for what it does.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('calqulusrms-reconcile-paystack');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule calqulusrms-reconcile-paystack (job may not exist)';
    END;
    PERFORM cron.schedule(
      'calqulusrms-reconcile-paystack',
      '*/10 * * * *',
      $cron$
        SELECT net.http_post(
          url    := current_setting('app.supabase_url') || '/functions/v1/reconcile-paystack',
          headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '", "Content-Type": "application/json"}'::jsonb,
          body   := '{}'::jsonb
        );
      $cron$
    );
    RAISE NOTICE 'Scheduled calqulusrms-reconcile-paystack';
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule reconcile-paystack via Supabase Dashboard';
  END IF;
END;
$$;

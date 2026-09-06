-- ============================================================
-- CALQULUS RMS: Webhook Dead-Letter + Stripe Event Idempotency
--
-- Two related additions needed by the hardened webhook handlers:
--
--   1. webhook_dead_letter
--      Captures failed M-Pesa / bank / Stripe callbacks where the
--      upstream provider has already moved money but we could not
--      complete our side (DB write failure, reconciliation crash, etc).
--      Manual review or a replay job can drain this queue.
--
--   2. stripe_processed_events
--      Stripe retries events aggressively when a 200 is not received
--      within a short timeout. Without idempotency a single payment
--      can mark the same invoice paid multiple times and double-credit
--      manager accounts. We track every event.id we have already acted
--      on so retries are a no-op.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_dead_letter (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL CHECK (source IN ('mpesa', 'bank', 'stripe')),
  external_ref  text,
  payload       jsonb,
  error         text,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'replayed', 'resolved', 'ignored')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_status
  ON public.webhook_dead_letter (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter_source
  ON public.webhook_dead_letter (source, created_at DESC);

-- Only webhosts (system admins) may read or update the dead-letter queue.
ALTER TABLE public.webhook_dead_letter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhost_reads_dead_letter" ON public.webhook_dead_letter;
CREATE POLICY "webhost_reads_dead_letter"
  ON public.webhook_dead_letter FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

DROP POLICY IF EXISTS "webhost_updates_dead_letter" ON public.webhook_dead_letter;
CREATE POLICY "webhost_updates_dead_letter"
  ON public.webhook_dead_letter FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

-- Edge functions write via the service role key and bypass RLS by design.

-- ============================================================
-- Stripe idempotency tracker
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id      text PRIMARY KEY,         -- Stripe event.id (evt_xxx)
  event_type    text NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  invoice_id    uuid,
  reference     text
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_at
  ON public.stripe_processed_events (processed_at DESC);

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhost_reads_stripe_events" ON public.stripe_processed_events;
CREATE POLICY "webhost_reads_stripe_events"
  ON public.stripe_processed_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

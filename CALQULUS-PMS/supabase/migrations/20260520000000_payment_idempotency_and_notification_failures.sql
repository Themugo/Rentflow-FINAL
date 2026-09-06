-- ============================================================
-- CALQULUS RMS: Payment Idempotency + Notification Failure Tracking
--
-- Two related additions for the hardened payment path:
--
--   1. UNIQUE constraint on (tenant_id, bank_reference) for
--      payment_transactions. Prevents the race condition where two
--      concurrent process-payment calls (M-Pesa callback + manual
--      record, double-tap STK push, bank webhook retry) BOTH see no
--      existing transaction and BOTH insert. With the constraint the
--      second insert raises a duplicate-key error which process-payment
--      now catches and treats as idempotent.
--
--      WHY not just (bank_reference)? Two different tenants paying with
--      different M-Pesa receipts could in theory collide — vanishingly
--      unlikely, but the (tenant_id, ref) scope keeps the constraint
--      strict without inventing false collisions.
--
--   2. notification_failures table. process-payment fires email + SMS +
--      WhatsApp + manager notification in parallel via Promise.allSettled
--      and returns success regardless. If ALL of them fail (Resend down,
--      Africa's Talking quota exhausted, etc.) the tenant has paid but
--      heard nothing. We now record each failure so a webhost can replay
--      from the dashboard.
-- ============================================================

-- ── 1. Payment idempotency ──────────────────────────────────────────

-- Drop any existing partial indexes and recreate as a unique constraint.
-- The constraint is partial because we only care about non-null references —
-- a manual "cash" payment may legitimately have a NULL bank_reference.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
      AND  indexname  = 'uniq_payment_tx_tenant_ref'
  ) THEN
    EXECUTE
      'CREATE UNIQUE INDEX uniq_payment_tx_tenant_ref ' ||
      'ON public.payment_transactions (tenant_id, bank_reference) ' ||
      'WHERE bank_reference IS NOT NULL';
  END IF;
END $$;

-- ── 2. Notification failure tracking ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_failures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  uuid REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  tenant_id       uuid,
  manager_id      uuid,
  channel         text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'manager_notify', 'landlord_notify')),
  error           text,
  payload         jsonb,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'replayed', 'resolved', 'ignored')),
  attempts        int  NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_failures_status
  ON public.notification_failures (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_failures_manager
  ON public.notification_failures (manager_id, status, created_at DESC);

ALTER TABLE public.notification_failures ENABLE ROW LEVEL SECURITY;

-- Managers see their own notification failures so they can act on them.
DROP POLICY IF EXISTS "manager_reads_own_notification_failures" ON public.notification_failures;
CREATE POLICY "manager_reads_own_notification_failures"
  ON public.notification_failures FOR SELECT
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "manager_updates_own_notification_failures" ON public.notification_failures;
CREATE POLICY "manager_updates_own_notification_failures"
  ON public.notification_failures FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Webhosts see everything across all managers (system-wide triage).
DROP POLICY IF EXISTS "webhost_reads_all_notification_failures" ON public.notification_failures;
CREATE POLICY "webhost_reads_all_notification_failures"
  ON public.notification_failures FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

DROP POLICY IF EXISTS "webhost_updates_all_notification_failures" ON public.notification_failures;
CREATE POLICY "webhost_updates_all_notification_failures"
  ON public.notification_failures FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

-- Edge functions use the service role key and bypass RLS by design.

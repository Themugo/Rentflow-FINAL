-- Missing tables needed by Edge Functions and notification system

-- fraud_flags: tracks suspicious payment activity (used by detect-fraud Edge Function)
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  flag_reason   text NOT NULL,
  flag_severity text NOT NULL DEFAULT 'low' CHECK (flag_severity IN ('low', 'medium', 'high', 'critical')),
  flagged_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text
);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read fraud_flags for their properties"
  ON public.fraud_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = fraud_flags.invoice_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update fraud_flags for their properties"
  ON public.fraud_flags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = fraud_flags.invoice_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_fraud_flags_invoice ON public.fraud_flags(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_severity ON public.fraud_flags(flag_severity);

-- dead_letter_queue: captures failed notification deliveries (used by notification system)
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  channel         text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push')),
  recipient       text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message   text,
  failed_at       timestamptz NOT NULL DEFAULT now(),
  retry_count     integer NOT NULL DEFAULT 0,
  last_retry_at   timestamptz,
  max_retries     integer NOT NULL DEFAULT 3,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'dead'))
);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read dead_letter_queue"
  ON public.dead_letter_queue FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service can insert into dead_letter_queue"
  ON public.dead_letter_queue FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_status ON public.dead_letter_queue(status);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_failed_at ON public.dead_letter_queue(failed_at);

-- CALQULUS PMS — Paystack webhook + reconciliation
--
-- Paystack mobile-money charges (initiate-paystack-payment,
-- initiate-manager-paystack-payment) are asynchronous: the initiating HTTP
-- response only means "STK prompt sent", not "money received". Until now
-- nothing ever recorded the outcome server-side — there was no webhook and
-- no persisted pending-transaction row to reconcile against, so a tenant
-- could pay via Paystack and the invoice would never be marked paid unless
-- someone manually intervened.
--
-- This migration adds:
--   1. paystack_processed_events — idempotency ledger for the Paystack
--      webhook, mirroring stripe_processed_events exactly.
--   2. claim/complete/fail RPCs for that ledger.
--   3. Widens webhook_dead_letter.source and create_platform_payment_atomic
--      so both already exist for the 'paystack' provider without breaking
--      the existing Stripe callers (all new params default to the old
--      hardcoded values).

-- ── 1. Widen webhook_dead_letter to accept 'paystack' ──────────────────────
ALTER TABLE public.webhook_dead_letter DROP CONSTRAINT IF EXISTS webhook_dead_letter_source_check;
ALTER TABLE public.webhook_dead_letter
  ADD CONSTRAINT webhook_dead_letter_source_check CHECK (source IN ('mpesa', 'bank', 'stripe', 'paystack'));

-- ── 2. Paystack event idempotency ledger ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paystack_processed_events (
  event_id      text PRIMARY KEY,      -- Paystack's data.id (transaction id), stringified
  event_type    text NOT NULL,         -- e.g. 'charge.success'
  status        text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  reference     text,
  invoice_id    uuid,
  claimed_at    timestamptz,
  completed_at  timestamptz,
  processed_at  timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paystack_processed_events_status_claimed
  ON public.paystack_processed_events(status, claimed_at);
CREATE INDEX IF NOT EXISTS idx_paystack_processed_events_reference
  ON public.paystack_processed_events(reference);

ALTER TABLE public.paystack_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paystack_processed_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhost_reads_paystack_events" ON public.paystack_processed_events;
CREATE POLICY "webhost_reads_paystack_events"
  ON public.paystack_processed_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

REVOKE ALL ON public.paystack_processed_events FROM anon, authenticated;
GRANT SELECT ON public.paystack_processed_events TO authenticated;

-- Atomically claim a Paystack webhook event. A completed event is a no-op. A
-- fresh processing claim is protected for 10 minutes; stale claims can be
-- safely retried. Mirrors claim_stripe_event_atomic exactly.
CREATE OR REPLACE FUNCTION public.claim_paystack_event_atomic(
  p_event_id text,
  p_event_type text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event record;
  v_claimed boolean := false;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized Paystack event claim' USING ERRCODE='42501';
  END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = '' OR p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RAISE EXCEPTION 'Invalid Paystack event identity' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_event
  FROM public.paystack_processed_events
  WHERE event_id = btrim(p_event_id)
  FOR UPDATE;

  IF v_event.event_id IS NULL THEN
    INSERT INTO public.paystack_processed_events (event_id, event_type, status, attempt_count, claimed_at, last_error)
    VALUES (btrim(p_event_id), btrim(p_event_type), 'processing', 1, now(), NULL);
    RETURN jsonb_build_object('success',true,'should_process',true,'status','processing','attempt_count',1);
  END IF;

  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object('success',true,'should_process',false,'status','completed','attempt_count',v_event.attempt_count);
  END IF;

  IF v_event.status = 'processing'
     AND v_event.claimed_at IS NOT NULL
     AND v_event.claimed_at > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('success',true,'should_process',false,'status','processing','in_progress',true,'attempt_count',v_event.attempt_count);
  END IF;

  UPDATE public.paystack_processed_events
  SET status='processing', event_type=btrim(p_event_type), claimed_at=now(), attempt_count=attempt_count+1, last_error=NULL
  WHERE event_id=v_event.event_id;
  v_claimed := true;
  RETURN jsonb_build_object('success',true,'should_process',v_claimed,'status','processing','attempt_count',v_event.attempt_count+1);
END; $$;

CREATE OR REPLACE FUNCTION public.complete_paystack_event_atomic(
  p_event_id text,
  p_invoice_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized Paystack event completion' USING ERRCODE='42501';
  END IF;
  SELECT event_id, status INTO v_event FROM public.paystack_processed_events WHERE event_id=btrim(p_event_id) FOR UPDATE;
  IF v_event.event_id IS NULL THEN RAISE EXCEPTION 'Paystack event claim not found' USING ERRCODE='P0002'; END IF;
  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status','completed');
  END IF;
  UPDATE public.paystack_processed_events
  SET status='completed', invoice_id=COALESCE(p_invoice_id, invoice_id), reference=COALESCE(p_reference, reference), completed_at=now(), processed_at=now(), last_error=NULL
  WHERE event_id=v_event.event_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','completed');
END; $$;

CREATE OR REPLACE FUNCTION public.fail_paystack_event_atomic(
  p_event_id text,
  p_error text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized Paystack event failure' USING ERRCODE='42501';
  END IF;
  SELECT event_id, status INTO v_event FROM public.paystack_processed_events WHERE event_id=btrim(p_event_id) FOR UPDATE;
  IF v_event.event_id IS NULL THEN RAISE EXCEPTION 'Paystack event claim not found' USING ERRCODE='P0002'; END IF;
  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status','completed');
  END IF;
  UPDATE public.paystack_processed_events
  SET status='failed', last_error=left(coalesce(p_error,'Unknown Paystack webhook failure'),2000), claimed_at=NULL, processed_at=now()
  WHERE event_id=v_event.event_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','failed');
END; $$;

REVOKE ALL ON FUNCTION public.claim_paystack_event_atomic(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_paystack_event_atomic(text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_paystack_event_atomic(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paystack_event_atomic(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_paystack_event_atomic(text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_paystack_event_atomic(text,text) TO service_role;

-- ── 3. Make create_platform_payment_atomic provider-aware ─────────────────
-- Existing Stripe callers pass no provider/payment_method args, so they keep
-- getting 'stripe' / 'stripe_checkout' exactly as before. The new Paystack
-- manager-fee flow (initiate-manager-paystack-payment) passes
-- p_provider => 'paystack', p_payment_method => 'paystack_mobile_money'.
--
-- CREATE OR REPLACE cannot change a function's parameter list — it would
-- silently create a second, overloaded 10-arg function alongside the old
-- 8-arg one instead of replacing it, and PostgREST/supabase-js's
-- named-argument RPC calls would then be ambiguous between the two. Drop the
-- old signature first so this really is a replacement.
DROP FUNCTION IF EXISTS public.create_platform_payment_atomic(uuid,uuid,numeric,text,text,text,text,jsonb);

CREATE OR REPLACE FUNCTION public.create_platform_payment_atomic(
  p_manager_invoice_id uuid,
  p_manager_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_provider_session_id text DEFAULT NULL,
  p_provider_payment_intent_id text DEFAULT NULL,
  p_currency text DEFAULT 'KES',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_provider text DEFAULT 'stripe',
  p_payment_method text DEFAULT 'stripe_checkout'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_existing record;
  v_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Unauthorized platform payment creation' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 OR p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Invalid platform payment amount or reference' USING ERRCODE = '22023';
  END IF;

  SELECT id, manager_user_id, amount, status
    INTO v_invoice
  FROM public.manager_invoices
  WHERE id = p_manager_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL OR v_invoice.manager_user_id IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Platform invoice ownership mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Platform invoice is already paid' USING ERRCODE = '55000';
  END IF;
  IF round(v_invoice.amount, 2) <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Platform payment amount does not match invoice' USING ERRCODE = '22003';
  END IF;

  SELECT id, manager_invoice_id, manager_user_id, amount, status, provider_session_id
    INTO v_existing
  FROM public.platform_payment_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.manager_invoice_id IS DISTINCT FROM p_manager_invoice_id
       OR v_existing.manager_user_id IS DISTINCT FROM p_manager_user_id
       OR round(v_existing.amount, 2) <> round(p_amount, 2) THEN
      RAISE EXCEPTION 'Platform payment reference collision' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true,
      'transaction_id', v_existing.id, 'status', v_existing.status,
      'provider_session_id', v_existing.provider_session_id
    );
  END IF;

  INSERT INTO public.platform_payment_transactions (
    manager_invoice_id, manager_user_id, provider, payment_method,
    reference, provider_session_id, provider_payment_intent_id, amount, currency, status, metadata
  ) VALUES (
    p_manager_invoice_id, p_manager_user_id,
    coalesce(nullif(btrim(p_provider), ''), 'stripe'),
    coalesce(nullif(btrim(p_payment_method), ''), 'stripe_checkout'),
    p_reference, p_provider_session_id, p_provider_payment_intent_id, round(p_amount, 2), upper(coalesce(p_currency, 'KES')),
    'pending', coalesce(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'transaction_id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.create_platform_payment_atomic(uuid,uuid,numeric,text,text,text,text,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_platform_payment_atomic(uuid,uuid,numeric,text,text,text,text,jsonb,text,text) TO authenticated, service_role;

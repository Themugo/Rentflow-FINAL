-- CALQULUS PMS — Phase 23: Stripe webhook claim/complete lifecycle
-- Do not mark a Stripe event processed before its financial side effects succeed.

ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('processing','completed','failed'));
ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_status_claimed
  ON public.stripe_processed_events(status, claimed_at);

-- Atomically claim an event. A completed event is a no-op. A fresh processing
-- claim is protected for 10 minutes; stale claims can be safely retried.
CREATE OR REPLACE FUNCTION public.claim_stripe_event_atomic(
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
    RAISE EXCEPTION 'Unauthorized Stripe event claim' USING ERRCODE='42501';
  END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = '' OR p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RAISE EXCEPTION 'Invalid Stripe event identity' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_event
  FROM public.stripe_processed_events
  WHERE event_id = btrim(p_event_id)
  FOR UPDATE;

  IF v_event.event_id IS NULL THEN
    INSERT INTO public.stripe_processed_events (event_id, event_type, status, attempt_count, claimed_at, last_error)
    VALUES (btrim(p_event_id), btrim(p_event_type), 'processing', 1, now(), NULL);
    RETURN jsonb_build_object('success',true,'should_process',true,'status','processing','attempt_count',1);
  END IF;

  IF v_event.event_type IS DISTINCT FROM btrim(p_event_type) THEN
    RAISE EXCEPTION 'Stripe event type mismatch for event %', p_event_id USING ERRCODE='23505';
  END IF;

  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object('success',true,'should_process',false,'status','completed','attempt_count',v_event.attempt_count);
  END IF;

  IF v_event.status = 'processing'
     AND v_event.claimed_at IS NOT NULL
     AND v_event.claimed_at > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('success',true,'should_process',false,'status','processing','in_progress',true,'attempt_count',v_event.attempt_count);
  END IF;

  UPDATE public.stripe_processed_events
  SET status='processing', claimed_at=now(), attempt_count=attempt_count+1, last_error=NULL
  WHERE event_id=v_event.event_id;
  v_claimed := true;
  RETURN jsonb_build_object('success',true,'should_process',v_claimed,'status','processing','attempt_count',v_event.attempt_count+1);
END; $$;

CREATE OR REPLACE FUNCTION public.complete_stripe_event_atomic(
  p_event_id text,
  p_invoice_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized Stripe event completion' USING ERRCODE='42501';
  END IF;
  SELECT event_id, status INTO v_event FROM public.stripe_processed_events WHERE event_id=btrim(p_event_id) FOR UPDATE;
  IF v_event.event_id IS NULL THEN RAISE EXCEPTION 'Stripe event claim not found' USING ERRCODE='P0002'; END IF;
  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status','completed');
  END IF;
  UPDATE public.stripe_processed_events
  SET status='completed', invoice_id=COALESCE(p_invoice_id, invoice_id), reference=COALESCE(p_reference, reference), completed_at=now(), processed_at=now(), last_error=NULL
  WHERE event_id=v_event.event_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','completed');
END; $$;

CREATE OR REPLACE FUNCTION public.fail_stripe_event_atomic(
  p_event_id text,
  p_error text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized Stripe event failure' USING ERRCODE='42501';
  END IF;
  SELECT event_id, status INTO v_event FROM public.stripe_processed_events WHERE event_id=btrim(p_event_id) FOR UPDATE;
  IF v_event.event_id IS NULL THEN RAISE EXCEPTION 'Stripe event claim not found' USING ERRCODE='P0002'; END IF;
  IF v_event.status = 'completed' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status','completed');
  END IF;
  UPDATE public.stripe_processed_events
  SET status='failed', last_error=left(coalesce(p_error,'Unknown Stripe webhook failure'),2000), claimed_at=NULL, processed_at=now()
  WHERE event_id=v_event.event_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','failed');
END; $$;

REVOKE ALL ON FUNCTION public.claim_stripe_event_atomic(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_event_atomic(text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stripe_event_atomic(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event_atomic(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_stripe_event_atomic(text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stripe_event_atomic(text,text) TO service_role;

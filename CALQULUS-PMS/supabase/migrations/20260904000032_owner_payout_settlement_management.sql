-- CALQULUS PMS — Owner Payout & Settlement Management
-- Bridges a closed financial period to controlled owner settlement.

CREATE TABLE IF NOT EXISTS public.owner_payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_period_id uuid NOT NULL REFERENCES public.financial_close_periods(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','processing','settled','rejected')),
  gross_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  fee_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  settlement_reference text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  settled_at timestamptz,
  settled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.owner_payout_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.owner_payout_batches(id) ON DELETE CASCADE,
  payout_request_id uuid NOT NULL REFERENCES public.payout_requests(id) ON DELETE RESTRICT,
  gross_amount numeric(12,2) NOT NULL CHECK (gross_amount > 0),
  fee_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount numeric(12,2) NOT NULL CHECK (net_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, payout_request_id),
  UNIQUE(payout_request_id)
);

CREATE TABLE IF NOT EXISTS public.owner_payout_settlement_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.owner_payout_batches(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created','approved','processing','settled','rejected')),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_payout_batches_manager_idx ON public.owner_payout_batches(manager_id, created_at DESC);
CREATE INDEX IF NOT EXISTS owner_payout_batches_close_idx ON public.owner_payout_batches(close_period_id, status);
CREATE INDEX IF NOT EXISTS owner_payout_batch_items_batch_idx ON public.owner_payout_batch_items(batch_id);

ALTER TABLE public.owner_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_payout_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_payout_settlement_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_payout_batches_manager_scope ON public.owner_payout_batches;
CREATE POLICY owner_payout_batches_manager_scope ON public.owner_payout_batches FOR SELECT USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS owner_payout_batch_items_manager_scope ON public.owner_payout_batch_items;
CREATE POLICY owner_payout_batch_items_manager_scope ON public.owner_payout_batch_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.owner_payout_batches b WHERE b.id = batch_id AND public.can_manage_property_scope(b.manager_id)));
DROP POLICY IF EXISTS owner_payout_settlement_audit_manager_scope ON public.owner_payout_settlement_audit;
CREATE POLICY owner_payout_settlement_audit_manager_scope ON public.owner_payout_settlement_audit FOR SELECT USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.owner_payout_batches, public.owner_payout_batch_items, public.owner_payout_settlement_audit FROM PUBLIC, anon;
GRANT SELECT ON public.owner_payout_batches, public.owner_payout_batch_items, public.owner_payout_settlement_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.create_owner_payout_batch_atomic(
  p_manager_id uuid,
  p_close_period_id uuid,
  p_payout_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_batch public.owner_payout_batches;
  v_period public.financial_close_periods;
  v_count integer;
  v_gross numeric := 0;
  v_fee numeric := 0;
BEGIN
  IF auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF coalesce(array_length(p_payout_ids,1),0) = 0 THEN RAISE EXCEPTION 'At least one payout is required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_period FROM public.financial_close_periods WHERE id=p_close_period_id AND manager_id=p_manager_id FOR SHARE;
  IF NOT FOUND OR v_period.status <> 'closed' THEN RAISE EXCEPTION 'Payout batch requires a closed financial period' USING ERRCODE='55000'; END IF;

  SELECT count(*), coalesce(sum(pr.amount),0), coalesce(sum(coalesce(pr.management_fee_amt,0)),0)
  INTO v_count, v_gross, v_fee
  FROM public.payout_requests pr
  WHERE pr.id = ANY(p_payout_ids)
    AND pr.manager_id = p_manager_id
    AND pr.status = 'approved'
    AND pr.period_start >= v_period.period_start
    AND pr.period_end <= v_period.period_end;
  IF v_count <> array_length(p_payout_ids,1) THEN RAISE EXCEPTION 'Every payout must be approved, in scope, and inside the closed period' USING ERRCODE='55000'; END IF;

  IF EXISTS (SELECT 1 FROM public.owner_payout_batch_items WHERE payout_request_id = ANY(p_payout_ids)) THEN RAISE EXCEPTION 'One or more payouts are already assigned to a settlement batch' USING ERRCODE='23505'; END IF;

  INSERT INTO public.owner_payout_batches(manager_id, close_period_id, gross_amount, fee_amount, net_amount)
  VALUES (p_manager_id, p_close_period_id, round(v_gross,2), round(v_fee,2), round(v_gross-v_fee,2))
  RETURNING * INTO v_batch;

  INSERT INTO public.owner_payout_batch_items(batch_id,payout_request_id,gross_amount,fee_amount,net_amount)
  SELECT v_batch.id, pr.id, pr.amount, coalesce(pr.management_fee_amt,0), coalesce(pr.net_amount, round(pr.amount-coalesce(pr.management_fee_amt,0),2))
  FROM public.payout_requests pr WHERE pr.id = ANY(p_payout_ids);

  INSERT INTO public.owner_payout_settlement_audit(batch_id,manager_id,action,actor_id,note)
  VALUES (v_batch.id,p_manager_id,'created',auth.uid(),'Created from approved payouts in a closed financial period.');
  RETURN jsonb_build_object('ok',true,'batch_id',v_batch.id,'status',v_batch.status,'gross_amount',v_batch.gross_amount,'fee_amount',v_batch.fee_amount,'net_amount',v_batch.net_amount,'item_count',v_count);
END $$;

CREATE OR REPLACE FUNCTION public.transition_owner_payout_batch_atomic(
  p_batch_id uuid,
  p_target_status text,
  p_settlement_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_batch public.owner_payout_batches;
  v_period public.financial_close_periods;
  v_item record;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_batch FROM public.owner_payout_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_property_scope(v_batch.manager_id) THEN RAISE EXCEPTION 'Batch outside caller portfolio' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_period FROM public.financial_close_periods WHERE id=v_batch.close_period_id;
  IF NOT FOUND OR v_period.status <> 'closed' THEN RAISE EXCEPTION 'Settlement requires a closed financial period' USING ERRCODE='55000'; END IF;

  IF p_target_status='approved' AND v_batch.status='draft' THEN
    UPDATE public.owner_payout_batches SET status='approved',approved_at=now(),approved_by=v_uid,updated_at=now() WHERE id=v_batch.id;
  ELSIF p_target_status='processing' AND v_batch.status='approved' THEN
    UPDATE public.owner_payout_batches SET status='processing',updated_at=now() WHERE id=v_batch.id;
  ELSIF p_target_status='settled' AND v_batch.status IN ('approved','processing') THEN
    IF nullif(trim(p_settlement_reference),'') IS NULL THEN RAISE EXCEPTION 'Settlement reference required'; END IF;
    FOR v_item IN SELECT pr.* FROM public.owner_payout_batch_items bi JOIN public.payout_requests pr ON pr.id=bi.payout_request_id WHERE bi.batch_id=v_batch.id FOR UPDATE LOOP
      IF v_item.status <> 'approved' THEN RAISE EXCEPTION 'Every payout must remain approved before settlement'; END IF;
      UPDATE public.payout_requests SET status='paid',paid_at=now(),payment_reference=trim(p_settlement_reference),net_amount=coalesce(net_amount,round(amount-coalesce(management_fee_amt,0),2)),updated_at=now() WHERE id=v_item.id;
    END LOOP;
    UPDATE public.owner_payout_batches SET status='settled',settled_at=now(),settled_by=v_uid,settlement_reference=trim(p_settlement_reference),updated_at=now() WHERE id=v_batch.id;
  ELSIF p_target_status='rejected' AND v_batch.status IN ('draft','approved') THEN
    UPDATE public.owner_payout_batches SET status='rejected',updated_at=now() WHERE id=v_batch.id;
  ELSIF p_target_status=v_batch.status THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid settlement transition from % to %',v_batch.status,p_target_status;
  END IF;

  INSERT INTO public.owner_payout_settlement_audit(batch_id,manager_id,action,actor_id,note)
  VALUES (v_batch.id,v_batch.manager_id,p_target_status::text,v_uid,nullif(trim(p_note),''));
  SELECT * INTO v_batch FROM public.owner_payout_batches WHERE id=v_batch.id;
  RETURN jsonb_build_object('ok',true,'batch_id',v_batch.id,'status',v_batch.status,'gross_amount',v_batch.gross_amount,'fee_amount',v_batch.fee_amount,'net_amount',v_batch.net_amount,'settlement_reference',v_batch.settlement_reference);
END $$;

CREATE OR REPLACE FUNCTION public.get_manager_owner_payout_settlement(p_manager_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'batches', coalesce(jsonb_agg(jsonb_build_object('id',b.id,'status',b.status,'period_start',fp.period_start,'period_end',fp.period_end,'gross_amount',b.gross_amount,'fee_amount',b.fee_amount,'net_amount',b.net_amount,'settlement_reference',b.settlement_reference,'created_at',b.created_at,'settled_at',b.settled_at,'item_count',(SELECT count(*) FROM public.owner_payout_batch_items bi WHERE bi.batch_id=b.id)) ORDER BY b.created_at DESC),'[]'::jsonb)
  ) INTO v_result
  FROM public.owner_payout_batches b JOIN public.financial_close_periods fp ON fp.id=b.close_period_id WHERE b.manager_id=p_manager_id;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.create_owner_payout_batch_atomic(uuid,uuid,uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_owner_payout_batch_atomic(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_manager_owner_payout_settlement(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_owner_payout_batch_atomic(uuid,uuid,uuid[]) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_owner_payout_batch_atomic(uuid,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_manager_owner_payout_settlement(uuid) TO authenticated,service_role;

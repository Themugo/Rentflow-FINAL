-- CALQULUS PMS — Management & Compliance Assurance
-- Turns period-end controls into an explicit review/approval record.

CREATE TABLE IF NOT EXISTS public.management_assurance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_period_id uuid REFERENCES public.financial_close_periods(id) ON DELETE SET NULL,
  audit_pack_id uuid REFERENCES public.financial_audit_packs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','rejected')),
  control_score integer NOT NULL DEFAULT 0 CHECK (control_score BETWEEN 0 AND 100),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS management_assurance_one_open_period_idx
  ON public.management_assurance_reviews(manager_id, close_period_id)
  WHERE status IN ('draft','in_review');
CREATE INDEX IF NOT EXISTS management_assurance_manager_status_idx
  ON public.management_assurance_reviews(manager_id,status,updated_at DESC);

ALTER TABLE public.management_assurance_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS management_assurance_manager_select ON public.management_assurance_reviews;
CREATE POLICY management_assurance_manager_select ON public.management_assurance_reviews
  FOR SELECT TO authenticated
  USING (public.can_manage_property_scope(manager_id));

CREATE OR REPLACE FUNCTION public.set_management_assurance_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_management_assurance_updated_at ON public.management_assurance_reviews;
CREATE TRIGGER trg_management_assurance_updated_at
BEFORE UPDATE ON public.management_assurance_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_management_assurance_updated_at();
REVOKE ALL ON FUNCTION public.set_management_assurance_updated_at() FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.create_manager_assurance_review_atomic(
  p_manager_id uuid DEFAULT auth.uid(),
  p_close_period_id uuid DEFAULT NULL,
  p_audit_pack_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid := COALESCE(p_manager_id,v_uid);
  v_ok boolean;
  v_period public.financial_close_periods%ROWTYPE;
  v_pack public.financial_audit_packs%ROWTYPE;
  v_review public.management_assurance_reviews%ROWTYPE;
  v_active integer := 0;
  v_critical integer := 0;
  v_unverified integer := 0;
  v_unmatched integer := 0;
  v_open_work integer := 0;
  v_score integer := 100;
  v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Assurance scope unauthorized' USING ERRCODE='42501'; END IF;

  IF p_close_period_id IS NOT NULL THEN
    SELECT * INTO v_period FROM public.financial_close_periods WHERE id=p_close_period_id AND manager_id=v_manager;
    IF v_period.id IS NULL THEN RAISE EXCEPTION 'Close period not found' USING ERRCODE='P0002'; END IF;
  END IF;
  IF p_audit_pack_id IS NOT NULL THEN
    SELECT * INTO v_pack FROM public.financial_audit_packs WHERE id=p_audit_pack_id AND manager_id=v_manager;
    IF v_pack.id IS NULL THEN RAISE EXCEPTION 'Audit pack not found' USING ERRCODE='P0002'; END IF;
  END IF;

  SELECT count(*) FILTER (WHERE status IN ('open','in_progress')),
         count(*) FILTER (WHERE status IN ('open','in_progress') AND severity='critical')
    INTO v_active,v_critical
  FROM public.reconciliation_cases WHERE manager_id=v_manager;

  SELECT count(*) INTO v_unverified
  FROM public.landlord_documents
  WHERE manager_id=v_manager AND is_visible=true AND verification_status='unverified';

  SELECT count(*) INTO v_unmatched
  FROM public.bank_transactions
  WHERE manager_id=v_manager AND matched=false AND transaction_date >= CURRENT_DATE-90;

  SELECT count(*) INTO v_open_work
  FROM public.operation_work_items
  WHERE manager_id=v_manager AND status IN ('open','in_progress');

  v_score := GREATEST(0,100 - LEAST(60,v_critical*15) - LEAST(20,v_active*4) - LEAST(10,v_unmatched*2) - LEAST(10,v_unverified*2));

  v_snapshot := jsonb_build_object(
    'generated_at',now(),
    'manager_id',v_manager,
    'period',CASE WHEN v_period.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_period.id,'period_start',v_period.period_start,'period_end',v_period.period_end,'status',v_period.status,'closed_at',v_period.closed_at) END,
    'audit_pack',CASE WHEN v_pack.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_pack.id,'status',v_pack.status,'artifact_sha256',v_pack.artifact_sha256,'generated_at',v_pack.generated_at,'finalized_at',v_pack.finalized_at) END,
    'controls',jsonb_build_object('active_reconciliation_cases',v_active,'critical_reconciliation_cases',v_critical,'unmatched_bank_transactions',v_unmatched,'unverified_documents',v_unverified,'open_work_items',v_open_work),
    'recent_material_actions',COALESCE((SELECT jsonb_agg(jsonb_build_object('action',a.action,'entity_type',a.entity_type,'entity_id',a.entity_id,'created_at',a.created_at,'metadata',a.metadata) ORDER BY a.created_at DESC) FROM (SELECT action,entity_type,entity_id,created_at,metadata FROM public.activity_logs WHERE manager_id=v_manager ORDER BY created_at DESC LIMIT 20) a),'[]'::jsonb)
  );

  SELECT * INTO v_review
  FROM public.management_assurance_reviews
  WHERE manager_id=v_manager AND close_period_id IS NOT DISTINCT FROM p_close_period_id AND status IN ('draft','in_review')
  ORDER BY updated_at DESC LIMIT 1;

  IF v_review.id IS NULL THEN
    INSERT INTO public.management_assurance_reviews(manager_id,close_period_id,audit_pack_id,status,control_score,snapshot)
    VALUES(v_manager,p_close_period_id,p_audit_pack_id,'draft',v_score,v_snapshot)
    RETURNING * INTO v_review;
  ELSE
    UPDATE public.management_assurance_reviews
      SET audit_pack_id=COALESCE(p_audit_pack_id,audit_pack_id),control_score=v_score,snapshot=v_snapshot,updated_at=now()
    WHERE id=v_review.id RETURNING * INTO v_review;
  END IF;

  INSERT INTO public.activity_logs(actor_id,actor_role,actor_email,action,entity_type,entity_id,manager_id,metadata)
  VALUES(v_uid,COALESCE((SELECT role::text FROM public.user_roles WHERE user_id=v_uid AND approval_status='approved' ORDER BY CASE role::text WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 WHEN 'submanager' THEN 3 ELSE 4 END LIMIT 1),'system'),auth.jwt()->>'email','assurance_review_created','management_assurance_review',v_review.id,v_manager,jsonb_build_object('control_score',v_score,'close_period_id',p_close_period_id,'audit_pack_id',p_audit_pack_id));

  RETURN jsonb_build_object('review_id',v_review.id,'status',v_review.status,'control_score',v_review.control_score,'snapshot',v_review.snapshot);
END $$;

CREATE OR REPLACE FUNCTION public.review_manager_assurance_atomic(
  p_review_id uuid,
  p_target_status text,
  p_decision_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_review public.management_assurance_reviews%ROWTYPE;
  v_ok boolean;
BEGIN
  IF v_uid IS NULL OR p_target_status NOT IN ('in_review','approved','rejected') THEN RAISE EXCEPTION 'Invalid assurance review transition' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_review FROM public.management_assurance_reviews WHERE id=p_review_id FOR UPDATE;
  IF v_review.id IS NULL THEN RAISE EXCEPTION 'Assurance review not found' USING ERRCODE='P0002'; END IF;
  SELECT v_review.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_review.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Assurance review unauthorized' USING ERRCODE='42501'; END IF;
  IF p_target_status='approved' AND v_review.control_score < 80 THEN RAISE EXCEPTION 'Assurance review requires a control score of at least 80 to approve' USING ERRCODE='22023'; END IF;
  UPDATE public.management_assurance_reviews
  SET status=p_target_status,reviewer_id=v_uid,reviewed_at=CASE WHEN p_target_status IN ('approved','rejected') THEN now() ELSE NULL END,decision_note=COALESCE(NULLIF(trim(p_decision_note),''),decision_note),updated_at=now()
  WHERE id=v_review.id RETURNING * INTO v_review;
  INSERT INTO public.activity_logs(actor_id,actor_role,actor_email,action,entity_type,entity_id,manager_id,metadata)
  VALUES(v_uid,COALESCE((SELECT role::text FROM public.user_roles WHERE user_id=v_uid AND approval_status='approved' ORDER BY CASE role::text WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 WHEN 'submanager' THEN 3 ELSE 4 END LIMIT 1),'system'),auth.jwt()->>'email','assurance_review_'||p_target_status,'management_assurance_review',v_review.id,v_review.manager_id,jsonb_build_object('control_score',v_review.control_score,'decision_note',v_review.decision_note));
  RETURN jsonb_build_object('ok',true,'id',v_review.id,'status',v_review.status,'control_score',v_review.control_score,'reviewed_at',v_review.reviewed_at);
END $$;

CREATE OR REPLACE FUNCTION public.get_manager_assurance_reviews(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_result jsonb;
BEGIN
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Assurance scope unauthorized' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'close_period_id',r.close_period_id,'audit_pack_id',r.audit_pack_id,'status',r.status,'control_score',r.control_score,'snapshot',r.snapshot,'reviewer_id',r.reviewer_id,'reviewed_at',r.reviewed_at,'decision_note',r.decision_note,'created_at',r.created_at,'updated_at',r.updated_at) ORDER BY r.updated_at DESC),'[]'::jsonb) INTO v_result
  FROM public.management_assurance_reviews r WHERE r.manager_id=v_manager;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.create_manager_assurance_review_atomic(uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.review_manager_assurance_atomic(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_manager_assurance_reviews(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_manager_assurance_review_atomic(uuid,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.review_manager_assurance_atomic(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_manager_assurance_reviews(uuid) TO authenticated,service_role;

COMMENT ON TABLE public.management_assurance_reviews IS 'Explicit management review and approval layer over close, reconciliation, evidence and period-end audit controls.';

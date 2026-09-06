-- CALQULUS PMS — Controlled Management Reporting & Statement Releases
-- Releases only approved, period-end snapshots. No report may invent or silently
-- recompute financial truth outside the finalized audit pack.

CREATE TABLE IF NOT EXISTS public.controlled_statement_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_period_id uuid NOT NULL REFERENCES public.financial_close_periods(id) ON DELETE CASCADE,
  audit_pack_id uuid NOT NULL REFERENCES public.financial_audit_packs(id) ON DELETE RESTRICT,
  assurance_review_id uuid NOT NULL REFERENCES public.management_assurance_reviews(id) ON DELETE RESTRICT,
  statement_type text NOT NULL CHECK (statement_type IN ('management','compliance')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','released','superseded')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  snapshot jsonb NOT NULL,
  artifact_sha256 text,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS controlled_statement_one_active_type_idx
  ON public.controlled_statement_releases(manager_id, close_period_id, statement_type)
  WHERE status IN ('draft','released');
CREATE INDEX IF NOT EXISTS controlled_statement_manager_period_idx
  ON public.controlled_statement_releases(manager_id, period_end DESC, statement_type);

ALTER TABLE public.controlled_statement_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS controlled_statement_manager_select ON public.controlled_statement_releases;
CREATE POLICY controlled_statement_manager_select ON public.controlled_statement_releases
  FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
REVOKE ALL ON public.controlled_statement_releases FROM PUBLIC, anon;
GRANT SELECT ON public.controlled_statement_releases TO authenticated;

CREATE OR REPLACE FUNCTION public.set_controlled_statement_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_controlled_statement_updated_at ON public.controlled_statement_releases;
CREATE TRIGGER trg_controlled_statement_updated_at
BEFORE UPDATE ON public.controlled_statement_releases
FOR EACH ROW EXECUTE FUNCTION public.set_controlled_statement_updated_at();
REVOKE ALL ON FUNCTION public.set_controlled_statement_updated_at() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.generate_controlled_statement_atomic(
  p_manager_id uuid,
  p_close_period_id uuid,
  p_statement_type text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pack public.financial_audit_packs;
  v_review public.management_assurance_reviews;
  v_close public.financial_close_periods;
  v_existing public.controlled_statement_releases;
  v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_statement_type NOT IN ('management','compliance') THEN
    RAISE EXCEPTION 'Unsupported controlled statement type' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_close FROM public.financial_close_periods
  WHERE id=p_close_period_id AND manager_id=p_manager_id;
  IF NOT FOUND OR v_close.status <> 'closed' THEN
    RAISE EXCEPTION 'A closed financial period is required' USING ERRCODE='55000';
  END IF;

  SELECT * INTO v_pack FROM public.financial_audit_packs
  WHERE manager_id=p_manager_id AND close_period_id=p_close_period_id AND status='finalized'
  ORDER BY finalized_at DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A finalized audit pack is required before reporting' USING ERRCODE='55000';
  END IF;

  SELECT * INTO v_review FROM public.management_assurance_reviews
  WHERE manager_id=p_manager_id AND close_period_id=p_close_period_id AND status='approved'
  ORDER BY reviewed_at DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An approved management assurance review is required before reporting' USING ERRCODE='55000';
  END IF;

  v_snapshot := jsonb_build_object(
    'schema_version','1.0',
    'statement_type',p_statement_type,
    'generated_at',now(),
    'manager_id',p_manager_id,
    'period',jsonb_build_object('id',v_close.id,'period_start',v_close.period_start,'period_end',v_close.period_end,'closed_at',v_close.closed_at),
    'control_basis',jsonb_build_object('audit_pack_id',v_pack.id,'audit_pack_sha256',v_pack.artifact_sha256,'assurance_review_id',v_review.id,'control_score',v_review.control_score),
    'financials',COALESCE(v_pack.snapshot->'financials','{}'::jsonb),
    'bank_reconciliation',COALESCE(v_pack.snapshot->'bank_reconciliation','{}'::jsonb),
    'owner_settlement',COALESCE(v_pack.snapshot->'owner_settlement','{}'::jsonb),
    'evidence',COALESCE(v_pack.snapshot->'evidence','{}'::jsonb),
    'operations',COALESCE(v_pack.snapshot->'operations','{}'::jsonb),
    'reconciliation',COALESCE(v_pack.snapshot->'reconciliation','{}'::jsonb),
    'reporting_note',CASE WHEN p_statement_type='compliance' THEN 'Controlled compliance summary derived from the finalized period-end audit pack and approved management assurance review.' ELSE 'Controlled management statement derived from the finalized period-end audit pack and approved management assurance review.' END
  );

  SELECT * INTO v_existing FROM public.controlled_statement_releases
  WHERE manager_id=p_manager_id AND close_period_id=p_close_period_id AND statement_type=p_statement_type AND status='draft'
  ORDER BY updated_at DESC LIMIT 1;

  IF FOUND THEN
    UPDATE public.controlled_statement_releases
      SET audit_pack_id=v_pack.id, assurance_review_id=v_review.id, period_start=v_close.period_start,
          period_end=v_close.period_end, snapshot=v_snapshot, updated_at=now()
    WHERE id=v_existing.id RETURNING * INTO v_existing;
  ELSE
    INSERT INTO public.controlled_statement_releases(manager_id,close_period_id,audit_pack_id,assurance_review_id,statement_type,status,period_start,period_end,snapshot)
    VALUES(p_manager_id,v_close.id,v_pack.id,v_review.id,p_statement_type,'draft',v_close.period_start,v_close.period_end,v_snapshot)
    RETURNING * INTO v_existing;
  END IF;

  INSERT INTO public.activity_logs(actor_id,actor_role,actor_email,action,entity_type,entity_id,manager_id,metadata)
  VALUES(v_uid,COALESCE((SELECT role::text FROM public.user_roles WHERE user_id=v_uid AND approval_status='approved' ORDER BY CASE role::text WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 WHEN 'submanager' THEN 3 ELSE 4 END LIMIT 1),'system'),auth.jwt()->>'email','controlled_statement_generated','controlled_statement_release',v_existing.id,p_manager_id,jsonb_build_object('statement_type',p_statement_type,'audit_pack_id',v_pack.id,'assurance_review_id',v_review.id));

  RETURN jsonb_build_object('ok',true,'id',v_existing.id,'status',v_existing.status,'statement_type',v_existing.statement_type,'snapshot',v_existing.snapshot);
END $$;

CREATE OR REPLACE FUNCTION public.release_controlled_statement_atomic(
  p_statement_id uuid,
  p_artifact_sha256 text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_statement public.controlled_statement_releases;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_artifact_sha256 !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'A SHA-256 artifact hash is required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_statement FROM public.controlled_statement_releases WHERE id=p_statement_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_property_scope(v_statement.manager_id) THEN
    RAISE EXCEPTION 'Statement scope unauthorized' USING ERRCODE='42501';
  END IF;
  IF v_statement.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft statements can be released' USING ERRCODE='55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_audit_packs p WHERE p.id=v_statement.audit_pack_id AND p.status='finalized') THEN
    RAISE EXCEPTION 'Finalized audit pack required' USING ERRCODE='55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.management_assurance_reviews r WHERE r.id=v_statement.assurance_review_id AND r.status='approved' AND r.control_score >= 80) THEN
    RAISE EXCEPTION 'Approved assurance review required' USING ERRCODE='55000';
  END IF;

  UPDATE public.controlled_statement_releases
  SET status='released',artifact_sha256=lower(trim(p_artifact_sha256)),released_by=v_uid,released_at=now(),updated_at=now()
  WHERE id=v_statement.id;

  UPDATE public.controlled_statement_releases
  SET status='superseded',updated_at=now()
  WHERE manager_id=v_statement.manager_id AND close_period_id=v_statement.close_period_id
    AND statement_type=v_statement.statement_type AND status='released' AND id<>v_statement.id;

  INSERT INTO public.activity_logs(actor_id,actor_role,actor_email,action,entity_type,entity_id,manager_id,metadata)
  VALUES(v_uid,COALESCE((SELECT role::text FROM public.user_roles WHERE user_id=v_uid AND approval_status='approved' ORDER BY CASE role::text WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 WHEN 'submanager' THEN 3 ELSE 4 END LIMIT 1),'system'),auth.jwt()->>'email','controlled_statement_released','controlled_statement_release',v_statement.id,v_statement.manager_id,jsonb_build_object('statement_type',v_statement.statement_type,'artifact_sha256',lower(trim(p_artifact_sha256))));

  RETURN jsonb_build_object('ok',true,'id',v_statement.id,'status','released','artifact_sha256',lower(trim(p_artifact_sha256)));
END $$;

CREATE OR REPLACE FUNCTION public.get_manager_controlled_statements(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_result jsonb;
BEGIN
  SELECT v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Statement scope unauthorized' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.period_end DESC,s.statement_type), '[]'::jsonb) INTO v_result
  FROM public.controlled_statement_releases s WHERE s.manager_id=v_manager AND s.status IN ('draft','released');
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.generate_controlled_statement_atomic(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.release_controlled_statement_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_manager_controlled_statements(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_controlled_statement_atomic(uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.release_controlled_statement_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_manager_controlled_statements(uuid) TO authenticated,service_role;

COMMENT ON TABLE public.controlled_statement_releases IS 'Controlled management/compliance statements generated only from finalized audit packs and approved management assurance reviews.';

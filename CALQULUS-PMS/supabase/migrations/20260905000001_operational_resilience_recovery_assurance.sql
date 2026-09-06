-- CALQULUS PMS — Initiative 52: Operational Resilience & Recovery Assurance
-- Records management-owned continuity plans and recovery drills without claiming
-- that a drill is equivalent to a Supabase PITR/backup restore test.

CREATE TABLE IF NOT EXISTS public.business_continuity_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  critical_processes text NOT NULL,
  rto_minutes integer NOT NULL CHECK (rto_minutes > 0),
  rpo_minutes integer NOT NULL CHECK (rpo_minutes >= 0),
  accountable_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  review_due_on date,
  evidence_document_id uuid REFERENCES public.landlord_documents(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recovery_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.business_continuity_plans(id) ON DELETE CASCADE,
  drill_date date NOT NULL,
  scenario text NOT NULL,
  result text NOT NULL CHECK (result IN ('pass','partial','fail')),
  actual_rto_minutes integer CHECK (actual_rto_minutes IS NULL OR actual_rto_minutes >= 0),
  actual_rpo_minutes integer CHECK (actual_rpo_minutes IS NULL OR actual_rpo_minutes >= 0),
  findings text,
  corrective_actions text,
  evidence_document_id uuid REFERENCES public.landlord_documents(id) ON DELETE SET NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bcp_manager_status_idx ON public.business_continuity_plans(manager_id, status);
CREATE INDEX IF NOT EXISTS bcp_property_idx ON public.business_continuity_plans(property_id);
CREATE INDEX IF NOT EXISTS bcp_review_due_idx ON public.business_continuity_plans(manager_id, review_due_on);
CREATE INDEX IF NOT EXISTS rd_manager_date_idx ON public.recovery_drills(manager_id, drill_date DESC);
CREATE INDEX IF NOT EXISTS rd_plan_date_idx ON public.recovery_drills(plan_id, drill_date DESC);

ALTER TABLE public.business_continuity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_drills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read continuity plans" ON public.business_continuity_plans;
CREATE POLICY "Managers read continuity plans"
  ON public.business_continuity_plans FOR SELECT
  USING (public.can_manage_property_scope(manager_id));

DROP POLICY IF EXISTS "Managers read recovery drills" ON public.recovery_drills;
CREATE POLICY "Managers read recovery drills"
  ON public.recovery_drills FOR SELECT
  USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.business_continuity_plans, public.recovery_drills FROM PUBLIC, anon;
GRANT SELECT ON public.business_continuity_plans, public.recovery_drills TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_business_continuity_plan_atomic(
  p_manager_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_plan_name text DEFAULT NULL,
  p_critical_processes text DEFAULT NULL,
  p_rto_minutes integer DEFAULT NULL,
  p_rpo_minutes integer DEFAULT NULL,
  p_accountable_owner_id uuid DEFAULT NULL,
  p_status text DEFAULT 'draft',
  p_review_due_on date DEFAULT NULL,
  p_evidence_document_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_plan_name IS NULL OR btrim(p_plan_name) = '' OR p_critical_processes IS NULL OR btrim(p_critical_processes) = '' THEN
    RAISE EXCEPTION 'Plan name and critical processes are required' USING ERRCODE='22023';
  END IF;
  IF p_rto_minutes IS NULL OR p_rto_minutes <= 0 OR p_rpo_minutes IS NULL OR p_rpo_minutes < 0 THEN
    RAISE EXCEPTION 'RTO/RPO values are invalid' USING ERRCODE='22023';
  END IF;
  IF p_status NOT IN ('draft','active','retired') THEN
    RAISE EXCEPTION 'Invalid continuity plan status' USING ERRCODE='22023';
  END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.manager_id = p_manager_id
  ) THEN
    RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_accountable_owner_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_accountable_owner_id) THEN
    RAISE EXCEPTION 'Accountable owner is required' USING ERRCODE='22023';
  END IF;
  IF p_accountable_owner_id <> p_manager_id AND NOT EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id = p_manager_id AND ms.submanager_user_id = p_accountable_owner_id
  ) THEN
    RAISE EXCEPTION 'Accountable owner outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_evidence_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.id = p_evidence_document_id
      AND d.manager_id = p_manager_id
  ) THEN
    RAISE EXCEPTION 'Evidence document outside manager scope' USING ERRCODE='42501';
  END IF;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.business_continuity_plans (
      manager_id, property_id, plan_name, critical_processes, rto_minutes, rpo_minutes,
      accountable_owner_id, status, review_due_on, evidence_document_id, notes, created_by
    ) VALUES (
      p_manager_id, p_property_id, btrim(p_plan_name), btrim(p_critical_processes), p_rto_minutes, p_rpo_minutes,
      p_accountable_owner_id, p_status, p_review_due_on, p_evidence_document_id, NULLIF(btrim(p_notes), ''), auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.business_continuity_plans
       SET property_id = p_property_id,
           plan_name = btrim(p_plan_name),
           critical_processes = btrim(p_critical_processes),
           rto_minutes = p_rto_minutes,
           rpo_minutes = p_rpo_minutes,
           accountable_owner_id = p_accountable_owner_id,
           status = p_status,
           review_due_on = p_review_due_on,
           evidence_document_id = p_evidence_document_id,
           notes = NULLIF(btrim(p_notes), ''),
           updated_at = now()
     WHERE id = p_plan_id AND manager_id = p_manager_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Continuity plan not found in manager scope' USING ERRCODE='42501'; END IF;
    v_id := p_plan_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_recovery_drill_atomic(
  p_manager_id uuid,
  p_plan_id uuid,
  p_drill_date date,
  p_scenario text,
  p_result text,
  p_actual_rto_minutes integer DEFAULT NULL,
  p_actual_rpo_minutes integer DEFAULT NULL,
  p_findings text DEFAULT NULL,
  p_corrective_actions text DEFAULT NULL,
  p_evidence_document_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_plan public.business_continuity_plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_plan FROM public.business_continuity_plans
   WHERE id = p_plan_id AND manager_id = p_manager_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Continuity plan outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_drill_date IS NULL OR p_scenario IS NULL OR btrim(p_scenario) = '' THEN
    RAISE EXCEPTION 'Drill date and scenario are required' USING ERRCODE='22023';
  END IF;
  IF p_result NOT IN ('pass','partial','fail') THEN RAISE EXCEPTION 'Invalid drill result' USING ERRCODE='22023'; END IF;
  IF p_actual_rto_minutes IS NOT NULL AND p_actual_rto_minutes < 0 THEN RAISE EXCEPTION 'Invalid actual RTO' USING ERRCODE='22023'; END IF;
  IF p_actual_rpo_minutes IS NOT NULL AND p_actual_rpo_minutes < 0 THEN RAISE EXCEPTION 'Invalid actual RPO' USING ERRCODE='22023'; END IF;
  IF p_evidence_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.landlord_documents d WHERE d.id=p_evidence_document_id AND d.manager_id=p_manager_id
  ) THEN RAISE EXCEPTION 'Evidence document outside manager scope' USING ERRCODE='42501'; END IF;

  INSERT INTO public.recovery_drills (
    manager_id, plan_id, drill_date, scenario, result, actual_rto_minutes, actual_rpo_minutes,
    findings, corrective_actions, evidence_document_id, recorded_by
  ) VALUES (
    p_manager_id, p_plan_id, p_drill_date, btrim(p_scenario), p_result, p_actual_rto_minutes, p_actual_rpo_minutes,
    NULLIF(btrim(p_findings), ''), NULLIF(btrim(p_corrective_actions), ''), p_evidence_document_id, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_recovery_assurance(
  p_manager_id uuid DEFAULT auth.uid(),
  p_horizon_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  v_result := jsonb_build_object(
    'active_plans', (SELECT count(*) FROM public.business_continuity_plans WHERE manager_id=p_manager_id AND status='active'),
    'draft_plans', (SELECT count(*) FROM public.business_continuity_plans WHERE manager_id=p_manager_id AND status='draft'),
    'overdue_reviews', (SELECT count(*) FROM public.business_continuity_plans WHERE manager_id=p_manager_id AND status <> 'retired' AND review_due_on < current_date),
    'reviews_due', (SELECT count(*) FROM public.business_continuity_plans WHERE manager_id=p_manager_id AND status <> 'retired' AND review_due_on BETWEEN current_date AND current_date + greatest(p_horizon_days,0)),
    'drills_90d', (SELECT count(*) FROM public.recovery_drills WHERE manager_id=p_manager_id AND drill_date >= current_date - 90),
    'failed_drills_90d', (SELECT count(*) FROM public.recovery_drills WHERE manager_id=p_manager_id AND drill_date >= current_date - 90 AND result='fail'),
    'partial_drills_90d', (SELECT count(*) FROM public.recovery_drills WHERE manager_id=p_manager_id AND drill_date >= current_date - 90 AND result='partial'),
    'plans', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.status, x.review_due_on NULLS LAST, x.plan_name) FROM (
      SELECT b.id,b.property_id,b.plan_name,b.critical_processes,b.rto_minutes,b.rpo_minutes,b.accountable_owner_id,
             b.status,b.review_due_on,b.evidence_document_id,b.notes,
             CASE WHEN b.review_due_on IS NULL THEN NULL ELSE (b.review_due_on-current_date) END AS days_to_review,
             EXISTS (SELECT 1 FROM public.recovery_drills d WHERE d.plan_id=b.id) AS has_drill
      FROM public.business_continuity_plans b WHERE b.manager_id=p_manager_id
    ) x), '[]'::jsonb),
    'drills', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.drill_date DESC, x.created_at DESC) FROM (
      SELECT d.id,d.plan_id,d.drill_date,d.scenario,d.result,d.actual_rto_minutes,d.actual_rpo_minutes,
             d.findings,d.corrective_actions,d.evidence_document_id,d.created_at,b.plan_name,
             (d.actual_rto_minutes IS NOT NULL AND d.actual_rto_minutes > b.rto_minutes) AS rto_missed,
             (d.actual_rpo_minutes IS NOT NULL AND d.actual_rpo_minutes > b.rpo_minutes) AS rpo_missed
      FROM public.recovery_drills d JOIN public.business_continuity_plans b ON b.id=d.plan_id
      WHERE d.manager_id=p_manager_id
    ) x), '[]'::jsonb)
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_business_continuity_plan_atomic(uuid,uuid,uuid,text,text,integer,integer,uuid,text,date,uuid,text), public.record_recovery_drill_atomic(uuid,uuid,date,text,text,integer,integer,text,text,uuid), public.get_manager_recovery_assurance(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_business_continuity_plan_atomic(uuid,uuid,uuid,text,text,integer,integer,uuid,text,date,uuid,text), public.record_recovery_drill_atomic(uuid,uuid,date,text,text,integer,integer,text,text,uuid), public.get_manager_recovery_assurance(uuid,integer) TO authenticated;

COMMENT ON TABLE public.business_continuity_plans IS 'Management-owned business continuity plans and target RTO/RPO. Does not prove infrastructure backup/PITR capability.';
COMMENT ON TABLE public.recovery_drills IS 'Recorded operational recovery exercises. Evidence is management evidence and is not an infrastructure restore attestation.';

-- CALQULUS PMS — Initiative 50: Property Inspections, Compliance & Condition Assurance
-- Extends the existing unit inspection, maintenance asset and work-order controls.
-- No parallel maintenance or accounting source of truth is introduced.

CREATE TABLE IF NOT EXISTS public.property_inspection_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  name text NOT NULL,
  inspection_type text NOT NULL DEFAULT 'periodic' CHECK (inspection_type IN ('periodic','safety','compliance','handover','pre_lease','post_incident')),
  frequency_days integer NOT NULL CHECK (frequency_days > 0),
  next_due_date date NOT NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id, name)
);

CREATE TABLE IF NOT EXISTS public.property_inspection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.property_inspection_programs(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  scheduled_for date NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  overall_score integer CHECK (overall_score BETWEEN 0 AND 100),
  condition_status text CHECK (condition_status IS NULL OR condition_status IN ('excellent','good','fair','poor','critical')),
  notes text,
  conducted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, scheduled_for)
);

CREATE TABLE IF NOT EXISTS public.property_inspection_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inspection_run_id uuid NOT NULL REFERENCES public.property_inspection_runs(id) ON DELETE CASCADE,
  checklist_key text NOT NULL,
  checklist_label text NOT NULL,
  result text NOT NULL CHECK (result IN ('pass','attention','fail','not_applicable')),
  score integer CHECK (score BETWEEN 0 AND 100),
  notes text,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  asset_id uuid REFERENCES public.maintenance_assets(id) ON DELETE SET NULL,
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspection_run_id, checklist_key)
);

CREATE TABLE IF NOT EXISTS public.property_compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  authority text,
  reference_code text,
  due_date date,
  review_frequency_days integer CHECK (review_frequency_days IS NULL OR review_frequency_days > 0),
  status text NOT NULL DEFAULT 'attention' CHECK (status IN ('compliant','attention','non_compliant','not_applicable')),
  evidence_document_id uuid REFERENCES public.landlord_documents(id) ON DELETE SET NULL,
  last_verified_on date,
  next_review_date date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_inspection_programs_manager_due_idx ON public.property_inspection_programs(manager_id, active, next_due_date);
CREATE INDEX IF NOT EXISTS property_inspection_runs_manager_status_idx ON public.property_inspection_runs(manager_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS property_inspection_findings_run_idx ON public.property_inspection_findings(manager_id, inspection_run_id, result);
CREATE INDEX IF NOT EXISTS property_compliance_requirements_manager_due_idx ON public.property_compliance_requirements(manager_id, active, status, next_review_date);

ALTER TABLE public.property_inspection_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspection_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_compliance_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_inspection_programs_manager_scope ON public.property_inspection_programs;
CREATE POLICY property_inspection_programs_manager_scope ON public.property_inspection_programs FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS property_inspection_runs_manager_scope ON public.property_inspection_runs;
CREATE POLICY property_inspection_runs_manager_scope ON public.property_inspection_runs FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS property_inspection_findings_manager_scope ON public.property_inspection_findings;
CREATE POLICY property_inspection_findings_manager_scope ON public.property_inspection_findings FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS property_compliance_requirements_manager_scope ON public.property_compliance_requirements;
CREATE POLICY property_compliance_requirements_manager_scope ON public.property_compliance_requirements FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.property_inspection_programs, public.property_inspection_runs, public.property_inspection_findings, public.property_compliance_requirements FROM PUBLIC, anon;
GRANT SELECT ON public.property_inspection_programs, public.property_inspection_runs, public.property_inspection_findings, public.property_compliance_requirements TO authenticated;

CREATE OR REPLACE FUNCTION public.create_property_inspection_program_atomic(
  p_manager_id uuid,
  p_name text,
  p_inspection_type text DEFAULT 'periodic',
  p_frequency_days integer DEFAULT 90,
  p_next_due_date date DEFAULT CURRENT_DATE,
  p_property_id uuid DEFAULT NULL,
  p_checklist jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_name),'') IS NULL OR p_frequency_days IS NULL OR p_frequency_days <= 0 THEN RAISE EXCEPTION 'Name and positive frequency are required' USING ERRCODE='22023'; END IF;
  IF p_inspection_type NOT IN ('periodic','safety','compliance','handover','pre_lease','post_incident') THEN RAISE EXCEPTION 'Invalid inspection type' USING ERRCODE='22023'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  INSERT INTO public.property_inspection_programs(manager_id,property_id,name,inspection_type,frequency_days,next_due_date,checklist,created_by)
  VALUES(p_manager_id,p_property_id,trim(p_name),p_inspection_type,p_frequency_days,COALESCE(p_next_due_date,CURRENT_DATE),COALESCE(p_checklist,'[]'::jsonb),auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'program_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.generate_due_property_inspections_atomic(
  p_manager_id uuid,
  p_horizon_days integer DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_count integer := 0; v_run uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF p_horizon_days < 0 OR p_horizon_days > 365 THEN RAISE EXCEPTION 'Invalid horizon' USING ERRCODE='22023'; END IF;
  FOR r IN SELECT * FROM public.property_inspection_programs WHERE manager_id=p_manager_id AND active AND next_due_date <= CURRENT_DATE + p_horizon_days FOR UPDATE LOOP
    INSERT INTO public.property_inspection_runs(manager_id,program_id,property_id,scheduled_for,status)
    VALUES(r.manager_id,r.id,r.property_id,r.next_due_date,'scheduled')
    ON CONFLICT (program_id,scheduled_for) DO NOTHING RETURNING id INTO v_run;
    IF v_run IS NOT NULL THEN v_count := v_count + 1; END IF;
    v_run := NULL;
    UPDATE public.property_inspection_programs SET next_due_date = r.next_due_date + r.frequency_days, updated_at=now() WHERE id=r.id;
  END LOOP;
  RETURN jsonb_build_object('success',true,'generated_runs',v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.record_property_inspection_finding_atomic(
  p_inspection_run_id uuid,
  p_checklist_key text,
  p_checklist_label text,
  p_result text,
  p_score integer DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_evidence_urls text[] DEFAULT '{}',
  p_asset_id uuid DEFAULT NULL,
  p_raise_maintenance boolean DEFAULT false,
  p_maintenance_title text DEFAULT NULL,
  p_maintenance_description text DEFAULT NULL,
  p_priority text DEFAULT 'medium',
  p_category text DEFAULT 'other'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.property_inspection_runs%ROWTYPE; a public.maintenance_assets%ROWTYPE; v_finding uuid; v_request uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.property_inspection_runs WHERE id=p_inspection_run_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Inspection run outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_result NOT IN ('pass','attention','fail','not_applicable') OR (p_score IS NOT NULL AND (p_score < 0 OR p_score > 100)) THEN RAISE EXCEPTION 'Invalid inspection result' USING ERRCODE='22023'; END IF;
  IF p_asset_id IS NOT NULL THEN
    SELECT * INTO a FROM public.maintenance_assets WHERE id=p_asset_id;
    IF a.id IS NULL OR a.manager_id IS DISTINCT FROM r.manager_id THEN RAISE EXCEPTION 'Asset outside manager scope' USING ERRCODE='42501'; END IF;
  END IF;
  INSERT INTO public.property_inspection_findings(manager_id,inspection_run_id,checklist_key,checklist_label,result,score,notes,evidence_urls,asset_id,created_by)
  VALUES(r.manager_id,r.id,trim(p_checklist_key),trim(p_checklist_label),p_result,p_score,nullif(trim(p_notes),''),COALESCE(p_evidence_urls,'{}'),p_asset_id,auth.uid())
  ON CONFLICT (inspection_run_id,checklist_key) DO UPDATE SET checklist_label=EXCLUDED.checklist_label,result=EXCLUDED.result,score=EXCLUDED.score,notes=EXCLUDED.notes,evidence_urls=EXCLUDED.evidence_urls,asset_id=EXCLUDED.asset_id
  RETURNING id INTO v_finding;
  IF p_raise_maintenance AND p_result IN ('attention','fail') THEN
    IF nullif(trim(p_maintenance_title),'') IS NULL OR nullif(trim(p_maintenance_description),'') IS NULL THEN RAISE EXCEPTION 'Maintenance title and description required' USING ERRCODE='22023'; END IF;
    SELECT public.create_maintenance_request_atomic(
      p_title=>trim(p_maintenance_title), p_description=>trim(p_maintenance_description), p_property_name=>COALESCE((SELECT name FROM public.properties WHERE id=r.property_id),'Property inspection'),
      p_unit_id=>NULL, p_priority=>p_priority, p_category=>p_category, p_manager_id=>r.manager_id, p_created_by_role=>'manager'
    ) INTO v_result;
    v_request := (v_result->>'maintenance_request_id')::uuid;
    UPDATE public.property_inspection_findings SET maintenance_request_id=v_request WHERE id=v_finding;
    IF p_asset_id IS NOT NULL THEN UPDATE public.maintenance_requests SET asset_id=p_asset_id, updated_at=now() WHERE id=v_request; END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'finding_id',v_finding,'maintenance_request_id',v_request);
END; $$;

CREATE OR REPLACE FUNCTION public.complete_property_inspection_atomic(
  p_inspection_run_id uuid,
  p_overall_score integer,
  p_condition_status text,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.property_inspection_runs%ROWTYPE; v_findings integer; v_fails integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.property_inspection_runs WHERE id=p_inspection_run_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Inspection run outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_overall_score < 0 OR p_overall_score > 100 OR p_condition_status NOT IN ('excellent','good','fair','poor','critical') THEN RAISE EXCEPTION 'Invalid completion score or condition' USING ERRCODE='22023'; END IF;
  SELECT count(*),count(*) FILTER (WHERE result='fail') INTO v_findings,v_fails FROM public.property_inspection_findings WHERE inspection_run_id=r.id;
  IF v_findings=0 THEN RAISE EXCEPTION 'At least one inspection finding is required' USING ERRCODE='22023'; END IF;
  UPDATE public.property_inspection_runs SET status='completed',completed_at=now(),overall_score=p_overall_score,condition_status=p_condition_status,notes=COALESCE(nullif(trim(p_notes),''),notes),conducted_by=auth.uid(),updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'inspection_run_id',r.id,'findings',v_findings,'failed_findings',v_fails);
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_property_compliance_requirement_atomic(
  p_manager_id uuid,
  p_title text,
  p_property_id uuid DEFAULT NULL,
  p_authority text DEFAULT NULL,
  p_reference_code text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_review_frequency_days integer DEFAULT NULL,
  p_status text DEFAULT 'attention',
  p_evidence_document_id uuid DEFAULT NULL,
  p_last_verified_on date DEFAULT NULL,
  p_next_review_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_title),'') IS NULL OR p_status NOT IN ('compliant','attention','non_compliant','not_applicable') THEN RAISE EXCEPTION 'Title and valid status required' USING ERRCODE='22023'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_evidence_document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.landlord_documents d WHERE d.id=p_evidence_document_id AND d.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Evidence document outside manager scope' USING ERRCODE='42501'; END IF;
  INSERT INTO public.property_compliance_requirements(manager_id,property_id,title,authority,reference_code,due_date,review_frequency_days,status,evidence_document_id,last_verified_on,next_review_date,notes,created_by)
  VALUES(p_manager_id,p_property_id,trim(p_title),nullif(trim(p_authority),''),nullif(trim(p_reference_code),''),p_due_date,p_review_frequency_days,p_status,p_evidence_document_id,p_last_verified_on,p_next_review_date,nullif(trim(p_notes),''),auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'requirement_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_manager_property_inspection_compliance_control(
  p_manager_id uuid,
  p_horizon_days integer DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'active_programs',(SELECT count(*) FROM public.property_inspection_programs WHERE manager_id=p_manager_id AND active),
    'due_runs',(SELECT count(*) FROM public.property_inspection_runs WHERE manager_id=p_manager_id AND status IN ('scheduled','in_progress') AND scheduled_for<=CURRENT_DATE+p_horizon_days),
    'open_findings',(SELECT count(*) FROM public.property_inspection_findings WHERE manager_id=p_manager_id AND result IN ('attention','fail') AND maintenance_request_id IS NULL),
    'non_compliant',(SELECT count(*) FROM public.property_compliance_requirements WHERE manager_id=p_manager_id AND active AND status='non_compliant'),
    'compliance_due',(SELECT count(*) FROM public.property_compliance_requirements WHERE manager_id=p_manager_id AND active AND next_review_date IS NOT NULL AND next_review_date<=CURRENT_DATE+p_horizon_days),
    'programs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'inspection_type',p.inspection_type,'frequency_days',p.frequency_days,'next_due_date',p.next_due_date,'days_to_due',p.next_due_date-CURRENT_DATE,'run_count',(SELECT count(*) FROM public.property_inspection_runs r WHERE r.program_id=p.id)) ORDER BY p.next_due_date,p.name) FROM public.property_inspection_programs p WHERE p.manager_id=p_manager_id AND p.active),'[]'::jsonb),
    'runs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'program_id',r.program_id,'program_name',(SELECT p.name FROM public.property_inspection_programs p WHERE p.id=r.program_id),'scheduled_for',r.scheduled_for,'days_to_due',r.scheduled_for-CURRENT_DATE,'status',r.status,'overall_score',r.overall_score,'condition_status',r.condition_status,'finding_count',(SELECT count(*) FROM public.property_inspection_findings f WHERE f.inspection_run_id=r.id),'fail_count',(SELECT count(*) FROM public.property_inspection_findings f WHERE f.inspection_run_id=r.id AND f.result='fail')) ORDER BY r.scheduled_for,r.created_at DESC LIMIT 100) FROM public.property_inspection_runs r WHERE r.manager_id=p_manager_id AND r.status IN ('scheduled','in_progress')),'[]'::jsonb),
    'requirements',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'authority',c.authority,'reference_code',c.reference_code,'status',c.status,'due_date',c.due_date,'next_review_date',c.next_review_date,'days_to_review',CASE WHEN c.next_review_date IS NULL THEN NULL ELSE c.next_review_date-CURRENT_DATE END,'has_evidence',c.evidence_document_id IS NOT NULL) ORDER BY CASE c.status WHEN 'non_compliant' THEN 0 WHEN 'attention' THEN 1 ELSE 2 END,c.next_review_date NULLS LAST,c.title) FROM public.property_compliance_requirements c WHERE c.manager_id=p_manager_id AND c.active),'[]'::jsonb),
    'asset_risks',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'asset_reference',a.asset_reference,'asset_name',a.asset_name,'condition_status',a.condition_status,'criticality',a.criticality,'inspection_findings',(SELECT count(*) FROM public.property_inspection_findings f WHERE f.asset_id=a.id AND f.result IN ('attention','fail'))) FROM public.maintenance_assets a WHERE a.manager_id=p_manager_id AND a.active AND a.condition_status IN ('poor','critical') ORDER BY CASE a.condition_status WHEN 'critical' THEN 0 ELSE 1 END,a.asset_name LIMIT 50),'[]'::jsonb)
  );
END; $$;

REVOKE ALL ON FUNCTION public.create_property_inspection_program_atomic(uuid,text,text,integer,date,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_due_property_inspections_atomic(uuid,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_property_inspection_finding_atomic(uuid,text,text,text,integer,text,text[],uuid,boolean,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_property_inspection_atomic(uuid,integer,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_property_compliance_requirement_atomic(uuid,text,uuid,text,text,date,integer,text,uuid,date,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_manager_property_inspection_compliance_control(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_property_inspection_program_atomic(uuid,text,text,integer,date,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_property_inspections_atomic(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_property_inspection_finding_atomic(uuid,text,text,text,integer,text,text[],uuid,boolean,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_property_inspection_atomic(uuid,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_property_compliance_requirement_atomic(uuid,text,uuid,text,text,date,integer,text,uuid,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_property_inspection_compliance_control(uuid,integer) TO authenticated;

COMMENT ON TABLE public.property_inspection_programs IS 'Scheduled property inspection programmes; runs feed existing maintenance and asset controls.';
COMMENT ON TABLE public.property_inspection_findings IS 'Inspection checklist findings with evidence and optional canonical maintenance work-order linkage.';
COMMENT ON TABLE public.property_compliance_requirements IS 'Property-level compliance obligations and verification state linked to governed evidence.';

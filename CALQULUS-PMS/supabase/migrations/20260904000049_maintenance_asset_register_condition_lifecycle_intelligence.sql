-- CALQULUS PMS — Initiative 49: Maintenance Asset Register, Condition & Lifecycle Intelligence
-- Asset-level maintenance history without creating a parallel work-order or financial source of truth.

CREATE TABLE IF NOT EXISTS public.maintenance_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  asset_reference text NOT NULL,
  asset_name text NOT NULL,
  asset_type text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  installed_on date,
  expected_life_years integer CHECK (expected_life_years IS NULL OR expected_life_years > 0),
  replacement_due_date date,
  condition_status text NOT NULL DEFAULT 'good' CHECK (condition_status IN ('excellent','good','fair','poor','critical')),
  criticality text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id, asset_reference)
);

CREATE TABLE IF NOT EXISTS public.maintenance_asset_condition_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.maintenance_assets(id) ON DELETE CASCADE,
  assessed_on date NOT NULL DEFAULT CURRENT_DATE,
  condition_status text NOT NULL CHECK (condition_status IN ('excellent','good','fair','poor','critical')),
  condition_score integer CHECK (condition_score BETWEEN 0 AND 100),
  findings text,
  recommended_action text,
  assessed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.maintenance_assets(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_preventive_plans
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.maintenance_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maintenance_assets_manager_condition_idx
  ON public.maintenance_assets(manager_id,active,condition_status,criticality);
CREATE INDEX IF NOT EXISTS maintenance_assets_property_idx
  ON public.maintenance_assets(manager_id,property_id,unit_id,active);
CREATE INDEX IF NOT EXISTS maintenance_asset_assessments_asset_idx
  ON public.maintenance_asset_condition_assessments(manager_id,asset_id,assessed_on DESC);
CREATE INDEX IF NOT EXISTS maintenance_requests_asset_idx
  ON public.maintenance_requests(manager_id,asset_id,created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_preventive_plans_asset_idx
  ON public.maintenance_preventive_plans(manager_id,asset_id,active);

ALTER TABLE public.maintenance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_asset_condition_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maintenance_assets_manager_scope ON public.maintenance_assets;
CREATE POLICY maintenance_assets_manager_scope ON public.maintenance_assets
  FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS maintenance_asset_assessments_manager_scope ON public.maintenance_asset_condition_assessments;
CREATE POLICY maintenance_asset_assessments_manager_scope ON public.maintenance_asset_condition_assessments
  FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.maintenance_assets, public.maintenance_asset_condition_assessments FROM PUBLIC, anon;
GRANT SELECT ON public.maintenance_assets, public.maintenance_asset_condition_assessments TO authenticated;

CREATE OR REPLACE FUNCTION public.create_maintenance_asset_atomic(
  p_manager_id uuid,
  p_asset_reference text,
  p_asset_name text,
  p_asset_type text,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_manufacturer text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_serial_number text DEFAULT NULL,
  p_installed_on date DEFAULT NULL,
  p_expected_life_years integer DEFAULT NULL,
  p_replacement_due_date date DEFAULT NULL,
  p_condition_status text DEFAULT 'good',
  p_criticality text DEFAULT 'medium',
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_asset_reference),'') IS NULL OR nullif(trim(p_asset_name),'') IS NULL OR nullif(trim(p_asset_type),'') IS NULL THEN
    RAISE EXCEPTION 'Asset reference, name and type are required' USING ERRCODE='22023';
  END IF;
  IF p_condition_status NOT IN ('excellent','good','fair','poor','critical') OR p_criticality NOT IN ('low','medium','high','critical') THEN
    RAISE EXCEPTION 'Invalid condition or criticality' USING ERRCODE='22023';
  END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id) THEN
    RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.units u JOIN public.properties p ON p.id=u.property_id
    WHERE u.id=p_unit_id AND p.manager_id=p_manager_id
  ) THEN
    RAISE EXCEPTION 'Unit outside manager scope' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.maintenance_assets(
    manager_id,property_id,unit_id,asset_reference,asset_name,asset_type,manufacturer,model,serial_number,
    installed_on,expected_life_years,replacement_due_date,condition_status,criticality,notes,created_by
  ) VALUES (
    p_manager_id,p_property_id,p_unit_id,trim(p_asset_reference),trim(p_asset_name),trim(p_asset_type),
    nullif(trim(p_manufacturer),''),nullif(trim(p_model),''),nullif(trim(p_serial_number),''),p_installed_on,
    p_expected_life_years,p_replacement_due_date,p_condition_status,p_criticality,nullif(trim(p_notes),''),auth.uid()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'asset_id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_maintenance_asset_condition_atomic(
  p_asset_id uuid,
  p_condition_status text,
  p_condition_score integer DEFAULT NULL,
  p_findings text DEFAULT NULL,
  p_recommended_action text DEFAULT NULL,
  p_assessed_on date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.maintenance_assets%ROWTYPE; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.maintenance_assets WHERE id=p_asset_id FOR UPDATE;
  IF a.id IS NULL OR NOT public.can_manage_property_scope(a.manager_id) THEN
    RAISE EXCEPTION 'Asset outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_condition_status NOT IN ('excellent','good','fair','poor','critical') OR (p_condition_score IS NOT NULL AND (p_condition_score < 0 OR p_condition_score > 100)) THEN
    RAISE EXCEPTION 'Invalid condition assessment' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.maintenance_asset_condition_assessments(manager_id,asset_id,assessed_on,condition_status,condition_score,findings,recommended_action,assessed_by)
  VALUES(a.manager_id,a.id,COALESCE(p_assessed_on,CURRENT_DATE),p_condition_status,p_condition_score,nullif(trim(p_findings),''),nullif(trim(p_recommended_action),''),auth.uid())
  RETURNING id INTO v_id;
  UPDATE public.maintenance_assets
     SET condition_status=p_condition_status,updated_at=now()
   WHERE id=a.id;
  RETURN jsonb_build_object('success',true,'assessment_id',v_id,'asset_id',a.id,'condition_status',p_condition_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_maintenance_asset_atomic(
  p_request_id uuid,
  p_asset_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.maintenance_requests%ROWTYPE; a public.maintenance_assets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  SELECT * INTO a FROM public.maintenance_assets WHERE id=p_asset_id;
  IF r.id IS NULL OR a.id IS NULL OR r.manager_id IS DISTINCT FROM a.manager_id OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Maintenance request or asset outside manager scope' USING ERRCODE='42501';
  END IF;
  IF a.property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=a.property_id AND p.manager_id=r.manager_id) THEN
    RAISE EXCEPTION 'Asset property outside manager scope' USING ERRCODE='42501';
  END IF;
  UPDATE public.maintenance_requests SET asset_id=a.id,updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'request_id',r.id,'asset_id',a.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_preventive_plan_asset_atomic(
  p_plan_id uuid,
  p_asset_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.maintenance_preventive_plans%ROWTYPE; a public.maintenance_assets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO p FROM public.maintenance_preventive_plans WHERE id=p_plan_id FOR UPDATE;
  SELECT * INTO a FROM public.maintenance_assets WHERE id=p_asset_id;
  IF p.id IS NULL OR a.id IS NULL OR p.manager_id IS DISTINCT FROM a.manager_id OR NOT public.can_manage_property_scope(p.manager_id) THEN
    RAISE EXCEPTION 'Preventive plan or asset outside manager scope' USING ERRCODE='42501';
  END IF;
  UPDATE public.maintenance_preventive_plans SET asset_id=a.id,asset_reference=COALESCE(asset_reference,a.asset_reference),updated_at=now() WHERE id=p.id;
  RETURN jsonb_build_object('success',true,'plan_id',p.id,'asset_id',a.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_maintenance_asset_lifecycle_control(
  p_manager_id uuid,
  p_horizon_days integer DEFAULT 90
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_until date := CURRENT_DATE + GREATEST(COALESCE(p_horizon_days,90),0);
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'as_of_date',CURRENT_DATE,
    'horizon_date',v_until,
    'active_assets',(SELECT count(*) FROM public.maintenance_assets a WHERE a.manager_id=p_manager_id AND a.active),
    'poor_or_critical',(SELECT count(*) FROM public.maintenance_assets a WHERE a.manager_id=p_manager_id AND a.active AND a.condition_status IN ('poor','critical')),
    'replacement_due',(SELECT count(*) FROM public.maintenance_assets a WHERE a.manager_id=p_manager_id AND a.active AND a.replacement_due_date BETWEEN CURRENT_DATE AND v_until),
    'without_preventive_plan',(SELECT count(*) FROM public.maintenance_assets a WHERE a.manager_id=p_manager_id AND a.active AND NOT EXISTS (SELECT 1 FROM public.maintenance_preventive_plans p WHERE p.asset_id=a.id AND p.active)),
    'assets',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',a.id,'asset_reference',a.asset_reference,'asset_name',a.asset_name,'asset_type',a.asset_type,
      'property_id',a.property_id,'unit_id',a.unit_id,'condition_status',a.condition_status,'criticality',a.criticality,
      'manufacturer',a.manufacturer,'model',a.model,'serial_number',a.serial_number,'installed_on',a.installed_on,
      'replacement_due_date',a.replacement_due_date,
      'days_to_replacement',CASE WHEN a.replacement_due_date IS NULL THEN NULL ELSE (a.replacement_due_date-CURRENT_DATE) END,
      'preventive_plan_count',(SELECT count(*) FROM public.maintenance_preventive_plans p WHERE p.asset_id=a.id AND p.active),
      'maintenance_count',(SELECT count(*) FROM public.maintenance_requests m WHERE m.asset_id=a.id),
      'maintenance_spend',(SELECT COALESCE(sum(e.amount),0) FROM public.expenditures e JOIN public.maintenance_requests m ON m.id=e.maintenance_request_id WHERE m.asset_id=a.id AND e.manager_id=p_manager_id),
      'last_maintenance_date',(SELECT max(m.completion_date) FROM public.maintenance_requests m WHERE m.asset_id=a.id AND m.status='completed'),
      'last_assessment_date',(SELECT max(c.assessed_on) FROM public.maintenance_asset_condition_assessments c WHERE c.asset_id=a.id),
      'last_assessment_findings',(SELECT c.findings FROM public.maintenance_asset_condition_assessments c WHERE c.asset_id=a.id ORDER BY c.assessed_on DESC,c.created_at DESC LIMIT 1)
    ) ORDER BY CASE a.condition_status WHEN 'critical' THEN 1 WHEN 'poor' THEN 2 WHEN 'fair' THEN 3 WHEN 'good' THEN 4 ELSE 5 END,a.replacement_due_date NULLS LAST,a.asset_name)
      FROM public.maintenance_assets a WHERE a.manager_id=p_manager_id AND a.active LIMIT 150),'[]'::jsonb),
    'recent_assessments',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'asset_id',c.asset_id,'asset_reference',a.asset_reference,'assessed_on',c.assessed_on,'condition_status',c.condition_status,
      'condition_score',c.condition_score,'findings',c.findings,'recommended_action',c.recommended_action
    ) ORDER BY c.assessed_on DESC,c.created_at DESC) FROM public.maintenance_asset_condition_assessments c JOIN public.maintenance_assets a ON a.id=c.asset_id
      WHERE c.manager_id=p_manager_id LIMIT 50),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_maintenance_asset_atomic(uuid,text,text,text,uuid,uuid,text,text,text,date,integer,date,text,text,text), public.record_maintenance_asset_condition_atomic(uuid,text,integer,text,text,date), public.link_maintenance_asset_atomic(uuid,uuid), public.link_preventive_plan_asset_atomic(uuid,uuid), public.get_manager_maintenance_asset_lifecycle_control(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_maintenance_asset_atomic(uuid,text,text,text,uuid,uuid,text,text,text,date,integer,date,text,text,text), public.record_maintenance_asset_condition_atomic(uuid,text,integer,text,text,date), public.link_maintenance_asset_atomic(uuid,uuid), public.link_preventive_plan_asset_atomic(uuid,uuid), public.get_manager_maintenance_asset_lifecycle_control(uuid,integer) TO authenticated;

-- Preserve asset linkage when preventive runs create ordinary maintenance requests.
CREATE OR REPLACE FUNCTION public.generate_due_preventive_maintenance_atomic(
  p_manager_id uuid DEFAULT NULL,
  p_horizon_days integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_manager uuid := COALESCE(p_manager_id, public.get_effective_manager_id());
  r public.maintenance_preventive_plans%ROWTYPE;
  v_request uuid;
  v_generated integer := 0;
  v_until date := CURRENT_DATE + GREATEST(COALESCE(p_horizon_days,30),0);
BEGIN
  IF auth.uid() IS NULL OR v_manager IS NULL OR NOT public.can_manage_property_scope(v_manager) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  FOR r IN SELECT * FROM public.maintenance_preventive_plans WHERE manager_id=v_manager AND active AND next_due_date<=v_until ORDER BY next_due_date,created_at FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.maintenance_preventive_runs pr WHERE pr.plan_id=r.id AND pr.scheduled_for=r.next_due_date) THEN
      INSERT INTO public.maintenance_requests(
        title,description,property_name,unit_number,unit_id,tenant_name,tenant_email,priority,category,
        requested_date,expected_completion_date,budget,created_by_role,manager_id,status,asset_id
      ) VALUES (
        'Preventive: '||r.name,
        r.description||CASE WHEN r.asset_reference IS NOT NULL THEN ' Asset: '||r.asset_reference ELSE '' END,
        r.property_name,r.unit_number,r.unit_id,'','',r.priority,r.category,r.next_due_date,r.next_due_date,r.estimated_cost,'manager',r.manager_id,'open',r.asset_id
      ) RETURNING id INTO v_request;
      INSERT INTO public.maintenance_preventive_runs(plan_id,manager_id,scheduled_for,maintenance_request_id) VALUES(r.id,r.manager_id,r.next_due_date,v_request);
      UPDATE public.maintenance_requests SET vendor_id=r.vendor_id,vendor_contract_id=r.vendor_contract_id,updated_at=now() WHERE id=v_request;
      UPDATE public.maintenance_preventive_plans SET next_due_date=r.next_due_date+r.frequency_days,last_generated_at=now(),updated_at=now() WHERE id=r.id;
      v_generated:=v_generated+1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success',true,'manager_id',v_manager,'horizon_date',v_until,'generated',v_generated);
END;
$$;
REVOKE ALL ON FUNCTION public.generate_due_preventive_maintenance_atomic(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_due_preventive_maintenance_atomic(uuid,integer) TO authenticated;

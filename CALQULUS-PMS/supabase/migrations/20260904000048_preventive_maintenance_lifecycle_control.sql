-- CALQULUS PMS — Initiative 48: Property Maintenance Lifecycle & Preventive Maintenance Control
-- Recurring preventive maintenance schedules without creating a second work-order or financial source of truth.

CREATE TABLE IF NOT EXISTS public.maintenance_preventive_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  name text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  property_name text NOT NULL,
  unit_number text,
  asset_reference text,
  category text NOT NULL DEFAULT 'preventive',
  priority text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  frequency_days integer NOT NULL,
  next_due_date date NOT NULL,
  vendor_id uuid REFERENCES public.management_vendors(id) ON DELETE SET NULL,
  vendor_contract_id uuid REFERENCES public.vendor_contracts(id) ON DELETE SET NULL,
  estimated_cost numeric,
  active boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_preventive_plans_frequency_positive CHECK (frequency_days > 0),
  CONSTRAINT maintenance_preventive_plans_cost_nonnegative CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  CONSTRAINT maintenance_preventive_plans_priority_valid CHECK (priority IN ('low','medium','high','urgent'))
);

CREATE TABLE IF NOT EXISTS public.maintenance_preventive_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.maintenance_preventive_plans(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL,
  scheduled_for date NOT NULL,
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, scheduled_for)
);

ALTER TABLE public.maintenance_preventive_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_preventive_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maintenance_preventive_plans_manager_select ON public.maintenance_preventive_plans;
CREATE POLICY maintenance_preventive_plans_manager_select ON public.maintenance_preventive_plans
  FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS maintenance_preventive_runs_manager_select ON public.maintenance_preventive_runs;
CREATE POLICY maintenance_preventive_runs_manager_select ON public.maintenance_preventive_runs
  FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));

CREATE INDEX IF NOT EXISTS maintenance_preventive_plans_due_idx
  ON public.maintenance_preventive_plans(manager_id,active,next_due_date);
CREATE INDEX IF NOT EXISTS maintenance_preventive_plans_property_idx
  ON public.maintenance_preventive_plans(manager_id,property_id,unit_id,active);
CREATE INDEX IF NOT EXISTS maintenance_preventive_runs_plan_date_idx
  ON public.maintenance_preventive_runs(manager_id,plan_id,scheduled_for DESC);

CREATE OR REPLACE FUNCTION public.create_maintenance_preventive_plan_atomic(
  p_name text,
  p_description text,
  p_property_name text,
  p_frequency_days integer,
  p_next_due_date date,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_unit_number text DEFAULT NULL,
  p_asset_reference text DEFAULT NULL,
  p_category text DEFAULT 'preventive',
  p_priority text DEFAULT 'medium',
  p_vendor_id uuid DEFAULT NULL,
  p_vendor_contract_id uuid DEFAULT NULL,
  p_estimated_cost numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_manager IS NULL OR NOT public.can_manage_property_scope(v_manager) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_name),'') IS NULL OR nullif(trim(p_description),'') IS NULL OR nullif(trim(p_property_name),'') IS NULL THEN
    RAISE EXCEPTION 'Plan name, description and property are required' USING ERRCODE='22023';
  END IF;
  IF p_frequency_days IS NULL OR p_frequency_days < 1 THEN RAISE EXCEPTION 'Frequency must be positive' USING ERRCODE='22023'; END IF;
  IF p_next_due_date IS NULL THEN RAISE EXCEPTION 'Next due date is required' USING ERRCODE='22023'; END IF;
  IF p_priority NOT IN ('low','medium','high','urgent') THEN RAISE EXCEPTION 'Invalid priority' USING ERRCODE='22023'; END IF;
  IF p_estimated_cost IS NOT NULL AND p_estimated_cost < 0 THEN RAISE EXCEPTION 'Estimated cost cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_manager) THEN
    RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units u JOIN public.properties p ON p.id=u.property_id WHERE u.id=p_unit_id AND p.manager_id=v_manager) THEN
    RAISE EXCEPTION 'Unit outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_vendor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.management_vendors v WHERE v.id=p_vendor_id AND v.manager_id=v_manager AND v.status='active') THEN
    RAISE EXCEPTION 'Vendor outside manager scope or inactive' USING ERRCODE='42501';
  END IF;
  IF p_vendor_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_contracts c WHERE c.id=p_vendor_contract_id AND c.manager_id=v_manager AND c.vendor_id=p_vendor_id
  ) THEN RAISE EXCEPTION 'Contract outside vendor scope' USING ERRCODE='42501'; END IF;

  INSERT INTO public.maintenance_preventive_plans(
    manager_id,name,description,property_name,frequency_days,next_due_date,property_id,unit_id,unit_number,
    asset_reference,category,priority,vendor_id,vendor_contract_id,estimated_cost,created_by
  ) VALUES (
    v_manager,trim(p_name),trim(p_description),trim(p_property_name),p_frequency_days,p_next_due_date,p_property_id,p_unit_id,
    nullif(trim(p_unit_number),''),nullif(trim(p_asset_reference),''),COALESCE(nullif(trim(p_category),''),'preventive'),p_priority,
    p_vendor_id,p_vendor_contract_id,p_estimated_cost,auth.uid()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'plan_id',v_id,'next_due_date',p_next_due_date);
END;
$$;

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
  FOR r IN
    SELECT * FROM public.maintenance_preventive_plans
    WHERE manager_id=v_manager AND active AND next_due_date<=v_until
    ORDER BY next_due_date, created_at
    FOR UPDATE
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.maintenance_preventive_runs pr WHERE pr.plan_id=r.id AND pr.scheduled_for=r.next_due_date) THEN
      INSERT INTO public.maintenance_requests(
        title,description,property_name,unit_number,unit_id,tenant_name,tenant_email,priority,category,
        requested_date,expected_completion_date,budget,created_by_role,manager_id,status
      ) VALUES (
        'Preventive: '||r.name,
        r.description||CASE WHEN r.asset_reference IS NOT NULL THEN ' Asset: '||r.asset_reference ELSE '' END,
        r.property_name,r.unit_number,r.unit_id,'','',r.priority,r.category,r.next_due_date,r.next_due_date,r.estimated_cost,'manager',r.manager_id,'open'
      ) RETURNING id INTO v_request;

      INSERT INTO public.maintenance_preventive_runs(plan_id,manager_id,scheduled_for,maintenance_request_id)
      VALUES(r.id,r.manager_id,r.next_due_date,v_request);

      UPDATE public.maintenance_requests
      SET vendor_id=r.vendor_id,vendor_contract_id=r.vendor_contract_id,updated_at=now()
      WHERE id=v_request;

      UPDATE public.maintenance_preventive_plans
      SET next_due_date=r.next_due_date + r.frequency_days,
          last_generated_at=now(),updated_at=now()
      WHERE id=r.id;
      v_generated := v_generated + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success',true,'manager_id',v_manager,'horizon_date',v_until,'generated',v_generated);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_preventive_maintenance_control(
  p_manager_id uuid,
  p_horizon_days integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_until date := CURRENT_DATE + GREATEST(COALESCE(p_horizon_days,30),0);
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'as_of_date',CURRENT_DATE,
    'horizon_date',v_until,
    'active_plans',(SELECT count(*) FROM public.maintenance_preventive_plans p WHERE p.manager_id=p_manager_id AND p.active),
    'due_next_30d',(SELECT count(*) FROM public.maintenance_preventive_plans p WHERE p.manager_id=p_manager_id AND p.active AND p.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30),
    'overdue_plans',(SELECT count(*) FROM public.maintenance_preventive_plans p WHERE p.manager_id=p_manager_id AND p.active AND p.next_due_date<CURRENT_DATE),
    'generated_next_horizon',(SELECT count(*) FROM public.maintenance_preventive_runs r WHERE r.manager_id=p_manager_id AND r.scheduled_for BETWEEN CURRENT_DATE AND v_until),
    'plans',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'property_name',p.property_name,'unit_number',p.unit_number,'asset_reference',p.asset_reference,
      'category',p.category,'priority',p.priority,'frequency_days',p.frequency_days,'next_due_date',p.next_due_date,
      'vendor_name',v.name,'contract_reference',c.contract_reference,'estimated_cost',p.estimated_cost,'active',p.active,
      'last_generated_at',p.last_generated_at,
      'days_to_due',(p.next_due_date-CURRENT_DATE),
      'run_count',(SELECT count(*) FROM public.maintenance_preventive_runs pr WHERE pr.plan_id=p.id)
    ) ORDER BY p.next_due_date,p.name) FROM public.maintenance_preventive_plans p
      LEFT JOIN public.management_vendors v ON v.id=p.vendor_id
      LEFT JOIN public.vendor_contracts c ON c.id=p.vendor_contract_id
      WHERE p.manager_id=p_manager_id LIMIT 100),'[]'::jsonb),
    'recent_runs',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'plan_id',r.plan_id,'scheduled_for',r.scheduled_for,'generated_at',r.generated_at,
      'maintenance_request_id',r.maintenance_request_id,'request_status',m.status,'request_title',m.title
    ) ORDER BY r.scheduled_for DESC,r.generated_at DESC) FROM public.maintenance_preventive_runs r
      LEFT JOIN public.maintenance_requests m ON m.id=r.maintenance_request_id
      WHERE r.manager_id=p_manager_id LIMIT 50),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON TABLE public.maintenance_preventive_plans, public.maintenance_preventive_runs FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.maintenance_preventive_plans, public.maintenance_preventive_runs FROM authenticated;
REVOKE ALL ON FUNCTION public.create_maintenance_preventive_plan_atomic(text,text,text,integer,date,uuid,uuid,text,text,text,text,uuid,uuid,numeric), public.generate_due_preventive_maintenance_atomic(uuid,integer), public.get_manager_preventive_maintenance_control(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_maintenance_preventive_plan_atomic(text,text,text,integer,date,uuid,uuid,text,text,text,text,uuid,uuid,numeric), public.generate_due_preventive_maintenance_atomic(uuid,integer), public.get_manager_preventive_maintenance_control(uuid,integer) TO authenticated;

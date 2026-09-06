-- PHASE 72: Workflow orchestration mutation convergence
-- All workflow writes are server-authorized through SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.save_workflow_template_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.workflow_templates%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.workflow_templates(name,category,description,steps,average_duration,usage_count,status,last_used)
    VALUES (trim(p_payload->>'name'), p_payload->>'category', p_payload->>'description', COALESCE((p_payload->>'steps')::integer,0), p_payload->>'average_duration', COALESCE((p_payload->>'usage_count')::integer,0), COALESCE(p_payload->>'status','draft'), COALESCE((p_payload->>'last_used')::timestamptz,now())) RETURNING * INTO r;
  ELSE
    UPDATE public.workflow_templates SET name=COALESCE(p_payload->>'name',name), description=COALESCE(p_payload->>'description',description), status=COALESCE(p_payload->>'status',status), last_used=COALESCE((p_payload->>'last_used')::timestamptz,last_used) WHERE id=p_id RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workflow template not found'; END IF;
  END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.save_workflow_instance_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.workflow_instances%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.workflow_instances(template_id,entity_id,entity_name,entity_type,status,current_step,total_steps,progress,assignee,estimated_completion)
    VALUES ((p_payload->>'template_id')::uuid,(p_payload->>'entity_id')::uuid,p_payload->>'entity_name',p_payload->>'entity_type',COALESCE(p_payload->>'status','running'),COALESCE((p_payload->>'current_step')::integer,1),COALESCE((p_payload->>'total_steps')::integer,0),COALESCE((p_payload->>'progress')::numeric,0),p_payload->>'assignee',(p_payload->>'estimated_completion')::timestamptz) RETURNING * INTO r;
  ELSE
    UPDATE public.workflow_instances SET status=COALESCE(p_payload->>'status',status), current_step=COALESCE((p_payload->>'current_step')::integer,current_step), progress=COALESCE((p_payload->>'progress')::numeric,progress), completed_date=COALESCE((p_payload->>'completed_date')::timestamptz,completed_date), estimated_completion=COALESCE((p_payload->>'estimated_completion')::timestamptz,estimated_completion) WHERE id=p_id RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workflow instance not found'; END IF;
  END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.save_workflow_step_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.workflow_steps%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.workflow_steps(workflow_instance_id,step_number,name,description,type,status,assignee,started_date,completed_date)
    VALUES ((p_payload->>'workflow_instance_id')::uuid,(p_payload->>'step_number')::integer,p_payload->>'name',p_payload->>'description',p_payload->>'type',COALESCE(p_payload->>'status','pending'),p_payload->>'assignee',(p_payload->>'started_date')::timestamptz,(p_payload->>'completed_date')::timestamptz) RETURNING * INTO r;
  ELSE
    UPDATE public.workflow_steps SET status=COALESCE(p_payload->>'status',status), assignee=COALESCE(p_payload->>'assignee',assignee), started_date=COALESCE((p_payload->>'started_date')::timestamptz,started_date), completed_date=COALESCE((p_payload->>'completed_date')::timestamptz,completed_date) WHERE id=p_id RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workflow step not found'; END IF;
  END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.save_workflow_automation_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.workflow_automations%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.workflow_automations(name,trigger,action,target,frequency,status,last_run,next_run,success_rate)
    VALUES (trim(p_payload->>'name'),p_payload->>'trigger',p_payload->>'action',p_payload->>'target',p_payload->>'frequency',COALESCE(p_payload->>'status','active'),(p_payload->>'last_run')::timestamptz,(p_payload->>'next_run')::timestamptz,COALESCE((p_payload->>'success_rate')::numeric,0)) RETURNING * INTO r;
  ELSE
    UPDATE public.workflow_automations SET name=COALESCE(p_payload->>'name',name), trigger=COALESCE(p_payload->>'trigger',trigger), action=COALESCE(p_payload->>'action',action), target=COALESCE(p_payload->>'target',target), frequency=COALESCE(p_payload->>'frequency',frequency), status=COALESCE(p_payload->>'status',status), last_run=COALESCE((p_payload->>'last_run')::timestamptz,last_run), next_run=COALESCE((p_payload->>'next_run')::timestamptz,next_run), success_rate=COALESCE((p_payload->>'success_rate')::numeric,success_rate) WHERE id=p_id RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workflow automation not found'; END IF;
  END IF;
  RETURN to_jsonb(r);
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.workflow_templates, public.workflow_instances, public.workflow_steps, public.workflow_automations FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_workflow_template_atomic(uuid,jsonb), public.save_workflow_instance_atomic(uuid,jsonb), public.save_workflow_step_atomic(uuid,jsonb), public.save_workflow_automation_atomic(uuid,jsonb) TO authenticated;

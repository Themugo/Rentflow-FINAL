-- PHASE 86: Administration, settings and orchestration mutation convergence
-- Restores the missing RPC layer from the latest package baseline and closes residual direct writes.

-- Phase 76: Manager financial & organization settings mutation convergence
CREATE UNIQUE INDEX IF NOT EXISTS agencies_manager_id_uniq ON agencies(manager_id) WHERE manager_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_manager_bank_details_atomic(p_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_manager uuid := auth.uid(); v_existing_manager uuid;
BEGIN
  IF v_manager IS NULL OR NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role IN ('manager','agency') AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
  IF p_payload->>'bank_name' IS NULL OR btrim(p_payload->>'bank_name')='' OR p_payload->>'account_name' IS NULL OR btrim(p_payload->>'account_name')='' OR p_payload->>'account_number' IS NULL OR btrim(p_payload->>'account_number')='' THEN RAISE EXCEPTION 'Bank name, account name and account number are required'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT manager_id INTO v_existing_manager FROM bank_details WHERE id=p_id FOR UPDATE;
    IF v_existing_manager IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Not authorized to modify this bank account'; END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO bank_details(manager_id,bank_name,account_name,account_number,branch_name,swift_code,paybill_number,till_number,property_id,unit_id,account_label,is_default)
    VALUES(v_manager,p_payload->>'bank_name',p_payload->>'account_name',p_payload->>'account_number',NULLIF(p_payload->>'branch_name',''),NULLIF(p_payload->>'swift_code',''),NULLIF(p_payload->>'paybill_number',''),NULLIF(p_payload->>'till_number',''),NULLIF(p_payload->>'property_id','')::uuid,NULLIF(p_payload->>'unit_id','')::uuid,NULLIF(p_payload->>'account_label',''),COALESCE((p_payload->>'is_default')::boolean,false)) RETURNING id INTO v_id;
  ELSE
    UPDATE bank_details SET bank_name=p_payload->>'bank_name',account_name=p_payload->>'account_name',account_number=p_payload->>'account_number',branch_name=NULLIF(p_payload->>'branch_name',''),swift_code=NULLIF(p_payload->>'swift_code',''),paybill_number=NULLIF(p_payload->>'paybill_number',''),till_number=NULLIF(p_payload->>'till_number',''),property_id=NULLIF(p_payload->>'property_id','')::uuid,unit_id=NULLIF(p_payload->>'unit_id','')::uuid,account_label=NULLIF(p_payload->>'account_label',''),is_default=COALESCE((p_payload->>'is_default')::boolean,false),updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
  END IF;
  IF COALESCE((p_payload->>'is_default')::boolean,false) THEN UPDATE bank_details SET is_default=false,updated_at=now() WHERE manager_id=v_manager AND id<>v_id; END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_manager_bank_details_atomic(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bank_details WHERE id=p_id AND manager_id=auth.uid()) THEN RAISE EXCEPTION 'Not authorized to delete this bank account'; END IF;
  DELETE FROM bank_details WHERE id=p_id; RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.save_manager_ewallet_settings_atomic(p_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_manager uuid:=auth.uid();
BEGIN
 IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
 SELECT id INTO v_id FROM manager_ewallet_settings WHERE manager_user_id=v_manager AND property_id IS NOT DISTINCT FROM NULLIF(p_payload->>'property_id','')::uuid AND unit_id IS NOT DISTINCT FROM NULLIF(p_payload->>'unit_id','')::uuid AND provider=COALESCE(NULLIF(p_payload->>'provider',''),provider) LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN INSERT INTO manager_ewallet_settings(manager_user_id,property_id,provider,wallet_id,wallet_phone,wallet_name,is_enabled,instructions,unit_id) VALUES(v_manager,NULLIF(p_payload->>'property_id','')::uuid,p_payload->>'provider',NULLIF(p_payload->>'wallet_id',''),NULLIF(p_payload->>'wallet_phone',''),NULLIF(p_payload->>'wallet_name',''),COALESCE((p_payload->>'is_enabled')::boolean,false),NULLIF(p_payload->>'instructions',''),NULLIF(p_payload->>'unit_id','')::uuid) RETURNING id INTO v_id;
 ELSE UPDATE manager_ewallet_settings SET provider=p_payload->>'provider',wallet_id=NULLIF(p_payload->>'wallet_id',''),wallet_phone=NULLIF(p_payload->>'wallet_phone',''),wallet_name=NULLIF(p_payload->>'wallet_name',''),is_enabled=COALESCE((p_payload->>'is_enabled')::boolean,false),instructions=NULLIF(p_payload->>'instructions','') WHERE id=v_id; END IF; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_manager_company_settings_atomic(p_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_manager uuid:=auth.uid(); v_role text;
BEGIN
 SELECT role INTO v_role FROM user_roles WHERE user_id=v_manager AND role IN ('manager','agency','landlord') AND COALESCE(approval_status,'approved')='approved' LIMIT 1;
 IF v_role IS NULL THEN RAISE EXCEPTION 'Organization authorization required'; END IF;
 SELECT id INTO v_id FROM company_settings WHERE manager_user_id=v_manager LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN INSERT INTO company_settings(manager_user_id,company_name,address,city,state,zip_code,email,phone,website,brand_primary_hex,white_label_enabled,brand_config,logo_url) VALUES(v_manager,COALESCE(NULLIF(p_payload->>'company_name',''),'My Company'),NULLIF(p_payload->>'address',''),NULLIF(p_payload->>'city',''),NULLIF(p_payload->>'state',''),NULLIF(p_payload->>'zip_code',''),NULLIF(p_payload->>'email',''),NULLIF(p_payload->>'phone',''),NULLIF(p_payload->>'website',''),NULLIF(p_payload->>'brand_primary_hex',''),COALESCE((p_payload->>'white_label_enabled')::boolean,false),COALESCE(p_payload->'brand_config','{}'::jsonb),NULLIF(p_payload->>'logo_url','')) RETURNING id INTO v_id;
 ELSE UPDATE company_settings SET company_name=COALESCE(NULLIF(p_payload->>'company_name',''),company_name),address=NULLIF(p_payload->>'address',''),city=NULLIF(p_payload->>'city',''),state=NULLIF(p_payload->>'state',''),zip_code=NULLIF(p_payload->>'zip_code',''),email=NULLIF(p_payload->>'email',''),phone=NULLIF(p_payload->>'phone',''),website=NULLIF(p_payload->>'website',''),brand_primary_hex=NULLIF(p_payload->>'brand_primary_hex',''),white_label_enabled=COALESCE((p_payload->>'white_label_enabled')::boolean,white_label_enabled),brand_config=COALESCE(p_payload->'brand_config',brand_config),logo_url=NULLIF(p_payload->>'logo_url',''),updated_at=now() WHERE id=v_id; END IF;
 IF v_role IN ('manager','agency') AND to_regclass('public.agencies') IS NOT NULL THEN INSERT INTO agencies(manager_id,name,email,phone,address,county,kra_pin,registration_number,whatsapp,website) VALUES(v_manager,COALESCE(NULLIF(p_payload->>'company_name',''),'My Agency'),NULLIF(p_payload->>'email',''),NULLIF(p_payload->>'phone',''),NULLIF(p_payload->>'address',''),NULLIF(p_payload->>'county',''),NULLIF(p_payload->>'kra_pin',''),NULLIF(p_payload->>'registration_number',''),NULLIF(p_payload->>'whatsapp',''),NULLIF(p_payload->>'website','')) ON CONFLICT (manager_id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone=EXCLUDED.phone,address=EXCLUDED.address,county=EXCLUDED.county,kra_pin=EXCLUDED.kra_pin,registration_number=EXCLUDED.registration_number,whatsapp=EXCLUDED.whatsapp,website=EXCLUDED.website; END IF;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_manager_receipt_settings_atomic(p_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_manager uuid:=auth.uid();
BEGIN
 IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
 SELECT id INTO v_id FROM receipt_settings WHERE manager_user_id=v_manager LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN INSERT INTO receipt_settings(manager_user_id,auto_send_receipts,primary_color,secondary_color,footer_message,include_logo) VALUES(v_manager,COALESCE((p_payload->>'auto_send_receipts')::boolean,false),NULLIF(p_payload->>'primary_color',''),NULLIF(p_payload->>'secondary_color',''),NULLIF(p_payload->>'footer_message',''),COALESCE((p_payload->>'include_logo')::boolean,false)) RETURNING id INTO v_id;
 ELSE UPDATE receipt_settings SET auto_send_receipts=COALESCE((p_payload->>'auto_send_receipts')::boolean,auto_send_receipts),primary_color=NULLIF(p_payload->>'primary_color',''),secondary_color=NULLIF(p_payload->>'secondary_color',''),footer_message=NULLIF(p_payload->>'footer_message',''),include_logo=COALESCE((p_payload->>'include_logo')::boolean,include_logo),updated_at=now() WHERE id=v_id; END IF; RETURN v_id;
END $$;

REVOKE INSERT,UPDATE,DELETE ON bank_details,manager_ewallet_settings,company_settings,agencies,receipt_settings FROM authenticated,anon;
REVOKE ALL ON FUNCTION public.save_manager_bank_details_atomic(uuid,jsonb),public.delete_manager_bank_details_atomic(uuid),public.save_manager_ewallet_settings_atomic(jsonb),public.save_manager_company_settings_atomic(jsonb),public.save_manager_receipt_settings_atomic(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_manager_bank_details_atomic(uuid,jsonb),public.delete_manager_bank_details_atomic(uuid),public.save_manager_ewallet_settings_atomic(jsonb),public.save_manager_company_settings_atomic(jsonb),public.save_manager_receipt_settings_atomic(jsonb) TO authenticated,service_role;
-- Phase 77: Submanager administration and role convergence
CREATE UNIQUE INDEX IF NOT EXISTS manager_submanagers_pair_uniq ON manager_submanagers(manager_id,submanager_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS submanager_permissions_user_uniq ON submanager_permissions(submanager_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS submanager_assignment_pair_uniq ON submanager_property_assignments(manager_id,submanager_user_id,property_id);

CREATE OR REPLACE FUNCTION public.provision_submanager_atomic(p_submanager_user_id uuid,p_permissions jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
 INSERT INTO user_roles(user_id,role,approval_status) VALUES(p_submanager_user_id,'submanager','approved') ON CONFLICT (user_id,role) DO UPDATE SET approval_status='approved';
 INSERT INTO manager_submanagers(manager_id,submanager_user_id) VALUES(v_manager,p_submanager_user_id) ON CONFLICT DO NOTHING;
 INSERT INTO submanager_permissions(manager_id,submanager_user_id,can_view_properties,can_view_tenants,can_view_leases,can_view_invoices,can_view_maintenance,can_view_contracts,can_view_activity_logs,restrict_to_assigned_properties)
 VALUES(v_manager,p_submanager_user_id,COALESCE((p_permissions->>'can_view_properties')::boolean,true),COALESCE((p_permissions->>'can_view_tenants')::boolean,true),COALESCE((p_permissions->>'can_view_leases')::boolean,true),COALESCE((p_permissions->>'can_view_invoices')::boolean,true),COALESCE((p_permissions->>'can_view_maintenance')::boolean,true),COALESCE((p_permissions->>'can_view_contracts')::boolean,true),COALESCE((p_permissions->>'can_view_activity_logs')::boolean,false),COALESCE((p_permissions->>'restrict_to_assigned_properties')::boolean,false)) ON CONFLICT (submanager_user_id) DO UPDATE SET can_view_properties=EXCLUDED.can_view_properties,can_view_tenants=EXCLUDED.can_view_tenants,can_view_leases=EXCLUDED.can_view_leases,can_view_invoices=EXCLUDED.can_view_invoices,can_view_maintenance=EXCLUDED.can_view_maintenance,can_view_contracts=EXCLUDED.can_view_contracts,can_view_activity_logs=EXCLUDED.can_view_activity_logs,restrict_to_assigned_properties=EXCLUDED.restrict_to_assigned_properties,updated_at=now();
 SELECT id INTO v_id FROM manager_submanagers WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_submanager_permissions_atomic(p_submanager_user_id uuid,p_permissions jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM manager_submanagers WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id) THEN RAISE EXCEPTION 'Submanager is not assigned to this manager'; END IF;
 INSERT INTO submanager_permissions(manager_id,submanager_user_id,can_view_properties,can_view_tenants,can_view_leases,can_view_invoices,can_view_maintenance,can_view_contracts,can_view_activity_logs,restrict_to_assigned_properties) VALUES(v_manager,p_submanager_user_id,COALESCE((p_permissions->>'can_view_properties')::boolean,false),COALESCE((p_permissions->>'can_view_tenants')::boolean,false),COALESCE((p_permissions->>'can_view_leases')::boolean,false),COALESCE((p_permissions->>'can_view_invoices')::boolean,false),COALESCE((p_permissions->>'can_view_maintenance')::boolean,false),COALESCE((p_permissions->>'can_view_contracts')::boolean,false),COALESCE((p_permissions->>'can_view_activity_logs')::boolean,false),COALESCE((p_permissions->>'restrict_to_assigned_properties')::boolean,false)) ON CONFLICT (submanager_user_id) DO UPDATE SET can_view_properties=EXCLUDED.can_view_properties,can_view_tenants=EXCLUDED.can_view_tenants,can_view_leases=EXCLUDED.can_view_leases,can_view_invoices=EXCLUDED.can_view_invoices,can_view_maintenance=EXCLUDED.can_view_maintenance,can_view_contracts=EXCLUDED.can_view_contracts,can_view_activity_logs=EXCLUDED.can_view_activity_logs,restrict_to_assigned_properties=EXCLUDED.restrict_to_assigned_properties,updated_at=now() RETURNING id INTO v_id; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_submanager_property_assignments_atomic(p_submanager_user_id uuid,p_property_ids uuid[],p_restrict boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_count integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM manager_submanagers WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id) THEN RAISE EXCEPTION 'Submanager is not assigned to this manager'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_property_ids,ARRAY[]::uuid[])) x(id) WHERE NOT EXISTS (SELECT 1 FROM properties WHERE id=x.id AND manager_id=v_manager)) THEN RAISE EXCEPTION 'One or more properties are outside your portfolio'; END IF;
 DELETE FROM submanager_property_assignments WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id;
 INSERT INTO submanager_property_assignments(manager_id,submanager_user_id,property_id) SELECT v_manager,p_submanager_user_id,x FROM unnest(COALESCE(p_property_ids,ARRAY[]::uuid[])) x ON CONFLICT DO NOTHING;
 UPDATE submanager_permissions SET restrict_to_assigned_properties=COALESCE(p_restrict,false),updated_at=now() WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id;
 SELECT count(*) INTO v_count FROM submanager_property_assignments WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id; RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.remove_submanager_atomic(p_submanager_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_sub uuid;
BEGIN
 SELECT submanager_user_id INTO v_sub FROM manager_submanagers WHERE id=p_submanager_id AND manager_id=v_manager FOR UPDATE;
 IF v_sub IS NULL THEN RAISE EXCEPTION 'Submanager not found or unauthorized'; END IF;
 DELETE FROM submanager_property_assignments WHERE manager_id=v_manager AND submanager_user_id=v_sub;
 DELETE FROM submanager_permissions WHERE manager_id=v_manager AND submanager_user_id=v_sub;
 DELETE FROM manager_submanagers WHERE id=p_submanager_id;
 DELETE FROM user_roles WHERE user_id=v_sub AND role='submanager';
 RETURN v_sub;
END $$;

REVOKE INSERT,UPDATE,DELETE ON manager_submanagers,submanager_permissions,submanager_property_assignments,user_roles FROM authenticated,anon;
REVOKE ALL ON FUNCTION public.provision_submanager_atomic(uuid,jsonb),public.save_submanager_permissions_atomic(uuid,jsonb),public.save_submanager_property_assignments_atomic(uuid,uuid[],boolean),public.remove_submanager_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.provision_submanager_atomic(uuid,jsonb),public.save_submanager_permissions_atomic(uuid,jsonb),public.save_submanager_property_assignments_atomic(uuid,uuid[],boolean),public.remove_submanager_atomic(uuid) TO authenticated,service_role;
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
-- PHASE 73: Utility connection/billing mutation convergence

CREATE OR REPLACE FUNCTION public.save_utility_connection_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.utility_connections%ROWTYPE; v_property uuid; v_manager uuid;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  v_property := (p_payload->>'property_id')::uuid;
  IF p_id IS NULL THEN
    INSERT INTO public.utility_connections(provider_id,property_id,unit,utility_type,connection_type,status,connection_date,monthly_rate,current_reading,previous_reading,last_billing_date,next_billing_date)
    VALUES ((p_payload->>'provider_id')::uuid,v_property,p_payload->>'unit',p_payload->>'utility_type',p_payload->>'connection_type',COALESCE(p_payload->>'status','pending'),COALESCE((p_payload->>'connection_date')::timestamptz,now()),COALESCE((p_payload->>'monthly_rate')::numeric,0),COALESCE((p_payload->>'current_reading')::numeric,0),COALESCE((p_payload->>'previous_reading')::numeric,0),(p_payload->>'last_billing_date')::timestamptz,(p_payload->>'next_billing_date')::timestamptz) RETURNING * INTO r;
  ELSE
    SELECT property_id INTO v_property FROM public.utility_connections WHERE id=p_id FOR UPDATE;
    UPDATE public.utility_connections SET status=COALESCE(p_payload->>'status',status), current_reading=COALESCE((p_payload->>'current_reading')::numeric,current_reading), previous_reading=COALESCE((p_payload->>'previous_reading')::numeric,previous_reading), last_billing_date=COALESCE((p_payload->>'last_billing_date')::timestamptz,last_billing_date), next_billing_date=COALESCE((p_payload->>'next_billing_date')::timestamptz,next_billing_date) WHERE id=p_id RETURNING * INTO r;
  END IF;
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=v_property;
  IF v_manager IS NULL AND NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Property not found'; END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.save_utility_bill_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.utility_bills%ROWTYPE; v_property uuid;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  v_property := (p_payload->>'property_id')::uuid;
  IF p_id IS NULL THEN
    INSERT INTO public.utility_bills(connection_id,provider_id,property_id,unit,utility_type,billing_period,consumption,rate,amount,status,due_date,paid_date)
    VALUES ((p_payload->>'connection_id')::uuid,(p_payload->>'provider_id')::uuid,v_property,p_payload->>'unit',p_payload->>'utility_type',p_payload->>'billing_period',COALESCE((p_payload->>'consumption')::numeric,0),COALESCE((p_payload->>'rate')::numeric,0),COALESCE((p_payload->>'amount')::numeric,0),COALESCE(p_payload->>'status','pending'),(p_payload->>'due_date')::timestamptz,(p_payload->>'paid_date')::timestamptz) RETURNING * INTO r;
  ELSE
    SELECT property_id INTO v_property FROM public.utility_bills WHERE id=p_id FOR UPDATE;
    UPDATE public.utility_bills SET status=COALESCE(p_payload->>'status',status), paid_date=COALESCE((p_payload->>'paid_date')::timestamptz,paid_date) WHERE id=p_id RETURNING * INTO r;
  END IF;
  RETURN to_jsonb(r);
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.utility_connections, public.utility_bills FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_utility_connection_atomic(uuid,jsonb), public.save_utility_bill_atomic(uuid,jsonb) TO authenticated;
-- Phase 86: residual settings mutation convergence
ALTER TABLE public.manager_notification_settings
  ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_maintenance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_leases boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_security boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.update_profile_settings_atomic(p_full_name text, p_phone text, p_email text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.profiles%ROWTYPE; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles
     SET full_name = NULLIF(btrim(p_full_name), ''),
         phone = NULLIF(btrim(p_phone), ''),
         email = COALESCE(NULLIF(btrim(p_email), ''), email),
         updated_at = now()
   WHERE id = v_user
   RETURNING * INTO r;
  IF NOT FOUND THEN
    INSERT INTO public.profiles(id,email,full_name,phone) VALUES(v_user,COALESCE(NULLIF(btrim(p_email),''),(SELECT email FROM auth.users WHERE id=v_user)),NULLIF(btrim(p_full_name),''),NULLIF(btrim(p_phone),'')) RETURNING * INTO r;
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.save_webhost_tier_price_atomic(p_tier_id uuid, p_price_per_property numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tier_key text;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  IF p_price_per_property IS NULL OR p_price_per_property < 0 THEN RAISE EXCEPTION 'Price must be non-negative'; END IF;
  SELECT tier_key INTO v_tier_key FROM public.subscription_tiers WHERE id=p_tier_id FOR UPDATE;
  IF v_tier_key IS NULL THEN RAISE EXCEPTION 'Subscription tier not found'; END IF;
  UPDATE public.subscription_tiers SET price_per_property=p_price_per_property WHERE id=p_tier_id;
  UPDATE public.manager_profiles SET platform_rate=p_price_per_property, updated_at=now() WHERE subscription_tier=v_tier_key;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.save_manager_notification_settings_atomic(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_id FROM public.manager_notification_settings WHERE manager_user_id=v_manager FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.manager_notification_settings(manager_user_id,notify_email,notify_sms,notify_whatsapp,notify_push,notify_payments,notify_maintenance,notify_leases,notify_security)
    VALUES(v_manager,COALESCE((p_payload->>'notify_email')::boolean,true),COALESCE((p_payload->>'notify_sms')::boolean,true),COALESCE((p_payload->>'notify_whatsapp')::boolean,false),COALESCE((p_payload->>'notify_push')::boolean,true),COALESCE((p_payload->>'notify_payments')::boolean,true),COALESCE((p_payload->>'notify_maintenance')::boolean,true),COALESCE((p_payload->>'notify_leases')::boolean,true),COALESCE((p_payload->>'notify_security')::boolean,true)) RETURNING id INTO v_id;
  ELSE
    UPDATE public.manager_notification_settings SET notify_email=COALESCE((p_payload->>'notify_email')::boolean,notify_email),notify_sms=COALESCE((p_payload->>'notify_sms')::boolean,notify_sms),notify_whatsapp=COALESCE((p_payload->>'notify_whatsapp')::boolean,notify_whatsapp),notify_push=COALESCE((p_payload->>'notify_push')::boolean,notify_push),notify_payments=COALESCE((p_payload->>'notify_payments')::boolean,notify_payments),notify_maintenance=COALESCE((p_payload->>'notify_maintenance')::boolean,notify_maintenance),notify_leases=COALESCE((p_payload->>'notify_leases')::boolean,notify_leases),notify_security=COALESCE((p_payload->>'notify_security')::boolean,notify_security),updated_at=now() WHERE id=v_id;
  END IF;
  RETURN v_id;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.profiles, public.manager_notification_settings FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.update_profile_settings_atomic(text,text,text), public.save_webhost_tier_price_atomic(uuid,numeric), public.save_manager_notification_settings_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_settings_atomic(text,text,text), public.save_webhost_tier_price_atomic(uuid,numeric), public.save_manager_notification_settings_atomic(jsonb) TO authenticated, service_role;

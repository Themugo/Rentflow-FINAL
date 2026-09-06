-- Phase 38: contract and contract-template lifecycle convergence.
CREATE OR REPLACE FUNCTION public.create_contract_atomic(
  p_lease_id uuid, p_tenant_id uuid, p_property_id uuid, p_unit_id uuid,
  p_template_id uuid, p_title text, p_content text, p_valid_from date, p_valid_until date, p_status text DEFAULT 'draft'
) RETURNS public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lease public.leases%ROWTYPE; v_contract public.contracts%ROWTYPE; v_manager uuid:=auth.uid();
BEGIN
 SELECT * INTO v_lease FROM public.leases l WHERE l.id=p_lease_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=v_lease.property_id AND p.manager_id=v_manager) THEN RAISE EXCEPTION 'Lease is outside your management portfolio'; END IF;
 IF p_tenant_id IS NOT NULL AND v_lease.tenant_id IS NOT NULL AND p_tenant_id<>v_lease.tenant_id THEN RAISE EXCEPTION 'Tenant does not match lease'; END IF;
 IF p_valid_until IS NOT NULL AND p_valid_from IS NOT NULL AND p_valid_until<p_valid_from THEN RAISE EXCEPTION 'Contract end date precedes start date'; END IF;
 IF trim(coalesce(p_title,''))='' OR trim(coalesce(p_content,''))='' THEN RAISE EXCEPTION 'Contract title and content are required'; END IF;
 INSERT INTO public.contracts(lease_id,tenant_id,property_id,unit_id,template_id,title,content,valid_from,valid_until,status,pending_approval,manager_id)
 VALUES(p_lease_id,coalesce(p_tenant_id,v_lease.tenant_id),v_lease.property_id,v_lease.unit_id,p_template_id,trim(p_title),p_content,p_valid_from,p_valid_until,coalesce(p_status,'draft'),false,v_manager)
 RETURNING * INTO v_contract;
 RETURN v_contract;
END $$;

CREATE OR REPLACE FUNCTION public.transition_contract_atomic(p_contract_id uuid, p_status text DEFAULT NULL, p_updates jsonb DEFAULT '{}'::jsonb)
RETURNS public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.contracts%ROWTYPE; v_manager uuid:=auth.uid(); v_status text;
BEGIN
 SELECT * INTO v FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=v.property_id AND p.manager_id=v_manager) THEN RAISE EXCEPTION 'Contract not found or unauthorized'; END IF;
 v_status=coalesce(p_status,v.status);
 IF v_status NOT IN ('draft','pending_approval','approved','sent','signed','expired','terminated') THEN RAISE EXCEPTION 'Invalid contract status'; END IF;
 IF v.status='terminated' AND v_status<>v.status THEN RAISE EXCEPTION 'Terminated contract is immutable'; END IF;
 UPDATE public.contracts SET status=v_status, pending_approval=coalesce((p_updates->>'pending_approval')::boolean,pending_approval), rejection_reason=coalesce(p_updates->>'rejection_reason',rejection_reason), manager_signature=coalesce(p_updates->>'manager_signature',manager_signature), manager_signed_at=CASE WHEN p_updates ? 'manager_signed_at' THEN (p_updates->>'manager_signed_at')::timestamptz ELSE manager_signed_at END, updated_at=now() WHERE id=p_contract_id RETURNING * INTO v;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(p_contract_id uuid,p_reason text,p_deleted_by uuid DEFAULT auth.uid()) RETURNS public.contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.contracts%ROWTYPE;
BEGIN
 SELECT * INTO v FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=v.property_id AND p.manager_id=auth.uid()) THEN RAISE EXCEPTION 'Contract not found or unauthorized'; END IF;
 UPDATE public.contracts SET status='terminated',deleted_at=now(),deleted_by=p_deleted_by::text,deletion_reason=trim(coalesce(p_reason,'Terminated by manager')),updated_at=now() WHERE id=p_contract_id RETURNING * INTO v;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.save_contract_template_atomic(p_template_id uuid,p_name text,p_description text,p_content text,p_is_default boolean)
RETURNS public.contract_templates LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.contract_templates%ROWTYPE; v_manager uuid:=auth.uid();
BEGIN
 IF trim(coalesce(p_name,''))='' OR trim(coalesce(p_content,''))='' THEN RAISE EXCEPTION 'Template name and content are required'; END IF;
 IF p_template_id IS NULL THEN
   IF p_is_default THEN UPDATE public.contract_templates SET is_default=false WHERE manager_user_id=v_manager; END IF;
   INSERT INTO public.contract_templates(name,description,content,is_default,manager_user_id) VALUES(trim(p_name),p_description,p_content,p_is_default,v_manager) RETURNING * INTO v;
 ELSE
   SELECT * INTO v FROM public.contract_templates WHERE id=p_template_id FOR UPDATE;
   IF NOT FOUND OR v.manager_user_id<>v_manager THEN RAISE EXCEPTION 'Template not found or unauthorized'; END IF;
   IF p_is_default THEN UPDATE public.contract_templates SET is_default=false WHERE manager_user_id=v_manager AND id<>p_template_id; END IF;
   UPDATE public.contract_templates SET name=trim(p_name),description=p_description,content=p_content,is_default=p_is_default,updated_at=now() WHERE id=p_template_id RETURNING * INTO v;
 END IF;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.delete_contract_template_atomic(p_template_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.contract_templates WHERE id=p_template_id AND manager_user_id=auth.uid()) THEN RAISE EXCEPTION 'Template not found or unauthorized'; END IF;
 DELETE FROM public.contract_templates WHERE id=p_template_id; RETURN true;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.contracts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.contract_templates FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_contract_atomic(uuid,uuid,uuid,uuid,uuid,text,text,date,date,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_contract_atomic(uuid,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_contract_atomic(uuid,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_contract_template_atomic(uuid,text,text,text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_contract_template_atomic(uuid) TO authenticated, service_role;

ALTER TABLE public.manager_contracts DROP CONSTRAINT IF EXISTS manager_contracts_status_check;
ALTER TABLE public.manager_contracts ADD CONSTRAINT manager_contracts_status_check CHECK (status IN ('pending','pending_signature','approved','rejected','signed','expired','terminated'));

CREATE OR REPLACE FUNCTION public.create_manager_contract_atomic(
  p_manager_user_id uuid,p_manager_email text,p_manager_name text,p_title text,p_description text,p_contract_type text,
  p_uploaded_contract_url text,p_valid_from date,p_valid_until date
) RETURNS public.manager_contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.manager_contracts%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost') THEN RAISE EXCEPTION 'Webhost access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_manager_user_id AND role='manager') THEN RAISE EXCEPTION 'Manager account not found'; END IF;
 IF trim(coalesce(p_title,''))='' THEN RAISE EXCEPTION 'Contract title is required'; END IF;
 INSERT INTO public.manager_contracts(manager_user_id,manager_email,manager_name,title,description,contract_type,uploaded_contract_url,valid_from,valid_until,status)
 VALUES(p_manager_user_id,p_manager_email,p_manager_name,trim(p_title),p_description,coalesce(p_contract_type,'service_agreement'),p_uploaded_contract_url,p_valid_from,p_valid_until,'pending_signature')
 RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transition_manager_contract_atomic(p_contract_id uuid,p_status text,p_review_notes text DEFAULT NULL)
RETURNS public.manager_contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.manager_contracts%ROWTYPE; v_user uuid:=auth.uid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role='webhost') THEN RAISE EXCEPTION 'Webhost access required'; END IF;
 SELECT * INTO v FROM public.manager_contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
 IF p_status NOT IN ('pending','approved','rejected','signed','expired','terminated') THEN RAISE EXCEPTION 'Invalid manager contract status'; END IF;
 UPDATE public.manager_contracts SET status=p_status,reviewed_by=CASE WHEN p_status IN ('approved','rejected') THEN v_user ELSE reviewed_by END,reviewed_at=CASE WHEN p_status IN ('approved','rejected') THEN now() ELSE reviewed_at END,review_notes=coalesce(p_review_notes,review_notes),updated_at=now() WHERE id=p_contract_id RETURNING * INTO v;
 RETURN v;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.manager_contracts FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_manager_contract_atomic(uuid,text,text,text,text,text,text,date,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_manager_contract_atomic(uuid,text,text) TO authenticated, service_role;

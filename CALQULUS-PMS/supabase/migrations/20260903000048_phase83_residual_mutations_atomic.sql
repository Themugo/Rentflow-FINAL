-- Phase 83: invitation, report scheduling, vacation notice and residual contract/lease convergence.

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation_atomic(p_invitation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v public.tenant_invitations%ROWTYPE;
BEGIN
 IF auth.role()<>'authenticated' OR uid IS NULL THEN RAISE EXCEPTION 'Authenticated caller required'; END IF;
 SELECT * INTO v FROM public.tenant_invitations WHERE id=p_invitation_id FOR UPDATE;
 IF NOT FOUND OR v.status<>'pending' OR v.expires_at<=now() THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
 IF lower(v.email)<>lower(coalesce((SELECT email FROM auth.users WHERE id=uid),'')) THEN RAISE EXCEPTION 'Invitation email does not match account'; END IF;
 UPDATE public.tenant_invitations SET status='accepted',accepted_at=now() WHERE id=v.id;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.delete_tenant_invitation_atomic(p_invitation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v public.tenant_invitations%ROWTYPE;
BEGIN
 SELECT * INTO v FROM public.tenant_invitations WHERE id=p_invitation_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=v.property_id AND p.manager_id=uid) THEN RAISE EXCEPTION 'Invitation not found or unauthorized' USING ERRCODE='42501'; END IF;
 DELETE FROM public.tenant_invitations WHERE id=v.id; RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.save_rent_report_schedule_atomic(p_enabled boolean,p_send_day smallint,p_recipients text[])
RETURNS public.rent_report_schedules LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v public.rent_report_schedules%ROWTYPE; r text[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role='manager') THEN RAISE EXCEPTION 'Manager access required' USING ERRCODE='42501'; END IF;
 IF p_send_day NOT BETWEEN 1 AND 28 THEN RAISE EXCEPTION 'Send day must be between 1 and 28'; END IF;
 r:=ARRAY(SELECT lower(trim(x)) FROM unnest(coalesce(p_recipients,'{}')) x WHERE trim(x)<>'' AND trim(x) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
 IF cardinality(r)<>cardinality(coalesce(p_recipients,'{}')) THEN RAISE EXCEPTION 'Invalid report recipient email'; END IF;
 INSERT INTO public.rent_report_schedules(manager_id,enabled,send_day,recipients) VALUES(uid,coalesce(p_enabled,true),p_send_day,r)
 ON CONFLICT(manager_id) DO UPDATE SET enabled=excluded.enabled,send_day=excluded.send_day,recipients=excluded.recipients,updated_at=now()
 RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transition_vacation_notice_manager_atomic(p_notice_id uuid,p_status text,p_manager_notes text DEFAULT NULL)
RETURNS public.vacation_notices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v public.vacation_notices%ROWTYPE;
BEGIN
 IF p_status NOT IN ('pending','acknowledged','approved','rejected','cancelled') THEN RAISE EXCEPTION 'Invalid vacation notice status'; END IF;
 SELECT * INTO v FROM public.vacation_notices WHERE id=p_notice_id FOR UPDATE;
 IF NOT FOUND OR v.manager_id<>uid THEN RAISE EXCEPTION 'Notice not found or unauthorized' USING ERRCODE='42501'; END IF;
 UPDATE public.vacation_notices SET status=p_status,manager_notes=coalesce(p_manager_notes,manager_notes),acknowledged_at=CASE WHEN p_status IN ('acknowledged','approved','rejected') THEN coalesce(acknowledged_at,now()) ELSE acknowledged_at END,acknowledged_by=CASE WHEN p_status IN ('acknowledged','approved','rejected') THEN uid ELSE acknowledged_by END,updated_at=now() WHERE id=v.id RETURNING * INTO v;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.assign_lease_tenant_atomic(p_lease_id uuid,p_tenant_id uuid)
RETURNS public.leases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); l public.leases%ROWTYPE; t public.tenants%ROWTYPE;
BEGIN
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
 SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id;
 IF NOT FOUND OR l.manager_id<>uid THEN RAISE EXCEPTION 'Lease not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF t.manager_id<>uid OR t.property_id IS DISTINCT FROM l.property_id OR (l.unit_id IS NOT NULL AND t.unit_id IS DISTINCT FROM l.unit_id) THEN RAISE EXCEPTION 'Tenant is outside lease portfolio or unit'; END IF;
 IF l.status='active' AND l.tenant_id IS DISTINCT FROM p_tenant_id THEN RAISE EXCEPTION 'Cannot replace tenant on active lease'; END IF;
 UPDATE public.leases SET tenant_id=p_tenant_id,updated_at=now() WHERE id=l.id RETURNING * INTO l; RETURN l;
END $$;

CREATE OR REPLACE FUNCTION public.sign_manager_contract_atomic(p_contract_id uuid,p_signature_url text)
RETURNS public.manager_contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v public.manager_contracts%ROWTYPE;
BEGIN
 SELECT * INTO v FROM public.manager_contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND OR v.manager_user_id<>uid THEN RAISE EXCEPTION 'Contract not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF v.status NOT IN ('pending_signature','pending') THEN RAISE EXCEPTION 'Contract is not awaiting signature'; END IF;
 IF trim(coalesce(p_signature_url,''))='' THEN RAISE EXCEPTION 'Signature path is required'; END IF;
 UPDATE public.manager_contracts SET status='signed',signature_url=trim(p_signature_url),signed_at=now(),signed_by=uid,updated_at=now() WHERE id=v.id RETURNING * INTO v; RETURN v;
END $$;

REVOKE INSERT,UPDATE,DELETE ON public.tenant_invitations FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.rent_report_schedules FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.vacation_notices FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.leases FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.manager_contracts FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_tenant_invitation_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_rent_report_schedule_atomic(boolean,smallint,text[]) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_vacation_notice_manager_atomic(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assign_lease_tenant_atomic(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sign_manager_contract_atomic(uuid,text) TO authenticated,service_role;

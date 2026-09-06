-- Phase 28: dispute lifecycle atomicity against the canonical disputes schema.

CREATE OR REPLACE FUNCTION public.create_dispute_atomic(
  p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_evidence_urls text[] DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_manager uuid; v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000'; END IF;
 SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
 SELECT manager_id INTO v_manager FROM public.tenants WHERE id=p_tenant_id;
 IF v_role='tenant' THEN IF p_tenant_id<>v_uid THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 ELSIF v_role IN ('manager','submanager') THEN
   IF v_role='submanager' THEN SELECT manager_id INTO v_manager FROM public.manager_submanagers WHERE submanager_user_id=v_uid LIMIT 1; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND manager_id=v_manager) THEN RAISE EXCEPTION 'Tenant is outside caller portfolio' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR trim(p_reason)='' THEN RAISE EXCEPTION 'Reason is required'; END IF;
 IF p_invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Invoice does not belong to tenant'; END IF;
 INSERT INTO public.disputes(tenant_id,invoice_id,reason,status,evidence_urls) VALUES(p_tenant_id,p_invoice_id,trim(p_reason),'open',COALESCE(p_evidence_urls,'{}')) RETURNING id INTO v_id;
 RETURN jsonb_build_object('id',v_id,'status','open');
END $$;

CREATE OR REPLACE FUNCTION public.resolve_dispute_atomic(
  p_dispute_id uuid, p_resolution_note text, p_status text DEFAULT 'resolved'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_manager uuid; v_d public.disputes%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000'; END IF;
 SELECT * INTO v_d FROM public.disputes WHERE id=p_dispute_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
 IF v_d.status NOT IN ('open','under_review') THEN RAISE EXCEPTION 'Dispute is already closed'; END IF;
 SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
 SELECT manager_id INTO v_manager FROM public.tenants WHERE id=v_d.tenant_id;
 IF v_role='submanager' THEN SELECT manager_id INTO v_manager FROM public.manager_submanagers WHERE submanager_user_id=v_uid LIMIT 1; END IF;
 IF v_role NOT IN ('manager','submanager','webhost') OR (v_role<>'webhost' AND NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=v_d.tenant_id AND manager_id=v_manager)) THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'Invalid dispute status'; END IF;
 UPDATE public.disputes SET status=p_status,resolution_note=NULLIF(trim(p_resolution_note),''),resolved_by=v_uid,resolved_at=now() WHERE id=v_d.id;
 RETURN jsonb_build_object('id',v_d.id,'status',p_status);
END $$;
REVOKE ALL ON FUNCTION public.create_dispute_atomic(uuid,uuid,text,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_dispute_atomic(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_dispute_atomic(uuid,uuid,text,text[]) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_dispute_atomic(uuid,text,text) TO authenticated,service_role;

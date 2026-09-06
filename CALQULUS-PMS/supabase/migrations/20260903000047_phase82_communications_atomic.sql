-- Phase 82: communications/broadcast mutation convergence.
-- Server derives sender/manager identity, portfolio and recipients; client no longer writes message,
-- campaign or in-app notification rows directly.

CREATE OR REPLACE FUNCTION public.create_broadcast_campaign_atomic(p_payload jsonb, p_tenant_ids uuid[])
RETURNS public.broadcast_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v public.broadcast_campaigns%ROWTYPE; t public.tenants%ROWTYPE; tenant_user uuid;
  v_name text; v_subject text; v_body text; v_type text; v_audience text; v_property uuid;
  v_sms boolean:=coalesce((p_payload->>'send_sms')::boolean,false); v_email boolean:=coalesce((p_payload->>'send_email')::boolean,false);
  v_wa boolean:=coalesce((p_payload->>'send_whatsapp')::boolean,false); v_push boolean:=coalesce((p_payload->>'send_push')::boolean,false); v_app boolean:=coalesce((p_payload->>'send_app')::boolean,true);
BEGIN
 IF auth.role()<>'authenticated' OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role IN ('manager','submanager')) THEN RAISE EXCEPTION 'Manager access required' USING ERRCODE='42501'; END IF;
 v_name:=trim(coalesce(p_payload->>'name','')); v_subject:=nullif(trim(coalesce(p_payload->>'subject','')),''); v_body:=trim(coalesce(p_payload->>'body','')); v_type:=coalesce(p_payload->>'message_type','announcement'); v_audience:=coalesce(p_payload->>'audience_type','all_tenants');
 IF v_body='' THEN RAISE EXCEPTION 'Message body is required'; END IF;
 IF v_name='' THEN v_name:=coalesce(v_subject,v_type)||' — '||to_char(current_date,'DD/MM/YY'); END IF;
 IF v_uid IN (SELECT user_id FROM public.user_roles WHERE user_id=v_uid AND role='submanager') THEN
   -- submanager portfolio is derived from assignments through their manager.
   IF NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.submanager_user_id=v_uid) THEN RAISE EXCEPTION 'Submanager portfolio not found'; END IF;
 END IF;
 v_property:=nullif(p_payload->>'property_id','')::uuid;
 IF v_property IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.properties p WHERE p.id=v_property AND (
     p.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.submanager_user_id=v_uid AND ms.manager_id=p.manager_id AND EXISTS(SELECT 1 FROM public.submanager_property_assignments a WHERE a.submanager_id=ms.id AND a.property_id=p.id))
   )) THEN RAISE EXCEPTION 'Property is outside your portfolio' USING ERRCODE='42501'; END IF;
 IF p_tenant_ids IS NULL OR cardinality(p_tenant_ids)=0 THEN RAISE EXCEPTION 'At least one recipient is required'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(p_tenant_ids) x(id) WHERE NOT EXISTS (
   SELECT 1 FROM public.tenants t WHERE t.id=x.id AND (
     t.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms JOIN public.submanager_property_assignments a ON a.submanager_id=ms.id WHERE ms.submanager_user_id=v_uid AND a.property_id=t.property_id AND ms.manager_id=t.manager_id)
   ) AND (v_property IS NULL OR t.property_id=v_property)
 )) THEN RAISE EXCEPTION 'One or more recipients are outside your portfolio' USING ERRCODE='42501'; END IF;
 INSERT INTO public.broadcast_campaigns(manager_id,property_id,name,subject,body,message_type,audience_type,audience_filter,send_sms,send_email,send_whatsapp,send_push,send_app,total_recipients,status)
 VALUES(v_uid,v_property,v_name,v_subject,v_body,v_type,v_audience,p_payload->'audience_filter',v_sms,v_email,v_wa,v_push,v_app,cardinality(p_tenant_ids),'sending') RETURNING * INTO v;
 FOR t IN SELECT * FROM public.tenants WHERE id=ANY(p_tenant_ids) LOOP
   INSERT INTO public.messages(manager_id,sender_id,sender_role,recipient_id,tenant_id,property_id,unit_id,subject,body,message_type,sent_via_sms,sent_via_email,sent_via_whatsapp,sent_via_push,sent_via_app,campaign_id,recipient_type,sent_at)
   VALUES(v_uid,v_uid,CASE WHEN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='submanager') THEN 'submanager' ELSE 'manager' END,NULL,t.id,t.property_id,t.unit_id,v_subject,v_body,v_type,v_sms,v_email,v_wa,v_push,v_app,v.id,CASE WHEN cardinality(p_tenant_ids)=1 THEN 'tenant' ELSE v_audience END,now());
   IF v_app THEN
     SELECT ur.user_id INTO tenant_user FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' LIMIT 1;
     IF tenant_user IS NOT NULL THEN
       PERFORM public.create_in_app_notification_atomic(tenant_user,coalesce(v_subject,v_type),left(v_body,200),'broadcast',NULL,NULL,v.id,'message','normal','manager',v_uid);
     END IF;
   END IF;
 END LOOP;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transition_broadcast_campaign_atomic(p_campaign_id uuid,p_status text,p_sms_sent integer DEFAULT NULL,p_email_sent integer DEFAULT NULL,p_whatsapp_sent integer DEFAULT NULL,p_push_sent integer DEFAULT NULL)
RETURNS public.broadcast_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.broadcast_campaigns%ROWTYPE; uid uuid:=auth.uid();
BEGIN
 IF p_status NOT IN ('sending','sent','scheduled','failed','cancelled','draft') THEN RAISE EXCEPTION 'Invalid campaign status'; END IF;
 SELECT * INTO v FROM public.broadcast_campaigns WHERE id=p_campaign_id FOR UPDATE;
 IF NOT FOUND OR v.manager_id<>uid THEN RAISE EXCEPTION 'Campaign not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF v.status='sent' AND p_status<>'sent' THEN RAISE EXCEPTION 'Sent campaign is immutable'; END IF;
 UPDATE public.broadcast_campaigns SET status=p_status,sms_sent=coalesce(p_sms_sent,sms_sent),email_sent=coalesce(p_email_sent,email_sent),whatsapp_sent=coalesce(p_whatsapp_sent,whatsapp_sent),push_sent=coalesce(p_push_sent,push_sent),sent_at=CASE WHEN p_status='sent' THEN coalesce(sent_at,now()) ELSE sent_at END,updated_at=now() WHERE id=v.id RETURNING * INTO v;
 RETURN v;
END $$;

REVOKE INSERT,UPDATE,DELETE ON public.messages FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.broadcast_campaigns FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_broadcast_campaign_atomic(jsonb,uuid[]) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_broadcast_campaign_atomic(uuid,text,integer,integer,integer,integer) TO authenticated,service_role;

-- Phase 47-48: tenant portal + lease/contract mutation convergence.
-- Tenant-originated writes are server-authorized through SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.save_tenant_notification_preferences_atomic(p_payload jsonb)
RETURNS public.tenant_notification_preferences LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenant_notification_preferences%ROWTYPE; uid uuid:=auth.uid(); tid uuid;
BEGIN
 IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' AND tenant_id IS NOT NULL LIMIT 1;
 IF tid IS NULL THEN RAISE EXCEPTION 'Tenant account not found' USING ERRCODE='42501'; END IF;
 INSERT INTO public.tenant_notification_preferences(tenant_user_id,tenant_id,email_enabled,payment_reminders,lease_alerts,maintenance_updates,manager_messages,announcements)
 VALUES(uid,tid,coalesce((p_payload->>'email_enabled')::boolean,true),coalesce((p_payload->>'payment_reminders')::boolean,true),coalesce((p_payload->>'lease_alerts')::boolean,true),coalesce((p_payload->>'maintenance_updates')::boolean,true),true,true)
 ON CONFLICT (tenant_user_id) DO UPDATE SET tenant_id=excluded.tenant_id,email_enabled=excluded.email_enabled,payment_reminders=excluded.payment_reminders,lease_alerts=excluded.lease_alerts,maintenance_updates=excluded.maintenance_updates,updated_at=now()
 RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.create_tenant_reference_request_atomic(p_issued_to text,p_issued_to_email text,p_purpose text,p_message text)
RETURNS public.tenant_reference_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenant_reference_requests%ROWTYPE; uid uuid:=auth.uid(); t public.tenants%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.tenants WHERE id=(SELECT tenant_id FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tenant account not found' USING ERRCODE='42501'; END IF;
 INSERT INTO public.tenant_reference_requests(tenant_id,tenant_user_id,manager_id,issued_to,issued_to_email,purpose,message) VALUES(t.id,uid,t.manager_id,nullif(trim(p_issued_to),''),nullif(trim(p_issued_to_email),''),coalesce(nullif(trim(p_purpose),''),'new_rental'),nullif(trim(p_message),'')) RETURNING * INTO v;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.submit_tenant_renewal_response_atomic(p_notice_id uuid,p_decision text,p_counter_rent numeric,p_counter_term integer,p_message text)
RETURNS public.tenant_lease_renewal_responses LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenant_lease_renewal_responses%ROWTYPE; uid uuid:=auth.uid(); t public.tenants%ROWTYPE; n public.tenant_notices%ROWTYPE;
BEGIN
 IF p_decision NOT IN ('accept','decline','negotiate') THEN RAISE EXCEPTION 'Invalid renewal decision' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM public.tenants WHERE id=(SELECT tenant_id FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tenant account not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO n FROM public.tenant_notices WHERE id=p_notice_id AND tenant_id=t.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Renewal notice not found' USING ERRCODE='42501'; END IF;
 INSERT INTO public.tenant_lease_renewal_responses(tenant_id,tenant_user_id,manager_id,lease_id,notice_id,decision,counter_rent,counter_term,message,signed_at) VALUES(t.id,uid,t.manager_id,NULL,n.id,p_decision,CASE WHEN p_decision='negotiate' THEN p_counter_rent END,CASE WHEN p_decision='negotiate' THEN p_counter_term END,nullif(trim(p_message),''),now()) RETURNING * INTO v;
 UPDATE public.tenant_notices SET tenant_acknowledged=true,tenant_ack_at=now(),tenant_response=p_decision WHERE id=n.id;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.create_vacation_notice_atomic(p_move_out_date date,p_reason text,p_forwarding_address text,p_phone text)
RETURNS public.vacation_notices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.vacation_notices%ROWTYPE; uid uuid:=auth.uid(); t public.tenants%ROWTYPE; p public.properties%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.tenants WHERE id=(SELECT tenant_id FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1) FOR UPDATE;
 IF NOT FOUND OR t.property_id IS NULL OR t.manager_id IS NULL THEN RAISE EXCEPTION 'Tenant is not assigned to a managed property' USING ERRCODE='42501'; END IF;
 IF p_move_out_date IS NULL OR p_move_out_date < current_date THEN RAISE EXCEPTION 'Invalid move-out date' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM public.properties WHERE id=t.property_id;
 INSERT INTO public.vacation_notices(tenant_id,property_id,tenant_name,tenant_email,property_name,unit_number,intended_move_out_date,reason,forwarding_address,phone_number,manager_id,notice_date,status) VALUES(t.id,p.id,t.name,t.email,p.name,t.unit,p_move_out_date,nullif(trim(p_reason),''),nullif(trim(p_forwarding_address),''),nullif(trim(p_phone),''),t.manager_id,current_date,'pending') RETURNING * INTO v;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.sign_vacation_notice_atomic(p_notice_id uuid,p_signature text)
RETURNS public.vacation_notices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.vacation_notices%ROWTYPE; uid uuid:=auth.uid(); tid uuid;
BEGIN
 SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
 SELECT * INTO v FROM public.vacation_notices WHERE id=p_notice_id AND tenant_id=tid FOR UPDATE;
 IF NOT FOUND OR nullif(trim(p_signature),'') IS NULL THEN RAISE EXCEPTION 'Notice not found or signature missing' USING ERRCODE='42501'; END IF;
 UPDATE public.vacation_notices SET tenant_signature=trim(p_signature),tenant_signed_at=now(),updated_at=now() WHERE id=p_notice_id RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.attach_vacation_notice_document_atomic(p_notice_id uuid,p_document_url text)
RETURNS public.vacation_notices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.vacation_notices%ROWTYPE; uid uuid:=auth.uid(); tid uuid;
BEGIN
 SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
 SELECT * INTO v FROM public.vacation_notices WHERE id=p_notice_id AND tenant_id=tid FOR UPDATE;
 IF NOT FOUND OR nullif(trim(p_document_url),'') IS NULL THEN RAISE EXCEPTION 'Notice not found or document missing' USING ERRCODE='42501'; END IF;
 UPDATE public.vacation_notices SET uploaded_document_url=trim(p_document_url),updated_at=now() WHERE id=p_notice_id RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.register_tenant_pet_atomic(p_pet_type text,p_breed text,p_name text,p_notes text)
RETURNS public.tenant_pets LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenant_pets%ROWTYPE; uid uuid:=auth.uid(); t public.tenants%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.tenants WHERE id=(SELECT tenant_id FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tenant account not found' USING ERRCODE='42501'; END IF;
 INSERT INTO public.tenant_pets(tenant_id,unit_id,manager_id,pet_type,breed,name,notes,is_approved) VALUES(t.id,t.unit_id,t.manager_id,lower(trim(p_pet_type)),nullif(trim(p_breed),''),nullif(trim(p_name),''),nullif(trim(p_notes),''),false) RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.register_tenant_vehicle_atomic(p_make text,p_model text,p_colour text,p_plate_number text,p_notes text)
RETURNS public.tenant_vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenant_vehicles%ROWTYPE; uid uuid:=auth.uid(); t public.tenants%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.tenants WHERE id=(SELECT tenant_id FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1) FOR UPDATE;
 IF NOT FOUND OR nullif(trim(p_plate_number),'') IS NULL THEN RAISE EXCEPTION 'Tenant account or plate number missing' USING ERRCODE='42501'; END IF;
 INSERT INTO public.tenant_vehicles(tenant_id,unit_id,manager_id,make,model,colour,plate_number,notes,is_approved) VALUES(t.id,t.unit_id,t.manager_id,nullif(trim(p_make),''),nullif(trim(p_model),''),nullif(trim(p_colour),''),upper(trim(p_plate_number)),nullif(trim(p_notes),''),false) RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_tenant_notice_atomic(p_notice_id uuid,p_response text DEFAULT NULL)
RETURNS public.tenant_notices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenant_notices%ROWTYPE; tid uuid;
BEGIN SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' LIMIT 1; SELECT * INTO v FROM public.tenant_notices WHERE id=p_notice_id AND tenant_id=tid FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Notice not found or unauthorized' USING ERRCODE='42501'; END IF; UPDATE public.tenant_notices SET tenant_acknowledged=true,tenant_ack_at=now(),tenant_response=coalesce(nullif(trim(p_response),''),tenant_response),status=CASE WHEN nullif(trim(p_response),'') IS NOT NULL AND p_response NOT IN ('accept','decline') THEN 'disputed' ELSE status END WHERE id=p_notice_id RETURNING * INTO v; RETURN v; END $$;

CREATE OR REPLACE FUNCTION public.mark_tenant_message_read_atomic(p_message_id uuid)
RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.messages%ROWTYPE;
BEGIN SELECT * INTO v FROM public.messages WHERE id=p_message_id AND (tenant_id=(SELECT tenant_id FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' LIMIT 1) OR recipient_id=auth.uid()) FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Message not found or unauthorized' USING ERRCODE='42501'; END IF; UPDATE public.messages SET is_read=true,read_at=now() WHERE id=p_message_id RETURNING * INTO v; RETURN v; END $$;

CREATE OR REPLACE FUNCTION public.sign_tenant_contract_atomic(p_contract_id uuid,p_signature text)
RETURNS public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.contracts%ROWTYPE; uid uuid:=auth.uid(); tid uuid; ns text;
BEGIN
 SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
 SELECT * INTO v FROM public.contracts WHERE id=p_contract_id AND tenant_id=tid FOR UPDATE;
 IF NOT FOUND OR nullif(trim(p_signature),'') IS NULL THEN RAISE EXCEPTION 'Contract not found or signature missing' USING ERRCODE='42501'; END IF;
 IF v.status IN ('terminated','expired','signed') AND v.tenant_signature IS NULL THEN RAISE EXCEPTION 'Contract is not available for signing' USING ERRCODE='22023'; END IF;
 ns:=CASE WHEN v.manager_signature IS NOT NULL THEN 'signed' ELSE 'pending_signature' END;
 UPDATE public.contracts SET tenant_signature=trim(p_signature),tenant_signed_at=now(),status=ns,updated_at=now() WHERE id=v.id RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.attach_tenant_contract_document_atomic(p_contract_id uuid,p_document_url text)
RETURNS public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.contracts%ROWTYPE; tid uuid;
BEGIN SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' LIMIT 1; SELECT * INTO v FROM public.contracts WHERE id=p_contract_id AND tenant_id=tid FOR UPDATE; IF NOT FOUND OR nullif(trim(p_document_url),'') IS NULL THEN RAISE EXCEPTION 'Contract not found or document missing' USING ERRCODE='42501'; END IF; IF v.uploaded_contract_url IS NOT NULL THEN RAISE EXCEPTION 'Signed contract document already attached' USING ERRCODE='23505'; END IF; UPDATE public.contracts SET uploaded_contract_url=trim(p_document_url),updated_at=now() WHERE id=v.id RETURNING * INTO v; RETURN v; END $$;

REVOKE INSERT,UPDATE,DELETE ON public.tenant_notification_preferences FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tenant_reference_requests FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tenant_lease_renewal_responses FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.vacation_notices FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tenant_pets FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tenant_vehicles FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tenant_notices FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.messages FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.move_condition_photos FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.contracts FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_tenant_notification_preferences_atomic(jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_tenant_reference_request_atomic(text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_tenant_renewal_response_atomic(uuid,text,numeric,integer,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_vacation_notice_atomic(date,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sign_vacation_notice_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.attach_vacation_notice_document_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_tenant_pet_atomic(text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_tenant_vehicle_atomic(text,text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_tenant_notice_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_tenant_message_read_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sign_tenant_contract_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.attach_tenant_contract_document_atomic(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.add_tenant_condition_photo_atomic(p_phase text,p_room text,p_photo_url text,p_description text,p_condition_rating text,p_location_note text)
RETURNS public.move_condition_photos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.move_condition_photos%ROWTYPE; uid uuid:=auth.uid(); tid uuid;
BEGIN
 SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
 IF tid IS NULL THEN RAISE EXCEPTION 'Tenant account not found' USING ERRCODE='42501'; END IF;
 IF p_phase NOT IN ('move_in','move_out','general','during_dispute') OR p_condition_rating NOT IN ('excellent','good','fair','poor','damaged') THEN RAISE EXCEPTION 'Invalid condition data' USING ERRCODE='22023'; END IF;
 IF nullif(trim(p_photo_url),'') IS NULL THEN RAISE EXCEPTION 'Photo URL required'; END IF;
 INSERT INTO public.move_condition_photos(user_id,tenant_id,phase,room,photo_url,description,condition_rating,taken_at,location_note) VALUES(uid,tid,p_phase,p_room,trim(p_photo_url),nullif(trim(p_description),''),p_condition_rating,now(),nullif(trim(p_location_note),'')) RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.update_tenant_notification_atomic(p_notification_id uuid,p_action text)
RETURNS public.in_app_notifications LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.in_app_notifications%ROWTYPE;
BEGIN
 IF p_action NOT IN ('read','dismiss') THEN RAISE EXCEPTION 'Invalid notification action' USING ERRCODE='22023'; END IF;
 SELECT * INTO v FROM public.in_app_notifications WHERE id=p_notification_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF p_action='read' THEN UPDATE public.in_app_notifications SET is_read=true,read_at=now() WHERE id=v.id;
 ELSE UPDATE public.in_app_notifications SET is_dismissed=true,dismissed_at=now() WHERE id=v.id; END IF;
 SELECT * INTO v FROM public.in_app_notifications WHERE id=v.id; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_tenant_notifications_read_atomic()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN UPDATE public.in_app_notifications SET is_read=true,read_at=now() WHERE user_id=auth.uid() AND coalesce(is_read,false)=false; GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;

REVOKE INSERT,UPDATE,DELETE ON public.move_condition_photos FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_tenant_condition_photo_atomic(text,text,text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.update_tenant_notification_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_tenant_notifications_read_atomic() TO authenticated,service_role;

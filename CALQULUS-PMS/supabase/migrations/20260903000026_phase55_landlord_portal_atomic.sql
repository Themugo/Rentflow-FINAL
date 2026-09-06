-- CALQULUS Phase 55: landlord portal mutation convergence.

CREATE OR REPLACE FUNCTION public.save_landlord_bank_details_atomic(
  p_mpesa_number text DEFAULT NULL,p_mpesa_name text DEFAULT NULL,p_bank_name text DEFAULT NULL,
  p_bank_account_number text DEFAULT NULL,p_bank_account_name text DEFAULT NULL,p_bank_branch text DEFAULT NULL,
  p_bank_code text DEFAULT NULL,p_preferred_method text DEFAULT 'mpesa',p_minimum_payout numeric DEFAULT 0,
  p_auto_request boolean DEFAULT false,p_auto_request_day integer DEFAULT 5,p_kra_pin text DEFAULT NULL,
  p_vat_registered boolean DEFAULT false,p_vat_number text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_preferred_method NOT IN ('mpesa','bank_transfer','cheque','cash') THEN RAISE EXCEPTION 'Invalid payout method' USING ERRCODE='22023'; END IF;
  IF p_minimum_payout IS NULL OR p_minimum_payout < 0 THEN RAISE EXCEPTION 'Minimum payout cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_auto_request_day NOT BETWEEN 1 AND 28 THEN RAISE EXCEPTION 'Auto request day must be 1-28' USING ERRCODE='22023'; END IF;
  INSERT INTO public.landlord_bank_details(landlord_user_id,mpesa_number,mpesa_name,bank_name,bank_account_number,bank_account_name,bank_branch,bank_code,preferred_method,minimum_payout,auto_request,auto_request_day,kra_pin,vat_registered,vat_number)
  VALUES(auth.uid(),nullif(trim(p_mpesa_number),''),nullif(trim(p_mpesa_name),''),nullif(trim(p_bank_name),''),nullif(trim(p_bank_account_number),''),nullif(trim(p_bank_account_name),''),nullif(trim(p_bank_branch),''),nullif(trim(p_bank_code),''),p_preferred_method,round(p_minimum_payout,2),p_auto_request,p_auto_request_day,nullif(trim(p_kra_pin),''),p_vat_registered,nullif(trim(p_vat_number),''))
  ON CONFLICT (landlord_user_id) DO UPDATE SET mpesa_number=EXCLUDED.mpesa_number,mpesa_name=EXCLUDED.mpesa_name,bank_name=EXCLUDED.bank_name,bank_account_number=EXCLUDED.bank_account_number,bank_account_name=EXCLUDED.bank_account_name,bank_branch=EXCLUDED.bank_branch,bank_code=EXCLUDED.bank_code,preferred_method=EXCLUDED.preferred_method,minimum_payout=EXCLUDED.minimum_payout,auto_request=EXCLUDED.auto_request,auto_request_day=EXCLUDED.auto_request_day,kra_pin=EXCLUDED.kra_pin,vat_registered=EXCLUDED.vat_registered,vat_number=EXCLUDED.vat_number,updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.save_landlord_notification_preferences_atomic(p_preferences jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_preferences IS NULL OR jsonb_typeof(p_preferences)<>'object' THEN RAISE EXCEPTION 'Preferences object required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.landlord_notification_preferences(landlord_user_id,email_enabled,sms_enabled,whatsapp_enabled,payout_approved,payout_paid,monthly_statement,new_tenant_moved_in,tenant_moved_out,maintenance_completed,vacancy_alert,arrears_alert)
  VALUES(auth.uid(),COALESCE((p_preferences->>'email_enabled')::boolean,true),COALESCE((p_preferences->>'sms_enabled')::boolean,true),COALESCE((p_preferences->>'whatsapp_enabled')::boolean,false),COALESCE((p_preferences->>'payout_approved')::boolean,true),COALESCE((p_preferences->>'payout_paid')::boolean,true),COALESCE((p_preferences->>'monthly_statement')::boolean,true),COALESCE((p_preferences->>'new_tenant_moved_in')::boolean,true),COALESCE((p_preferences->>'tenant_moved_out')::boolean,true),COALESCE((p_preferences->>'maintenance_completed')::boolean,true),COALESCE((p_preferences->>'vacancy_alert')::boolean,true),COALESCE((p_preferences->>'arrears_alert')::boolean,true))
  ON CONFLICT (landlord_user_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,sms_enabled=EXCLUDED.sms_enabled,whatsapp_enabled=EXCLUDED.whatsapp_enabled,payout_approved=EXCLUDED.payout_approved,payout_paid=EXCLUDED.payout_paid,monthly_statement=EXCLUDED.monthly_statement,new_tenant_moved_in=EXCLUDED.new_tenant_moved_in,tenant_moved_out=EXCLUDED.tenant_moved_out,maintenance_completed=EXCLUDED.maintenance_completed,vacancy_alert=EXCLUDED.vacancy_alert,arrears_alert=EXCLUDED.arrears_alert,updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.send_landlord_message_atomic(p_property_id uuid,p_recipient_id uuid,p_body text,p_subject text DEFAULT NULL,p_parent_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_role text; v_id uuid; v_manager uuid; v_landlord boolean;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_body),'') IS NULL THEN RAISE EXCEPTION 'Message body is required' USING ERRCODE='22023'; END IF;
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Property not found' USING ERRCODE='P0002'; END IF;
  v_landlord := EXISTS(SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p_property_id AND pl.landlord_user_id=auth.uid());
  IF v_manager=auth.uid() THEN v_role:='manager';
  ELSIF v_landlord THEN v_role:='landlord';
  ELSE RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF (v_role='manager' AND NOT EXISTS(SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p_property_id AND pl.landlord_user_id=p_recipient_id))
     OR (v_role='landlord' AND p_recipient_id IS DISTINCT FROM v_manager) THEN RAISE EXCEPTION 'Invalid message recipient' USING ERRCODE='42501'; END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.landlord_messages m WHERE m.id=p_parent_id AND m.property_id=p_property_id AND (m.sender_id=auth.uid() OR m.recipient_id=auth.uid())) THEN RAISE EXCEPTION 'Invalid message thread' USING ERRCODE='42501'; END IF;
  INSERT INTO public.landlord_messages(property_id,sender_id,sender_role,recipient_id,subject,body,parent_id)
  VALUES(p_property_id,auth.uid(),v_role,p_recipient_id,nullif(trim(p_subject),''),trim(p_body),p_parent_id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'message_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_landlord_messages_read_atomic(p_message_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  UPDATE public.landlord_messages SET is_read=true,read_at=now() WHERE id=ANY(p_message_ids) AND recipient_id=auth.uid() AND is_read=false;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN jsonb_build_object('success',true,'updated',v_count);
END; $$;

REVOKE ALL ON FUNCTION public.save_landlord_bank_details_atomic(text,text,text,text,text,text,text,text,numeric,boolean,integer,text,boolean,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_landlord_notification_preferences(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.send_landlord_message_atomic(uuid,uuid,text,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mark_landlord_messages_read_atomic(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_landlord_bank_details_atomic(text,text,text,text,text,text,text,text,numeric,boolean,integer,text,boolean,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_landlord_notification_preferences(jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.send_landlord_message_atomic(uuid,uuid,text,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_landlord_messages_read_atomic(uuid[]) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.landlord_bank_details FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.landlord_notification_preferences FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.landlord_messages FROM authenticated;

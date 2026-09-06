-- Phase 76: Manager financial & organization settings mutation convergence
CREATE UNIQUE INDEX IF NOT EXISTS agencies_manager_id_uniq ON agencies(manager_id) WHERE manager_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_manager_bank_details_atomic(p_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_manager uuid := auth.uid(); v_existing_manager uuid;
BEGIN
  IF v_manager IS NULL OR NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
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
DECLARE v_id uuid; v_manager uuid:=auth.uid();
BEGIN
 IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
 SELECT id INTO v_id FROM company_settings WHERE manager_user_id=v_manager LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN INSERT INTO company_settings(manager_user_id,company_name,address,city,state,zip_code,email,phone,website,brand_primary_hex,white_label_enabled,brand_config,logo_url) VALUES(v_manager,COALESCE(NULLIF(p_payload->>'company_name',''),'My Company'),NULLIF(p_payload->>'address',''),NULLIF(p_payload->>'city',''),NULLIF(p_payload->>'state',''),NULLIF(p_payload->>'zip_code',''),NULLIF(p_payload->>'email',''),NULLIF(p_payload->>'phone',''),NULLIF(p_payload->>'website',''),NULLIF(p_payload->>'brand_primary_hex',''),COALESCE((p_payload->>'white_label_enabled')::boolean,false),COALESCE(p_payload->'brand_config','{}'::jsonb),NULLIF(p_payload->>'logo_url','')) RETURNING id INTO v_id;
 ELSE UPDATE company_settings SET company_name=COALESCE(NULLIF(p_payload->>'company_name',''),company_name),address=NULLIF(p_payload->>'address',''),city=NULLIF(p_payload->>'city',''),state=NULLIF(p_payload->>'state',''),zip_code=NULLIF(p_payload->>'zip_code',''),email=NULLIF(p_payload->>'email',''),phone=NULLIF(p_payload->>'phone',''),website=NULLIF(p_payload->>'website',''),brand_primary_hex=NULLIF(p_payload->>'brand_primary_hex',''),white_label_enabled=COALESCE((p_payload->>'white_label_enabled')::boolean,white_label_enabled),brand_config=COALESCE(p_payload->'brand_config',brand_config),logo_url=NULLIF(p_payload->>'logo_url',''),updated_at=now() WHERE id=v_id; END IF;
 IF to_regclass('public.agencies') IS NOT NULL THEN INSERT INTO agencies(manager_id,name,email,phone,address,county,kra_pin,registration_number,whatsapp,website) VALUES(v_manager,COALESCE(NULLIF(p_payload->>'company_name',''),'My Agency'),NULLIF(p_payload->>'email',''),NULLIF(p_payload->>'phone',''),NULLIF(p_payload->>'address',''),NULLIF(p_payload->>'county',''),NULLIF(p_payload->>'kra_pin',''),NULLIF(p_payload->>'registration_number',''),NULLIF(p_payload->>'whatsapp',''),NULLIF(p_payload->>'website','')) ON CONFLICT (manager_id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone=EXCLUDED.phone,address=EXCLUDED.address,county=EXCLUDED.county,kra_pin=EXCLUDED.kra_pin,registration_number=EXCLUDED.registration_number,whatsapp=EXCLUDED.whatsapp,website=EXCLUDED.website; END IF;
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

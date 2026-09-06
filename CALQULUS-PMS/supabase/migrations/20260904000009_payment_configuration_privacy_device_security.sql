-- CALQULUS PMS — canonical payment configuration hierarchy, secure sharing and device controls
-- Hierarchy: unit -> property -> agency -> landlord -> manager.
-- A unit-specific destination always wins for that unit. Prompts and portal instructions
-- resolve from this same live configuration rather than legacy M-Pesa settings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE UNIQUE INDEX IF NOT EXISTS pca_agency_default_uidx
  ON public.payment_collection_accounts(agency_id)
  WHERE is_active AND is_default AND agency_id IS NOT NULL
    AND property_id IS NULL AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pca_unit_default_uidx
  ON public.payment_collection_accounts(unit_id)
  WHERE is_active AND is_default AND unit_id IS NOT NULL AND lease_id IS NULL AND tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS pca_agency_idx ON public.payment_collection_accounts(agency_id,is_active,priority);
CREATE INDEX IF NOT EXISTS pca_unit_idx ON public.payment_collection_accounts(unit_id,is_active,priority);

CREATE OR REPLACE FUNCTION public.can_manage_payment_scope(p_property_id uuid, p_unit_id uuid, p_agency_id uuid, p_landlord_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_property public.properties%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF p_unit_id IS NOT NULL THEN
    SELECT p.* INTO v_property FROM public.units u JOIN public.properties p ON p.id=u.property_id WHERE u.id=p_unit_id;
  ELSIF p_property_id IS NOT NULL THEN
    SELECT * INTO v_property FROM public.properties WHERE id=p_property_id;
  END IF;
  IF p_agency_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=p_agency_id AND (a.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=v_uid AND am.is_active AND lower(am.role_in_agency) IN ('owner','admin','manager')))) THEN RETURN false; END IF;
    IF v_property.id IS NOT NULL AND v_property.agency_id IS DISTINCT FROM p_agency_id THEN RETURN false; END IF;
  END IF;
  IF p_landlord_user_id IS NOT NULL THEN
    IF v_property.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=v_property.id AND pl.landlord_user_id=p_landlord_user_id) THEN RETURN false; END IF;
    IF p_landlord_user_id<>v_uid AND NOT (v_property.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_property.manager_id AND ms.submanager_user_id=v_uid)) THEN RETURN false; END IF;
  END IF;
  IF v_property.id IS NOT NULL AND (v_property.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_property.manager_id AND ms.submanager_user_id=v_uid)) THEN RETURN true; END IF;
  IF p_landlord_user_id=v_uid THEN RETURN true; END IF;
  IF p_agency_id IS NOT NULL THEN RETURN true; END IF;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION public.can_manage_payment_scope(uuid,uuid,uuid,uuid) TO authenticated,service_role;

-- Replace the earlier save RPC with a scope-aware version. Property, unit and agency
-- may be used independently; lease/tenant remain available for tenancy-specific overrides.
CREATE OR REPLACE FUNCTION public.save_payment_collection_account_atomic(p_id uuid, p_payload jsonb)
RETURNS public.payment_collection_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payment_collection_accounts%ROWTYPE; v_uid uuid:=auth.uid();
  v_property uuid:=NULLIF(p_payload->>'property_id','')::uuid;
  v_unit uuid:=NULLIF(p_payload->>'unit_id','')::uuid;
  v_agency uuid:=NULLIF(p_payload->>'agency_id','')::uuid;
  v_landlord uuid:=NULLIF(p_payload->>'landlord_user_id','')::uuid;
  v_lease uuid:=NULLIF(p_payload->>'lease_id','')::uuid;
  v_tenant uuid:=NULLIF(p_payload->>'tenant_id','')::uuid;
  v_method text:=COALESCE(p_payload->>'payment_method',''); v_id uuid:=COALESCE(p_id,gen_random_uuid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF v_unit IS NOT NULL THEN
    SELECT property_id INTO v_property FROM public.units WHERE id=v_unit;
    IF v_property IS NULL THEN RAISE EXCEPTION 'Unit not found' USING ERRCODE='P0002'; END IF;
  END IF;
  IF v_property IS NULL AND v_agency IS NULL THEN RAISE EXCEPTION 'A property, unit or agency scope is required' USING ERRCODE='22023'; END IF;
  IF v_agency IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=v_agency) THEN RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002'; END IF;
  IF v_property IS NOT NULL AND v_agency IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p JOIN public.manager_profiles mp ON mp.manager_user_id=p.manager_id WHERE p.id=v_property AND mp.agency_id=v_agency) THEN RAISE EXCEPTION 'Agency is not assigned to this property manager' USING ERRCODE='42501'; END IF;
  IF v_property IS NOT NULL AND NOT public.can_manage_payment_scope(v_property,v_unit,v_agency,v_landlord) THEN RAISE EXCEPTION 'Payment configuration scope unauthorized' USING ERRCODE='42501'; END IF;
  IF v_property IS NULL AND v_agency IS NOT NULL AND NOT public.can_manage_payment_scope(NULL,NULL,v_agency,NULL) THEN RAISE EXCEPTION 'Agency payment configuration unauthorized' USING ERRCODE='42501'; END IF;
  IF v_landlord IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=v_property AND pl.landlord_user_id=v_landlord) THEN RAISE EXCEPTION 'Payment owner is not linked to this property' USING ERRCODE='42501'; END IF;
  IF v_method NOT IN ('mpesa_paybill','mpesa_till','bank_transfer','cash') THEN RAISE EXCEPTION 'Invalid payment method' USING ERRCODE='22023'; END IF;
  IF v_method='mpesa_paybill' AND NULLIF(trim(p_payload->>'paybill_number'),'') IS NULL THEN RAISE EXCEPTION 'Paybill number is required' USING ERRCODE='22023'; END IF;
  IF v_method='mpesa_till' AND NULLIF(trim(p_payload->>'till_number'),'') IS NULL THEN RAISE EXCEPTION 'Till number is required' USING ERRCODE='22023'; END IF;
  IF v_method='bank_transfer' AND (NULLIF(trim(p_payload->>'bank_name'),'') IS NULL OR NULLIF(trim(p_payload->>'bank_account_number'),'') IS NULL) THEN RAISE EXCEPTION 'Bank name and account number are required' USING ERRCODE='22023'; END IF;
  IF v_unit IS NOT NULL AND (v_lease IS NOT NULL OR v_tenant IS NOT NULL) THEN RAISE EXCEPTION 'Unit routing cannot be combined with tenancy-specific routing' USING ERRCODE='22023'; END IF;
  INSERT INTO public.payment_collection_accounts(id,agency_id,manager_id,landlord_user_id,property_id,unit_id,lease_id,tenant_id,account_label,payment_method,paybill_number,till_number,bank_name,bank_account_name,bank_account_number,bank_branch,payment_instructions,is_default,priority,is_active)
  VALUES(v_id,v_agency,COALESCE((SELECT manager_id FROM public.properties WHERE id=v_property),auth.uid()),v_landlord,v_property,v_unit,v_lease,v_tenant,COALESCE(NULLIF(trim(p_payload->>'account_label'),''),'Rent collection'),v_method,NULLIF(trim(p_payload->>'paybill_number'),''),NULLIF(trim(p_payload->>'till_number'),''),NULLIF(trim(p_payload->>'bank_name'),''),NULLIF(trim(p_payload->>'bank_account_name'),''),NULLIF(trim(p_payload->>'bank_account_number'),''),NULLIF(trim(p_payload->>'bank_branch'),''),NULLIF(trim(p_payload->>'payment_instructions'),''),COALESCE((p_payload->>'is_default')::boolean,false),COALESCE((p_payload->>'priority')::int,100),COALESCE((p_payload->>'is_active')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET agency_id=EXCLUDED.agency_id,manager_id=EXCLUDED.manager_id,landlord_user_id=EXCLUDED.landlord_user_id,property_id=EXCLUDED.property_id,unit_id=EXCLUDED.unit_id,lease_id=EXCLUDED.lease_id,tenant_id=EXCLUDED.tenant_id,account_label=EXCLUDED.account_label,payment_method=EXCLUDED.payment_method,paybill_number=EXCLUDED.paybill_number,till_number=EXCLUDED.till_number,bank_name=EXCLUDED.bank_name,bank_account_name=EXCLUDED.bank_account_name,bank_account_number=EXCLUDED.bank_account_number,bank_branch=EXCLUDED.bank_branch,payment_instructions=EXCLUDED.payment_instructions,is_default=EXCLUDED.is_default,priority=EXCLUDED.priority,is_active=EXCLUDED.is_active,updated_at=now()
  RETURNING * INTO v;
  IF v.is_default THEN
    UPDATE public.payment_collection_accounts SET is_default=false,updated_at=now()
    WHERE id<>v.id AND is_active AND (CASE WHEN v.unit_id IS NOT NULL THEN unit_id=v.unit_id AND lease_id IS NULL AND tenant_id IS NULL WHEN v.property_id IS NOT NULL THEN property_id=v.property_id AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL WHEN v.agency_id IS NOT NULL THEN agency_id=v.agency_id AND property_id IS NULL AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL ELSE false END);
  END IF;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_payment_collection_account_atomic(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_effective_payment_collection_account(p_invoice_id uuid)
RETURNS public.payment_collection_accounts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payment_collection_accounts%ROWTYPE;
BEGIN
  SELECT a.* INTO v
  FROM public.invoices i
  JOIN public.properties p ON p.id=i.property_id
  LEFT JOIN public.leases l ON l.id=i.lease_id
  LEFT JOIN public.units u ON u.id=COALESCE(i.unit_id,l.unit_id)
  LEFT JOIN public.manager_profiles mp ON mp.manager_user_id=p.manager_id
  JOIN public.payment_collection_accounts a ON a.is_active
   AND (a.tenant_id=i.tenant_id OR a.lease_id=i.lease_id OR a.unit_id=COALESCE(i.unit_id,l.unit_id) OR a.property_id=i.property_id OR a.agency_id=(SELECT mp.agency_id FROM public.manager_profiles mp WHERE mp.manager_user_id=p.manager_id LIMIT 1) OR a.landlord_user_id=COALESCE(l.billing_landlord_user_id,(SELECT pl.landlord_user_id FROM public.property_landlords pl WHERE pl.property_id=i.property_id ORDER BY pl.revenue_share_pct DESC NULLS LAST LIMIT 1)) OR a.manager_id=i.manager_id)
  WHERE i.id=p_invoice_id
  ORDER BY CASE
    WHEN a.tenant_id=i.tenant_id AND a.lease_id=i.lease_id THEN 1
    WHEN a.lease_id=i.lease_id THEN 2
    WHEN a.unit_id=COALESCE(i.unit_id,l.unit_id) THEN 3
    WHEN a.property_id=i.property_id THEN 4
    WHEN a.agency_id=(SELECT mp.agency_id FROM public.manager_profiles mp WHERE mp.manager_user_id=p.manager_id LIMIT 1) AND a.property_id IS NULL THEN 5
    WHEN a.landlord_user_id=COALESCE(l.billing_landlord_user_id,(SELECT pl.landlord_user_id FROM public.property_landlords pl WHERE pl.property_id=i.property_id ORDER BY pl.revenue_share_pct DESC NULLS LAST LIMIT 1)) THEN 6
    WHEN a.manager_id=i.manager_id THEN 7 ELSE 99 END,
    CASE WHEN a.is_default THEN 0 ELSE 1 END,a.priority,a.created_at
  LIMIT 1;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.get_effective_payment_collection_account(uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_invoice_payment_instructions(p_invoice_id uuid)
RETURNS TABLE(account_id uuid,account_label text,payment_method text,paybill_number text,till_number text,bank_name text,bank_account_name text,bank_account_number text,bank_branch text,payment_instructions text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT a.id,a.account_label,a.payment_method,a.paybill_number,a.till_number,a.bank_name,a.bank_account_name,a.bank_account_number,a.bank_branch,a.payment_instructions
  FROM public.get_effective_payment_collection_account(p_invoice_id) a;
$$;
GRANT EXECUTE ON FUNCTION public.get_invoice_payment_instructions(uuid) TO authenticated;

-- Shared-link hardening: a link alone never exposes tenant identity or bill identifiers.
ALTER TABLE public.payment_share_links
  ADD COLUMN IF NOT EXISTS recipient_label text,
  ADD COLUMN IF NOT EXISTS access_code_hash text,
  ADD COLUMN IF NOT EXISTS access_code_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_share_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid NOT NULL REFERENCES public.payment_share_links(id) ON DELETE CASCADE,
  grant_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_share_access_grants_link_idx ON public.payment_share_access_grants(share_link_id,expires_at);
ALTER TABLE public.payment_share_access_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_tenant_payment_share_link_atomic(p_invoice_ids uuid[] DEFAULT NULL,p_expires_in_hours integer DEFAULT 168,p_label text DEFAULT 'Shared payment link',p_recipient_label text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant_id uuid;v_manager_id uuid;v_link_id uuid;v_token text;v_code text;v_expires timestamptz;v_ids uuid[];v_count integer;v_total numeric;
BEGIN
  SELECT ur.tenant_id INTO v_tenant_id FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='tenant' LIMIT 1;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;
  IF p_expires_in_hours NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'Expiry must be between 1 and 720 hours' USING ERRCODE='22023'; END IF;
  IF p_invoice_ids IS NULL OR cardinality(p_invoice_ids)=0 THEN
    SELECT array_agg(i.id ORDER BY i.due_date NULLS LAST,i.created_at) INTO v_ids FROM public.invoices i WHERE i.tenant_id=v_tenant_id AND i.status IN ('pending','overdue','partially_paid') AND GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0)>0;
  ELSE v_ids:=p_invoice_ids; END IF;
  IF v_ids IS NULL OR cardinality(v_ids)=0 OR cardinality(v_ids)>20 THEN RAISE EXCEPTION 'Invalid shared bill selection' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=ANY(v_ids) AND (i.tenant_id IS DISTINCT FROM v_tenant_id OR i.status NOT IN ('pending','overdue','partially_paid') OR GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0)<=0)) THEN RAISE EXCEPTION 'One or more selected bills are not payable by this tenant' USING ERRCODE='42501'; END IF;
  SELECT manager_id INTO v_manager_id FROM public.tenants WHERE id=v_tenant_id;
  v_token:=encode(gen_random_bytes(32),'hex'); v_code:=lpad((floor(random()*1000000))::int::text,6,'0'); v_expires:=now()+make_interval(hours=>p_expires_in_hours);
  INSERT INTO public.payment_share_links(token_hash,tenant_id,manager_id,label,expires_at,created_by,recipient_label,access_code_hash)
  VALUES(encode(digest(v_token,'sha256'),'hex'),v_tenant_id,v_manager_id,NULLIF(trim(p_label),''),v_expires,auth.uid(),NULLIF(trim(p_recipient_label),''),encode(digest(v_code,'sha256'),'hex')) RETURNING id INTO v_link_id;
  INSERT INTO public.payment_share_link_invoices(share_link_id,invoice_id) SELECT v_link_id,unnest(v_ids);
  SELECT count(*),COALESCE(sum(GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0)),0) INTO v_count,v_total FROM public.invoices i WHERE i.id=ANY(v_ids);
  RETURN jsonb_build_object('share_link_id',v_link_id,'token',v_token,'access_code',v_code,'expires_at',v_expires,'invoice_count',v_count,'total_amount',round(v_total,2));
END $$;
GRANT EXECUTE ON FUNCTION public.create_tenant_payment_share_link_atomic(uuid[],integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_public_payment_share(p_token text,p_access_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text;v_link public.payment_share_links%ROWTYPE;v_grant text;v_grant_hash text;
BEGIN
  v_hash:=encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');
  SELECT * INTO v_link FROM public.payment_share_links WHERE token_hash=v_hash FOR UPDATE;
  IF v_link.id IS NULL OR v_link.revoked_at IS NOT NULL OR v_link.expires_at<=now() OR v_link.use_count>=v_link.max_uses THEN RAISE EXCEPTION 'Payment link is invalid or expired' USING ERRCODE='42501'; END IF;
  IF v_link.access_code_hash IS NULL OR encode(digest(trim(COALESCE(p_access_code,'')),'sha256'),'hex')<>v_link.access_code_hash THEN
    UPDATE public.payment_share_links SET access_code_attempts=access_code_attempts+1 WHERE id=v_link.id;
    IF v_link.access_code_attempts>=5 THEN RAISE EXCEPTION 'Too many verification attempts' USING ERRCODE='P4290'; END IF;
    RAISE EXCEPTION 'Invalid access code' USING ERRCODE='42501';
  END IF;
  v_grant:=encode(gen_random_bytes(32),'hex');v_grant_hash:=encode(digest(v_grant,'sha256'),'hex');
  INSERT INTO public.payment_share_access_grants(share_link_id,grant_hash,expires_at) VALUES(v_link.id,v_grant_hash,LEAST(v_link.expires_at,now()+interval '30 minutes'));
  UPDATE public.payment_share_links SET verified_until=LEAST(expires_at,now()+interval '30 minutes'),last_verified_at=now(),access_code_attempts=0,updated_at=now() WHERE id=v_link.id;
  RETURN jsonb_build_object('grant',v_grant,'expires_at',LEAST(v_link.expires_at,now()+interval '30 minutes'),'recipient_label',v_link.recipient_label);
END $$;
GRANT EXECUTE ON FUNCTION public.verify_public_payment_share(text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_public_payment_share(p_token text,p_grant text DEFAULT NULL)
RETURNS TABLE(share_link_id uuid,label text,expires_at timestamptz,remaining_uses integer,invoice_id uuid,invoice_number text,property_name text,unit_number text,due_date date,amount numeric,paid_amount numeric,balance_due numeric,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text;v_link public.payment_share_links%ROWTYPE;v_grant_hash text;
BEGIN
  v_hash:=encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');v_grant_hash:=encode(digest(trim(COALESCE(p_grant,'')),'sha256'),'hex');
  SELECT * INTO v_link FROM public.payment_share_links l WHERE l.token_hash=v_hash AND l.revoked_at IS NULL AND l.expires_at>now() AND l.use_count<l.max_uses AND l.verified_until>now() AND EXISTS(SELECT 1 FROM public.payment_share_access_grants g WHERE g.share_link_id=l.id AND g.grant_hash=v_grant_hash AND g.used_at IS NULL AND g.expires_at>now());
  IF v_link.id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT v_link.id,v_link.label,v_link.expires_at,GREATEST(v_link.max_uses-v_link.use_count,0),i.id,i.invoice_number,COALESCE(p.name,'Property'),COALESCE(u.unit_number,'Unit'),i.due_date,i.amount,COALESCE(i.paid_amount,0),GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0),i.status
  FROM public.payment_share_link_invoices sli JOIN public.invoices i ON i.id=sli.invoice_id LEFT JOIN public.properties p ON p.id=i.property_id LEFT JOIN public.units u ON u.id=COALESCE(i.unit_id,(SELECT le.unit_id FROM public.leases le WHERE le.id=i.lease_id))
  WHERE sli.share_link_id=v_link.id ORDER BY i.due_date NULLS LAST,p.name,u.unit_number,i.invoice_number;
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_payment_share(text,text) TO anon,authenticated;

-- Device controls: one active device by default. A second device requires an explicit,
-- short-lived authorization code generated on an already-authorized device.
CREATE TABLE IF NOT EXISTS public.portal_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash text NOT NULL, device_label text, is_authorized_device boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,device_hash)
);
CREATE INDEX IF NOT EXISTS portal_device_sessions_active_idx ON public.portal_device_sessions(user_id,revoked_at,last_seen_at);
CREATE TABLE IF NOT EXISTS public.portal_device_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_device_authorizations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_portal_device_authorization_atomic(p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_code text;v_hash text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_hash:=encode(digest(trim(p_device_id),'sha256'),'hex');
  IF NOT EXISTS(SELECT 1 FROM public.portal_device_sessions WHERE user_id=v_uid AND device_hash=v_hash AND revoked_at IS NULL AND expires_at>now()) THEN RAISE EXCEPTION 'Current device is not authorized' USING ERRCODE='42501'; END IF;
  v_code:=lpad((floor(random()*100000000))::int::text,8,'0');
  INSERT INTO public.portal_device_authorizations(user_id,code_hash,expires_at) VALUES(v_uid,encode(digest(v_code,'sha256'),'hex'),now()+interval '10 minutes');
  RETURN jsonb_build_object('code',v_code,'expires_at',now()+interval '10 minutes');
END $$;
GRANT EXECUTE ON FUNCTION public.create_portal_device_authorization_atomic(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_portal_device_session_atomic(p_device_id text,p_device_label text DEFAULT NULL,p_authorization_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_hash text:=encode(digest(trim(COALESCE(p_device_id,'')),'sha256'),'hex');v_existing public.portal_device_sessions%ROWTYPE;v_active integer;v_grant public.portal_device_authorizations%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR length(trim(COALESCE(p_device_id,'')))<16 THEN RAISE EXCEPTION 'Invalid device identity' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_existing FROM public.portal_device_sessions WHERE user_id=v_uid AND device_hash=v_hash FOR UPDATE;
  IF v_existing.id IS NOT NULL AND v_existing.revoked_at IS NULL AND v_existing.expires_at>now() THEN UPDATE public.portal_device_sessions SET last_seen_at=now(),device_label=COALESCE(NULLIF(trim(p_device_label),''),device_label) WHERE id=v_existing.id; RETURN jsonb_build_object('status','active','device_id',v_existing.id,'authorized_device',v_existing.is_authorized_device); END IF;
  SELECT count(*) INTO v_active FROM public.portal_device_sessions WHERE user_id=v_uid AND revoked_at IS NULL AND expires_at>now();
  IF v_active=0 THEN INSERT INTO public.portal_device_sessions(user_id,device_hash,device_label,is_authorized_device) VALUES(v_uid,v_hash,NULLIF(trim(p_device_label),''),false) RETURNING id INTO v_existing.id; RETURN jsonb_build_object('status','active','device_id',v_existing.id,'authorized_device',false); END IF;
  IF NULLIF(trim(p_authorization_code),'') IS NULL THEN RETURN jsonb_build_object('status','blocked','reason','another_device_active'); END IF;
  SELECT * INTO v_grant FROM public.portal_device_authorizations WHERE user_id=v_uid AND code_hash=encode(digest(trim(p_authorization_code),'sha256'),'hex') AND used_at IS NULL AND expires_at>now() FOR UPDATE;
  IF v_grant.id IS NULL THEN RETURN jsonb_build_object('status','blocked','reason','invalid_authorization'); END IF;
  IF v_active>=2 THEN RETURN jsonb_build_object('status','blocked','reason','device_limit_reached'); END IF;
  UPDATE public.portal_device_authorizations SET used_at=now() WHERE id=v_grant.id;
  INSERT INTO public.portal_device_sessions(user_id,device_hash,device_label,is_authorized_device) VALUES(v_uid,v_hash,NULLIF(trim(p_device_label),''),true) RETURNING id INTO v_existing.id;
  RETURN jsonb_build_object('status','active','device_id',v_existing.id,'authorized_device',true);
END $$;
GRANT EXECUTE ON FUNCTION public.claim_portal_device_session_atomic(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.heartbeat_portal_device_session_atomic(p_device_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text:=encode(digest(trim(COALESCE(p_device_id,'')),'sha256'),'hex');v_ok boolean;
BEGIN
  UPDATE public.portal_device_sessions SET last_seen_at=now(),expires_at=GREATEST(expires_at,now()+interval '30 days') WHERE user_id=auth.uid() AND device_hash=v_hash AND revoked_at IS NULL AND expires_at>now();
  GET DIAGNOSTICS v_ok=ROW_COUNT; RETURN v_ok;
END $$;
GRANT EXECUTE ON FUNCTION public.heartbeat_portal_device_session_atomic(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_portal_device_session_atomic(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v boolean;
BEGIN UPDATE public.portal_device_sessions SET revoked_at=now() WHERE id=p_session_id AND user_id=auth.uid() RETURNING true INTO v; RETURN COALESCE(v,false); END $$;
GRANT EXECUTE ON FUNCTION public.revoke_portal_device_session_atomic(uuid) TO authenticated;

COMMENT ON TABLE public.payment_collection_accounts IS 'Canonical payment destinations. Effective hierarchy is tenancy override, unit, property, agency, landlord, manager. All tenant prompts and portal instructions resolve from this live table.';
COMMENT ON TABLE public.payment_share_access_grants IS 'Short-lived verification grants issued only after a tenant-created shared-link access code is verified.';
COMMENT ON TABLE public.portal_device_sessions IS 'Application-level device gate: one device by default, with a short-lived explicit authorization for a second device.';

CREATE OR REPLACE FUNCTION public.get_public_payment_share_status(p_token text,p_transaction_id uuid,p_grant text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text;v_grant_hash text;v_link public.payment_share_links%ROWTYPE;v_tx public.payment_transactions%ROWTYPE;v_receipt jsonb;
BEGIN
  v_hash:=encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');v_grant_hash:=encode(digest(trim(COALESCE(p_grant,'')),'sha256'),'hex');
  SELECT * INTO v_link FROM public.payment_share_links l WHERE l.token_hash=v_hash AND l.revoked_at IS NULL AND l.expires_at>now() AND EXISTS(SELECT 1 FROM public.payment_share_access_grants g WHERE g.share_link_id=l.id AND g.grant_hash=v_grant_hash AND g.used_at IS NULL AND g.expires_at>now());
  IF v_link.id IS NULL THEN RAISE EXCEPTION 'Payment link is invalid or expired' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_tx FROM public.payment_transactions WHERE id=p_transaction_id;
  IF v_tx.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.payment_share_link_invoices sli WHERE sli.share_link_id=v_link.id AND sli.invoice_id=v_tx.invoice_id) THEN RAISE EXCEPTION 'Payment transaction not found for this link' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('receipt_id',r.id,'receipt_number',r.receipt_number,'issued_at',r.issued_at,'total_amount',r.total_amount) INTO v_receipt FROM public.issued_payment_receipts r WHERE r.transaction_id=v_tx.id LIMIT 1;
  RETURN jsonb_build_object('transaction_id',v_tx.id,'status',v_tx.status,'amount',v_tx.amount,'mpesa_receipt_number',v_tx.mpesa_receipt_number,'completed_at',v_tx.completed_at,'receipt',v_receipt);
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_payment_share_status(text,uuid,text) TO anon,authenticated;

-- Remove pre-hardening overloads so a raw link token can never bypass verification.
DROP FUNCTION IF EXISTS public.get_public_payment_share(text);
DROP FUNCTION IF EXISTS public.get_public_payment_share_status(text,uuid);
DROP FUNCTION IF EXISTS public.consume_shared_payment_link_atomic(text);
DROP FUNCTION IF EXISTS public.create_tenant_payment_share_link_atomic(uuid[],integer,text);

CREATE OR REPLACE FUNCTION public.consume_shared_payment_link_atomic(p_token text,p_grant text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text;v_grant_hash text;v_ok boolean;
BEGIN
  v_hash:=encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');v_grant_hash:=encode(digest(trim(COALESCE(p_grant,'')),'sha256'),'hex');
  UPDATE public.payment_share_links l SET use_count=use_count+1,updated_at=now()
  WHERE l.token_hash=v_hash AND l.revoked_at IS NULL AND l.expires_at>now() AND l.use_count<l.max_uses AND l.verified_until>now()
    AND EXISTS(SELECT 1 FROM public.payment_share_access_grants g WHERE g.share_link_id=l.id AND g.grant_hash=v_grant_hash AND g.used_at IS NULL AND g.expires_at>now())
  RETURNING true INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Payment link authorization is invalid or expired' USING ERRCODE='P4090'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.consume_shared_payment_link_atomic(text,text) TO anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_payment_collection_account(uuid) FROM anon;

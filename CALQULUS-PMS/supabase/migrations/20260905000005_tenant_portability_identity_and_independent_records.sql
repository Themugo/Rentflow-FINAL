-- CALQULUS: Tenant portability, independent records and management modes.
-- One tenant identity survives changes in management. Historical records are never recreated or discarded.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS management_mode text NOT NULL DEFAULT 'manager',
  ADD COLUMN IF NOT EXISTS managing_landlord_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS management_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS management_updated_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_management_mode_check;
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_management_mode_check
    CHECK (management_mode IN ('agency','manager','landlord','independent'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_management_mode ON public.tenants(management_mode);
CREATE INDEX IF NOT EXISTS idx_tenants_managing_landlord ON public.tenants(managing_landlord_id);

-- Independent records remain tied to the person and can later be linked to the canonical tenant identity.
ALTER TABLE public.orphan_tenant_records
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.orphan_payment_entries
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orphan_records_tenant ON public.orphan_tenant_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orphan_payments_tenant ON public.orphan_payment_entries(tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_personal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'contract',
  title text NOT NULL,
  file_url text NOT NULL,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_personal_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_personal_documents_own ON public.tenant_personal_documents;
CREATE POLICY tenant_personal_documents_own ON public.tenant_personal_documents FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_tenant_personal_documents_tenant ON public.tenant_personal_documents(tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_personal_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text
);
ALTER TABLE public.tenant_personal_maintenance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_personal_maintenance_logs_own ON public.tenant_personal_maintenance_logs;
CREATE POLICY tenant_personal_maintenance_logs_own ON public.tenant_personal_maintenance_logs FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_tenant_personal_maintenance_tenant ON public.tenant_personal_maintenance_logs(tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_platform_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  independent_signup_enabled boolean NOT NULL DEFAULT true,
  transaction_fee_enabled boolean NOT NULL DEFAULT false,
  transaction_fee_type text NOT NULL DEFAULT 'percentage' CHECK (transaction_fee_type IN ('percentage','fixed')),
  transaction_fee_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (transaction_fee_value >= 0),
  transaction_fee_currency text NOT NULL DEFAULT 'KES',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.tenant_platform_config(id) VALUES(true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenant_platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_platform_config_admin_read ON public.tenant_platform_config;
CREATE POLICY tenant_platform_config_admin_read ON public.tenant_platform_config FOR SELECT
USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=auth.uid() AND NOT pa.suspended AND pa.can_manage_platform_settings));
DROP POLICY IF EXISTS tenant_platform_config_admin_write ON public.tenant_platform_config;
CREATE POLICY tenant_platform_config_admin_write ON public.tenant_platform_config FOR ALL
USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=auth.uid() AND NOT pa.suspended AND pa.can_manage_platform_settings))
WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=auth.uid() AND NOT pa.suspended AND pa.can_manage_platform_settings));

-- Backfill management mode from the existing relationship model.
UPDATE public.tenants t SET management_mode = CASE
  WHEN t.source = 'self_registered' AND t.manager_id IS NULL AND t.property_id IS NULL THEN 'independent'
  WHEN t.manager_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=t.manager_id AND mp.agency_id IS NOT NULL) THEN 'agency'
  WHEN t.manager_id IS NOT NULL THEN 'manager'
  WHEN t.property_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.property_landlords pl
    WHERE pl.property_id=t.property_id AND pl.operating_model='landlord_self_managed'
  ) THEN 'landlord'
  ELSE 'independent'
END,
management_updated_at=COALESCE(t.management_updated_at,t.updated_at);

-- Secure context for the signed-in tenant. No cross-tenant browsing.
CREATE OR REPLACE FUNCTION public.get_my_tenant_management_context()
RETURNS TABLE(
  tenant_id uuid,
  management_mode text,
  manager_id uuid,
  agency_id uuid,
  landlord_user_id uuid,
  property_id uuid,
  unit_id uuid,
  property_name text,
  unit_number text,
  manager_name text,
  agency_name text,
  landlord_name text,
  has_active_lease boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
  SELECT ur.tenant_id INTO tid FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='tenant' LIMIT 1;
  IF tid IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT t.id,
    COALESCE(t.management_mode,CASE WHEN t.manager_id IS NOT NULL THEN 'manager' WHEN t.property_id IS NOT NULL THEN 'landlord' ELSE 'independent' END),
    t.manager_id,
    mp.agency_id,
    COALESCE(t.managing_landlord_id,pl.landlord_user_id),
    t.property_id,t.unit_id,
    COALESCE(p.name,t.property),COALESCE(u.unit_number,t.unit),
    m.full_name,
    ag.name,
    l.full_name,
    EXISTS(SELECT 1 FROM public.leases le WHERE le.tenant_id=t.id AND le.status='active' AND le.archived_at IS NULL)
  FROM public.tenants t
  LEFT JOIN public.manager_profiles mp ON mp.manager_user_id=t.manager_id
  LEFT JOIN public.agencies ag ON ag.id=mp.agency_id
  LEFT JOIN public.property_landlords pl ON pl.property_id=t.property_id
  LEFT JOIN public.properties p ON p.id=t.property_id
  LEFT JOIN public.units u ON u.id=t.unit_id
  LEFT JOIN public.profiles m ON m.id=t.manager_id
  LEFT JOIN public.profiles l ON l.id=COALESCE(t.managing_landlord_id,pl.landlord_user_id)
  WHERE t.id=tid;
END $$;
REVOKE ALL ON FUNCTION public.get_my_tenant_management_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_management_context() TO authenticated;

-- Reworked self-registration: free account, canonical tenant identity, optional starter rental record.
CREATE OR REPLACE FUNCTION public.self_register_tenant_atomic(p_name text,p_phone text DEFAULT NULL,p_rental jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); v_email text; v_tenant uuid;
BEGIN
  IF v_user IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user;
  IF p_name IS NULL OR btrim(p_name)='' THEN RAISE EXCEPTION 'Name is required' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role<>'tenant') THEN RAISE EXCEPTION 'This account already has a non-tenant role' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.user_roles WHERE user_id=v_user AND role='tenant' LIMIT 1;
  IF v_tenant IS NULL THEN
    INSERT INTO public.tenants(name,email,phone,manager_id,status,source,management_mode,management_started_at,management_updated_at)
    VALUES(btrim(p_name),lower(btrim(v_email)),NULLIF(btrim(p_phone),''),NULL,'active','self_registered','independent',now(),now()) RETURNING id INTO v_tenant;
    INSERT INTO public.user_roles(user_id,tenant_id,role,approval_status) VALUES(v_user,v_tenant,'tenant','approved');
    INSERT INTO public.tenant_transfer_log(tenant_id,from_manager_id,to_manager_id,transfer_type,transferred_by,notes)
    VALUES(v_tenant,NULL,NULL,'self_register',v_user,'Independent tenant self-registration');
  ELSE
    IF EXISTS (SELECT 1 FROM public.tenants t JOIN public.leases le ON le.tenant_id=t.id WHERE t.id=v_tenant AND COALESCE(t.management_mode,'independent')<>'independent' AND le.status='active' AND le.archived_at IS NULL) THEN
      RAISE EXCEPTION 'Complete or terminate the current lease before switching to an independent record' USING ERRCODE='40901';
    END IF;
    UPDATE public.tenants SET management_mode='independent',manager_id=NULL,managing_landlord_id=NULL,property_id=NULL,unit_id=NULL,property=NULL,unit=NULL,management_updated_at=now(),updated_at=now() WHERE id=v_tenant;
  END IF;
  INSERT INTO public.profiles(id,email,full_name,phone)
  VALUES(v_user,lower(btrim(v_email)),btrim(p_name),NULLIF(btrim(p_phone),''))
  ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name,phone=COALESCE(EXCLUDED.phone,profiles.phone);
  INSERT INTO public.orphan_tenant_records(user_id,tenant_id,property_name,unit_label,landlord_name,landlord_phone,county,address,move_in_date,monthly_rent)
  VALUES(v_user,v_tenant,NULLIF(btrim(COALESCE(p_rental->>'property_name','')),''),NULLIF(btrim(COALESCE(p_rental->>'unit_label','')),''),NULLIF(btrim(COALESCE(p_rental->>'landlord_name','')),''),NULLIF(btrim(COALESCE(p_rental->>'landlord_phone','')),''),NULLIF(btrim(COALESCE(p_rental->>'county','')),''),NULLIF(btrim(COALESCE(p_rental->>'address','')),''),NULLIF(p_rental->>'move_in_date','')::date,NULLIF(p_rental->>'monthly_rent','')::numeric)
  ON CONFLICT (user_id) DO UPDATE SET tenant_id=v_tenant,property_name=COALESCE(EXCLUDED.property_name,orphan_tenant_records.property_name),unit_label=COALESCE(EXCLUDED.unit_label,orphan_tenant_records.unit_label),landlord_name=COALESCE(EXCLUDED.landlord_name,orphan_tenant_records.landlord_name),landlord_phone=COALESCE(EXCLUDED.landlord_phone,orphan_tenant_records.landlord_phone),county=COALESCE(EXCLUDED.county,orphan_tenant_records.county),address=COALESCE(EXCLUDED.address,orphan_tenant_records.address),move_in_date=COALESCE(EXCLUDED.move_in_date,orphan_tenant_records.move_in_date),monthly_rent=COALESCE(EXCLUDED.monthly_rent,orphan_tenant_records.monthly_rent),updated_at=now();
  RETURN v_tenant;
END $$;
REVOKE ALL ON FUNCTION public.self_register_tenant_atomic(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.self_register_tenant_atomic(text,text,jsonb) TO authenticated,service_role;

-- Portable management transition. Historical leases/invoices/history stay on the same tenant id.
CREATE OR REPLACE FUNCTION public.transfer_tenant_management_atomic(
  p_tenant_id uuid,
  p_destination_mode text,
  p_destination_manager_id uuid DEFAULT NULL,
  p_destination_landlord_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_unit_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS public.tenants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenants%ROWTYPE; u public.units%ROWTYPE; dest public.properties%ROWTYPE; uid uuid:=auth.uid(); new_unit uuid:=p_unit_id; old_manager uuid; old_mode text; actor_ok boolean:=false; resolved_mode text:=p_destination_mode; landlord_id uuid;
BEGIN
  IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF resolved_mode NOT IN ('agency','manager','landlord','independent') THEN RAISE EXCEPTION 'Invalid destination mode' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE='P0002'; END IF;
  old_manager:=t.manager_id; old_mode:=COALESCE(t.management_mode,CASE WHEN t.manager_id IS NOT NULL THEN 'manager' ELSE 'independent' END);
  actor_ok := (EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=uid AND ur.role='tenant' AND ur.tenant_id=t.id))
    OR t.manager_id=uid
    OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=t.manager_id AND ms.submanager_user_id=uid)
    OR EXISTS(SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=uid AND NOT pa.suspended AND pa.can_manage_platform_settings);
  IF NOT actor_ok THEN RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=uid AND ur.role='tenant' AND ur.tenant_id=t.id)
     AND p_destination_mode<>'independent' THEN
    RAISE EXCEPTION 'Tenants cannot directly assign themselves to another managed property; a receiving manager or platform operator must perform the managed transfer' USING ERRCODE='42501';
  END IF;

  IF EXISTS(SELECT 1 FROM public.leases le WHERE le.tenant_id=t.id AND le.status='active' AND le.archived_at IS NULL) THEN
    RAISE EXCEPTION 'Complete or terminate the current lease before changing tenant management' USING ERRCODE='40901';
  END IF;

  IF resolved_mode='independent' THEN
    UPDATE public.tenants SET management_mode='independent',manager_id=NULL,managing_landlord_id=NULL,property_id=NULL,unit_id=NULL,property=NULL,unit=NULL,management_updated_at=now(),updated_at=now() WHERE id=t.id RETURNING * INTO t;
  ELSE
    IF p_property_id IS NULL THEN RAISE EXCEPTION 'Destination property is required' USING ERRCODE='22023'; END IF;
    SELECT * INTO dest FROM public.properties WHERE id=p_property_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Destination property not found' USING ERRCODE='P0002'; END IF;
    IF resolved_mode IN ('manager','agency') THEN
      IF p_destination_manager_id IS NULL OR dest.manager_id IS DISTINCT FROM p_destination_manager_id THEN RAISE EXCEPTION 'Destination manager does not own this property' USING ERRCODE='42501'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p_destination_manager_id AND ur.role='manager' AND ur.approval_status='approved') THEN RAISE EXCEPTION 'Destination manager is not approved' USING ERRCODE='42501'; END IF;
      IF resolved_mode='agency' AND NOT EXISTS(SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=p_destination_manager_id AND mp.agency_id IS NOT NULL) THEN RAISE EXCEPTION 'Destination manager is not agency managed' USING ERRCODE='22023'; END IF;
    ELSE
      SELECT pl.landlord_user_id INTO landlord_id FROM public.property_landlords pl WHERE pl.property_id=p_property_id AND pl.landlord_user_id=COALESCE(p_destination_landlord_id,pl.landlord_user_id) AND pl.operating_model='landlord_self_managed' LIMIT 1;
      IF landlord_id IS NULL THEN RAISE EXCEPTION 'Destination property is not configured for direct landlord management' USING ERRCODE='42501'; END IF;
    END IF;
    IF new_unit IS NULL AND NULLIF(trim(p_unit_number),'') IS NOT NULL THEN SELECT id INTO new_unit FROM public.units WHERE property_id=p_property_id AND lower(unit_number)=lower(trim(p_unit_number)) LIMIT 1 FOR UPDATE; END IF;
    IF new_unit IS NOT NULL THEN
      SELECT * INTO u FROM public.units WHERE id=new_unit AND property_id=p_property_id FOR UPDATE;
      IF NOT FOUND OR u.status='inactive' THEN RAISE EXCEPTION 'Destination unit is not available' USING ERRCODE='22023'; END IF;
      IF EXISTS(SELECT 1 FROM public.tenants x WHERE x.id<>t.id AND x.unit_id=u.id AND x.status='active') THEN RAISE EXCEPTION 'Destination unit already has an active tenant' USING ERRCODE='23505'; END IF;
    END IF;
    UPDATE public.tenants SET management_mode=resolved_mode,manager_id=CASE WHEN resolved_mode='landlord' THEN NULL ELSE p_destination_manager_id END,managing_landlord_id=CASE WHEN resolved_mode='landlord' THEN landlord_id ELSE NULL END,property_id=p_property_id,unit_id=new_unit,property=dest.name,unit=CASE WHEN new_unit IS NULL THEN NULL ELSE u.unit_number END,management_started_at=COALESCE(management_started_at,now()),management_updated_at=now(),updated_at=now() WHERE id=t.id RETURNING * INTO t;
  END IF;

  -- Link independent evidence to the same canonical tenant identity; do not delete the records.
  UPDATE public.orphan_tenant_records SET tenant_id=t.id,updated_at=now() WHERE user_id=(SELECT ur.user_id FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' LIMIT 1);
  UPDATE public.orphan_payment_entries SET tenant_id=t.id WHERE user_id=(SELECT ur.user_id FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' LIMIT 1) AND tenant_id IS NULL;
  UPDATE public.move_condition_photos SET tenant_id=t.id WHERE user_id=(SELECT ur.user_id FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' LIMIT 1) AND tenant_id IS NULL;
  UPDATE public.tenant_personal_documents SET tenant_id=t.id WHERE user_id=(SELECT ur.user_id FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' LIMIT 1) AND tenant_id IS NULL;
  UPDATE public.tenant_personal_maintenance_logs SET tenant_id=t.id WHERE user_id=(SELECT ur.user_id FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' LIMIT 1) AND tenant_id IS NULL;

  INSERT INTO public.tenant_transfer_log(tenant_id,from_manager_id,to_manager_id,transfer_type,transferred_by,notes)
  VALUES(
    t.id, old_manager, t.manager_id,
    CASE
      WHEN old_mode='independent' AND resolved_mode='agency' THEN 'orphan_to_agency'
      WHEN old_mode='independent' AND resolved_mode='manager' THEN 'orphan_to_manager'
      WHEN old_mode='independent' AND resolved_mode='landlord' THEN 'orphan_to_landlord'
      WHEN resolved_mode='independent' AND old_mode='agency' THEN 'agency_to_orphan'
      WHEN resolved_mode='independent' AND old_mode='manager' THEN 'manager_to_orphan'
      WHEN resolved_mode='independent' AND old_mode='landlord' THEN 'landlord_to_orphan'
      WHEN old_mode='agency' AND resolved_mode='manager' THEN 'agency_to_manager'
      WHEN old_mode='manager' AND resolved_mode='agency' THEN 'manager_to_agency'
      WHEN old_mode='agency' AND resolved_mode='landlord' THEN 'agency_to_landlord'
      WHEN old_mode='landlord' AND resolved_mode='agency' THEN 'landlord_to_agency'
      WHEN old_mode='manager' AND resolved_mode='landlord' THEN 'manager_to_landlord'
      WHEN old_mode='landlord' AND resolved_mode='manager' THEN 'landlord_to_manager'
      WHEN old_mode='agency' AND resolved_mode='agency' THEN 'agency_to_agency'
      ELSE 'manager_to_manager'
    END,
    uid,
    format('Management changed from %s to %s. %s',old_mode,resolved_mode,coalesce(nullif(trim(p_notes),''),''))
  );
  INSERT INTO public.tenant_history(tenant_id,action,description) VALUES(t.id,'Management change',format('Tenant record moved from %s to %s. Historical records retained.',old_mode,resolved_mode));
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.transfer_tenant_management_atomic(uuid,text,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_tenant_management_atomic(uuid,text,uuid,uuid,uuid,uuid,text,text) TO authenticated,service_role;

-- Preserve the established transfer_tenant_atomic API but allow a destination manager owned property.
CREATE OR REPLACE FUNCTION public.transfer_tenant_atomic(p_tenant_id uuid,p_property_id uuid,p_unit_id uuid DEFAULT NULL,p_unit_number text DEFAULT NULL,p_destination_manager_id uuid DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS public.tenants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_mode text:='manager'; v_agency uuid;
BEGIN
  IF p_destination_manager_id IS NULL THEN RAISE EXCEPTION 'Destination manager is required' USING ERRCODE='22023'; END IF;
  SELECT mp.agency_id INTO v_agency FROM public.manager_profiles mp WHERE mp.manager_user_id=p_destination_manager_id LIMIT 1;
  IF v_agency IS NOT NULL THEN v_mode:='agency'; END IF;
  RETURN public.transfer_tenant_management_atomic(p_tenant_id,v_mode,p_destination_manager_id,NULL,p_property_id,p_unit_id,p_unit_number,p_notes);
END $$;
GRANT EXECUTE ON FUNCTION public.transfer_tenant_atomic(uuid,uuid,uuid,text,uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.claim_orphan_tenant_atomic(p_tenant_id uuid,p_property_id uuid,p_unit_id uuid DEFAULT NULL,p_unit_number text DEFAULT NULL,p_destination_mode text DEFAULT 'manager',p_notes text DEFAULT NULL)
RETURNS public.tenants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_mode text:=p_destination_mode; uid uuid:=auth.uid(); v_manager uuid:=NULL; v_landlord uuid:=NULL;
BEGIN
  IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF v_mode='manager' THEN
    IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role='manager' AND approval_status='approved') THEN RAISE EXCEPTION 'Approved manager access required' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=uid) THEN RAISE EXCEPTION 'Destination property is not managed by this account' USING ERRCODE='42501'; END IF;
    v_manager:=uid;
  ELSIF v_mode='agency' THEN
    IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role='manager' AND approval_status='approved') OR NOT EXISTS(SELECT 1 FROM public.manager_profiles WHERE manager_user_id=uid AND agency_id IS NOT NULL) THEN RAISE EXCEPTION 'Approved agency manager access required' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=uid) THEN RAISE EXCEPTION 'Destination property is not managed by this account' USING ERRCODE='42501'; END IF;
    v_manager:=uid;
  ELSIF v_mode='landlord' THEN
    IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role='landlord' AND approval_status='approved') THEN RAISE EXCEPTION 'Approved landlord access required' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.property_landlords WHERE property_id=p_property_id AND landlord_user_id=uid AND operating_model='landlord_self_managed') THEN RAISE EXCEPTION 'Destination property is not configured for direct landlord management' USING ERRCODE='42501'; END IF;
    v_landlord:=uid;
  ELSE
    RAISE EXCEPTION 'Invalid destination mode' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=p_tenant_id AND t.manager_id IS NULL AND COALESCE(t.management_mode,'independent')='independent') THEN RAISE EXCEPTION 'Independent tenant not found' USING ERRCODE='P0002'; END IF;
  RETURN public.transfer_tenant_management_atomic(p_tenant_id,v_mode,v_manager,v_landlord,p_property_id,p_unit_id,p_unit_number,p_notes);
END $$;
GRANT EXECUTE ON FUNCTION public.claim_orphan_tenant_atomic(uuid,uuid,uuid,text,text,text) TO authenticated,service_role;

-- Personal document / maintenance writes are atomic and authenticated-user scoped.
CREATE OR REPLACE FUNCTION public.add_tenant_personal_document_atomic(p_document_type text,p_title text,p_file_url text,p_start_date date DEFAULT NULL,p_end_date date DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS public.tenant_personal_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid; v public.tenant_personal_documents%ROWTYPE;
BEGIN
  SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
  IF uid IS NULL OR tid IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_title),'') IS NULL OR nullif(trim(p_file_url),'') IS NULL THEN RAISE EXCEPTION 'Document title and file are required'; END IF;
  INSERT INTO public.tenant_personal_documents(user_id,tenant_id,document_type,title,file_url,start_date,end_date,notes)
  VALUES(uid,tid,COALESCE(NULLIF(trim(p_document_type),''),'contract'),left(trim(p_title),160),left(trim(p_file_url),2000),p_start_date,p_end_date,NULLIF(trim(p_notes),'')) RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.add_tenant_personal_document_atomic(text,text,text,date,date,text) TO authenticated;
REVOKE ALL ON FUNCTION public.add_tenant_personal_document_atomic(text,text,text,date,date,text) FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.add_tenant_personal_maintenance_atomic(p_title text,p_description text DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS public.tenant_personal_maintenance_logs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid; v public.tenant_personal_maintenance_logs%ROWTYPE;
BEGIN
  SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
  IF uid IS NULL OR tid IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_title),'') IS NULL THEN RAISE EXCEPTION 'Maintenance title is required'; END IF;
  INSERT INTO public.tenant_personal_maintenance_logs(user_id,tenant_id,title,description,notes) VALUES(uid,tid,left(trim(p_title),160),NULLIF(trim(p_description),''),NULLIF(trim(p_notes),'')) RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.add_tenant_personal_maintenance_atomic(text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.add_tenant_personal_maintenance_atomic(text,text,text) FROM PUBLIC,anon;

-- Platform admin can configure the fee that an eligible independent-tenant transaction service will use.
CREATE OR REPLACE FUNCTION public.save_tenant_platform_config(p_enabled boolean,p_fee_enabled boolean,p_fee_type text,p_fee_value numeric)
RETURNS public.tenant_platform_config LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v public.tenant_platform_config%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=uid AND NOT pa.suspended AND pa.can_manage_platform_settings) THEN RAISE EXCEPTION 'Platform settings access required' USING ERRCODE='42501'; END IF;
  IF p_fee_type NOT IN ('percentage','fixed') OR p_fee_value<0 OR (p_fee_type='percentage' AND p_fee_value>10) THEN RAISE EXCEPTION 'Invalid fee configuration' USING ERRCODE='22023'; END IF;
  INSERT INTO public.tenant_platform_config(id,independent_signup_enabled,transaction_fee_enabled,transaction_fee_type,transaction_fee_value,updated_by,updated_at)
  VALUES(true,p_enabled,p_fee_enabled,p_fee_type,p_fee_value,uid,now())
  ON CONFLICT(id) DO UPDATE SET independent_signup_enabled=EXCLUDED.independent_signup_enabled,transaction_fee_enabled=EXCLUDED.transaction_fee_enabled,transaction_fee_type=EXCLUDED.transaction_fee_type,transaction_fee_value=EXCLUDED.transaction_fee_value,updated_by=uid,updated_at=now()
  RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_tenant_platform_config(boolean,boolean,text,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.save_tenant_platform_config(boolean,boolean,text,numeric) FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.calculate_independent_tenant_service_fee(p_amount numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN p_amount<=0 THEN 0 ELSE CASE WHEN c.transaction_fee_enabled AND c.transaction_fee_type='percentage' THEN round(p_amount*c.transaction_fee_value/100,2) WHEN c.transaction_fee_enabled AND c.transaction_fee_type='fixed' THEN c.transaction_fee_value ELSE 0 END END FROM public.tenant_platform_config c WHERE c.id=true;
$$;
GRANT EXECUTE ON FUNCTION public.calculate_independent_tenant_service_fee(numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.calculate_independent_tenant_service_fee(numeric) FROM PUBLIC,anon;

COMMENT ON TABLE public.tenant_personal_documents IS 'Portable tenant-owned documents retained across management changes.';
COMMENT ON TABLE public.tenant_personal_maintenance_logs IS 'Portable tenant-owned maintenance diary retained across management changes.';
COMMENT ON COLUMN public.tenants.management_mode IS 'agency | manager | landlord | independent. Changes do not replace the canonical tenant id/history.';

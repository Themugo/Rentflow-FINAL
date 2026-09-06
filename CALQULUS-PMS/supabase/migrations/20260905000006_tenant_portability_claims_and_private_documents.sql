-- CALQULUS tenant portability completion:
-- authenticated invitation claiming, private personal documents, and public-safe
-- independent signup availability check.

DO $$
BEGIN
  ALTER TABLE public.tenant_transfer_log DROP CONSTRAINT IF EXISTS tenant_transfer_log_transfer_type_check;
  ALTER TABLE public.tenant_transfer_log ADD CONSTRAINT tenant_transfer_log_transfer_type_check
    CHECK (transfer_type IN (
      'self_register','manager_claim','manager_to_manager','orphan_to_manager',
      'manager_to_orphan','manager_to_landlord','landlord_to_manager','landlord_to_orphan',
      'orphan_to_landlord','orphan_to_agency','agency_to_manager','manager_to_agency',
      'agency_to_agency','agency_to_orphan','landlord_to_agency','agency_to_landlord'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Private bucket for tenant-owned contract/rental evidence. The object path must begin with auth.uid().
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-personal-documents', 'tenant-personal-documents', false)
ON CONFLICT (id) DO UPDATE SET public=false;

DROP POLICY IF EXISTS tenant_personal_documents_select ON storage.objects;
CREATE POLICY tenant_personal_documents_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='tenant-personal-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS tenant_personal_documents_insert ON storage.objects;
CREATE POLICY tenant_personal_documents_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='tenant-personal-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS tenant_personal_documents_update ON storage.objects;
CREATE POLICY tenant_personal_documents_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='tenant-personal-documents' AND (storage.foldername(name))[1]=auth.uid()::text)
WITH CHECK (bucket_id='tenant-personal-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS tenant_personal_documents_delete ON storage.objects;
CREATE POLICY tenant_personal_documents_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='tenant-personal-documents' AND (storage.foldername(name))[1]=auth.uid()::text);

CREATE OR REPLACE FUNCTION public.get_tenant_signup_status()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT independent_signup_enabled FROM public.tenant_platform_config WHERE id=true), true);
$$;
REVOKE ALL ON FUNCTION public.get_tenant_signup_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_signup_status() TO anon, authenticated;

-- Secure invitation claim that deliberately reuses an existing independent tenant row.
CREATE OR REPLACE FUNCTION public.claim_tenant_invitation_atomic(p_token text)
RETURNS public.tenants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid:=auth.uid(); v public.tenant_invitations%ROWTYPE; t public.tenants%ROWTYPE;
  existing_tid uuid; v_mode text:='manager'; v_agency uuid; v_unit uuid; old_manager uuid; old_mode text;
BEGIN
  IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NULLIF(trim(p_token),'') IS NULL THEN RAISE EXCEPTION 'Invitation token is required' USING ERRCODE='22023'; END IF;

  SELECT * INTO v FROM public.tenant_invitations WHERE token=trim(p_token) FOR UPDATE;
  IF NOT FOUND OR v.status<>'pending' OR v.expires_at<=now() THEN RAISE EXCEPTION 'Invitation is invalid or expired' USING ERRCODE='41000'; END IF;
  IF lower(v.email)<>lower(COALESCE((SELECT email FROM auth.users WHERE id=uid),'')) THEN RAISE EXCEPTION 'Invitation email does not match account' USING ERRCODE='42501'; END IF;

  IF v.property_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v.property_id AND p.manager_id::text=v.invited_by::text) THEN
    RAISE EXCEPTION 'Invitation property is no longer valid' USING ERRCODE='42501';
  END IF;

  SELECT ur.tenant_id INTO existing_tid FROM public.user_roles ur WHERE ur.user_id=uid AND ur.role='tenant' LIMIT 1;
  IF existing_tid IS NOT NULL THEN
    SELECT * INTO t FROM public.tenants WHERE id=existing_tid FOR UPDATE;
    IF NOT FOUND THEN existing_tid:=NULL; ELSE old_manager:=t.manager_id; old_mode:=COALESCE(t.management_mode,'independent'); END IF;
  END IF;

  IF existing_tid IS NULL THEN
    SELECT mp.agency_id INTO v_agency FROM public.manager_profiles mp WHERE mp.manager_user_id::text=v.invited_by::text LIMIT 1;
    v_mode:=CASE WHEN v_agency IS NOT NULL THEN 'agency' ELSE 'manager' END;
    IF v.unit IS NOT NULL THEN
      SELECT id INTO v_unit FROM public.units WHERE property_id=v.property_id AND lower(unit_number)=lower(trim(v.unit)) LIMIT 1;
    END IF;
    INSERT INTO public.tenants(name,email,phone,manager_id,property,property_id,unit,unit_id,monthly_rent,status,source,management_mode,management_started_at,management_updated_at,created_at,updated_at)
    VALUES(v.tenant_name,lower(v.email),v.phone, v.invited_by::uuid, v.property_name,v.property_id,v.unit,v_unit,v.monthly_rent,'active','manager_created',v_mode,now(),now(),now(),now())
    RETURNING * INTO t;
    INSERT INTO public.user_roles(user_id,tenant_id,role,approval_status) VALUES(uid,t.id,'tenant','approved') ON CONFLICT(user_id,role) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,approval_status='approved';
  ELSE
    IF COALESCE(t.management_mode,'independent')<>'independent' AND t.manager_id IS NOT NULL THEN
      RAISE EXCEPTION 'This tenant account is already linked to a managed property' USING ERRCODE='40901';
    END IF;
    SELECT mp.agency_id INTO v_agency FROM public.manager_profiles mp WHERE mp.manager_user_id::text=v.invited_by::text LIMIT 1;
    v_mode:=CASE WHEN v_agency IS NOT NULL THEN 'agency' ELSE 'manager' END;
    IF v.unit IS NOT NULL THEN
      SELECT id INTO v_unit FROM public.units WHERE property_id=v.property_id AND lower(unit_number)=lower(trim(v.unit)) LIMIT 1;
    END IF;
    UPDATE public.tenants SET
      name=COALESCE(NULLIF(trim(t.name),''),v.tenant_name),
      email=lower(v.email),
      phone=COALESCE(v.phone,t.phone),
      manager_id=v.invited_by::uuid,
      managing_landlord_id=NULL,
      property=v.property_name,
      property_id=v.property_id,
      unit=v.unit,
      unit_id=v_unit,
      monthly_rent=COALESCE(v.monthly_rent,t.monthly_rent),
      management_mode=v_mode,
      management_started_at=COALESCE(t.management_started_at,now()),
      management_updated_at=now(),
      status=CASE WHEN t.status IS NULL THEN 'active' ELSE t.status END,
      updated_at=now()
    WHERE id=t.id RETURNING * INTO t;
  END IF;

  UPDATE public.user_roles SET tenant_id=t.id,approval_status='approved' WHERE user_id=uid AND role='tenant';
  UPDATE public.profiles SET full_name=COALESCE(NULLIF(trim(v.tenant_name),''),profiles.full_name),phone=COALESCE(v.phone,profiles.phone) WHERE id=uid;
  UPDATE public.orphan_tenant_records SET tenant_id=t.id,updated_at=now() WHERE user_id=uid;
  UPDATE public.orphan_payment_entries SET tenant_id=t.id WHERE user_id=uid AND tenant_id IS NULL;
  UPDATE public.move_condition_photos SET tenant_id=t.id WHERE user_id=uid AND tenant_id IS NULL;
  UPDATE public.tenant_personal_documents SET tenant_id=t.id WHERE user_id=uid AND tenant_id IS NULL;
  UPDATE public.tenant_personal_maintenance_logs SET tenant_id=t.id WHERE user_id=uid AND tenant_id IS NULL;

  UPDATE public.tenant_invitations SET status='accepted',used_at=now() WHERE id=v.id;
  INSERT INTO public.tenant_transfer_log(tenant_id,from_manager_id,to_manager_id,transfer_type,transferred_by,notes)
  VALUES(t.id,old_manager,t.manager_id,CASE WHEN existing_tid IS NULL THEN 'manager_claim' WHEN v_agency IS NOT NULL THEN 'orphan_to_agency' ELSE 'orphan_to_manager' END,uid,'Invitation claimed without replacing the canonical tenant identity; portable records retained.');
  INSERT INTO public.tenant_history(tenant_id,action,description) VALUES(t.id,'Management change','Tenant invitation claimed. Existing tenant history and portable records retained.');
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.claim_tenant_invitation_atomic(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_tenant_invitation_atomic(text) TO authenticated,service_role;

-- Personal maintenance logs can be created only by the tenant owner; status changes can be added later via a separate lifecycle RPC.
CREATE OR REPLACE FUNCTION public.add_tenant_personal_maintenance_atomic(p_title text,p_description text DEFAULT NULL,p_notes text DEFAULT NULL,p_photo_urls jsonb DEFAULT '[]'::jsonb)
RETURNS public.tenant_personal_maintenance_logs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); tid uuid; v public.tenant_personal_maintenance_logs%ROWTYPE;
BEGIN
  IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO tid FROM public.user_roles WHERE user_id=uid AND role='tenant' LIMIT 1;
  IF tid IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;
  IF NULLIF(trim(p_title),'') IS NULL THEN RAISE EXCEPTION 'Maintenance title is required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.tenant_personal_maintenance_logs(user_id,tenant_id,title,description,notes,photo_urls)
  VALUES(uid,tid,left(trim(p_title),160),NULLIF(trim(p_description),''),NULLIF(trim(p_notes),''),COALESCE(p_photo_urls,'[]'::jsonb)) RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.add_tenant_personal_maintenance_atomic(text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_tenant_personal_maintenance_atomic(text,text,text,jsonb) TO authenticated,service_role;

COMMENT ON FUNCTION public.claim_tenant_invitation_atomic(text) IS 'Claims a tenant invitation while reusing an existing independent tenant identity and preserving portable evidence.';

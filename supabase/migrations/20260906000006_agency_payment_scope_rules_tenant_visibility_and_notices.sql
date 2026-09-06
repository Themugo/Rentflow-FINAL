-- CALQULUS PMS — Agency payment policy hierarchy, tenant visibility and notices
-- Scope is intentionally broad: Agency -> Property -> Unit.
-- Payment destinations remain governed by payment_collection_accounts.
-- The policy layer governs payment behaviour/terms and is consumed by Agency
-- controls + tenant-visible summaries without rewriting historical invoices.

CREATE TABLE IF NOT EXISTS public.agency_payment_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('agency','property','unit')),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  policy_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','superseded','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_visible boolean NOT NULL DEFAULT true,
  tenant_notice_title text,
  tenant_notice_body text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (
    (scope_type='agency' AND property_id IS NULL AND unit_id IS NULL)
    OR (scope_type='property' AND property_id IS NOT NULL AND unit_id IS NULL)
    OR (scope_type='unit' AND property_id IS NOT NULL AND unit_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS agency_payment_policies_agency_idx
  ON public.agency_payment_policies(agency_id,status,effective_from DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS agency_payment_policies_property_idx
  ON public.agency_payment_policies(property_id,status,effective_from DESC,updated_at DESC)
  WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agency_payment_policies_unit_idx
  ON public.agency_payment_policies(unit_id,status,effective_from DESC,updated_at DESC)
  WHERE unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agency_payment_policies_active_scope_uidx
  ON public.agency_payment_policies(
    agency_id,scope_type,
    COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS agency_payment_policies_scheduled_scope_uidx
  ON public.agency_payment_policies(
    agency_id,scope_type,
    COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE status='scheduled';

ALTER TABLE public.agency_payment_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_payment_policies_read ON public.agency_payment_policies;
CREATE POLICY agency_payment_policies_read
  ON public.agency_payment_policies FOR SELECT TO authenticated
  USING (
    public.can_manage_agency_admin(agency_id,'view_settings')
    OR public.can_manage_agency_admin(agency_id,'manage_billing_rules')
    OR public.can_manage_agency_admin(agency_id,'view_financials')
  );
REVOKE INSERT,UPDATE,DELETE ON public.agency_payment_policies FROM authenticated;

CREATE TABLE IF NOT EXISTS public.agency_payment_policy_notice_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.agency_payment_policies(id) ON DELETE SET NULL,
  audience_mode text NOT NULL CHECK (audience_mode IN ('selected','global')),
  title text NOT NULL,
  body text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  sent_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agency_payment_policy_notice_campaigns_agency_idx
  ON public.agency_payment_policy_notice_campaigns(agency_id,created_at DESC);
CREATE INDEX IF NOT EXISTS agency_payment_policy_notice_campaigns_policy_idx
  ON public.agency_payment_policy_notice_campaigns(policy_id,created_at DESC)
  WHERE policy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agency_payment_policy_notice_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.agency_payment_policy_notice_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.in_app_notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,tenant_id)
);
CREATE INDEX IF NOT EXISTS agency_payment_policy_notice_recipients_tenant_idx
  ON public.agency_payment_policy_notice_recipients(tenant_id,created_at DESC);

ALTER TABLE public.agency_payment_policy_notice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_payment_policy_notice_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_payment_policy_notice_campaigns_read ON public.agency_payment_policy_notice_campaigns;
CREATE POLICY agency_payment_policy_notice_campaigns_read
  ON public.agency_payment_policy_notice_campaigns FOR SELECT TO authenticated
  USING (public.can_manage_agency_admin(agency_id,'view_settings'));
DROP POLICY IF EXISTS agency_payment_policy_notice_recipients_read ON public.agency_payment_policy_notice_recipients;
CREATE POLICY agency_payment_policy_notice_recipients_read
  ON public.agency_payment_policy_notice_recipients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_payment_policy_notice_campaigns c
      WHERE c.id=agency_payment_policy_notice_recipients.campaign_id
        AND public.can_manage_agency_admin(c.agency_id,'view_settings')
    )
  );
REVOKE INSERT,UPDATE,DELETE ON public.agency_payment_policy_notice_campaigns FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.agency_payment_policy_notice_recipients FROM authenticated;

CREATE OR REPLACE FUNCTION public.agency_payment_policy_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'allowed_payment_methods',jsonb_build_array('mpesa_paybill','mpesa_till','bank_transfer','cash'),
    'collection_destination','agency',
    'allow_partial_payments',true,
    'allow_third_party_payers',true,
    'manual_payment_enabled',true,
    'manual_payment_requires_approval',true,
    'separate_manual_payment_reviewer',false,
    'proof_required_for_manual',true,
    'allow_external_consolidation',true,
    'payment_reference_required',false,
    'reminder_before_days',3,
    'overdue_reminder_interval_days',3,
    'late_fee_type','none',
    'late_fee_value',0,
    'agency_split_percent',100,
    'tenant_visible',true,
    'charge_components',jsonb_build_array('rent','water','security','garbage','service_charge','parking','maintenance','other')
  );
$$;

CREATE OR REPLACE FUNCTION public.agency_payment_policy_scope_allowed(
  p_agency_id uuid,
  p_scope_type text,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_property uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_agency_admin(p_agency_id,'manage_billing_rules') THEN
    RETURN false;
  END IF;
  IF p_scope_type='agency' THEN
    RETURN p_property_id IS NULL AND p_unit_id IS NULL;
  ELSIF p_scope_type='property' THEN
    RETURN p_property_id IS NOT NULL AND p_unit_id IS NULL
      AND public.agency_property_in_scope(p_agency_id,p_property_id);
  ELSIF p_scope_type='unit' THEN
    IF p_unit_id IS NULL OR p_property_id IS NULL THEN RETURN false; END IF;
    SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id;
    RETURN v_property=p_property_id AND public.agency_property_in_scope(p_agency_id,p_property_id);
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_payment_policy_options(p_agency_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_properties jsonb; v_units jsonb;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'view_settings')
     AND NOT public.can_manage_agency_admin(p_agency_id,'manage_billing_rules') THEN
    RAISE EXCEPTION 'Agency payment-rule access denied' USING ERRCODE='42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'address',p.address) ORDER BY p.name),'[]'::jsonb)
    INTO v_properties
  FROM public.properties p
  WHERE public.agency_property_in_scope(p_agency_id,p.id);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'property_id',u.property_id,'unit_number',u.unit_number,'property_name',p.name) ORDER BY p.name,u.unit_number),'[]'::jsonb)
    INTO v_units
  FROM public.units u JOIN public.properties p ON p.id=u.property_id
  WHERE public.agency_property_in_scope(p_agency_id,u.property_id);
  RETURN jsonb_build_object('properties',v_properties,'units',v_units);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_payment_policy_notice_candidates(p_agency_id uuid,p_scope_type text,p_property_id uuid DEFAULT NULL,p_unit_id uuid DEFAULT NULL)
RETURNS TABLE(tenant_id uuid,tenant_name text,property_id uuid,property_name text,unit_id uuid,unit_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_billing_rules') THEN
    RAISE EXCEPTION 'Agency billing-rule permission required' USING ERRCODE='42501';
  END IF;
  IF NOT public.agency_payment_policy_scope_allowed(p_agency_id,p_scope_type,p_property_id,p_unit_id) THEN
    RAISE EXCEPTION 'Policy scope is outside the Agency book' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT t.id,t.name,p.id,p.name,u.id,u.unit_number
  FROM public.tenants t
  LEFT JOIN public.properties p ON p.id=t.property_id
  LEFT JOIN public.units u ON u.id=t.unit_id
  WHERE t.status IN ('active','pending','Active','Pending')
    AND (
      (p_scope_type='agency' AND public.agency_property_in_scope(p_agency_id,t.property_id))
      OR (p_scope_type='property' AND t.property_id=p_property_id)
      OR (p_scope_type='unit' AND t.unit_id=p_unit_id)
    )
  ORDER BY p.name,u.unit_number,t.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_agency_payment_policy_config(p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v jsonb:=COALESCE(p_config,'{}'::jsonb);
  methods text[]:=ARRAY(SELECT jsonb_array_elements_text(COALESCE(v->'allowed_payment_methods','[]'::jsonb)));
  allowed text[]:=ARRAY['mpesa_paybill','mpesa_till','bank_transfer','cash'];
  late_type text:=COALESCE(v->>'late_fee_type','none');
  split numeric:=COALESCE(NULLIF(v->>'agency_split_percent','')::numeric,100);
  late_value numeric:=COALESCE(NULLIF(v->>'late_fee_value','')::numeric,0);
  allowed_destinations text[]:=ARRAY['agency','landlord','tenant_direct','external','split'];
BEGIN
  IF methods IS NULL OR cardinality(methods)=0 OR NOT (methods <@ allowed) THEN RAISE EXCEPTION 'At least one valid payment method is required' USING ERRCODE='22023'; END IF;
  IF COALESCE((v->>'reminder_before_days')::int,3) NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'Reminder lead must be 0–30 days' USING ERRCODE='22023'; END IF;
  IF COALESCE((v->>'overdue_reminder_interval_days')::int,3) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Overdue reminder interval must be 1–30 days' USING ERRCODE='22023'; END IF;
  IF late_type NOT IN ('none','fixed','percentage') THEN RAISE EXCEPTION 'Invalid late-fee type' USING ERRCODE='22023'; END IF;
  IF late_value<0 OR (late_type='percentage' AND late_value>100) THEN RAISE EXCEPTION 'Invalid late-fee value' USING ERRCODE='22023'; END IF;
  IF split<0 OR split>100 THEN RAISE EXCEPTION 'Agency split must be 0–100%' USING ERRCODE='22023'; END IF;
  IF NOT ((v->>'collection_destination') = ANY(allowed_destinations)) THEN RAISE EXCEPTION 'Invalid collection destination' USING ERRCODE='22023'; END IF;
  RETURN v;
END;
$$;

-- Historical/as-of policy resolution. It deliberately considers superseded
-- versions so an old payment is judged by the rule that existed on its date.
CREATE OR REPLACE FUNCTION public.get_agency_payment_policy_config_as_of(
  p_agency_id uuid,
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_as_of date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_merged jsonb:=public.agency_payment_policy_defaults();
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT DISTINCT ON (p.scope_type)
      p.scope_type,p.config
    FROM public.agency_payment_policies p
    WHERE p.agency_id=p_agency_id
      AND p.scope_type IN ('agency','property','unit')
      AND p.status IN ('active','scheduled','superseded')
      AND p.effective_from<=p_as_of
      AND (p.effective_to IS NULL OR p.effective_to>=p_as_of)
      AND (
        (p.scope_type='agency' AND p.property_id IS NULL AND p.unit_id IS NULL)
        OR (p.scope_type='property' AND p.property_id=p_property_id AND p.unit_id IS NULL)
        OR (p.scope_type='unit' AND p.unit_id=p_unit_id AND p.property_id=p_property_id)
      )
    ORDER BY p.scope_type,
      p.effective_from DESC,
      CASE p.status WHEN 'active' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
      p.version DESC,
      p.updated_at DESC
  LOOP
    v_merged:=v_merged || COALESCE(v_policy.config,'{}'::jsonb);
  END LOOP;
  RETURN v_merged;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_agency_payment_policy_config_as_of(
  p_agency_id uuid,
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_as_of date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_merged jsonb:=public.agency_payment_policy_defaults(); v_policy record;
BEGIN
  FOR v_policy IN
    SELECT DISTINCT ON (p.scope_type) p.scope_type,p.config
    FROM public.agency_payment_policies p
    WHERE p.agency_id=p_agency_id
      AND p.tenant_visible=true
      AND p.status IN ('active','scheduled','superseded')
      AND p.effective_from<=p_as_of
      AND (p.effective_to IS NULL OR p.effective_to>=p_as_of)
      AND ((p.scope_type='agency' AND p.property_id IS NULL AND p.unit_id IS NULL)
        OR (p.scope_type='property' AND p.property_id=p_property_id AND p.unit_id IS NULL)
        OR (p.scope_type='unit' AND p.unit_id=p_unit_id AND p.property_id=p_property_id))
    ORDER BY p.scope_type,p.effective_from DESC,
      CASE p.status WHEN 'active' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,p.version DESC,p.updated_at DESC
  LOOP
    v_merged:=v_merged || COALESCE(v_policy.config,'{}'::jsonb);
  END LOOP;
  RETURN v_merged;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_agency_tenant_notice_atomic(
  p_agency_id uuid,p_policy_id uuid,p_audience_mode text,p_title text,p_body text,p_tenant_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_campaign uuid; v_agency_manager uuid; v_delivered int:=0;
  v_scope text; v_property uuid; v_unit uuid; v_valid_count int;
  t record; v_tenant_user uuid; v_message uuid; v_notification uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.can_manage_agency_admin(p_agency_id,'manage_billing_rules') THEN RAISE EXCEPTION 'Agency communication permission required' USING ERRCODE='42501'; END IF;
  IF p_audience_mode NOT IN ('selected','global') THEN RAISE EXCEPTION 'Invalid audience mode' USING ERRCODE='22023'; END IF;
  IF cardinality(COALESCE(p_tenant_ids,'{}'::uuid[]))=0 THEN RAISE EXCEPTION 'At least one tenant must be selected' USING ERRCODE='22023'; END IF;
  IF nullif(trim(p_title),'') IS NULL OR nullif(trim(p_body),'') IS NULL THEN RAISE EXCEPTION 'Notice title and message are required' USING ERRCODE='22023'; END IF;
  SELECT manager_id INTO v_agency_manager FROM public.agencies WHERE id=p_agency_id;
  IF v_agency_manager IS NULL THEN RAISE EXCEPTION 'Agency manager not found' USING ERRCODE='P0002'; END IF;

  -- The policy itself is the authority for audience scope; never trust a list
  -- of tenant IDs supplied by the browser.
  SELECT scope_type,property_id,unit_id INTO v_scope,v_property,v_unit
  FROM public.agency_payment_policies WHERE id=p_policy_id AND agency_id=p_agency_id LIMIT 1;
  IF v_scope IS NULL THEN RAISE EXCEPTION 'Payment policy not found for this Agency' USING ERRCODE='42501'; END IF;

  SELECT count(*) INTO v_valid_count
  FROM public.tenants t
  WHERE t.id=ANY(p_tenant_ids)
    AND t.status IN ('active','pending','Active','Pending')
    AND ((v_scope='agency' AND public.agency_property_in_scope(p_agency_id,t.property_id)) OR (v_scope='property' AND t.property_id=v_property) OR (v_scope='unit' AND t.unit_id=v_unit));
  IF v_valid_count<>cardinality(p_tenant_ids) THEN RAISE EXCEPTION 'One or more notice recipients are outside the payment-policy scope' USING ERRCODE='42501'; END IF;

  INSERT INTO public.agency_payment_policy_notice_campaigns(agency_id,policy_id,audience_mode,title,body,recipient_count,sent_by)
  VALUES(p_agency_id,p_policy_id,p_audience_mode,left(trim(p_title),180),left(trim(p_body),2000),0,v_uid)
  RETURNING id INTO v_campaign;

  FOR t IN SELECT DISTINCT tn.id,tn.property_id,tn.unit_id FROM public.tenants tn WHERE tn.id=ANY(p_tenant_ids)
  LOOP
    SELECT ur.user_id INTO v_tenant_user FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.role='tenant' ORDER BY ur.created_at NULLS LAST LIMIT 1;
    IF v_tenant_user IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.messages(manager_id,sender_id,sender_role,recipient_id,tenant_id,property_id,unit_id,subject,body,message_type,sent_via_app,campaign_id,recipient_type,sent_at)
    VALUES(v_agency_manager,v_uid,'agency',v_tenant_user,t.id,t.property_id,t.unit_id,left(trim(p_title),180),left(trim(p_body),2000),'payment_policy_change',true,v_campaign,'tenant',now())
    RETURNING id INTO v_message;
    INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,action_url,action_label,reference_id,reference_type,priority,source)
    VALUES(v_tenant_user,v_agency_manager,left(trim(p_title),180),left(trim(p_body),2000),'notice','/portal','Review payment settings',v_campaign,'agency_payment_policy_notice','normal','agency')
    RETURNING id INTO v_notification;
    INSERT INTO public.agency_payment_policy_notice_recipients(campaign_id,tenant_id,property_id,unit_id,message_id,notification_id)
    VALUES(v_campaign,t.id,t.property_id,t.unit_id,v_message,v_notification)
    ON CONFLICT(campaign_id,tenant_id) DO NOTHING;
    v_delivered:=v_delivered+1;
  END LOOP;

  UPDATE public.agency_payment_policy_notice_campaigns SET recipient_count=v_delivered WHERE id=v_campaign;
  RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_agency_payment_policy_atomic(
  p_policy_id uuid,p_agency_id uuid,p_scope_type text,p_property_id uuid DEFAULT NULL,p_unit_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,p_notice_mode text DEFAULT 'none',p_notice_tenant_ids uuid[] DEFAULT '{}'::uuid[],
  p_notice_title text DEFAULT NULL,p_notice_body text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_payload jsonb:=COALESCE(p_payload,'{}'::jsonb); v_config jsonb;
  v_existing public.agency_payment_policies%ROWTYPE; v_edit public.agency_payment_policies%ROWTYPE;
  v_created public.agency_payment_policies%ROWTYPE; v_id uuid; v_version int:=1; v_status text:='active';
  v_effective date:=COALESCE(NULLIF(v_payload->>'effective_from','')::date,CURRENT_DATE);
  v_effective_to date:=NULLIF(v_payload->>'effective_to','')::date;
  v_tenant_visible boolean:=COALESCE((v_payload->>'tenant_visible')::boolean,true);
  v_title text; v_body text; v_recipients uuid[]:='{}'::uuid[]; v_candidate_count int:=0; v_notice_id uuid:=NULL;
  v_existing_created_by uuid; v_current_version int;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT public.agency_payment_policy_scope_allowed(p_agency_id,p_scope_type,p_property_id,p_unit_id) THEN RAISE EXCEPTION 'Payment-policy scope is outside the Agency book' USING ERRCODE='42501'; END IF;
  IF p_notice_mode NOT IN ('none','selected','global') THEN RAISE EXCEPTION 'Invalid tenant notice mode' USING ERRCODE='22023'; END IF;
  IF v_effective_to IS NOT NULL AND v_effective_to<v_effective THEN RAISE EXCEPTION 'Effective-to date cannot precede effective-from' USING ERRCODE='22023'; END IF;

  v_config:=public.validate_agency_payment_policy_config(public.agency_payment_policy_defaults() || COALESCE(v_payload->'config','{}'::jsonb));
  v_config:=jsonb_set(v_config,'{tenant_visible}',to_jsonb(v_tenant_visible),true);
  IF v_effective>CURRENT_DATE THEN v_status:='scheduled'; END IF;

  -- Lock the current scope rows so concurrent admins cannot create competing
  -- active/scheduled versions or duplicate financial behaviour.
  SELECT * INTO v_existing
  FROM public.agency_payment_policies
  WHERE agency_id=p_agency_id AND scope_type=p_scope_type
    AND COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(p_property_id,'00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(p_unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
    AND status IN ('active','scheduled')
  ORDER BY CASE status WHEN 'scheduled' THEN 1 ELSE 2 END,effective_from DESC,updated_at DESC
  LIMIT 1 FOR UPDATE;

  IF p_policy_id IS NOT NULL THEN
    SELECT * INTO v_edit FROM public.agency_payment_policies WHERE id=p_policy_id AND agency_id=p_agency_id FOR UPDATE;
    IF v_edit.id IS NOT NULL THEN
      IF v_edit.status NOT IN ('draft','scheduled') THEN p_policy_id:=NULL; ELSE v_id:=v_edit.id; END IF;
      v_existing_created_by:=v_edit.created_by;
    END IF;
  END IF;

  SELECT COALESCE(MAX(version),0)+1 INTO v_current_version
  FROM public.agency_payment_policies
  WHERE agency_id=p_agency_id AND scope_type=p_scope_type
    AND COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(p_property_id,'00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(p_unit_id,'00000000-0000-0000-0000-000000000000'::uuid);
  v_version:=GREATEST(1,v_current_version);

  IF v_existing.id IS NOT NULL THEN
    IF v_status='scheduled' AND v_existing.status='scheduled' AND v_existing.id<>COALESCE(v_id,'00000000-0000-0000-0000-000000000000'::uuid) THEN
      RAISE EXCEPTION 'A scheduled payment policy already exists for this scope' USING ERRCODE='23505';
    END IF;
    IF v_status='active' AND v_existing.status='active' THEN
      UPDATE public.agency_payment_policies SET status='superseded',updated_at=now(),updated_by=v_uid WHERE id=v_existing.id;
    END IF;
  END IF;

  IF v_id IS NULL THEN v_id:=gen_random_uuid(); END IF;
  INSERT INTO public.agency_payment_policies(id,agency_id,scope_type,property_id,unit_id,policy_name,status,version,effective_from,effective_to,config,tenant_visible,tenant_notice_title,tenant_notice_body,created_by,updated_by)
  VALUES(v_id,p_agency_id,p_scope_type,p_property_id,p_unit_id,
    COALESCE(NULLIF(trim(v_payload->>'policy_name'),''),'Payment policy'),
    v_status,v_version,v_effective,v_effective_to,v_config,v_tenant_visible,
    NULLIF(left(trim(COALESCE(p_notice_title,v_payload->>'tenant_notice_title','')),180),''),
    NULLIF(left(trim(COALESCE(p_notice_body,v_payload->>'tenant_notice_body','')),2000),''),
    COALESCE(v_existing_created_by,v_uid),v_uid)
  ON CONFLICT(id) DO UPDATE SET
    policy_name=EXCLUDED.policy_name,status=EXCLUDED.status,version=EXCLUDED.version,effective_from=EXCLUDED.effective_from,effective_to=EXCLUDED.effective_to,
    config=EXCLUDED.config,tenant_visible=EXCLUDED.tenant_visible,tenant_notice_title=EXCLUDED.tenant_notice_title,tenant_notice_body=EXCLUDED.tenant_notice_body,
    updated_by=v_uid,updated_at=now()
  RETURNING * INTO v_created;

  IF v_tenant_visible AND v_status IN ('active','scheduled') THEN
    IF p_notice_mode='selected' THEN
      SELECT COALESCE(array_agg(t.id ORDER BY t.id),'{}'::uuid[]) INTO v_recipients
      FROM public.tenants t
      WHERE t.id=ANY(COALESCE(p_notice_tenant_ids,'{}'::uuid[]))
        AND ((p_scope_type='agency' AND public.agency_property_in_scope(p_agency_id,t.property_id)) OR (p_scope_type='property' AND t.property_id=p_property_id) OR (p_scope_type='unit' AND t.unit_id=p_unit_id));
      IF cardinality(v_recipients)<>cardinality(COALESCE(p_notice_tenant_ids,'{}'::uuid[])) THEN RAISE EXCEPTION 'One or more selected tenants are outside the policy scope' USING ERRCODE='42501'; END IF;
    ELSIF p_notice_mode='global' THEN
      SELECT COALESCE(array_agg(DISTINCT t.id ORDER BY t.id),'{}'::uuid[]) INTO v_recipients
      FROM public.tenants t
      WHERE t.status IN ('active','pending','Active','Pending')
        AND ((p_scope_type='agency' AND public.agency_property_in_scope(p_agency_id,t.property_id)) OR (p_scope_type='property' AND t.property_id=p_property_id) OR (p_scope_type='unit' AND t.unit_id=p_unit_id));
    END IF;
    v_candidate_count:=cardinality(v_recipients);
    IF v_candidate_count>0 AND p_notice_mode='none' THEN
      RAISE EXCEPTION 'Tenant-visible payment policy changes require a selected or global notice' USING ERRCODE='22023';
    END IF;
    IF v_candidate_count>0 THEN
      v_title:=COALESCE(NULLIF(trim(p_notice_title),''),v_created.tenant_notice_title,'Payment settings updated');
      v_body:=COALESCE(NULLIF(trim(p_notice_body),''),v_created.tenant_notice_body,
        CASE WHEN v_status='scheduled' THEN 'Payment settings for your tenancy are scheduled to change on '||to_char(v_effective,'DD Mon YYYY')||'. Review your CALQULUS tenant portal for the effective settings.'
             ELSE 'Payment settings for your tenancy have changed. Review your CALQULUS tenant portal for the current payment instructions and terms.' END);
      v_notice_id:=public.publish_agency_tenant_notice_atomic(p_agency_id,v_created.id,p_notice_mode,v_title,v_body,v_recipients);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'policy',to_jsonb(v_created),'status',v_created.status,'version',v_created.version,'notice_campaign_id',v_notice_id,'notified',v_notice_id IS NOT NULL,'recipient_count',v_candidate_count);
END;
$$;

-- Tenant-safe projection. It exposes only the current tenant's own property,
-- unit and payment-behaviour summary. Private Agency settings are not returned.
CREATE OR REPLACE FUNCTION public.get_tenant_effective_agency_payment_policy()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tenant uuid; v_property uuid; v_unit uuid; v_agency uuid; v_manager uuid;
  v_lease uuid; v_property_name text; v_unit_number text; v_policy jsonb;
  v_source_scope text:='none'; v_source_id uuid; v_updated timestamptz; v_due record;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' AND tenant_id IS NOT NULL LIMIT 1;
  IF v_tenant IS NULL THEN RETURN NULL; END IF;

  SELECT l.id,l.property_id,l.unit_id INTO v_lease,v_property,v_unit
  FROM public.leases l
  WHERE l.tenant_id=v_tenant AND l.status IN ('active','Active') AND l.archived_at IS NULL
  ORDER BY l.start_date DESC,l.updated_at DESC LIMIT 1;
  IF v_property IS NULL THEN SELECT t.property_id,t.unit_id INTO v_property,v_unit FROM public.tenants t WHERE t.id=v_tenant; END IF;
  IF v_property IS NULL THEN RETURN NULL; END IF;

  SELECT p.agency_id,p.manager_id,p.name INTO v_agency,v_manager,v_property_name FROM public.properties p WHERE p.id=v_property;
  IF v_agency IS NULL AND v_manager IS NOT NULL THEN SELECT mp.agency_id INTO v_agency FROM public.manager_profiles mp WHERE mp.manager_user_id=v_manager LIMIT 1; END IF;
  IF v_agency IS NULL OR NOT public.agency_property_in_scope(v_agency,v_property) THEN RETURN NULL; END IF;
  SELECT unit_number INTO v_unit_number FROM public.units WHERE id=v_unit;

  -- Tenant projection uses a tenant-visible-only resolver so internal Agency
  -- rules can never leak through most-specific precedence merging.
  v_policy:=public.get_tenant_agency_payment_policy_config_as_of(v_agency,v_property,v_unit,CURRENT_DATE);

  SELECT p.scope_type,p.id,p.updated_at INTO v_source_scope,v_source_id,v_updated
  FROM public.agency_payment_policies p
  WHERE p.agency_id=v_agency AND p.tenant_visible=true
    AND p.status IN ('active','scheduled','superseded')
    AND p.effective_from<=CURRENT_DATE AND (p.effective_to IS NULL OR p.effective_to>=CURRENT_DATE)
    AND ((p.scope_type='agency' AND p.property_id IS NULL AND p.unit_id IS NULL)
      OR (p.scope_type='property' AND p.property_id=v_property AND p.unit_id IS NULL)
      OR (p.scope_type='unit' AND p.unit_id=v_unit AND p.property_id=v_property))
  ORDER BY CASE p.scope_type WHEN 'unit' THEN 1 WHEN 'property' THEN 2 WHEN 'agency' THEN 3 ELSE 4 END,p.effective_from DESC,p.version DESC,p.updated_at DESC LIMIT 1;

  IF v_lease IS NOT NULL THEN
    SELECT * INTO v_due FROM public.get_effective_billing_due_config(v_lease);
  END IF;

  RETURN jsonb_build_object(
    'tenant_id',v_tenant,'property_id',v_property,'unit_id',v_unit,'property_name',v_property_name,'unit_number',v_unit_number,
    'source_scope',COALESCE(v_source_scope,'none'),'policy_id',v_source_id,'policy_configured',(v_source_id IS NOT NULL),
    'policy_config',v_policy,'allowed_payment_methods',COALESCE(v_policy->'allowed_payment_methods','[]'::jsonb),
    'collection_destination',COALESCE(v_policy->>'collection_destination','agency'),
    'tenant_visible',(v_source_id IS NOT NULL),'last_updated',v_updated,
    'billing_due',CASE WHEN v_due IS NULL THEN NULL ELSE to_jsonb(v_due) END
  );
END;
$$;

-- Reinforce the existing portal billing identity mapping: tenants are resolved
-- through user_roles; auth.uid() is the user, not tenants.id.
CREATE OR REPLACE FUNCTION public.get_portal_billing_units(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(unit_id uuid, property_id uuid, unit_number text, property_name text, lease_id uuid, tenant_id uuid, payer_party_id uuid, relationship text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost') THEN v_target:=p_user_id; ELSE v_target:=auth.uid(); END IF;
  RETURN QUERY
  SELECT DISTINCT u.id,u.property_id,u.unit_number,p.name,l.id,l.tenant_id,NULL::uuid,'tenant'::text
  FROM public.leases l JOIN public.units u ON u.id=l.unit_id JOIN public.properties p ON p.id=u.property_id JOIN public.user_roles ur ON ur.tenant_id=l.tenant_id AND ur.role='tenant'
  WHERE ur.user_id=v_target AND l.status IN ('active','Active')
  UNION
  SELECT DISTINCT u.id,u.property_id,u.unit_number,p.name,l.id,l.tenant_id,pul.payer_party_id,pul.relationship
  FROM public.payer_unit_links pul JOIN public.units u ON u.id=pul.unit_id JOIN public.properties p ON p.id=u.property_id LEFT JOIN public.leases l ON l.unit_id=u.id AND l.status IN ('active','Active') JOIN public.payment_parties pp ON pp.id=pul.payer_party_id
  WHERE pul.is_active AND pp.user_id=v_target;
END;
$$;

-- Security/authority helper for Agency evidence posting/review. It does not
-- move money; it only decides whether a proposed evidence record matches the
-- effective Agency rules in force on the payment date.
CREATE OR REPLACE FUNCTION public.agency_payment_evidence_policy_check(
  p_agency_id uuid,p_property_id uuid,p_unit_id uuid,p_payment_method text,p_destination text,p_amount numeric,p_expected numeric,p_source_type text,p_reference text,p_has_proof boolean DEFAULT false,p_as_of date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=public.get_agency_payment_policy_config_as_of(p_agency_id,p_property_id,p_unit_id,COALESCE(p_as_of,CURRENT_DATE));
  allowed jsonb; normalized text:=COALESCE(p_payment_method,''); dest text:=COALESCE(p_destination,''); source text:=COALESCE(p_source_type,'agent_manual');
BEGIN
  allowed:=COALESCE(c->'allowed_payment_methods','[]'::jsonb);
  IF normalized='mpesa' THEN
    IF NOT (allowed ? 'mpesa_paybill') AND NOT (allowed ? 'mpesa_till') THEN RETURN jsonb_build_object('allowed',false,'reason','M-Pesa payments are not allowed by the effective Agency rule.'); END IF;
  ELSIF normalized NOT IN ('mpesa_paybill','mpesa_till','bank_transfer','cash') OR NOT (allowed ? normalized) THEN
    RETURN jsonb_build_object('allowed',false,'reason','This payment method is not allowed by the effective Agency rule.');
  END IF;
  IF COALESCE((c->>'allow_external_consolidation')::boolean,true)=false AND source IN ('external_consolidation','bank_statement','landlord_confirmation') THEN RETURN jsonb_build_object('allowed',false,'reason','External payment consolidation is disabled for this scope.'); END IF;
  IF COALESCE((c->>'manual_payment_enabled')::boolean,true)=false AND source IN ('agent_manual','bank_statement','tenant_upload','landlord_confirmation','external_consolidation') THEN RETURN jsonb_build_object('allowed',false,'reason','Manual or outside payment evidence is disabled for this scope.'); END IF;
  IF COALESCE((c->>'proof_required_for_manual')::boolean,true) AND source IN ('agent_manual','bank_statement','tenant_upload','landlord_confirmation','external_consolidation') AND NOT COALESCE(p_has_proof,false) THEN RETURN jsonb_build_object('allowed',false,'reason','Payment evidence is required for this scope.'); END IF;
  IF COALESCE((c->>'payment_reference_required')::boolean,false) AND NULLIF(trim(COALESCE(p_reference,'')),'') IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','A payment reference is required for this scope.'); END IF;
  IF p_expected IS NOT NULL AND p_amount<p_expected AND COALESCE((c->>'allow_partial_payments')::boolean,true)=false THEN RETURN jsonb_build_object('allowed',false,'reason','Partial payments are disabled for this scope.'); END IF;
  IF dest<>COALESCE(c->>'collection_destination','agency') AND COALESCE(c->>'collection_destination','agency')<>'split' THEN RETURN jsonb_build_object('allowed',false,'reason','The payment destination does not match the effective Agency rule.'); END IF;
  IF dest='split' AND (COALESCE((c->>'agency_split_percent')::numeric,100)<=0 OR COALESCE((c->>'agency_split_percent')::numeric,100)>=100) THEN RETURN jsonb_build_object('allowed',false,'reason','Split collection requires a valid Agency percentage.'); END IF;
  RETURN jsonb_build_object('allowed',true,'config',c);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agency_payment_policy_defaults() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.agency_payment_policy_scope_allowed(uuid,text,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_payment_policy_options(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_payment_policy_notice_candidates(uuid,text,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.validate_agency_payment_policy_config(jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_payment_policy_config_as_of(uuid,uuid,uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_agency_payment_policy_config_as_of(uuid,uuid,uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_agency_payment_policy_atomic(uuid,uuid,text,uuid,uuid,jsonb,text,uuid[],text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.publish_agency_tenant_notice_atomic(uuid,uuid,text,text,text,uuid[]) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_effective_agency_payment_policy() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_billing_units(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_payment_evidence_policy_check(uuid,uuid,uuid,text,text,numeric,numeric,text,text,boolean,date) TO service_role;

REVOKE ALL ON FUNCTION public.agency_payment_policy_defaults() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.agency_payment_policy_scope_allowed(uuid,text,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_agency_payment_policy_options(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_agency_payment_policy_notice_candidates(uuid,text,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.validate_agency_payment_policy_config(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_agency_payment_policy_config_as_of(uuid,uuid,uuid,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_tenant_agency_payment_policy_config_as_of(uuid,uuid,uuid,date) FROM PUBLIC,authenticated,anon;
REVOKE ALL ON FUNCTION public.save_agency_payment_policy_atomic(uuid,uuid,text,uuid,uuid,jsonb,text,uuid[],text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.publish_agency_tenant_notice_atomic(uuid,uuid,text,text,text,uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_tenant_effective_agency_payment_policy() FROM PUBLIC,anon;

COMMENT ON TABLE public.agency_payment_policies IS 'Agency-owned payment behaviour hierarchy. Precedence is unit > property > agency. Historical versions remain queryable as-of a date and never rewrite past invoices.';
COMMENT ON TABLE public.agency_payment_policy_notice_campaigns IS 'Audit record of tenant-visible Agency payment-policy announcements sent through the platform communication layer.';
COMMENT ON FUNCTION public.get_tenant_effective_agency_payment_policy() IS 'Returns only the authenticated tenant''s own effective Agency payment policy, effective billing-due information, and canonical payment route.';
COMMENT ON FUNCTION public.agency_payment_evidence_policy_check(uuid,uuid,uuid,text,text,numeric,numeric,text,text,boolean,date) IS 'Read-only policy guard for Agency payment evidence. It validates method, destination, external-consolidation, reference and partial-payment rules without moving money.';

-- ---------------------------------------------------------------------------
-- Runtime enforcement for Agency evidence. The policy is evaluated using the
-- payment date and never permits a UI-only bypass.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_agency_payment_evidence_atomic(
  p_agency_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb);
  v_id uuid;
  v_payment_date date:=COALESCE(NULLIF(v->>'payment_date','')::date,CURRENT_DATE);
  v_invoice uuid:=NULLIF(v->>'invoice_id','')::uuid;
  v_expected numeric;
  v_prop uuid:=NULLIF(v->>'property_id','')::uuid;
  v_unit uuid:=NULLIF(v->>'unit_id','')::uuid;
  v_tenant uuid:=NULLIF(v->>'tenant_id','')::uuid;
  v_pl uuid;
  v_destination text:=COALESCE(NULLIF(v->>'destination_type',''),'agency');
  v_source text:=COALESCE(NULLIF(v->>'source_type',''),'agent_manual');
  v_amount numeric:=round(COALESCE((v->>'reported_amount')::numeric,0),2);
  v_method text:=COALESCE(NULLIF(trim(v->>'payment_method'),''),'bank_transfer');
  v_closed boolean:=false;
  v_split numeric;
  v_policy jsonb;
  v_guard jsonb;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'record_payments') THEN RAISE EXCEPTION 'Agency payment recording permission required' USING ERRCODE='42501'; END IF;
  IF v_amount<=0 THEN RAISE EXCEPTION 'Reported amount must be greater than zero' USING ERRCODE='22023'; END IF;
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid destination' USING ERRCODE='22023'; END IF;
  IF v_source NOT IN ('agent_manual','tenant_upload','bank_statement','external_consolidation','landlord_confirmation') THEN RAISE EXCEPTION 'Invalid evidence source' USING ERRCODE='22023'; END IF;

  IF v_invoice IS NOT NULL THEN
    SELECT i.balance_due,i.property_id,i.unit_id,i.tenant_id INTO v_expected,v_prop,v_unit,v_tenant FROM public.invoices i WHERE i.id=v_invoice FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='P0002'; END IF;
    v_expected:=round(GREATEST(COALESCE(v_expected,0),0),2);
  END IF;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Select a property or invoice' USING ERRCODE='22023'; END IF;
  IF v_unit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id=v_unit AND u.property_id=v_prop) THEN RAISE EXCEPTION 'Unit is outside the selected property' USING ERRCODE='42501'; END IF;
  IF v_tenant IS NOT NULL AND v_unit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leases l WHERE l.tenant_id=v_tenant AND l.unit_id=v_unit AND l.status IN ('active','Active')) THEN RAISE EXCEPTION 'Tenant is not attached to the selected unit' USING ERRCODE='42501'; END IF;
  IF NOT public.agency_property_in_scope(p_agency_id,v_prop) THEN RAISE EXCEPTION 'Property is outside this Agency' USING ERRCODE='42501'; END IF;

  SELECT pl.id INTO v_pl
  FROM public.property_landlords pl
  WHERE pl.property_id=v_prop
    AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=p_agency_id AND (a.manager_id=pl.manager_id OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
  ORDER BY pl.updated_at DESC LIMIT 1;

  SELECT public.agency_payment_policy_config_as_of(p_agency_id,v_prop,v_unit,v_payment_date) INTO v_policy;
  SELECT public.agency_payment_evidence_policy_check(
    p_agency_id,v_prop,v_unit,v_method,v_destination,v_amount,v_expected,v_source,NULLIF(trim(v->>'reference'),''),NULLIF(trim(v->>'proof_url'),'') IS NOT NULL,v_payment_date
  ) INTO v_guard;
  IF COALESCE((v_guard->>'allowed')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION '%',COALESCE(v_guard->>'reason','Payment evidence is not permitted by the Agency rule') USING ERRCODE='42501'; END IF;

  IF v_destination='split' THEN
    v_split:=COALESCE((v_policy->>'agency_split_percent')::numeric,public.agency_split_collection_percent(p_agency_id,v_pl,v_prop));
    IF v_split IS NULL OR v_split<=0 OR v_split>=100 THEN RAISE EXCEPTION 'Configure a valid split Agency percentage before submitting split evidence' USING ERRCODE='22023'; END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.agency_financial_periods p WHERE p.agency_id=p_agency_id AND p.period_start<=v_payment_date AND p.period_end>=v_payment_date AND p.status='closed') INTO v_closed;
  IF v_closed THEN RAISE EXCEPTION 'This financial period is closed. Reopen the period before posting a correction.' USING ERRCODE='55000'; END IF;

  INSERT INTO public.agency_payment_evidence(
    agency_id,property_landlord_id,property_id,unit_id,tenant_id,invoice_id,reported_amount,payment_date,
    payment_method,reference,payer_name,destination_type,source_type,proof_url,notes,expected_amount,
    discrepancy_amount,status,created_by,created_at,updated_at
  ) VALUES (
    p_agency_id,v_pl,v_prop,v_unit,v_tenant,v_invoice,v_amount,v_payment_date,v_method,NULLIF(trim(v->>'reference'),''),NULLIF(trim(v->>'payer_name'),''),
    v_destination,v_source,NULLIF(trim(v->>'proof_url'),''),NULLIF(trim(v->>'notes'),''),v_expected,
    CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-v_amount,2) END,'pending',auth.uid(),now(),now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'expected_amount',v_expected,'discrepancy_amount',CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-v_amount,2) END,'property_landlord_id',v_pl);
END;
$$;

-- Review uses the same effective policy that governed submission, preventing a
-- later rule edit from turning an old evidence record into an unintended fund
-- movement. Transaction creation remains exactly-once by evidence status lock.
CREATE OR REPLACE FUNCTION public.review_agency_payment_evidence_atomic(
  p_evidence_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e public.agency_payment_evidence%ROWTYPE;
  v_manager uuid; v_tx uuid; v_alloc numeric:=0; v_balance numeric; v_excess numeric:=0;
  v_property uuid; v_unit uuid; v_split numeric:=0; v_agency_portion numeric:=0; v_external_portion numeric:=0;
  v_policy jsonb; v_guard jsonb; v_invoice_expected numeric;
BEGIN
  SELECT * INTO e FROM public.agency_payment_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Evidence not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_agency_admin(e.agency_id,'verify_payment_evidence') THEN RAISE EXCEPTION 'Agency verification permission required' USING ERRCODE='42501'; END IF;
  IF e.status NOT IN ('pending','needs_review') THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'status',e.status); END IF;
  IF p_decision NOT IN ('accepted','rejected','needs_review') THEN RAISE EXCEPTION 'Invalid evidence decision' USING ERRCODE='22023'; END IF;

  IF p_decision='rejected' THEN
    UPDATE public.agency_payment_evidence SET status='rejected',discrepancy_amount=round(COALESCE(expected_amount,0)-reported_amount,2),review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','rejected');
  ELSIF p_decision='needs_review' THEN
    UPDATE public.agency_payment_evidence SET status='needs_review',discrepancy_amount=round(COALESCE(expected_amount,0)-reported_amount,2),review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','needs_review');
  END IF;

  v_property:=e.property_id; v_unit:=e.unit_id; v_invoice_expected:=e.expected_amount;
  IF e.invoice_id IS NOT NULL THEN
    SELECT i.property_id,i.unit_id,i.balance_due,i.tenant_id INTO v_property,v_unit,v_balance,e.tenant_id FROM public.invoices i WHERE i.id=e.invoice_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or not associated with this evidence' USING ERRCODE='P0002'; END IF;
    v_invoice_expected:=round(GREATEST(COALESCE(v_balance,0),0),2);
  END IF;
  IF v_property IS NULL OR NOT public.agency_property_in_scope(e.agency_id,v_property) THEN RAISE EXCEPTION 'Evidence property is outside this Agency' USING ERRCODE='42501'; END IF;

  v_policy:=public.agency_payment_policy_config_as_of(e.agency_id,v_property,v_unit,e.payment_date);
  v_guard:=public.agency_payment_evidence_policy_check(e.agency_id,v_property,v_unit,e.payment_method,e.destination_type,e.reported_amount,v_invoice_expected,e.source_type,e.reference,e.proof_url IS NOT NULL,e.payment_date);
  IF COALESCE((v_guard->>'allowed')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION '%',COALESCE(v_guard->>'reason','Evidence no longer matches the effective Agency rule') USING ERRCODE='42501'; END IF;
  IF COALESCE((v_policy->>'separate_manual_payment_reviewer')::boolean,false)
     AND e.source_type IN ('agent_manual','bank_statement','tenant_upload','landlord_confirmation','external_consolidation')
     AND e.created_by=auth.uid() THEN
    RAISE EXCEPTION 'A different Agency user must review this payment evidence when four-eyes approval is enabled' USING ERRCODE='42501';
  END IF;

  IF e.destination_type='split' THEN
    v_split:=COALESCE((v_policy->>'agency_split_percent')::numeric,0);
    IF v_split<=0 OR v_split>=100 THEN RAISE EXCEPTION 'Split percentage is missing or invalid for the payment date' USING ERRCODE='22023'; END IF;
    v_agency_portion:=round(e.reported_amount*v_split/100,2); v_external_portion:=round(e.reported_amount-v_agency_portion,2);
  END IF;

  SELECT a.manager_id INTO v_manager FROM public.agencies a WHERE a.id=e.agency_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Agency manager not found' USING ERRCODE='P0002'; END IF;

  IF e.invoice_id IS NOT NULL THEN
    INSERT INTO public.payment_transactions(
      tenant_id,manager_id,unit_id,property_id,invoice_id,amount,payment_type,payment_method,phone_number,bank_reference,status,initiated_at,completed_at,recorded_by,notes,agency_evidence_id
    ) VALUES(
      e.tenant_id,v_manager,v_unit,v_property,e.invoice_id,round(e.reported_amount,2),e.payment_method,e.payment_method,'',e.reference,'completed',now(),now(),auth.uid(),
      CASE WHEN e.destination_type='agency' THEN 'Agency evidence accepted' WHEN e.destination_type='split' THEN 'Split-settlement evidence accepted' ELSE 'External settlement evidence accepted' END,
      CASE WHEN e.destination_type='agency' THEN NULL ELSE e.id END
    ) RETURNING id INTO v_tx;

    SELECT public.process_invoice_payment(e.invoice_id,v_tx,e.reported_amount) INTO v_alloc;
    v_excess:=round(GREATEST(e.reported_amount-COALESCE(v_alloc,0),0),2);
    IF v_excess>0 AND e.tenant_id IS NOT NULL THEN
      INSERT INTO public.tenant_credit_ledger(tenant_id,manager_id,property_id,transaction_id,invoice_id,entry_type,amount,balance_after,description)
      SELECT e.tenant_id,v_manager,v_property,v_tx,e.invoice_id,'credit',v_excess,round(COALESCE((SELECT balance_after FROM public.tenant_credit_ledger WHERE tenant_id=e.tenant_id ORDER BY created_at DESC,id DESC LIMIT 1),0)+v_excess,2),'Advance payment credit from Agency-verified evidence';
    END IF;
    UPDATE public.payment_transactions SET allocated_amount=round(COALESCE(v_alloc,0),2),is_partial=(COALESCE(v_alloc,0)<e.reported_amount),is_advance=(v_excess>0),credit_amount=v_excess,updated_at=now() WHERE id=v_tx;
    IF e.destination_type='agency' THEN PERFORM public.issue_payment_receipt_atomic(v_tx); END IF;
  END IF;

  UPDATE public.agency_payment_evidence SET status='accepted',discrepancy_amount=round(COALESCE(expected_amount,reported_amount)-reported_amount,2),review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('ok',true,'status','accepted','transaction_id',v_tx,'allocated_amount',round(COALESCE(v_alloc,0),2),'credit_amount',v_excess,'agency_portion',v_agency_portion,'external_portion',v_external_portion,'external',(e.destination_type<>'agency'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.agency_payment_evidence_policy_check(uuid,uuid,uuid,text,text,numeric,numeric,text,text,boolean,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_agency_payment_evidence_atomic(uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.review_agency_payment_evidence_atomic(uuid,text,text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.agency_payment_evidence_policy_check(uuid,uuid,uuid,text,text,numeric,numeric,text,text,boolean,date) FROM PUBLIC,anon;

REVOKE ALL ON FUNCTION public.get_agency_payment_policy_config_as_of(uuid,uuid,uuid,date) FROM PUBLIC,authenticated,anon;

-- ---------------------------------------------------------------------------
-- Evidence hardening: preserve the exact policy snapshot used at submission
-- time and block duplicate live payment references inside an Agency. A rejected
-- reference may be resubmitted after correction; accepted/pending references
-- remain unique to prevent double-posting.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_payment_evidence
  ADD COLUMN IF NOT EXISTS policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS policy_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS agency_payment_evidence_policy_checked_idx
  ON public.agency_payment_evidence(agency_id,policy_checked_at DESC);
CREATE INDEX IF NOT EXISTS agency_payment_evidence_live_reference_idx
  ON public.agency_payment_evidence(agency_id,lower(reference),status)
  WHERE reference IS NOT NULL AND length(trim(reference))>0;

CREATE OR REPLACE FUNCTION public.submit_agency_payment_evidence_atomic(
  p_agency_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb); v_id uuid;
  v_payment_date date:=COALESCE(NULLIF(v->>'payment_date','')::date,CURRENT_DATE);
  v_invoice uuid:=NULLIF(v->>'invoice_id','')::uuid; v_expected numeric;
  v_prop uuid:=NULLIF(v->>'property_id','')::uuid; v_unit uuid:=NULLIF(v->>'unit_id','')::uuid; v_tenant uuid:=NULLIF(v->>'tenant_id','')::uuid; v_pl uuid;
  v_destination text:=COALESCE(NULLIF(v->>'destination_type',''),'agency'); v_source text:=COALESCE(NULLIF(v->>'source_type',''),'agent_manual');
  v_amount numeric:=round(COALESCE((v->>'reported_amount')::numeric,0),2); v_method text:=COALESCE(NULLIF(trim(v->>'payment_method'),''),'bank_transfer');
  v_closed boolean:=false; v_split numeric; v_policy jsonb; v_guard jsonb; v_reference text:=NULLIF(trim(v->>'reference'),'');
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'record_payments') THEN RAISE EXCEPTION 'Agency payment recording permission required' USING ERRCODE='42501'; END IF;
  IF v_amount<=0 THEN RAISE EXCEPTION 'Reported amount must be greater than zero' USING ERRCODE='22023'; END IF;
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid destination' USING ERRCODE='22023'; END IF;
  IF v_source NOT IN ('agent_manual','tenant_upload','bank_statement','external_consolidation','landlord_confirmation') THEN RAISE EXCEPTION 'Invalid evidence source' USING ERRCODE='22023'; END IF;
  IF v_invoice IS NOT NULL THEN
    SELECT i.balance_due,i.property_id,i.unit_id,i.tenant_id INTO v_expected,v_prop,v_unit,v_tenant FROM public.invoices i WHERE i.id=v_invoice FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='P0002'; END IF;
    v_expected:=round(GREATEST(COALESCE(v_expected,0),0),2);
  END IF;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Select a property or invoice' USING ERRCODE='22023'; END IF;
  IF v_unit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id=v_unit AND u.property_id=v_prop) THEN RAISE EXCEPTION 'Unit is outside the selected property' USING ERRCODE='42501'; END IF;
  IF v_tenant IS NOT NULL AND v_unit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leases l WHERE l.tenant_id=v_tenant AND l.unit_id=v_unit AND l.status IN ('active','Active')) THEN RAISE EXCEPTION 'Tenant is not attached to the selected unit' USING ERRCODE='42501'; END IF;
  IF NOT public.agency_property_in_scope(p_agency_id,v_prop) THEN RAISE EXCEPTION 'Property is outside this Agency' USING ERRCODE='42501'; END IF;
  IF v_reference IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_agency_id::text||':'||lower(v_reference),0));
    IF EXISTS (SELECT 1 FROM public.agency_payment_evidence e WHERE e.agency_id=p_agency_id AND lower(e.reference)=lower(v_reference) AND e.status<>'rejected') THEN RAISE EXCEPTION 'This payment reference is already in use for a live evidence record' USING ERRCODE='23505'; END IF;
  END IF;

  SELECT pl.id INTO v_pl FROM public.property_landlords pl WHERE pl.property_id=v_prop
    AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=p_agency_id AND (a.manager_id=pl.manager_id OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
    ORDER BY pl.updated_at DESC LIMIT 1;
  v_policy:=public.agency_payment_policy_config_as_of(p_agency_id,v_prop,v_unit,v_payment_date);
  SELECT public.agency_payment_evidence_policy_check(p_agency_id,v_prop,v_unit,v_method,v_destination,v_amount,v_expected,v_source,v_reference,NULLIF(trim(v->>'proof_url'),'') IS NOT NULL,v_payment_date) INTO v_guard;
  IF COALESCE((v_guard->>'allowed')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION '%',COALESCE(v_guard->>'reason','Payment evidence is not permitted by the Agency rule') USING ERRCODE='42501'; END IF;

  IF v_destination='split' THEN
    v_split:=COALESCE((v_policy->>'agency_split_percent')::numeric,public.agency_split_collection_percent(p_agency_id,v_pl,v_prop));
    IF v_split IS NULL OR v_split<=0 OR v_split>=100 THEN RAISE EXCEPTION 'Configure a valid split Agency percentage before submitting split evidence' USING ERRCODE='22023'; END IF;
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.agency_financial_periods p WHERE p.agency_id=p_agency_id AND p.period_start<=v_payment_date AND p.period_end>=v_payment_date AND p.status='closed') INTO v_closed;
  IF v_closed THEN RAISE EXCEPTION 'This financial period is closed. Reopen the period before posting a correction.' USING ERRCODE='55000'; END IF;

  INSERT INTO public.agency_payment_evidence(agency_id,property_landlord_id,property_id,unit_id,tenant_id,invoice_id,reported_amount,payment_date,payment_method,reference,payer_name,destination_type,source_type,proof_url,notes,expected_amount,discrepancy_amount,status,created_by,created_at,updated_at,policy_snapshot,policy_checked_at)
  VALUES(p_agency_id,v_pl,v_prop,v_unit,v_tenant,v_invoice,v_amount,v_payment_date,v_method,v_reference,NULLIF(trim(v->>'payer_name'),''),v_destination,v_source,NULLIF(trim(v->>'proof_url'),''),NULLIF(trim(v->>'notes'),''),v_expected,CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-v_amount,2) END,'pending',auth.uid(),now(),now(),v_policy,now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'expected_amount',v_expected,'discrepancy_amount',CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-v_amount,2) END,'property_landlord_id',v_pl);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_agency_payment_evidence_atomic(uuid,jsonb) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Canonical payment destination hardening. Existing managers/landlords keep
-- their current behaviour; when an Agency scope is supplied, Agency billing
-- permission plus agency_property_in_scope become mandatory.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_payment_collection_account_atomic(p_id uuid, p_payload jsonb)
RETURNS public.payment_collection_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.payment_collection_accounts%ROWTYPE;
  v_uid uuid:=auth.uid();
  v_property uuid:=NULLIF(p_payload->>'property_id','')::uuid;
  v_unit uuid:=NULLIF(p_payload->>'unit_id','')::uuid;
  v_agency uuid:=NULLIF(p_payload->>'agency_id','')::uuid;
  v_landlord uuid:=NULLIF(p_payload->>'landlord_user_id','')::uuid;
  v_lease uuid:=NULLIF(p_payload->>'lease_id','')::uuid;
  v_tenant uuid:=NULLIF(p_payload->>'tenant_id','')::uuid;
  v_method text:=COALESCE(p_payload->>'payment_method','');
  v_id uuid:=COALESCE(p_id,gen_random_uuid());
  v_account_reference text:=NULLIF(trim(p_payload->>'account_reference'),'');
  v_manager uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  IF v_lease IS NOT NULL THEN
    SELECT l.property_id,l.unit_id,l.tenant_id INTO v_property,v_unit,v_tenant FROM public.leases l WHERE l.id=v_lease;
    IF v_property IS NULL THEN RAISE EXCEPTION 'Lease not found' USING ERRCODE='P0002'; END IF;
  END IF;
  IF v_tenant IS NOT NULL AND v_property IS NULL THEN
    SELECT property_id,unit_id INTO v_property,v_unit FROM public.tenants WHERE id=v_tenant;
    IF v_property IS NULL THEN RAISE EXCEPTION 'Tenant property could not be resolved' USING ERRCODE='P0002'; END IF;
  END IF;
  IF v_unit IS NOT NULL THEN
    SELECT property_id INTO v_property FROM public.units WHERE id=v_unit;
    IF v_property IS NULL THEN RAISE EXCEPTION 'Unit not found' USING ERRCODE='P0002'; END IF;
  END IF;
  IF v_property IS NULL AND v_agency IS NULL THEN
    RAISE EXCEPTION 'A property, unit, lease, tenant or agency scope is required' USING ERRCODE='22023';
  END IF;

  IF v_property IS NOT NULL AND v_unit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id=v_unit AND u.property_id=v_property) THEN
    RAISE EXCEPTION 'Unit is outside the selected property' USING ERRCODE='42501';
  END IF;
  IF v_lease IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leases l WHERE l.id=v_lease AND l.property_id=v_property AND (v_unit IS NULL OR l.unit_id=v_unit) AND (v_tenant IS NULL OR l.tenant_id=v_tenant)) THEN
    RAISE EXCEPTION 'Lease scope is inconsistent with the selected property/unit/tenant' USING ERRCODE='42501';
  END IF;
  IF v_tenant IS NOT NULL AND v_property IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=v_tenant AND t.property_id=v_property) THEN
    RAISE EXCEPTION 'Tenant is outside the selected property' USING ERRCODE='42501';
  END IF;

  IF v_agency IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=v_agency) THEN RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002'; END IF;
    IF NOT public.can_manage_agency_admin(v_agency,'manage_billing_rules') THEN RAISE EXCEPTION 'Agency billing-rule permission required' USING ERRCODE='42501'; END IF;
    IF v_property IS NOT NULL AND NOT public.agency_property_in_scope(v_agency,v_property) THEN RAISE EXCEPTION 'Agency is not assigned to this property' USING ERRCODE='42501'; END IF;
  ELSIF v_property IS NOT NULL THEN
    IF NOT public.can_manage_payment_scope(v_property,v_unit,NULL,v_landlord) THEN RAISE EXCEPTION 'Payment configuration scope unauthorized' USING ERRCODE='42501'; END IF;
  END IF;

  IF v_landlord IS NOT NULL THEN
    IF v_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=v_property AND pl.landlord_user_id=v_landlord) THEN
      RAISE EXCEPTION 'Payment owner is not linked to this property' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_method NOT IN ('mpesa_paybill','mpesa_till','bank_transfer','cash') THEN RAISE EXCEPTION 'Invalid payment method' USING ERRCODE='22023'; END IF;
  IF v_method='mpesa_paybill' AND NULLIF(trim(p_payload->>'paybill_number'),'') IS NULL THEN RAISE EXCEPTION 'Paybill number is required' USING ERRCODE='22023'; END IF;
  IF v_method='mpesa_till' AND NULLIF(trim(p_payload->>'till_number'),'') IS NULL THEN RAISE EXCEPTION 'Till number is required' USING ERRCODE='22023'; END IF;
  IF v_method='bank_transfer' AND (NULLIF(trim(p_payload->>'bank_name'),'') IS NULL OR NULLIF(trim(p_payload->>'bank_account_number'),'') IS NULL) THEN
    RAISE EXCEPTION 'Bank name and account number are required' USING ERRCODE='22023';
  END IF;
  IF v_unit IS NOT NULL AND (v_lease IS NOT NULL OR v_tenant IS NOT NULL) THEN RAISE EXCEPTION 'Unit routing cannot be combined with tenancy-specific routing' USING ERRCODE='22023'; END IF;

  SELECT manager_id INTO v_manager FROM public.properties WHERE id=v_property;
  IF v_manager IS NULL AND v_agency IS NOT NULL THEN SELECT manager_id INTO v_manager FROM public.agencies WHERE id=v_agency; END IF;
  IF v_manager IS NULL THEN v_manager:=v_uid; END IF;

  INSERT INTO public.payment_collection_accounts(
    id,agency_id,manager_id,landlord_user_id,property_id,unit_id,lease_id,tenant_id,
    account_label,account_reference,payment_method,paybill_number,till_number,bank_name,bank_account_name,bank_account_number,bank_branch,payment_instructions,is_default,priority,is_active
  ) VALUES (
    v_id,v_agency,v_manager,v_landlord,v_property,v_unit,v_lease,v_tenant,
    COALESCE(NULLIF(trim(p_payload->>'account_label'),''),'Rent collection'),v_account_reference,v_method,
    NULLIF(trim(p_payload->>'paybill_number'),''),NULLIF(trim(p_payload->>'till_number'),''),NULLIF(trim(p_payload->>'bank_name'),''),
    NULLIF(trim(p_payload->>'bank_account_name'),''),NULLIF(trim(p_payload->>'bank_account_number'),''),NULLIF(trim(p_payload->>'bank_branch'),''),
    NULLIF(trim(p_payload->>'payment_instructions'),''),COALESCE((p_payload->>'is_default')::boolean,false),COALESCE((p_payload->>'priority')::int,100),COALESCE((p_payload->>'is_active')::boolean,true)
  )
  ON CONFLICT(id) DO UPDATE SET agency_id=EXCLUDED.agency_id,manager_id=EXCLUDED.manager_id,landlord_user_id=EXCLUDED.landlord_user_id,property_id=EXCLUDED.property_id,unit_id=EXCLUDED.unit_id,lease_id=EXCLUDED.lease_id,tenant_id=EXCLUDED.tenant_id,account_label=EXCLUDED.account_label,account_reference=EXCLUDED.account_reference,payment_method=EXCLUDED.payment_method,paybill_number=EXCLUDED.paybill_number,till_number=EXCLUDED.till_number,bank_name=EXCLUDED.bank_name,bank_account_name=EXCLUDED.bank_account_name,bank_account_number=EXCLUDED.bank_account_number,bank_branch=EXCLUDED.bank_branch,payment_instructions=EXCLUDED.payment_instructions,is_default=EXCLUDED.is_default,priority=EXCLUDED.priority,is_active=EXCLUDED.is_active,updated_at=now()
  RETURNING * INTO v;

  IF v.is_default THEN
    UPDATE public.payment_collection_accounts SET is_default=false,updated_at=now() WHERE id<>v.id AND is_active AND CASE WHEN v.tenant_id IS NOT NULL THEN tenant_id=v.tenant_id AND ((v.lease_id IS NULL AND lease_id IS NULL) OR lease_id=v.lease_id) WHEN v.lease_id IS NOT NULL THEN lease_id=v.lease_id WHEN v.unit_id IS NOT NULL THEN unit_id=v.unit_id AND lease_id IS NULL AND tenant_id IS NULL WHEN v.property_id IS NOT NULL THEN property_id=v.property_id AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL WHEN v.agency_id IS NOT NULL THEN agency_id=v.agency_id AND property_id IS NULL AND unit_id IS NULL AND lease_id IS NULL AND tenant_id IS NULL ELSE false END;
  END IF;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_payment_collection_account_atomic(uuid,jsonb) TO authenticated;


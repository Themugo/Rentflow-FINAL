-- CALQULUS: Lease renewal & retention management
CREATE TABLE IF NOT EXISTS public.lease_renewal_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notice_id uuid REFERENCES public.tenant_notices(id) ON DELETE SET NULL,
  proposed_rent numeric(12,2),
  proposed_end_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','negotiating','accepted','declined','notice_to_vacate','expired','withdrawn')),
  tenant_decision text CHECK (tenant_decision IS NULL OR tenant_decision IN ('accept','decline','negotiate')),
  tenant_decision_at timestamptz,
  follow_up_at timestamptz,
  manager_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lease_renewal_cases_active_lease_uidx
  ON public.lease_renewal_cases(lease_id)
  WHERE status IN ('draft','sent','negotiating');
CREATE INDEX IF NOT EXISTS lease_renewal_cases_manager_idx ON public.lease_renewal_cases(manager_id,status,follow_up_at);
CREATE INDEX IF NOT EXISTS lease_renewal_cases_expiry_idx ON public.lease_renewal_cases(proposed_end_date,status);

ALTER TABLE public.lease_renewal_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lease_renewal_cases_manager_select ON public.lease_renewal_cases;
CREATE POLICY lease_renewal_cases_manager_select ON public.lease_renewal_cases FOR SELECT
  USING (manager_id = auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = manager_id AND ms.submanager_user_id = auth.uid()));
DROP POLICY IF EXISTS lease_renewal_cases_manager_insert ON public.lease_renewal_cases;
CREATE POLICY lease_renewal_cases_manager_insert ON public.lease_renewal_cases FOR INSERT
  WITH CHECK (manager_id = auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = manager_id AND ms.submanager_user_id = auth.uid()));
DROP POLICY IF EXISTS lease_renewal_cases_manager_update ON public.lease_renewal_cases;
CREATE POLICY lease_renewal_cases_manager_update ON public.lease_renewal_cases FOR UPDATE
  USING (manager_id = auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = manager_id AND ms.submanager_user_id = auth.uid()))
  WITH CHECK (manager_id = auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = manager_id AND ms.submanager_user_id = auth.uid()));
REVOKE INSERT,UPDATE,DELETE ON public.lease_renewal_cases FROM authenticated;

CREATE OR REPLACE FUNCTION public.create_lease_renewal_case_atomic(
  p_lease_id uuid,
  p_proposed_rent numeric,
  p_proposed_end_date date,
  p_follow_up_at timestamptz,
  p_manager_notes text
) RETURNS public.lease_renewal_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.lease_renewal_cases%ROWTYPE; l public.leases%ROWTYPE; t public.tenants%ROWTYPE; n public.tenant_notices%ROWTYPE; uid uuid:=auth.uid();
BEGIN
  IF uid IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO l FROM public.leases WHERE id=p_lease_id AND status IN ('active','expiring') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active lease not found' USING ERRCODE='P0002'; END IF;
  IF NOT (l.manager_id=uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = l.manager_id AND ms.submanager_user_id = uid)) THEN RAISE EXCEPTION 'Unauthorized lease scope' USING ERRCODE='42501'; END IF;
  IF p_proposed_rent IS NOT NULL AND p_proposed_rent <= 0 THEN RAISE EXCEPTION 'Proposed rent must be positive' USING ERRCODE='22023'; END IF;
  IF p_proposed_end_date IS NOT NULL AND p_proposed_end_date <= l.end_date THEN RAISE EXCEPTION 'Proposed end date must extend the current lease' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=l.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease tenant not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v FROM public.lease_renewal_cases WHERE lease_id=l.id AND status IN ('draft','sent','negotiating') LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.lease_renewal_cases SET proposed_rent=COALESCE(p_proposed_rent,proposed_rent),proposed_end_date=COALESCE(p_proposed_end_date,proposed_end_date),follow_up_at=p_follow_up_at,manager_notes=COALESCE(NULLIF(trim(p_manager_notes),''),manager_notes),updated_at=now() WHERE id=v.id RETURNING * INTO v;
    RETURN v;
  END IF;
  INSERT INTO public.tenant_notices(tenant_id,unit_id,property_id,manager_id,notice_type,title,body,current_rent,new_rent,effective_date,notice_period_days,delivery_method,status)
  VALUES(t.id,l.unit_id,l.property_id,l.manager_id,'lease_renewal','Lease renewal proposal',
    'Your current lease expires on '||l.end_date::text||'. Please review the renewal proposal and respond through your tenant portal.',
    l.monthly_rent,p_proposed_rent,COALESCE(p_proposed_end_date,l.end_date),NULL,'email','draft') RETURNING * INTO n;
  INSERT INTO public.lease_renewal_cases(lease_id,tenant_id,property_id,unit_id,manager_id,notice_id,proposed_rent,proposed_end_date,status,follow_up_at,manager_notes)
  VALUES(l.id,t.id,l.property_id,l.unit_id,l.manager_id,n.id,p_proposed_rent,p_proposed_end_date,'draft',p_follow_up_at,NULLIF(trim(p_manager_notes),'')) RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.send_lease_renewal_case_atomic(p_case_id uuid)
RETURNS public.lease_renewal_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.lease_renewal_cases%ROWTYPE; n public.tenant_notices%ROWTYPE; uid uuid:=auth.uid();
BEGIN
  SELECT * INTO v FROM public.lease_renewal_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND OR NOT (v.manager_id=uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = v.manager_id AND ms.submanager_user_id = uid)) THEN RAISE EXCEPTION 'Renewal case not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF v.status NOT IN ('draft','sent','negotiating') THEN RAISE EXCEPTION 'Renewal case cannot be sent in its current state' USING ERRCODE='22023'; END IF;
  SELECT * INTO n FROM public.tenant_notices WHERE id=v.notice_id FOR UPDATE;
  IF FOUND THEN UPDATE public.tenant_notices SET status='sent',sent_at=COALESCE(sent_at,now()) WHERE id=n.id; END IF;
  UPDATE public.lease_renewal_cases SET status='sent',updated_at=now() WHERE id=v.id RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.update_lease_renewal_case_atomic(p_case_id uuid,p_status text,p_follow_up_at timestamptz,p_manager_notes text)
RETURNS public.lease_renewal_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.lease_renewal_cases%ROWTYPE; uid uuid:=auth.uid();
BEGIN
  IF p_status NOT IN ('draft','sent','negotiating','accepted','declined','notice_to_vacate','withdrawn') THEN RAISE EXCEPTION 'Invalid renewal status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v FROM public.lease_renewal_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND OR NOT (v.manager_id=uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = v.manager_id AND ms.submanager_user_id = uid)) THEN RAISE EXCEPTION 'Renewal case not found or unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.lease_renewal_cases SET status=p_status,follow_up_at=p_follow_up_at,manager_notes=COALESCE(NULLIF(trim(p_manager_notes),''),manager_notes),updated_at=now() WHERE id=v.id RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.get_manager_lease_renewal_pipeline()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
  IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.end_date ASC) FROM (
    SELECT c.id,c.lease_id,c.tenant_id,c.property_id,c.unit_id,c.notice_id,c.proposed_rent,c.proposed_end_date,c.status,c.tenant_decision,c.tenant_decision_at,c.follow_up_at,c.manager_notes,c.created_at,c.updated_at,
      l.end_date,l.monthly_rent,l.property,l.unit,coalesce(t.name,'Tenant') tenant_name,coalesce(p.name,l.property) property_name,
      CASE WHEN l.end_date < current_date THEN 0 ELSE (l.end_date-current_date) END days_to_expiry
    FROM public.lease_renewal_cases c JOIN public.leases l ON l.id=c.lease_id LEFT JOIN public.tenants t ON t.id=c.tenant_id LEFT JOIN public.properties p ON p.id=c.property_id
    WHERE c.manager_id=uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = c.manager_id AND ms.submanager_user_id = uid)
  ) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.mark_missed_lease_renewal_followups_atomic()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  UPDATE public.lease_renewal_cases SET status='negotiating',updated_at=now() WHERE status='sent' AND follow_up_at IS NOT NULL AND follow_up_at < now() AND tenant_decision IS NULL;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.sync_renewal_case_from_tenant_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.lease_renewal_cases SET tenant_decision=NEW.decision,tenant_decision_at=COALESCE(NEW.signed_at,now()),status=CASE WHEN NEW.decision='accept' THEN 'accepted' WHEN NEW.decision='decline' THEN 'declined' ELSE 'negotiating' END,updated_at=now() WHERE notice_id=NEW.notice_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_renewal_case_from_tenant_response ON public.tenant_lease_renewal_responses;
CREATE TRIGGER sync_renewal_case_from_tenant_response AFTER INSERT ON public.tenant_lease_renewal_responses FOR EACH ROW EXECUTE FUNCTION public.sync_renewal_case_from_tenant_response();

GRANT EXECUTE ON FUNCTION public.create_lease_renewal_case_atomic(uuid,numeric,date,timestamptz,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.send_lease_renewal_case_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.update_lease_renewal_case_atomic(uuid,text,timestamptz,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_manager_lease_renewal_pipeline() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_missed_lease_renewal_followups_atomic() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_renewal_case_from_tenant_response() TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_lease_renewal_case_atomic(uuid,numeric,date,timestamptz,text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.send_lease_renewal_case_atomic(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.update_lease_renewal_case_atomic(uuid,text,timestamptz,text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_manager_lease_renewal_pipeline() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.mark_missed_lease_renewal_followups_atomic() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.sync_renewal_case_from_tenant_response() FROM PUBLIC, anon;

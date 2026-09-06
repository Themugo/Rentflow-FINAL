-- CALQULUS PMS — Landlord Control Center
-- Uses the existing property_landlords / manager mandate / agency service model.
-- No parallel ownership, billing or tenant tables are introduced.

CREATE TABLE IF NOT EXISTS public.landlord_management_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  requested_change text NOT NULL CHECK (requested_change IN (
    'self_manage','appoint_manager','change_collection_control','change_financial_control',
    'change_distribution_control','change_owner_visibility','change_reporting'
  )),
  requested_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landlord_management_change_requests_owner_idx
  ON public.landlord_management_change_requests(landlord_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS landlord_management_change_requests_property_idx
  ON public.landlord_management_change_requests(property_id, status, created_at DESC);

ALTER TABLE public.landlord_management_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS landlord_management_change_requests_owner_read ON public.landlord_management_change_requests;
CREATE POLICY landlord_management_change_requests_owner_read
  ON public.landlord_management_change_requests FOR SELECT
  USING (landlord_user_id = auth.uid());
DROP POLICY IF EXISTS landlord_management_change_requests_manager_read ON public.landlord_management_change_requests;
CREATE POLICY landlord_management_change_requests_manager_read
  ON public.landlord_management_change_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.manager_id=auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.landlord_management_change_requests FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_landlord_management_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'link_id',pl.id,'property_id',pl.property_id,'property_name',p.name,'address',p.address,
    'manager_id',pl.manager_id,'manager_name',mgr.full_name,'manager_email',mgr.email,
    'operating_model',coalesce(pl.operating_model,'agency_collects_full_management'),
    'payment_destination',pl.payment_destination,'revenue_share_pct',pl.revenue_share_pct,
    'management_fee_pct',pl.management_fee_pct,'allows_delegated_manager',pl.allows_delegated_manager,
    'delegated_manager_id',pl.delegated_manager_id,
    'mandate_status',mm.mandate_status,'owner_controls_collections',mm.owner_controls_collections,
    'owner_controls_financials',mm.owner_controls_financials,'owner_controls_distributions',mm.owner_controls_distributions,
    'manager_can_collect',mm.manager_can_collect,'manager_can_approve_financials',mm.manager_can_approve_financials,
    'manager_can_distribute',mm.manager_can_distribute,'owner_portal_enabled',coalesce(mm.owner_portal_enabled,true),
    'owner_visibility',coalesce(mm.owner_visibility,'{}'::jsonb),'reporting_frequency',coalesce(mm.reporting_frequency,'monthly'),
    'reporting_delivery',coalesce(mm.reporting_delivery,'portal'),'report_sections',coalesce(mm.report_sections,'{}'::jsonb)
  ) ORDER BY p.name), '[]'::jsonb) INTO v_result
  FROM public.property_landlords pl
  JOIN public.properties p ON p.id=pl.property_id
  LEFT JOIN public.profiles mgr ON mgr.id=pl.manager_id
  LEFT JOIN public.manager_management_mandates mm ON mm.property_landlord_id=pl.id
  WHERE pl.landlord_user_id=v_uid;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.create_landlord_management_change_request_atomic(
  p_property_id uuid, p_requested_change text, p_requested_value jsonb DEFAULT '{}'::jsonb, p_reason text DEFAULT NULL
) RETURNS public.landlord_management_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.landlord_management_change_requests%ROWTYPE;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_requested_change NOT IN ('self_manage','appoint_manager','change_collection_control','change_financial_control','change_distribution_control','change_owner_visibility','change_reporting') THEN
    RAISE EXCEPTION 'Invalid management change' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.property_landlords WHERE property_id=p_property_id AND landlord_user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Property ownership scope required' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.landlord_management_change_requests WHERE property_id=p_property_id AND landlord_user_id=auth.uid() AND status='pending') THEN
    RAISE EXCEPTION 'A pending management change already exists' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.landlord_management_change_requests(landlord_user_id,property_id,requested_change,requested_value,reason)
  VALUES(auth.uid(),p_property_id,p_requested_change,coalesce(p_requested_value,'{}'::jsonb),nullif(trim(p_reason),'')) RETURNING * INTO v;
  RETURN v;
END $$;

DROP TRIGGER IF EXISTS landlord_management_change_requests_updated_at ON public.landlord_management_change_requests;
CREATE TRIGGER landlord_management_change_requests_updated_at BEFORE UPDATE ON public.landlord_management_change_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON FUNCTION public.get_landlord_management_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_landlord_management_change_request_atomic(uuid,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_landlord_management_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_landlord_management_change_request_atomic(uuid,text,jsonb,text) TO authenticated, service_role;
COMMENT ON TABLE public.landlord_management_change_requests IS 'Owner-initiated management changes. Approval reuses the existing manager/agency authority workflows; this table does not mutate property ownership or financial control directly.';

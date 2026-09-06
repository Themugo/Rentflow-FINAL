-- CALQULUS PMS — Vendor Procurement, Contract & Performance Control
-- Extends approved expense commitments with governed vendor and contract context.

CREATE TABLE IF NOT EXISTS public.management_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  contact_name text,
  contact_email text,
  contact_phone text,
  service_category text NOT NULL CHECK (char_length(trim(service_category)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id, name)
);

CREATE TABLE IF NOT EXISTS public.vendor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.management_vendors(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  contract_reference text NOT NULL,
  service_scope text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  contract_value numeric(14,2) CHECK (contract_value IS NULL OR contract_value >= 0),
  renewal_notice_days integer NOT NULL DEFAULT 30 CHECK (renewal_notice_days BETWEEN 0 AND 3650),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','terminated')),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  UNIQUE(manager_id, contract_reference)
);

CREATE TABLE IF NOT EXISTS public.vendor_performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.management_vendors(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.vendor_contracts(id) ON DELETE SET NULL,
  review_period_start date NOT NULL,
  review_period_end date NOT NULL,
  quality_score integer NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  timeliness_score integer NOT NULL CHECK (timeliness_score BETWEEN 0 AND 100),
  cost_control_score integer NOT NULL CHECK (cost_control_score BETWEEN 0 AND 100),
  compliance_score integer NOT NULL CHECK (compliance_score BETWEEN 0 AND 100),
  notes text,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (review_period_end >= review_period_start)
);

ALTER TABLE public.expense_commitments ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.management_vendors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS management_vendors_manager_status_idx ON public.management_vendors(manager_id,status,name);
CREATE INDEX IF NOT EXISTS vendor_contracts_manager_dates_idx ON public.vendor_contracts(manager_id,start_date,end_date,status);
CREATE INDEX IF NOT EXISTS vendor_performance_vendor_period_idx ON public.vendor_performance_reviews(vendor_id,review_period_end DESC);
CREATE INDEX IF NOT EXISTS expense_commitments_vendor_idx ON public.expense_commitments(vendor_id,due_date,status);

ALTER TABLE public.management_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_performance_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS management_vendors_manager_scope ON public.management_vendors;
CREATE POLICY management_vendors_manager_scope ON public.management_vendors FOR ALL TO authenticated USING (public.can_manage_property_scope(manager_id)) WITH CHECK (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS vendor_contracts_manager_scope ON public.vendor_contracts;
CREATE POLICY vendor_contracts_manager_scope ON public.vendor_contracts FOR ALL TO authenticated USING (public.can_manage_property_scope(manager_id)) WITH CHECK (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS vendor_performance_manager_scope ON public.vendor_performance_reviews;
CREATE POLICY vendor_performance_manager_scope ON public.vendor_performance_reviews FOR ALL TO authenticated USING (public.can_manage_property_scope(manager_id)) WITH CHECK (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.management_vendors, public.vendor_contracts, public.vendor_performance_reviews FROM PUBLIC, anon;
GRANT SELECT ON public.management_vendors, public.vendor_contracts, public.vendor_performance_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.create_management_vendor_atomic(
  p_manager_id uuid, p_name text, p_service_category text,
  p_contact_name text DEFAULT NULL, p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_name),'') IS NULL OR nullif(trim(p_service_category),'') IS NULL THEN RAISE EXCEPTION 'Vendor name and service category are required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.management_vendors(manager_id,name,service_category,contact_name,contact_email,contact_phone,notes)
  VALUES(p_manager_id,trim(p_name),trim(p_service_category),nullif(trim(p_contact_name),''),nullif(trim(p_contact_email),''),nullif(trim(p_contact_phone),''),nullif(trim(p_notes),''))
  ON CONFLICT(manager_id,name) DO UPDATE SET service_category=excluded.service_category, contact_name=excluded.contact_name, contact_email=excluded.contact_email, contact_phone=excluded.contact_phone, notes=excluded.notes, status='active', updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'vendor_id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_vendor_contract_atomic(
  p_manager_id uuid, p_vendor_id uuid, p_contract_reference text, p_service_scope text,
  p_start_date date, p_end_date date, p_contract_value numeric DEFAULT NULL,
  p_renewal_notice_days integer DEFAULT 30, p_property_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.management_vendors v WHERE v.id=p_vendor_id AND v.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Vendor outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_contract_reference),'') IS NULL OR nullif(trim(p_service_scope),'') IS NULL OR p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN RAISE EXCEPTION 'Valid contract reference, scope and dates are required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.vendor_contracts(manager_id,vendor_id,property_id,contract_reference,service_scope,start_date,end_date,contract_value,renewal_notice_days,notes)
  VALUES(p_manager_id,p_vendor_id,p_property_id,trim(p_contract_reference),trim(p_service_scope),p_start_date,p_end_date,round(p_contract_value,2),coalesce(p_renewal_notice_days,30),nullif(trim(p_notes),''))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'contract_id',v_id,'status','draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_vendor_contract_atomic(p_contract_id uuid,p_target_status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.vendor_contracts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.vendor_contracts WHERE id=p_contract_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Contract outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_target_status NOT IN ('active','terminated','expired') THEN RAISE EXCEPTION 'Invalid contract status' USING ERRCODE='22023'; END IF;
  IF (r.status,p_target_status) NOT IN (('draft','active'),('active','terminated'),('active','expired')) THEN RAISE EXCEPTION 'Invalid contract transition from % to %',r.status,p_target_status USING ERRCODE='55000'; END IF;
  UPDATE public.vendor_contracts SET status=p_target_status,updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'contract_id',r.id,'status',p_target_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_vendor_performance_review_atomic(
  p_manager_id uuid,p_vendor_id uuid,p_review_period_start date,p_review_period_end date,
  p_quality_score integer,p_timeliness_score integer,p_cost_control_score integer,p_compliance_score integer,
  p_contract_id uuid DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.management_vendors v WHERE v.id=p_vendor_id AND v.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Vendor outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_contract_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vendor_contracts c WHERE c.id=p_contract_id AND c.manager_id=p_manager_id AND c.vendor_id=p_vendor_id) THEN RAISE EXCEPTION 'Contract outside vendor scope' USING ERRCODE='42501'; END IF;
  INSERT INTO public.vendor_performance_reviews(manager_id,vendor_id,contract_id,review_period_start,review_period_end,quality_score,timeliness_score,cost_control_score,compliance_score,notes)
  VALUES(p_manager_id,p_vendor_id,p_contract_id,p_review_period_start,p_review_period_end,p_quality_score,p_timeliness_score,p_cost_control_score,p_compliance_score,nullif(trim(p_notes),'')) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'review_id',v_id,'overall_score',round((p_quality_score+p_timeliness_score+p_cost_control_score+p_compliance_score)/4.0,2));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_vendor_procurement_control(p_manager_id uuid,p_as_of_date date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'as_of_date',p_as_of_date,
    'vendor_count',(SELECT count(*) FROM public.management_vendors WHERE manager_id=p_manager_id AND status='active'),
    'active_contracts',(SELECT count(*) FROM public.vendor_contracts WHERE manager_id=p_manager_id AND status='active'),
    'contracts_expiring_90d',(SELECT count(*) FROM public.vendor_contracts WHERE manager_id=p_manager_id AND status='active' AND end_date BETWEEN p_as_of_date AND p_as_of_date+90),
    'approved_commitments',(SELECT coalesce(sum(c.amount),0) FROM public.expense_commitments c WHERE c.manager_id=p_manager_id AND c.status='approved' AND c.due_date>=p_as_of_date),
    'unlinked_approved_commitments',(SELECT count(*) FROM public.expense_commitments c WHERE c.manager_id=p_manager_id AND c.status='approved' AND c.vendor_id IS NULL),
    'vendors',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'service_category',v.service_category,'status',v.status,'active_contracts',(SELECT count(*) FROM public.vendor_contracts c WHERE c.vendor_id=v.id AND c.status='active'),'approved_commitments',(SELECT coalesce(sum(ec.amount),0) FROM public.expense_commitments ec WHERE ec.vendor_id=v.id AND ec.status='approved' AND ec.due_date>=p_as_of_date),'latest_review',(SELECT jsonb_build_object('period_end',r.review_period_end,'overall_score',round((r.quality_score+r.timeliness_score+r.cost_control_score+r.compliance_score)/4.0,2)) FROM public.vendor_performance_reviews r WHERE r.vendor_id=v.id ORDER BY r.review_period_end DESC LIMIT 1)) ORDER BY v.name) FROM public.management_vendors v WHERE v.manager_id=p_manager_id AND v.status<>'archived'),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_management_vendor_atomic(uuid,text,text,text,text,text,text), public.create_vendor_contract_atomic(uuid,uuid,text,text,date,date,numeric,integer,uuid,text), public.transition_vendor_contract_atomic(uuid,text), public.create_vendor_performance_review_atomic(uuid,uuid,date,date,integer,integer,integer,integer,uuid,text), public.get_manager_vendor_procurement_control(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_management_vendor_atomic(uuid,text,text,text,text,text,text), public.create_vendor_contract_atomic(uuid,uuid,text,text,date,date,numeric,integer,uuid,text), public.transition_vendor_contract_atomic(uuid,text), public.create_vendor_performance_review_atomic(uuid,uuid,date,date,integer,integer,integer,integer,uuid,text), public.get_manager_vendor_procurement_control(uuid,date) TO authenticated;

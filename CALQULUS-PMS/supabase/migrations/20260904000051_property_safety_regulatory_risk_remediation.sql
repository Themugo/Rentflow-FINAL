-- CALQULUS PMS — Initiative 51: Property Safety, Regulatory Certification & Risk Remediation
-- Extends Initiative 50 without creating a second inspection, maintenance, or accounting source of truth.

CREATE TABLE IF NOT EXISTS public.property_safety_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  certificate_type text NOT NULL,
  certificate_number text,
  issuing_authority text,
  issued_on date,
  expires_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','revoked')),
  evidence_document_id uuid REFERENCES public.landlord_documents(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.property_risk_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  risk_title text NOT NULL,
  risk_category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','mitigated','accepted','closed')),
  identified_on date NOT NULL DEFAULT CURRENT_DATE,
  target_date date,
  source_inspection_finding_id uuid REFERENCES public.property_inspection_findings(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.maintenance_assets(id) ON DELETE SET NULL,
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  remediation_notes text,
  closed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_safety_certificates_manager_expiry_idx ON public.property_safety_certificates(manager_id,property_id,status,expires_on);
CREATE INDEX IF NOT EXISTS property_risk_register_manager_status_idx ON public.property_risk_register(manager_id,property_id,status,severity,target_date);
CREATE INDEX IF NOT EXISTS property_risk_register_maintenance_idx ON public.property_risk_register(manager_id,maintenance_request_id);

ALTER TABLE public.property_safety_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_risk_register ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_safety_certificates_manager_scope ON public.property_safety_certificates;
CREATE POLICY property_safety_certificates_manager_scope ON public.property_safety_certificates FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS property_risk_register_manager_scope ON public.property_risk_register;
CREATE POLICY property_risk_register_manager_scope ON public.property_risk_register FOR SELECT TO authenticated USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.property_safety_certificates, public.property_risk_register FROM PUBLIC, anon;
GRANT SELECT ON public.property_safety_certificates, public.property_risk_register TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_property_safety_certificate_atomic(
  p_manager_id uuid,
  p_certificate_type text,
  p_property_id uuid,
  p_certificate_number text DEFAULT NULL,
  p_issuing_authority text DEFAULT NULL,
  p_issued_on date DEFAULT NULL,
  p_expires_on date DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_evidence_document_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_certificate_type),'') IS NULL OR p_property_id IS NULL THEN RAISE EXCEPTION 'Certificate type and property are required' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('draft','active','expired','revoked') THEN RAISE EXCEPTION 'Invalid certificate status' USING ERRCODE='22023'; END IF;
  IF p_evidence_document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.landlord_documents d WHERE d.id=p_evidence_document_id AND public.can_manage_property_scope(d.manager_id) AND d.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Evidence outside manager scope' USING ERRCODE='42501'; END IF;
  INSERT INTO public.property_safety_certificates(manager_id,property_id,certificate_type,certificate_number,issuing_authority,issued_on,expires_on,status,evidence_document_id,notes,created_by)
  VALUES(p_manager_id,p_property_id,trim(p_certificate_type),nullif(trim(p_certificate_number),''),nullif(trim(p_issuing_authority),''),p_issued_on,p_expires_on,p_status,p_evidence_document_id,nullif(trim(p_notes),''),auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'certificate_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.create_property_risk_atomic(
  p_manager_id uuid,
  p_property_id uuid,
  p_risk_title text,
  p_risk_category text,
  p_severity text DEFAULT 'medium',
  p_target_date date DEFAULT NULL,
  p_source_inspection_finding_id uuid DEFAULT NULL,
  p_asset_id uuid DEFAULT NULL,
  p_remediation_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_finding_manager uuid; v_asset_manager uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_risk_title),'') IS NULL OR nullif(trim(p_risk_category),'') IS NULL THEN RAISE EXCEPTION 'Risk title and category are required' USING ERRCODE='22023'; END IF;
  IF p_severity NOT IN ('low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid risk severity' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_source_inspection_finding_id IS NOT NULL THEN SELECT manager_id INTO v_finding_manager FROM public.property_inspection_findings WHERE id=p_source_inspection_finding_id; IF v_finding_manager IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Inspection finding outside manager scope' USING ERRCODE='42501'; END IF; END IF;
  IF p_asset_id IS NOT NULL THEN SELECT manager_id INTO v_asset_manager FROM public.maintenance_assets WHERE id=p_asset_id; IF v_asset_manager IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Asset outside manager scope' USING ERRCODE='42501'; END IF; END IF;
  INSERT INTO public.property_risk_register(manager_id,property_id,risk_title,risk_category,severity,target_date,source_inspection_finding_id,asset_id,remediation_notes,created_by)
  VALUES(p_manager_id,p_property_id,trim(p_risk_title),trim(p_risk_category),p_severity,p_target_date,p_source_inspection_finding_id,p_asset_id,nullif(trim(p_remediation_notes),''),auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'risk_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.link_property_risk_maintenance_atomic(
  p_risk_id uuid,
  p_maintenance_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.property_risk_register%ROWTYPE; m public.maintenance_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.property_risk_register WHERE id=p_risk_id FOR UPDATE;
  SELECT * INTO m FROM public.maintenance_requests WHERE id=p_maintenance_request_id;
  IF r.id IS NULL OR m.id IS NULL OR r.manager_id IS DISTINCT FROM m.manager_id OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Risk or maintenance request outside manager scope' USING ERRCODE='42501'; END IF;
  UPDATE public.property_risk_register SET maintenance_request_id=m.id,status=CASE WHEN r.status='open' THEN 'mitigated' ELSE r.status END,updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'risk_id',r.id,'maintenance_request_id',m.id);
END; $$;

CREATE OR REPLACE FUNCTION public.transition_property_risk_atomic(
  p_risk_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.property_risk_register%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.property_risk_register WHERE id=p_risk_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Risk outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('open','mitigated','accepted','closed') THEN RAISE EXCEPTION 'Invalid risk status' USING ERRCODE='22023'; END IF;
  UPDATE public.property_risk_register SET status=p_status, remediation_notes=COALESCE(NULLIF(trim(p_notes),''),remediation_notes), closed_at=CASE WHEN p_status='closed' THEN now() ELSE NULL END, updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'risk_id',r.id,'status',p_status);
END; $$;

CREATE OR REPLACE FUNCTION public.get_manager_property_safety_risk_control(
  p_manager_id uuid,
  p_horizon_days integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'active_certificates',(SELECT count(*) FROM public.property_safety_certificates WHERE manager_id=p_manager_id AND status='active'),
    'expiring_certificates',(SELECT count(*) FROM public.property_safety_certificates WHERE manager_id=p_manager_id AND status='active' AND expires_on IS NOT NULL AND expires_on<=CURRENT_DATE+p_horizon_days),
    'expired_certificates',(SELECT count(*) FROM public.property_safety_certificates WHERE manager_id=p_manager_id AND (status='expired' OR (status='active' AND expires_on<CURRENT_DATE))),
    'open_risks',(SELECT count(*) FROM public.property_risk_register WHERE manager_id=p_manager_id AND status='open'),
    'critical_risks',(SELECT count(*) FROM public.property_risk_register WHERE manager_id=p_manager_id AND status='open' AND severity='critical'),
    'overdue_risks',(SELECT count(*) FROM public.property_risk_register WHERE manager_id=p_manager_id AND status='open' AND target_date IS NOT NULL AND target_date<CURRENT_DATE),
    'certificates',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'property_id',c.property_id,'certificate_type',c.certificate_type,'certificate_number',c.certificate_number,'authority',c.issuing_authority,'issued_on',c.issued_on,'expires_on',c.expires_on,'days_to_expiry',CASE WHEN c.expires_on IS NULL THEN NULL ELSE c.expires_on-CURRENT_DATE END,'status',CASE WHEN c.status='active' AND c.expires_on<CURRENT_DATE THEN 'expired' ELSE c.status END,'has_evidence',c.evidence_document_id IS NOT NULL) ORDER BY c.expires_on NULLS LAST,c.certificate_type) FROM public.property_safety_certificates c WHERE c.manager_id=p_manager_id),'[]'::jsonb),
    'risks',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'property_id',r.property_id,'risk_title',r.risk_title,'risk_category',r.risk_category,'severity',r.severity,'status',r.status,'target_date',r.target_date,'days_to_target',CASE WHEN r.target_date IS NULL THEN NULL ELSE r.target_date-CURRENT_DATE END,'maintenance_request_id',r.maintenance_request_id,'asset_id',r.asset_id,'source_inspection_finding_id',r.source_inspection_finding_id) ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,r.target_date NULLS LAST) FROM public.property_risk_register r WHERE r.manager_id=p_manager_id),'[]'::jsonb)
  );
END; $$;

REVOKE ALL ON FUNCTION public.upsert_property_safety_certificate_atomic(uuid,text,uuid,text,text,date,date,text,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_property_risk_atomic(uuid,uuid,text,text,text,date,uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_property_risk_maintenance_atomic(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_property_risk_atomic(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_manager_property_safety_risk_control(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upsert_property_safety_certificate_atomic(uuid,text,uuid,text,text,date,date,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_property_risk_atomic(uuid,uuid,text,text,text,date,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_property_risk_maintenance_atomic(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_property_risk_atomic(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_property_safety_risk_control(uuid,integer) TO authenticated;

COMMENT ON TABLE public.property_safety_certificates IS 'Statutory and safety certificates with expiry and canonical evidence linkage.';
COMMENT ON TABLE public.property_risk_register IS 'Property safety/regulatory risks linked to inspection findings, assets and existing maintenance work orders.';

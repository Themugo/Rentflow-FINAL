-- Phase 65: Financial-partner loan application lifecycle hardening.
CREATE TABLE IF NOT EXISTS public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  purpose text NOT NULL,
  term integer NOT NULL CHECK (term > 0),
  interest_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0 AND interest_rate <= 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','disbursed','repaid')),
  submitted_date timestamptz NOT NULL DEFAULT now(),
  approved_date timestamptz,
  disbursed_date timestamptz,
  repayment_start_date timestamptz,
  monthly_payment numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_payment >= 0),
  total_repayment numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_repayment >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhost_reads_loan_applications" ON public.loan_applications;
CREATE POLICY "webhost_reads_loan_applications"
  ON public.loan_applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

CREATE OR REPLACE FUNCTION public.create_loan_application_atomic(p_payload jsonb)
RETURNS public.loan_applications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.loan_applications%ROWTYPE; v_property uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('webhost','manager')) THEN
    RAISE EXCEPTION 'Unauthorized loan application creation' USING ERRCODE = '42501';
  END IF;
  v_property := NULLIF(p_payload->>'property_id','')::uuid;
  IF v_property IS NOT NULL AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v_property AND p.manager_id <> auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost') THEN
    RAISE EXCEPTION 'Property is outside manager portfolio' USING ERRCODE='42501';
  END IF;
  IF COALESCE((p_payload->>'amount')::numeric,0) <= 0 THEN RAISE EXCEPTION 'Loan amount must be positive'; END IF;
  IF COALESCE((p_payload->>'term')::integer,0) <= 0 THEN RAISE EXCEPTION 'Loan term must be positive'; END IF;
  IF COALESCE((p_payload->>'interest_rate')::numeric,0) < 0 OR COALESCE((p_payload->>'interest_rate')::numeric,0) > 100 THEN RAISE EXCEPTION 'Invalid interest rate'; END IF;
  INSERT INTO public.loan_applications(partner_id,property_id,applicant_name,amount,purpose,term,interest_rate,status,monthly_payment,total_repayment)
  VALUES (NULLIF(p_payload->>'partner_id','')::uuid,v_property,btrim(p_payload->>'applicant_name'),(p_payload->>'amount')::numeric,btrim(p_payload->>'purpose'),(p_payload->>'term')::integer,COALESCE((p_payload->>'interest_rate')::numeric,0),'pending',COALESCE((p_payload->>'monthly_payment')::numeric,0),COALESCE((p_payload->>'total_repayment')::numeric,0))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_loan_application_atomic(p_id uuid,p_status text)
RETURNS public.loan_applications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.loan_applications%ROWTYPE; v_role text; v_manager uuid;
BEGIN
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('webhost','manager') ORDER BY CASE role WHEN 'webhost' THEN 1 ELSE 2 END LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Unauthorized loan application transition' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('pending','under_review','approved','rejected','disbursed','repaid') THEN RAISE EXCEPTION 'Invalid loan status'; END IF;
  SELECT * INTO v_row FROM public.loan_applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan application not found'; END IF;
  IF v_role='manager' THEN
    SELECT p.manager_id INTO v_manager FROM public.properties p WHERE p.id=v_row.property_id;
    IF v_manager <> auth.uid() THEN RAISE EXCEPTION 'Loan application outside manager portfolio' USING ERRCODE='42501'; END IF;
  END IF;
  UPDATE public.loan_applications
  SET status=p_status,
      approved_date=CASE WHEN p_status='approved' THEN COALESCE(approved_date,now()) ELSE approved_date END,
      disbursed_date=CASE WHEN p_status='disbursed' THEN COALESCE(disbursed_date,now()) ELSE disbursed_date END,
      repayment_start_date=CASE WHEN p_status='disbursed' THEN COALESCE(repayment_start_date,CURRENT_DATE) ELSE repayment_start_date END,
      updated_at=now()
  WHERE id=p_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.loan_applications FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_loan_application_atomic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_loan_application_atomic(uuid,text) TO authenticated;

-- CALQULUS Phase 30: payment receipt submission/rejection lifecycle.
CREATE OR REPLACE FUNCTION public.submit_payment_receipt_atomic(
  p_tenant_id uuid,p_invoice_id uuid,p_receipt_url text,p_amount numeric,p_payment_date date,p_payment_method text,p_reference_number text DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; linked uuid;
BEGIN
 IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated tenant required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_payment_date IS NULL OR nullif(trim(p_receipt_url),'') IS NULL THEN RAISE EXCEPTION 'Receipt, amount, date and method are required' USING ERRCODE='22023'; END IF;
 IF p_invoice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'Invoice does not belong to tenant' USING ERRCODE='42501'; END IF;
 INSERT INTO public.payment_receipts(tenant_id,invoice_id,receipt_url,amount,payment_date,payment_method,reference_number,notes,status) VALUES(p_tenant_id,p_invoice_id,p_receipt_url,round(p_amount,2),p_payment_date,p_payment_method,nullif(trim(p_reference_number),''),p_notes,'pending') RETURNING id INTO rid;
 RETURN jsonb_build_object('success',true,'receipt_id',rid,'status','pending');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_payment_receipt_atomic(p_receipt_id uuid,p_rejection_reason text,p_verified_by uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.payment_receipts%ROWTYPE; manager_id uuid;
BEGIN
 IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF nullif(trim(p_rejection_reason),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason is required' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.payment_receipts WHERE id=p_receipt_id FOR UPDATE; IF r.id IS NULL THEN RAISE EXCEPTION 'Receipt not found' USING ERRCODE='P0002'; END IF;
 SELECT t.manager_id INTO manager_id FROM public.tenants t WHERE t.id=r.tenant_id;
 IF auth.role()<>'service_role' AND manager_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF r.status='rejected' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'receipt_id',r.id,'status','rejected'); END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Only pending receipts can be rejected' USING ERRCODE='55000'; END IF;
 UPDATE public.payment_receipts SET status='rejected',rejection_reason=left(trim(p_rejection_reason),500),verified_by=COALESCE(p_verified_by,auth.uid())::text,verified_at=now(),updated_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('success',true,'idempotent',false,'receipt_id',r.id,'status','rejected');
END; $$;
REVOKE ALL ON FUNCTION public.submit_payment_receipt_atomic(uuid,uuid,text,numeric,date,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reject_payment_receipt_atomic(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_receipt_atomic(uuid,uuid,text,numeric,date,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_receipt_atomic(uuid,text,uuid) TO authenticated,service_role;

-- Receipt records are evidence/financial workflow state; all writes go through lifecycle RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.payment_receipts FROM authenticated;

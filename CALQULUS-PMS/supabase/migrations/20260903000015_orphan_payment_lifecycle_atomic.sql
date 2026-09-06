-- CALQULUS Phase 32: orphan/self-managed payment diary lifecycle atomicity.
CREATE OR REPLACE FUNCTION public.record_orphan_payment_atomic(
  p_user_id uuid,
  p_record_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method text DEFAULT 'mpesa',
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid()<>p_user_id THEN RAISE EXCEPTION 'Authenticated owner required' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_payment_date IS NULL THEN RAISE EXCEPTION 'Valid payment date and positive amount are required' USING ERRCODE='22023'; END IF;
  IF p_record_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orphan_tenant_records WHERE id=p_record_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Orphan record does not belong to user' USING ERRCODE='42501'; END IF;
  INSERT INTO public.orphan_payment_entries(user_id,record_id,payment_date,amount,payment_method,reference,description,is_confirmed)
  VALUES(p_user_id,p_record_id,p_payment_date,round(p_amount,2),COALESCE(nullif(trim(p_payment_method),''),'mpesa'),nullif(trim(p_reference),''),nullif(trim(p_description),''),false)
  RETURNING id INTO payment_id;
  RETURN jsonb_build_object('success',true,'payment_id',payment_id,'status','self_logged');
END; $$;

CREATE OR REPLACE FUNCTION public.attach_orphan_payment_receipt_atomic(p_payment_id uuid,p_receipt_photo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment_user uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated user required' USING ERRCODE='42501'; END IF;
  SELECT user_id INTO payment_user FROM public.orphan_payment_entries WHERE id=p_payment_id FOR UPDATE;
  IF payment_user IS NULL THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE='P0002'; END IF;
  IF payment_user<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_receipt_photo),'') IS NULL THEN RAISE EXCEPTION 'Receipt path is required' USING ERRCODE='22023'; END IF;
  UPDATE public.orphan_payment_entries SET receipt_photo=left(trim(p_receipt_photo),2000) WHERE id=p_payment_id;
  RETURN jsonb_build_object('success',true,'payment_id',p_payment_id);
END; $$;

REVOKE ALL ON FUNCTION public.record_orphan_payment_atomic(uuid,uuid,date,numeric,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.attach_orphan_payment_receipt_atomic(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_orphan_payment_atomic(uuid,uuid,date,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_orphan_payment_receipt_atomic(uuid,text) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.orphan_payment_entries FROM authenticated;

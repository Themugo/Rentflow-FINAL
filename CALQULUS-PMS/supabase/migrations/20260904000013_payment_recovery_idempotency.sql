-- CALQULUS PMS — Payment recovery, idempotency & callback integrity
-- Prevent duplicate payer records, strengthen callback correlation, and provide
-- an explicit recovery path for transactions whose financial completion succeeded
-- but receipt issuance or downstream processing was interrupted.

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_callback_secret_uidx
  ON public.payment_transactions(callback_secret)
  WHERE callback_secret IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_or_create_payment_party_atomic(
  p_manager_id uuid,
  p_party_type text,
  p_display_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS public.payment_parties
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.payment_parties%ROWTYPE;
  v_phone text := NULLIF(regexp_replace(COALESCE(p_phone,''),'\\s+','','g'),'');
  v_email text := NULLIF(lower(trim(COALESCE(p_email,''))),'');
BEGIN
  IF auth.uid() IS NULL AND current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_manager_id IS NULL THEN RAISE EXCEPTION 'Manager is required' USING ERRCODE='22023'; END IF;
  IF p_party_type NOT IN ('tenant','employer','family_member','company','institution','sponsor','well_wisher','landlord','other') THEN
    RAISE EXCEPTION 'Invalid payer type' USING ERRCODE='22023';
  END IF;
  IF NULLIF(trim(COALESCE(p_display_name,'')),'') IS NULL THEN RAISE EXCEPTION 'Payer name is required' USING ERRCODE='22023'; END IF;

  -- Reuse the manager-scoped payer identity when phone or email matches. This keeps
  -- repeated STK attempts from creating a new payer row for the same person.
  IF v_phone IS NOT NULL THEN
    SELECT * INTO v FROM public.payment_parties
    WHERE manager_id=p_manager_id AND regexp_replace(COALESCE(phone,''),'\\s+','','g')=v_phone
    ORDER BY created_at LIMIT 1;
  END IF;
  IF v.id IS NULL AND v_email IS NOT NULL THEN
    SELECT * INTO v FROM public.payment_parties
    WHERE manager_id=p_manager_id AND lower(trim(COALESCE(email,'')))=v_email
    ORDER BY created_at LIMIT 1;
  END IF;

  IF v.id IS NOT NULL THEN
    UPDATE public.payment_parties
    SET party_type=COALESCE(NULLIF(p_party_type,''),party_type),
        display_name=trim(p_display_name),
        phone=COALESCE(v_phone,phone),
        email=COALESCE(v_email,email),
        updated_at=now()
    WHERE id=v.id
    RETURNING * INTO v;
    RETURN v;
  END IF;

  INSERT INTO public.payment_parties(party_type,display_name,phone,email,manager_id)
  VALUES(p_party_type,trim(p_display_name),v_phone,v_email,p_manager_id)
  RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_payment_party_atomic(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_payment_party_atomic(uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.recover_payment_transaction_atomic(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.payment_transactions%ROWTYPE;
  v_uid uuid:=auth.uid();
  v_manager uuid;
  v_receipt public.issued_payment_receipts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.payment_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Payment transaction not found' USING ERRCODE='P0002'; END IF;
  v_manager:=v.manager_id;
  IF v_uid<>v_manager AND NOT EXISTS (
    SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) THEN
    RAISE EXCEPTION 'Payment recovery scope unauthorized' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_receipt FROM public.issued_payment_receipts WHERE transaction_id=v.id LIMIT 1;
  RETURN jsonb_build_object(
    'transaction_id',v.id,
    'status',v.status,
    'amount',v.amount,
    'payment_reference',COALESCE(v.mpesa_receipt_number,v.bank_reference,v.checkout_request_id::text),
    'payer_party_id',v.payer_party_id,
    'receipt_id',v_receipt.id,
    'receipt_number',v_receipt.receipt_number,
    'receipt_delivery_status',v_receipt.delivery_status,
    'recoverable',v.status IN ('completed','failed') AND v_receipt.id IS NULL
  );
END $$;
GRANT EXECUTE ON FUNCTION public.recover_payment_transaction_atomic(uuid) TO authenticated;

COMMENT ON INDEX public.payment_transactions_callback_secret_uidx IS 'Unique callback correlation token used to recover STK transactions when checkout_request_id persistence is interrupted.';

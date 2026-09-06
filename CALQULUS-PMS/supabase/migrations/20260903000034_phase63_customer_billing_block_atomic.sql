-- Phase 63: customer-specific billing blocks are server-owned financial overrides.

CREATE OR REPLACE FUNCTION public.save_customer_billing_block_atomic(p_block_id uuid, p_payload jsonb)
RETURNS public.customer_billing_blocks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row public.customer_billing_blocks%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active('owner') AND NOT public.is_platform_admin_active('business') THEN RAISE EXCEPTION 'Billing administrator authorization required'; END IF;
  IF p_payload->>'customer_id' IS NULL OR p_payload->>'customer_type' NOT IN ('manager','landlord','agency') THEN RAISE EXCEPTION 'Valid customer is required'; END IF;
  IF COALESCE((p_payload->>'price_per_unit')::numeric,0) < 0 OR COALESCE((p_payload->>'registration_fee_amount')::numeric,0) < 0 OR COALESCE((p_payload->>'monthly_discount_flat')::numeric,0) < 0 OR COALESCE((p_payload->>'custom_block_price')::numeric,0) < 0 THEN RAISE EXCEPTION 'Billing amounts must be non-negative'; END IF;
  IF COALESCE((p_payload->>'monthly_discount_pct')::numeric,0) < 0 OR COALESCE((p_payload->>'monthly_discount_pct')::numeric,0) > 100 THEN RAISE EXCEPTION 'Discount percentage must be between 0 and 100'; END IF;
  IF p_block_id IS NULL THEN
    INSERT INTO public.customer_billing_blocks(customer_id,customer_type,agency_id,price_per_unit,unit_count_locked,registration_fee_waived,registration_fee_amount,monthly_discount_pct,monthly_discount_flat,discount_label,discount_expires_at,zero_registration,custom_block_name,custom_block_price,custom_block_units,custom_block_notes,approved_by,approved_at,updated_by)
    VALUES ((p_payload->>'customer_id')::uuid,p_payload->>'customer_type',NULLIF(p_payload->>'agency_id','')::uuid,(p_payload->>'price_per_unit')::numeric,COALESCE((p_payload->>'unit_count_locked')::boolean,false),COALESCE((p_payload->>'registration_fee_waived')::boolean,false),COALESCE((p_payload->>'registration_fee_amount')::numeric,0),COALESCE((p_payload->>'monthly_discount_pct')::numeric,0),COALESCE((p_payload->>'monthly_discount_flat')::numeric,0),NULLIF(p_payload->>'discount_label',''),NULLIF(p_payload->>'discount_expires_at','')::timestamptz,COALESCE((p_payload->>'zero_registration')::boolean,false),NULLIF(p_payload->>'custom_block_name',''),(p_payload->>'custom_block_price')::numeric,(p_payload->>'custom_block_units')::integer,NULLIF(p_payload->>'custom_block_notes',''),auth.uid(),now(),auth.uid()) RETURNING * INTO v_row;
  ELSE
    UPDATE public.customer_billing_blocks SET customer_id=(p_payload->>'customer_id')::uuid,customer_type=p_payload->>'customer_type',agency_id=NULLIF(p_payload->>'agency_id','')::uuid,price_per_unit=(p_payload->>'price_per_unit')::numeric,unit_count_locked=COALESCE((p_payload->>'unit_count_locked')::boolean,false),registration_fee_waived=COALESCE((p_payload->>'registration_fee_waived')::boolean,false),registration_fee_amount=COALESCE((p_payload->>'registration_fee_amount')::numeric,0),monthly_discount_pct=COALESCE((p_payload->>'monthly_discount_pct')::numeric,0),monthly_discount_flat=COALESCE((p_payload->>'monthly_discount_flat')::numeric,0),discount_label=NULLIF(p_payload->>'discount_label',''),discount_expires_at=NULLIF(p_payload->>'discount_expires_at','')::timestamptz,zero_registration=COALESCE((p_payload->>'zero_registration')::boolean,false),custom_block_name=NULLIF(p_payload->>'custom_block_name',''),custom_block_price=(p_payload->>'custom_block_price')::numeric,custom_block_units=(p_payload->>'custom_block_units')::integer,custom_block_notes=NULLIF(p_payload->>'custom_block_notes',''),approved_by=auth.uid(),approved_at=now(),updated_by=auth.uid(),updated_at=now() WHERE id=p_block_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Billing block not found'; END IF;
  END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_customer_billing_block_atomic(p_block_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_platform_admin_active('owner') AND NOT public.is_platform_admin_active('business') THEN RAISE EXCEPTION 'Billing administrator authorization required'; END IF;
  DELETE FROM public.customer_billing_blocks WHERE id=p_block_id;
END; $$;

REVOKE INSERT, UPDATE, DELETE ON public.customer_billing_blocks FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_billing_block_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_customer_billing_block_atomic(uuid) TO authenticated;

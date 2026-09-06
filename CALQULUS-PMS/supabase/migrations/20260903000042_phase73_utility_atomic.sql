-- PHASE 73: Utility connection/billing mutation convergence

CREATE OR REPLACE FUNCTION public.save_utility_connection_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.utility_connections%ROWTYPE; v_property uuid; v_manager uuid;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  v_property := (p_payload->>'property_id')::uuid;
  IF p_id IS NULL THEN
    INSERT INTO public.utility_connections(provider_id,property_id,unit,utility_type,connection_type,status,connection_date,monthly_rate,current_reading,previous_reading,last_billing_date,next_billing_date)
    VALUES ((p_payload->>'provider_id')::uuid,v_property,p_payload->>'unit',p_payload->>'utility_type',p_payload->>'connection_type',COALESCE(p_payload->>'status','pending'),COALESCE((p_payload->>'connection_date')::timestamptz,now()),COALESCE((p_payload->>'monthly_rate')::numeric,0),COALESCE((p_payload->>'current_reading')::numeric,0),COALESCE((p_payload->>'previous_reading')::numeric,0),(p_payload->>'last_billing_date')::timestamptz,(p_payload->>'next_billing_date')::timestamptz) RETURNING * INTO r;
  ELSE
    SELECT property_id INTO v_property FROM public.utility_connections WHERE id=p_id FOR UPDATE;
    UPDATE public.utility_connections SET status=COALESCE(p_payload->>'status',status), current_reading=COALESCE((p_payload->>'current_reading')::numeric,current_reading), previous_reading=COALESCE((p_payload->>'previous_reading')::numeric,previous_reading), last_billing_date=COALESCE((p_payload->>'last_billing_date')::timestamptz,last_billing_date), next_billing_date=COALESCE((p_payload->>'next_billing_date')::timestamptz,next_billing_date) WHERE id=p_id RETURNING * INTO r;
  END IF;
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=v_property;
  IF v_manager IS NULL AND NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Property not found'; END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.save_utility_bill_atomic(p_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.utility_bills%ROWTYPE; v_property uuid;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required' USING ERRCODE='42501'; END IF;
  v_property := (p_payload->>'property_id')::uuid;
  IF p_id IS NULL THEN
    INSERT INTO public.utility_bills(connection_id,provider_id,property_id,unit,utility_type,billing_period,consumption,rate,amount,status,due_date,paid_date)
    VALUES ((p_payload->>'connection_id')::uuid,(p_payload->>'provider_id')::uuid,v_property,p_payload->>'unit',p_payload->>'utility_type',p_payload->>'billing_period',COALESCE((p_payload->>'consumption')::numeric,0),COALESCE((p_payload->>'rate')::numeric,0),COALESCE((p_payload->>'amount')::numeric,0),COALESCE(p_payload->>'status','pending'),(p_payload->>'due_date')::timestamptz,(p_payload->>'paid_date')::timestamptz) RETURNING * INTO r;
  ELSE
    SELECT property_id INTO v_property FROM public.utility_bills WHERE id=p_id FOR UPDATE;
    UPDATE public.utility_bills SET status=COALESCE(p_payload->>'status',status), paid_date=COALESCE((p_payload->>'paid_date')::timestamptz,paid_date) WHERE id=p_id RETURNING * INTO r;
  END IF;
  RETURN to_jsonb(r);
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.utility_connections, public.utility_bills FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_utility_connection_atomic(uuid,jsonb), public.save_utility_bill_atomic(uuid,jsonb) TO authenticated;

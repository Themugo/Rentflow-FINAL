-- CALQULUS PMS — tenant-to-family payment links
-- A tenant can share an opaque, revocable payment link (e.g. hostel student -> parent)
-- without exposing the tenant's login or requiring the payer to create an account.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payment_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  manager_id uuid,
  label text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  max_uses integer NOT NULL DEFAULT 20 CHECK (max_uses BETWEEN 1 AND 100),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_share_links_tenant_idx ON public.payment_share_links(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_share_links_active_idx ON public.payment_share_links(expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS public.payment_share_link_invoices (
  share_link_id uuid NOT NULL REFERENCES public.payment_share_links(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_link_id, invoice_id)
);
CREATE INDEX IF NOT EXISTS payment_share_link_invoices_invoice_idx ON public.payment_share_link_invoices(invoice_id);

ALTER TABLE public.payment_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_share_link_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_share_links_tenant_select ON public.payment_share_links;
CREATE POLICY payment_share_links_tenant_select ON public.payment_share_links
  FOR SELECT TO authenticated USING (
    created_by = auth.uid() OR tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'tenant'
    )
  );

DROP POLICY IF EXISTS payment_share_link_invoices_tenant_select ON public.payment_share_link_invoices;
CREATE POLICY payment_share_link_invoices_tenant_select ON public.payment_share_link_invoices
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.payment_share_links l
      WHERE l.id = share_link_id
      AND (l.created_by = auth.uid() OR l.tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'tenant'
      ))
    )
  );

CREATE OR REPLACE FUNCTION public.create_tenant_payment_share_link_atomic(
  p_invoice_ids uuid[] DEFAULT NULL,
  p_expires_in_hours integer DEFAULT 168,
  p_label text DEFAULT 'Shared payment link'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tenant_id uuid;
  v_manager_id uuid;
  v_link_id uuid;
  v_token text;
  v_expires timestamptz;
  v_ids uuid[];
  v_count integer;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT ur.tenant_id INTO v_tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id=auth.uid() AND ur.role='tenant'
  LIMIT 1;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant access required' USING ERRCODE='42501'; END IF;

  IF p_expires_in_hours IS NULL OR p_expires_in_hours < 1 OR p_expires_in_hours > 720 THEN
    RAISE EXCEPTION 'Expiry must be between 1 and 720 hours' USING ERRCODE='22023';
  END IF;

  IF p_invoice_ids IS NULL OR cardinality(p_invoice_ids)=0 THEN
    SELECT array_agg(i.id ORDER BY i.due_date NULLS LAST, i.created_at)
    INTO v_ids
    FROM public.invoices i
    WHERE i.tenant_id=v_tenant_id
      AND i.status IN ('pending','overdue','partially_paid')
      AND GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0) > 0;
  ELSE
    v_ids := p_invoice_ids;
    IF EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id=ANY(v_ids)
        AND (i.tenant_id IS DISTINCT FROM v_tenant_id OR i.status NOT IN ('pending','overdue','partially_paid')
          OR GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0) <= 0)
    ) THEN
      RAISE EXCEPTION 'One or more selected bills are not payable by this tenant' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_ids IS NULL OR cardinality(v_ids)=0 THEN
    RAISE EXCEPTION 'No outstanding bills available for sharing' USING ERRCODE='P0002';
  END IF;
  IF cardinality(v_ids)>20 THEN RAISE EXCEPTION 'A shared payment link can contain at most 20 bills' USING ERRCODE='22023'; END IF;

  SELECT p.manager_id INTO v_manager_id
  FROM public.invoices i
  LEFT JOIN public.properties p ON p.id=i.property_id
  WHERE i.id=ANY(v_ids) AND p.manager_id IS NOT NULL
  ORDER BY i.due_date NULLS LAST
  LIMIT 1;

  v_token := encode(gen_random_bytes(32),'hex');
  v_expires := now() + make_interval(hours => p_expires_in_hours);

  INSERT INTO public.payment_share_links(token_hash,tenant_id,manager_id,label,expires_at,created_by)
  VALUES(encode(digest(v_token,'sha256'),'hex'),v_tenant_id,v_manager_id,NULLIF(trim(p_label),''),v_expires,auth.uid())
  RETURNING id INTO v_link_id;

  INSERT INTO public.payment_share_link_invoices(share_link_id,invoice_id)
  SELECT v_link_id, unnest(v_ids);

  SELECT count(*), COALESCE(sum(GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0)),0)
  INTO v_count,v_total
  FROM public.invoices i WHERE i.id=ANY(v_ids);

  RETURN jsonb_build_object(
    'share_link_id',v_link_id,
    'token',v_token,
    'expires_at',v_expires,
    'invoice_count',v_count,
    'total_amount',round(v_total,2)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.create_tenant_payment_share_link_atomic(uuid[],integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_tenant_payment_share_link_atomic(p_share_link_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.payment_share_links l
  SET revoked_at=COALESCE(revoked_at,now()),updated_at=now()
  WHERE l.id=p_share_link_id
    AND l.tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role='tenant')
  RETURNING true INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Share link not found or unauthorized' USING ERRCODE='42501'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_payment_share_link_atomic(uuid) TO authenticated;

-- Public read is deliberately limited to the bills encoded in the opaque token.
CREATE OR REPLACE FUNCTION public.get_public_payment_share(p_token text)
RETURNS TABLE(
  share_link_id uuid,
  label text,
  expires_at timestamptz,
  remaining_uses integer,
  invoice_id uuid,
  invoice_number text,
  property_name text,
  unit_number text,
  due_date date,
  amount numeric,
  paid_amount numeric,
  balance_due numeric,
  status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN RETURN; END IF;
  v_hash := encode(digest(trim(p_token),'sha256'),'hex');
  RETURN QUERY
  SELECT l.id,l.label,l.expires_at,GREATEST(l.max_uses-l.use_count,0),i.id,i.invoice_number,
    p.name,COALESCE(u.unit_number,'—'),i.due_date,i.amount,COALESCE(i.paid_amount,0),
    GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0),i.status
  FROM public.payment_share_links l
  JOIN public.payment_share_link_invoices sli ON sli.share_link_id=l.id
  JOIN public.invoices i ON i.id=sli.invoice_id
  LEFT JOIN public.properties p ON p.id=i.property_id
  LEFT JOIN public.units u ON u.id=COALESCE(i.unit_id,(SELECT le.unit_id FROM public.leases le WHERE le.id=i.lease_id))
  WHERE l.token_hash=v_hash
    AND l.revoked_at IS NULL
    AND l.expires_at>now()
    AND l.use_count<l.max_uses
  ORDER BY i.due_date NULLS LAST,p.name,u.unit_number,i.invoice_number;
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_payment_share(text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_public_payment_share_status(p_token text,p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text; v_link public.payment_share_links%ROWTYPE; v_tx public.payment_transactions%ROWTYPE; v_receipt jsonb;
BEGIN
  v_hash := encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');
  SELECT * INTO v_link FROM public.payment_share_links WHERE token_hash=v_hash;
  IF v_link.id IS NULL OR v_link.revoked_at IS NOT NULL OR v_link.expires_at<=now() THEN RAISE EXCEPTION 'Payment link is invalid or expired' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_tx FROM public.payment_transactions WHERE id=p_transaction_id;
  IF v_tx.id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.payment_share_link_invoices sli WHERE sli.share_link_id=v_link.id AND sli.invoice_id=v_tx.invoice_id
  ) THEN RAISE EXCEPTION 'Payment transaction not found for this link' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('receipt_id',r.id,'receipt_number',r.receipt_number,'issued_at',r.issued_at,'total_amount',r.total_amount)
  INTO v_receipt FROM public.issued_payment_receipts r WHERE r.transaction_id=v_tx.id LIMIT 1;
  RETURN jsonb_build_object('transaction_id',v_tx.id,'status',v_tx.status,'amount',v_tx.amount,'mpesa_receipt_number',v_tx.mpesa_receipt_number,'completed_at',v_tx.completed_at,'receipt',v_receipt);
END $$;
GRANT EXECUTE ON FUNCTION public.get_public_payment_share_status(text,uuid) TO anon,authenticated;

COMMENT ON TABLE public.payment_share_links IS 'Tenant-generated opaque links that let trusted family/third-party payers pay selected tenant bills without tenant credentials.';

CREATE TABLE IF NOT EXISTS public.payment_share_link_attempts (
  share_link_id uuid NOT NULL REFERENCES public.payment_share_links(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT date_trunc('hour',now()),
  attempt_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (share_link_id, window_started_at)
);

ALTER TABLE public.payment_share_link_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_shared_payment_attempt_atomic(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text; v_link public.payment_share_links%ROWTYPE; v_window timestamptz:=date_trunc('hour',now()); v_count integer;
BEGIN
  v_hash:=encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');
  SELECT * INTO v_link FROM public.payment_share_links WHERE token_hash=v_hash FOR UPDATE;
  IF v_link.id IS NULL OR v_link.revoked_at IS NOT NULL OR v_link.expires_at<=now() OR v_link.use_count>=v_link.max_uses THEN
    RAISE EXCEPTION 'Payment link is invalid or expired' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.payment_share_link_attempts(share_link_id,window_started_at,attempt_count)
  VALUES(v_link.id,v_window,1)
  ON CONFLICT (share_link_id,window_started_at)
  DO UPDATE SET attempt_count=public.payment_share_link_attempts.attempt_count+1
  RETURNING attempt_count INTO v_count;
  IF v_count>5 THEN RAISE EXCEPTION 'Too many payment attempts for this link. Please try again later.' USING ERRCODE='P4290'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.check_shared_payment_attempt_atomic(text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.consume_shared_payment_link_atomic(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hash text; v_ok boolean;
BEGIN
  v_hash:=encode(digest(trim(COALESCE(p_token,'')),'sha256'),'hex');
  UPDATE public.payment_share_links
  SET use_count=use_count+1,updated_at=now()
  WHERE token_hash=v_hash AND revoked_at IS NULL AND expires_at>now() AND use_count<max_uses
  RETURNING true INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Payment link is no longer available' USING ERRCODE='P4090'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.consume_shared_payment_link_atomic(text) TO anon,authenticated;

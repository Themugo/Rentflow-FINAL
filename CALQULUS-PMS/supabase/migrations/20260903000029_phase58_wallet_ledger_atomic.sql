-- ============================================================
-- Phase 58: Landlord wallet / ledger integrity
-- Financial wallet mutations are service-only and atomic.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_reference_uidx
  ON public.wallet_transactions (wallet_id, reference_type, reference_id, type)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_landlord_wallet_atomic(
  p_landlord_user_id uuid,
  p_currency text DEFAULT 'KES'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.landlord_wallets%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_landlord_user_id IS NULL THEN
    RAISE EXCEPTION 'landlord user id is required' USING ERRCODE = '22004';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_landlord_user_id) THEN
    RAISE EXCEPTION 'Landlord user not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.landlord_wallets (landlord_user_id, currency)
  VALUES (p_landlord_user_id, COALESCE(NULLIF(trim(p_currency), ''), 'KES'))
  ON CONFLICT (landlord_user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.landlord_wallets
  WHERE landlord_user_id = p_landlord_user_id
  FOR UPDATE;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet.id,
    'landlord_user_id', v_wallet.landlord_user_id,
    'balance', v_wallet.balance,
    'currency', v_wallet.currency
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_landlord_wallet_transaction_atomic(
  p_landlord_user_id uuid,
  p_amount numeric,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.landlord_wallets%ROWTYPE;
  v_tx public.wallet_transactions%ROWTYPE;
  v_delta numeric;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_landlord_user_id IS NULL THEN
    RAISE EXCEPTION 'landlord user id is required' USING ERRCODE = '22004';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_landlord_user_id) THEN
    RAISE EXCEPTION 'Landlord user not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_amount IS NULL OR round(p_amount, 2) <= 0 THEN
    RAISE EXCEPTION 'Wallet transaction amount must be greater than zero' USING ERRCODE = '22003';
  END IF;
  IF p_type NOT IN ('deposit', 'withdrawal', 'payout', 'fee') THEN
    RAISE EXCEPTION 'Unsupported wallet transaction type' USING ERRCODE = '22023';
  END IF;
  IF (p_reference_type IS NULL) <> (p_reference_id IS NULL) THEN
    RAISE EXCEPTION 'reference_type and reference_id must be supplied together' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.landlord_wallets (landlord_user_id)
  VALUES (p_landlord_user_id)
  ON CONFLICT (landlord_user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.landlord_wallets
  WHERE landlord_user_id = p_landlord_user_id
  FOR UPDATE;

  IF p_reference_type IS NOT NULL THEN
    SELECT * INTO v_tx
    FROM public.wallet_transactions
    WHERE wallet_id = v_wallet.id
      AND reference_type = p_reference_type
      AND reference_id = p_reference_id
      AND type = p_type
    LIMIT 1
    FOR UPDATE;

    IF v_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'wallet_id', v_wallet.id,
        'transaction_id', v_tx.id,
        'balance', v_wallet.balance,
        'currency', v_wallet.currency
      );
    END IF;
  END IF;

  -- A deposit credits the wallet; all outbound financial events debit it.
  v_delta := CASE WHEN p_type = 'deposit' THEN round(p_amount, 2) ELSE -round(p_amount, 2) END;

  IF v_delta < 0 AND v_wallet.balance + v_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient landlord wallet balance' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, reference_type, reference_id, description
  ) VALUES (
    v_wallet.id, round(p_amount, 2), p_type, p_reference_type, p_reference_id, p_description
  ) RETURNING * INTO v_tx;

  UPDATE public.landlord_wallets
  SET balance = round(balance + v_delta, 2), updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'wallet_id', v_wallet.id,
    'transaction_id', v_tx.id,
    'balance', v_wallet.balance,
    'currency', v_wallet.currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_landlord_wallet_atomic(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_landlord_wallet_transaction_atomic(uuid, numeric, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_landlord_wallet_atomic(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_landlord_wallet_transaction_atomic(uuid, numeric, text, text, uuid, text) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.landlord_wallets FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;

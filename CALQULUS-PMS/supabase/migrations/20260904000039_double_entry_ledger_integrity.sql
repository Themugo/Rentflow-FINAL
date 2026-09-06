-- CALQULUS PMS — Double-Entry Ledger Integrity
-- Canonical journal layer over existing financial truth. It does not replace
-- invoices, payments, expenditures, bank transactions or payout workflows.

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, account_code)
);

CREATE TABLE IF NOT EXISTS public.ledger_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  description text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  reversal_of uuid REFERENCES public.ledger_journal_entries(id) ON DELETE SET NULL,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.ledger_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.ledger_journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX IF NOT EXISTS ledger_entries_manager_date_idx
  ON public.ledger_journal_entries(manager_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS ledger_lines_entry_idx
  ON public.ledger_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS ledger_lines_account_idx
  ON public.ledger_journal_lines(account_id);

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_accounts_manager_scope ON public.ledger_accounts;
CREATE POLICY ledger_accounts_manager_scope ON public.ledger_accounts
  FOR SELECT USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS ledger_entries_manager_scope ON public.ledger_journal_entries;
CREATE POLICY ledger_entries_manager_scope ON public.ledger_journal_entries
  FOR SELECT USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS ledger_lines_manager_scope ON public.ledger_journal_lines;
CREATE POLICY ledger_lines_manager_scope ON public.ledger_journal_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ledger_journal_entries e
      WHERE e.id = ledger_journal_lines.journal_entry_id
        AND public.can_manage_property_scope(e.manager_id)
    )
  );

REVOKE ALL ON public.ledger_accounts, public.ledger_journal_entries, public.ledger_journal_lines FROM PUBLIC, anon;
GRANT SELECT ON public.ledger_accounts, public.ledger_journal_entries, public.ledger_journal_lines TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_manager_ledger_accounts(p_manager_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.ledger_accounts(manager_id,account_code,account_name,account_type,normal_balance)
  VALUES
    (p_manager_id,'1100','Cash / Bank','asset','debit'),
    (p_manager_id,'1200','Accounts Receivable','asset','debit'),
    (p_manager_id,'2100','Owner Payable','liability','credit'),
    (p_manager_id,'4000','Rental Income','income','credit'),
    (p_manager_id,'5000','Property Expenses','expense','debit')
  ON CONFLICT (manager_id,account_code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_manager_ledger_integrity(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invoice_count integer := 0;
  v_invoice_unposted integer := 0;
  v_payment_count integer := 0;
  v_payment_unposted integer := 0;
  v_expense_count integer := 0;
  v_expense_unposted integer := 0;
  v_payout_count integer := 0;
  v_payout_unposted integer := 0;
  v_unbalanced integer := 0;
  v_debits numeric := 0;
  v_credits numeric := 0;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'Invalid period' USING ERRCODE='22023';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE le.id IS NULL)
    INTO v_invoice_count, v_invoice_unposted
  FROM public.invoices i
  LEFT JOIN public.ledger_journal_entries le ON le.manager_id=i.manager_id AND le.source_type='invoice' AND le.source_id=i.id
  WHERE i.manager_id=p_manager_id AND i.status <> 'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end;

  SELECT count(*), count(*) FILTER (WHERE le.id IS NULL)
    INTO v_payment_count, v_payment_unposted
  FROM public.payment_allocations pa
  JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed'
  LEFT JOIN public.ledger_journal_entries le ON le.manager_id=pa.manager_id AND le.source_type='payment_allocation' AND le.source_id=pa.id
  WHERE pa.manager_id=p_manager_id AND pa.created_at::date BETWEEN p_period_start AND p_period_end;

  SELECT count(*), count(*) FILTER (WHERE le.id IS NULL)
    INTO v_expense_count, v_expense_unposted
  FROM public.expenditures e
  LEFT JOIN public.ledger_journal_entries le ON le.manager_id=e.manager_id AND le.source_type='expenditure' AND le.source_id=e.id
  WHERE e.manager_id=p_manager_id AND e.created_at::date BETWEEN p_period_start AND p_period_end;

  SELECT count(*), count(*) FILTER (WHERE le.id IS NULL)
    INTO v_payout_count, v_payout_unposted
  FROM public.payout_requests p
  LEFT JOIN public.ledger_journal_entries le ON le.manager_id=p.manager_id AND le.source_type='payout_request' AND le.source_id=p.id
  WHERE p.manager_id=p_manager_id AND p.status='paid' AND p.paid_at::date BETWEEN p_period_start AND p_period_end;

  SELECT count(*) FILTER (WHERE round(sum_debit,2) <> round(sum_credit,2)), coalesce(sum(sum_debit),0), coalesce(sum(sum_credit),0)
    INTO v_unbalanced, v_debits, v_credits
  FROM (
    SELECT e.id, coalesce(sum(l.debit),0) sum_debit, coalesce(sum(l.credit),0) sum_credit
    FROM public.ledger_journal_entries e
    JOIN public.ledger_journal_lines l ON l.journal_entry_id=e.id
    WHERE e.manager_id=p_manager_id AND e.entry_date BETWEEN p_period_start AND p_period_end AND e.status='posted'
    GROUP BY e.id
  ) x;

  RETURN jsonb_build_object(
    'ok', true,
    'period', jsonb_build_object('start',p_period_start,'end',p_period_end),
    'sources', jsonb_build_object(
      'invoices',jsonb_build_object('count',v_invoice_count,'unposted',v_invoice_unposted),
      'payment_allocations',jsonb_build_object('count',v_payment_count,'unposted',v_payment_unposted),
      'expenditures',jsonb_build_object('count',v_expense_count,'unposted',v_expense_unposted),
      'paid_payouts',jsonb_build_object('count',v_payout_count,'unposted',v_payout_unposted)
    ),
    'journal',jsonb_build_object('unbalanced_entries',v_unbalanced,'debits',round(v_debits,2),'credits',round(v_credits,2),'balanced',v_unbalanced=0 AND round(v_debits,2)=round(v_credits,2)),
    'complete', v_invoice_unposted=0 AND v_payment_unposted=0 AND v_expense_unposted=0 AND v_payout_unposted=0 AND v_unbalanced=0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_manager_financial_ledger_atomic(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r record;
  v_uid uuid := auth.uid();
  v_close public.financial_close_periods;
  v_ar uuid;
  v_cash uuid;
  v_income uuid;
  v_expense uuid;
  v_owner_payable uuid;
  v_entry uuid;
  v_posted integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'Invalid period' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_close FROM public.financial_close_periods WHERE manager_id=p_manager_id AND period_start=p_period_start AND period_end=p_period_end LIMIT 1;
  IF FOUND AND v_close.status='closed' THEN
    RAISE EXCEPTION 'Closed periods are immutable; use reconciliation and reversal controls' USING ERRCODE='55000';
  END IF;

  PERFORM public.ensure_manager_ledger_accounts(p_manager_id);
  SELECT id INTO v_ar FROM public.ledger_accounts WHERE manager_id=p_manager_id AND account_code='1200';
  SELECT id INTO v_cash FROM public.ledger_accounts WHERE manager_id=p_manager_id AND account_code='1100';
  SELECT id INTO v_owner_payable FROM public.ledger_accounts WHERE manager_id=p_manager_id AND account_code='2100';
  SELECT id INTO v_income FROM public.ledger_accounts WHERE manager_id=p_manager_id AND account_code='4000';
  SELECT id INTO v_expense FROM public.ledger_accounts WHERE manager_id=p_manager_id AND account_code='5000';

  FOR r IN SELECT i.* FROM public.invoices i WHERE i.manager_id=p_manager_id AND i.status<>'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end LOOP
    IF EXISTS (SELECT 1 FROM public.ledger_journal_entries WHERE manager_id=p_manager_id AND source_type='invoice' AND source_id=r.id) THEN v_skipped:=v_skipped+1; CONTINUE; END IF;
    INSERT INTO public.ledger_journal_entries(manager_id,entry_date,description,source_type,source_id,posted_by)
      VALUES(p_manager_id,r.created_at::date,'Invoice '||r.invoice_number,'invoice',r.id,v_uid) RETURNING id INTO v_entry;
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,debit,memo) VALUES(v_entry,v_ar,r.property_id,coalesce(r.original_amount,r.amount),'Accounts receivable');
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,credit,memo) VALUES(v_entry,v_income,r.property_id,coalesce(r.original_amount,r.amount),'Rental / billed income');
    v_posted:=v_posted+1;
  END LOOP;

  FOR r IN SELECT pa.*,pt.property_id FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' WHERE pa.manager_id=p_manager_id AND pa.created_at::date BETWEEN p_period_start AND p_period_end LOOP
    IF EXISTS (SELECT 1 FROM public.ledger_journal_entries WHERE manager_id=p_manager_id AND source_type='payment_allocation' AND source_id=r.id) THEN v_skipped:=v_skipped+1; CONTINUE; END IF;
    INSERT INTO public.ledger_journal_entries(manager_id,entry_date,description,source_type,source_id,posted_by)
      VALUES(p_manager_id,r.created_at::date,'Payment allocation '||r.id::text,'payment_allocation',r.id,v_uid) RETURNING id INTO v_entry;
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,debit,memo) VALUES(v_entry,v_cash,r.property_id,r.allocated_amount,'Cash / bank receipt');
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,credit,memo) VALUES(v_entry,v_ar,r.property_id,r.allocated_amount,'Reduce accounts receivable');
    v_posted:=v_posted+1;
  END LOOP;

  FOR r IN SELECT e.* FROM public.expenditures e WHERE e.manager_id=p_manager_id AND e.created_at::date BETWEEN p_period_start AND p_period_end LOOP
    IF EXISTS (SELECT 1 FROM public.ledger_journal_entries WHERE manager_id=p_manager_id AND source_type='expenditure' AND source_id=r.id) THEN v_skipped:=v_skipped+1; CONTINUE; END IF;
    INSERT INTO public.ledger_journal_entries(manager_id,entry_date,description,source_type,source_id,posted_by)
      VALUES(p_manager_id,r.created_at::date,coalesce(r.description,r.category),'expenditure',r.id,v_uid) RETURNING id INTO v_entry;
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,debit,memo) VALUES(v_entry,v_expense,r.property_id,r.amount,r.category);
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,credit,memo) VALUES(v_entry,v_cash,r.property_id,r.amount,'Cash / bank payment');
    v_posted:=v_posted+1;
  END LOOP;

  FOR r IN SELECT p.* FROM public.payout_requests p WHERE p.manager_id=p_manager_id AND p.status='paid' AND p.paid_at::date BETWEEN p_period_start AND p_period_end LOOP
    IF EXISTS (SELECT 1 FROM public.ledger_journal_entries WHERE manager_id=p_manager_id AND source_type='payout_request' AND source_id=r.id) THEN v_skipped:=v_skipped+1; CONTINUE; END IF;
    INSERT INTO public.ledger_journal_entries(manager_id,entry_date,description,source_type,source_id,posted_by)
      VALUES(p_manager_id,r.paid_at::date,'Owner payout '||r.id::text,'payout_request',r.id,v_uid) RETURNING id INTO v_entry;
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,debit,memo) VALUES(v_entry,v_owner_payable,r.property_id,r.amount,'Owner settlement');
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,credit,memo) VALUES(v_entry,v_cash,r.property_id,r.amount,'Cash / bank payout');
    v_posted:=v_posted+1;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'posted',v_posted,'skipped_existing',v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_manager_ledger_accounts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_manager_ledger_integrity(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_manager_financial_ledger_atomic(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_manager_ledger_accounts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_manager_ledger_integrity(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_manager_financial_ledger_atomic(uuid,date,date) TO authenticated;

COMMENT ON TABLE public.ledger_journal_entries IS 'Canonical double-entry journal layer sourced from existing CALQULUS financial records; source systems remain authoritative.';

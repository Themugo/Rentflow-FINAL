-- CALQULUS PMS — Trial Balance, General Ledger & Financial Statements
-- Reporting is derived exclusively from the controlled double-entry journal.

CREATE OR REPLACE FUNCTION public.get_manager_trial_balance(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_period_end < p_period_start THEN RAISE EXCEPTION 'Invalid reporting period'; END IF;

  WITH balances AS (
    SELECT a.id, a.account_code, a.account_name, a.account_type, a.normal_balance,
      COALESCE(SUM(l.debit) FILTER (WHERE e.status = 'posted'),0) AS debits,
      COALESCE(SUM(l.credit) FILTER (WHERE e.status = 'posted'),0) AS credits
    FROM public.ledger_accounts a
    LEFT JOIN public.ledger_journal_lines l ON l.account_id = a.id
    LEFT JOIN public.ledger_journal_entries e ON e.id = l.journal_entry_id
      AND e.manager_id = p_manager_id AND e.entry_date BETWEEN p_period_start AND p_period_end
    WHERE a.manager_id = p_manager_id AND a.is_active
    GROUP BY a.id,a.account_code,a.account_name,a.account_type,a.normal_balance
  ), rows AS (
    SELECT *,
      CASE WHEN normal_balance='debit' THEN debits-credits ELSE credits-debits END AS balance
    FROM balances
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start',p_period_start,'end',p_period_end),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.account_code) FROM rows r),'[]'::jsonb),
    'totals', jsonb_build_object(
      'debits', COALESCE((SELECT SUM(debits) FROM rows),0),
      'credits', COALESCE((SELECT SUM(credits) FROM rows),0),
      'balance_difference', COALESCE((SELECT SUM(debits)-SUM(credits) FROM rows),0)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_general_ledger(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date,
  p_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_period_end < p_period_start THEN RAISE EXCEPTION 'Invalid reporting period'; END IF;
  IF p_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_accounts a WHERE a.id=p_account_id AND a.manager_id=p_manager_id) THEN
    RAISE EXCEPTION 'Account is outside manager scope' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'period', jsonb_build_object('start',p_period_start,'end',p_period_end),
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,'entry_date',e.entry_date,'description',e.description,'source_type',e.source_type,
        'source_id',e.source_id,'status',e.status,'reversal_of',e.reversal_of,
        'lines',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',l.id,'account_id',a.id,'account_code',a.account_code,'account_name',a.account_name,
          'debit',l.debit,'credit',l.credit,'property_id',l.property_id,'memo',l.memo
        ) ORDER BY a.account_code) FROM public.ledger_journal_lines l JOIN public.ledger_accounts a ON a.id=l.account_id WHERE l.journal_entry_id=e.id AND (p_account_id IS NULL OR a.id=p_account_id))
      ) ORDER BY e.entry_date DESC,e.created_at DESC)
      FROM public.ledger_journal_entries e
      WHERE e.manager_id=p_manager_id AND e.entry_date BETWEEN p_period_start AND p_period_end
        AND (p_account_id IS NULL OR EXISTS (SELECT 1 FROM public.ledger_journal_lines l WHERE l.journal_entry_id=e.id AND l.account_id=p_account_id))
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_financial_statements(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_period_end < p_period_start THEN RAISE EXCEPTION 'Invalid reporting period'; END IF;

  WITH b AS (
    SELECT a.account_code,a.account_name,a.account_type,a.normal_balance,
      COALESCE(SUM(l.debit) FILTER (WHERE e.status='posted'),0) debits,
      COALESCE(SUM(l.credit) FILTER (WHERE e.status='posted'),0) credits
    FROM public.ledger_accounts a
    LEFT JOIN public.ledger_journal_lines l ON l.account_id=a.id
    LEFT JOIN public.ledger_journal_entries e ON e.id=l.journal_entry_id AND e.manager_id=p_manager_id AND e.entry_date BETWEEN p_period_start AND p_period_end
    WHERE a.manager_id=p_manager_id AND a.is_active
    GROUP BY a.account_code,a.account_name,a.account_type,a.normal_balance
  ), r AS (
    SELECT *, CASE WHEN normal_balance='debit' THEN debits-credits ELSE credits-debits END balance FROM b
  ), income AS (SELECT COALESCE(SUM(balance),0) total FROM r WHERE account_type='income'), expense AS (SELECT COALESCE(SUM(balance),0) total FROM r WHERE account_type='expense'),
  statement_rows AS (
    SELECT jsonb_build_object('account_code',account_code,'account_name',account_name,'amount',balance) row, account_type FROM r WHERE balance <> 0
  )
  SELECT jsonb_build_object(
    'period',jsonb_build_object('start',p_period_start,'end',p_period_end),
    'profit_and_loss',jsonb_build_object(
      'income',COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'account_code')) FROM statement_rows WHERE account_type='income'),'[]'::jsonb),
      'expenses',COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'account_code')) FROM statement_rows WHERE account_type='expense'),'[]'::jsonb),
      'total_income',(SELECT total FROM income),'total_expenses',(SELECT total FROM expense),'net_income',(SELECT total FROM income)-(SELECT total FROM expense)
    ),
    'balance_sheet',jsonb_build_object(
      'assets',COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'account_code')) FROM statement_rows WHERE account_type='asset'),'[]'::jsonb),
      'liabilities',COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'account_code')) FROM statement_rows WHERE account_type='liability'),'[]'::jsonb),
      'equity',COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'account_code')) FROM statement_rows WHERE account_type='equity'),'[]'::jsonb),
      'current_period_earnings',(SELECT total FROM income)-(SELECT total FROM expense),
      'total_assets',COALESCE((SELECT SUM(balance) FROM r WHERE account_type='asset'),0),
      'total_liabilities',COALESCE((SELECT SUM(balance) FROM r WHERE account_type='liability'),0),
      'total_equity',COALESCE((SELECT SUM(balance) FROM r WHERE account_type='equity'),0)+((SELECT total FROM income)-(SELECT total FROM expense))
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_manager_trial_balance(uuid,date,date), public.get_manager_general_ledger(uuid,date,date,uuid), public.get_manager_financial_statements(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_trial_balance(uuid,date,date), public.get_manager_general_ledger(uuid,date,date,uuid), public.get_manager_financial_statements(uuid,date,date) TO authenticated;

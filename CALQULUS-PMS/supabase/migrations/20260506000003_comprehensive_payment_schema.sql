-- ============================================================
-- CALQULUS RMS: Comprehensive payment schema
-- Supports: STK push, USSD/paybill, bank direct, receipt upload
-- Handles: full, partial/installment, advance/overpayment
-- Tracks:  running balance, arrears, penalties, credit ledger
-- ============================================================

-- ── 1. Extend payment_transactions with missing columns ────
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS unit_id        uuid    REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id   uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_number   text,
  ADD COLUMN IF NOT EXISTS bank_reference text,
  ADD COLUMN IF NOT EXISTS payment_method text    NOT NULL DEFAULT 'mpesa_stk',
  -- payment_method values:
  --   mpesa_stk | mpesa_ussd | mpesa_till | bank_transfer | bank_direct_debit | receipt_upload
  ADD COLUMN IF NOT EXISTS is_partial    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_advance    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocated_amount numeric(12,2),  -- portion applied to a specific invoice
  ADD COLUMN IF NOT EXISTS credit_amount    numeric(12,2),  -- portion held as advance credit
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS recorded_by     uuid    REFERENCES auth.users(id) ON DELETE SET NULL;
  -- recorded_by: manager/submanager who manually recorded (null = self-service)

CREATE INDEX IF NOT EXISTS payment_transactions_property_idx ON public.payment_transactions(property_id);
CREATE INDEX IF NOT EXISTS payment_transactions_unit_idx     ON public.payment_transactions(unit_id);
CREATE INDEX IF NOT EXISTS payment_transactions_method_idx   ON public.payment_transactions(payment_method);

-- ── 2. payment_allocations — maps one payment to invoices ──
-- A single payment can partially cover multiple invoices.
-- Example: tenant pays KES 15,000; invoice A = 10,000 (full), invoice B = 5,000 (partial)
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid    NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  invoice_id        uuid    NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id         uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_id        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_amount  numeric(12,2) NOT NULL CHECK (allocated_amount > 0),
  closes_invoice    boolean NOT NULL DEFAULT false,  -- true = this allocation fully paid the invoice
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx     ON public.payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS payment_allocations_transaction_idx ON public.payment_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS payment_allocations_tenant_idx      ON public.payment_allocations(tenant_id);

-- ── 3. tenant_credit_ledger — advance / overpayment credit ─
-- When a tenant pays more than owed, excess becomes credit.
-- Credit is drawn down on next invoice.
CREATE TABLE IF NOT EXISTS public.tenant_credit_ledger (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  transaction_id  uuid    REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  invoice_id      uuid    REFERENCES public.invoices(id) ON DELETE SET NULL,
  entry_type      text    NOT NULL CHECK (entry_type IN ('credit', 'debit', 'refund')),
  -- credit: advance payment received
  -- debit:  credit applied to an invoice
  -- refund: credit returned to tenant
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  balance_after   numeric(12,2) NOT NULL,  -- running credit balance after this entry
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tcl_tenant_idx  ON public.tenant_credit_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS tcl_manager_idx ON public.tenant_credit_ledger(manager_id);

-- ── 4. Extend invoices with installment and balance columns ─
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS original_amount    numeric(12,2),  -- set once, never changes
  ADD COLUMN IF NOT EXISTS paid_amount        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due        numeric(12,2),  -- computed: original_amount - paid_amount
  ADD COLUMN IF NOT EXISTS installment_plan   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installment_count  integer,       -- total instalments agreed
  ADD COLUMN IF NOT EXISTS penalty_amount     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied     numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill original_amount from amount for existing rows
UPDATE public.invoices SET original_amount = amount WHERE original_amount IS NULL;
UPDATE public.invoices SET balance_due = amount - paid_amount WHERE balance_due IS NULL;

-- ── 5. bank_integration_settings — per manager bank link ───
-- Supports: Equity, KCB, NCBA, Coop, ABSA, Stanbic direct APIs
CREATE TABLE IF NOT EXISTS public.bank_integration_settings (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id        uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id       uuid    REFERENCES public.properties(id) ON DELETE CASCADE,
  bank_name         text    NOT NULL,  -- 'equity' | 'kcb' | 'ncba' | 'coop' | 'absa' | 'stanbic' | 'other'
  account_number    text,
  account_name      text,
  paybill_number    text,
  bank_code         text,
  branch_code       text,
  api_key_encrypted text,              -- encrypted at application layer
  webhook_secret    text,              -- for bank-push webhook verification
  is_active         boolean NOT NULL DEFAULT true,
  auto_reconcile    boolean NOT NULL DEFAULT true,
  match_by          text    NOT NULL DEFAULT 'amount_and_unit',
  -- match_by: 'amount_and_unit' | 'reference' | 'amount_only' | 'manual'
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_integration_manager_property_uniq
  ON public.bank_integration_settings(manager_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid), bank_name);

-- ── 6. bank_transactions — raw bank statement rows ─────────
-- Both push (real-time bank webhook) and pull (CSV upload)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id            uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_integration_id   uuid    REFERENCES public.bank_integration_settings(id) ON DELETE SET NULL,
  external_id           text,          -- bank's own transaction ID (deduplication)
  reference             text,          -- payment reference / narration
  description           text,
  amount                numeric(12,2) NOT NULL,
  transaction_date      date    NOT NULL,
  bank_name             text,
  account_number        text,
  payer_name            text,          -- name from bank statement
  payer_phone           text,
  matched               boolean NOT NULL DEFAULT false,
  matched_invoice_id    uuid    REFERENCES public.invoices(id) ON DELETE SET NULL,
  matched_tenant_id     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  match_confidence      numeric(4,2),  -- 0–100
  match_method          text,          -- 'auto_reference' | 'auto_amount_unit' | 'manual'
  source                text    NOT NULL DEFAULT 'webhook',
  -- source: 'webhook' | 'csv_upload' | 'manual'
  raw_payload           jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, external_id)     -- prevent duplicate imports
);

CREATE INDEX IF NOT EXISTS bank_tx_manager_idx    ON public.bank_transactions(manager_id);
CREATE INDEX IF NOT EXISTS bank_tx_matched_idx    ON public.bank_transactions(matched);
CREATE INDEX IF NOT EXISTS bank_tx_date_idx       ON public.bank_transactions(transaction_date);

-- ── 7. arrears_schedule — installment payment plans ────────
CREATE TABLE IF NOT EXISTS public.arrears_schedule (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id       uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_id       uuid    REFERENCES public.invoices(id) ON DELETE SET NULL,
  total_owed       numeric(12,2) NOT NULL,
  instalment_count integer NOT NULL,
  instalment_amount numeric(12,2) NOT NULL,  -- each instalment target
  paid_count       integer NOT NULL DEFAULT 0,
  total_paid       numeric(12,2) NOT NULL DEFAULT 0,
  status           text    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  start_date       date    NOT NULL DEFAULT CURRENT_DATE,
  next_due_date    date,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arrears_schedule_tenant_idx  ON public.arrears_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS arrears_schedule_manager_idx ON public.arrears_schedule(manager_id);

-- ── 8. Helper: compute tenant running balance ───────────────
CREATE OR REPLACE FUNCTION public.get_tenant_balance(p_tenant_id uuid)
RETURNS TABLE (
  total_invoiced   numeric,
  total_paid       numeric,
  total_penalties  numeric,
  credit_balance   numeric,
  balance_due      numeric,
  is_in_arrears    boolean
) LANGUAGE sql STABLE AS $$
  WITH
  invoiced AS (
    SELECT COALESCE(SUM(COALESCE(original_amount, amount)), 0) AS v
    FROM public.invoices
    WHERE tenant_id = p_tenant_id
      AND status NOT IN ('cancelled')
  ),
  paid AS (
    SELECT COALESCE(SUM(paid_amount), 0) AS v
    FROM public.invoices
    WHERE tenant_id = p_tenant_id
  ),
  penalties AS (
    SELECT COALESCE(SUM(penalty_amount), 0) AS v
    FROM public.invoices
    WHERE tenant_id = p_tenant_id
  ),
  credit AS (
    SELECT COALESCE(
      SUM(CASE WHEN entry_type = 'credit' THEN amount
               WHEN entry_type IN ('debit', 'refund') THEN -amount
          END), 0
    ) AS v
    FROM public.tenant_credit_ledger
    WHERE tenant_id = p_tenant_id
  )
  SELECT
    invoiced.v,
    paid.v,
    penalties.v,
    credit.v,
    GREATEST(0, invoiced.v - paid.v + penalties.v - credit.v),
    (invoiced.v - paid.v + penalties.v - credit.v) > 0
  FROM invoiced, paid, penalties, credit;
$$;

-- ── 9. RLS policies ─────────────────────────────────────────
ALTER TABLE public.payment_allocations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_credit_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrears_schedule         ENABLE ROW LEVEL SECURITY;

-- payment_allocations: tenant sees own; manager sees theirs
DROP POLICY IF EXISTS "tenant_sees_own_allocations" ON public.payment_allocations;
CREATE POLICY "tenant_sees_own_allocations"
  ON public.payment_allocations FOR SELECT USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "manager_manages_allocations" ON public.payment_allocations;
CREATE POLICY "manager_manages_allocations"
  ON public.payment_allocations FOR ALL USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

-- credit_ledger: tenant sees own; manager sees theirs
DROP POLICY IF EXISTS "tenant_sees_own_credit" ON public.tenant_credit_ledger;
CREATE POLICY "tenant_sees_own_credit"
  ON public.tenant_credit_ledger FOR SELECT USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "manager_manages_credit" ON public.tenant_credit_ledger;
CREATE POLICY "manager_manages_credit"
  ON public.tenant_credit_ledger FOR ALL USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

-- bank settings: manager only
DROP POLICY IF EXISTS "manager_manages_bank_settings" ON public.bank_integration_settings;
CREATE POLICY "manager_manages_bank_settings"
  ON public.bank_integration_settings FOR ALL USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

-- bank_transactions: manager only
DROP POLICY IF EXISTS "manager_manages_bank_transactions" ON public.bank_transactions;
CREATE POLICY "manager_manages_bank_transactions"
  ON public.bank_transactions FOR ALL USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

-- arrears_schedule: tenant reads; manager manages
DROP POLICY IF EXISTS "tenant_reads_own_arrears" ON public.arrears_schedule;
CREATE POLICY "tenant_reads_own_arrears"
  ON public.arrears_schedule FOR SELECT USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "manager_manages_arrears" ON public.arrears_schedule;
CREATE POLICY "manager_manages_arrears"
  ON public.arrears_schedule FOR ALL USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

-- updated_at triggers
DROP TRIGGER IF EXISTS bank_integration_updated_at ON public.bank_integration_settings;
CREATE TRIGGER bank_integration_updated_at
  BEFORE UPDATE ON public.bank_integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS arrears_schedule_updated_at ON public.arrears_schedule;
CREATE TRIGGER arrears_schedule_updated_at
  BEFORE UPDATE ON public.arrears_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

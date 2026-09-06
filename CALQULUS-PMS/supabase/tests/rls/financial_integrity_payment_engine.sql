-- Phase 4: Financial integrity — payment engine behavioral tests
-- Run against local replay DB:
--   docker cp supabase/tests/rls/financial_integrity_payment_engine.sql calqulus-pg:/tmp/ && \
--   docker exec -e PGPASSWORD=postgres calqulus-pg psql -U supabase_admin -d postgres -f /tmp/financial_integrity_payment_engine.sql
-- Requires: bash supabase/tests/harness/replay-migrations.sh completed first.
--
-- Simulates service_role (edge function caller) and asserts the atomic
-- payment engine's financial invariants against the REAL schema + RPCs.

BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

-- Seed: manager, property, unit, tenant (NO auth.users row — the FK bug case)
INSERT INTO auth.users (id, email) VALUES ('a1a1a1a1-1111-1111-1111-111111111111','mgrA@test.dev');
INSERT INTO public.properties (id, manager_id, name, address) VALUES
  ('c1c1c1c1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','PropA','1 A Way');
INSERT INTO public.units (id, property_id, unit_number, status) VALUES
  ('d1d1d1d1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','A1','occupied');
INSERT INTO public.tenants (id, manager_id, property_id, unit_id, name, email, status) VALUES
  ('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','c1c1c1c1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','Tenant A','tenantA@test.dev','active');
INSERT INTO public.invoices (id, manager_id, tenant_id, unit_id, invoice_number, amount, paid_amount, balance_due, due_date, status) VALUES
  ('f1f1f1f1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111','e1e1e1e1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','INV-001',10000,0,10000,'2026-09-01','pending'),
  ('f2f2f2f2-2222-2222-2222-222222222222','a1a1a1a1-1111-1111-1111-111111111111','e1e1e1e1-1111-1111-1111-111111111111','d1d1d1d1-1111-1111-1111-111111111111','INV-002',8000,0,8000,'2026-10-01','pending');

-- T1: full payment closes invoice
SELECT public.process_payment_atomic('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111',10000,'mpesa','2026-08-22'::date,'REF-FULL-001','f1f1f1f1-1111-1111-1111-111111111111') AS t1_full;
SELECT 'T1 closes' AS check, (status='paid' AND balance_due=0 AND paid_date IS NOT NULL) AS pass FROM public.invoices WHERE id='f1f1f1f1-1111-1111-1111-111111111111';

-- T2: idempotent replay does not double-process
SELECT (public.process_payment_atomic('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111',10000,'mpesa','2026-08-22'::date,'REF-FULL-001','f1f1f1f1-1111-1111-1111-111111111111'))->>'idempotent' AS t2_idempotent;
SELECT 'T2 single tx' AS check, (count(*)=1) AS pass FROM public.payment_transactions WHERE bank_reference='REF-FULL-001';

-- T3: partial payment leaves balance, marks partially_paid
SELECT public.process_payment_atomic('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111',3000,'mpesa','2026-08-22'::date,'REF-PART-001','f2f2f2f2-2222-2222-2222-222222222222') AS t3_partial;
SELECT 'T3 partial' AS check, (status='partially_paid' AND paid_amount=3000 AND balance_due=5000) AS pass FROM public.invoices WHERE id='f2f2f2f2-2222-2222-2222-222222222222';

-- T4: overpayment closes invoice + banks excess as tenant credit
SELECT public.process_payment_atomic('e1e1e1e1-1111-1111-1111-111111111111','a1a1a1a1-1111-1111-1111-111111111111',9000,'mpesa','2026-08-22'::date,'REF-OVER-001','f2f2f2f2-2222-2222-2222-222222222222') AS t4_over;
SELECT 'T4 overpay closes' AS check, (status='paid' AND balance_due=0) AS pass FROM public.invoices WHERE id='f2f2f2f2-2222-2222-2222-222222222222';
SELECT 'T4 credit banked' AS check, (amount=4000) AS pass FROM public.tenant_credit_ledger WHERE tenant_id='e1e1e1e1-1111-1111-1111-111111111111';

-- T5: CONSERVATION — allocations ledger reconciles invoices
-- sum(payment_allocations) must equal sum(invoices.paid_amount)
SELECT 'T5 allocations reconcile' AS check,
  (SELECT coalesce(sum(allocated_amount),0) FROM public.payment_allocations WHERE tenant_id='e1e1e1e1-1111-1111-1111-111111111111')
  = (SELECT sum(paid_amount) FROM public.invoices WHERE tenant_id='e1e1e1e1-1111-1111-1111-111111111111') AS pass;

-- T6: CONSERVATION — money in = money allocated + money credited
-- sum(payment_transactions.amount) = sum(allocations) + sum(credit_ledger)
SELECT 'T6 money conserved' AS check,
  (SELECT sum(amount) FROM public.payment_transactions WHERE tenant_id='e1e1e1e1-1111-1111-1111-111111111111' AND status='completed')
  = (SELECT coalesce(sum(allocated_amount),0) FROM public.payment_allocations WHERE tenant_id='e1e1e1e1-1111-1111-1111-111111111111')
    + (SELECT coalesce(sum(amount),0) FROM public.tenant_credit_ledger WHERE tenant_id='e1e1e1e1-1111-1111-1111-111111111111') AS pass;

-- T7: audit trigger fired without aborting payment (the FK bug fix)
SELECT 'T7 audit logged' AS check, (count(*) >= 1) AS pass FROM public.security_audit_log
  WHERE resource_type='payment_transaction' AND event_type='payment_processed';

ROLLBACK;

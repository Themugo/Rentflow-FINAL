-- ============================================================================
-- Migration: Validate positive-amount CHECK constraints
--
-- Run this after auditing existing data with:
--   SELECT id, amount FROM public.invoices WHERE amount <= 0;
--   SELECT id, amount FROM public.manager_invoices WHERE amount <= 0;
--   (etc. for each table below)
--
-- Once existing data is clean (or zero-amount rows corrected/deleted),
-- run this migration to activate the constraints on existing rows too.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_amount_positive;
    RAISE NOTICE 'Validated: invoices_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manager_invoices_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.manager_invoices VALIDATE CONSTRAINT manager_invoices_amount_positive;
    RAISE NOTICE 'Validated: manager_invoices_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenditures_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.expenditures VALIDATE CONSTRAINT expenditures_amount_positive;
    RAISE NOTICE 'Validated: expenditures_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_receipts_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.payment_receipts VALIDATE CONSTRAINT payment_receipts_amount_positive;
    RAISE NOTICE 'Validated: payment_receipts_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manager_subscriptions_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.manager_subscriptions VALIDATE CONSTRAINT manager_subscriptions_amount_positive;
    RAISE NOTICE 'Validated: manager_subscriptions_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_amenity_charges_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.property_amenity_charges VALIDATE CONSTRAINT property_amenity_charges_amount_positive;
    RAISE NOTICE 'Validated: property_amenity_charges_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_deductions_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.property_deductions VALIDATE CONSTRAINT property_deductions_amount_positive;
    RAISE NOTICE 'Validated: property_deductions_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposit_deductions_amount_positive' AND NOT convalidated) THEN
    ALTER TABLE public.deposit_deductions VALIDATE CONSTRAINT deposit_deductions_amount_positive;
    RAISE NOTICE 'Validated: deposit_deductions_amount_positive';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposit_refunds_refund_amount_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.deposit_refunds VALIDATE CONSTRAINT deposit_refunds_refund_amount_nonneg;
    RAISE NOTICE 'Validated: deposit_refunds_refund_amount_nonneg';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposit_refunds_total_deductions_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.deposit_refunds VALIDATE CONSTRAINT deposit_refunds_total_deductions_nonneg;
    RAISE NOTICE 'Validated: deposit_refunds_total_deductions_nonneg';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_deposit_amount_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.tenants VALIDATE CONSTRAINT tenants_deposit_amount_nonneg;
    RAISE NOTICE 'Validated: tenants_deposit_amount_nonneg';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_deposit_balance_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.tenants VALIDATE CONSTRAINT tenants_deposit_balance_nonneg;
    RAISE NOTICE 'Validated: tenants_deposit_balance_nonneg';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_deposit_deduction_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.maintenance_requests VALIDATE CONSTRAINT maintenance_requests_deposit_deduction_nonneg;
    RAISE NOTICE 'Validated: maintenance_requests_deposit_deduction_nonneg';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'water_billing_config_flat_rate_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.water_billing_config VALIDATE CONSTRAINT water_billing_config_flat_rate_nonneg;
    RAISE NOTICE 'Validated: water_billing_config_flat_rate_nonneg';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'water_meter_readings_total_amount_nonneg' AND NOT convalidated) THEN
    ALTER TABLE public.water_meter_readings VALIDATE CONSTRAINT water_meter_readings_total_amount_nonneg;
    RAISE NOTICE 'Validated: water_meter_readings_total_amount_nonneg';
  END IF;
END $$;

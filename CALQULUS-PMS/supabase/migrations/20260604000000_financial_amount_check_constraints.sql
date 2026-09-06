
-- Migration: Enforce positive-amount CHECK constraints on financial tables
--
-- The financial-integrity test suite (src/test/financial-integrity/*) mirrors
-- these constraints in its mock database and warns when the real schema is
-- missing them. payment_transactions, payment_allocations, and several other
-- tables introduced after the base schema already enforce `amount > 0`, but
-- a number of monetary columns from the original base schema (most notably
-- invoices.amount) do not. This migration closes that gap.
--
-- Constraints are added with NOT VALID so existing rows are not checked at
-- migration time (avoiding a hard failure if legacy/seed data contains
-- zero or negative amounts). Run VALIDATE CONSTRAINT for each one after
-- auditing/cleaning existing data:
--
--   ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_amount_positive;
--


DO $$
BEGIN
  -- invoices.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_amount_positive'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- manager_invoices.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manager_invoices_amount_positive'
  ) THEN
    ALTER TABLE public.manager_invoices
      ADD CONSTRAINT manager_invoices_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- expenditures.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenditures_amount_positive'
  ) THEN
    ALTER TABLE public.expenditures
      ADD CONSTRAINT expenditures_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- payment_receipts.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_receipts_amount_positive'
  ) THEN
    ALTER TABLE public.payment_receipts
      ADD CONSTRAINT payment_receipts_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- manager_subscriptions.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manager_subscriptions_amount_positive'
  ) THEN
    ALTER TABLE public.manager_subscriptions
      ADD CONSTRAINT manager_subscriptions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- property_amenity_charges.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_amenity_charges_amount_positive'
  ) THEN
    ALTER TABLE public.property_amenity_charges
      ADD CONSTRAINT property_amenity_charges_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- property_deductions.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_deductions_amount_positive'
  ) THEN
    ALTER TABLE public.property_deductions
      ADD CONSTRAINT property_deductions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- deposit_deductions.amount must be a positive monetary value
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deposit_deductions_amount_positive'
  ) THEN
    ALTER TABLE public.deposit_deductions
      ADD CONSTRAINT deposit_deductions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- deposit_refunds.refund_amount must not be negative (zero is valid: fully forfeited)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deposit_refunds_refund_amount_nonneg'
  ) THEN
    ALTER TABLE public.deposit_refunds
      ADD CONSTRAINT deposit_refunds_refund_amount_nonneg CHECK (refund_amount >= 0) NOT VALID;
  END IF;

  -- deposit_refunds.total_deductions must not be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deposit_refunds_total_deductions_nonneg'
  ) THEN
    ALTER TABLE public.deposit_refunds
      ADD CONSTRAINT deposit_refunds_total_deductions_nonneg CHECK (total_deductions >= 0) NOT VALID;
  END IF;

  -- tenants.deposit_amount must not be negative (NULL allowed = no deposit on record)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_deposit_amount_nonneg'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_deposit_amount_nonneg CHECK (deposit_amount IS NULL OR deposit_amount >= 0) NOT VALID;
  END IF;

  -- tenants.deposit_balance must not be negative (NULL allowed = not yet tracked)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_deposit_balance_nonneg'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_deposit_balance_nonneg CHECK (deposit_balance IS NULL OR deposit_balance >= 0) NOT VALID;
  END IF;

  -- maintenance_requests.deposit_deduction_amount must not be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_deposit_deduction_nonneg'
  ) THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_deposit_deduction_nonneg CHECK (deposit_deduction_amount IS NULL OR deposit_deduction_amount >= 0) NOT VALID;
  END IF;

  -- water_billing_config.flat_rate_amount must not be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'water_billing_config_flat_rate_nonneg'
  ) THEN
    ALTER TABLE public.water_billing_config
      ADD CONSTRAINT water_billing_config_flat_rate_nonneg CHECK (flat_rate_amount IS NULL OR flat_rate_amount >= 0) NOT VALID;
  END IF;

  -- water_meter_readings.total_amount must not be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'water_meter_readings_total_amount_nonneg'
  ) THEN
    ALTER TABLE public.water_meter_readings
      ADD CONSTRAINT water_meter_readings_total_amount_nonneg CHECK (total_amount IS NULL OR total_amount >= 0) NOT VALID;
  END IF;
END $$;


-- Foreign key hardening: ensure invoices.property_id / unit_id / tenant_id
-- relations used by payment_transactions(*, invoices(*)) joins in the
-- reconciliation flows resolve correctly (ON DELETE behaviour audit).
-- These FKs already exist (added in base schema); this section only adds
-- the supporting index used by the reconciliation query pattern
-- `payment_transactions.select('*, invoices(*)')`.

CREATE INDEX IF NOT EXISTS payment_transactions_invoice_id_idx
  ON public.payment_transactions (invoice_id);

CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx
  ON public.invoices (tenant_id);

CREATE INDEX IF NOT EXISTS invoices_property_id_idx
  ON public.invoices (property_id);

CREATE INDEX IF NOT EXISTS invoices_unit_id_idx
  ON public.invoices (unit_id);

COMMENT ON CONSTRAINT invoices_amount_positive ON public.invoices IS
  'Invoice amounts must be positive. Added NOT VALID — validate after auditing legacy rows.';

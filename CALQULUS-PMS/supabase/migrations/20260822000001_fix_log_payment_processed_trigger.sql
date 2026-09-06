-- ============================================================
-- Phase 4: Financial integrity — harden log_payment_processed trigger
--
-- Defect: the trigger inserted NEW.tenant_id into security_audit_log.user_id,
-- but user_id has a FK to auth.users(id) ON DELETE SET NULL. tenants.id is NOT
-- an auth.users id, so every completed payment for a tenant without a linked
-- auth.users row (e.g. manager-onboarded tenant who never signed up) raised
-- an FK violation and rolled back the ENTIRE payment — inside
-- process_payment_atomic, breaking payments in production.
--
-- Fixes:
--   1. user_id := auth.uid() (the actor) — never tenant_id; tenant_id moved
--      into details (manager_id already there).
--   2. Audit logging is wrapped in an EXCEPTION block so a logging failure
--      can never roll back the financial transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_payment_processed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    BEGIN
      INSERT INTO public.security_audit_log (
        user_id, event_type, resource_type, resource_id,
        details, severity
      ) VALUES (
        auth.uid(), 'payment_processed', 'payment_transaction', NEW.id,
        jsonb_build_object(
          'tenant_id',      NEW.tenant_id,
          'amount',         NEW.amount,
          'method',         NEW.payment_method,
          'reference',      NEW.bank_reference,
          'manager_id',     NEW.manager_id,
          'completed_at',   NEW.completed_at
        ),
        'info'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Audit failure must never abort the payment
      RAISE WARNING 'log_payment_processed audit insert failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

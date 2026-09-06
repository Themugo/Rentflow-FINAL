-- Phase 88: privileged execution boundary hardening.
-- Public/anon callers must not be able to execute internal mutation helpers.
-- Token validation helpers remain intentionally public because activation and
-- invitation links are bearer-token workflows; mutation helpers do not.

REVOKE ALL ON FUNCTION public.log_payment_processed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_processed() TO service_role;

REVOKE ALL ON FUNCTION public.auto_generate_platform_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_generate_platform_invoices() TO service_role;
REVOKE ALL ON FUNCTION public.escalate_overdue_manager_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_manager_invoices() TO service_role;
REVOKE ALL ON FUNCTION public.reinstate_manager_on_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reinstate_manager_on_payment() TO service_role;

REVOKE ALL ON FUNCTION public.refresh_manager_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_manager_stats() TO service_role;
REVOKE ALL ON FUNCTION public.sync_property_occupied_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_property_occupied_count() TO service_role;
REVOKE ALL ON FUNCTION public.sync_unit_on_tenant_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_unit_on_tenant_change() TO service_role;

REVOKE ALL ON FUNCTION public.update_provider_rating() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_provider_rating() TO service_role;
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.set_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_invoice_number() TO service_role;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- Sensitive payment/account helpers must never be callable by anonymous users.
REVOKE ALL ON FUNCTION public.process_payment_atomic(uuid, uuid, numeric, text, date, text, uuid, uuid[], uuid, uuid, text, text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.process_invoice_payment(uuid, uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.reconcile_bank_transaction_atomic(uuid, uuid, uuid, uuid) FROM anon;

-- Token validation is read-only bearer-token functionality; token consumption
-- remains callable only by the activation flow, not by arbitrary anonymous RPC.
REVOKE ALL ON FUNCTION public.use_activation_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_activation_token(text) TO service_role;

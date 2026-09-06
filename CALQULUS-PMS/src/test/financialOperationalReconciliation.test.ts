import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("financial & operational reconciliation command center", () => {
  const root = process.cwd();
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260904000035_financial_operational_reconciliation_command_center.sql"), "utf8");
  const component = fs.readFileSync(path.join(root, "src/features/dashboard/components/FinancialOperationalReconciliationCenter.tsx"), "utf8");

  it("defines one canonical cross-domain case model", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.reconciliation_cases");
    expect(migration).toContain("lease_invoice_gap");
    expect(migration).toContain("invoice_payment_gap");
    expect(migration).toContain("payment_allocation_gap");
    expect(migration).toContain("bank_match_gap");
    expect(migration).toContain("payout_settlement_gap");
    expect(migration).toContain("close_readiness_gap");
    expect(migration).toContain("evidence_gap");
  });

  it("converges reconciliation cases into the existing work queue", () => {
    expect(migration).toContain("'reconciliation_case'");
    expect(migration).toContain("operation_work_items");
    expect(migration).toContain("transition_reconciliation_case_atomic");
  });

  it("enforces manager-scoped RPC access", () => {
    // Scope is enforced inline (self or delegated submanager) rather than via
    // the shared can_manage_property_scope() helper, and fails closed.
    expect(migration).toContain("EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid)");
    expect(migration).toContain("RAISE EXCEPTION 'Reconciliation scope unauthorized' USING ERRCODE='42501'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_manager_reconciliation_command_center");
    expect(migration).toContain("TO authenticated,service_role");
  });

  it("keeps the UI data-driven and exposes scan/filter/resolution controls", () => {
    expect(component).toContain("get_manager_reconciliation_command_center");
    expect(component).toContain("sync_manager_reconciliation_command_center");
    expect(component).toContain("transition_reconciliation_case_atomic");
    expect(component).toContain("Run reconciliation scan");
    expect(component).toContain("Resolve");
  });
});

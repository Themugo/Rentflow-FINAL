import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("financial close control center", () => {
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260904000031_financial_close_owner_statement_integrity.sql"), "utf8");
  const component = readFileSync(resolve(process.cwd(), "src/features/dashboard/components/FinancialCloseControlCenter.tsx"), "utf8");

  it("creates an auditable close period and audit trail", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.financial_close_periods");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.financial_close_audit");
    expect(migration).toContain("INSERT INTO public.financial_close_audit");
  });

  it("fails closed when unresolved reconciliation checks exist", () => {
    expect(migration).toContain("ready_to_close");
    expect(migration).toContain("unresolved close checks");
    expect(migration).toContain("status IN ('pending','processing')");
  });

  it("uses authoritative RPCs and does not fabricate financial totals", () => {
    expect(component).toContain("get_manager_financial_close");
    expect(component).toContain("close_manager_financial_period_atomic");
    expect(component).not.toMatch(/162M|5% escalation|zero vacancy/i);
  });
});

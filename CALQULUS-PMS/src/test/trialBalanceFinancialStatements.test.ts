import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("trial balance and financial statements initiative", () => {
  const root = path.resolve(process.cwd());
  it("ships the canonical reporting migration", () => {
    const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260904000041_trial_balance_general_ledger_financial_statements.sql"), "utf8");
    expect(migration).toContain("get_manager_trial_balance");
    expect(migration).toContain("get_manager_general_ledger");
    expect(migration).toContain("get_manager_financial_statements");
    expect(migration).toContain("ledger_journal_entries");
    expect(migration).not.toContain("INSERT INTO public.financial_ledger");
  });
  it("keeps the reporting surface attached to the dashboard", () => {
    const dashboard = fs.readFileSync(path.join(root, "src/features/dashboard/pages/Dashboard.tsx"), "utf8");
    expect(dashboard).toContain("TrialBalanceFinancialStatementsCenter");
  });
});

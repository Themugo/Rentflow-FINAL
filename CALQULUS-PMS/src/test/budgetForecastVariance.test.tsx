import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("budget forecast variance control", () => {
  it("uses planning tables and existing financial truth", () => {
    const migration=fs.readFileSync("supabase/migrations/20260904000042_budget_forecast_variance_control.sql","utf8");
    const component=fs.readFileSync("src/features/dashboard/components/BudgetForecastVarianceCenter.tsx","utf8");
    expect(migration).toContain("management_budgets");
    expect(migration).toContain("management_budget_lines");
    expect(migration).toContain("public.invoices");
    expect(migration).toContain("public.expenditures");
    expect(migration).toContain("can_manage_property_scope");
    expect(component).toContain("get_manager_budget_variance_control");
    expect(component).toContain("Create budget");
  });
});

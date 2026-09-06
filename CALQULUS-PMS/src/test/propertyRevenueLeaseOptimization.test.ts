import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("property revenue and lease optimization", () => {
  it("uses the authoritative optimization RPC and explainable signals", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260904000025_property_revenue_lease_optimization.sql"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "src/features/dashboard/components/PropertyRevenueLeaseOptimization.tsx"), "utf8");
    expect(migration).toContain("get_manager_property_revenue_lease_optimization");
    expect(migration).toContain("under_rent_monthly_gap");
    expect(migration).toContain("leases_expiring_90d");
    expect(migration).toContain("vacancy_monthly_opportunity");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(component).toContain("get_manager_property_revenue_lease_optimization");
    expect(component).toContain("No speculative market pricing");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("revenue leakage intelligence", () => {
  const root = resolve(process.cwd());
  it("defines a scoped receivables intelligence RPC", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000022_revenue_leakage_receivables_intelligence.sql"), "utf8");
    expect(sql).toContain("get_manager_revenue_leakage_intelligence");
    expect(sql).toContain("unallocated_completed_payments");
    expect(sql).toContain("persistent_60d_arrears");
    expect(sql).toContain("property_leakage");
    expect(sql).toContain("SET search_path=''");
    expect(sql).toContain("manager_submanagers");
  });
  it("renders the canonical RPC in the dashboard", () => {
    const source = readFileSync(resolve(root, "src/features/dashboard/components/RevenueLeakageIntelligence.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("get_manager_revenue_leakage_intelligence"');
    expect(source).toContain("Priority receivables");
    expect(source).toContain("Recovery priorities");
  });
});

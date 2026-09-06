import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("Phase 10 invoice atomicity", () => {
  it("routes manual invoice creation through the edge function", () => {
    expect(read("src/features/billing/pages/Billing.tsx")).toContain('functions.invoke("create-invoice"');
    expect(read("src/features/properties/components/PropertyBillingTab.tsx")).toContain('functions.invoke("create-invoice"');
    expect(read("src/features/billing/pages/Billing.tsx")).not.toMatch(/from\(["']invoices["']\)[\s\S]{0,300}\.insert\(/);
    expect(read("src/features/properties/components/PropertyBillingTab.tsx")).not.toMatch(/from\(["']invoices["']\)[\s\S]{0,300}\.insert\(/);
  });
  it("uses one service-only atomic RPC", () => {
    const sql = read("supabase/migrations/20260902000004_atomic_invoice_creation_v2.sql");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("auth.role() <> 'service_role'");
    expect(sql).toContain("ON CONFLICT (generation_key)");
    expect(read("supabase/functions/apply-penalties/index.ts")).toContain('rpc("create_invoice_atomic_v2"');
  });
});

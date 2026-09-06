import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Tenant lifecycle command bar", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/tenants/components/TenantLifecycleCommandBar.tsx"), "utf8");

  it("keeps tenant, lease, unit and balance in one operational surface", () => {
    expect(source).toContain("Tenancy lifecycle");
    expect(source).toContain("lease?.end_date");
    expect(source).toContain("tenant.property");
    expect(source).toContain("balance");
  });

  it("does not introduce a second lifecycle mutation engine", () => {
    expect(source).not.toContain("supabase");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain("rpc(");
  });
});

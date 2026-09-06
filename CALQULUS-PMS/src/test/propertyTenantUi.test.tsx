import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("property and tenant UI hierarchy", () => {
  it("keeps the property workspace hierarchy and golden path", () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), "src/features/properties/pages/PropertyDetail.tsx"), "utf8");
    expect(file).toContain('title="Manage this property"');
    expect(file).toContain('const GOLDEN_PATH');
    expect(file).toContain('value="units"');
    expect(file).toContain('value="billing"');
  });

  it("keeps tenant portfolio metrics grounded in live tenant data", () => {
    const file = fs.readFileSync(path.resolve(process.cwd(), "src/features/tenants/pages/Tenants.tsx"), "utf8");
    expect(file).toContain('title="Tenant portfolio"');
    expect(file).toContain('activeRentTotal');
    expect(file).toContain('outstandingTotal');
    expect(file).toContain('pendingTenants.length');
  });
});

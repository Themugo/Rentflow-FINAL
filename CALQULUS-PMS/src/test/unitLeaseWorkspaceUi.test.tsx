import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("unit and lease workspace UI", () => {
  it("keeps unit detail workflow anchored to live portfolio rows", () => {
    const units = readFileSync("src/features/units/pages/Units.tsx", "utf8");
    expect(units).toContain("selectedUnit");
    expect(units).toContain("/properties/${selectedUnit.propertyId}?tab=units");
    expect(units).toContain("Tenant management");
    expect(units).toContain("Lease management");
  });

  it("uses shared hierarchy for lease management", () => {
    const leases = readFileSync("src/features/leases/pages/Leases.tsx", "utf8");
    expect(leases).toContain("DashboardSectionHeader");
    expect(leases).toContain("Operations / Lease management");
    expect(leases).toContain("Agreements at a glance");
  });
});

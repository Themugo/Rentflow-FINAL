import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("visual consistency phase 6", () => {
  const root = resolve(process.cwd(), "src");

  it("provides one shared metric surface", () => {
    const source = readFileSync(resolve(root, "shared/components/ui/metric-card.tsx"), "utf8");
    expect(source).toContain("export function MetricCard");
    expect(source).toContain("border border-border bg-card");
  });

  it("uses the shared metric surface in portfolio summaries", () => {
    for (const file of [
      "features/properties/pages/Properties.tsx",
      "features/units/pages/Units.tsx",
      "features/landlord/pages/LandlordPortfolio.tsx",
    ]) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).toContain("MetricCard");
    }
  });
});

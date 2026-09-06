import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("phases 168-169 search and filter UX", () => {
  it("defines one shared search/filter surface with clear-search and clear-filter semantics", () => {
    const source = read("shared/components/ui/search-filter-bar.tsx");
    expect(source).toContain("SearchFilterBar");
    expect(source).toContain("Clear filters");
    expect(source).toContain("aria-live");
    expect(source).toContain("aria-label={`Clear");
  });

  it("uses the shared toolbar across core portfolio workflows", () => {
    for (const file of [
      "features/properties/pages/Properties.tsx",
      "features/units/pages/Units.tsx",
      "features/tenants/pages/Tenants.tsx",
      "features/maintenance/pages/Maintenance.tsx",
    ]) {
      expect(read(file)).toContain("SearchFilterBar");
    }
  });

  it("keeps filter state explicit and does not replace the existing data workflows", () => {
    expect(read("features/properties/pages/Properties.tsx")).toContain("setFilterOccupancy");
    expect(read("features/units/pages/Units.tsx")).toContain("setStatusFilter");
    expect(read("features/tenants/pages/Tenants.tsx")).toContain("setPropertyFilter");
    expect(read("features/maintenance/pages/Maintenance.tsx")).toContain("setCategoryFilter");
  });
});

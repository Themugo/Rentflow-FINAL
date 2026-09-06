import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phases 158-159 forms and tables UI", () => {
  const root = resolve(process.cwd(), "src");
  it("provides reusable form and table presentation primitives", () => {
    expect(readFileSync(resolve(root, "shared/components/ui/form-section.tsx"), "utf8")).toContain("export function FormSection");
    expect(readFileSync(resolve(root, "shared/components/ui/data-table-frame.tsx"), "utf8")).toContain("export function DataTableFrame");
  });
  it("keeps property creation validation and required identity fields", () => {
    const source = readFileSync(resolve(root, "features/properties/pages/Properties.tsx"), "utf8");
    expect(source).toContain("propertySchema.safeParse(newProperty)");
    expect(source).toContain('required autoComplete="organization"');
    expect(source).toContain('required autoComplete="street-address"');
  });
  it("uses the shared table frame without changing invoice pagination", () => {
    const source = readFileSync(resolve(root, "features/billing/components/InvoiceTable.tsx"), "utf8");
    expect(source).toContain("DataTableFrame");
    expect(source).toContain("TablePager");
    expect(source).toContain("paginate(sorted, page, PAGE_SIZE)");
  });
});

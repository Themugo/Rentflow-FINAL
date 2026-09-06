import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("phases 164-165 mobile workflow hardening", () => {
  it("provides a shared mobile table overflow cue", () => {
    const source = read("shared/components/ui/data-table-frame.tsx");
    expect(source).toContain("Swipe horizontally to view all columns.");
    expect(source).toContain("overscroll-x-contain");
  });

  it("keeps major portfolio tables horizontally usable", () => {
    expect(read("features/properties/pages/Properties.tsx")).toContain("<DataTableFrame minWidth=\"min-w-[760px]\">");
    expect(read("features/units/pages/Units.tsx")).toContain("<DataTableFrame minWidth=\"min-w-[760px]\">");
    expect(read("features/tenants/pages/Tenants.tsx")).toContain("<DataTableFrame minWidth=\"min-w-[780px]\">");
  });

  it("stacks high-value filters and forms on narrow screens", () => {
    expect(read("features/tenants/pages/Tenants.tsx")).toContain("w-full sm:w-56");
    expect(read("features/properties/pages/Properties.tsx")).toContain("grid grid-cols-1 sm:grid-cols-2 gap-4");
    expect(read("features/billing/components/TenantInvoiceForm.tsx")).toContain("grid grid-cols-1 sm:grid-cols-2 gap-4");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("landlord and tenant portal UI structure", () => {
  it("uses shared hierarchy in the landlord portfolio", () => {
    const source = read("src/features/landlord/pages/LandlordPortfolio.tsx");
    expect(source).toContain("DashboardSectionHeader");
    expect(source).toContain('title="The numbers that matter"');
    expect(source).toContain('title="Your properties"');
  });

  it("keeps tenant home focused on rent, operations and notices", () => {
    const source = read("src/features/tenant-portal/components/TenantHome.tsx");
    expect(source).toContain("Home, bills and requests in one place");
    expect(source).toContain('>View all</Link>');
    expect(source).toContain('TENANT_OPS_ROUTES.inbox');
    expect(source).toContain('aria-label="Common tasks"');
  });
});

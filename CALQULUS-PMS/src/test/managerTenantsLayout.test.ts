import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("Manager tenants, tenant detail, and leases layout contracts", () => {
  it("keeps Tenants as a searchable table with invite and live columns", () => {
    const tenants = src("src/features/tenants/pages/Tenants.tsx");
    expect(tenants).toContain('title="Tenants"');
    expect(tenants).toContain("Invite tenant");
    expect(tenants).toContain("Add Tenant");
    expect(tenants).toContain("InviteTenantDialog");
    // Search now goes through the shared SearchFilterBar, which takes the
    // accessible name as an `ariaLabel` prop rather than a raw attribute.
    expect(tenants).toContain('ariaLabel="Search tenants"');
    expect(tenants).toContain('label="Tenant"');
    expect(tenants).toContain('label="Property / Unit"');
    expect(tenants).toContain("<TableHead>Lease</TableHead>");
    expect(tenants).toContain('label="Rent"');
    expect(tenants).toContain("<TableHead>Balance</TableHead>");
    expect(tenants).toContain('label="Status"');
    expect(tenants).toContain("onOpenDetail");
    expect(tenants).toContain("MoveOutDialog");
    expect(tenants).toContain("EmptyState");
    expect(tenants).toContain("LoadingState");
    expect(tenants).toContain("ErrorState");
    expect(tenants).toContain('.from("tenants")');
    expect(tenants).not.toMatch(/KES 1\.24M/);
  });

  it("keeps tenant detail as progressive sections without dropping existing records", () => {
    const tenants = src("src/features/tenants/pages/Tenants.tsx");
    expect(tenants).toContain('value="overview"');
    expect(tenants).toContain('value="lease"');
    expect(tenants).toContain('value="financial"');
    expect(tenants).toContain('value="payments"');
    expect(tenants).toContain('value="maintenance"');
    expect(tenants).toContain('value="documents"');
    expect(tenants).toContain('value="activity"');
    expect(tenants).toContain('value="payers"');
    expect(tenants).toContain('value="notices"');
    expect(tenants).toContain('value="portal"');
    expect(tenants).toContain("TenantProfilePanel");
    expect(tenants).toContain("View statement");
    expect(tenants).toContain("Move out");

    const profile = src("src/features/tenants/components/TenantProfilePanel.tsx");
    expect(profile).toContain('value="identity"');
    expect(profile).toContain('value="employment"');
    expect(profile).toContain('value="emergency"');
  });

  it("shows leases from live dates with create, confirmation, and inline validation", () => {
    const leases = src("src/features/leases/pages/Leases.tsx");
    expect(leases).toContain('title="Leases"');
    expect(leases).toContain("Create lease");
    expect(leases).toContain("handleCreateLease");
    expect(leases).toContain("leaseSchema.safeParse");
    expect(leases).toContain("FieldError");
    expect(leases).toContain("role=\"alert\"");
    expect(leases).toContain("<TableHead>Start date</TableHead>");
    expect(leases).toContain('label="Expiry"');
    expect(leases).toContain('label="Rent"');
    expect(leases).toContain('label="Status"');
    expect(leases).toContain("Expiring soon");
    expect(leases).toContain("Expired");
    expect(leases).toContain("computeExpiringSoonIds");
    expect(leases).toContain("isBulkDeleteDialogOpen");
    expect(leases).toContain("EmptyState");
    expect(leases).toContain("LoadingState");
    expect(leases).toContain("ErrorState");
    expect(leases).toContain('.from("leases")');
    expect(leases).not.toMatch(/KES 1\.24M/);
  });
});

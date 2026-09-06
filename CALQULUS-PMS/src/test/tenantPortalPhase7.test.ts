import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TENANT_ROUTES } from "@/features/tenant-portal/lib/tenantPaths";
import { roleRouteConfigs } from "@/app/routes";

const root = resolve(__dirname, "..");

function source(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("tenant service-portal nav (secondary only)", () => {
  // Nav labels for every portal (including the tenant's) now live in the
  // shared navigation module; TenantLayout wires the shared shell to them.
  const nav = source("shared/navigation/portalNavigation.ts");

  it("keeps the desk nav to the six service sections — no enterprise extras", () => {
    for (const label of ["Dashboard", "Payments", "Lease", "Maintenance", "Receipts", "Documents", "Profile"]) {
      expect(nav).toContain(`label: "${label}"`);
    }
    const tenantSection = nav.split("TENANT_NAV_GROUPS")[1]?.split("TENANT_MOBILE_NAV")[0] ?? "";
    expect(tenantSection).not.toContain("Reports");
    expect(tenantSection).not.toContain("Analytics");
    expect(tenantSection).not.toContain("Insights");
    expect(tenantSection).not.toContain("Charts");
  });

  it("mobile bottom nav is service-first (Home/Bills/Fix/Docs/Me)", () => {
    for (const label of ['"Home"', '"Bills"', '"Fix"', '"Docs"', '"Me"']) {
      expect(nav).toContain(`label: ${label}`);
    }
  });
});

describe("tenant header", () => {
  const layout = source("features/tenant-portal/components/TenantLayout.tsx");
  const shell = source("shared/components/layout/PortalDeskShell.tsx");

  it("shows CALQULUS wordmark, notifications bell, and a profile shortcut", () => {
    // The wordmark and the profile-shortcut link render inside the shared
    // desk shell; TenantLayout wires the notification bell and the profile
    // route into it.
    expect(shell).toContain("BrandMark");
    expect(layout).toContain("TenantNotificationBell");
    expect(layout).toContain(`profileHref={TENANT_ROUTES.profile}`);
    expect(shell).toContain('aria-label="Profile"');
  });
});

describe("tenant home — service portal, not a dashboard", () => {
  const home = source("features/tenant-portal/components/TenantHome.tsx");

  it("answers where do I live / what do I owe / when is it due", () => {
    expect(home).toContain("Your home");
    expect(home).toContain("amountDue");
    expect(home).toContain("dueDate");
    expect(home).toMatch(/Due \{/);
  });

  it("PAY RENT is the visually dominant action, painted with the portal accent", () => {
    expect(home).toContain('"PAY RENT"');
    expect(home).toContain("bg-[var(--portal-accent)]");
    expect(home).toContain("w-full");
    expect(home).toContain("min-h-12");
  });

  it("stays within a readable single column on all widths", () => {
    expect(home).toContain("max-w-xl");
    expect(home).toContain("mx-auto");
  });

  it("has no charts, no KPI grids, no filters", () => {
    for (const banned of ["recharts", "Chart", "BarChart", "Filter", "stats", "grid-cols-3"]) {
      expect(home).not.toContain(banned);
    }
    // Shortcut row stays a compact 2-up strip on mobile, not a KPI wall.
    expect(home).toContain("grid-cols-2");
  });
});

describe("tenant maintenance — report an issue is primary", () => {
  const page = source("features/tenant-portal/pages/TenantMaintenance.tsx");

  it("leads with a full-width Report action before any list", () => {
    expect(page).toContain("Report a problem");
    expect(page.indexOf("Report a problem")).toBeLessThan(page.indexOf("Active Requests"));
    expect(page).toMatch(/className="min-h-12 w-full[^"]*"/);
  });

  it("list rows expose issue, unit, status, date, and updates", () => {
    for (const token of ["request.title", "unit_number", "statusBadgeClass(maintenanceStatusTone", "Submitted {formatDate", "Updated {formatDate"]) {
      expect(page).toContain(token);
    }
  });
});

describe("tenant payments — amount / due date / status / history / receipt", () => {
  const page = source("features/payments/pages/PaymentHistory.tsx");

  it("shows payment history with amount, date, status, and receipt", () => {
    for (const token of ["Payment History", "formatCurrency(payment.amount", "formatDate(payment.created)", "invoiceStatusLabel", "payment.receiptUrl"]) {
      expect(page).toContain(token);
    }
  });

  it("renders bills via TenantBillsHub (amount, due date, status)", () => {
    expect(page).toContain("TenantBillsHub");
  });
});

describe("tenant portal never leaks manager internals", () => {
  it("no Settings → Payments copy anywhere in tenant-visible surfaces", () => {
    for (const rel of [
      "features/tenant-portal/components/TenantBillsHub.tsx",
      "features/tenant-portal/components/TenantHome.tsx",
      "features/payments/pages/PaymentHistory.tsx",
    ]) {
      expect(source(rel)).not.toContain("Settings → Payments");
      expect(source(rel)).not.toContain("Manager keys");
    }
  });
});

describe("tenant routes stay service-only", () => {
  it("only exposes the six sections plus known service extras", () => {
    const config = roleRouteConfigs.find((entry) => entry.role === "tenant");
    const paths = (config?.routes ?? [])
      .map((route) => route.path)
      .filter((path) => path.startsWith("/portal"));
    for (const expected of Object.values(TENANT_ROUTES)) {
      expect(paths).toContain(expected);
    }
    expect(paths).not.toContain("/portal/reports");
    expect(paths).not.toContain("/portal/analytics");
  });
});

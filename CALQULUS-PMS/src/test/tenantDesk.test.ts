import { describe, expect, it } from "vitest";
import {
  TENANT_LOGIN,
  TENANT_ROUTES,
  isTenantDeskPath,
  isTenantPublicPath,
} from "@/features/tenant-portal/lib/tenantPaths";
import { amountOnInvoice } from "@/features/tenant-portal/lib/tenantInvoiceSelect";
import { pickRoleForPath } from "@/features/auth/lib/roleResolution";
import { roleRouteConfigs } from "@/app/routes";

describe("tenant desk paths", () => {
  it("treats named pages as the tenant desk", () => {
    expect(isTenantDeskPath(TENANT_ROUTES.dashboard)).toBe(true);
    expect(isTenantDeskPath(TENANT_ROUTES.payments)).toBe(true);
    expect(isTenantDeskPath(TENANT_ROUTES.lease)).toBe(true);
    expect(isTenantDeskPath(TENANT_ROUTES.maintenance)).toBe(true);
    expect(isTenantDeskPath(TENANT_ROUTES.receipts)).toBe(true);
    expect(isTenantDeskPath(TENANT_ROUTES.documents)).toBe(true);
    expect(isTenantDeskPath(TENANT_ROUTES.profile)).toBe(true);
  });

  it("does not treat login as the desk", () => {
    expect(isTenantPublicPath(TENANT_LOGIN)).toBe(true);
    expect(isTenantDeskPath(TENANT_LOGIN)).toBe(false);
    expect(isTenantDeskPath("/properties")).toBe(false);
  });
});

describe("tenant role routing", () => {
  const manager = { role: "manager" as const, tenant_id: null, approval_status: "approved" as const };
  const tenant = { role: "tenant" as const, tenant_id: "t1", approval_status: "approved" as const };

  it("keeps a dual-role user on tenant desk pages", () => {
    expect(pickRoleForPath([manager, tenant], TENANT_ROUTES.dashboard, "u1", false).role).toBe("tenant");
    expect(pickRoleForPath([manager, tenant], TENANT_ROUTES.receipts, "u1", false).role).toBe("tenant");
    expect(pickRoleForPath([manager, tenant], "/properties", "u1", false).role).toBe("manager");
  });

  it("registers every named tenant desk page", () => {
    const config = roleRouteConfigs.find((c) => c.role === "tenant");
    const paths = (config?.routes ?? []).map((r) => r.path);
    expect(paths).toEqual(expect.arrayContaining([
      TENANT_ROUTES.dashboard,
      TENANT_ROUTES.payments,
      TENANT_ROUTES.lease,
      TENANT_ROUTES.maintenance,
      TENANT_ROUTES.receipts,
      TENANT_ROUTES.documents,
      TENANT_ROUTES.profile,
      "/portal/lease",
    ]));
  });
});

describe("tenant rent due amount", () => {
  it("uses remaining balance when the invoice is partially paid", () => {
    expect(
      amountOnInvoice({
        id: "1",
        invoice_number: "INV-1",
        amount: 45000,
        due_date: "2026-09-05",
        paid_date: null,
        status: "partially_paid",
        balance_due: 15000,
      }),
    ).toBe(15000);
  });

  it("falls back to the invoice amount when no balance is stored", () => {
    expect(
      amountOnInvoice({
        id: "2",
        invoice_number: "INV-2",
        amount: 45000,
        due_date: "2026-09-05",
        paid_date: null,
        status: "pending",
      }),
    ).toBe(45000);
  });
});

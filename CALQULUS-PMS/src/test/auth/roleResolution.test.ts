import { describe, expect, it } from "vitest";
import { pickRoleForPath } from "@/features/auth/lib/roleResolution";
import { evaluateCanWrite, evaluateCanAccessProperty } from "@/features/auth/lib/permissions";

describe("pickRoleForPath", () => {
  const manager = {
    role: "manager" as const,
    tenant_id: null,
    approval_status: "approved" as const,
  };
  const landlord = {
    role: "landlord" as const,
    tenant_id: null,
    approval_status: "approved" as const,
  };

  it("selects landlord on landlord dashboard when the user has that role", () => {
    const picked = pickRoleForPath([manager, landlord], "/landlord/dashboard", "u1", false);
    expect(picked.role).toBe("landlord");
  });

  it("selects manager on /properties when assigned", () => {
    const picked = pickRoleForPath([manager, landlord], "/properties", "u1", false);
    expect(picked.role).toBe("manager");
  });

  it("does not invent a manager role when none is assigned", () => {
    const picked = pickRoleForPath([landlord], "/properties", "u1", false);
    expect(picked.role).toBe("landlord");
  });
});

describe("evaluateCanWrite", () => {
  it("allows managers", () => {
    expect(evaluateCanWrite(true, false, null, "can_edit_tenants")).toBe(true);
  });

  it("denies submanagers without the flag", () => {
    expect(
      evaluateCanWrite(false, true, {
        can_view_properties: true,
        can_view_tenants: true,
        can_view_leases: false,
        can_view_invoices: false,
        can_view_maintenance: true,
        can_view_contracts: false,
        can_view_activity_logs: false,
        restrict_to_assigned_properties: true,
        can_record_payments: false,
        can_edit_tenants: false,
        can_manage_maintenance: false,
        can_create_invoices: false,
        can_approve_moveouts: false,
        can_send_notices: false,
        can_upload_documents: true,
        assigned_property_ids: [],
        manager_id: "m1",
      }, "can_edit_tenants"),
    ).toBe(false);
  });
});

describe("evaluateCanAccessProperty", () => {
  it("allows managers all properties", () => {
    expect(
      evaluateCanAccessProperty("p1", {
        isManager: true,
        isLandlord: false,
        landlordPropertyIds: [],
        isSubmanager: false,
        submanagerPermissions: null,
      }),
    ).toBe(true);
  });

  it("allows a landlord only on linked property ids", () => {
    expect(
      evaluateCanAccessProperty("p1", {
        isManager: false,
        isLandlord: true,
        landlordPropertyIds: ["p1"],
        isSubmanager: false,
        submanagerPermissions: null,
      }),
    ).toBe(true);
  });
});

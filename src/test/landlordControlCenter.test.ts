import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const migration = readFileSync(resolve(root, "supabase/migrations/20260906000009_landlord_control_center.sql"), "utf8");
const page = readFileSync(resolve(root, "src/features/landlord/pages/LandlordManagement.tsx"), "utf8");
const routes = readFileSync(resolve(root, "src/app/routes.ts"), "utf8");

describe("landlord control center convergence", () => {
  it("reuses existing relationship and mandate sources", () => {
    expect(migration).toContain("property_landlords");
    expect(migration).toContain("manager_management_mandates");
    expect(migration).not.toContain("CREATE TABLE public.landlord_properties");
    expect(migration).not.toContain("CREATE TABLE public.landlord_invoices");
  });
  it("uses request workflow instead of silently mutating financial authority", () => {
    expect(migration).toContain("landlord_management_change_requests");
    expect(migration).toContain("create_landlord_management_change_request_atomic");
    expect(page).toContain("Requests do not silently change ownership, collections or financial authority");
  });
  it("has one owner management route", () => {
    expect(routes).toContain('/landlord/management');
    expect((routes.match(/\/landlord\/management/g) || []).length).toBe(1);
  });
});

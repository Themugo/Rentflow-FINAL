import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = "supabase/migrations/20260904000037_management_compliance_assurance.sql";
const component = "src/features/dashboard/components/ManagementComplianceAssuranceCenter.tsx";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("management compliance assurance", () => {
  it("defines explicit review lifecycle and fail-closed approval threshold", () => {
    const sql = read(migration);
    expect(sql).toContain("management_assurance_reviews");
    expect(sql).toContain("p_target_status NOT IN ('in_review','approved','rejected')");
    expect(sql).toContain("v_review.control_score < 80");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.review_manager_assurance_atomic");
  });

  it("uses the existing close-period and manager scope rather than a duplicate financial source", () => {
    const source = read(component);
    expect(source).toContain("financial_close_periods");
    expect(source).toContain("useManagerScope");
    expect(source).toContain("get_manager_assurance_reviews");
    expect(source).toContain("review_manager_assurance_atomic");
  });
});

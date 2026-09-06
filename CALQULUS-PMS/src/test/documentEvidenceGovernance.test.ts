import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

describe("document and evidence governance", () => {
  it("has the canonical governance migration", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000034_document_evidence_governance.sql"), "utf8");
    expect(sql).toContain("landlord_document_access_log");
    expect(sql).toContain("verification_status");
    expect(sql).toContain("sha256");
    expect(sql).toContain("landlord-documents");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.set_landlord_document_verification");
  });

  it("uses private storage and scoped manager/landlord access", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000034_document_evidence_governance.sql"), "utf8");
    expect(sql).toContain("public.can_manage_property_scope(d.manager_id)");
    expect(sql).toContain("d.landlord_user_id = auth.uid()");
    expect(sql).toContain("public=false");
  });

  it("does not expose tenant personal data in the landlord document UI", () => {
    const source = readFileSync(resolve(root, "src/features/landlord/components/LandlordDocuments.tsx"), "utf8");
    expect(source).not.toMatch(/tenant.*email|tenant.*phone|tenant.*full_name/i);
    expect(source).toContain("record_landlord_document_access");
  });
});

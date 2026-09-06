import fs from "node:fs";
import path from "node:path";

describe("landlord settlement transparency", () => {
  const component = fs.readFileSync(path.resolve(process.cwd(), "src/features/landlord/components/LandlordSettlementTransparency.tsx"), "utf8");
  const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260904000033_landlord_settlement_transparency.sql"), "utf8");

  it("uses the landlord-scoped settlement RPC and does not expose tenant identity", () => {
    expect(component).toContain("get_landlord_settlement_transparency");
    expect(component).toContain("Only your own payout requests and settlement outcomes are shown.");
    expect(component).not.toContain("tenant_name");
    expect(component).not.toContain("tenant_email");
  });

  it("enforces self scope and protects the RPC from anonymous execution", () => {
    expect(migration).toContain("v_uid <> p_landlord_user_id");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_landlord_settlement_transparency(uuid) FROM PUBLIC, anon");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_landlord_settlement_transparency(uuid) TO authenticated, service_role");
  });

  it("supports statement export", () => {
    expect(component).toContain("Export CSV");
    expect(component).toContain("window.print()");
  });
});

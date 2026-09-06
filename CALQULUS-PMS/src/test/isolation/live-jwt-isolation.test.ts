/**
 * Live JWT isolation against the linked Supabase project.
 * Skipped unless LIVE_ISOLATION=1 and credentials are set.
 *
 * Required env:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY
 *   LIVE_MANAGER_EMAIL / LIVE_MANAGER_PASSWORD
 *   LIVE_TENANT_EMAIL / LIVE_TENANT_PASSWORD
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const enabled = process.env.LIVE_ISOLATION === "1";
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anon =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const managerEmail = process.env.LIVE_MANAGER_EMAIL || "";
const managerPassword = process.env.LIVE_MANAGER_PASSWORD || "";
const tenantEmail = process.env.LIVE_TENANT_EMAIL || "";
const tenantPassword = process.env.LIVE_TENANT_PASSWORD || "";
const ready =
  enabled &&
  url.includes("supabase.co") &&
  !url.includes("placeholder") &&
  anon.length > 20 &&
  managerEmail.includes("@") &&
  managerPassword.length > 0 &&
  tenantEmail.includes("@") &&
  tenantPassword.length > 0;

function client(): SupabaseClient {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!ready)("live JWT isolation", () => {
  it("tenant JWT sees only own tenant rows and manager JWT cannot run landlord RPC as someone else", async () => {
    const tenantClient = client();
    const managerClient = client();

    const tenantAuth = await tenantClient.auth.signInWithPassword({
      email: tenantEmail,
      password: tenantPassword,
    });
    expect(tenantAuth.error, tenantAuth.error?.message).toBeNull();

    const { data: tenantRows, error: tenantErr } = await tenantClient
      .from("tenants")
      .select("id");
    expect(tenantErr, tenantErr?.message).toBeNull();
    expect(tenantRows?.length, "tenant JWT must read their own tenant row").toBeGreaterThan(0);
    expect(tenantRows?.length, "tenant JWT must not enumerate other tenants").toBe(1);

    const foreignId = "00000000-0000-4000-8000-000000000099";
    const { data: foreignTenant } = await tenantClient
      .from("tenants")
      .select("id")
      .eq("id", foreignId)
      .maybeSingle();
    expect(foreignTenant).toBeNull();

    const managerAuth = await managerClient.auth.signInWithPassword({
      email: managerEmail,
      password: managerPassword,
    });
    expect(managerAuth.error, managerAuth.error?.message).toBeNull();

    const { error: rpcErr } = await managerClient.rpc("get_landlord_revenue", {
      p_property_id: foreignId,
      p_landlord_user_id: foreignId,
    });
    expect(rpcErr, "get_landlord_revenue must exist on live DB").toBeTruthy();
    const rpcText = `${rpcErr?.code ?? ""} ${rpcErr?.message ?? ""}`;
    expect(rpcText).not.toMatch(/does not exist|schema cache|PGRST202|42P17|infinite recursion/i);
    expect(rpcText).toMatch(/42501|Unauthorized|permission denied|Unauthenticated/i);

    await tenantClient.auth.signOut();
    await managerClient.auth.signOut();
  });
});

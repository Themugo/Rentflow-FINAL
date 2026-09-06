import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const walletSql = fs.readFileSync(path.join(root, "supabase/migrations/20260903000029_phase58_wallet_ledger_atomic.sql"), "utf8");
const activationSql = fs.readFileSync(path.join(root, "supabase/migrations/20260903000030_phase59_activation_policy_hardening.sql"), "utf8");

describe("phase 58-59 financial/auth hardening", () => {
  it("wallet mutations are service-only and idempotent", () => {
    expect(walletSql).toContain("record_landlord_wallet_transaction_atomic");
    expect(walletSql).toContain("Service role required");
    expect(walletSql).toContain("Insufficient landlord wallet balance");
    expect(walletSql).toContain("wallet_transactions_reference_uidx");
    expect(walletSql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon");
  });

  it("removes the permissive activation manager policy", () => {
    expect(activationSql).toContain('DROP POLICY IF EXISTS "Managers can manage account_activations"');
    expect(activationSql).toContain("USING (user_id = auth.uid())");
    expect(activationSql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.account_activations FROM authenticated, anon");
  });
});

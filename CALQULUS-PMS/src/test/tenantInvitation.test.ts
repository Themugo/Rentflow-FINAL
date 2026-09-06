import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  INVITATION_STATE_COPY,
  buildInvitationSummary,
  buildLeaseSummary,
  isInvitationEmail,
  normalizeInvitationState,
} from "@/features/auth/lib/tenantInvitation";

const kes = (n: number) => `KES ${n.toLocaleString()}`;

describe("invitation token states", () => {
  it("valid invitation stays pending", () => {
    expect(normalizeInvitationState("pending")).toBe("pending");
  });

  it("expired invitation maps to the expired screen with no CTA", () => {
    expect(normalizeInvitationState("expired")).toBe("expired");
    expect(INVITATION_STATE_COPY.expired.title).toMatch(/expired/i);
    expect(INVITATION_STATE_COPY.expired.body).toMatch(/new invitation/i);
    expect(INVITATION_STATE_COPY.expired.cta).toBeNull();
  });

  it("already used invitation maps to the used screen with a sign-in CTA", () => {
    expect(normalizeInvitationState("used")).toBe("used");
    expect(INVITATION_STATE_COPY.used.title).toMatch(/already used/i);
    expect(INVITATION_STATE_COPY.used.cta).toEqual({ label: "Sign in", href: "/tenant/login" });
  });

  it("invalid or unknown tokens map to the invalid screen", () => {
    expect(normalizeInvitationState("invalid")).toBe("invalid");
    expect(normalizeInvitationState(null)).toBe("invalid");
    expect(normalizeInvitationState(undefined)).toBe("invalid");
    expect(normalizeInvitationState("garbage")).toBe("invalid");
    expect(normalizeInvitationState(42)).toBe("invalid");
    expect(INVITATION_STATE_COPY.invalid.cta).toBeNull();
  });

  it("refresh and back navigation are stable: states never regress to pending", () => {
    // Re-reading the same RPC result must produce the same state —
    // a used/expired token can never become pending again client-side.
    for (const state of ["used", "expired", "invalid"] as const) {
      expect(normalizeInvitationState(state)).toBe(state);
      expect(normalizeInvitationState(normalizeInvitationState(state))).toBe(state);
    }
  });
});

describe("invitation email binding", () => {
  it("matches the invited email case-insensitively", () => {
    expect(isInvitationEmail("Tenant@Example.com", "tenant@example.com")).toBe(true);
    expect(isInvitationEmail("  tenant@example.com ", "tenant@example.com")).toBe(true);
  });

  it("rejects a different email (wrong user)", () => {
    expect(isInvitationEmail("other@example.com", "tenant@example.com")).toBe(false);
    expect(isInvitationEmail("", "tenant@example.com")).toBe(false);
  });
});

describe("invitation card summary", () => {
  it("shows property, unit, and inviter — nothing else", () => {
    const rows = buildInvitationSummary({
      propertyName: "Sunrise Apartments",
      unit: "A4",
      inviterName: "Summit Property Management",
    });
    expect(rows).toEqual([
      { label: "Property", value: "Sunrise Apartments" },
      { label: "Unit", value: "A4" },
      { label: "Invited by", value: "Summit Property Management" },
    ]);
  });

  it("omits rows that are missing instead of fabricating them", () => {
    expect(buildInvitationSummary({ propertyName: "Sunrise", unit: null, inviterName: null }))
      .toEqual([{ label: "Property", value: "Sunrise" }]);
    expect(buildInvitationSummary({ propertyName: null, unit: null, inviterName: null })).toEqual([]);
  });
});

describe("confirmation lease summary", () => {
  it("shows rent and combined deposit when the manager set them", () => {
    const rows = buildLeaseSummary(
      { propertyName: null, unit: null, inviterName: null, monthlyRent: 25000, houseDeposit: 25000, waterDeposit: 2000 },
      kes,
    );
    expect(rows).toEqual([
      { label: "Monthly rent", value: "KES 25,000" },
      { label: "Deposit", value: "KES 27,000" },
    ]);
  });

  it("shows no lease figures when the invitation carries none", () => {
    expect(
      buildLeaseSummary({ propertyName: null, unit: null, inviterName: null }, kes),
    ).toEqual([]);
  });

  it("never shows a zero or negative rent", () => {
    const rows = buildLeaseSummary(
      { propertyName: null, unit: null, inviterName: null, monthlyRent: 0, houseDeposit: 0 },
      kes,
    );
    expect(rows).toEqual([]);
  });
});

// ── Server-side security invariants (static — Deno functions and SQL are
// not executed by vitest, so we assert the shipped artifacts keep the
// guarantees the flow depends on). ─────────────────────────────────────────

const edgeSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/create-tenant-account/index.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260824000001_tenant_invitation_phase7.sql"),
  "utf8",
);

describe("server-side invitation validation (create-tenant-account)", () => {
  it("resolves property/unit/manager from the token, not the client", () => {
    expect(edgeSource).toContain("invitationToken");
    expect(edgeSource).toContain('const effPropertyId  = invitation ? invitation.property_id');
    expect(edgeSource).toContain("const resolvedManagerId = invitation ? invitation.invited_by");
  });

  it("enforces that the auth user owns the invited email", () => {
    expect(edgeSource).toContain("invitation_email_mismatch");
    expect(edgeSource).toContain("claimEmail !== invite.email.toLowerCase()");
  });

  it("rejects expired and already-used invitations", () => {
    expect(edgeSource).toContain("invitation_expired");
    expect(edgeSource).toContain("invitation_used");
  });

  it("marks the invitation used atomically (status='pending' guard)", () => {
    expect(edgeSource).toContain('.update({ status: "used", used_at: new Date().toISOString() })');
    expect(edgeSource).toContain('.eq("status", "pending")');
  });

  it("returns an idempotent already-claimed summary for refresh/back navigation", () => {
    expect(edgeSource).toContain("alreadyClaimed: true");
    expect(edgeSource).toContain("user_roles");
  });
});

describe("invitation RPCs (migration)", () => {
  it("validate_invitation_token only returns pending, unexpired rows", () => {
    expect(migration).toContain("ti.status = 'pending'");
    expect(migration).toContain("ti.expires_at > now()");
  });

  it("exposes the inviter organization name without manager contact PII", () => {
    expect(migration).toContain("inviter_name");
    expect(migration).toContain("company_settings");
    expect(migration).not.toMatch(/inviter_(email|phone)/);
  });

  it("invitation_token_state classifies without returning invitation contents", () => {
    expect(migration).toContain("public.invitation_token_state(token_value text)");
    expect(migration).toContain("RETURNS text");
    for (const state of ["'pending'", "'expired'", "'used'", "'invalid'"]) {
      expect(migration).toContain(`RETURN ${state};`);
    }
  });

  it("grants both RPCs to anon and authenticated (token-gated, no table access)", () => {
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.invitation_token_state(text) TO anon, authenticated;");
  });
});

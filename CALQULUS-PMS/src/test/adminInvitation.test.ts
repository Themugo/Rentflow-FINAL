import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_INVITATION_STATE_COPY,
  buildAdminInvitationSummary,
  isAdminInvitationEmail,
  isAdminPasswordStrong,
  normalizeAdminInvitationState,
} from "@/features/auth/lib/adminInvitation";

// ── Pure helper behaviour ────────────────────────────────────────────────

describe("admin invitation token states", () => {
  it("valid invitation stays pending", () => {
    expect(normalizeAdminInvitationState("pending")).toBe("pending");
  });

  it("expired invitation maps to the expired screen with no CTA", () => {
    expect(normalizeAdminInvitationState("expired")).toBe("expired");
    expect(ADMIN_INVITATION_STATE_COPY.expired.title).toMatch(/expired/i);
    expect(ADMIN_INVITATION_STATE_COPY.expired.body).toMatch(/72 hours/i);
    expect(ADMIN_INVITATION_STATE_COPY.expired.cta).toBeNull();
  });

  it("already used invitation maps to the used screen with a sign-in CTA", () => {
    expect(normalizeAdminInvitationState("used")).toBe("used");
    expect(ADMIN_INVITATION_STATE_COPY.used.title).toMatch(/already been used/i);
    expect(ADMIN_INVITATION_STATE_COPY.used.cta).toEqual({
      label: "Go to CALQULUS ADMIN sign in",
      href: "/webhost/login",
    });
  });

  it("revoked invitation maps to its own screen", () => {
    expect(normalizeAdminInvitationState("revoked")).toBe("revoked");
    expect(ADMIN_INVITATION_STATE_COPY.revoked.title).toMatch(/revoked/i);
    expect(ADMIN_INVITATION_STATE_COPY.revoked.cta).toBeNull();
  });

  it("invalid or unknown tokens map to the invalid screen", () => {
    expect(normalizeAdminInvitationState("invalid")).toBe("invalid");
    expect(normalizeAdminInvitationState(null)).toBe("invalid");
    expect(normalizeAdminInvitationState(undefined)).toBe("invalid");
    expect(normalizeAdminInvitationState("garbage")).toBe("invalid");
    expect(normalizeAdminInvitationState(42)).toBe("invalid");
    expect(ADMIN_INVITATION_STATE_COPY.invalid.cta).toBeNull();
  });

  it("states never regress to pending (refresh/back navigation stable)", () => {
    for (const state of ["used", "expired", "revoked", "invalid"] as const) {
      expect(normalizeAdminInvitationState(state)).toBe(state);
      expect(normalizeAdminInvitationState(normalizeAdminInvitationState(state))).toBe(state);
    }
  });
});

describe("admin invitation email binding + password bar", () => {
  it("matches the invited email case-insensitively", () => {
    expect(isAdminInvitationEmail("Admin@Example.com", "admin@example.com")).toBe(true);
    expect(isAdminInvitationEmail("  admin@example.com ", "admin@example.com")).toBe(true);
  });

  it("rejects a different email (unauthorized user)", () => {
    expect(isAdminInvitationEmail("attacker@example.com", "admin@example.com")).toBe(false);
    expect(isAdminInvitationEmail("", "admin@example.com")).toBe(false);
  });

  it("enforces the stronger admin password bar (≥10 chars)", () => {
    expect(isAdminPasswordStrong("short")).toBe(false);
    expect(isAdminPasswordStrong("ninechars")).toBe(false);
    expect(isAdminPasswordStrong("tenchars10")).toBe(true);
    expect(isAdminPasswordStrong("a-much-longer-passphrase")).toBe(true);
  });
});

describe("admin invitation card summary", () => {
  it("shows email and inviter — never token or status", () => {
    const rows = buildAdminInvitationSummary({
      email: "newadmin@calqulusrms.com",
      displayName: "New Admin",
      inviterName: "CALQULUS Platform",
    });
    expect(rows).toEqual([
      { label: "Admin email", value: "newadmin@calqulusrms.com" },
      { label: "Invited by", value: "CALQULUS Platform" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/token|status/i);
  });

  it("omits missing rows instead of fabricating them", () => {
    expect(buildAdminInvitationSummary({ email: "a@b.com", displayName: null, inviterName: null }))
      .toEqual([{ label: "Admin email", value: "a@b.com" }]);
    expect(buildAdminInvitationSummary({ email: null, displayName: null, inviterName: null })).toEqual([]);
  });
});

// ── Server-side security invariants (static — Deno functions and SQL are
// not executed by vitest, so we assert the shipped artifacts keep the
// guarantees the flow depends on). ─────────────────────────────────────────

const acceptSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/accept-admin-invitation/index.ts"),
  "utf8",
);
const sendSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/send-admin-invitation/index.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260824000002_admin_invitation_phase8.sql"),
  "utf8",
);
const routesSource = readFileSync(resolve(__dirname, "../app/routes.ts"), "utf8");

describe("accept-admin-invitation — server-side authorization", () => {
  it("grants the role server-side as a fixed 'webhost' — no client role selection", () => {
    expect(acceptSource).toContain('role: "webhost"');
    // The request body must NOT accept a role parameter.
    expect(acceptSource).not.toMatch(/role\s*[:?].*req|body\.role|requestedRole/i);
  });

  it("requires a password of at least 10 characters", () => {
    expect(acceptSource).toContain("password.length < 10");
  });

  it("rejects expired and already-used invitations", () => {
    expect(acceptSource).toContain("invitation_expired");
    expect(acceptSource).toContain("invitation_used");
  });

  it("is idempotent for the same user (refresh/back navigation safe)", () => {
    expect(acceptSource).toContain("alreadyClaimed: true");
  });

  it("marks the invitation used atomically (status='pending' guard)", () => {
    expect(acceptSource).toContain('.update({ status: "used", used_at: new Date().toISOString() })');
    expect(acceptSource).toContain('.eq("status", "pending")');
  });

  it("confirms the invitee email at creation (identity verification)", () => {
    expect(acceptSource).toContain("email_confirm: true");
  });

  it("audit-logs every acceptance", () => {
    expect(acceptSource).toContain("admin_invitation_accepted");
  });
});

describe("send-admin-invitation — authorization controlled issuance", () => {
  it("is webhost-only via middleware", () => {
    expect(sendSource).toContain('allowedRoles: ["webhost"]');
  });

  it("additionally requires admin-creation permission (owner/business/super_admin)", () => {
    expect(sendSource).toContain("can_create_admins");
    expect(sendSource).toContain("super_admin");
    expect(sendSource).toContain("Insufficient permissions to invite administrators");
  });

  it("refuses to invite an email that already has admin access", () => {
    expect(sendSource).toContain("already has administrator access");
  });

  it("audit-logs every issuance", () => {
    expect(sendSource).toContain("admin_invitation_sent");
  });
});

describe("admin_invitations migration — invitation lifecycle", () => {
  it("enforces single-use status with expiry", () => {
    expect(migration).toContain("CHECK (status IN ('pending', 'used', 'revoked'))");
    expect(migration).toContain("interval '72 hours'");
  });

  it("keeps rows readable only by webhosts (RLS)", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("admin_invitations_webhost_select");
    expect(migration).toContain("role = 'webhost'");
  });

  it("validate RPC returns only pending, unexpired rows", () => {
    expect(migration).toContain("ai.status = 'pending'");
    expect(migration).toContain("ai.expires_at > now()");
  });

  it("token-state classifier is PII-free and covers all states", () => {
    expect(migration).toContain("public.admin_invitation_token_state(token_value text)");
    for (const state of ["'pending'", "'expired'", "'used'", "'revoked'", "'invalid'"]) {
      expect(migration).toContain(`RETURN ${state};`);
    }
  });

  it("grants both RPCs to anon and authenticated (token-gated, no table access)", () => {
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.validate_admin_invitation_token(text) TO anon, authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.admin_invitation_token_state(text) TO anon, authenticated;");
  });
});

describe("routing — no public admin registration", () => {
  it("exposes the invite acceptance page but no admin signup route", () => {
    expect(routesSource).toContain('path: "/webhost/invite"');
    expect(routesSource).not.toMatch(/webhost\/(signup|register)/i);
  });
});

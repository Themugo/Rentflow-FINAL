/**
 * Pure helpers for the CALQULUS ADMIN invitation flow (Phase 8).
 *
 * The server (edge functions + RPCs) is always authoritative — these
 * only shape UI copy, state mapping, and display rows. Admin access is
 * invitation/authorization controlled; there is no public registration.
 */

export type AdminInvitationState = "pending" | "expired" | "used" | "revoked" | "invalid";

export function normalizeAdminInvitationState(value: unknown): AdminInvitationState {
  return value === "pending" || value === "expired" || value === "used" || value === "revoked"
    ? value
    : "invalid";
}

export const ADMIN_INVITATION_STATE_COPY: Record<
  AdminInvitationState,
  { title: string; body: string; cta: { label: string; href: string } | null }
> = {
  pending: { title: "", body: "", cta: null },
  expired: {
    title: "This invitation has expired",
    body: "Admin invitations are valid for 72 hours. Ask the platform administrator who invited you to send a new one.",
    cta: null,
  },
  used: {
    title: "This invitation has already been used",
    body: "This admin invitation was already accepted. Sign in to the CALQULUS ADMIN console with the credentials you set.",
    cta: { label: "Go to CALQULUS ADMIN sign in", href: "/webhost/login" },
  },
  revoked: {
    title: "This invitation was revoked",
    body: "The platform administrator withdrew this invitation. Contact them if you believe this is a mistake.",
    cta: null,
  },
  invalid: {
    title: "Invalid invitation link",
    body: "This admin invitation link is not valid. It may have been altered — use the exact link from your invitation email.",
    cta: null,
  },
};

export interface AdminInvitationView {
  email: string | null;
  displayName: string | null;
  inviterName: string | null;
  adminType?: string | null;
}

/** Human label for the operator tier the invitee is accepting. */
export function adminTierLabel(adminType: string | null | undefined): string {
  return adminType === "business" ? "Business operator" : "Admin operator";
}

/** Rows for the invitation card: email + tier + inviter (never token/status). */
export function buildAdminInvitationSummary(inv: AdminInvitationView): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (inv.email) rows.push({ label: "Admin email", value: inv.email });
  if (inv.adminType) rows.push({ label: "Operator access", value: adminTierLabel(inv.adminType) });
  if (inv.inviterName) rows.push({ label: "Invited by", value: inv.inviterName });
  return rows;
}

/** Emails match case-insensitively after trimming. */
export function isAdminInvitationEmail(candidate: string, invited: string): boolean {
  return candidate.trim().toLowerCase() === invited.trim().toLowerCase();
}

/** Admin passwords are held to a stronger bar than customer accounts. */
export function isAdminPasswordStrong(password: string): boolean {
  return password.length >= 10;
}

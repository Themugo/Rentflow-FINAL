/**
 * Tenant invitation (Phase 7) — pure helpers for the /tenant/invitation flow.
 *
 * The server remains authoritative: `validate_invitation_token` only returns
 * pending + unexpired rows, `invitation_token_state` classifies everything
 * else without exposing PII, and `create-tenant-account` resolves
 * property/unit/manager from the token server-side. These helpers only map
 * server truth onto UI copy.
 */

export type InvitationState = "pending" | "expired" | "used" | "invalid";

/** Normalizes the invitation_token_state RPC result; anything unknown is invalid. */
export function normalizeInvitationState(raw: unknown): InvitationState {
  return raw === "pending" || raw === "expired" || raw === "used" ? raw : "invalid";
}

export interface InvitationStateCopy {
  title: string;
  body: string;
  /** Where the primary action leads; null = no action. */
  cta: { label: string; href: string } | null;
}

export const INVITATION_STATE_COPY: Record<Exclude<InvitationState, "pending">, InvitationStateCopy> = {
  expired: {
    title: "This invitation has expired",
    body: "Invitation links are time-limited. Ask your property manager to send you a new invitation.",
    cta: null,
  },
  used: {
    title: "This invitation was already used",
    body: "Your account was already created with this link. Sign in to open your tenant portal.",
    cta: { label: "Sign in", href: "/tenant/login" },
  },
  invalid: {
    title: "This invitation link is not valid",
    body: "The link may be incomplete or incorrect. Ask your property manager to send you a new invitation.",
    cta: null,
  },
};

/** Case-insensitive email match — the invitation is bound to one email. */
export function isInvitationEmail(email: string, invitationEmail: string): boolean {
  return email.trim().toLowerCase() === invitationEmail.trim().toLowerCase();
}

export interface InvitationSummaryInput {
  propertyName: string | null;
  unit: string | null;
  inviterName: string | null;
  monthlyRent?: number | null;
  houseDeposit?: number | null;
  waterDeposit?: number | null;
}

export interface SummaryRow {
  label: string;
  value: string;
}

/**
 * Rows for the invitation card and the post-signup confirmation.
 * Lease figures are shown only when the manager set them — never fabricated.
 */
export function buildInvitationSummary(input: InvitationSummaryInput): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (input.propertyName) rows.push({ label: "Property", value: input.propertyName });
  if (input.unit) rows.push({ label: "Unit", value: input.unit });
  if (input.inviterName) rows.push({ label: "Invited by", value: input.inviterName });
  return rows;
}

/** Lease rows for the confirmation screen — only what the invitation actually carries. */
export function buildLeaseSummary(input: InvitationSummaryInput, formatMoney: (n: number) => string): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (typeof input.monthlyRent === "number" && input.monthlyRent > 0) {
    rows.push({ label: "Monthly rent", value: formatMoney(input.monthlyRent) });
  }
  const deposit = (input.houseDeposit ?? 0) + (input.waterDeposit ?? 0);
  if (deposit > 0) rows.push({ label: "Deposit", value: formatMoney(deposit) });
  return rows;
}

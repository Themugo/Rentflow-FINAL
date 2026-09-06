# CALQULUS PMS — Tenant Shared Payment Links Completion

## Outcome
Tenants can now share an opaque payment link with a parent, guardian, employer, sponsor, or other trusted payer. This is designed for cases such as a hostel student sending their rent/fees payment link to their parents.

The recipient does not need the tenant's credentials and does not need to create a CALQULUS account. The link only exposes the bills explicitly encoded in it and never exposes tenant login credentials.

## Flow
1. Tenant opens **Payments** and selects **Share payment link**.
2. Tenant chooses a 24-hour, 3-day, 7-day, or 30-day expiry.
3. CALQULUS creates a cryptographically random token and stores only its SHA-256 hash.
4. Tenant shares `/pay/<token>` by WhatsApp, SMS, email, or the device share sheet.
5. Parent/guardian opens the link and sees the covered outstanding bills grouped by property/unit.
6. Payer selects bills, enters their own name and M-Pesa number, and starts STK Push.
7. The payment transaction is attributed to the payer party and retains every invoice/unit allocation.
8. M-Pesa callback uses the existing canonical payment-processing pipeline.
9. The tenant, manager/agency and landlord reconciliation layers see the resulting unit-level payment normally.
10. The payer sees payment completion and the canonical issued receipt number when available.

## Security controls
- Opaque 256-bit random link token.
- Only SHA-256 token hashes are persisted.
- Link ownership is tenant-scoped at creation/revocation.
- Links expire and can be revoked.
- Maximum 20 invoices per link.
- Maximum 20 successful uses per link by default.
- Five STK initiation attempts per link per hour.
- Public RPC exposes only the invoices encoded in the token.
- Public payment initiation validates selected invoice IDs against the share link.
- Payment amount must equal the currently payable balance of selected invoices.
- Parent/guardian never receives tenant credentials.
- Payer is recorded separately from the tenant/obligated party.

## Files
- `supabase/migrations/20260904000008_tenant_share_payment_links.sql`
- `supabase/functions/initiate-shared-payment/index.ts`
- `src/features/payments/pages/PublicPaymentShare.tsx`
- `src/features/tenant-portal/components/TenantPaymentShareButton.tsx`
- `src/features/payments/pages/PaymentHistory.tsx`
- `src/app/routes.ts`
- `scripts/audit-tenant-share-payment-links.mjs`

## Verification
`TENANT_SHARE_PAYMENT_LINK_AUDIT=PASS`

The complete project dependency tree is not present in the recovered working copy, so the full Vitest/TypeScript/build suite could not be executed. No unavailable test was represented as passing.

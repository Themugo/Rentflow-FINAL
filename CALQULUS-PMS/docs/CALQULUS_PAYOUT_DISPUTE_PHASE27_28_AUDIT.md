# CALQULUS PMS — Phase 27–28 Audit

## Phase 27 — Payout lifecycle atomicity
Payout creation and status transitions now execute through `create_payout_request_atomic` and `transition_payout_request_atomic`. The RPCs validate authenticated roles, portfolio ownership, positive amounts, valid periods, lock the payout row during transitions, enforce pending→approved→paid / pending→rejected state changes, require a payment reference before marking paid, and calculate management-fee/net fields transactionally.

All production payout mutation callers were converged to the RPCs. Reads remain direct because they do not mutate financial state.

## Phase 28 — Dispute lifecycle atomicity
The canonical `disputes` schema is the source of truth. `create_dispute_atomic` validates tenant/invoice ownership and caller scope before insertion. `resolve_dispute_atomic` locks the dispute, rejects already-closed disputes, validates manager/submanager/webhost scope, and atomically records resolution metadata.

The legacy `resolve-dispute` path attempted to write non-existent `other_charges` and non-existent dispute columns. That unsafe financial side effect was removed rather than silently emulated. Non-zero `adjustmentAmount` requests are explicitly rejected and must use the supported invoice/credit atomic workflows.

## Validation
- Static direct `payout_requests` mutation audit: expected RPC-only production mutations after convergence.
- Dispute schema-field audit: canonical fields only in the new RPC path.
- Structural checks applied to changed TypeScript/TSX files.
- `npm run audit:prod` should be run in the packaged repository; dependency-based lint/test/build/typecheck depend on installed project dependencies.

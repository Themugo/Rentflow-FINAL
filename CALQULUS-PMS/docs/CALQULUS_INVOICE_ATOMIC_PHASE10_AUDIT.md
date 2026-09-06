# CALQULUS Phase 10 — Invoice Atomicity Audit

## Scope
Converges tenant-facing manual invoice creation, property billing invoice creation, water invoices, and late-penalty invoices onto the service-only atomic invoice RPC.

## Controls
- `create_invoice_atomic_v2` is SECURITY DEFINER and executable only by `service_role`.
- Tenant and property manager ownership is checked inside the transaction.
- Lease ownership is checked when a lease is supplied.
- `generation_key` provides idempotent creation.
- Manual clients call the authenticated `create-invoice` Edge Function; they never receive service-role credentials.
- Water billing uses a deterministic reading-based generation key.
- Penalties use an invoice/date generation key and no longer perform a direct invoice insert.

## Verification
Static source audit and ZIP integrity were run for this phase. Runtime npm gates remain dependent on installed project dependencies.

# Production Deployment & Supabase Reconciliation Initiative

## Objective
Make CALQULUS PMS deployable without relying on manual assumptions about the database, project configuration, or release state.

## Completed
1. **Environment truth gate** — validates the Supabase project reference, required client configuration, and production-disabled demo/dev flags without recording secrets.
2. **Migration reconciliation gate** — inspects the repository migration chain and, when the Supabase CLI is available, compares the linked project and `supabase db push --dry-run`. It fails closed and never rewrites migration history.
3. **Production smoke gate** — verifies frontend routes/security headers and the live Supabase PostgREST schema before a release can be declared healthy.
4. **Deployment helper correction** — removed the stale hard-coded Supabase project reference and removed the false hard-coded test count from the production deploy helper.
5. **Preflight integration** — production preflight now includes the environment and migration reconciliation gates.

## Current production truth
The connected Supabase project is `hmgpltrjlsescfquqxeg`. Its migration history currently contains only the bootstrap/marker records plus a verification record, while core application tables such as `payment_transactions`, `operation_work_items`, `lease_renewal_cases`, and `tenant_service_recovery_cases` are not present. Therefore production database deployment is **not yet complete**.

## Required promotion sequence

```text
clean release commit
  -> environment gate
  -> migration reconciliation / dry-run
  -> supabase db push
  -> edge-function deployment
  -> frontend deployment
  -> production smoke gate
  -> live evidence + release certification
```

Do not use `supabase migration repair` to pretend SQL was applied, and do not reset the production database to solve migration drift.

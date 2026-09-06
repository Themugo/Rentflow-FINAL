# Phase 108–109 Audit

Phase 108 adds a fail-closed staging connectivity probe for the application, Supabase REST endpoint and Auth health endpoint. It captures only non-secret status/latency evidence.

Phase 109 adds a read-only PostgreSQL RLS/grant verifier over the hardened application tables. It fails if a listed table is missing, RLS is disabled, no policy exists, or anon/authenticated retain direct INSERT/UPDATE/DELETE grants.

Both phases intentionally require external environment access for a live PASS. No production or destructive operation is automated.

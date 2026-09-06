-- PHASE 92: migration-chain / privileged-function certification guardrails.
-- This migration intentionally contains no destructive data changes. It provides
-- the final runtime guardrail for the latest self-registration RPC and documents
-- that historical duplicate migration versions must be reconciled before applying
-- the chain to a fresh Supabase project.
ALTER FUNCTION public.self_register_tenant_atomic(text,text) SET search_path = public, pg_temp;

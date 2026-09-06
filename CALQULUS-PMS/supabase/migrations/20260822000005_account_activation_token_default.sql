-- Phase 7 (auth): account_activations.token / expires_at were NOT NULL with no
-- column default, but create-tenant-account inserts only user_id (its comment
-- claimed a database default that does not exist). That made account creation
-- fail with a not-null violation on the activation step. Give the table a
-- cryptographically-secure token default and a 24h expiry so both the direct
-- insert path and the create_account_activation RPC produce valid rows.

ALTER TABLE public.account_activations
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex'),
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Ensure no two live activations share a token (belt-and-suspenders; the
-- 32-byte random default makes collision effectively impossible).
CREATE UNIQUE INDEX IF NOT EXISTS account_activations_token_key
  ON public.account_activations (token);

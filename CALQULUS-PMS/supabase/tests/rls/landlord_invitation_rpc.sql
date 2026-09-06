-- RLS smoke test (run against local replay DB):
--   docker cp supabase/tests/rls/landlord_invitation_rpc.sql calqulus-pg:/tmp/ && \
--   docker exec -e PGPASSWORD=postgres calqulus-pg psql -U supabase_admin -d postgres -f /tmp/landlord_invitation_rpc.sql
-- Requires: bash supabase/tests/harness/replay-migrations.sh completed first.

BEGIN;
INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111','mgr@test.dev');
INSERT INTO auth.users (id, email) VALUES ('22222222-2222-2222-2222-222222222222','landlord@test.dev');
INSERT INTO public.properties (id, manager_id, name, address) VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Test Property','1 Test Way');
INSERT INTO public.landlord_invitations (id, property_id, manager_id, email, token, status, expires_at)
VALUES ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','landlord@test.dev','test-token-123','pending', now() + interval '7 days');
SELECT id IS NOT NULL AS lookup_found, property_name, email FROM public.get_landlord_invitation_by_token('test-token-123');
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"landlord@test.dev"}';
SELECT public.accept_landlord_invitation('test-token-123') AS accepted_invitation_id;
SELECT status FROM public.landlord_invitations WHERE token='test-token-123';
SELECT landlord_user_id, manager_id, revenue_share_pct FROM public.property_landlords WHERE property_id='33333333-3333-3333-3333-333333333333';
SELECT role, approval_status FROM public.user_roles WHERE user_id='22222222-2222-2222-2222-222222222222';
SELECT public.accept_landlord_invitation('test-token-123') AS reaccept_ok;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;
INSERT INTO auth.users (id, email) VALUES ('55555555-5555-5555-5555-555555555555','evil@test.dev');
SET request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
SET request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","email":"evil@test.dev"}';
SELECT public.accept_landlord_invitation('test-token-123');
ROLLBACK;

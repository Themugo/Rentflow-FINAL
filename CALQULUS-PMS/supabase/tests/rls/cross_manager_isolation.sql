-- RLS smoke test (run against local replay DB):
--   docker cp supabase/tests/rls/cross_manager_isolation.sql calqulus-pg:/tmp/ && \
--   docker exec -e PGPASSWORD=postgres calqulus-pg psql -U supabase_admin -d postgres -f /tmp/cross_manager_isolation.sql
-- Requires: bash supabase/tests/harness/replay-migrations.sh completed first.

BEGIN;
INSERT INTO auth.users (id, email) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','mgrA@test.dev');
INSERT INTO auth.users (id, email) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','mgrB@test.dev');
INSERT INTO public.properties (id, manager_id, name, address) VALUES
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','MgrA Property','A Way'),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','MgrB Property','B Way');
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT name, manager_id FROM public.properties ORDER BY name;
INSERT INTO public.properties (manager_id, name, address) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Forge For B','Evil Way');
RESET ROLE;
ROLLBACK;

#!/usr/bin/env bash
# Phase 2 certification harness: replay ALL migrations against an EMPTY database.
# TEST ONLY — runs against the local supabase/postgres container, never production.
#
# Usage (host):
#   sudo docker cp supabase calqulus-pg:/tmp/workspace
#   sudo docker exec calqulus-pg bash /tmp/workspace/tests/harness/replay-migrations.sh
set -u
cd "$(dirname "$0")/../.."

rm -f /tmp/migration_results.txt /tmp/migration_errors.txt

psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL

# 1. hosted-Supabase compatibility shim (env gap, not a migration)
if ! psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -f tests/harness/000_local_replay_shim.sql > /tmp/mig_out.log 2>&1; then
  echo "FAIL 000_local_replay_shim.sql" | tee /tmp/migration_results.txt
  cat /tmp/mig_out.log
  exit 1
fi

# 2. every migration in order
pass=0; fail=0
for f in $(ls migrations/*.sql | sort); do
  name=$(basename "$f")
  if psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -f "$f" > /tmp/mig_out.log 2>&1; then
    echo "PASS $name" >> /tmp/migration_results.txt
    pass=$((pass+1))
  else
    echo "FAIL $name" >> /tmp/migration_results.txt
    echo "=== ERROR in $name ===" >> /tmp/migration_errors.txt
    grep -E "ERROR|LINE" /tmp/mig_out.log | head -4 >> /tmp/migration_errors.txt
    fail=$((fail+1))
  fi
done

echo "RESULT: $pass passed, $fail failed of $((pass+fail)) migrations"

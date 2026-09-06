#!/usr/bin/env bash
# Restore drill: apply repo migrations to a throwaway Postgres, dump, drop, restore, compare.
# This proves the SQL corpus can be restored. It is NOT a production PITR test.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/docs/audits/RESTORE_DRILL.json"
MIGDIR="$ROOT/supabase/migrations"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

SRC_DB="calqulus_restore_src"
DST_DB="calqulus_restore_dst"
DUMP="/tmp/calqulus-restore-drill.dump"

psql -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${SRC_DB}', '${DST_DB}') AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${SRC_DB};
DROP DATABASE IF EXISTS ${DST_DB};
CREATE DATABASE ${SRC_DB};
SQL

psql -d "$SRC_DB" -v ON_ERROR_STOP=0 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
SQL

applied=0
failed=0
failed_files=""
while IFS= read -r file; do
  if psql -d "$SRC_DB" -v ON_ERROR_STOP=1 -f "$file" >/tmp/restore-mig.out 2>/tmp/restore-mig.err; then
    applied=$((applied + 1))
  else
    failed=$((failed + 1))
    failed_files="${failed_files}$(basename "$file")"$'\n'
    echo "WARN migration failed: $(basename "$file")"
  fi
done < <(find "$MIGDIR" -maxdepth 1 -name '*.sql' | sort)

src_tables=$(psql -d "$SRC_DB" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
src_rls=$(psql -d "$SRC_DB" -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;")

pg_dump -Fc -d "$SRC_DB" -f "$DUMP"
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DST_DB};"
pg_restore --no-owner --no-acl -d "$DST_DB" "$DUMP" >/tmp/restore-pg.out 2>/tmp/restore-pg.err || true

dst_tables=$(psql -d "$DST_DB" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
dst_rls=$(psql -d "$DST_DB" -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;")

python3 - "$REPORT" "$applied" "$failed" "$src_tables" "$dst_tables" "$src_rls" "$dst_rls" "$failed_files" <<'PY'
import json, sys, datetime
path, applied, failed, src_tables, dst_tables, src_rls, dst_rls, failed_files = sys.argv[1:]
ok = src_tables == dst_tables and int(src_tables) > 0
report = {
  "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
  "kind": "local_postgres_dump_restore",
  "notProductionPitr": True,
  "migrationsApplied": int(applied),
  "migrationsFailed": int(failed),
  "failedFiles": [f for f in failed_files.splitlines() if f],
  "sourcePublicTables": int(src_tables),
  "restoredPublicTables": int(dst_tables),
  "sourceRlsTables": int(src_rls),
  "restoredRlsTables": int(dst_rls),
  "restoreMatched": ok,
}
open(path, "w").write(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
sys.exit(0 if ok else 1)
PY

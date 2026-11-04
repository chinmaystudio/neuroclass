#!/usr/bin/env bash
# Creates a throw-away database with Supabase stubs, the canonical schema, all
# migrations and the new LMS migration. Usage:
#   TEST_DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/postgres ./tests/integration/prepare-db.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ADMIN="${TEST_DATABASE_ADMIN_URL:?set TEST_DATABASE_ADMIN_URL}"
DB="${TEST_DATABASE_NAME:-neuroclass_test}"
psql "$ADMIN" -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
URL="${ADMIN%/*}/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/backend/tests/integration/supabase-stub.sql"
# Pre-existing legacy files contain known duplicate-policy / pgvector errors; they are not fatal.
psql "$URL" -q -f "$ROOT/supabase/schema.sql" >/dev/null 2>&1 || true
for f in "$ROOT"/supabase/migrations/*.sql; do
  case "$f" in *20261105*) ;; *) psql "$URL" -q -f "$f" >/dev/null 2>&1 || true ;; esac
done
for f in "$ROOT"/supabase/migrations/20261105*.sql; do
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
echo "$URL"

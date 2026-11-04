#!/usr/bin/env bash
# Creates a throw-away database shaped exactly like production (snapshot taken
# before the 20261105* migrations), then applies every 20261105* migration with
# ON_ERROR_STOP. Usage:
#   TEST_DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/postgres ./tests/integration/prepare-db.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ADMIN="${TEST_DATABASE_ADMIN_URL:?set TEST_DATABASE_ADMIN_URL}"
DB="${TEST_DATABASE_NAME:-neuroclass_test}"
psql "$ADMIN" -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
URL="${ADMIN%/*}/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/backend/tests/integration/supabase-stub.sql"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/backend/tests/integration/prod-schema-snapshot.sql"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "${SEED_FILE:-$ROOT/backend/tests/integration/seed-prod-like.sql}"
for f in "$ROOT"/supabase/migrations/20261105*.sql; do
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
echo "$URL"

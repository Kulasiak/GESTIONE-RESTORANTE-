#!/usr/bin/env bash
# Prova migrazione, seed e regole RLS su un Postgres locale (serve psql e un server avviato).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=custode_test
PSQL="psql -X -q -v ON_ERROR_STOP=1 ${PGURL:-}"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d $DB -f supabase/tests/supabase-stub.sql >/dev/null
for f in supabase/migrations/*.sql supabase/seed.sql; do $PSQL -d $DB -f "$f" >/dev/null; done
OUT=$($PSQL -d $DB -t -A -f supabase/tests/rls.test.sql)
echo "$OUT"
if echo "$OUT" | grep -qx 'f'; then echo "TEST FALLITO"; exit 1; fi
echo "Tutti i test RLS superati"

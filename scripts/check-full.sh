#!/usr/bin/env sh
# Full verification: the database-free checks plus the functional suite.
#
# Starts the local Postgres container if it is not running, ensures the
# `database_test` database exists, runs scripts/check.sh and test:functional,
# and stops the container only if this script started it (a database that was
# already running is left alone).
set -eu

COMPOSE_SERVICE=postgres_db
CONTAINER=postgres_db
DB_USER=${DB_USER:-postgres}
TEST_DB=database_test

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run the functional suite" >&2
  exit 1
fi

echo "=== DB-FREE CHECKS ==="
./scripts/check.sh

started=0
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)" != "true" ]; then
  echo "=== START POSTGRES ==="
  docker compose up -d "$COMPOSE_SERVICE"
  started=1
fi

cleanup() {
  if [ "$started" -eq 1 ]; then
    echo "=== STOP POSTGRES (started by this script) ==="
    docker compose stop "$COMPOSE_SERVICE" >/dev/null
  fi
}
trap cleanup EXIT

echo "=== WAIT FOR POSTGRES ==="
attempts=0
until docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d postgres >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    echo "Postgres did not become ready within 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

echo "=== ENSURE $TEST_DB ==="
if ! docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB'" | grep -q 1; then
  docker exec "$CONTAINER" createdb -U "$DB_USER" "$TEST_DB"
fi

echo "=== FUNCTIONAL TESTS ==="
yarn test:functional

echo "=== ALL CHECKS PASSED ==="

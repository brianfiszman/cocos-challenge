#!/bin/bash
set -e

# POSTGRES_DB creates database_development automatically.
# CREATE DATABASE cannot run inside a transaction, so use psql -c directly.
for db in database_test database_production; do
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c \
    "SELECT 'CREATE DATABASE $db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')" \
    | grep -q "CREATE DATABASE" && psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $db" || true
done

#!/usr/bin/env sh
set -e

DB_HOST="${DB_HOST:-postgres_db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-database_development}"

echo "[entrypoint] waiting for database at ${DB_HOST}:${DB_PORT}..."
until node scripts/db-check.js ping; do
  sleep 1
done

echo "[entrypoint] running migrations..."
npx sequelize-cli db:migrate

echo "[entrypoint] running seeders (idempotent; skipped if data exists)..."
npx sequelize-cli db:seed:all

if [ "${NODE_ENV:-development}" = "development" ]; then
  echo "[entrypoint] starting app in dev (watch) mode"
  exec yarn start:dev
else
  echo "[entrypoint] starting app in production mode"
  exec node dist/main.js
fi

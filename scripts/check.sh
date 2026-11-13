#!/usr/bin/env sh
# Run the database-free verification suite: typecheck, lint, build, unit + e2e.
# For the full gate including the functional suite, run scripts/check-full.sh
# (or `yarn check:full`), which starts and stops Postgres around it.
set -e

echo "=== TSC ==="
npx tsc --noEmit

echo "=== LINT ==="
yarn eslint .

echo "=== BUILD ==="
yarn build

echo "=== SHELL SYNTAX ==="
sh -n scripts/entrypoint.sh
sh -n scripts/check.sh
sh -n scripts/check-full.sh

echo "=== UNIT TESTS ==="
yarn test

echo "=== E2E TESTS ==="
yarn test:e2e

echo "=== ALL CHECKS PASSED ==="

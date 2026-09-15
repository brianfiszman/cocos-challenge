#!/usr/bin/env sh
# Run the full verification suite: typecheck, lint, build, unit + e2e tests.
# Use this after every edit so errors are caught before they reach the user.
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

echo "=== UNIT TESTS ==="
yarn test

echo "=== E2E TESTS ==="
yarn test:e2e

echo "=== ALL CHECKS PASSED ==="

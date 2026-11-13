#!/usr/bin/env node
'use strict';

/**
 * Ensures the functional suite has a `database_test` database.
 *
 * `init.sh` only creates it when the Postgres volume is initialized, so an
 * existing volume has a working app but no test database. This script runs as
 * `pretest:functional` and fails with a clear message instead of letting Jest
 * surface a raw driver error.
 */

const { Client } = require('pg');

const TEST_DB = 'database_test';
const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 5432);
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';

const startHint =
  '[test-db] Start Postgres with `docker compose up -d postgres_db`, ' +
  'or run `yarn check:full`, which manages the container for you.';

/**
 * `pg` reports multi-address connection failures as an AggregateError with an
 * empty `message`; fall back to its error codes so the output stays useful.
 */
function describeError(err) {
  if (err.message) {
    return err.message;
  }
  if (err.code) {
    return err.code;
  }
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return [
      ...new Set(err.errors.map((inner) => inner.code || inner.message)),
    ].join(', ');
  }
  return String(err);
}

async function main() {
  // Connect to the maintenance database: database_test may not exist yet.
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(
      `[test-db] Cannot connect to Postgres at ${host}:${port}: ${describeError(err)}`,
    );
    console.error(startHint);
    process.exitCode = 1;
    return;
  }

  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB],
    );

    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DB}"`);
      console.log(`[test-db] Created ${TEST_DB}.`);
    }
  } catch (err) {
    console.error(
      `[test-db] Could not ensure ${TEST_DB}: ${describeError(err)}`,
    );
    console.error(
      `[test-db] Create it manually with: createdb -h ${host} -p ${port} -U ${user} ${TEST_DB}`,
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[test-db] Unexpected error: ${describeError(err)}`);
  process.exitCode = 1;
});

#!/usr/bin/env node
// DB readiness + migration guard helpers used by scripts/entrypoint.sh.
'use strict';

const { Client } = require('pg');

const cfg = {
  host: process.env.DB_HOST || 'postgres_db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'database_development',
};

async function checkConnection() {
  const client = new Client(cfg);
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function sequelizeMetaExists() {
  const client = new Client(cfg);
  try {
    await client.connect();
    // sequelize-cli names the meta table "SequelizeMeta".
    const res = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'SequelizeMeta'",
    );
    await client.end();
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

const cmd = process.argv[2];
(async () => {
  if (cmd === 'ping') {
    process.exit((await checkConnection()) ? 0 : 1);
  }
  if (cmd === 'migrated') {
    process.exit((await sequelizeMetaExists()) ? 0 : 1);
  }
  process.stderr.write(`Unknown command: ${cmd}\n`);
  process.exit(2);
})();

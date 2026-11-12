import { Sequelize } from 'sequelize-typescript';

/**
 * Recreates the public schema from scratch and builds tables from the models.
 *
 * Using `sync` instead of running the migrations keeps the harness fast and
 * independent of migration state, at the cost of not validating migrations.
 * Migrations are exercised separately by the docker entrypoint.
 */
export async function resetSchema(sequelize: Sequelize): Promise<void> {
  await sequelize.query('DROP SCHEMA IF EXISTS public CASCADE');
  await sequelize.query('CREATE SCHEMA public');
  await sequelize.sync({ force: true });
}

/** Clears all tables between tests, resetting sequences. */
export async function truncateAll(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE orders, marketdata, instruments, users RESTART IDENTITY CASCADE',
  );
}

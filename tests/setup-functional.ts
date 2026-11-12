process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'postgres';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_USER = process.env.DB_USER ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
// Forced so the first env file loaded by ConfigModule cannot point tests at
// the development database.
process.env.DB_NAME = 'database_test';

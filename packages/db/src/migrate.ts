import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Migrations run in CI, never from a request handler, and always against the
 * DIRECT (unpooled) connection — transaction-mode poolers cannot hold the
 * advisory lock a migration needs.
 */
const url = process.env['POSTGRES_URL_UNPOOLED'] ?? process.env['POSTGRES_URL'];
if (!url) throw new Error('POSTGRES_URL_UNPOOLED is not set.');

const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: './packages/db/migrations' });
await sql.end();
process.stdout.write('migrations applied\n');

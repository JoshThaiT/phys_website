import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * The one database client. Import this; never construct a client inside a
 * handler.
 *
 * Every serverless invocation is a fresh process, so the connection budget is
 * spent per-request. Two rules follow, and violating either takes production
 * down under load rather than in development:
 *
 *   1. Use the POOLED connection string. The unpooled URL is for migrations.
 *   2. Keep max connections at 1 per process and let the pooler multiplex.
 *
 * The module-level cache below survives warm invocations on the same instance,
 * which is the only reuse serverless gives us.
 */
declare global {
  var __dbClient: ReturnType<typeof createClient> | undefined;
}

function connectionString(): string {
  const url = process.env['POSTGRES_URL'];
  if (!url) {
    throw new Error('POSTGRES_URL is not set. Copy .env.example to .env.local.');
  }
  if (process.env['NODE_ENV'] === 'production' && !url.includes('-pooler')) {
    throw new Error(
      'POSTGRES_URL does not look pooled. Using the direct connection from a ' +
        'serverless handler exhausts the connection limit. Use the -pooler host.',
    );
  }
  return url;
}

function createClient() {
  const sql = postgres(connectionString(), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // transaction-mode poolers do not support prepared statements
  });
  return drizzle(sql, { schema });
}

/** Lazily created and cached for the lifetime of the warm instance. */
export function getDb() {
  globalThis.__dbClient ??= createClient();
  return globalThis.__dbClient;
}

export type Db = ReturnType<typeof createClient>;

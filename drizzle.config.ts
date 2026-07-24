import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/db/src/schema.ts',
  out: './packages/db/migrations',
  dialect: 'postgresql',
  // Generation and application both use the direct connection, never the pooler.
  dbCredentials: { url: process.env['POSTGRES_URL_UNPOOLED'] ?? '' },
} satisfies Config;

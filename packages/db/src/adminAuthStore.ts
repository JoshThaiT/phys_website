import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { authTokens, sessions, users } from './schema.js';

/**
 * Drizzle-backed store for the admin (reception) sign-in lifecycle.
 *
 * This lives in `packages/db`, not `apps/api`, because pnpm's workspace
 * isolation means `apps/api` has no direct dependency on `drizzle-orm` —
 * only `packages/db` declares it. Centralising the query operators
 * (`eq`, ...) here keeps every route handler free of any drizzle-orm
 * import; a handler only ever sees the plain-object store seam it declares
 * for itself, matching the pattern already used by
 * `apps/api/routes/booking-requests.ts`'s `BookingStore`.
 *
 * The returned object is intentionally untyped against any interface
 * declared in `apps/api` — TypeScript's structural typing is what makes it
 * assignable to the route's own `AdminAuthRouteStore`/`AdminAuthStore`
 * shape without a cross-package type dependency in either direction.
 */
export function createAdminAuthStore(db: Db) {
  return {
    async findUserByEmail(email: string) {
      const rows = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return rows[0] ?? null;
    },

    async findSessionByTokenHash(hash: string) {
      const rows = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          userEmail: users.email,
          userName: users.name,
          lastSeenAt: sessions.lastSeenAt,
          absoluteExpiresAt: sessions.absoluteExpiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, hash))
        .limit(1);
      return rows[0] ?? null;
    },

    async touchSession(id: string, lastSeenAt: Date): Promise<void> {
      await db.update(sessions).set({ lastSeenAt }).where(eq(sessions.id, id));
    },

    async insertAuthToken(row: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
      await db.insert(authTokens).values(row);
    },

    async findAuthTokenByHash(hash: string) {
      const rows = await db
        .select({
          id: authTokens.id,
          userId: authTokens.userId,
          expiresAt: authTokens.expiresAt,
          consumedAt: authTokens.consumedAt,
        })
        .from(authTokens)
        .where(eq(authTokens.tokenHash, hash))
        .limit(1);
      return rows[0] ?? null;
    },

    async consumeAuthToken(id: string, at: Date): Promise<void> {
      await db.update(authTokens).set({ consumedAt: at }).where(eq(authTokens.id, id));
    },

    async insertSession(row: { userId: string; tokenHash: string; absoluteExpiresAt: Date }): Promise<void> {
      await db.insert(sessions).values(row);
    },

    async revokeSessionByTokenHash(hash: string, at: Date): Promise<void> {
      await db.update(sessions).set({ revokedAt: at }).where(eq(sessions.tokenHash, hash));
    },
  };
}

import { and, count, eq, gte } from 'drizzle-orm';
import type { Db } from './client.js';
import { bookingRequests } from './schema.js';

/**
 * Drizzle-backed store behind the `BookingStore` seam that
 * `apps/api/routes/booking-requests.ts` depends on. Lives in `packages/db`
 * for the same reason as `purgeStore.ts` / `adminRequestsStore.ts` —
 * `apps/api` has no direct dependency on `drizzle-orm`'s query operators
 * under this workspace's pnpm isolation (CLAUDE.md).
 */
export function createBookingStore(db: Db) {
  return {
    /** Rows with this `sourceHash` and `createdAt >= since` — nothing else.
     *  `>=` matches the handler's inclusive window semantics. Always a
     *  number, never `undefined`, even when nothing matches. */
    async countSince(sourceHash: string, since: Date): Promise<number> {
      const rows = await db
        .select({ value: count() })
        .from(bookingRequests)
        .where(and(eq(bookingRequests.sourceHash, sourceHash), gte(bookingRequests.createdAt, since)));
      return Number(rows[0]?.value ?? 0);
    },

    /** `null` when no row matches — never throws on a miss. */
    async findByIdempotencyKey(key: string): Promise<{ reference: string } | null> {
      const rows = await db
        .select({ reference: bookingRequests.reference })
        .from(bookingRequests)
        .where(eq(bookingRequests.idempotencyKey, key))
        .limit(1);
      const row = rows[0];
      return row ? { reference: row.reference } : null;
    },

    /**
     * Single `INSERT` naming exactly the 002 fields. Deliberately omits every
     * admin/attribution column (`status`, `version`, `createdAt`,
     * `internalNote`, `lastActionedBy`, `statusUpdatedAt`, `contactedAt`) so
     * they keep taking their schema defaults, exactly as 002's insert always
     * has — 003/004 expanded the table without changing this contract.
     */
    async insert(row: {
      reference: string;
      serviceSlug: string;
      practitioner: string | null;
      fullName: string;
      phone: string | null;
      email: string | null;
      preferred: string[];
      reason: string | null;
      consentAt: Date;
      sourceHash: string;
      idempotencyKey: string | null;
      purgeAfter: Date;
    }): Promise<void> {
      await db.insert(bookingRequests).values({
        reference: row.reference,
        serviceSlug: row.serviceSlug,
        practitioner: row.practitioner,
        fullName: row.fullName,
        phone: row.phone,
        email: row.email,
        preferred: row.preferred,
        reason: row.reason,
        consentAt: row.consentAt,
        sourceHash: row.sourceHash,
        idempotencyKey: row.idempotencyKey,
        purgeAfter: row.purgeAfter,
      });
    },
  };
}

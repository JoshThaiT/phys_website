import { and, asc, eq, gt, inArray, lt, ne, or } from 'drizzle-orm';
import type { Db } from './client.js';
import { adminAudit, bookingRequests } from './schema.js';

/** The only fields the purge job's eligibility rule depends on. Deliberately
 *  has no `reason` — see `packages/shared/src/purge.ts`. */
export interface PurgeCandidateRow {
  id: string;
  status: string;
  purgeAfter: Date;
  statusUpdatedAt: Date | null;
  contactedAt: Date | null;
}

/**
 * Store backing the daily purge job (004). Lives in `packages/db` for the
 * same reason as `adminRequestsStore.ts` — `apps/api` has no direct
 * dependency on `drizzle-orm`'s query operators under this workspace's pnpm
 * isolation.
 *
 * The SQL here is a thin, index-backed prefilter — a superset of rows that
 * *might* be eligible — never the final eligibility arbiter. A row this
 * query excludes (pending, `purgeAfter` in the future) can never be
 * eligible; a row it includes may still turn out to be `keep`, which is
 * `purgeDecision`'s call, not this query's.
 */
export function createPurgeStore(db: Db) {
  return {
    /** Ordered by id for a stable keyset scoped to this run only — nothing
     *  is persisted across runs, so an interrupted run simply re-scans from
     *  the start next time, naturally skipping whatever it already deleted. */
    async selectCandidates({
      now,
      cursor,
      limit,
    }: {
      now: Date;
      cursor: string | null;
      limit: number;
    }): Promise<PurgeCandidateRow[]> {
      const maybeEligible = or(
        and(eq(bookingRequests.status, 'pending'), lt(bookingRequests.purgeAfter, now)),
        ne(bookingRequests.status, 'pending'),
      );
      const where = cursor ? and(maybeEligible, gt(bookingRequests.id, cursor)) : maybeEligible;

      return db
        .select({
          id: bookingRequests.id,
          status: bookingRequests.status,
          purgeAfter: bookingRequests.purgeAfter,
          statusUpdatedAt: bookingRequests.statusUpdatedAt,
          contactedAt: bookingRequests.contactedAt,
        })
        .from(bookingRequests)
        .where(where)
        .orderBy(asc(bookingRequests.id))
        .limit(limit);
    },

    /** Hard delete, never a soft-delete flag (AC5). No-op on an empty list. */
    async deleteByIds(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      await db.delete(bookingRequests).where(inArray(bookingRequests.id, ids));
    },

    /** The only residue of a run: counts and a timestamp, never a reference,
     *  name, contact, or `reason` (AC6/AC7). */
    async writeRunAudit({
      deletedUnactioned,
      deletedActioned,
      at,
    }: {
      deletedUnactioned: number;
      deletedActioned: number;
      at: Date;
    }): Promise<void> {
      await db.insert(adminAudit).values({
        actorId: null,
        action: 'purge_run',
        reference: null,
        requestId: null,
        fromStatus: null,
        toStatus: null,
        deletedUnactioned,
        deletedActioned,
        at,
      });
    },
  };
}

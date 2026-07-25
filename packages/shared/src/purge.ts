import { z } from 'zod';

/**
 * Eligibility rule for the daily purge job (004) — the sole arbiter of
 * whether a `booking_requests` row is deleted. A pure function over
 * primitive fields, never `reason`, so both retention clocks and the
 * "never delete on ambiguous timing" default are pinned by boundary tests
 * with no database harness; the store's SQL is only a superset prefilter,
 * never the final word (see `packages/db/src/purgeStore.ts`).
 */

/** Retention for an actioned request: eligible this many days after the
 *  moment it was actioned, regardless of `purgeAfter` (spec 004, clock 2). */
export const ACTIONED_RETENTION_DAYS = 30;

/** Rows fetched per DB round-trip within a run. */
export const PURGE_BATCH_SIZE = 100;

/** Upper bound on rows processed in a single invocation, so the job always
 *  fits its serverless time budget; a run that hits this reports
 *  `completed: false` and the remainder waits for the next scheduled run
 *  (AC12). */
export const PURGE_RUN_ROW_CEILING = 500;

export type PurgeDecision = 'unactioned' | 'actioned' | 'keep';

/** The only fields eligibility depends on. Deliberately has no `reason`. */
export interface PurgeEligibilityInput {
  status: string;
  purgeAfter: Date;
  statusUpdatedAt: Date | null;
  contactedAt: Date | null;
}

/**
 * The two clocks, in one place:
 *  - **unactioned** (still `pending`, never contacted): eligible once
 *    `purgeAfter` has passed (AC1/AC4).
 *  - **actioned** (non-`pending`, or a contact timestamp is recorded even if
 *    the status was never moved off `pending`): eligible
 *    `ACTIONED_RETENTION_DAYS` after the moment it was actioned, regardless
 *    of `purgeAfter` (AC2/AC3).
 *
 * The actioned anchor is `statusUpdatedAt ?? contactedAt`. If both are null
 * on an actioned row the anchor is undefined, so the row is kept rather than
 * deleted on ambiguous timing (AC11).
 */
export function purgeDecision(row: PurgeEligibilityInput, now: Date): PurgeDecision {
  const isActioned = row.status !== 'pending' || row.contactedAt !== null;

  if (!isActioned) {
    return row.purgeAfter.getTime() <= now.getTime() ? 'unactioned' : 'keep';
  }

  const anchor = row.statusUpdatedAt ?? row.contactedAt;
  if (!anchor) return 'keep';

  const eligibleAt = anchor.getTime() + ACTIONED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return eligibleAt <= now.getTime() ? 'actioned' : 'keep';
}

/** Response body of `GET /api/purge` — counts only, never an identifier. */
export const purgeRunResultSchema = z.object({
  deletedUnactioned: z.number().int().nonnegative(),
  deletedActioned: z.number().int().nonnegative(),
  completed: z.boolean(),
});
export type PurgeRunResult = z.infer<typeof purgeRunResultSchema>;

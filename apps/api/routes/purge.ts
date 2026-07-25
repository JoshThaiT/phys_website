import { timingSafeEqual } from 'node:crypto';
import { purgeDecision, purgeRunResultSchema, PURGE_BATCH_SIZE, PURGE_RUN_ROW_CEILING } from 'shared';
import { route, unauthenticated, type Handler, type Req, type Res } from '../handler.js';
import { createPurgeStore, getDb } from 'db';

/**
 * Internal, scheduler-only endpoint (spec/plan 004). Not linked from any
 * client and never reachable without `CRON_SECRET` — the secret check is the
 * first statement in the handler, before any DB access (AC8).
 */

export interface PurgeCandidateRow {
  id: string;
  status: string;
  purgeAfter: Date;
  statusUpdatedAt: Date | null;
  contactedAt: Date | null;
}

export interface PurgeStore {
  selectCandidates(params: { now: Date; cursor: string | null; limit: number }): Promise<PurgeCandidateRow[]>;
  deleteByIds(ids: string[]): Promise<void>;
  writeRunAudit(params: { deletedUnactioned: number; deletedActioned: number; at: Date }): Promise<void>;
}

export interface Deps {
  store: PurgeStore;
  now?: () => Date;
  /** Injectable so tests never depend on process.env. Defaults to CRON_SECRET. */
  cronSecret?: () => string | undefined;
}

/** Constant-time so a wrong guess can't be distinguished from a right one by
 *  response latency. Length is compared first because `timingSafeEqual`
 *  throws (rather than returning false) on a length mismatch. */
function isAuthorized(req: Req, expected: string | undefined): boolean {
  if (!expected) return false;
  const header = req.headers['authorization'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || !raw.startsWith('Bearer ')) return false;
  const provided = Buffer.from(raw.slice('Bearer '.length));
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length) return false;
  return timingSafeEqual(provided, wanted);
}

export function createHandler({
  store,
  now = () => new Date(),
  cronSecret = () => process.env['CRON_SECRET'],
}: Deps) {
  return route(['GET'], async (req: Req, res: Res) => {
    if (!isAuthorized(req, cronSecret())) throw unauthenticated('This endpoint requires the scheduler secret.');

    const at = now();
    let cursor: string | null = null;
    let deletedUnactioned = 0;
    let deletedActioned = 0;
    let processed = 0;

    while (processed < PURGE_RUN_ROW_CEILING) {
      const limit = Math.min(PURGE_BATCH_SIZE, PURGE_RUN_ROW_CEILING - processed);
      const batch = await store.selectCandidates({ now: at, cursor, limit });
      if (batch.length === 0) break;

      const toDelete: string[] = [];
      for (const row of batch) {
        const decision = purgeDecision(row, at);
        if (decision === 'unactioned') {
          toDelete.push(row.id);
          deletedUnactioned += 1;
        } else if (decision === 'actioned') {
          toDelete.push(row.id);
          deletedActioned += 1;
        }
      }
      if (toDelete.length > 0) await store.deleteByIds(toDelete);

      processed += batch.length;
      cursor = batch[batch.length - 1]?.id ?? cursor;

      if (batch.length < limit) break; // fewer rows than asked for: table is exhausted
    }

    const completed = processed < PURGE_RUN_ROW_CEILING;
    await store.writeRunAudit({ deletedUnactioned, deletedActioned, at });
    res.status(200).json(purgeRunResultSchema.parse({ deletedUnactioned, deletedActioned, completed }));
  });
}

/**
 * Real wiring, lazily constructed on first invocation — see the matching
 * comment in admin-auth.ts for why this is not module-scope work.
 */
let cached: Handler | undefined;

export default function handler(req: Req, res: Res): Promise<void> | void {
  cached ??= createHandler({ store: createPurgeStore(getDb()) });
  return cached(req, res);
}

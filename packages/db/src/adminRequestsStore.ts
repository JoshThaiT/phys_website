import { and, desc, eq, gt, lt, or } from 'drizzle-orm';
import type { Db } from './client.js';
import { adminAudit, bookingRequests, users } from './schema.js';

const SETTABLE_STATUSES = ['contacted', 'scheduled', 'declined'] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

function isSettableStatus(value: string): value is SettableStatus {
  return (SETTABLE_STATUSES as readonly string[]).includes(value);
}

/**
 * Column projection for the list/detail/update/delete lifecycle. Deliberately
 * OMITS `bookingRequests.reason` — that is the SQL-level guarantee the plan
 * promised: no query built from these columns can ever return health
 * information, regardless of what any downstream Zod schema does. The only
 * column set that selects `reason` is `REASON_COLUMNS` below, used solely by
 * the reveal path.
 */
const LIST_COLUMNS = {
  id: bookingRequests.id,
  reference: bookingRequests.reference,
  status: bookingRequests.status,
  serviceSlug: bookingRequests.serviceSlug,
  practitioner: bookingRequests.practitioner,
  fullName: bookingRequests.fullName,
  phone: bookingRequests.phone,
  email: bookingRequests.email,
  preferred: bookingRequests.preferred,
  createdAt: bookingRequests.createdAt,
  statusUpdatedAt: bookingRequests.statusUpdatedAt,
  contactedAt: bookingRequests.contactedAt,
  internalNote: bookingRequests.internalNote,
  version: bookingRequests.version,
  lastActionedByEmail: users.email,
  lastActionedByName: users.name,
} as const;

/** `reason` is selected here, and only here — keyed by id, nothing else. */
const REASON_COLUMNS = {
  id: bookingRequests.id,
  reason: bookingRequests.reason,
} as const;

interface SelectedRow {
  id: string;
  reference: string;
  status: string;
  serviceSlug: string;
  practitioner: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  preferred: string[];
  createdAt: Date;
  statusUpdatedAt: Date | null;
  contactedAt: Date | null;
  internalNote: string | null;
  version: number;
  lastActionedByEmail: string | null;
  lastActionedByName: string | null;
}

function toRow(r: SelectedRow) {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    serviceSlug: r.serviceSlug,
    practitioner: r.practitioner,
    fullName: r.fullName,
    phone: r.phone,
    email: r.email,
    preferred: r.preferred,
    createdAt: r.createdAt,
    statusUpdatedAt: r.statusUpdatedAt,
    contactedAt: r.contactedAt,
    internalNote: r.internalNote,
    version: r.version,
    lastActionedBy: r.lastActionedByEmail
      ? { email: r.lastActionedByEmail, name: r.lastActionedByName }
      : null,
  };
}

/**
 * Drizzle-backed store for the admin request list/detail/update/delete
 * lifecycle. Lives in `packages/db` for the same reason as
 * `adminAuthStore.ts` — `apps/api` has no direct dependency on
 * `drizzle-orm`'s query operators under this workspace's pnpm isolation.
 */
export function createAdminRequestsStore(db: Db) {
  return {
    async list({
      limit,
      cursor,
      now,
    }: {
      limit: number;
      cursor: { createdAt: Date; id: string } | null;
      now: Date;
    }) {
      const notPurged = gt(bookingRequests.purgeAfter, now);
      const cursorCondition = cursor
        ? or(
            lt(bookingRequests.createdAt, cursor.createdAt),
            and(eq(bookingRequests.createdAt, cursor.createdAt), lt(bookingRequests.id, cursor.id)),
          )
        : undefined;
      const whereClause = cursorCondition ? and(notPurged, cursorCondition) : notPurged;

      const rows = await db
        .select(LIST_COLUMNS)
        .from(bookingRequests)
        .leftJoin(users, eq(users.id, bookingRequests.lastActionedBy))
        .where(whereClause)
        .orderBy(desc(bookingRequests.createdAt), desc(bookingRequests.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return { rows: page.map(toRow), hasMore };
    },

    async findById(id: string, now: Date) {
      const rows = await db
        .select(LIST_COLUMNS)
        .from(bookingRequests)
        .leftJoin(users, eq(users.id, bookingRequests.lastActionedBy))
        .where(and(eq(bookingRequests.id, id), gt(bookingRequests.purgeAfter, now)))
        .limit(1);
      const row = rows[0];
      return row ? toRow(row) : null;
    },

    /**
     * The ONLY store method that selects `reason`. Backs the dedicated
     * reveal action exclusively — the list and detail reads above never
     * touch this column set. Keyed by id, scoped to the same non-purged
     * window as the rest of the view.
     */
    async findReasonById(id: string, now: Date) {
      const rows = await db
        .select(REASON_COLUMNS)
        .from(bookingRequests)
        .where(and(eq(bookingRequests.id, id), gt(bookingRequests.purgeAfter, now)))
        .limit(1);
      const row = rows[0];
      return row ? { reason: row.reason } : null;
    },

    async historyFor(requestId: string) {
      const rows = await db
        .select({
          id: adminAudit.id,
          action: adminAudit.action,
          fromStatus: adminAudit.fromStatus,
          toStatus: adminAudit.toStatus,
          actorEmail: users.email,
          actorName: users.name,
          at: adminAudit.at,
        })
        .from(adminAudit)
        .innerJoin(users, eq(users.id, adminAudit.actorId))
        .where(eq(adminAudit.requestId, requestId))
        .orderBy(desc(adminAudit.at));

      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        actor: { email: r.actorEmail, name: r.actorName },
        at: r.at,
      }));
    },

    async updateStatusAndNote({
      id,
      expectedVersion,
      status,
      note,
      actor,
      at,
    }: {
      id: string;
      expectedVersion: number;
      status?: string;
      note?: string;
      actor: { id: string; email: string; name: string | null };
      at: Date;
    }) {
      return db.transaction(async (tx) => {
        const current = await tx
          .select(LIST_COLUMNS)
          .from(bookingRequests)
          .leftJoin(users, eq(users.id, bookingRequests.lastActionedBy))
          .where(eq(bookingRequests.id, id))
          .limit(1);
        const existing = current[0];
        if (!existing) return { outcome: 'not_found' as const };

        if (existing.version !== expectedVersion) {
          return { outcome: 'conflict' as const, row: toRow(existing) };
        }

        const patch: {
          version: number;
          lastActionedBy: string;
          statusUpdatedAt: Date;
          status?: SettableStatus;
          contactedAt?: Date;
          internalNote?: string;
        } = {
          version: existing.version + 1,
          lastActionedBy: actor.id,
          statusUpdatedAt: at,
        };
        if (status) {
          if (!isSettableStatus(status)) throw new Error(`Not a settable status: ${status}`);
          patch.status = status;
          if (status === 'contacted' && !existing.contactedAt) patch.contactedAt = at;
        }
        if (note !== undefined) patch.internalNote = note;

        const updated = await tx
          .update(bookingRequests)
          .set(patch)
          .where(and(eq(bookingRequests.id, id), eq(bookingRequests.version, expectedVersion)))
          .returning({ id: bookingRequests.id });

        if (updated.length === 0) {
          // Lost a race between the read above and this write.
          return { outcome: 'conflict' as const, row: toRow(existing) };
        }

        await tx.insert(adminAudit).values({
          actorId: actor.id,
          action: 'status_change',
          reference: existing.reference,
          requestId: id,
          fromStatus: existing.status,
          toStatus: status ?? existing.status,
          at,
        });

        const after = await tx
          .select(LIST_COLUMNS)
          .from(bookingRequests)
          .leftJoin(users, eq(users.id, bookingRequests.lastActionedBy))
          .where(eq(bookingRequests.id, id))
          .limit(1);
        const row = after[0];
        if (!row) return { outcome: 'not_found' as const };
        return { outcome: 'ok' as const, row: toRow(row) };
      });
    },

    async deleteWithAudit({
      id,
      actor,
      at,
    }: {
      id: string;
      actor: { id: string; email: string; name: string | null };
      at: Date;
    }) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: bookingRequests.id, reference: bookingRequests.reference })
          .from(bookingRequests)
          .where(eq(bookingRequests.id, id))
          .limit(1);
        const row = rows[0];
        if (!row) return 'not_found' as const;

        await tx.insert(adminAudit).values({
          actorId: actor.id,
          action: 'delete',
          reference: row.reference,
          requestId: null,
          fromStatus: null,
          toStatus: null,
          at,
        });
        await tx.delete(bookingRequests).where(eq(bookingRequests.id, id));
        return 'deleted' as const;
      });
    },
  };
}

import {
  adminActorSchema,
  adminRequestDetailSchema,
  adminRequestListResponseSchema,
  adminRevealRequestSchema,
  adminRevealResponseSchema,
  adminStatusUpdateSchema,
  apiError,
  ERROR_CODES,
  pageQuerySchema,
  type AdminActor,
} from 'shared';
import { badRequest, notFound, route, type Handler, type Req, type Res } from '../handler.js';
import { requireAdmin, type AdminActorRecord, type AdminAuthStore } from '../lib/adminAuth.js';
import { createAdminAuthStore, createAdminRequestsStore, getDb } from 'db';

/**
 * Store row shapes are deliberately plain (`string`, not the narrow shared
 * enum types): the Drizzle implementation in `packages/db` infers its own
 * (often narrower) types from the schema, and every field that reaches the
 * client is re-validated by the Zod response schema at the point it is
 * serialised, which is the actual narrowing boundary.
 *
 * `reason` (HEALTH INFORMATION) does not exist on this type at all — that is
 * the compile-time half of the SQL-level guarantee in
 * `packages/db/src/adminRequestsStore.ts`. The list and detail queries never
 * select the column, so there is no field here to accidentally forward. The
 * only row shape that carries it is `AdminRequestReasonRow`, returned
 * exclusively by `AdminRequestsStore.findReasonById` for the reveal handler.
 */
export interface AdminRequestRow {
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
  lastActionedBy: AdminActor | null;
}

/** The single row shape allowed to carry `reason`. Returned only by
 *  `findReasonById`, consumed only by the reveal POST handler below. */
export interface AdminRequestReasonRow {
  reason: string | null;
}

export interface AdminHistoryEntryRow {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actor: AdminActor;
  at: Date;
}

export interface AdminRequestsStore {
  list(params: {
    limit: number;
    cursor: { createdAt: Date; id: string } | null;
    now: Date;
  }): Promise<{ rows: AdminRequestRow[]; hasMore: boolean }>;
  findById(id: string, now: Date): Promise<AdminRequestRow | null>;
  /** Backs the reveal action only. The only method allowed to return `reason`. */
  findReasonById(id: string, now: Date): Promise<AdminRequestReasonRow | null>;
  historyFor(id: string): Promise<AdminHistoryEntryRow[]>;
  updateStatusAndNote(params: {
    id: string;
    expectedVersion: number;
    status?: string;
    note?: string;
    actor: AdminActorRecord;
    at: Date;
  }): Promise<
    | { outcome: 'ok'; row: AdminRequestRow }
    | { outcome: 'conflict'; row: AdminRequestRow }
    | { outcome: 'not_found' }
  >;
  deleteWithAudit(params: {
    id: string;
    actor: AdminActorRecord;
    at: Date;
  }): Promise<'deleted' | 'not_found'>;
}

export interface Deps {
  store: AdminRequestsStore;
  /** Session validation seam `requireAdmin` depends on. */
  sessionStore: AdminAuthStore;
  now?: () => Date;
}

function queryParam(query: Req['query'], key: string): string | undefined {
  const v = query?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function encodeCursor(cursor: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id }), 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('c' in parsed) ||
      !('i' in parsed) ||
      typeof (parsed as { c: unknown }).c !== 'string' ||
      typeof (parsed as { i: unknown }).i !== 'string'
    ) {
      return null;
    }
    const createdAt = new Date((parsed as { c: string }).c);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: (parsed as { i: string }).i };
  } catch {
    return null;
  }
}

/** Whitelisted projection. `row` may carry `reason`; this never reads it. */
function toListItem(row: AdminRequestRow) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    serviceSlug: row.serviceSlug,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    statusUpdatedAt: row.statusUpdatedAt ? row.statusUpdatedAt.toISOString() : null,
    lastActionedBy: row.lastActionedBy ? adminActorSchema.parse(row.lastActionedBy) : null,
  };
}

/** Whitelisted projection. Still never reads `row.reason`. */
function toDetail(row: AdminRequestRow, history: AdminHistoryEntryRow[]) {
  return {
    ...toListItem(row),
    practitioner: row.practitioner,
    preferred: row.preferred,
    internalNote: row.internalNote,
    contactedAt: row.contactedAt ? row.contactedAt.toISOString() : null,
    version: row.version,
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actor: h.actor,
      at: h.at.toISOString(),
    })),
  };
}

export function createHandler({ store, sessionStore, now = () => new Date() }: Deps) {
  return route(['GET', 'POST', 'PATCH', 'DELETE'], async (req: Req, res: Res) => {
    const actor = await requireAdmin(req, sessionStore, now);

    if (req.method === 'GET') {
      const id = queryParam(req.query, 'id');
      const at = now();

      if (id) {
        const row = await store.findById(id, at);
        if (!row) throw notFound('This request is no longer available.');
        const history = await store.historyFor(id);
        res.status(200).json(adminRequestDetailSchema.parse(toDetail(row, history)));
        return;
      }

      const query = pageQuerySchema.safeParse(req.query ?? {});
      if (!query.success) throw badRequest('Invalid list query.');
      let cursor: { createdAt: Date; id: string } | null = null;
      if (query.data.cursor) {
        cursor = decodeCursor(query.data.cursor);
        if (!cursor) throw badRequest('Invalid cursor.');
      }
      const { rows, hasMore } = await store.list({ limit: query.data.limit, cursor, now: at });
      const last = rows[rows.length - 1];
      const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
      res.status(200).json(
        adminRequestListResponseSchema.parse({ items: rows.map(toListItem), nextCursor }),
      );
      return;
    }

    if (req.method === 'POST') {
      const body = adminRevealRequestSchema.safeParse(req.body);
      if (!body.success) throw badRequest('A request id is required.');
      const row = await store.findReasonById(body.data.id, now());
      if (!row) throw notFound('This request is no longer available.');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(adminRevealResponseSchema.parse({ reason: row.reason }));
      return;
    }

    if (req.method === 'PATCH') {
      const id = queryParam(req.query, 'id');
      if (!id) throw badRequest('id is required.');
      const parsedBody = adminStatusUpdateSchema.safeParse(req.body);
      if (!parsedBody.success) throw badRequest('Check the status or note.');
      const body = parsedBody.data;

      const at = now();
      const result = await store.updateStatusAndNote({
        id,
        expectedVersion: body.expectedVersion,
        status: body.status,
        note: body.note,
        actor,
        at,
      });

      if (result.outcome === 'not_found') throw notFound('This request is no longer available.');

      if (result.outcome === 'conflict') {
        const history = await store.historyFor(id);
        res.status(409).json({
          error: apiError(
            ERROR_CODES.CONFLICT,
            'This request was changed by someone else. Refresh to see the current state.',
          ).error,
          current: adminRequestDetailSchema.parse(toDetail(result.row, history)),
        });
        return;
      }

      const history = await store.historyFor(id);
      res.status(200).json(adminRequestDetailSchema.parse(toDetail(result.row, history)));
      return;
    }

    if (req.method === 'DELETE') {
      const id = queryParam(req.query, 'id');
      if (!id) throw badRequest('id is required.');
      const outcome = await store.deleteWithAudit({ id, actor, at: now() });
      if (outcome === 'not_found') throw notFound('This request is no longer available.');
      res.status(204).json(undefined);
      return;
    }
  });
}

/**
 * Real wiring, lazily constructed on first invocation — see the matching
 * comment in admin-auth.ts for why this is not module-scope work.
 */
let cached: Handler | undefined;

export default function handler(req: Req, res: Res): Promise<void> | void {
  cached ??= createHandler({
    store: createAdminRequestsStore(getDb()),
    sessionStore: createAdminAuthStore(getDb()),
  });
  return cached(req, res);
}

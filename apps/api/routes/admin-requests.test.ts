import { describe, it, expect } from 'vitest';
import {
  createHandler,
  type AdminHistoryEntryRow,
  type AdminRequestRow,
  type AdminRequestsStore,
} from './admin-requests.js';
import type { Res } from '../handler.js';
import { hashToken, type AdminAuthStore } from '../lib/adminAuth.js';

/** Test fixture only: the real store never has a row shape carrying both
 *  the list/detail fields and `reason` at once (see `stripReason` below). */
type SeedRow = AdminRequestRow & { reason: string | null };

const REASON = 'lower back pain since my spinal surgery in March';
const NOW = new Date('2026-07-24T09:00:00.000Z');
const ACTOR = { id: 'u1', email: 'reception@meridianphysio.example', name: 'Reception One' };

const ID_1 = '11111111-1111-1111-1111-111111111111';
const ID_2 = '22222222-2222-2222-2222-222222222222';
const ID_GONE = '99999999-9999-9999-9999-999999999999';

/** Deterministic, zod-`.uuid()`-valid ids for the pagination fixture. */
function idFor(n: number): string {
  return `${n.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;
}

function mockRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(c: number) { this.statusCode = c; return this as unknown as Res; },
    json(b: unknown) { this.body = b; },
    setHeader(n: string, v: string) { this.headers[n] = v; },
  };
}

function makeRow(over: Partial<SeedRow> = {}): SeedRow {
  return {
    id: over.id ?? ID_1,
    reference: 'BR-ABC234',
    status: 'pending',
    serviceSlug: 'physiotherapy-initial',
    practitioner: null,
    fullName: 'Jo Nguyen',
    phone: '0412 345 678',
    email: null,
    preferred: [],
    reason: REASON,
    createdAt: NOW,
    statusUpdatedAt: null,
    contactedAt: null,
    internalNote: null,
    version: 0,
    lastActionedBy: null,
    ...over,
  };
}

interface StoredAudit extends AdminHistoryEntryRow {
  requestId: string | null;
}

/** Mirrors `packages/db/src/adminRequestsStore.ts`'s LIST_COLUMNS projection:
 *  every field except `reason`. */
function stripReason(r: SeedRow): AdminRequestRow {
  const {
    id, reference, status, serviceSlug, practitioner, fullName, phone, email,
    preferred, createdAt, statusUpdatedAt, contactedAt, internalNote, version, lastActionedBy,
  } = r;
  return {
    id, reference, status, serviceSlug, practitioner, fullName, phone, email,
    preferred, createdAt, statusUpdatedAt, contactedAt, internalNote, version, lastActionedBy,
  };
}

/** Faithful enough in-memory implementation of the keyset-pagination and
 *  optimistic-concurrency contract to exercise the route without a database.
 *  `reason` is tracked in a side map, never on `rows` — mirroring the real
 *  store, where the list/detail column projection cannot carry it at all. */
function makeStore(seed: SeedRow[] = []) {
  const rows: AdminRequestRow[] = seed.map(stripReason);
  const reasons = new Map<string, string | null>(seed.map((r) => [r.id, r.reason]));
  const audit: StoredAudit[] = [];
  const purgeAfter = new Map<string, Date>();
  let auditSeq = 0;

  function isPurged(id: string, now: Date): boolean {
    const p = purgeAfter.get(id);
    return p !== undefined && p <= now;
  }

  const store: AdminRequestsStore = {
    async list({ limit, cursor, now }) {
      const visible = rows
        .filter((r) => !isPurged(r.id, now))
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
      const filtered = cursor
        ? visible.filter(
            (r) =>
              r.createdAt.getTime() < cursor.createdAt.getTime() ||
              (r.createdAt.getTime() === cursor.createdAt.getTime() && r.id < cursor.id),
          )
        : visible;
      const hasMore = filtered.length > limit;
      return { rows: filtered.slice(0, limit), hasMore };
    },
    async findById(id, now) {
      if (isPurged(id, now)) return null;
      return rows.find((r) => r.id === id) ?? null;
    },
    async findReasonById(id, now) {
      if (isPurged(id, now)) return null;
      if (!reasons.has(id)) return null;
      return { reason: reasons.get(id) ?? null };
    },
    async historyFor(id) {
      return audit.filter((a) => a.requestId === id);
    },
    async updateStatusAndNote({ id, expectedVersion, status, note, actor, at }) {
      const row = rows.find((r) => r.id === id);
      if (!row) return { outcome: 'not_found' };
      if (row.version !== expectedVersion) return { outcome: 'conflict', row: { ...row } };
      const fromStatus = row.status;
      if (status) {
        row.status = status;
        if (status === 'contacted' && !row.contactedAt) row.contactedAt = at;
      }
      if (note !== undefined) row.internalNote = note;
      row.version += 1;
      row.lastActionedBy = { email: actor.email, name: actor.name };
      row.statusUpdatedAt = at;
      auditSeq += 1;
      audit.push({
        id: idFor(1_000_000 + auditSeq),
        action: 'status_change',
        fromStatus,
        toStatus: status ?? fromStatus,
        actor: { email: actor.email, name: actor.name },
        at,
        requestId: id,
      });
      return { outcome: 'ok', row: { ...row } };
    },
    async deleteWithAudit({ id, actor, at }) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return 'not_found';
      rows.splice(idx, 1);
      auditSeq += 1;
      audit.push({
        id: idFor(1_000_000 + auditSeq),
        action: 'delete',
        fromStatus: null,
        toStatus: null,
        actor: { email: actor.email, name: actor.name },
        at,
        requestId: null,
      });
      return 'deleted';
    },
  };

  function setPurgeAfter(id: string, when: Date) {
    purgeAfter.set(id, when);
  }

  return { store, rows, audit, setPurgeAfter };
}

function makeSessionStore(): AdminAuthStore {
  return {
    async findSessionByTokenHash(hash) {
      if (hash !== hashToken('valid')) return null;
      return {
        id: 's1',
        userId: ACTOR.id,
        userEmail: ACTOR.email,
        userName: ACTOR.name,
        lastSeenAt: NOW,
        absoluteExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
        revokedAt: null,
      };
    },
    async touchSession() {},
  };
}

const authedReq = (over: Partial<{ method: string; query: Record<string, string>; body: unknown }> = {}) => ({
  method: over.method ?? 'GET',
  query: over.query ?? {},
  headers: { cookie: 'admin_session=valid' },
  body: over.body,
});

describe('admin-requests auth gate', () => {
  it('rejects an unauthenticated request with 401 and no data', async () => {
    const { store } = makeStore([makeRow()]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler({ method: 'GET', query: {}, headers: {} }, res as unknown as Res);
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('Jo Nguyen');
  });
});

describe('GET /api/admin-requests (list)', () => {
  it('lists non-purged requests newest-first without reason', async () => {
    const older = makeRow({ id: ID_1, createdAt: new Date('2026-07-20T00:00:00Z'), reference: 'BR-OLD001' });
    const newer = makeRow({ id: ID_2, createdAt: new Date('2026-07-23T00:00:00Z'), reference: 'BR-NEW002' });
    const { store } = makeStore([older, newer]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq(), res as unknown as Res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { items: Array<Record<string, unknown>>; nextCursor: string | null };
    expect(body.items.map((i) => i.reference)).toEqual(['BR-NEW002', 'BR-OLD001']);
    expect(JSON.stringify(body)).not.toContain('surgery');
    for (const item of body.items) expect(item).not.toHaveProperty('reason');
  });
});

describe('GET /api/admin-requests?id= (detail)', () => {
  it('the single-record detail read never carries reason', async () => {
    const row = makeRow({ id: ID_1 });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ query: { id: ID_1 } }), res as unknown as Res);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty('reason');
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });
});

describe('POST /api/admin-requests { action: reveal }', () => {
  it('reason is returned only by reveal and never in the list, a log, or an error', async () => {
    const row = makeRow({ id: ID_1 });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });

    const listRes = mockRes();
    await handler(authedReq(), listRes as unknown as Res);
    expect(JSON.stringify(listRes.body)).not.toContain('surgery');

    const revealRes = mockRes();
    await handler(
      authedReq({ method: 'POST', body: { action: 'reveal', id: ID_1 } }),
      revealRes as unknown as Res,
    );
    expect(revealRes.statusCode).toBe(200);
    expect(revealRes.body).toEqual({ reason: REASON });
    expect(revealRes.headers['Cache-Control']).toBe('no-store');
  });

  it('indicates nothing to show when reason is null', async () => {
    const row = makeRow({ id: ID_1, reason: null });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ method: 'POST', body: { action: 'reveal', id: ID_1 } }), res as unknown as Res);
    expect(res.body).toEqual({ reason: null });
  });

  it('a request purged mid-session returns 404, not stale data', async () => {
    const { store } = makeStore([]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ method: 'POST', body: { action: 'reveal', id: ID_GONE } }), res as unknown as Res);
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/admin-requests?id= (status + note)', () => {
  it('records the acting user and time on a status change', async () => {
    const row = makeRow({ id: ID_1, version: 0 });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(
      authedReq({ method: 'PATCH', query: { id: ID_1 }, body: { status: 'scheduled', expectedVersion: 0 } }),
      res as unknown as Res,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { status: string; lastActionedBy: { email: string }; statusUpdatedAt: string };
    expect(body.status).toBe('scheduled');
    expect(body.lastActionedBy.email).toBe(ACTOR.email);
    expect(body.statusUpdatedAt).toBe(NOW.toISOString());
  });

  it('setting contacted stamps contactedAt and writes audit history', async () => {
    const row = makeRow({ id: ID_1, version: 0 });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(
      authedReq({ method: 'PATCH', query: { id: ID_1 }, body: { status: 'contacted', expectedVersion: 0 } }),
      res as unknown as Res,
    );
    const body = res.body as { contactedAt: string; history: Array<Record<string, unknown>> };
    expect(body.contactedAt).toBe(NOW.toISOString());
    expect(body.history.length).toBeGreaterThan(0);
    expect(body.history[0]).toMatchObject({ toStatus: 'contacted', actor: { email: ACTOR.email } });
  });

  it('a stale-version update is rejected 409 with the current state', async () => {
    const row = makeRow({ id: ID_1, version: 0, status: 'pending' });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });

    // First writer succeeds and bumps the version to 1.
    await handler(
      authedReq({ method: 'PATCH', query: { id: ID_1 }, body: { status: 'contacted', expectedVersion: 0 } }),
      mockRes() as unknown as Res,
    );

    // Second writer still thinks the version is 0.
    const res = mockRes();
    await handler(
      authedReq({ method: 'PATCH', query: { id: ID_1 }, body: { status: 'declined', expectedVersion: 0 } }),
      res as unknown as Res,
    );
    expect(res.statusCode).toBe(409);
    const body = res.body as { error: { code: string }; current: { status: string; version: number } };
    expect(body.error.code).toBe('CONFLICT');
    expect(body.current.status).toBe('contacted');
    expect(body.current.version).toBe(1);
  });

  it('a request purged mid-session shows not-available, not a crash', async () => {
    const { store } = makeStore([]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(
      authedReq({ method: 'PATCH', query: { id: ID_GONE }, body: { status: 'contacted', expectedVersion: 0 } }),
      res as unknown as Res,
    );
    expect(res.statusCode).toBe(404);
  });

  it('rejects a body with neither status nor note', async () => {
    const row = makeRow({ id: ID_1 });
    const { store } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(
      authedReq({ method: 'PATCH', query: { id: ID_1 }, body: { expectedVersion: 0 } }),
      res as unknown as Res,
    );
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/admin-requests?id=', () => {
  it('delete writes an audit row with the reference but no reason', async () => {
    const row = makeRow({ id: ID_1, reference: 'BR-DEL999' });
    const { store, audit } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ method: 'DELETE', query: { id: ID_1 } }), res as unknown as Res);
    expect(res.statusCode).toBe(204);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'delete', actor: { email: ACTOR.email } });
    expect(JSON.stringify(audit)).not.toContain('surgery');

    const afterRes = mockRes();
    await handler(authedReq({ query: { id: ID_1 } }), afterRes as unknown as Res);
    expect(afterRes.statusCode).toBe(404);
  });

  it('a delete of a request that no longer exists returns 404', async () => {
    const { store } = makeStore([]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ method: 'DELETE', query: { id: ID_GONE } }), res as unknown as Res);
    expect(res.statusCode).toBe(404);
  });
});

describe('pagination', () => {
  it('paginates by keyset, honours the default 20 / ceiling 100, and returns each row once across pages', async () => {
    const seed = Array.from({ length: 5 }, (_, i) =>
      makeRow({
        id: idFor(i),
        reference: `BR-P${i}`,
        createdAt: new Date(NOW.getTime() - i * 60_000),
      }),
    );
    const { store } = makeStore(seed);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const res = mockRes();
      const query: Record<string, string> = { limit: '2' };
      if (cursor) query['cursor'] = cursor;
      await handler(authedReq({ query }), res as unknown as Res);
      const body = res.body as { items: Array<{ reference: string }>; nextCursor: string | null };
      seen.push(...body.items.map((i) => i.reference));
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('signals no further page on the last page', async () => {
    const { store } = makeStore([makeRow({ id: ID_1 })]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ query: { limit: '20' } }), res as unknown as Res);
    const body = res.body as { nextCursor: string | null };
    expect(body.nextCursor).toBeNull();
  });

  it('rejects a limit above the ceiling of 100', async () => {
    const { store } = makeStore([]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });
    const res = mockRes();
    await handler(authedReq({ query: { limit: '101' } }), res as unknown as Res);
    expect(res.statusCode).toBe(400);
  });

  it('excludes a row purged between page loads rather than serving stale data', async () => {
    const row = makeRow({ id: ID_1 });
    const { store, setPurgeAfter } = makeStore([row]);
    const handler = createHandler({ store, sessionStore: makeSessionStore(), now: () => NOW });

    const before = mockRes();
    await handler(authedReq(), before as unknown as Res);
    expect((before.body as { items: unknown[] }).items).toHaveLength(1);

    // 004 purges the row between page loads.
    setPurgeAfter(ID_1, new Date(NOW.getTime() - 1000));

    const after = mockRes();
    await handler(authedReq(), after as unknown as Res);
    expect((after.body as { items: unknown[] }).items).toHaveLength(0);
  });
});

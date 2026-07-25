import { describe, it, expect, vi } from 'vitest';
import type * as DrizzleOrm from 'drizzle-orm';
import type { Db } from './client.js';

/**
 * `eq` / `gte` / `and` / `count` are replaced with plain descriptor objects
 * so the fake `Db` below can evaluate the condition tree the store builds
 * against an in-memory row set, without a live database. Every other
 * `drizzle-orm` export (used transitively by `./schema.js`) stays real.
 */
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof DrizzleOrm>('drizzle-orm');
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ kind: 'eq' as const, col: col.name, val }),
    gte: (col: { name: string }, val: unknown) => ({ kind: 'gte' as const, col: col.name, val }),
    and: (...conds: unknown[]) => ({ kind: 'and' as const, conds }),
    count: () => ({ kind: 'count' as const }),
  };
});

const { createBookingStore } = await import('./bookingStore.js');

type Cond =
  | { kind: 'eq'; col: string; val: unknown }
  | { kind: 'gte'; col: string; val: unknown }
  | { kind: 'and'; conds: Cond[] };

type FakeRow = Record<string, unknown>;

function evalCond(cond: Cond, row: FakeRow): boolean {
  if (cond.kind === 'eq') return row[cond.col] === cond.val;
  if (cond.kind === 'gte') return (row[cond.col] as Date).getTime() >= (cond.val as Date).getTime();
  return cond.conds.every((c) => evalCond(c, row));
}

/** Thenable AND `.limit()`-able, mirroring Drizzle's own query builder shape
 *  closely enough for the two chains the store actually uses. */
function chainable<T>(result: T) {
  return {
    limit: () => Promise.resolve(result),
    then: (resolve: (v: T) => void, reject?: (e: unknown) => void) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject),
  };
}

/** Hand-rolled `Db` double: records `insert(...).values(...)` calls and
 *  evaluates `select(...).from(...).where(cond)` against a fixed row set,
 *  projecting only the columns the store asked for. */
function makeFakeDb(rows: FakeRow[] = []) {
  const inserted: unknown[] = [];
  const db = {
    select(cols: Record<string, { kind: string; name?: string }>) {
      return {
        from() {
          return {
            where(cond: Cond) {
              const filtered = rows.filter((r) => evalCond(cond, r));
              const isCountShape = Object.values(cols).some((c) => c.kind === 'count');
              const result = isCountShape
                ? [{ value: filtered.length }]
                : filtered.map((r) => {
                    const out: FakeRow = {};
                    for (const [key, col] of Object.entries(cols)) {
                      out[key] = r[col.name as string];
                    }
                    return out;
                  });
              return chainable(result);
            },
          };
        },
      };
    },
    insert() {
      return {
        values(v: unknown) {
          inserted.push(v);
          return Promise.resolve();
        },
      };
    },
  };
  return { db: db as unknown as Db, inserted };
}

const SINCE = new Date('2026-07-21T00:00:00.000Z');
const WITHIN = new Date('2026-07-21T05:00:00.000Z');
const BEFORE = new Date('2026-07-20T23:00:00.000Z');

describe('createBookingStore', () => {
  describe('countSince', () => {
    it('counts only rows matching the source hash inside the window', async () => {
      const { db } = makeFakeDb([
        { source_hash: 'hash-a', created_at: WITHIN },
        { source_hash: 'hash-a', created_at: SINCE }, // boundary: >= is inclusive
        { source_hash: 'hash-a', created_at: BEFORE }, // too old
        { source_hash: 'hash-b', created_at: WITHIN }, // different source
      ]);
      const store = createBookingStore(db);
      await expect(store.countSince('hash-a', SINCE)).resolves.toBe(2);
    });

    it('returns 0, never undefined, when nothing matches', async () => {
      const { db } = makeFakeDb([{ source_hash: 'hash-a', created_at: WITHIN }]);
      const store = createBookingStore(db);
      const result = await store.countSince('hash-z', SINCE);
      expect(result).toBe(0);
      expect(result).not.toBeUndefined();
    });
  });

  describe('findByIdempotencyKey', () => {
    it('returns the reference for a known idempotency key and null otherwise', async () => {
      const { db } = makeFakeDb([{ idempotency_key: 'key-1', reference: 'BR-ABC234' }]);
      const store = createBookingStore(db);
      await expect(store.findByIdempotencyKey('key-1')).resolves.toEqual({ reference: 'BR-ABC234' });
      await expect(store.findByIdempotencyKey('missing')).resolves.toBeNull();
    });
  });

  describe('insert', () => {
    it('inserts every booking field and names no admin column', async () => {
      const { db, inserted } = makeFakeDb();
      const store = createBookingStore(db);
      const consentAt = new Date('2026-07-21T00:00:00.000Z');
      const purgeAfter = new Date('2026-10-19T00:00:00.000Z');

      await store.insert({
        reference: 'BR-ABC234',
        serviceSlug: 'physiotherapy-initial',
        practitioner: 'Alex Rivera',
        fullName: 'Jo Nguyen',
        phone: '0412 345 678',
        email: 'jo@example.com',
        preferred: ['weekday-evening'],
        reason: 'lower back pain',
        consentAt,
        sourceHash: 'hash-a',
        idempotencyKey: 'key-1',
        purgeAfter,
      });

      expect(inserted).toEqual([
        {
          reference: 'BR-ABC234',
          serviceSlug: 'physiotherapy-initial',
          practitioner: 'Alex Rivera',
          fullName: 'Jo Nguyen',
          phone: '0412 345 678',
          email: 'jo@example.com',
          preferred: ['weekday-evening'],
          reason: 'lower back pain',
          consentAt,
          sourceHash: 'hash-a',
          idempotencyKey: 'key-1',
          purgeAfter,
        },
      ]);
      const keys = Object.keys(inserted[0] as object);
      for (const admin of ['status', 'version', 'createdAt', 'internalNote', 'lastActionedBy', 'statusUpdatedAt', 'contactedAt']) {
        expect(keys).not.toContain(admin);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import { PURGE_RUN_ROW_CEILING } from 'shared';
import { createHandler, type PurgeCandidateRow, type PurgeStore } from './purge.js';
import type { Req, Res } from '../handler.js';

const NOW = new Date('2026-07-25T02:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY_MS);
const SECRET = 'test-cron-secret';

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

function makeStore(rows: PurgeCandidateRow[]) {
  const remaining = new Map(rows.map((r) => [r.id, r]));
  const auditCalls: { deletedUnactioned: number; deletedActioned: number; at: Date }[] = [];
  const deleteCalls: string[][] = [];
  let selectCalls = 0;

  const store: PurgeStore = {
    async selectCandidates({ cursor, limit }) {
      selectCalls += 1;
      const sorted = Array.from(remaining.values()).sort((a, b) => (a.id < b.id ? -1 : 1));
      const filtered = cursor ? sorted.filter((r) => r.id > cursor) : sorted;
      return filtered.slice(0, limit);
    },
    async deleteByIds(ids) {
      deleteCalls.push(ids);
      for (const id of ids) remaining.delete(id);
    },
    async writeRunAudit(params) {
      auditCalls.push(params);
    },
  };
  return { store, remaining, auditCalls, deleteCalls, selectCalls: () => selectCalls };
}

function req(headers: Record<string, string> = {}): Req {
  return { method: 'GET', headers };
}

describe('GET /api/purge', () => {
  it('rejects a caller without the scheduler secret and deletes nothing', async () => {
    const { store, deleteCalls, auditCalls, selectCalls } = makeStore([
      { id: idFor(1), status: 'pending', purgeAfter: daysAgo(1), statusUpdatedAt: null, contactedAt: null },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    const res = mockRes();
    await handler(req(), res);

    expect(res.statusCode).toBe(401);
    expect(deleteCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
    expect(selectCalls()).toBe(0);
  });

  it('rejects a wrong secret the same way as a missing one', async () => {
    const { store, deleteCalls } = makeStore([]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    const res = mockRes();
    await handler(req({ authorization: 'Bearer wrong-secret' }), res);

    expect(res.statusCode).toBe(401);
    expect(deleteCalls).toHaveLength(0);
  });

  it('deletes a pending request past its purgeAfter and keeps one whose purgeAfter is future', async () => {
    const eligible = idFor(1);
    const notEligible = idFor(2);
    const { store, remaining, auditCalls } = makeStore([
      { id: eligible, status: 'pending', purgeAfter: daysAgo(1), statusUpdatedAt: null, contactedAt: null },
      { id: notEligible, status: 'pending', purgeAfter: daysFromNow(5), statusUpdatedAt: null, contactedAt: null },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    const res = mockRes();
    await handler(req({ authorization: `Bearer ${SECRET}` }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deletedUnactioned: 1, deletedActioned: 0, completed: true });
    expect(remaining.has(eligible)).toBe(false);
    expect(remaining.has(notEligible)).toBe(true);
    expect(auditCalls).toEqual([{ deletedUnactioned: 1, deletedActioned: 0, at: NOW }]);
  });

  it('deletes an actioned request past its 30-day clock and reports it separately from unactioned', async () => {
    const { store, remaining } = makeStore([
      { id: idFor(1), status: 'contacted', purgeAfter: daysFromNow(60), statusUpdatedAt: daysAgo(31), contactedAt: daysAgo(31) },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    const res = mockRes();
    await handler(req({ authorization: `Bearer ${SECRET}` }), res);

    expect(res.body).toEqual({ deletedUnactioned: 0, deletedActioned: 1, completed: true });
    expect(remaining.size).toBe(0);
  });

  it('issues a hard delete by id and never an update (no soft-delete flag)', async () => {
    const id = idFor(1);
    const { store, deleteCalls } = makeStore([
      { id, status: 'pending', purgeAfter: daysAgo(1), statusUpdatedAt: null, contactedAt: null },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    await handler(req({ authorization: `Bearer ${SECRET}` }), mockRes());

    // PurgeStore exposes only selectCandidates/deleteByIds/writeRunAudit — no
    // update method exists for this handler to have called even by mistake.
    expect(deleteCalls).toEqual([[id]]);
  });

  it('a run with no eligible rows completes and records a zero-count audit', async () => {
    const { store, auditCalls } = makeStore([
      { id: idFor(1), status: 'declined', purgeAfter: daysAgo(30), statusUpdatedAt: null, contactedAt: null },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    const res = mockRes();
    await handler(req({ authorization: `Bearer ${SECRET}` }), res);

    expect(res.body).toEqual({ deletedUnactioned: 0, deletedActioned: 0, completed: true });
    expect(auditCalls).toEqual([{ deletedUnactioned: 0, deletedActioned: 0, at: NOW }]);
  });

  it('never selects the reason column and it is absent from the response', async () => {
    const { store } = makeStore([
      { id: idFor(1), status: 'pending', purgeAfter: daysAgo(1), statusUpdatedAt: null, contactedAt: null },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    const res = mockRes();
    await handler(req({ authorization: `Bearer ${SECRET}` }), res);

    // PurgeCandidateRow has no `reason` field at all — structurally nothing
    // reaches the response, which itself is counts-only.
    expect(Object.keys(res.body as object)).toEqual(['deletedUnactioned', 'deletedActioned', 'completed']);
  });

  it('makes no write to surviving rows', async () => {
    const survivor = idFor(1);
    const { store, remaining } = makeStore([
      { id: survivor, status: 'declined', purgeAfter: daysAgo(30), statusUpdatedAt: null, contactedAt: null },
    ]);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });
    await handler(req({ authorization: `Bearer ${SECRET}` }), mockRes());

    expect(remaining.get(survivor)).toEqual({
      id: survivor,
      status: 'declined',
      purgeAfter: daysAgo(30),
      statusUpdatedAt: null,
      contactedAt: null,
    });
  });

  it('stops at the per-run ceiling, reports completed=false, and resumes from the remainder on the next run', async () => {
    const total = PURGE_RUN_ROW_CEILING + 50;
    const rows: PurgeCandidateRow[] = Array.from({ length: total }, (_, i) => ({
      id: idFor(i + 1),
      status: 'pending',
      purgeAfter: daysAgo(1),
      statusUpdatedAt: null,
      contactedAt: null,
    }));
    const { store, remaining, auditCalls } = makeStore(rows);
    const handler = createHandler({ store, now: () => NOW, cronSecret: () => SECRET });

    const first = mockRes();
    await handler(req({ authorization: `Bearer ${SECRET}` }), first);
    expect(first.body).toEqual({ deletedUnactioned: PURGE_RUN_ROW_CEILING, deletedActioned: 0, completed: false });
    expect(remaining.size).toBe(50);

    const second = mockRes();
    await handler(req({ authorization: `Bearer ${SECRET}` }), second);
    expect(second.body).toEqual({ deletedUnactioned: 50, deletedActioned: 0, completed: true });
    expect(remaining.size).toBe(0);

    // Exactly one audit row per run.
    expect(auditCalls).toHaveLength(2);
    expect(auditCalls[0]?.deletedUnactioned).toBe(PURGE_RUN_ROW_CEILING);
    expect(auditCalls[1]?.deletedUnactioned).toBe(50);
  });
});

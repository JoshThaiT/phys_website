import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RETENTION_DAYS } from 'shared';
import { createHandler, type BookingStore } from './booking-requests.js';
import type { Res } from '../handler.js';

const REASON = 'lower back pain since my spinal surgery in March';

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

function makeStore(over: Partial<BookingStore> = {}) {
  const rows: Parameters<BookingStore['insert']>[0][] = [];
  const store: BookingStore = {
    countSince: async () => 0,
    findByIdempotencyKey: async () => null,
    insert: async (row) => { rows.push(row); },
    ...over,
  };
  return { store, rows };
}

const validBody = {
  fullName: 'Jo Nguyen',
  phone: '0412 345 678',
  serviceSlug: 'physiotherapy-initial',
  preferred: ['weekday-evening'],
  reason: REASON,
  consent: true,
};

const NOW = new Date('2026-07-21T00:00:00.000Z');
const req = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'x-forwarded-for': '203.0.113.9', ...headers },
  body,
});

beforeEach(() => { process.env['SOURCE_HASH_SALT'] = 'test-salt'; });
afterEach(() => { delete process.env['SOURCE_HASH_SALT']; vi.restoreAllMocks(); });

describe('POST /api/booking-requests', () => {
  it('accepts a valid request with a quotable reference', async () => {
    const { store } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(202);
    expect((res.body as { reference: string }).reference).toMatch(/^BR-[A-Z0-9]{6}$/);
  });

  it('stores the reason but never echoes it in the response', async () => {
    const { store, rows } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), res as unknown as Res);
    expect(rows[0]?.reason).toBe(REASON);
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('never includes health information in the notification', async () => {
    const notify = vi.fn<(payload: Record<string, unknown>) => Promise<void>>(async () => {});
    const { store } = makeStore();
    await createHandler({ store, notify, now: () => NOW })(req(validBody), mockRes() as unknown as Res);
    expect(JSON.stringify(notify.mock.calls)).not.toContain('surgery');
    expect(notify.mock.calls[0]?.[0]).not.toHaveProperty('reason');
  });

  it('never writes the reason to a log, even when the insert fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = makeStore({ insert: async () => { throw new Error('db down'); } });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('surgery');
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('records consent at the time of submission', async () => {
    const { store, rows } = makeStore();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), mockRes() as unknown as Res);
    expect(rows[0]?.consentAt).toEqual(NOW);
  });

  it(`sets a purge date ${RETENTION_DAYS} days out`, async () => {
    const { store, rows } = makeStore();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), mockRes() as unknown as Res);
    const days = (rows[0]!.purgeAfter.getTime() - NOW.getTime()) / 86_400_000;
    expect(days).toBe(RETENTION_DAYS);
  });

  it('stores a hashed source, never the raw address', async () => {
    const { store, rows } = makeStore();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), mockRes() as unknown as Res);
    expect(rows[0]?.sourceHash).not.toContain('203.0.113');
  });

  it('silently discards a honeypot submission', async () => {
    const { store, rows } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(
      req({ ...validBody, company: 'Acme SEO' }), res as unknown as Res,
    );
    expect(res.statusCode).toBe(202);
    expect(rows).toHaveLength(0);
  });

  it('rejects the sixth request inside the window', async () => {
    const { store } = makeStore({ countSince: async () => 5 });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(429);
  });

  it('returns the original reference for a repeated idempotency key', async () => {
    const { store, rows } = makeStore({ findByIdempotencyKey: async () => ({ reference: 'BR-ABC234' }) });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(
      req(validBody, { 'idempotency-key': 'abc' }), res as unknown as Res,
    );
    expect((res.body as { reference: string }).reference).toBe('BR-ABC234');
    expect(rows).toHaveLength(0);
  });

  it('returns field names only on a validation failure', async () => {
    const { store } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(
      req({ ...validBody, consent: false }), res as unknown as Res,
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('rejects a GET', async () => {
    const { store } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW })(
      { ...req(validBody), method: 'GET' }, res as unknown as Res,
    );
    expect(res.statusCode).toBe(405);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RETENTION_DAYS } from 'shared';
import { createHandler, type BookingStore } from './booking-requests.js';
import type { Res } from '../handler.js';

const REASON = 'lower back pain since my spinal surgery in March';
const CLINIC_PHONE = '(02) 5550 1234';

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
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(202);
    expect((res.body as { reference: string }).reference).toMatch(/^BR-[A-Z0-9]{6}$/);
  });

  it('stores the reason but never echoes it in the response', async () => {
    const { store, rows } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);
    expect(rows[0]?.reason).toBe(REASON);
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('never includes health information in the notification', async () => {
    const notify = vi.fn<(payload: Record<string, unknown>) => Promise<void>>(async () => {});
    const { store } = makeStore();
    await createHandler({ store, notify, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), mockRes() as unknown as Res);
    expect(JSON.stringify(notify.mock.calls)).not.toContain('surgery');
    expect(notify.mock.calls[0]?.[0]).not.toHaveProperty('reason');
  });

  it('never writes the reason to a log, even when the insert fails', async () => {
    // Corrected from an old assertion of statusCode 500: that expectation
    // encoded the bug spec 005 exists to fix (a store failure surfacing as
    // a raw 500 instead of an actionable 503). The reason-never-logged
    // assertions below are unchanged.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = makeStore({ insert: async () => { throw new Error('db down'); } });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('surgery');
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('returns 503 UNAVAILABLE with the clinic phone when the store throws on read (countSince)', async () => {
    const { store } = makeStore({ countSince: async () => { throw new Error('db down'); } });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(503);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UNAVAILABLE');
    expect(body.error.message).toContain(CLINIC_PHONE);
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('returns 503 UNAVAILABLE with the clinic phone when the store throws on read (findByIdempotencyKey)', async () => {
    const { store } = makeStore({ findByIdempotencyKey: async () => { throw new Error('db down'); } });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(
      req(validBody, { 'idempotency-key': 'abc' }), res as unknown as Res,
    );
    expect(res.statusCode).toBe(503);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UNAVAILABLE');
    expect(body.error.message).toContain(CLINIC_PHONE);
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('never echoes the request body in the 503 payload', async () => {
    const { store } = makeStore({ insert: async () => { throw new Error('db down'); } });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Jo Nguyen');
    expect(JSON.stringify(res.body)).not.toContain(REASON);
  });

  it('logs the 503 by requestId and field names only, never the reason', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = makeStore({ insert: async () => { throw new Error('db down'); } });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);

    const body = res.body as { error: { requestId: string } };
    expect(body.error.requestId).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(logged['requestId']).toBe(body.error.requestId);
    expect(JSON.stringify(logged)).not.toContain('surgery');
    expect(JSON.stringify(logged)).not.toContain('Jo Nguyen');
    // Field-safe: no key on the logged object carries a value from the body.
    expect(logged).not.toHaveProperty('fields');
    expect(logged).not.toHaveProperty('body');
  });

  it('a failed notify still returns 202 — the record is already stored', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, rows } = makeStore();
    const res = mockRes();
    await createHandler({
      store,
      notify: async () => { throw new Error('mail down'); },
      now: () => NOW,
      clinicPhone: () => CLINIC_PHONE,
    })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(202);
    expect((res.body as { reference: string }).reference).toMatch(/^BR-[A-Z0-9]{6}$/);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('surgery');
  });

  it('records consent at the time of submission', async () => {
    const { store, rows } = makeStore();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), mockRes() as unknown as Res);
    expect(rows[0]?.consentAt).toEqual(NOW);
  });

  it(`sets a purge date ${RETENTION_DAYS} days out`, async () => {
    const { store, rows } = makeStore();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), mockRes() as unknown as Res);
    const days = (rows[0]!.purgeAfter.getTime() - NOW.getTime()) / 86_400_000;
    expect(days).toBe(RETENTION_DAYS);
  });

  it('stores a hashed source, never the raw address', async () => {
    const { store, rows } = makeStore();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), mockRes() as unknown as Res);
    expect(rows[0]?.sourceHash).not.toContain('203.0.113');
  });

  it('silently discards a honeypot submission', async () => {
    const { store, rows } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(
      req({ ...validBody, company: 'Acme SEO' }), res as unknown as Res,
    );
    expect(res.statusCode).toBe(202);
    expect(rows).toHaveLength(0);
  });

  it('rejects the sixth request inside the window with RATE_LIMITED, never CONFLICT', async () => {
    const { store } = makeStore({ countSince: async () => 5 });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(429);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.code).not.toBe('CONFLICT');
  });

  it('returns the original reference for a repeated idempotency key', async () => {
    const { store, rows } = makeStore({ findByIdempotencyKey: async () => ({ reference: 'BR-ABC234' }) });
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(
      req(validBody, { 'idempotency-key': 'abc' }), res as unknown as Res,
    );
    expect((res.body as { reference: string }).reference).toBe('BR-ABC234');
    expect(rows).toHaveLength(0);
  });

  it('returns field names only on a validation failure', async () => {
    const { store } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(
      req({ ...validBody, consent: false }), res as unknown as Res,
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('surgery');
  });

  it('rejects a GET', async () => {
    const { store } = makeStore();
    const res = mockRes();
    await createHandler({ store, notify: async () => {}, now: () => NOW, clinicPhone: () => CLINIC_PHONE })(
      { ...req(validBody), method: 'GET' }, res as unknown as Res,
    );
    expect(res.statusCode).toBe(405);
  });

  it('accepts an injected clinicPhone seam without changing existing behaviour', async () => {
    const { store, rows } = makeStore();
    const res = mockRes();
    await createHandler({
      store,
      notify: async () => {},
      now: () => NOW,
      clinicPhone: () => '(02) 5550 1234',
    })(req(validBody), res as unknown as Res);
    expect(res.statusCode).toBe(202);
    expect((res.body as { reference: string }).reference).toMatch(/^BR-[A-Z0-9]{6}$/);
    expect(rows).toHaveLength(1);
  });
});

describe('default export (production wiring)', () => {
  it('builds the handler lazily — importing the route does not require POSTGRES_URL', async () => {
    const originalUrl = process.env['POSTGRES_URL'];
    delete process.env['POSTGRES_URL'];
    try {
      // A fresh module graph so any accidental module-scope getDb() call
      // (which throws without POSTGRES_URL) surfaces here, at import time,
      // rather than being masked by an already-cached module.
      vi.resetModules();
      await expect(import('./booking-requests.js')).resolves.toBeDefined();
    } finally {
      if (originalUrl === undefined) delete process.env['POSTGRES_URL'];
      else process.env['POSTGRES_URL'] = originalUrl;
      vi.resetModules();
    }
  });
});

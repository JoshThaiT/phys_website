import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { apiErrorSchema } from 'shared';
import { forbidden, parse, route, type Req, type Res } from './handler.js';
import type { badRequest } from './handler.js';

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this as unknown as Res; },
    json(body: unknown) { this.body = body; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
  return res;
}
const req = (over: Partial<Req> = {}): Req => ({ method: 'GET', headers: {}, ...over });

describe('route', () => {
  it('calls the handler when the method is allowed', async () => {
    const handler = vi.fn();
    const res = mockRes();
    await route(['GET'], handler)(req(), res as unknown as Res);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns 405 with an Allow header when the method is wrong', async () => {
    const res = mockRes();
    await route(['POST'], vi.fn())(req({ method: 'GET' }), res as unknown as Res);
    expect(res.statusCode).toBe(405);
    expect(res.headers['Allow']).toBe('POST');
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
  });

  it('converts an HttpError into its declared status and payload', async () => {
    const res = mockRes();
    await route(['GET'], () => { throw forbidden(); })(req(), res as unknown as Res);
    expect(res.statusCode).toBe(403);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('FORBIDDEN');
  });

  it('never leaks internal detail on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    await route(['GET'], () => { throw new Error('connection string user:hunter2@db'); })(
      req(), res as unknown as Res,
    );
    expect(res.statusCode).toBe(500);
    const parsed = apiErrorSchema.parse(res.body);
    expect(JSON.stringify(parsed)).not.toContain('hunter2');
    expect(parsed.error.requestId).toBeTruthy();
  });

  it('awaits an async handler before returning', async () => {
    const res = mockRes();
    await route(['GET'], async (_r, r2) => {
      await new Promise((done) => setTimeout(done, 1));
      r2.status(200).json({ ok: true });
    })(req(), res as unknown as Res);
    expect(res.statusCode).toBe(200);
  });
});

describe('parse', () => {
  const schema = z.object({ email: z.string().email('Enter a valid email address') });

  it('returns typed data when input is valid', () => {
    expect(parse(schema, { email: 'a@b.com' })).toEqual({ email: 'a@b.com' });
  });

  it('throws a 400 carrying per-field messages', () => {
    try {
      parse(schema, { email: 'nope' });
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as ReturnType<typeof badRequest>;
      expect(e.status).toBe(400);
      expect(e.payload.error.fields).toEqual({ email: 'Enter a valid email address' });
    }
  });
});

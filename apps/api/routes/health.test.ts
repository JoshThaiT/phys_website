import { describe, it, expect } from 'vitest';
import health from './health.js';
import type { Res } from '../handler.js';

function mockRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this as unknown as Res; },
    json(b: unknown) { this.body = b; },
    setHeader() {},
  };
}

describe('GET /api/health', () => {
  it('reports ok with a timestamp', async () => {
    const res = mockRes();
    await health({ method: 'GET', headers: {} }, res as unknown as Res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('rejects a POST', async () => {
    const res = mockRes();
    await health({ method: 'POST', headers: {} }, res as unknown as Res);
    expect(res.statusCode).toBe(405);
  });
});

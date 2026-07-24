import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './api.js';
import type { ApiRequestError } from './api.js';

function respond(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}
afterEach(() => vi.unstubAllGlobals());

const schema = z.object({ status: z.string() });

describe('apiFetch', () => {
  it('returns parsed data on success', async () => {
    respond(200, { status: 'ok' });
    await expect(apiFetch('/health', schema)).resolves.toEqual({ status: 'ok' });
  });

  it('throws ApiRequestError carrying the server code on failure', async () => {
    respond(403, { error: { code: 'FORBIDDEN', message: 'No access.' } });
    await expect(apiFetch('/x', schema)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('exposes field errors from a validation failure', async () => {
    respond(400, {
      error: { code: 'VALIDATION_FAILED', message: 'Check fields.', fields: { email: 'Required' } },
    });
    const err = await apiFetch('/x', schema).catch((e: unknown) => e);
    expect((err as ApiRequestError).fields).toEqual({ email: 'Required' });
  });

  it('falls back to a safe message when the error body is malformed', async () => {
    respond(500, '<html>gateway timeout</html>');
    const err = await apiFetch('/x', schema).catch((e: unknown) => e);
    expect((err as ApiRequestError).code).toBe('INTERNAL');
    expect((err as ApiRequestError).message).not.toContain('html');
  });

  it('throws when a 200 response does not match the schema', async () => {
    respond(200, { unexpected: true });
    await expect(apiFetch('/health', schema)).rejects.toThrow();
  });
});

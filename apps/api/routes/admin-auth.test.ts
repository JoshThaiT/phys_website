import { describe, it, expect, vi } from 'vitest';
import { createHandler, SIGN_IN_MIN_RESPONSE_MS, type AdminAuthRouteStore, type Sleep } from './admin-auth.js';
import type { Res } from '../handler.js';
import type { Mailer } from '../lib/mailer.js';

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

const USER = { id: 'u1', email: 'reception@meridianphysio.example', name: 'Reception' };
const NOW = new Date('2026-07-24T09:00:00.000Z');

interface FakeToken { id: string; userId: string; tokenHash: string; expiresAt: Date; consumedAt: Date | null }
interface FakeSession {
  id: string; userId: string; tokenHash: string; lastSeenAt: Date; absoluteExpiresAt: Date; revokedAt: Date | null;
}

function makeStore(users: (typeof USER)[] = [USER]) {
  let seq = 0;
  const tokens: FakeToken[] = [];
  const sessions: FakeSession[] = [];
  const store: AdminAuthRouteStore = {
    async findUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async insertAuthToken({ userId, tokenHash, expiresAt }) {
      seq += 1;
      tokens.push({ id: `t${seq}`, userId, tokenHash, expiresAt, consumedAt: null });
    },
    async findAuthTokenByHash(hash) {
      return tokens.find((t) => t.tokenHash === hash) ?? null;
    },
    async consumeAuthToken(id, at) {
      const t = tokens.find((x) => x.id === id);
      if (t) t.consumedAt = at;
    },
    async insertSession({ userId, tokenHash, absoluteExpiresAt }) {
      seq += 1;
      sessions.push({ id: `s${seq}`, userId, tokenHash, lastSeenAt: NOW, absoluteExpiresAt, revokedAt: null });
    },
    async findSessionByTokenHash(hash) {
      const s = sessions.find((x) => x.tokenHash === hash);
      if (!s) return null;
      const user = users.find((u) => u.id === s.userId);
      if (!user) return null;
      return {
        id: s.id,
        userId: s.userId,
        userEmail: user.email,
        userName: user.name,
        lastSeenAt: s.lastSeenAt,
        absoluteExpiresAt: s.absoluteExpiresAt,
        revokedAt: s.revokedAt,
      };
    },
    async touchSession(id, at) {
      const s = sessions.find((x) => x.id === id);
      if (s) s.lastSeenAt = at;
    },
    async revokeSessionByTokenHash(hash, at) {
      const s = sessions.find((x) => x.tokenHash === hash);
      if (s) s.revokedAt = at;
    },
  };
  return { store, tokens, sessions };
}

function makeMailer() {
  const send = vi.fn<Mailer['sendMagicLink']>(async () => {});
  const mailer: Mailer = { sendMagicLink: send };
  return { mailer, send };
}

/** Deterministic stand-in for the real timer: records its argument instead
 *  of actually waiting, so the AC2 timing-floor test runs instantly. */
function makeSleep() {
  const sleep = vi.fn<Sleep>(async () => {});
  return { sleep };
}

/** No-op sleep for tests that aren't exercising the AC2 timing floor itself —
 *  keeps the suite fast and avoids depending on a real timer anywhere. */
const noopSleep: Sleep = async () => {};

const req = (query: Record<string, string>, body?: unknown, method = 'POST') => ({
  method,
  query,
  headers: {},
  body,
});

describe('POST /api/admin-auth?action=request', () => {
  it('sends a link only to an allowlisted address and returns an identical response either way', async () => {
    const { store, tokens } = makeStore();
    const { mailer, send } = makeMailer();
    const { sleep } = makeSleep();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep });

    const resAllowlisted = mockRes();
    await handler(req({ action: 'request' }, { email: USER.email }), resAllowlisted as unknown as Res);

    const resUnknown = mockRes();
    await handler(
      req({ action: 'request' }, { email: 'not-reception@example.com' }),
      resUnknown as unknown as Res,
    );

    expect(resAllowlisted.statusCode).toBe(200);
    expect(resUnknown.statusCode).toBe(200);
    expect(resAllowlisted.body).toEqual(resUnknown.body);
    expect(resAllowlisted.body).toEqual({ ok: true });

    expect(tokens).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(USER.email, expect.stringContaining('raw-token'));

    // AC2: the non-allowlisted branch does none of that DB/mailer work, so
    // without the timing floor it would return measurably faster. Assert the
    // floor/sleep seam ran on BOTH requests, and with the same padding, with
    // `now` held fixed so this is deterministic rather than a wall-clock race.
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, SIGN_IN_MIN_RESPONSE_MS);
    expect(sleep).toHaveBeenNthCalledWith(2, SIGN_IN_MIN_RESPONSE_MS);
  });

  it('never puts request data in the generated link', async () => {
    const { store } = makeStore();
    const { mailer, send } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep: noopSleep });
    await handler(req({ action: 'request' }, { email: USER.email }), mockRes() as unknown as Res);
    const link = send.mock.calls[0]?.[1] ?? '';
    expect(link).not.toContain('reason');
  });

  it('rejects a malformed email with a 400, still with no signal about allowlist status', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, sleep: noopSleep });
    const res = mockRes();
    await handler(req({ action: 'request' }, { email: 'not-an-email' }), res as unknown as Res);
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/admin-auth?action=verify', () => {
  it('grants a session for a fresh, unused token', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep: noopSleep });
    await handler(req({ action: 'request' }, { email: USER.email }), mockRes() as unknown as Res);

    const res = mockRes();
    await handler(req({ action: 'verify' }, { token: 'raw-token' }), res as unknown as Res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ email: USER.email, name: USER.name });
    expect(res.headers['Set-Cookie']).toContain('admin_session=');
    expect(res.headers['Set-Cookie']).toContain('HttpOnly');
    expect(res.headers['Set-Cookie']).toContain('Secure');
    expect(res.headers['Set-Cookie']).toContain('SameSite=Strict');
  });

  it('a used (consumed) token grants no session on the second attempt', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep: noopSleep });

    await handler(req({ action: 'request' }, { email: USER.email }), mockRes() as unknown as Res);
    await handler(req({ action: 'verify' }, { token: 'raw-token' }), mockRes() as unknown as Res);

    const resReused = mockRes();
    await handler(req({ action: 'verify' }, { token: 'raw-token' }), resReused as unknown as Res);
    expect(resReused.statusCode).toBe(401);
  });

  it('an expired token grants no session', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep: noopSleep });
    await handler(req({ action: 'request' }, { email: USER.email }), mockRes() as unknown as Res);

    const later = new Date(NOW.getTime() + 60 * 60_000); // well past MAGIC_LINK_TTL_MINUTES
    const laterHandler = createHandler({ store, mailer, now: () => later });
    const resExpired = mockRes();
    await laterHandler(req({ action: 'verify' }, { token: 'raw-token' }), resExpired as unknown as Res);
    expect(resExpired.statusCode).toBe(401);
  });

  it('rejects an unknown token', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, sleep: noopSleep });
    const res = mockRes();
    await handler(req({ action: 'verify' }, { token: 'never-issued' }), res as unknown as Res);
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/admin-auth?action=signout', () => {
  it('clears the session cookie and revokes the session', async () => {
    const { store, sessions } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep: noopSleep });
    await handler(req({ action: 'request' }, { email: USER.email }), mockRes() as unknown as Res);
    await handler(req({ action: 'verify' }, { token: 'raw-token' }), mockRes() as unknown as Res);

    const res = mockRes();
    await handler(
      { method: 'POST', query: { action: 'signout' }, headers: { cookie: `admin_session=raw-token` } },
      res as unknown as Res,
    );
    expect(res.statusCode).toBe(204);
    expect(res.headers['Set-Cookie']).toContain('Max-Age=0');
    expect(sessions[0]?.revokedAt).not.toBeNull();
  });
});

describe('GET /api/admin-auth?action=me', () => {
  it('rejects an unauthenticated request with 401 and no data', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, sleep: noopSleep });
    const res = mockRes();
    await handler({ method: 'GET', query: { action: 'me' }, headers: {} }, res as unknown as Res);
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(USER.email);
  });

  it('returns the signed-in user for a valid session', async () => {
    const { store } = makeStore();
    const { mailer } = makeMailer();
    const handler = createHandler({ store, mailer, now: () => NOW, makeToken: () => 'raw-token', sleep: noopSleep });
    await handler(req({ action: 'request' }, { email: USER.email }), mockRes() as unknown as Res);
    await handler(req({ action: 'verify' }, { token: 'raw-token' }), mockRes() as unknown as Res);

    const res = mockRes();
    await handler(
      { method: 'GET', query: { action: 'me' }, headers: { cookie: 'admin_session=raw-token' } },
      res as unknown as Res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ email: USER.email, name: USER.name });
  });
});

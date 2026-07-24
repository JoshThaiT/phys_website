import { describe, it, expect, vi } from 'vitest';
import {
  generateToken,
  hashToken,
  requireAdmin,
  type AdminAuthStore,
} from './adminAuth.js';
import type { Req } from '../handler.js';

const NOW = new Date('2026-07-24T12:00:00.000Z');

function reqWithCookie(token: string | null): Req {
  return {
    method: 'GET',
    headers: token ? { cookie: `admin_session=${token}` } : {},
  };
}

type SessionLookup = Awaited<ReturnType<AdminAuthStore['findSessionByTokenHash']>>;

function makeStore(session: SessionLookup) {
  const touch = vi.fn(async () => {});
  const store: AdminAuthStore = {
    findSessionByTokenHash: async () => session,
    touchSession: touch,
  };
  return { store, touch };
}

describe('generateToken / hashToken', () => {
  it('produces a stable hash for the same raw token', () => {
    const raw = generateToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it('produces different tokens on each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('the hash never contains the raw token', () => {
    const raw = generateToken();
    expect(hashToken(raw)).not.toContain(raw);
  });
});

describe('requireAdmin', () => {
  it('rejects a request with no session cookie', async () => {
    const { store } = makeStore(null);
    await expect(requireAdmin(reqWithCookie(null), store, () => NOW)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects a token that matches no session', async () => {
    const { store } = makeStore(null);
    await expect(requireAdmin(reqWithCookie('unknown'), store, () => NOW)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects a revoked session', async () => {
    const { store } = makeStore({
      id: 's1',
      userId: 'u1',
      userEmail: 'reception@example.com',
      userName: 'Reception',
      lastSeenAt: NOW,
      absoluteExpiresAt: new Date(NOW.getTime() + 60_000),
      revokedAt: new Date(NOW.getTime() - 1000),
    });
    await expect(requireAdmin(reqWithCookie('t'), store, () => NOW)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects a session past its absolute expiry', async () => {
    const { store } = makeStore({
      id: 's1',
      userId: 'u1',
      userEmail: 'reception@example.com',
      userName: null,
      lastSeenAt: NOW,
      absoluteExpiresAt: new Date(NOW.getTime() - 1000),
      revokedAt: null,
    });
    await expect(requireAdmin(reqWithCookie('t'), store, () => NOW)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('an idle session past the timeout is rejected', async () => {
    const { store } = makeStore({
      id: 's1',
      userId: 'u1',
      userEmail: 'reception@example.com',
      userName: null,
      // last seen 31 minutes ago; SESSION_IDLE_MINUTES is 30
      lastSeenAt: new Date(NOW.getTime() - 31 * 60_000),
      absoluteExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
      revokedAt: null,
    });
    await expect(requireAdmin(reqWithCookie('t'), store, () => NOW)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('returns the actor and touches the session for a valid, recently-seen session', async () => {
    const { store, touch } = makeStore({
      id: 's1',
      userId: 'u1',
      userEmail: 'reception@example.com',
      userName: 'Reception One',
      lastSeenAt: new Date(NOW.getTime() - 5 * 60_000),
      absoluteExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
      revokedAt: null,
    });
    const actor = await requireAdmin(reqWithCookie('t'), store, () => NOW);
    expect(actor).toEqual({ id: 'u1', email: 'reception@example.com', name: 'Reception One' });
    expect(touch).toHaveBeenCalledWith('s1', NOW);
  });
});

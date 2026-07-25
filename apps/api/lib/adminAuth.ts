import { createHash, randomBytes } from 'node:crypto';
import { SESSION_IDLE_MINUTES } from 'shared';
import { unauthenticated, type Req, type Res } from '../handler.js';

/**
 * Session/token hashing and the `requireAdmin` capability check.
 *
 * A raw magic-link token or session token is high-entropy secret material by
 * construction (32 random bytes), so — unlike a password — hashing it
 * without an additional salt is sufficient: the input space is already too
 * large to brute-force from the hash. Only the hash is ever persisted,
 * mirroring `apps/api/lib/privacy.ts`'s `sourceHash`, so a DB dump cannot be
 * replayed into a session.
 */

export const SESSION_COOKIE_NAME = 'admin_session';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** The actor `requireAdmin` returns and every admin handler acts as. */
export interface AdminActorRecord {
  id: string;
  email: string;
  name: string | null;
}

interface SessionLookup {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  lastSeenAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

/**
 * The narrow storage seam `requireAdmin` depends on, so idle-timeout and
 * expiry logic can be unit-tested without a live database (mirrors
 * `BookingStore` in `apps/api/routes/booking-requests.ts`).
 */
export interface AdminAuthStore {
  findSessionByTokenHash(hash: string): Promise<SessionLookup | null>;
  touchSession(id: string, lastSeenAt: Date): Promise<void>;
}

function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(header) ? header.join('; ') : (header ?? '');
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function readSessionToken(req: Req): string | null {
  const cookies = parseCookies(req.headers['cookie']);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

/**
 * Every admin data handler calls this first and takes the returned actor.
 * There is no admin code path that reaches the store without it. Throws the
 * shared 401 (`UNAUTHENTICATED`) when the session is missing, unknown,
 * revoked, idle-expired or past its absolute lifetime.
 */
export async function requireAdmin(
  req: Req,
  store: AdminAuthStore,
  now: () => Date = () => new Date(),
): Promise<AdminActorRecord> {
  const token = readSessionToken(req);
  if (!token) throw unauthenticated();

  const session = await store.findSessionByTokenHash(hashToken(token));
  if (!session || session.revokedAt) throw unauthenticated();

  const at = now();
  if (session.absoluteExpiresAt.getTime() <= at.getTime()) throw unauthenticated();

  const idleDeadline = session.lastSeenAt.getTime() + SESSION_IDLE_MINUTES * 60_000;
  if (idleDeadline <= at.getTime()) throw unauthenticated();

  await store.touchSession(session.id, at);
  return { id: session.userId, email: session.userEmail, name: session.userName };
}

/** HttpOnly + Secure + SameSite=Strict, per the spec's session-theft mitigation. */
export function setSessionCookie(res: Res, token: string, expires: Date): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`,
  );
}

export function clearSessionCookie(res: Res): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

/** Reads the raw session token straight off the request, for the one place
 *  (sign-out) that must revoke a session even if it would no longer pass
 *  `requireAdmin` (e.g. already idle-expired). */
export function readRawSessionToken(req: Req): string | null {
  return readSessionToken(req);
}

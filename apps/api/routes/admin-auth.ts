import {
  MAGIC_LINK_TTL_MINUTES,
  SESSION_ABSOLUTE_HOURS,
  adminSessionSchema,
  adminSignInRequestSchema,
  adminSignInResponseSchema,
  adminVerifyRequestSchema,
} from 'shared';
import { badRequest, route, unauthenticated, type Handler, type Req, type Res } from '../handler.js';
import {
  clearSessionCookie,
  generateToken,
  hashToken,
  readRawSessionToken,
  requireAdmin,
  setSessionCookie,
  type AdminActorRecord,
  type AdminAuthStore,
} from '../lib/adminAuth.js';
import { createFetchTransport, createMailer, type Mailer } from '../lib/mailer.js';
import { createAdminAuthStore, getDb } from 'db';

interface AuthTokenLookup {
  id: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

/**
 * AC2: the sign-in response must carry no signal — status, body, or
 * observable timing — that distinguishes an allowlisted email from one that
 * isn't. The allowlisted branch below does a DB insert and (today, via the
 * mailer seam) an awaited network call; the non-allowlisted branch does
 * neither, so without a floor its response would consistently return faster
 * and an attacker could time requests to enumerate the allowlist.
 *
 * This constant is the minimum elapsed time BOTH branches must reach before
 * responding, sized comfortably above the allowlisted path's expected cost
 * (one insert plus one mailer round-trip). It's a floor, not a fixed delay:
 * elapsed time is measured with the same injectable `now()` clock the rest
 * of this handler already uses (so it is a real wall-clock measurement in
 * production, but frozen and deterministic under a test's fixed `now`), and
 * the wait itself goes through the injectable `sleep` seam so a test can
 * assert the seam was invoked on both paths without an actual wall-clock
 * sleep.
 *
 * Prerequisite for production: a real mail provider is not wired yet (see
 * docs/specs/003-admin-booking-list.md, "Prerequisite — email delivery does
 * not yet exist in this repo"). When one is, `mailer.sendMagicLink` must be
 * dispatched off the response path — e.g. Vercel's `waitUntil`, or a queue —
 * rather than awaited inline as it is today. An awaited call to a real,
 * sometimes-slow provider could exceed this floor and reopen the exact
 * timing signal it exists to close.
 */
export const SIGN_IN_MIN_RESPONSE_MS = 250;

/** Delay seam. Defaults to a real timer; tests inject a stub so the floor is
 *  observed deterministically instead of via a real wall-clock sleep. */
export type Sleep = (ms: number) => Promise<void>;

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Storage seam for this route. Extends the narrower `AdminAuthStore` that
 * `requireAdmin` depends on, so the same store instance serves `me` as well
 * as the sign-in lifecycle.
 */
export interface AdminAuthRouteStore extends AdminAuthStore {
  findUserByEmail(email: string): Promise<AdminActorRecord | null>;
  insertAuthToken(row: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findAuthTokenByHash(hash: string): Promise<AuthTokenLookup | null>;
  consumeAuthToken(id: string, at: Date): Promise<void>;
  insertSession(row: { userId: string; tokenHash: string; absoluteExpiresAt: Date }): Promise<void>;
  revokeSessionByTokenHash(hash: string, at: Date): Promise<void>;
}

export interface Deps {
  store: AdminAuthRouteStore;
  mailer: Mailer;
  now?: () => Date;
  /** Injectable so tests can assert on a known token/link. */
  makeToken?: () => string;
  /** Origin the sign-in link points at, e.g. https://clinic.example. */
  baseUrl?: string;
  /** AC2 timing-floor seam; see `SIGN_IN_MIN_RESPONSE_MS`. */
  sleep?: Sleep;
}

function queryParam(query: Req['query'], key: string): string | undefined {
  const v = query?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function methodNotAllowed(res: Res, allowed: string): void {
  res.setHeader('Allow', allowed);
  res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${allowed}.` } });
}

export function createHandler({
  store,
  mailer,
  now = () => new Date(),
  makeToken = generateToken,
  baseUrl = process.env['ADMIN_APP_URL'] ?? '',
  sleep = defaultSleep,
}: Deps) {
  return route(['GET', 'POST'], async (req: Req, res: Res) => {
    const action = queryParam(req.query, 'action');

    if (action === 'me') {
      if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
      const actor = await requireAdmin(req, store, now);
      res.status(200).json(adminSessionSchema.parse({ email: actor.email, name: actor.name }));
      return;
    }

    if (action === 'request') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      const body = adminSignInRequestSchema.safeParse(req.body);
      if (!body.success) throw badRequest('Enter a valid email address.');

      const at = now();
      const user = await store.findUserByEmail(body.data.email);
      // AC2: identical response whether or not the address is allowlisted.
      // No branch below is allowed to change status code or body shape. Both
      // branches also pass through the SIGN_IN_MIN_RESPONSE_MS floor below,
      // so elapsed response time doesn't leak allowlist membership either.
      if (user) {
        const raw = makeToken();
        const expiresAt = new Date(at.getTime() + MAGIC_LINK_TTL_MINUTES * 60_000);
        await store.insertAuthToken({ userId: user.id, tokenHash: hashToken(raw), expiresAt });
        const link = `${baseUrl}/admin/callback?token=${encodeURIComponent(raw)}`;
        await mailer.sendMagicLink(user.email, link);
      }
      const elapsedMs = now().getTime() - at.getTime();
      await sleep(Math.max(0, SIGN_IN_MIN_RESPONSE_MS - elapsedMs));
      res.status(200).json(adminSignInResponseSchema.parse({ ok: true }));
      return;
    }

    if (action === 'verify') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      const body = adminVerifyRequestSchema.safeParse(req.body);
      if (!body.success) throw badRequest('A sign-in token is required.');

      const at = now();
      const record = await store.findAuthTokenByHash(hashToken(body.data.token));
      if (!record || record.consumedAt || record.expiresAt.getTime() <= at.getTime()) {
        throw unauthenticated('This sign-in link is invalid or has expired.');
      }

      await store.consumeAuthToken(record.id, at);

      const sessionToken = makeToken();
      const absoluteExpiresAt = new Date(at.getTime() + SESSION_ABSOLUTE_HOURS * 60 * 60_000);
      await store.insertSession({
        userId: record.userId,
        tokenHash: hashToken(sessionToken),
        absoluteExpiresAt,
      });
      setSessionCookie(res, sessionToken, absoluteExpiresAt);

      const session = await store.findSessionByTokenHash(hashToken(sessionToken));
      if (!session) throw unauthenticated('Could not establish a session.');
      res
        .status(200)
        .json(adminSessionSchema.parse({ email: session.userEmail, name: session.userName }));
      return;
    }

    if (action === 'signout') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      const raw = readRawSessionToken(req);
      if (raw) await store.revokeSessionByTokenHash(hashToken(raw), now());
      clearSessionCookie(res);
      res.status(204).json(undefined);
      return;
    }

    throw badRequest('Unknown action.');
  });
}

/**
 * Real wiring, lazily constructed on first invocation rather than at module
 * scope. Two reasons: (1) "no heavy work at module scope" on a serverless
 * cold start, and (2) `getDb()` throws immediately if `POSTGRES_URL` is
 * unset, which must not happen merely by importing this module (e.g. from a
 * test that only wants `createHandler`).
 */
let cached: Handler | undefined;

export default function handler(req: Req, res: Res): Promise<void> | void {
  cached ??= createHandler({
    store: createAdminAuthStore(getDb()),
    mailer: createMailer(createFetchTransport()),
  });
  return cached(req, res);
}

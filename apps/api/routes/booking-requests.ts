import {
  RATE_LIMIT,
  RETENTION_DAYS,
  bookingRequestSchema,
  makeReference,
  notificationPayload,
} from 'shared';
import { HttpError, parse, requestId, route, type Handler, type Req, type Res } from '../handler.js';
import { clientIp, hashSource, safeFieldNames } from '../lib/privacy.js';
import { apiError, ERROR_CODES } from 'shared';
import { createBookingNotifier } from '../lib/notify.js';
import { createFetchTransport } from '../lib/mailer.js';
import { createBookingStore, getDb } from 'db';

/**
 * Storage seam. The handler depends on this interface rather than on Drizzle
 * directly, so the privacy behaviour can be tested without a live database.
 * The real implementation is wired in `createStore` below.
 */
export interface BookingStore {
  countSince(sourceHash: string, since: Date): Promise<number>;
  findByIdempotencyKey(key: string): Promise<{ reference: string } | null>;
  insert(row: {
    reference: string;
    serviceSlug: string;
    practitioner: string | null;
    fullName: string;
    phone: string | null;
    email: string | null;
    preferred: string[];
    reason: string | null;
    consentAt: Date;
    sourceHash: string;
    idempotencyKey: string | null;
    purgeAfter: Date;
  }): Promise<void>;
}

export interface Deps {
  store: BookingStore;
  notify: (payload: Record<string, unknown>) => Promise<void>;
  now?: () => Date;
  random?: () => number;
  /**
   * Clinic phone number seam. Introduced by spec 006 for spec 005's 503
   * message to consume; not read inside `createHandler` here (see ADR
   * 0001 for the decision this seam wires — env, not `packages/shared`).
   */
  clinicPhone?: () => string;
}

const ACCEPTED_MESSAGE =
  'Thanks — reception will contact you to confirm a time, usually within one business day. ' +
  'If your problem is urgent, please phone the clinic.';

export function createHandler({
  store,
  notify,
  now = () => new Date(),
  random = Math.random,
  clinicPhone,
}: Deps) {
  return route(['POST'], async (req: Req, res: Res) => {
    const body = parse(bookingRequestSchema, req.body);

    // Honeypot: accept from the client's point of view, persist nothing.
    // Telling a bot it failed only teaches it to try again.
    if (body.company) {
      res.status(202).json({ reference: makeReference(random), message: ACCEPTED_MESSAGE });
      return;
    }

    const at = now();
    const sourceHash = hashSource(clientIp(req.headers));

    const idempotencyKeyHeader = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader)
      ? (idempotencyKeyHeader[0] ?? null)
      : (idempotencyKeyHeader ?? null);

    let reference: string;

    try {
      if (idempotencyKey) {
        const existing = await store.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          res.status(202).json({ reference: existing.reference, message: ACCEPTED_MESSAGE });
          return;
        }
      }

      const windowStart = new Date(at.getTime() - RATE_LIMIT.windowMinutes * 60_000);
      if ((await store.countSince(sourceHash, windowStart)) >= RATE_LIMIT.max) {
        throw new HttpError(
          429,
          apiError(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please phone the clinic instead.'),
        );
      }

      reference = makeReference(random);
      const purgeAfter = new Date(at.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

      await store.insert({
        reference,
        serviceSlug: body.serviceSlug,
        practitioner: body.practitioner || null,
        fullName: body.fullName,
        phone: body.phone || null,
        email: body.email || null,
        preferred: body.preferred,
        reason: body.reason || null,
        consentAt: at,
        sourceHash,
        idempotencyKey,
        purgeAfter,
      });
    } catch (err) {
      if (err instanceof HttpError) throw err; // 429 and friends pass through untouched
      const phone = clinicPhone?.() ?? '';
      const id = requestId();
      logStoreFailure(id);
      throw new HttpError(
        503,
        apiError(
          ERROR_CODES.UNAVAILABLE,
          `We couldn't save your request just now. Please phone the clinic on ${phone}.`,
          { requestId: id },
        ),
      );
    }

    try {
      // Whitelisted. The reason column is health information and never leaves here.
      await notify(
        notificationPayload({ reference, fullName: body.fullName, serviceSlug: body.serviceSlug, createdAt: at.toISOString() }),
      );
    } catch {
      // The record is already stored safely; a notification failure must
      // never surface to the patient as an error.
      logNotifyFailure(requestId());
    }

    res.status(202).json({ reference, message: ACCEPTED_MESSAGE });
  });
}

/**
 * Log helper for this route. Deliberately takes field names, never a body.
 * Importing this instead of calling console directly is what stops a future
 * change from logging the request payload.
 */
export function logValidationFailure(requestId: string, fields: Record<string, string> | undefined) {
  console.error(
    JSON.stringify({ level: 'warn', route: 'booking-requests', requestId, invalidFields: safeFieldNames(fields) }),
  );
}

/**
 * Logged when a store read/write throws (503 `UNAVAILABLE` path). Field-safe
 * like `logValidationFailure` above: requestId and route context only, never
 * the request body or the thrown error's own message — an underlying driver
 * error could in principle echo query parameters, so it is never serialised
 * here.
 */
export function logStoreFailure(id: string) {
  console.error(JSON.stringify({ level: 'error', route: 'booking-requests', requestId: id, stage: 'store' }));
}

/** Logged when `notify` throws. The failure is swallowed — the booking is
 *  already safely stored — but still recorded field-safe for observability. */
export function logNotifyFailure(id: string) {
  console.error(JSON.stringify({ level: 'error', route: 'booking-requests', requestId: id, stage: 'notify' }));
}

/**
 * Real wiring, lazily constructed on first invocation — see the matching
 * comment in admin-auth.ts / purge.ts for why this is not module-scope
 * work. `getDb()` must not be called at import time, or the route becomes
 * un-importable for unit tests without `POSTGRES_URL`.
 */
let cached: Handler | undefined;

export default function handler(req: Req, res: Res): Promise<void> | void {
  cached ??= createHandler({
    store: createBookingStore(getDb()),
    notify: createBookingNotifier(createFetchTransport(), {
      to: process.env['BOOKING_NOTIFY_TO'] ?? '',
    }),
    clinicPhone: () => process.env['CLINIC_PHONE'] ?? '',
  });
  return cached(req, res);
}

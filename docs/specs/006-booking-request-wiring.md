# 006 — Booking request: production wiring

**Status:** draft — awaiting approval
**Author:** reviewer follow-up to 002/005, 2026-07-25

## Problem

The booking endpoint from spec 002 cannot be invoked in production. Its route
file `apps/api/routes/booking-requests.ts` exports only the `createHandler`
factory used by tests — it has **no default export**, so Vercel has no function
to serve, and there is **no `createBookingStore` in `packages/db`** to back the
`BookingStore` seam the handler depends on. Every sibling route (`purge.ts`,
`admin-requests.ts`, `admin-auth.ts`) ends with a lazily-constructed
`export default function handler` wired to a `createXStore(getDb())` factory;
`booking-requests.ts` is the only one missing this. The endpoint has therefore
never been reachable — the entire 002 feature is dead on the deployed site.

This was surfaced while planning spec 005, whose 503 `UNAVAILABLE` contract adds
a `clinicPhone` dependency to the handler's `Deps` and needs it injected at this
wiring point. Plan 005 deferred the "where does the clinic phone come from on the
API side" decision to this follow-up, because there was no default export to
inject it into.

## Goal

`POST /api/booking-requests` is invocable in production: backed by a real
Drizzle store, sending a real (privacy-safe) reception notification, and exposing
the `clinicPhone` injection seam that spec 005 consumes for its 503 path — with
the single source of that phone number decided and recorded.

## Non-goals

- **No behaviour change to `createHandler`'s request logic.** Happy path,
  honeypot, idempotency, rate-limit, purge date, consent, source hashing and the
  "`reason` never leaks" containment are all reviewed-correct and stay untouched.
  This spec adds wiring around the handler, not logic inside it.
- **Not the 503 `UNAVAILABLE` / `RATE_LIMITED` contract** — that is spec 005.
  006 only *introduces and wires* the `clinicPhone` seam 005 will read; 006 does
  not add the failure-mode behaviour or consume the seam inside the handler.
- **No live-DB test harness.** The store is unit-testable against a fake `Db`
  double, consistent with the rest of `packages/db`.
- No schema change, no new runtime dependency, no SMS.

## User / integrator flows

1. A patient submits a valid request in production → it is persisted to
   `booking_requests` via `createBookingStore`, reception is notified with the
   whitelisted fields only, and the caller gets the 202 + reference from 002.
2. Spec 005's handler reads an injected `clinicPhone` for its 503 message; in
   production that value resolves from a single, documented source.

## Acceptance criteria

- [ ] AC1: `createBookingStore(db)` exists in `packages/db/src/` and is exported
      from the package index. It implements the `BookingStore` interface —
      `countSince`, `findByIdempotencyKey`, `insert` — using Drizzle against the
      `booking_requests` table. All Drizzle query operators stay in
      `packages/db`; `apps/api` gains no `drizzle-orm` import (CLAUDE.md
      isolation rule).
- [ ] AC2: `countSince(sourceHash, since)` returns the count of rows with that
      `sourceHash` and `createdAt >= since`, and nothing else — a different
      source, or a row older than `since`, is not counted. Named test.
- [ ] AC3: `findByIdempotencyKey(key)` returns `{ reference }` for a matching row
      and `null` when there is no match. Named test.
- [ ] AC4: `insert(row)` persists every field of the `BookingStore.insert`
      argument to the correct column, including `reason`, `consentAt`,
      `sourceHash` and `purgeAfter`; it names none of the admin/attribution
      columns (they take their schema defaults). Named test.
- [ ] AC5: `booking-requests.ts` gains a lazy `export default function handler`
      that constructs `createHandler` once, backed by
      `createBookingStore(getDb())`, a real mailer-backed `notify`, and the
      `clinicPhone` seam — never at module scope, matching the pattern in
      `purge.ts` / `admin-requests.ts`.
- [ ] AC6: The production `notify` is backed by the mailer seam in
      `apps/api/lib/mailer.ts` and delivers only the whitelisted
      `NOTIFIABLE_FIELDS` (`reference`, `fullName`, `serviceSlug`, `createdAt`).
      No health information (`reason`), patient phone or patient email can appear
      in the notification — guaranteed structurally because `notify` is only ever
      called with the output of `notificationPayload(...)`. Named test asserts the
      notifier body never contains `reason`.
- [ ] AC7: `Deps` gains a `clinicPhone` seam and the default export supplies it
      from the single source decided in ADR 0001. `createHandler`'s existing
      logic and its tests are unchanged (the seam is declared and wired, consumed
      only by spec 005).
- [ ] AC8: `getDb()` is still not called at module load — importing the route
      for a unit test does not require `POSTGRES_URL`. All existing 002 handler
      tests pass unmodified.

## Data

No schema change. The store reads and writes the existing `booking_requests`
columns and their existing indexes:

- `countSince` is served by `booking_requests_source_window` on
  `(source_hash, created_at)`.
- `findByIdempotencyKey` is served by the unique `idempotency_key`.

## Decision to record — clinic-phone source (was deferred by plan 005)

The clinic's phone number is shown to a patient in spec 005's 503 message. The
web form already reads it from `apps/web/src/content/clinic.ts`. `apps/api`
cannot import that file — it is browser-side content in a different app — so the
API needs its own source. The two candidates plan 005 named:

- **A. Env var `CLINIC_PHONE`, injected via a `clinicPhone` seam.** Consistent
  with every other API-side config seam (`CRON_SECRET`, `ADMIN_APP_URL`,
  `MAIL_*`, `SOURCE_HASH_SALT`), keeps `apps/api` decoupled from `apps/web`, and
  matches the reality that the clinic details in this repo are per-deployment
  placeholders ("replace with the real clinic details before launch"), i.e.
  deployment configuration.
- **B. Promote the clinic contact block into `packages/shared`.** A true single
  compile-time constant shared by web and api, but it moves per-deployment
  placeholder *data* into a package imported at build time by `db` and `api`,
  and forces a larger change touching the web content file.

**Decision: A.** The number is deployment/tenant configuration, which this repo
already handles through environment-variable seams; a compiled constant is the
wrong home for a value that changes per clinic. Recorded in
`docs/decisions/0001-clinic-phone-source.md`. The residual risk — the env value
and the web content file must agree — is documented in the ADR; a future
unification (web reading the same value via a `VITE_`-prefixed var) is noted
there but out of scope here. The handler must **never hard-code** the number
(spec 005's rule); the seam reads env only.

## Edge cases

- `countSince` with no matching rows returns `0`, not `null`/`undefined`.
- `insert` must not reference any admin column (`internalNote`, `version`,
  `statusUpdatedAt`, `lastActionedBy`, `contactedAt`) — they exist only because
  003/004 expanded the table and must keep taking their defaults, exactly as
  002's insert always did.
- A `notify` failure is currently fatal (the handler awaits it unguarded, as it
  has since 002). 006 does not change that; making a failed notification
  non-fatal is spec 005's edge case and its handler-level concern. 006 therefore
  wires `notify` to reject on transport failure and does **not** swallow inside
  the notifier, so 005's handler-level test remains meaningful.

## Notes for planning (architect)

- Store file: `packages/db/src/bookingStore.ts`, exported from
  `packages/db/src/index.ts`, mirroring `purgeStore.ts` / `adminRequestsStore.ts`
  (plain-object factory over `Db`). Use Drizzle's `count()` aggregate for
  `countSince`.
- The mailer-backed notify belongs in `apps/api/lib/notify.ts` — the home plan
  002 intended but never created. Keep it thin: format the whitelisted payload
  into a reception email over the existing `MailTransport`; recipient from a new
  env var (e.g. `BOOKING_NOTIFY_TO`).
- List every touched path in the plan so the scope guard passes.

## Open questions

1. Notifier recipient env var name — `BOOKING_NOTIFY_TO` assumed. [assumed]
2. Should the notifier reuse `createFetchTransport()` directly, or should a
   `createBookingNotifier(transport, opts)` factory take the transport for
   testability? [assumed the factory form, matching `createMailer(transport)`]

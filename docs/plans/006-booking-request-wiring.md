# 006 — Implementation plan: Booking request production wiring

Spec: docs/specs/006-booking-request-wiring.md

## Approach

Close the one gap that makes the 002 endpoint unreachable in production, without
touching a line of the reviewed-correct handler logic. Three additions, each
mirroring an existing sibling:

1. **A Drizzle store, `createBookingStore(db)`**, in `packages/db/src/`,
   implementing the three-method `BookingStore` seam the handler already depends
   on. It is the booking-side twin of `createPurgeStore` / `createAdminRequestsStore`:
   a plain-object factory over `Db`, so every `drizzle-orm` operator stays inside
   `packages/db` and `apps/api` never imports one (CLAUDE.md isolation rule).
2. **A lazy `export default function handler`** in `booking-requests.ts`, built
   once on first invocation from `createBookingStore(getDb())`, a real notify, and
   the `clinicPhone` seam — identical cold-start discipline to `purge.ts` and
   `admin-requests.ts` (`getDb()` is never called at module load).
3. **A mailer-backed notify**, `apps/api/lib/notify.ts` — the file plan 002
   named but never created. It formats the already-whitelisted notification
   payload into a reception email over the existing `MailTransport`. Because it is
   only ever handed the output of `notificationPayload(...)`, it is structurally
   incapable of carrying `reason`, patient phone, or patient email.

The one design decision this plan settles — deferred here by plan 005 — is the
**source of the clinic phone number on the API side**: environment variable
`CLINIC_PHONE`, injected through a `clinicPhone` seam on `Deps`, recorded in
ADR 0001. Rationale in the spec's "Decision to record" section: the clinic
details in this repo are per-deployment placeholders, i.e. deployment
configuration, and this codebase already handles that class of value through
env-var seams (`CRON_SECRET`, `ADMIN_APP_URL`, `MAIL_*`, `SOURCE_HASH_SALT`) —
not through compile-time constants in `packages/shared`. `apps/api` also cannot
import `apps/web/src/content/clinic.ts` (browser-side content in a different
app), so a shared source would have required moving that data into `shared`.

## Scope boundary with spec 005 — read before implementing

005 and 006 are adjacent and must not collide:

- **006 introduces and wires the `clinicPhone` seam; 005 consumes it.** 006 adds
  `clinicPhone?: () => string` to `Deps` and supplies it from env in the default
  export. It does **not** destructure or read it inside `createHandler` — so there
  is no unused binding and no lint failure, and 005 is free to add the 503 branch
  that reads it. Passing a declared-but-unread `Deps` property is legal TypeScript
  (no excess-property error) and leaves 005's consumer test meaningful.
- **006 does not touch the error contract.** `RATE_LIMITED`, `UNAVAILABLE`, and
  the 503-on-store-error behaviour are entirely 005's. 006 wires `notify` to
  reject on transport failure and deliberately does **not** swallow inside the
  notifier, because 005's "a failed notify is logged and swallowed" is a
  *handler-level* rule whose test injects a throwing notify — swallowing in the
  notifier would make that test un-writable.
- **006 creates `apps/api/lib/notify.ts`**, one of the two files (`notify.ts`,
  `rateLimit.ts`) plan 005's spec notes were planned in 002 but never created.
  006 legitimately creates `notify.ts` as production code that did not exist;
  005's separate reconciliation of the 002 *file table* (where `notificationPayload`,
  `makeReference`, `privacy.ts` and the inline rate-limit live) is unaffected.

**Ordering:** 006 should merge before or together with 005. Until 005 lands, a
notify transport failure surfaces as a 500 (the handler has awaited notify
unguarded since 002); 006 does not regress this and 005 closes it.

## Files

| Path | Action | What changes |
|------|--------|--------------|
| packages/db/src/bookingStore.ts | create | `createBookingStore(db)`: `countSince` (via `count()` over `booking_requests_source_window`), `findByIdempotencyKey` (unique `idempotency_key`), `insert` (writes the 002 columns only, admin columns take defaults) |
| packages/db/src/bookingStore.test.ts | create | store behaviour against a fake `Db` double: count filters by source+window, idempotency hit/miss, insert column mapping incl. `reason`/`consentAt`/`purgeAfter`, admin columns untouched |
| packages/db/src/index.ts | modify | `export * from './bookingStore.js'` |
| apps/api/lib/notify.ts | create | `createBookingNotifier(transport, { to })` → `(payload) => Promise<void>`; formats the whitelisted fields into a reception email; carries no `reason`/patient contact |
| apps/api/lib/notify.test.ts | create | notifier sends over an injected fake transport; asserts subject/body use only whitelisted fields and never contain `reason`; rejects when the transport rejects |
| apps/api/routes/booking-requests.ts | modify | add `clinicPhone?: () => string` to `Deps`; add lazy `export default function handler` wiring `createBookingStore(getDb())` + notify + `clinicPhone`. No change to `createHandler` logic. |
| apps/api/routes/booking-requests.test.ts | modify | add one test asserting the default export builds without `POSTGRES_URL` / does not call `getDb` at import (AC8); all existing tests unchanged |
| docs/decisions/0001-clinic-phone-source.md | create | ADR: `CLINIC_PHONE` env is the API-side source; rationale, the env↔web-content agreement risk, and the future `VITE_` unification path |
| .env.example | modify | document `CLINIC_PHONE` and `BOOKING_NOTIFY_TO` (public/non-secret) |

Exhaustive. No change to `booking_requests`' columns, `schema.ts`, migrations,
the frontend, or any other route. No change to `createHandler`'s request logic.

## Database changes

**None.** The store reads and writes existing columns through existing indexes
(`booking_requests_source_window` for `countSince`, unique `idempotency_key` for
`findByIdempotencyKey`). No migration, no `schema.ts` edit.

## Store contract

`createBookingStore(db)` returns an object structurally matching `BookingStore`:

- `countSince(sourceHash, since) -> Promise<number>`:
  `SELECT count(*) FROM booking_requests WHERE source_hash = $1 AND created_at >= $2`.
  Uses Drizzle `count()`; returns `Number(rows[0]?.value ?? 0)` so an empty result
  is `0`, never `undefined`. `>=` matches 002's window semantics (the existing
  handler compares against `windowStart` inclusively).
- `findByIdempotencyKey(key) -> Promise<{ reference } | null>`:
  `SELECT reference ... WHERE idempotency_key = $1 LIMIT 1`; `null` on no row.
- `insert(row) -> Promise<void>`: single `INSERT` naming exactly the fields on the
  `BookingStore.insert` argument (`reference`, `serviceSlug`, `practitioner`,
  `fullName`, `phone`, `email`, `preferred`, `reason`, `consentAt`, `sourceHash`,
  `idempotencyKey`, `purgeAfter`). It names **no** admin/attribution column, so
  `status`, `version`, `createdAt`, `internalNote`, `lastActionedBy`,
  `statusUpdatedAt`, `contactedAt` all take their schema defaults — exactly as
  002's insert always has. Single statement, so the "throws after a partial write"
  edge cannot occur.

## Notify contract

`createBookingNotifier(transport: MailTransport, { to }: { to: string })` returns
`(payload: Record<string, unknown>) => Promise<void>`. It reads only
`reference`, `fullName`, `serviceSlug`, `createdAt` from the payload (the same
`NOTIFIABLE_FIELDS` whitelist that produced it) and sends a plain reception
email: subject e.g. `New booking request <reference>`, body naming the service
and time and pointing reception at the admin list. It awaits `transport.send`
and propagates its rejection. Privacy is guaranteed by construction: the handler
only ever calls `notify(notificationPayload({...}))`, and the notifier reads no
other key, so `reason`/patient phone/patient email cannot appear.

## Wiring

```ts
// booking-requests.ts — appended, mirroring purge.ts / admin-requests.ts
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
```

`Deps` gains `clinicPhone?: () => string`. `createHandler`'s destructuring and
body are untouched; the seam is present for 005 to read.

## Test plan

Store and notifier are unit-tested with fakes; no live-DB harness, matching the
repo. Store tests use a hand-rolled `Db` double that records the query builders'
terminal calls (the same approach the store methods expose structurally).

- AC1 -> `packages/db/src/bookingStore.test.ts::implements the BookingStore seam over booking_requests`
- AC2 -> `packages/db/src/bookingStore.test.ts::counts only rows matching the source hash inside the window`
- AC3 -> `packages/db/src/bookingStore.test.ts::returns the reference for a known idempotency key and null otherwise`
- AC4 -> `packages/db/src/bookingStore.test.ts::inserts every booking field and names no admin column`
- AC5 -> `apps/api/routes/booking-requests.test.ts::exposes a default export that builds the handler lazily`
- AC6 -> `apps/api/lib/notify.test.ts::sends only whitelisted fields and never the reason`
- AC7 -> `apps/api/routes/booking-requests.test.ts::accepts an injected clinicPhone seam without changing existing behaviour` (existing 002 suite re-run unchanged)
- AC8 -> `apps/api/routes/booking-requests.test.ts::importing the route does not require POSTGRES_URL`

## Rollback

Pure addition. If the endpoint misbehaves, the revert is the whole 006 diff — the
store, notifier and default export are new; nothing existing changed behaviour, so
reverting restores the (non-functional but harmless) prior state. No migration to
undo. `CLINIC_PHONE` / `BOOKING_NOTIFY_TO` are additive env vars; unsetting them
degrades the 503 message (005) and the notification recipient respectively, not
the happy path's persistence.

## Risks

1. **A real, fallible notify makes a mailer outage 500 a booking that WAS
   saved.** The insert commits before notify runs, so the record is safe, but the
   caller sees a 500. This is pre-existing 002 behaviour (unguarded await), not
   introduced here; it is closed by 005's swallow-and-log. Mitigation: land 006
   with or before 005, and note it in the PR.
2. **`CLINIC_PHONE` drifts from the web content file.** Two sources for one
   number. Accepted and documented in ADR 0001; mitigated by both being
   set-once-per-environment placeholder values and by the ADR flagging the future
   `VITE_`-var unification. The handler never hard-codes the number (005's rule).
3. **A future column added to the insert leaks into a notification.** Prevented
   structurally: notify only reads the `NOTIFIABLE_FIELDS` whitelist, and the
   store insert is independent of the notifier. Adding a column touches neither
   path silently.
4. **`getDb()` accidentally called at module load** would make the route
   un-importable for tests and break cold starts. Mitigated by the lazy-cache
   pattern (AC8 test asserts import without `POSTGRES_URL`).

## Not doing

The 503 `UNAVAILABLE` / `RATE_LIMITED` contract (005), swallowing notify failures
(005), reconciling 002's file table (005), any schema change, SMS, a real mail
provider (still configured by env per the mailer seam's existing design), and
unifying the web/API phone source into one runtime value (noted in ADR 0001 as
future work).

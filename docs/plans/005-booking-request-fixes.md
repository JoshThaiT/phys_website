# 005 — Implementation plan: Booking request error-contract fixes

Spec: docs/specs/005-booking-request-fixes.md

## Approach

Three surgical changes to the already-shipped 002 endpoint. No schema change,
no happy-path change, no new dependency. The work is: name the rate-limit error
correctly, degrade a store outage to an actionable 503 instead of a dead 500,
and reconcile the 002 plan-of-record with the tree so the scope guard passes.

Two structural facts on the ground shape the plan:

1. **The API cannot read the clinic phone from `apps/web/src/content/clinic.ts`.**
   That is frontend content in a different workspace; `apps/api` importing it
   crosses the app boundary. Per the DI convention already used for `now` and
   `random`, the phone is an **injected dependency** — `clinicPhone: string` on
   `Deps`. No number is hard-coded in the handler, and no cross-app import is
   introduced. Tests inject a sample value.

2. **`booking-requests.ts` has no production wiring yet** (no `export default`,
   no `createBookingStore` in `packages/db`). The 503 contract built here is
   therefore exercised by tests now and becomes reachable in production when the
   wiring lands. That wiring is deliberately **out of scope for 005** and is
   tracked as a separate spec (006) — see "Not doing".

## Files

| Path | Action | What changes |
|------|--------|--------------|
| packages/shared/src/errors.ts | modify | Add `RATE_LIMITED` and `UNAVAILABLE` to `ERROR_CODES` |
| apps/api/handler.ts | modify | Export the existing `requestId()` helper so the route can log a quotable id on the 503 path |
| apps/api/routes/booking-requests.ts | modify | 429 → `RATE_LIMITED`; add `clinicPhone` to `Deps`; wrap store reads/writes so any throw → 503 `UNAVAILABLE` with a phone-bearing message and requestId; move `notify()` into its own try/catch that logs field-safe and swallows |
| apps/api/routes/booking-requests.test.ts | modify | Correct the insert-fails test to expect 503; add store-throws-on-read (`countSince`, `findByIdempotencyKey`) → 503 tests; assert 429 carries `RATE_LIMITED` and never `CONFLICT`; assert a thrown `notify()` still returns 202; assert the 503 log carries requestId + field names only and never the reason |
| apps/web/src/routes/Book.tsx | modify | Add a distinct 503 branch keyed on `err.code === 'UNAVAILABLE'`: retain the typed values (RHF already preserves them — the form is not reset on error) and show the clinic phone as a `tel:` link, visually separate from the generic error alert |
| apps/web/src/routes/Book.test.tsx | modify/create | AC4: a 503 `UNAVAILABLE` response renders the phone branch and keeps the entered values |
| docs/plans/002-booking-requests.md | modify | Reconcile the Files table with reality: `apps/api/lib/notify.ts` and `apps/api/lib/rateLimit.ts` were never created; record that `notificationPayload` + `makeReference` live in `packages/shared/src/booking.ts`, the rate-limit is inline in the handler, and source hashing lives in `apps/api/lib/privacy.ts` |

## Handler shape

```
parse(...)                     // throws HttpError(400) — OUTSIDE the try, unchanged
honeypot early-return          // before any store call, unchanged
try {
  findByIdempotencyKey / countSince / insert
  // the existing 429 throw stays HERE, inside the try
} catch (err) {
  if (err instanceof HttpError) throw err;   // 429 and friends pass through untouched
  const id = requestId();
  logStoreFailure(id);                        // field names only, never the body/reason
  throw new HttpError(503, apiError(
    ERROR_CODES.UNAVAILABLE,
    `We couldn't save your request just now. Please phone the clinic on ${clinicPhone}.`,
    { requestId: id },
  ));
}
try { await notify(...) } catch (err) { logNotifyFailure(id) }  // swallowed — never a 503
```

Key invariants:
- The 503 payload contains only `code`, `message`, `requestId` — it never
  echoes the request body (AC2).
- The store-failure log takes field names, never values, mirroring
  `logValidationFailure` (AC3).
- A failed `notify()` is logged and swallowed; the record is already stored, so
  the patient still sees 202 (spec edge case).

## API contract (now matching 002's documented contract)

`POST /api/booking-requests`

- 202 `{ reference, message }` — unchanged
- 400 `{ error: { code: 'VALIDATION_FAILED', fields } }` — unchanged
- 429 `{ error: { code: 'RATE_LIMITED', message } }` — **was `CONFLICT`**
- 503 `{ error: { code: 'UNAVAILABLE', message, requestId } }` — **new**

## Test plan

| AC | Test |
|----|------|
| AC1 | `booking-requests.test.ts::rejects the sixth request with RATE_LIMITED` (asserts code, and not `CONFLICT`) |
| AC2 | `booking-requests.test.ts::returns 503 when the store throws on read` and `::on write` (the corrected insert test); both assert code `UNAVAILABLE`, phone in message, and no reason echoed |
| AC3 | `booking-requests.test.ts::logs the 503 by requestId and field names only` |
| AC4 | `Book.test.tsx::renders the unavailable branch with the phone and keeps entered values` |
| AC5 | The full existing 002 suite stays green; the only edited assertion is the insert-fails test flipping 500 → 503 (a correction, not a weakening) |
| edge | `booking-requests.test.ts::a failed notify still returns 202` |

## Rollback

Pure revert. No schema change, no data migration, nothing to undo in the
database.

## Risks

1. **The corrected 500→503 test could read as weakening a test.** It is not —
   the old assertion encoded the bug 005 exists to fix. The plan names it
   explicitly so the reviewer expects the change.
2. **`clinicPhone` has no production source until the wiring spec lands.** The
   503 message is correct and tested; in production the endpoint is currently
   unreachable regardless (no `export default`). Documented, not hidden.

## Not doing

- Production wiring for the booking endpoint (`export default` +
  `createBookingStore(getDb())`). Tracked as a separate spec — the 503 contract
  here is ready for it but does not depend on it.
- Any change to the happy path, schema, honeypot, idempotency, or the privacy
  containment of `reason` (all reviewed correct in 002).
- SMS, admin list (003), purge (004).

# 005 — Booking request: error contract and failure-mode fixes

**Status:** draft — awaiting approval
**Author:** reviewer follow-up to 002, 2026-07-24

## Problem

Spec 002 shipped the booking request endpoint. A review against its own plan
found two places where the running code does not match the contract the plan
promised, plus one structural divergence from the plan's file layout.

Two are visible to a caller or a patient:

1. A rate-limited request returns the error code `CONFLICT`, not the
   `RATE_LIMITED` the plan's API contract documents. `RATE_LIMITED` does not
   exist in `ERROR_CODES` at all, so a caller cannot tell a throttled request
   (429) apart from a genuine 409 conflict.
2. When the database is unreachable the handler returns a generic 500 ("Something
   went wrong on our end."). Spec 002 requires a 503 telling the person to phone
   the clinic, with the number shown — "a booking form that fails silently is
   worse than none." That path was never built.

The third is internal: the implementation put reference and notification helpers
in `packages/shared/src/booking.ts` and added `apps/api/lib/privacy.ts`, none of
which are in plan 002's Files table, while the planned `apps/api/lib/notify.ts`
and `apps/api/lib/rateLimit.ts` were never created. The code works, but the plan
of record and the tree disagree — the scope guard will block on the next change
until they are reconciled.

## Goal

The booking endpoint's error contract matches what a caller is told to expect,
and a database outage degrades to an actionable message instead of a dead form.

## Non-goals

- No change to the happy path, the schema, the honeypot, idempotency, or the
  privacy containment of the `reason` field — all reviewed and correct.
- No admin list (003), no purge job (004), no SMS.
- No new dependency.

## User / integrator flows

1. A caller exceeds the rate limit → 429 with
   `{ error: { code: 'RATE_LIMITED', message } }`.
2. A patient submits while the database is down → 503 with a message naming the
   clinic's phone number; the form keeps what they typed so they can phone or
   retry without re-entering it.

## Acceptance criteria

- [ ] AC1: A 429 response carries `code: 'RATE_LIMITED'`, and `RATE_LIMITED`
      exists in `ERROR_CODES`. No 429 path returns `CONFLICT`.
- [ ] AC2: When the store throws on read or write, the endpoint returns 503 with
      `code: 'UNAVAILABLE'` and a message containing the clinic phone number.
      It is never a 500 and never echoes the request body.
- [ ] AC3: The 503 path obeys the 002 privacy rule — no health information in the
      response, and the failure is logged by request id and field names only.
- [ ] AC4: The booking form renders the 503 case as its own branch: submitted
      values are retained and the phone number is shown, distinct from the
      generic error state.
- [ ] AC5: All existing 002 behaviour is unchanged — happy path, honeypot,
      idempotency, purge date, and the "reason never leaks" tests still pass.

## Edge cases

- Store throws *after* a partial write → the 503 must not imply success. Insert
  is a single statement so this is assured, but a test names it.
- Rate-limit boundary is unchanged: the 6th request in the window is the first
  rejected.
- Notification send failing is *not* a 503 — the record is already stored
  safely, so a failed notify is logged and swallowed, never surfaced to the
  patient as an error.

## Data

No schema change. `RATE_LIMITED` and `UNAVAILABLE` are added to `ERROR_CODES`
in `packages/shared/src/errors.ts`.

## Notes for planning (architect)

Reconcile plan 002's Files table with the tree before adding files: either
amend 002's plan to record where `notificationPayload`, `makeReference`,
`privacy.ts` and the inline rate-limit actually live, or move them to the
planned paths. This spec's own plan must list every file it touches so the
scope guard passes. The clinic phone number already lives in
`apps/web/src/content/clinic.ts` (`phone: '(02) 9557 0000'`) — read it from
there, never hard-code it in the handler or the form.

## Open questions

1. Should 503 fire on any store error, or only on connection-level failures?
   [assumed any thrown store error, so a caller never sees a raw 500]
2. Is 429 → `RATE_LIMITED` the only code rename needed, or should the 002
   contract be audited end to end for other drift? [assumed just this one; the
   review found no others]

# 002 — Implementation plan: Booking requests

Spec: docs/specs/002-booking-requests.md

## Approach

One table, one public endpoint, one form. The design work is almost entirely in
containing the health information rather than in the booking logic.

Three structural decisions carry the privacy requirements so they cannot be
undone by a later careless change:

1. **`reason` is the only column holding health information**, and it is
   nullable. Retention, redaction and access control have exactly one target.
2. **The handler never returns or logs the request body.** The error path logs
   a request id and the failing field *names*, never values. This is enforced
   by a test that submits a distinctive reason string and asserts it appears in
   neither the response nor the captured log output.
3. **The notification payload is built from a whitelist**, not by serialising
   the record. A whitelist that omits `reason` cannot accidentally start
   including it when a column is added.

Rate limiting and idempotency both live in Postgres because serverless has no
shared memory. A hashed source key plus a time window gives both.

## Files

| Path | Action | What changes |
|------|--------|--------------|
| packages/shared/src/booking.ts | create | Zod request/response schemas, consent, limits |
| packages/shared/src/index.ts | modify | export booking schemas |
| packages/db/src/schema.ts | modify | `booking_requests` table + indexes |
| apps/api/routes/booking-requests.ts | create | POST handler |
| apps/api/lib/rateLimit.ts | create | windowed limit keyed on a hashed source |
| apps/api/lib/notify.ts | create | whitelisted notification payload |
| apps/web/src/routes/Book.tsx | create | the form |
| apps/web/src/components/Field.tsx | create | labelled input with error wiring |
| apps/web/src/components/CollectionNotice.tsx | create | APP 5 notice |
| apps/web/src/App.tsx | modify | `/book` route |
| apps/web/src/components/Nav.tsx | modify | Book links to /book, not tel: |
| apps/web/src/routes/ServiceDetail.tsx | modify | Book links to /book?service=slug |

## Dependencies

- `react-hook-form` and `@hookform/resolvers` — CLAUDE.md already mandates this
  pairing with the shared Zod schema. Hand-rolling error focus management and
  ARIA wiring is where accessibility bugs come from.

## Database changes

```sql
CREATE TABLE booking_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending',
  service_slug  text NOT NULL,
  practitioner  text,
  full_name     text NOT NULL,
  phone         text,
  email         text,
  preferred     jsonb NOT NULL DEFAULT '[]',
  reason        text,               -- HEALTH INFORMATION. Treat accordingly.
  consent_at    timestamptz NOT NULL,
  source_hash   text NOT NULL,      -- salted hash, never a raw IP
  idempotency   text UNIQUE,
  purge_after   timestamptz NOT NULL,
  contacted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_requests_status_created ON booking_requests (status, created_at DESC);
CREATE INDEX booking_requests_purge ON booking_requests (purge_after);
CREATE INDEX booking_requests_source_window ON booking_requests (source_hash, created_at DESC);
```

This is the first PR in the sequence and creates a new table, so it is
trivially backwards compatible: currently deployed code does not reference it.

`source_hash` is a salted SHA-256 of the client IP. A raw IP is personal
information with no retention justification here; the hash supports rate
limiting and nothing else.

## API contract

`POST /api/booking-requests`

- 202 `{ reference: string }` — accepted, reception will make contact
- 400 `{ error: { code: 'VALIDATION_FAILED', fields: {...} } }` — field *names*
  only, never values
- 429 `{ error: { code: 'RATE_LIMITED' } }`
- 503 `{ error: { code: 'UNAVAILABLE', message: <phone the clinic> } }`

## Test plan

| AC | Test |
|----|------|
| AC1 | `booking.test.ts::requires a name and at least one contact method` |
| AC2 | `booking.test.ts::rejects a request without consent` |
| AC3 | `booking.test.ts::caps the reason at 500 characters` |
| AC4 | `booking-requests.test.ts::returns 202 with a reference` |
| AC5 | `Book.test.tsx::shows the collection notice before submission` |
| AC6 | `booking-requests.test.ts::never echoes the reason into a response or log` |
| AC7 | `booking-requests.test.ts::is idempotent within the window` |
| AC8 | `rateLimit.test.ts::rejects the sixth request in ten minutes` |
| AC9 | `booking-requests.test.ts::silently discards a honeypot submission` |
| AC10 | `booking-requests.test.ts::sets a purge date 90 days out` |
| AC11 | `Book.test.tsx::focuses the first invalid field and announces the error` |

## Rollback

Revert the deploy. The table can be left in place — no deployed code references
it after a revert. If the table must go, it holds health information, so it is
dropped, not left orphaned.

## Risks

1. **The reason field leaking into a log or an email.** Highest-severity risk
   in this plan. Mitigated by the whitelist notification payload and the
   never-echoes test, and it is the reviewer's first check on this PR.
2. **Retention never actually running.** `purge_after` is written but nothing
   deletes it yet. A scheduled purge job is required before launch — tracked as
   spec 004 and it is a launch blocker, not a nice-to-have.
3. **This is not legal advice.** The controls encode a good-faith reading of
   the APPs and the NSW HRIP Act. A practitioner should have a privacy policy
   reviewed before collecting real data.

## Not doing

Admin list (spec 003), purge job (spec 004), SMS notification, analytics.

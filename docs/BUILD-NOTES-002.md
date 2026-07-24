# Build notes — spec 002, booking requests

`pnpm verify` green: 123 tests. `pnpm build` succeeds.

## Why this spec is a privacy build, not a forms build

You chose request-only, no payment, and a free-text reason for visit. The first
two are the low-risk options. The third changes the system's legal character.

Under the Privacy Act 1988, an organisation that provides a health service and
holds health information is covered **regardless of turnover** — the $3m small
business exemption does not apply to health service providers. "Lower back pain
since my surgery" is health information, which is sensitive information, which
requires consent to collect and attracts a higher standard of protection. NSW
providers are additionally subject to the Health Records and Information
Privacy Act 2002.

So the design work went into containment, not into the form.

## Three structural controls

1. **One column holds health information.** `booking_requests.reason` is the
   only one. Retention, redaction and access control have a single target
   instead of being spread across a wide table.

2. **The notification is built from a whitelist.** `notificationPayload()`
   copies four named fields. A test adds a `diagnosisCode` field and asserts it
   does not appear — so a column added in a year cannot silently start leaking
   into reception's inbox.

3. **Logging takes field names, never values.** `safeFieldNames()` exists so a
   validation error on the reason field cannot write health information into a
   log line that outlives the record. A test throws a database error mid-request
   and asserts the reason text appears in neither the response nor the captured
   log.

Supporting decisions: consent is `NOT NULL` so a row cannot exist without it;
the client IP is stored only as a salted hash, and `hashSource` throws rather
than hashing unsalted if the salt is missing; every row gets a `purge_after` at
write time.

## What the tests caught

- **The honeypot was wrong.** The schema rejected a filled honeypot with a 400,
  which tells a bot exactly which field to leave alone next time. The spec said
  accept-and-discard. The spec was right; the schema now accepts it and the
  handler drops it silently.
- **react-hook-form and Zod disagreed on types**, because `.default([])` makes
  a field optional on input and required on output. The form is now typed on
  the input side and the handler on the output side.

## Launch blockers — do not collect real data until these are done

1. **Nothing deletes expired rows.** `purge_after` is written but no job reads
   it. A scheduled purge is spec 004 and it is a blocker, not a nice-to-have —
   a retention promise you do not keep is worse than not making it.
2. **No integration tests against a real Postgres.** The handler is tested
   against an injected store, which proves the privacy logic but not the SQL.
   Run these against a test database before merge.
3. **`SOURCE_HASH_SALT` must be set** in every environment, or requests fail
   closed.
4. **A privacy policy needs writing and reviewing.** The collection notice on
   the form covers APP 5 at the point of collection; it is not a policy.
5. **No analytics, tag manager or session recorder may be added to /book.**
   Session recorders capture form contents, including the reason field.

**None of this is legal advice.** It encodes a good-faith reading of the APPs
and the NSW HRIP Act. Have a practitioner review it before launch.

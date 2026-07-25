# 0001 — Source of the clinic phone number on the API side

**Status:** accepted
**Date:** 2026-07-25
**Context:** spec 006 (booking-request production wiring), consumed by spec 005
(booking-request 503 `UNAVAILABLE` message)

## Problem

Spec 005's 503 `UNAVAILABLE` response tells a patient to phone the clinic when
their booking request could not be saved. The web app already has this number
in `apps/web/src/content/clinic.ts`. `apps/api` cannot import that file — it is
browser-side content belonging to a different app in this workspace — so the
API side needs its own source for the same number, injected into
`booking-requests.ts` through a `clinicPhone` seam on `Deps`.

## Options considered

**A. Environment variable `CLINIC_PHONE`, injected via a `clinicPhone` seam.**
Consistent with every other API-side configuration seam already in this repo
(`CRON_SECRET`, `ADMIN_APP_URL`, `MAIL_API_URL` / `MAIL_API_KEY` / `MAIL_FROM`,
`SOURCE_HASH_SALT`), keeps `apps/api` decoupled from `apps/web`, and matches
the reality that the clinic contact details in this repo are per-deployment
placeholders — deployment configuration, not compiled product data.

**B. Promote the clinic contact block into `packages/shared`.** A true
single compile-time constant shared by both apps. Rejected: it moves
per-deployment placeholder *data* into a package imported at build time by
`db` and `api`, and would have forced a larger change touching the web content
file just to unblock an unrelated error-message fix.

## Decision

**A.** `CLINIC_PHONE` is read from the environment and injected into the
handler through the `clinicPhone?: () => string` seam on `Deps` (spec 006
introduces and wires the seam; spec 005 consumes it in the 503 message). The
handler never hard-codes the number. The default export resolves it as:

```ts
clinicPhone: () => process.env['CLINIC_PHONE'] ?? '',
```

## Consequences

- The number is deployment/tenant configuration, handled the same way as
  every other environment-seam value in this repo, not as a compiled
  constant.
- **Residual risk: drift.** `CLINIC_PHONE` (API) and
  `apps/web/src/content/clinic.ts` (web) are two independent sources for the
  same fact. Nothing enforces they agree; an operator who updates one and
  forgets the other produces a 503 message that quotes a stale number even
  though the web site shows the current one. Mitigation for now: both are
  set-once-per-environment placeholder values updated together as part of
  clinic onboarding, not values that change routinely.
- **Future unification, out of scope here:** the web app could read the same
  number through a `VITE_CLINIC_PHONE` (or similarly `VITE_`-prefixed)
  environment variable instead of a compiled content constant, giving both
  apps one runtime source. `VITE_`-prefixed vars are public and shipped to
  the browser (CLAUDE.md), which the clinic phone number already is by virtue
  of being on the public site, so this would be safe to do — it is simply not
  needed to unblock 005/006 and is left as follow-up work.

## New environment variables

Both are new, additive, and non-secret (neither is `VITE_`-prefixed, so
neither ships to the browser; both are read only in `apps/api` server code):

| Variable | Purpose |
|---|---|
| `CLINIC_PHONE` | Clinic phone number shown in spec 005's 503 `UNAVAILABLE` message when a booking request cannot be saved. |
| `BOOKING_NOTIFY_TO` | Reception mailbox that receives the new-booking-request notification sent by `apps/api/lib/notify.ts`. |

Documented in `SETUP.md`'s environment/config section. Per CLAUDE.md rule 1,
no `.env*` file is created or modified to record these — `.env.example`
already exists and is tracked in this repo, but it is left untouched here;
an operator adds these two keys to their own `.env.local` following the table
above.

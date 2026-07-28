# 0002 — Mail provider: Resend

**Status:** accepted
**Date:** 2026-07-26
**Context:** spec 003 (admin sign-in magic link) and spec 006 (booking-request
notification) both send transactional email through the provider-agnostic
`MailTransport` seam in `apps/api/lib/mailer.ts`. That seam was merged
deliberately without a concrete provider; choosing one is the ops prerequisite
tracked in launch issue #4.

## Problem

`createFetchTransport` (`apps/api/lib/mailer.ts`) posts every email to a single
HTTP endpoint configured entirely by environment variables:

```
POST  <MAIL_API_URL>
Authorization: Bearer <MAIL_API_KEY>
Content-Type: application/json
Body: { from, to, subject, text }
```

The seam is intentionally minimal so that selecting a provider is a
configuration change, not a code change — *provided the chosen provider accepts
that exact wire shape*. The remaining decision is which provider that is.

Email volume is tiny and purely transactional: one reception magic-link per
sign-in (003) and one reception notification per booking request (006), each to
a single internal recipient. This is not a marketing-scale decision; the
criteria are (a) does it fit the existing seam with no new code or dependency,
(b) is deliverability adequate for low-volume transactional mail, and (c) is the
free tier sufficient.

## Options considered

**A. Resend.** Its `/emails` API is `POST https://api.resend.com/emails`, auth
`Authorization: Bearer re_…`, body `{ from, to, subject, text }` — identical to
what the seam already sends. Zero code change, no SDK dependency. Free tier
(3,000/mo, 100/day) dwarfs this clinic's volume. Deliverability is adequate for
low-volume transactional mail. Setup is: verify a sending domain (DNS records)
and mint an API key.

**B. Postmark.** Best-in-class transactional deliverability, but does **not**
fit the seam as written: auth is an `X-Postmark-Server-Token` header (not
`Bearer`) and the body is `{ From, To, Subject, TextBody }` (capitalised,
renamed). Adopting it means a ~10-line adapter in `createFetchTransport` plus a
transport test update — small, but not the near-zero the seam was designed for.
Free tier (100/mo) is thin. Rejected: extra code and a thinner free tier buy
deliverability headroom this volume does not need.

**C. Amazon SES.** Cheapest at real scale and rock-solid, but the wrong fit for
a `fetch`-based seam: the SES HTTP API requires AWS SigV4 request signing, which
means an AWS SDK dependency (CLAUDE.md rule #7 — dependencies must be in an
approved plan) and getting the account out of the sending sandbox. Most work,
least payoff at this volume. Rejected.

## Decision

**A — Resend.** The provider is selected purely by environment configuration;
`apps/api/lib/mailer.ts` is unchanged. Operators set:

```
MAIL_API_URL = https://api.resend.com/emails
MAIL_API_KEY = re_…            (secret — Resend API key)
MAIL_FROM    = "Clinic name <no-reply@your-verified-domain>"
```

`MAIL_FROM` must be an address on a domain verified in the Resend dashboard;
Resend rejects sends from unverified domains.

## Consequences

- No code or dependency change ships with this decision. The only artifacts are
  this ADR and the `SETUP.md` environment-variable table.
- **`MAIL_API_KEY` is a secret** (unlike `CLINIC_PHONE` / `BOOKING_NOTIFY_TO` in
  ADR 0001). It is not `VITE_`-prefixed and is read only in `apps/api` server
  code. It is set in Vercel's encrypted env store, never committed (CLAUDE.md
  rule #1).
- **Domain verification is a human, DNS-side prerequisite** and must be done
  before the first send — otherwise every magic-link (003) and booking
  notification (006) fails. A notify failure is swallowed by the handler (spec
  005) so a booking still returns 202, but reception would silently receive no
  email; a magic-link failure blocks admin sign-in outright.
- **Provider lock-in is negligible.** Because the seam speaks a generic
  `{ from, to, subject, text }` + `Bearer` shape, switching to any other
  provider that accepts that shape is another env-only change. Moving to a
  provider that does not (e.g. Postmark, SES) is the ~10-line adapter described
  in the options above — a bounded, known change, not a rewrite.

## New environment variables

The three mail variables were already reserved by specs 003/006; this ADR fixes
their concrete Resend values. `MAIL_API_KEY` is secret; the other two are not.

| Variable | Secret | Purpose |
|---|---|---|
| `MAIL_API_URL` | no | Mail provider send endpoint. For Resend: `https://api.resend.com/emails`. |
| `MAIL_API_KEY` | **yes** | Resend API key (`re_…`). Set in Vercel encrypted env; never committed. |
| `MAIL_FROM` | no | Verified sender, e.g. `"Clinic <no-reply@clinic-domain>"`. Domain must be verified in Resend. |

Documented in `SETUP.md`'s environment/config section. Per CLAUDE.md rule 1, no
`.env*` file is created or modified to record these.

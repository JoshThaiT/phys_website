# Setup

One command:

```bash
bash setup.sh
```

It checks Node, gets pnpm 11.17.0 running (via corepack, or `npx` if corepack
is blocked), installs everything, and runs the full verify suite. It's safe to
re-run — each step skips if already done.

**It will stop once**, partway through, because two things genuinely need a
human:

1. Create a free Neon Postgres account at https://neon.com (no card required).
2. Paste the two connection strings it gives you into `.env.local` (the script
   creates this file from the template on first run).

Run `bash setup.sh` again after that and it finishes on its own — generates
the database schema, applies it, and runs all 123 tests.

## What this script cannot do, and why

It runs on your machine, in your own terminal, using your own accounts. There
is no way for an AI assistant to reach into your computer or sign up for
services on your behalf — those two steps above are the only ones that
actually require you, and everything else is now one command.

## Environment variables

Set these in your own `.env.local` (never committed — see `.env.example` for
the full template). Two are new as of spec 006:

| Variable | Required | Purpose |
|---|---|---|
| `CLINIC_PHONE` | recommended | Clinic phone number shown to a patient in the booking form's 503 "we couldn't save your request" message (spec 005). Non-secret. |
| `BOOKING_NOTIFY_TO` | recommended | Reception mailbox that receives the new-booking-request notification email (spec 006, `apps/api/lib/notify.ts`). Non-secret. |
| `MAIL_API_URL` | required for email | Mail provider send endpoint. For Resend (ADR 0002): `https://api.resend.com/emails`. Non-secret. |
| `MAIL_API_KEY` | required for email | Resend API key (`re_…`). **Secret** — set in Vercel's encrypted env store, never committed. |
| `MAIL_FROM` | required for email | Verified sender address, e.g. `"Clinic <no-reply@your-domain>"`. The domain must be verified in Resend or sends are rejected. Non-secret. |

None is `VITE_`-prefixed, so none is shipped to the browser — all are read only
by `apps/api` server code. See
`docs/decisions/0001-clinic-phone-source.md` for why `CLINIC_PHONE` is an env
var rather than a value shared with the web app's content, and the drift risk
that follows from having two sources for the same number.
`docs/decisions/0002-mail-provider-resend.md` records why Resend was chosen and
how the provider-agnostic mail seam maps onto it (no code change — the three
`MAIL_*` values above configure it entirely).

Email delivery is disabled until all three `MAIL_*` vars are set: the transport
in `apps/api/lib/mailer.ts` throws `Mail transport is not configured` otherwise.
That blocks admin magic-link sign-in (spec 003) outright; a booking notification
failure (spec 006) is swallowed so a patient's request still returns 202, but
reception receives no email.

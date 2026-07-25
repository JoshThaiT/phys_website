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

Neither is `VITE_`-prefixed, so neither is shipped to the browser — both are
read only by `apps/api` server code. See
`docs/decisions/0001-clinic-phone-source.md` for why `CLINIC_PHONE` is an env
var rather than a value shared with the web app's content, and the drift risk
that follows from having two sources for the same number.

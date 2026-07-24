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

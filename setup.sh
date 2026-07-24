#!/usr/bin/env bash
# One-shot setup. Run this from inside the extracted `app` folder:
#   bash setup.sh
#
# Does everything scriptable: checks Node, gets pnpm working (corepack, or
# npx fallback if corepack is blocked), installs dependencies, and verifies
# the build. Stops and tells you exactly what to do for the two things only
# a human can do: creating a Neon account and pasting in the resulting URLs.
set -euo pipefail

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()  { printf '  \xe2\x9c\x93 %s\n' "$1"; }
die() { printf '\n\033[31mStopped: %s\033[0m\n' "$1"; exit 1; }

[ -f "package.json" ] && grep -q '"name": "website"' package.json \
  || die "Run this from inside the extracted 'app' folder (where package.json is)."

say "1. Checking Node.js"
command -v node >/dev/null || die "Node.js is not installed. Get it from https://nodejs.org (LTS) and re-run this script."
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
[ "$NODE_MAJOR" -ge 22 ] || die "Node $NODE_MAJOR found, but this project needs Node 22+. Update Node and re-run."
ok "Node $(node -v)"

say "2. Setting up pnpm 11.17.0"
PNPM="pnpm"
if command -v corepack >/dev/null 2>&1 && corepack use pnpm@11.17.0 >/tmp/corepack.log 2>&1; then
  ok "pnpm ready via corepack"
elif npx --yes pnpm@11.17.0 -v >/tmp/npx.log 2>&1; then
  PNPM="npx pnpm@11.17.0"
  ok "corepack unavailable — using npx pnpm@11.17.0 for every command instead"
else
  die "Neither corepack nor npx could get pnpm running. Paste the contents of /tmp/corepack.log and /tmp/npx.log back so this can be diagnosed."
fi

say "3. Installing dependencies"
$PNPM install || die "pnpm install failed — see the error above."
ok "dependencies installed"

say "4. Checking for .env.local"
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo
  echo "  Created .env.local from the template. It needs your Neon URLs before"
  echo "  the database-backed tests and the app itself will work."
  echo
  echo "  ── Only you can do this part ──────────────────────────────────────"
  echo "  1. Go to https://neon.com and sign up (no card needed)."
  echo "  2. Create a project."
  echo "  3. On the dashboard, copy the POOLED and DIRECT connection strings."
  echo "  4. Open .env.local in this folder and paste them in for"
  echo "     POSTGRES_URL (pooled) and POSTGRES_URL_UNPOOLED (direct)."
  echo "  5. Re-run this script — it will pick up from here."
  echo "  ────────────────────────────────────────────────────────────────────"
  exit 0
fi

if grep -q "user:pass@host-pooler" .env.local; then
  echo
  echo "  .env.local exists but still has placeholder values."
  echo "  Fill in POSTGRES_URL and POSTGRES_URL_UNPOOLED from your Neon"
  echo "  dashboard, then re-run this script."
  exit 0
fi
ok ".env.local has real values"

say "5. Generating and applying the database schema"
$PNPM db:generate || die "Schema generation failed — see the error above."
ok "migration SQL generated"
$PNPM db:migrate || die "Migration failed — check your POSTGRES_URL_UNPOOLED value in .env.local."
ok "schema applied"

say "6. Verifying everything (lint, typecheck, 123 tests)"
$PNPM verify || die "Verify failed — see the error above."
ok "all checks passed"

say "Done"
echo "  Run '$PNPM dev' to start the site locally, or open this folder in"
echo "  Claude Code and run /spec to start building the next feature."

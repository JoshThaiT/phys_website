#!/usr/bin/env bash
# Blocks anything that could touch production or destroy history.
source "$(dirname "$0")/_lib.sh"

[ -z "$COMMAND" ] && exit 0

# Destructive git
echo "$COMMAND" | grep -qE '\bgit[[:space:]]+push\b.*(--force|-f\b)' \
  && block "force-push. History is never rewritten by an agent."
echo "$COMMAND" | grep -qE '\bgit[[:space:]]+push\b[^|;&]*\b(origin[[:space:]]+)?(main|master|production)\b' \
  && block "direct push to a protected branch. Push a feature branch and open a PR."
echo "$COMMAND" | grep -qE '\bgit[[:space:]]+(reset[[:space:]]+--hard[[:space:]]+origin|clean[[:space:]]+-[a-z]*f[a-z]*d|filter-branch)' \
  && block "destructive git operation."

# Production deploys
echo "$COMMAND" | grep -qE '\bvercel\b[^|;&]*(--prod|--production)' \
  && block "production deploy. Vercel promotes from main after a human merges."
echo "$COMMAND" | grep -qE '\bvercel[[:space:]]+(promote|rollback|alias|remove|rm)\b' \
  && block "production Vercel operation."

# Production database
echo "$COMMAND" | grep -qE '(POSTGRES_URL_PROD|DATABASE_URL_PROD|PROD_DATABASE)' \
  && block "reference to a production database connection string."
echo "$COMMAND" | grep -qiE '\b(psql|drizzle-kit|pnpm[[:space:]]+db:[a-z]+)\b[^|;&]*\b(prod|production)\b' \
  && block "database command targeting production."
echo "$COMMAND" | grep -qiE '\b(DROP[[:space:]]+(DATABASE|TABLE)|TRUNCATE)\b' \
  && block "destructive SQL. Schema removal goes through a reviewed migration."

# Filesystem
echo "$COMMAND" | grep -qE '\brm[[:space:]]+(-[a-zA-Z]*[rf][a-zA-Z]*[[:space:]]+)+(/|~|\$HOME)($|[[:space:]])' \
  && block "recursive delete of a root or home path."

exit 0

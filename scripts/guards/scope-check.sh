#!/usr/bin/env bash
# Restricts writes to the paths declared in the active approved plan.
#
# Activate by writing the plan path into .claude/active-plan before starting
# the implementer:   echo docs/plans/007-booking.md > .claude/active-plan
# With no active plan file, this guard allows writes (spec and plan stages
# need to write freely).
source "$(dirname "$0")/_lib.sh"

[ -z "$FILE_PATH" ] && exit 0

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ACTIVE="$REPO_ROOT/.claude/active-plan"
[ -f "$ACTIVE" ] || exit 0

PLAN="$REPO_ROOT/$(tr -d '[:space:]' < "$ACTIVE")"
[ -f "$PLAN" ] || block "active-plan points at '$PLAN' which does not exist."

REL="${FILE_PATH#"$REPO_ROOT"/}"

# Always-allowed working paths.
case "$REL" in
  docs/*|evals/*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) exit 0 ;;
esac

# Extract paths from the plan's Files table: | path | action | note |
if awk -F'|' '/^\|/ {gsub(/ /,"",$2); if ($2 != "" && $2 != "Path" && $2 !~ /^-+$/) print $2}' "$PLAN" \
   | grep -Fxq "$REL"; then
  exit 0
fi

block "'$REL' is not in the Files table of $(basename "$PLAN").
If this file genuinely needs to change, the plan is incomplete. Report that to
the human and let them amend the plan — do not work around this."

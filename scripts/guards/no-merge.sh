#!/usr/bin/env bash
# The human merge gate. Nothing an agent does may land code on main.
source "$(dirname "$0")/_lib.sh"

[ -z "$COMMAND" ] && exit 0

echo "$COMMAND" | grep -qE '\bgh[[:space:]]+pr[[:space:]]+(merge|ready)\b' \
  && block "merging a pull request. Humans merge. This gate is the point of the workflow."
echo "$COMMAND" | grep -qE '\bgh[[:space:]]+pr[[:space:]]+(review|approve)\b[^|;&]*(--approve|-a\b)' \
  && block "approving a pull request. An agent cannot approve agent-written code."
echo "$COMMAND" | grep -qE '\bgh[[:space:]]+(repo|api)\b[^|;&]*(auto.?merge|--method[[:space:]]+(merge|squash|rebase))' \
  && block "enabling auto-merge or merging via the API."
echo "$COMMAND" | grep -qE '\bgit[[:space:]]+merge\b[^|;&]*\b(main|master)\b.*&&.*push' \
  && block "merging into a protected branch."

exit 0

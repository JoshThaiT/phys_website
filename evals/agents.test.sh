#!/usr/bin/env bash
# Static checks on agent definitions. Cheap, catches the failure mode where a
# frontmatter typo silently changes an agent's permissions.
cd "$(dirname "$0")/.." || exit 1
fail=0
note() { echo "FAIL: $1"; fail=$((fail+1)); }

for f in .claude/agents/*.md; do
  name=$(basename "$f" .md)
  head -1 "$f" | grep -q '^---$'                || note "$name: no frontmatter"
  grep -q '^name: '        "$f"                 || note "$name: missing name"
  grep -q '^description: ' "$f"                 || note "$name: missing description"
  grep -q "^name: $name$"  "$f"                 || note "$name: name does not match filename"
done

# The reviewer must never be able to write. This is the load-bearing invariant.
grep -q '^disallowedTools:.*Write' .claude/agents/reviewer.md || note "reviewer: Write not denied"
grep -q '^disallowedTools:.*Edit'  .claude/agents/reviewer.md || note "reviewer: Edit not denied"

# The implementer must be isolated so parallel runs cannot collide.
grep -q '^isolation: worktree' .claude/agents/implementer.md || note "implementer: not worktree-isolated"

# Nothing may claim bypassPermissions.
grep -l 'bypassPermissions' .claude/agents/*.md 2>/dev/null | while read -r f; do
  note "$(basename "$f"): uses bypassPermissions"
done

# Every guard referenced in settings.json exists and is executable.
grep -oE './scripts/guards/[a-z-]+\.sh' .claude/settings.json | sort -u | while read -r g; do
  [ -x "$g" ] || note "guard $g missing or not executable"
done

[ "$fail" -eq 0 ] && echo "agent config OK"
exit "$fail"

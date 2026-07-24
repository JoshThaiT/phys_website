#!/usr/bin/env bash
# Shared helpers for PreToolUse guards.
# Claude Code passes hook input as JSON on stdin. Exit 2 blocks the tool call
# and sends stderr back to the agent. Exit 0 allows it.
# Any other exit code is a non-blocking error, so guards must never exit 1
# on a policy violation.

set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "guard: jq is not installed — cannot enforce safety guards" >&2
  exit 2   # fail closed
fi

INPUT="$(cat)"

field() { echo "$INPUT" | jq -r "$1 // empty" 2>/dev/null; }

TOOL_NAME="$(field '.tool_name')"
COMMAND="$(field '.tool_input.command')"
# Different write-shaped tools name the path differently; take whichever exists.
FILE_PATH="$(field '.tool_input.file_path // .tool_input.path // .tool_input.notebook_path')"

block() {
  echo "BLOCKED by $(basename "$0"): $1" >&2
  echo "This is a hard guard, not a permission prompt. Do not attempt a" >&2
  echo "workaround. Stop and report this to the human." >&2
  exit 2
}

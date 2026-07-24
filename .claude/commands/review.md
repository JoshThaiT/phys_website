---
description: Review the current branch against its spec and plan
argument-hint: [branch, defaults to current]
---

Delegate to the **reviewer** subagent for branch: $ARGUMENTS (default: current).

Pass it the branch name, the spec path and the plan path. Do not summarise the
diff for it — it reads the branch itself.

Return its verdict and full findings unedited. Do not soften a critical finding
and do not fix anything yourself; the reviewer is read-only by design and so is
this command.

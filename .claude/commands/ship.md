---
description: Build, test, review and open a PR for the currently approved plan
argument-hint: [optional plan path, defaults to .claude/active-plan]
---

Execute the approved plan end to end. Plan: $ARGUMENTS (default: the path in
`.claude/active-plan`).

Preflight — abort and tell me if any fails:
- `.claude/active-plan` exists and points at a real plan
- working tree is clean and rebased on `main`
- `pnpm verify` passes on `main` before we start

Then:

1. Spawn **test-engineer** and **implementer** in parallel as background
   subagents. The test-engineer works from the spec only; do not pass it any
   implementation detail in its prompt.
2. When both report, run `pnpm verify`. Iterate with the implementer until
   green. If a test fails and the implementer claims the test is wrong, stop
   and bring it to me — do not let it edit the test.
3. Delegate to **reviewer**. Give it the branch name and the plan path.
4. If the verdict is REQUEST CHANGES, hand the findings back to the implementer
   and repeat from step 2. Maximum two rounds, then escalate to me.
5. On APPROVE, delegate to **integrator** to open the PR.
6. Report: PR URL, verdict summary, acceptance criteria coverage, and the
   preview-deploy verification steps.

Rules for you as the lead:
- Never merge. Never push to main. Report and stop.
- If any agent reports the plan is wrong, stop the pipeline and tell me. Do not
  let an agent amend the plan itself.
- Clear `.claude/active-plan` once the PR is open.

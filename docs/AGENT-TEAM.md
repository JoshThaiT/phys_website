# Agent team — React / Tailwind / Node / Postgres / Vercel

Six subagents that take an idea to a reviewed pull request. Two human gates:
you approve the plan, and you merge the PR. Nothing else waits on you.

## Install

Copy into the root of your existing repo:

```bash
cp -r CLAUDE.md .claude scripts evals docs .github /path/to/your/repo/
cd /path/to/your/repo
chmod +x scripts/guards/*.sh evals/*.sh
echo ".claude/active-plan" >> .gitignore
git add . && git commit -m "chore: add agent team"
```

Requirements: `jq` (`brew install jq`), `gh` authenticated, and a `pnpm verify`
script that runs lint + typecheck + test. **If `pnpm verify` does not exist
yet, create it before anything else.** Every agent depends on it.

Restart Claude Code after copying — a session does not detect a `.claude/agents`
directory created after it started.

## Verify the guards before trusting anything

```bash
./evals/guards.test.sh   # 32 assertions, all must pass
./evals/agents.test.sh
```

These run in CI on every change under `.claude/`. That is deliberate: the agent
configuration is the security boundary, and it regresses like any other code.

## Daily use

```
/spec add a booking cancellation flow with a 24h cutoff
      → spec-writer asks questions, writes docs/specs/NNN-*.md
      → YOU APPROVE
      → architect writes docs/plans/NNN-*.md
      → YOU APPROVE  → .claude/active-plan is armed

/ship
      → test-engineer + implementer run in parallel on a worktree branch
      → pnpm verify until green
      → reviewer (read-only) returns a verdict
      → integrator opens the PR
      → YOU MERGE
```

`/review` runs the reviewer alone against the current branch.

## The roster

| Agent | Model | Writes | Purpose |
|---|---|---|---|
| spec-writer | opus | `docs/specs/` only | Idea → testable acceptance criteria |
| architect | opus | `docs/plans/` only | Spec → file-level plan + migration strategy |
| implementer | sonnet | plan-scoped paths | Code, in an isolated git worktree |
| test-engineer | sonnet | test files | Tests from the spec, without reading the code |
| reviewer | opus | **nothing** | Findings by severity, spec conformance first |
| integrator | sonnet | **nothing** | PR description; cannot merge |

Three of these deliberately cannot write code. That is the design, not an
oversight.

## Guards

Prompts are suggestions; hooks are enforcement. All four run as `PreToolUse`
hooks and exit 2 to block.

| Guard | Blocks |
|---|---|
| `no-secrets.sh` | Reading/writing `.env`, keys, certs; commands that would print a secret; inline credentials |
| `no-prod.sh` | Force-push, push to main, `vercel --prod`, prod DB, `DROP TABLE`, `rm -rf /` |
| `no-merge.sh` | `gh pr merge`, self-approval, auto-merge. Your merge gate |
| `scope-check.sh` | Any write outside the approved plan's Files table |

`scope-check.sh` arms itself from `.claude/active-plan`. With no active plan it
allows everything, so the spec and plan stages can write freely.

## Rollout order

Do not turn all six on at once. In order, one step per sitting:

1. **reviewer only.** Run it against five already-merged PRs. Does it find what
   your human reviewer found? Tune the prompt until yes. This calibrates your
   prompt-writing before you have written five more agents.
2. **+ spec-writer, architect.** Read-only. Run on three real backlog items.
   Are the plans good enough that approving them is a 3-minute job?
3. **+ implementer, test-engineer.** First target: your best-covered,
   lowest-risk module. Verify every guard fires before you point it at
   anything that matters.
4. **+ integrator.** Now the loop is closed.
5. Only then: parallel implementers, and headless review in CI.

## QA scorecard

Track these from PR one. The last two are the ones that tell you whether this
is actually working.

| Metric | How | Target |
|---|---|---|
| Guard suite | CI, every `.claude/` change | 100% pass |
| Routing accuracy | 15 fixture prompts → expected agent | ≥13/15 |
| Reviewer recall | 10 PRs with seeded bugs, monthly | ≥8 caught, <2 false criticals |
| Escape rate | Defects reaching staging per 10 PRs | Trending down |
| **Human edit distance** | % of agent PR lines you rewrite before merge | <15% |
| **Cost per merged PR** | Token spend | Set a ceiling, alert on breach |

Human edit distance is the honest measure. If you are rewriting a third of
every PR, the plans are too vague — fix the architect prompt, not the
implementer.

## Known failure modes

- **Spec drift** — code solves a different problem than specced. The reviewer's
  first check is conformance, before any quality question, for this reason.
- **Rubber-stamp reviews** — reviewer approves everything. Catch it with the
  seeded-bug eval. Run it monthly, not once.
- **Plan-gate erosion** — around week three you start approving plans without
  reading them. Mitigation: reject any plan over 400 lines.
- **Guard drift** — a guard silently stops matching after a tool changes its
  argument shape. Mitigation: the CI suite, which is why it is not optional.

## Tuning notes

- Agent descriptions drive delegation. If the wrong agent keeps getting picked,
  the fix is in the `description` field, not the body.
- Keep `CLAUDE.md` under 200 lines. It loads into every subagent context.
- `memory: project` on reviewer and architect means they accumulate real
  knowledge of this codebase across sessions. Ask them to consult it before
  starting and update it when done — it compounds over ~20 PRs.
- The three-branch rule (loading / error / empty) and the expand-contract
  migration rule are the two conventions that will save you the most. They are
  in `CLAUDE.md` and both convention skills on purpose.

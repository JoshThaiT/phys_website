---
description: Turn an idea into a spec and an approved implementation plan
argument-hint: <the idea, in a sentence or a paragraph>
---

Run the planning half of the pipeline for: $ARGUMENTS

1. Delegate to the **spec-writer** subagent. Let it ask its clarifying
   questions and wait for my answers before it writes anything.
2. Show me the finished spec path and the acceptance criteria. **Stop here and
   wait for my approval.** Do not proceed on a "looks good" you inferred.
3. Once I approve, delegate to the **architect** subagent.
4. Show me the plan: the Files table, the migration answer, the top risk.
   **Stop and wait for my approval.**
5. When I approve, write the plan path into `.claude/active-plan` so the scope
   guard is armed, and tell me `/ship` is ready to run.

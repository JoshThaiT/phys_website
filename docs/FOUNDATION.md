# Phase 0 — Foundation

Verified working before any agent touches it:

```
pnpm install
pnpm verify     # lint + typecheck + 34 tests — all green
pnpm build      # vite build succeeds, 77 kB gzipped
```

## What is here and why

| Path | Purpose |
| --- | --- |
| `packages/shared/` | Zod schemas imported by both web and api. One definition, two consumers. |
| `packages/db/` | Drizzle schema + the single pooled client. Guards against the unpooled URL in production. |
| `apps/api/handler.ts` | The route kernel: method check, typed errors, one place where errors become responses. |
| `apps/api/routes/` | One file per route. `health.ts` deliberately does not touch the database. |
| `apps/web/src/lib/api.ts` | Typed fetch client. Parses every response with the server's own schema. |
| `apps/web/src/components/QueryState.tsx` | Enforces the loading / error / empty rule structurally. |
| `apps/web/tailwind.config.ts` | Design tokens. A raw hex in a component is a review finding. |

## Conventions made mechanical

The reviewer agent checks these by reading. These check themselves:

- `@typescript-eslint/no-explicit-any` — `any` fails the build
- `@typescript-eslint/no-non-null-assertion` — `!` fails the build
- `consistent-type-imports` — type-only imports enforced
- `noUncheckedIndexedAccess` — array access is `T | undefined`
- `TZ=UTC` in vitest — no timezone-flaky tests
- Pooled-connection assertion throws at startup in production

Four lint errors were caught and fixed while building this. That is the point:
the rules work before an agent ever runs.

## Not done yet, deliberately

- **No auth.** Add it in the first spec that needs it, not speculatively.
- **No migrations generated.** Run `pnpm db:generate` once you have a real table.
- **`App.tsx` is a placeholder** proving the React → Query → Zod → handler path.
  The first `/spec` replaces it.
- **E2E is one smoke test.** Keep it that way until something is worth guarding.

## Next

```bash
cp .env.example .env.local     # fill in Neon/Vercel Postgres URLs
pnpm install && pnpm verify    # must be green before agents run
claude                         # then: /spec <your first feature>
```

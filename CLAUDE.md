# Project conventions

Every agent in this repo loads this file. Keep it under 200 lines — it is
prepended to a lot of context windows.

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | React 18 + TypeScript, Vite                                    |
| Styling   | Tailwind CSS (utility-first, no CSS-in-JS, no CSS modules)     |
| Backend   | Node.js + TypeScript, Vercel Serverless Functions under `/api` |
| Database  | PostgreSQL (Neon / Vercel Postgres) via Drizzle ORM            |
| Validation| Zod schemas in `packages/shared`, imported by both sides       |
| Testing   | Vitest + React Testing Library (unit), Playwright (E2E)        |
| Hosting   | Vercel — preview per PR, `main` -> production                  |

## Layout

```
apps/web/          React app (Vite)
apps/api/          Vercel serverless handlers, one file = one route
packages/shared/   Zod schemas + types shared by web and api
packages/db/       Drizzle schema, migrations, client
docs/specs/        Specs (source of truth for what to build)
docs/plans/        Implementation plans (approved before code is written)
docs/decisions/    ADRs — one file per irreversible choice
```

## Commands

These must all work from the repo root. Agents rely on them.

```bash
pnpm dev              # web + api locally
pnpm test             # vitest, unit + integration
pnpm test:e2e         # playwright
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit across workspaces
pnpm db:generate      # drizzle-kit generate — creates migration SQL
pnpm db:migrate       # apply migrations
pnpm verify           # lint + typecheck + test. Run before declaring done.
```

## Stack-specific rules that are not obvious

These exist because they have already caused outages or wasted days. Do not
relitigate them in a PR.

### Postgres on serverless

- **Always use the pooled connection string** (`POSTGRES_URL`, the `-pooler`
  host). The direct/unpooled URL is for migrations only. Every serverless
  invocation is a new process; unpooled connections exhaust the DB in minutes
  under any real traffic.
- **Never open a connection at module scope inside a handler file** without
  reusing the cached client from `packages/db/client.ts`.
- **Migrations are never run from a request handler.** They run in CI only.
- **Every migration must be backwards-compatible with the currently deployed
  code.** Vercel does not deploy atomically with the database. Expand first,
  contract in a later PR: add nullable column -> backfill -> start writing ->
  stop reading old column -> drop it. Four PRs, not one.
- **`apps/api` has no direct dependency on `drizzle-orm`** — only `packages/db`
  does (pnpm's strict workspace isolation, not hoisted transitively). Query
  builders (`eq`, `and`, transactions, …) must live in `packages/db/src/*`
  behind a plain-object store factory (e.g. `createXStore(db)`); route files
  consume the store structurally and stay drizzle-free.

### API handlers

- Each route exports a `createHandler({ store, now })` factory plus a default
  export wired to the real `getDb()`-backed store — never construct the DB
  client at module scope (cold-start + testability). `now` is an injectable
  clock, not `Date.now()` inline, so time-dependent logic is deterministic in
  tests.
- Tests inject a fake store and fake clock; there is no live-DB test harness.
  Match the pattern in `apps/api/routes/booking-requests.test.ts`.

### Vercel

- Serverless functions have a cold start. No top-level heavy imports.
- Anything over ~10s must be a background job, not a request handler.
- `VITE_`-prefixed env vars are **public** and shipped to the browser. Secrets
  never carry that prefix.
- Preview deploys share the staging database. Never point a preview at prod.

### React

- Server state goes through TanStack Query. Never `useEffect` + `fetch`.
- `useEffect` is for synchronising with an external system only. If it is
  computing a value, it is a bug — derive during render.
- Every list key is a stable ID, never an array index.
- Every network state has three branches rendered: loading, error, empty.

### Tailwind

- Utility classes in JSX. No `@apply` outside `globals.css`.
- Design tokens live in `tailwind.config.ts`. Never hard-code a hex or a
  one-off `px` value in a component — extend the theme instead.
- Conditional classes use `cn()` from `apps/web/src/lib/cn.ts`, never string
  concatenation.

### Types and validation

- `any` is banned. Use `unknown` and narrow.
- Every API request body and response is parsed with a Zod schema from
  `packages/shared`. Types are inferred from schemas, never hand-written
  alongside them.
- No `as` casts to silence the compiler. Fix the type.

## Never do

1. Never commit or read a `.env*` file, key, token, or credential.
2. Never push to `main` and never force-push any branch.
3. Never merge a pull request. Humans merge.
4. Never run a command against the production database or a production deploy.
5. Never edit files outside the scope declared in the approved plan.
6. Never disable, skip, or weaken a test to make the suite pass. If a test is
   wrong, say so and stop.
7. Never add a dependency that is not in the approved plan.
8. Never invent an API contract. If the spec is ambiguous, stop and ask.

## Definition of done

`pnpm verify` passes, the spec's acceptance criteria each have a named test,
the diff touches only planned paths, and no file in the diff is a lockfile
change you cannot explain.

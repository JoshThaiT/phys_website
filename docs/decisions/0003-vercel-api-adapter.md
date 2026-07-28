# 0003 — Vercel function discovery: a thin `api/` adapter, not relocated handlers

**Status:** accepted
**Date:** 2026-07-28
**Context:** first attempt to deploy the project to Vercel (launch issue #4).

## Problem

Vercel discovers Serverless Functions **only** in an `api/` directory at the
project root. This repo's handlers live in `apps/api/routes/*.ts`. The original
`vercel.json` tried to bridge that with a `functions` glob pointing at
`apps/api/routes/*.ts` plus a rewrite (`/api/:path* → /apps/api/routes/:path*`).
That model is wrong: the `functions` glob only *configures* functions Vercel has
already discovered in `api/` — it does not *create* functions from an arbitrary
directory. The build failed with:

```
The pattern "apps/api/routes/*.ts" defined in `functions`
doesn't match any Serverless Functions inside the `api` directory.
```

The project had therefore never successfully deployed. Something has to
reconcile the repo layout with Vercel's `api/`-directory convention.

## Options considered

**A. A thin `api/` adapter directory (chosen).** Add one file per route at the
repo root, e.g. `api/booking-requests.ts`, each a single
`export { default } from '../apps/api/routes/<route>.js'`. Vercel discovers
`api/*.ts`; each re-exports the real handler. `apps/api/routes/` and everything
under it is untouched.

**B. Relocate the handlers into `api/`.** Move `apps/api/routes/*.ts` (and their
tests) to `api/`, rewrite their `../lib/*` imports, dissolve the `apps/api`
workspace boundary, and update CLAUDE.md. Fully Vercel-native, no indirection.

## Decision

**A.** The deciding factor is a design intent the codebase *already* committed
to: every route is a `createHandler({ store, now })` factory plus a default
export that wires the real dependencies — deliberately platform-agnostic and
unit-testable without a live runtime (CLAUDE.md, "API handlers"). In that
Ports-and-Adapters shape, the `api/` file is not a workaround bolted on to fight
the platform; it is the **composition-root binding** the design expects — the
one place that knows the handler runs on Vercel. Option B would discard that
platform-independence (the reason the factory pattern exists) to save a small
directory, and churn ~15–20 files plus a documented convention.

Each `api/*.ts` file carries a header comment stating it is an intentional
adapter and that no logic belongs there, so the pattern is self-documenting at
the point a future reader meets it.

## Consequences

- **`api/*.ts` are re-exports only.** Any logic added there re-couples the
  handler to Vercel and defeats the separation; reviewers should reject it. The
  header comment in each file says so.
- **Adding a route is now two files:** the handler in `apps/api/routes/` and a
  one-line adapter in `api/`. A missing adapter means the route simply is not
  deployed. Acceptable: the adapter is trivial and the failure mode is obvious
  (404 on that path in a preview deploy).
- **`vercel.json` simplifies:** the `functions` glob is `api/*.ts`, and the
  `/api/:path* → /apps/api/routes/:path*` rewrite is deleted — requests to
  `/api/*` are served directly by the discovered functions. The SPA-fallback
  rewrite and the `/api/purge` cron are unchanged (the cron now targets the
  `api/purge.ts` adapter).
- **Handlers stay portable.** Nothing in `apps/api/` imports anything
  Vercel-specific; a future move to another host replaces the `api/` adapter
  layer and nothing else.

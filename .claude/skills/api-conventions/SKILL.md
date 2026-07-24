---
name: api-conventions
description: House rules for Node serverless handlers on Vercel, Zod validation, error shape, auth and Postgres access via Drizzle. Read before writing any backend code.
---

# API conventions

## Handler shape

One route per file under `apps/api/`. Every handler follows the same order,
and the order matters:

1. Method check → 405 with an `Allow` header.
2. Authenticate → 401.
3. Parse and validate input with the shared Zod schema → 400 with field errors.
4. Authorise this user against *this record* → 403.
5. Do the work.
6. Return a validated response.

Steps 2 and 4 are different checks. Confirming someone is logged in is not
confirming they may touch this row. Conflating them is the most common
serious bug in this kind of codebase.

## Validation

- Request body, query params and path params all parsed with Zod. Nothing
  reaches business logic untyped.
- Schemas live in `packages/shared` and are imported by the frontend too.
- The response is parsed on the way out in development, so a contract drift
  fails a test rather than a user.

## Errors

One shape, always:

```json
{ "error": { "code": "BOOKING_CONFLICT", "message": "...", "fields": {} } }
```

- `code` is a stable machine-readable constant the frontend can branch on.
- `message` is safe to show a user.
- Never leak a stack trace, a SQL string or an internal ID to the client.
- Log the full error server-side with a request ID; return the request ID to
  the client so a support conversation can find it.

## Postgres and Drizzle

- Import the shared pooled client from `packages/db/client.ts`. Never construct
  a client inside a handler.
- **Pooled connection string only.** The unpooled URL exists for migrations.
- Every query goes through Drizzle's builder. Raw SQL only via `sql` tagged
  template with parameter binding — never string interpolation of user input.
- Select the columns you need. `select *` on a wide table is a latency bug.
- Multi-statement writes run in a transaction.
- Any query that can return more than 50 rows is paginated, keyset not offset.
- Add the index in the same migration as the query that needs it.

## Migrations

- Generated with `pnpm db:generate`, reviewed by a human, committed.
- **Backwards compatible with the currently deployed code, always.** Vercel and
  Postgres do not deploy atomically. Expand, then contract:
  add nullable column → backfill → dual-write → switch reads → stop writing old
  → drop. Separate PRs.
- Never `DROP` or rename a column in the same PR that stops using it.
- Every migration states in a comment how to reverse it.

## Serverless specifics

- No heavy work at module scope — it runs on every cold start.
- Keep handlers under ~10s. Anything longer is a queued job.
- Idempotency key on any endpoint that creates something chargeable; clients
  retry and networks lie.
- No in-memory cache expecting to persist between invocations. It will not.

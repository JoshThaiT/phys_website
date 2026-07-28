/**
 * Vercel function adapter — intentional composition-root binding. NO LOGIC HERE.
 *
 * Vercel only discovers Serverless Functions in this root `api/` directory, but
 * the real handler lives in `apps/api/routes/booking-requests.ts`, kept
 * deliberately platform-agnostic: a `createHandler(...)` factory plus a default
 * export that wires the real dependencies (see CLAUDE.md, "API handlers"). This
 * one-line re-export is the only place that knows the handler runs on Vercel, so
 * the handler itself stays runtime-independent and unit-testable.
 *
 * Adding anything other than a re-export here defeats that separation. See
 * docs/decisions/0003-vercel-api-adapter.md.
 */
export { default } from '../apps/api/routes/booking-requests.js';

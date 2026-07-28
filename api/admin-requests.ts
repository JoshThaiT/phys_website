/**
 * Vercel function adapter — intentional composition-root binding. NO LOGIC HERE.
 *
 * Vercel discovers functions only in this root `api/` directory; the real,
 * platform-agnostic handler lives in `apps/api/routes/admin-requests.ts` (factory
 * + wired default export, see CLAUDE.md "API handlers"). This thin re-export is
 * the only Vercel-aware seam, keeping the handler runtime-independent and
 * testable. Rationale: docs/decisions/0003-vercel-api-adapter.md.
 */
export { default } from '../apps/api/routes/admin-requests.js';

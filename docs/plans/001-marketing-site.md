# 001 — Implementation plan: Public marketing site

Spec: docs/specs/001-marketing-site.md

## Approach

Static content, typed and validated. The clinic's services, practitioners and
fees live in `apps/web/src/content/` as plain TypeScript objects parsed through
Zod schemas at module load. A malformed entry throws at import, which fails the
build — the same guarantee a CMS would give, at none of the cost, and it means
the compliance checker can read the content statically.

The compliance rule set is the load-bearing part of this build. It is
implemented as a test over the content modules, not as a code review
convention, because a prohibited phrase added six months from now must fail CI
rather than depend on someone remembering s133.

Routing is client-side with three routes. No SSR: the content is small enough
that a prerendered shell plus structured data satisfies search engines, and SSR
would add a server surface this spec does not otherwise need.

## Files

| Path | Action | What changes |
|------|--------|--------------|
| packages/shared/src/content.ts | create | Zod schemas: service, practitioner, fee |
| packages/shared/src/index.ts | modify | export content schemas |
| apps/web/src/content/clinic.ts | create | name, address, hours, contact |
| apps/web/src/content/services.ts | create | service list, parsed at load |
| apps/web/src/content/practitioners.ts | create | practitioner list |
| apps/web/src/content/compliance.test.ts | create | s133 prohibited-term check |
| apps/web/src/components/Arc.tsx | create | range-of-motion arc motif |
| apps/web/src/components/Nav.tsx | create | header + persistent Book affordance |
| apps/web/src/components/Footer.tsx | create | address, hours, transport |
| apps/web/src/components/ServiceCard.tsx | create | service summary card |
| apps/web/src/components/Seo.tsx | create | title, meta, structured data |
| apps/web/src/routes/Home.tsx | create | landing |
| apps/web/src/routes/ServiceDetail.tsx | create | one service |
| apps/web/src/routes/Fees.tsx | create | fee table + rebate position |
| apps/web/src/routes/NotFound.tsx | create | 404 |
| apps/web/src/App.tsx | modify | router |
| apps/web/src/main.tsx | modify | BrowserRouter |
| apps/web/tailwind.config.ts | modify | palette, type scale, motif tokens |
| apps/web/src/globals.css | modify | font faces |
| apps/web/index.html | modify | fonts, base meta |

## Dependencies

- `react-router-dom` — three routes with a dynamic segment. Hand-rolling a
  router to avoid one dependency is a false economy.

No others. No UI kit, no animation library, no SEO package.

## Database changes

None. This spec touches no database and stores no patient data.

## Test plan

| AC | Test |
|----|------|
| AC1 | `Home.test.tsx::links to every service` |
| AC2 | `ServiceDetail.test.tsx::shows duration, fee and first-visit detail` |
| AC3 | `Fees.test.tsx::lists every service with a fee and rebate position` |
| AC4 | `content.test.ts::every physiotherapist has an AHPRA number` |
| AC5 | `Fees.test.tsx::labels regulated and self-regulated services` |
| AC6 | `Nav.test.tsx::book affordance present and reachable` |
| AC7 | `Footer.test.tsx::renders address, hours and phone` |
| AC8 | `compliance.test.ts::content contains no prohibited terms` |
| AC9 | `Seo.test.tsx::emits unique title and valid structured data` |
| AC10 | Playwright: keyboard traversal + 320px viewport |

## Rollback

Static site, no migration, no persisted state. Revert the deploy. Nothing to
undo server-side.

## Risks

1. **Compliance drift.** Someone adds a Google-reviews widget in six months.
   Mitigated by `compliance.test.ts`, which fails CI — but it can only check
   content in this repo, not a third-party embed. Flag for the reviewer agent.
2. **Placeholder content shipping to production.** Mitigated by a test asserting
   no placeholder marker survives in a production build.
3. **This plan is not legal advice.** The compliance checks encode a good-faith
   reading of s133 and AHPRA's guidelines. A practitioner should review the
   final copy before launch.

## Not doing

Booking engine, payments, telehealth, patient accounts, blog, analytics.

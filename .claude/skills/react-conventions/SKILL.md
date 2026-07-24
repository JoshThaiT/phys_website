---
name: react-conventions
description: House rules for React, TypeScript and Tailwind in this codebase. Covers component structure, state management, data fetching and styling tokens.
---

# React conventions

## Component structure

- One component per file, named export matching the filename.
- Props typed with an explicit `interface`, never inline in the signature
  beyond two props.
- Order inside a component: hooks, derived values, handlers, early returns,
  JSX. No hook is called conditionally.
- A component over ~150 lines is doing more than one thing. Split it.

## State

- **Server state → TanStack Query.** Never `useEffect` + `fetch` + `useState`.
  The three-state problem (loading, error, stale) is why the library exists.
- **URL state → the URL.** Filters, tabs, pagination and search live in query
  params so a link reproduces the view.
- **Form state → React Hook Form + the shared Zod schema** as the resolver.
  The same schema validates on the server. One definition, two consumers.
- **Local UI state → `useState`.** Everything else is probably derived.
- `useEffect` synchronises with something outside React. If it sets state from
  props or other state, delete it and compute during render.

## Data fetching

- Query keys are arrays, hierarchical, and include every variable the query
  depends on: `['bookings', { userId, status }]`.
- Every query surface renders three branches explicitly: loading skeleton,
  error with a retry affordance, and empty state with a next action.
- Mutations invalidate the queries they affect. Optimistic updates only where
  the latency is genuinely felt, and always with a rollback.

## Tailwind

- Utilities in JSX. `@apply` only in `globals.css`, and rarely.
- Never a raw hex or a magic pixel value in a component. Extend
  `tailwind.config.ts` and use the token.
- Conditional classes through `cn()`. Never template-string concatenation —
  it defeats Tailwind's class detection.
- Order: layout → box → typography → colour → state. Consistency here makes
  diffs readable.
- Responsive is mobile-first: unprefixed is the small screen.

## Accessibility floor

Non-negotiable, and cheaper to do now than to retrofit:

- Every interactive element is a `button` or `a`, never a `div` with `onClick`.
- Every input has a associated `label`.
- Visible focus ring on every focusable element. Never `outline: none` without
  a replacement.
- Images have `alt`; decorative images have `alt=""`.
- `prefers-reduced-motion` respected on any animation over 200ms.
- Icon-only buttons carry an `aria-label`.

## TypeScript

- No `any`. Use `unknown` and narrow.
- Types are inferred from Zod schemas with `z.infer`, never written twice.
- Discriminated unions over optional-field soup.
- No non-null `!` assertion. Handle the null.

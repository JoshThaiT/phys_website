# Why the pnpm pin changed from 9.15.9 to 11.17.0

**9.15.9 was a mistake, not a deliberate choice.** It was whatever version was
cached in the build sandbox when this project was first scaffolded — nobody
checked whether it was current. It wasn't: pnpm 9 reached end of life on
30 April 2026 and stopped receiving security updates before this project was
even built. Caught only because a person asked "why not 11.17.0" and that
prompted an actual check, which is exactly the kind of thing this note exists
to prevent happening silently.

## What changed to make the pin work

pnpm 11 tightened its security defaults. <cite>Post-install build scripts for
every dependency are now blocked unless explicitly allowed</cite> — this repo
has one dependency, esbuild (pulled in transitively by Vite and Vitest), that
needs its install script to run. Everything else stays blocked, which is the
safer default and worth keeping rather than working around wholesale.

The setting for this also moved between versions and had to be found twice:

- pnpm 10 and earlier: `onlyBuiltDependencies` in `package.json`
- pnpm 11: `allowBuilds` (a name → boolean map) in `pnpm-workspace.yaml`

It now lives in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

## Verified, not assumed

Before shipping this pin: clean `node_modules` wipe, `pnpm install`, full
`pnpm verify` (123 tests), `pnpm build`, and the agent-team guard suite —
all green on pnpm 11.17.0. No application code changed; only
`package.json`'s `packageManager` field and `pnpm-workspace.yaml`.

## If `pnpm -v` doesn't show 11.17.0 after `pnpm install`

Corepack should pick up `packageManager` automatically. If it doesn't:

```bash
corepack use pnpm@11.17.0
```

Or, if corepack isn't available on your machine (locked-down permissions):

```bash
npx pnpm@11.17.0 install
```

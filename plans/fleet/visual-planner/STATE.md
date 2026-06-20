# Fleet run: visual-planner
status: running
approved: true
baseBranch: main
integrationBranch: fleet/visual-planner
trunkBased: false
noRemote: true
repoPath: /home/homeserver/projects/visual-planner
visualPlanUrl:

## Slices
- 0.1 [done] scaffold + harness @ e2c3bac (main)
- 1.1 [done] discovery/ignore/config @ ec0ef5c (opus)
- 1.2 [done] client shell + tree + markdown @ de1b34a (+ cleanup fix c3639f7)
- 2.1 [done] MDX render + 4 blocks @ 04ba957
- 2.2 [done] FTS5 search + prose-strip + SearchBox @ merge 4feb745
- 2.4 [done] non-text viewers + confined raw endpoint @ merge 665e76d (opus)
- SEC [done] XSS hardening (raw active-types + snippet) @ 5d923b9, +follow-up 6e307b2 (opus-reviewed GO)
- 2.3 [done] highlight + mermaid @ 2ed6116
- 3.1 [done] CLI + lifecycle @ 74a9c28
- 3.2 [done] live reload watcher/SSE @ 80b6fbf
- 3.3 [pending] deps: all   orch: sonnet (error states + E2E)  <- DISPATCHING (wave 3b, FINAL)

## Waves
- wave2a [done]: 2.1, 2.2, 2.4 (+ security hardening)
- wave2b [done]: 2.3
- wave3a [done]: 3.1, 3.2
- wave3b: [3.3]   <- now (final)

## Integration health
- bun run check: CLEAN. bun test: 197 pass / 0 fail. (captain-verified post-3a; ALWAYS `bun install` after merges)
- Two HIGH XSS findings (raw active-types, FTS5 snippet) fixed + opus-confirmed not bypassable.

## Knowledge persisted
- playwright-podman-e2e.md, server-config-and-discovery.md, client-conventions.md
- raw-endpoint-and-sandbox.md (opus 2.4), shiki-mermaid.md (2.3), server-runtime.md (3.1/3.2)
- typescript-strict-gotchas.md, mdx-rendering.md, search-xss-invariant.md (captain, from 2.1/2.2 deltas + opus review)

## Learnings
- Branch slices off CURRENT integration HEAD (not fixed SHA).
- Shared-file drift (DocView.tsx, app.ts, package.json) → import-only union conflicts; resolve by union, dedupe package.json keys, `bunx biome check --write` for import order, `bun install` to regen lock.
- A slice branching before an integration rule-doc lands sees it as a deletion — restore before merge.
- Background security review (security-guidance plugin) fires on commits — caught both XSS findings. Treat its findings as gating on the security surface.

## Notes
- No git remote — local commits only.
- Frozen contract: src/shared/types.ts + HTTP API.

## Known landmine for 3.3
- mock.module('@mantine/core') in HtmlView.test.tsx pollutes the worker; 3.3 adds error-state UI -> convert that test to real MantineProvider (see client-conventions.md).

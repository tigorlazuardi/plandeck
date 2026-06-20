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
- 0.1 [done]    scaffold + harness @ e2c3bac (on main)
- 1.1 [done]    discovery/ignore/config @ ec0ef5c (opus; 64 server tests; security verified)
- 1.2 [done]    client shell + tree + markdown @ de1b34a (sonnet) + test-cleanup fix @ c3639f7
- 2.1 [pending] deps: 1.2   orch: sonnet (MDX blocks)
- 2.2 [pending] deps: 1.1,1.2 orch: sonnet (FTS5 search)
- 2.4 [pending] deps: 1.1,1.2 orch: opus  (non-text viewers + raw + sandbox — security)
- 2.3 [pending] deps: 2.1   orch: sonnet (highlight + mermaid)  <- AFTER 2.1
- 3.1 [pending] deps: 1.1   orch: sonnet (CLI + lifecycle)
- 3.2 [pending] deps: 2.2   orch: sonnet (live reload watcher/SSE)
- 3.3 [pending] deps: all   orch: sonnet (error states + E2E)

## Revised waves (2.3 depends on 2.1 -> own sub-wave)
- wave2a: [2.1, 2.2, 2.4]   <- DISPATCHING
- wave2b: [2.3]
- wave3a: [3.1, 3.2]
- wave3b: [3.3]

## Integration health
- bun test: 70 pass / 0 fail. bun run check: clean. (verified by captain @ c3639f7)

## Knowledge persisted
- .claude/rules/playwright-podman-e2e.md
- .claude/rules/server-config-and-discovery.md (opus 1.1, written:true)
- .claude/rules/client-conventions.md (captain, from sonnet 1.2 deltas)

## Learnings
- Branch slices off CURRENT integration HEAD (not a fixed SHA) — 1.1 hit a stale base.
- Shared file watch: src/client/render/DocView.tsx edited by 2.1 (mdx) + 2.4 (html/pdf/img)
  — keep edits additive (own kind cases only) to ease union merge.

## Notes
- No git remote — local commits only, no push.
- Frozen shared contract: src/shared/types.ts + HTTP API.

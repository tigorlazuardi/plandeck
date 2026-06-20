# Fleet run summary: visual-planner

**Status: DONE.** All 9 slices implemented, reviewed, merged into `fleet/visual-planner`,
then merged to `main`. Local-only run (no git remote) — commits, no push.

## What was built
A local, read-only web app (`visual-planner [<dir>]`) that auto-discovers documentation
under a directory and renders it in a browser: MDX with custom blocks, markdown, txt, html
(sandboxed), pdf, images. Directory-tree sidebar, filename filter, FTS5 content search, live
reload, dark/light. Bun + Hono + Vite/React/Mantine. No DB, no native modules, no egress.

## Per-slice result
| Slice | What | Orch | Merge |
| --- | --- | --- | --- |
| 0.1 | Scaffold + verification harness (proven green before fleet) | — | e2c3bac (main) |
| 1.1 | Discovery + ignore-layering + config (security-sensitive) | opus | ec0ef5c |
| 1.2 | Client shell + tree sidebar + markdown/txt render | sonnet | de1b34a |
| 2.1 | MDX runtime render + 4 custom blocks | sonnet | 04ba957 |
| 2.2 | FTS5 content search + prose-strip + SearchBox | sonnet | 4feb745 |
| 2.4 | Non-text viewers (html/pdf/image) + confined raw endpoint | opus | 665e76d |
| 2.3 | Syntax highlight (Shiki) + Mermaid | sonnet | 2ed6116 |
| 3.1 | CLI (citty) + lifecycle (banner/port-fallback/shutdown) | sonnet | 74a9c28 |
| 3.2 | Live reload (chokidar → SSE → client invalidation) | sonnet | 80b6fbf |
| 3.3 | Error/empty states + skeletons + README + real E2E | sonnet | 868a8ed |

## Cross-cutting fixes (captain-driven, beyond the slices)
- **2 HIGH XSS findings** (background security review) fixed + opus-confirmed not bypassable:
  `/api/raw` active-content-type neutralization (`5d923b9`, `6e307b2`) and FTS5 snippet
  sanitization (defense-in-depth: index-time HTML strip + render-time escape).
- **Core defect**: route handlers ignored the CLI `<dir>`/flags (argless `resolveConfig()`).
  Fixed with a `createApp(config)` DI factory (`738eaeb`) — opus-reviewed; positional-arg
  smoke proven (`visual-planner /tmp/x` serves /tmp/x, not cwd).
- `/api/doc/*` endpoint was entirely missing — added in 3.3.
- RTL test-cleanup + the `mock.module('@mantine/core')` worker-pollution landmine fixed.

## Verification (real reflection, no faked greens)
- `bun run check` (biome + tsc strict): clean.
- `bun test`: 208 pass / 0 fail (server fixtures + in-memory bun:sqlite + happy-dom DOM).
- `bun run e2e`: 4/4 in **Podman** (official Playwright image, host-independent) against the
  REAL backend on a fixture dir — list → open MDX → Callout + highlighted code → search → hit.

## Knowledge persisted (.claude/rules/)
playwright-podman-e2e, server-config-and-discovery, client-conventions, raw-endpoint-and-sandbox,
typescript-strict-gotchas, mdx-rendering, search-xss-invariant, shiki-mermaid, server-runtime,
server-config-di.

## Notable learnings
- Branch each slice off CURRENT integration HEAD; `bun install` after every merge.
- Shared-file drift (DocView/app.ts/package.json) → import-only union conflicts; dedupe pkg
  keys + `biome --write` import order + `bun install` regen lock.
- The background security-guidance review is a real gate on the security surface — heed it.
- Greenfield fleet: prove the tool/validation harness (incl. portable Podman E2E) BEFORE
  dispatching parallel slices.

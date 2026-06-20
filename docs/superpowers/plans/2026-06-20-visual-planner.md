# Visual Planner Implementation Plan

> **For agentic workers:** This plan is structured for **fleet** execution — a DAG of
> slices grouped into waves. Each slice is implemented test-first (`bun test`) by a
> `fleet-implementer` inside its own worktree, reviewed by a `fleet-reviewer`, then merged
> to the integration branch. Steps within a slice are the implementer's to derive from the
> slice's acceptance criteria + interface contract below.

**Goal:** A local, read-only web app that auto-discovers documentation files under a
directory and renders them (MDX with custom blocks, markdown, txt, html, pdf, images) in a
browser, with a directory-tree sidebar, content search, and live reload.

**Architecture:** Bun runtime. A thin Hono server reads the filesystem live and exposes
discovery / document / search / SSE APIs; a Vite + React SPA renders documents client-side.
Filesystem is the single source of truth; no DB on disk (search index is in-memory SQLite).

**Tech Stack:** Bun, Hono, `bun:sqlite` (FTS5), `Bun.Glob`, chokidar, citty, zod, ignore,
gray-matter, remark stack; Vite, React, @mdx-js, react-markdown, @shikijs/rehype, mermaid,
Mantine, React Router, TanStack Query, lucide-react. TypeScript strict. Biome. bun:test +
happy-dom + Testing Library; Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-06-20-visual-planner-design.md` — authoritative.
Read it before implementing any slice.

## Global Constraints

- **Local-only, no network egress, no telemetry.** Zero outbound requests at runtime; all
  assets (Mermaid, Shiki, fonts) bundled/served locally.
- **Bind `127.0.0.1` by default.** Non-loopback only via `--host`/`VP_HOST`.
- **Zero native modules.** Pure-JS deps only (`bun:sqlite` is built in, not a native dep).
- **Read-only viewer.** No editing/round-trip in v1.
- **No `@agent-native` / builder.io runtime dependency.**
- **HTML docs sandboxed**: `<iframe sandbox>` via `srcdoc`, no `allow-scripts`, no
  `allow-same-origin`.
- **Path confinement**: every client-supplied relpath resolved + confined to root; reject
  escapes. **Symlinks not followed** during discovery.
- **TypeScript `strict`.** Biome clean (`bun run check`) before any slice merges.
- **Default text exts** `.md .mdx .txt`; **non-text** `.html .htm .pdf .jpg .jpeg .png`.
  Only text files are indexed for search.
- **Config layering** (per-key, later wins): defaults < ENV (`VP_*`) < `.vpconfig.json` < CLI.
- **Size cap** default 5 MB (configurable later); over-cap files listed but not rendered/indexed.

---

## Shared contract (Wave 0 — every later slice depends on these)

These types live in `src/shared/types.ts` and are imported by both server and client. The
HTTP API is the integration boundary; once Wave 0 merges, these are **frozen** for v1.

```ts
// src/shared/types.ts
export type DocKind = 'mdx' | 'md' | 'txt' | 'html' | 'pdf' | 'image';

export interface TreeNode {
  name: string;                 // basename
  path: string;                 // relpath from root, '/'-normalized
  type: 'dir' | 'file';
  kind?: DocKind;               // present for files
  children?: TreeNode[];        // present for dirs
}

export interface Frontmatter {
  title?: string;
  brief?: string;
  [key: string]: unknown;       // extra keys ignored
}

export interface DocResponse {
  path: string;
  kind: DocKind;
  frontmatter?: Frontmatter;    // mdx | md
  content?: string;             // text for mdx|md|txt; raw html for html
  tooLarge?: boolean;           // over size cap
  undecodable?: boolean;        // text ext failed utf-8 decode
}

export interface SearchHit {
  path: string;
  title: string;                // frontmatter.title || basename
  snippet: string;              // sanitized excerpt, <mark> around matches
  rank: number;                 // bm25 (lower = better)
}

export interface TreeResponse { root: string; title: string; tree: TreeNode[]; }
export interface SearchResponse { hits: SearchHit[]; }

export type FsEvent =
  | { type: 'add' | 'change' | 'unlink'; path: string; kind?: DocKind }
  | { type: 'ready' };

export interface ResolvedConfig {
  root: string; port: number; host: string; title: string; open: boolean;
  include: string[]; exclude: string[];
  textFiles: string[]; nonTextFiles: string[];
  maxFileBytes: number;
}
```

**HTTP API (frozen v1):**
- `GET /api/tree` → `TreeResponse`
- `GET /api/doc/*` → `DocResponse` (text + html kinds; JSON)
- `GET /api/raw/*` → binary stream with correct `Content-Type` (pdf, images; also raw of any file)
- `GET /api/search?q=<query>` → `SearchResponse`
- `GET /api/events` → SSE stream of `FsEvent`
- `GET /*` → built SPA (index.html fallback for client routes)

All `*` splat paths are relpaths, confined to root.

---

## Wave 0 — Scaffold (serial; must merge before any other wave)

### Slice 0.1: Project scaffold + shared contract

**Depends on:** none.

**Files (create):**
- `package.json` (Bun scripts: `dev`, `start`, `test`, `e2e`, `check`)
- `tsconfig.json` (strict), `biome.json`, `vite.config.ts`, `index.html`
- `src/shared/types.ts` (the contract above)
- `src/server/index.ts` (Hono app, serves a stub `/api/tree` returning `{root,title,tree:[]}`
  and the SPA; binds `127.0.0.1`)
- `src/client/main.tsx` + `src/client/App.tsx` (Mantine provider + React Router + TanStack
  Query provider; renders "Visual Planner" shell, empty tree)
- `.github/workflows/ci.yml` (matrix ubuntu/macos/windows: setup-bun, install, `bun run
  check`, `bun test`, build; Playwright e2e on ubuntu only)
- `tests/server/health.test.ts`

**Scope:** Buildable, runnable skeleton. `bun dev` serves the SPA; SPA fetches `/api/tree`
(empty) via TanStack Query and shows an empty-state. No discovery yet.

**Acceptance:**
- `bun install` clean.
- `bun run check` (Biome) passes.
- `bun test` passes (health test hits the Hono app, asserts `/api/tree` shape).
- `bun run build` produces client `dist/`.
- `bun start` serves it; `curl localhost:<port>/api/tree` returns `{root,title,tree:[]}`.

**Produces:** the frozen `src/shared/types.ts` + the Hono app instance + Vite/Mantine/Router/
Query wiring that all later slices build on.

---

## Wave 1 — Foundations (parallel after 0.1)

### Slice 1.1: Backend discovery + ignore-layering + config

**Depends on:** 0.1.

**Files (create):**
- `src/server/config.ts` — resolve layered config → `ResolvedConfig` (zod-validated).
  Loads `.vpconfig.json`, merges defaults < ENV < file < CLI (CLI passed in from cli slice
  later; for now accept an overrides arg).
- `src/server/discovery.ts` — `discover(config): TreeNode[]`. Hand-rolled recursive walk
  (`node:fs` `readdir({withFileTypes})` + `lstat`): skip symlinks, skip hidden, apply
  nested `.gitignore` via `ignore`, apply include/exclude via `Bun.Glob`, classify by ext
  → `DocKind`, case-insensitive ext match, folders-first alpha sort, `/`-normalized paths.
- `src/server/kind.ts` — `kindFor(path, config): DocKind | null`.
- Wire `GET /api/tree` to real discovery.
- Tests: `tests/server/discovery.test.ts`, `tests/server/config.test.ts` (use temp dirs
  with fixtures: hidden files, gitignored paths, vpconfig include/exclude, symlink, mixed
  extensions, casing).

**Acceptance:** `bun test tests/server/discovery.test.ts tests/server/config.test.ts`
green; covers each ignore layer + classification + sort + symlink-skip. `/api/tree` returns
a real tree for a fixture dir.

**Produces:** `discover`, `loadConfig`/`resolveConfig`, `kindFor`.

### Slice 1.2: Client shell + tree sidebar + markdown render + routing

**Depends on:** 0.1.

**Files (create):**
- `src/client/api.ts` — typed fetch helpers + TanStack Query hooks (`useTree`, `useDoc`).
- `src/client/shell/AppShell.tsx` — Mantine AppShell: header (title + dark/light toggle
  persisted to `localStorage`), sidebar slot, main slot.
- `src/client/shell/TreeSidebar.tsx` — Mantine Tree from `TreeResponse`; filename filter
  box; click → navigate `/doc/<relpath>`.
- `src/client/render/DocView.tsx` — fetches `/api/doc/*`; routes by `kind`.
- `src/client/render/Markdown.tsx` — `react-markdown` + `remark-gfm` inside Mantine
  `TypographyStylesProvider` (handles `.md`; renders GFM tables, task lists).
- `src/client/render/PlainText.tsx` — `.txt` preformatted.
- `src/client/routes.tsx` — `/` (welcome/empty) + `/doc/*` (splat).
- Tests: `tests/client/TreeSidebar.test.tsx`, `tests/client/Markdown.test.tsx` (happy-dom +
  Testing Library): tree renders + filter narrows; markdown renders GFM table + task list.

**Acceptance:** `bun test tests/client/*` green. Manually (and via E2E later): tree lists
fixture docs, clicking opens a markdown doc rendered with GFM, theme toggle persists.

**Produces:** `useTree`, `useDoc`, `AppShell`, `TreeSidebar`, `DocView` dispatch, `Markdown`.

---

## Wave 2 — Features (parallel after Wave 1)

### Slice 2.1: MDX rendering + custom block components

**Depends on:** 1.2.

**Files (create):**
- `src/client/render/Mdx.tsx` — runtime compile via `@mdx-js/mdx` `evaluate` with
  `@mdx-js/react` provider mapping the block components; `remark-gfm`; error boundary →
  parse-error card (§10). Frontmatter already parsed server-side; body rendered here.
- `src/client/blocks/Callout.tsx` — props `type?: 'info'|'warn'|'success'|'danger'`
  (default `info`), `title?: string`; children markdown.
- `src/client/blocks/CodeTabs.tsx` — reads child fenced code metas `tab="…"`; tabbed view;
  optional `default` meta selects initial tab; falls back to lang/index when no `tab`.
- `src/client/blocks/Decision.tsx` — props `status?: 'proposed'|'accepted'|'rejected'`
  (default `proposed`), `title: string`; status-badged card; children markdown.
- `src/client/blocks/HtmlBlock.tsx` — renders its single child ```html fence into a
  sandboxed `<iframe srcdoc>` (no scripts/same-origin); optional `height`.
- `src/client/blocks/index.ts` — the provider component map.
- Tests: `tests/client/blocks.test.tsx` (each block renders + prop variants), one MDX
  integration test (`Mdx.test.tsx`) rendering a doc using all four blocks + a parse-error
  case showing the error card.

**Acceptance:** `bun test tests/client/blocks.test.tsx tests/client/Mdx.test.tsx` green.
Bad MDX shows error card, never throws past the boundary.

**Produces:** block components + provider map; `Mdx` renderer.

### Slice 2.2: Content search (FTS5 + prose-strip + UI)

**Depends on:** 1.1 (discovery), 1.2 (shell).

**Files (create):**
- `src/server/prose.ts` — `toProse(text, kind)`: strip frontmatter
  (`remark-frontmatter`) + markdown/MDX syntax (`remark-parse` + `remark-mdx` +
  `mdast-util-to-string`) → plain prose.
- `src/server/search-index.ts` — `bun:sqlite` `:memory:` FTS5 wrapper: `build(files)`,
  `upsert(path, prose)`, `remove(path)`, `query(q): SearchHit[]` (BM25 rank + `snippet()`
  with `<mark>`). Indexes text files only.
- Wire `GET /api/search?q=`.
- `src/client/shell/SearchBox.tsx` — Mantine Spotlight (or input + results panel); calls
  `/api/search`, shows ranked file + snippet hits; click → open doc.
- Tests: `tests/server/prose.test.ts`, `tests/server/search-index.test.ts` (build + query +
  ranking + snippet + exclude non-text), `tests/client/SearchBox.test.tsx`.

**Acceptance:** `bun test` for those green; query returns ranked hits with highlighted
snippets; `.html`/`.pdf`/images never appear in results.

**Produces:** `toProse`, `searchIndex` (build/upsert/remove/query) — consumed by the watcher
slice for incremental freshness.

### Slice 2.3: Syntax highlight + Mermaid

**Depends on:** 2.1 (and 1.2 markdown).

**Files (create):**
- `src/client/render/highlight.ts` — `@shikijs/rehype` integration for both `Markdown` and
  `Mdx` pipelines; theme follows color-scheme (light/dark); lazy-load languages.
- `src/client/render/Mermaid.tsx` — `lang=mermaid` fence → renders via `mermaid` on mount;
  re-renders on theme change; error → inline notice.
- Hook both renderers to route `mermaid` fences to `<Mermaid>` and other fences to Shiki.
- Tests: `tests/client/Mermaid.test.tsx` (renders a diagram container; bad diagram → notice),
  highlight smoke test (code block gets shiki classes).

**Acceptance:** `bun test` green; code blocks highlighted, theme-aware; mermaid fence renders
a diagram, bad mermaid shows a notice not a crash.

**Produces:** shiki pipeline + `Mermaid` component.

### Slice 2.4: Non-text viewers (html, pdf, image) + raw endpoint

**Depends on:** 1.1 (kind), 1.2 (DocView).

**Files (create):**
- `src/server/raw.ts` + wire `GET /api/raw/*` — stream bytes with correct `Content-Type`,
  path-confined.
- `src/client/render/HtmlView.tsx` — sandboxed `<iframe srcdoc>` of server-provided html
  (no scripts/same-origin).
- `src/client/render/PdfView.tsx` — `<iframe src="/api/raw/<path>">` (native viewer).
- `src/client/render/ImageView.tsx` — `<img src="/api/raw/<path>">`.
- Extend `DocView` dispatch for `html`/`pdf`/`image`; load-fail placeholder (§10).
- Tests: `tests/server/raw.test.ts` (content-type + path confinement + traversal reject),
  `tests/client/HtmlView.test.tsx` (iframe has correct sandbox attrs, no `allow-scripts`).

**Acceptance:** `bun test` green; raw endpoint rejects `../` traversal; HtmlView sandbox
attributes asserted; pdf/image display via raw endpoint.

**Produces:** `/api/raw/*`; html/pdf/image viewers.

---

## Wave 3 — Integration & polish (serial after Wave 2)

### Slice 3.1: CLI + lifecycle

**Depends on:** 1.1 (config).

**Files (create):**
- `src/server/cli.ts` — `citty` command: positional `<dir>`, flags
  `--port --host --title --open --include --exclude --hidden --no-gitignore`,
  auto `--help`/`--version`. Feeds CLI overrides into `resolveConfig`.
- `bin/visual-planner.ts` (entry) — wires cli → config → server start.
- Lifecycle in `src/server/index.ts`: startup banner (resolved root + clickable URL),
  bad-root error exit, **port auto-fallback** (increment to next free), graceful shutdown
  (SIGINT/SIGTERM close watcher + SSE + server), `--open` via `open`.
- Tests: `tests/server/config.test.ts` extended for CLI-layer precedence; `tests/server/
  port.test.ts` (fallback picks next free port).

**Acceptance:** `bun test` green; `visual-planner --help` prints usage; bad dir exits
non-zero with a clear message; busy port falls back and banner prints the actual port.

### Slice 3.2: Live reload (watcher → SSE) + incremental index

**Depends on:** 2.2 (search-index), 1.1 (discovery), 0.1 (SSE route).

**Files (create):**
- `src/server/watcher.ts` — `chokidar` watch of root, **ignore-aware** (never descends
  hidden/gitignored/excluded, e.g. `node_modules`, `.git`), ~150 ms debounce; emits
  `FsEvent`s.
- Wire `GET /api/events` SSE to the watcher; on each event also `searchIndex.upsert/remove`
  and trigger a tree re-scan.
- `src/client/live.ts` — `EventSource` client; on event → `queryClient.invalidate(['tree'])`
  and, if the open doc path matches, invalidate `['doc', path]`; disconnect banner + auto-retry.
- Tests: `tests/server/watcher.test.ts` (temp dir: add/change/unlink emits debounced events,
  ignored paths produce none).

**Acceptance:** `bun test tests/server/watcher.test.ts` green; adding a file under a fixture
root emits one `add` event after debounce; editing a `.git/`-ignored file emits nothing.

### Slice 3.3: Error/empty states + polish + E2E

**Depends on:** all prior.

**Files (create):**
- `src/client/shell/ErrorCard.tsx` — shared error-card component (icon + title + detail +
  optional action), used by all states in §10.
- Empty/no-docs welcome state; too-large + undecodable notices (server already flags via
  `DocResponse`); search-no-results; loading skeletons via TanStack Query `isLoading`.
- `tests/e2e/smoke.spec.ts` (Playwright): start server on a fixture dir → list docs in tree
  → open an MDX doc → assert a Callout + a highlighted code block render → run a content
  search → click a hit → assert it opens. Toggle theme persists across reload.
- Final Biome pass; README quickstart.

**Acceptance:** `bun run e2e` smoke passes end-to-end on a fixture dir; `bun run check`
clean; all unit tests green.

---

## Wave dependency summary (fleet DAG)

```
0.1  ──┬── 1.1 ──┬── 2.2 ──┐
       │         │         │
       └── 1.2 ──┼── 2.1 ──┼── 3.2 ── 3.3
                 ├── 2.3 ──┤
                 └── 2.4 ──┤
            1.1 ──── 3.1 ──┘
```
- Wave 0: `0.1` (serial gate).
- Wave 1: `1.1`, `1.2` parallel.
- Wave 2: `2.1`, `2.2`, `2.3`, `2.4` parallel (2.1/2.3 share render code — 2.3 builds on 2.1).
- Wave 3: `3.1` (after 1.1) ‖ then `3.2` (after 2.2) → `3.3` integration last.

## Self-review notes (spec coverage)

- Discovery/ignore/config/vpconfig → 1.1 + 3.1. Search (FTS5/prose, text-only) → 2.2.
  Tree sidebar + filter → 1.2. MDX blocks → 2.1. Highlight/mermaid → 2.3. html/pdf/image +
  raw + sandbox → 2.4. CLI/lifecycle/port/banner → 3.1. Live reload/watcher/SSE → 3.2.
  Error/empty states + E2E → 3.3. Security invariants enforced in 0.1 (bind), 2.1/2.4
  (sandbox), 1.1 (symlink), 2.4 (path confinement) and reasserted in reviews.
- Parked features (relative linking, single-binary, container) intentionally absent.

# Visual Planner — Design Spec (v1)

**Date:** 2026-06-20
**Status:** approved for planning
**Type:** L-tier (new project, multi-day, cross-cutting)

## 1. Purpose

A lightweight, **local, read-only** web app that auto-discovers documentation files
under a directory and renders them in a browser. The agent writes docs (especially
`.mdx` "plan" documents with a small custom block vocabulary); a human browses them.

No accounts, no auth, no network egress, no external SaaS, no runtime dependency on
builder.io / `@agent-native`. The filesystem is the single source of truth.

Inspired by Builder.io's "agent-native" plan app (author plans as MDX, render rich
blocks, browse them) but a **fresh, independent build** — we borrow the idea, not the
code or format. It fixes the reference app's core gaps: it **lists local docs** and has
an **index route**, which the reference app lacked.

## 2. Non-goals (explicitly out of v1)

- Editing, round-trip, autosave (read-only viewer only)
- Comments, collaboration, @mentions, version history
- Authentication / login
- Per-plan sibling-file bundles (multi-file plans) — deferred
- Single-binary (`bun --compile`) packaging — deferred (COULD)
- Container image for self-host — deferred
- Content search of **non-text** files (`.html`, `.pdf`, images) — out (only text files
  are indexed)
- **In-view relative linking** (click a relative URL in markdown → open the target file
  without leaving the view) — **deferred, parked as a future feature** (see §15)

## 3. Stack

Chosen for the MDX ecosystem fit (MDX is JS-native) with zero native modules.

- **Runtime:** Bun
- **Server:** Hono — reads the filesystem live, serves discovery/list/content APIs + SSE
- **Client:** Vite + React SPA
- **MDX:** `@mdx-js/mdx` (runtime compile in browser) + `remark-gfm`
- **Highlight:** Shiki (syntax theme follows light/dark mode)
- **Diagrams:** Mermaid (client-side render of ` ```mermaid ` fences)
- **Frontmatter:** gray-matter
- **Search:** `bun:sqlite` (built into Bun — no native module) FTS5, in-memory

### Backend dependencies

Lean on Bun built-ins; add deps only where they earn it. All pure JS, **zero native
modules**.

**Built-in (no dep):**
- `Bun.serve` under **Hono** — HTTP routing/middleware/SSE (`hono/streaming`)
- **`bun:sqlite`** — FTS5 content search (no native module)
- **`Bun.Glob`** — include/exclude glob matching
- `node:fs` `readdir({withFileTypes})` + `lstat` — hand-rolled ignore-aware walk
  (symlink-skip, custom layering)

**Added deps:**
- **`hono`** — server framework
- **`citty`** (unjs) — CLI: declarative args, auto `--help`/`--version`
- **`zod`** — `.vpconfig.json` + resolved-config validation, friendly errors
- **`chokidar`** — cross-OS reliable fs watcher (recursive + ignore + debounce)
- **`ignore`** — gitignore-spec matcher (fed nested `.gitignore` contents)
- **`gray-matter`** — frontmatter parse
- **remark stack** — `remark-parse`, `remark-mdx`, `remark-gfm`, `remark-frontmatter`,
  `mdast-util-to-string` — md/mdx → plain prose for the search index
- **`open`** — cross-platform browser launch for `--open`

### Frontend dependencies

Optimized for a **clean codebase** (batteries-included over hand-rolled glue), not
minimal dep count.

**Rendering core:**
- **Vite** + `@vitejs/plugin-react` — build/dev/HMR
- **`@mdx-js/mdx`** (`evaluate`) + **`@mdx-js/react`** — runtime MDX compile + provider
  mapping the 4 custom block components
- **`react-markdown`** + `remark-gfm` — `.md` rendering (no JSX execution; safer than
  routing `.md` through MDX)
- **`@shikijs/rehype`** — syntax highlight in the rehype pipeline, theme follows mode,
  lazy-loaded languages
- **`mermaid`** — `lang=mermaid` fences → a `<Mermaid>` component
- **`lucide-react`** — icons
- native `EventSource` — SSE client (no dep)

**App shell / UX:**
- **Mantine** — AppShell (sidebar layout), Tree (file tree), Spotlight (search modal),
  TypographyStylesProvider (prose styling for md/mdx), native dark/light color-scheme
- **React Router** — `/` and `/doc/*` (splat relpath)
- **TanStack Query** — data layer: caching, loading/error states, SSE-driven
  invalidate/refetch for live reload
- **Native `<iframe>`/`<embed>`** for `.pdf` (zero dep; react-pdf is a later upgrade)

### Why this stack

- MDX/remark/rehype/shiki/mermaid are all JS-native — Go/Rust are second-class for MDX.
- Bun ships SQLite built-in → FTS5 full-text search with **zero** native dependencies,
  directly avoiding the `better-sqlite3`/gyp pain of the reference app.
- A thin server reading the FS at runtime means **new docs appear live, no rebuild** —
  the key requirement that a build-time framework (e.g. Astro SSG) fights.
- Single-binary/static was explored (Go `embed.FS`, Rust `mdxjs-rs`, Bun `--compile`)
  and **deferred** — the constraint was relaxed in favor of best ecosystem fit. Bun
  `--compile` remains a later path if single-file packaging is wanted again.

## 4. Invocation

- `visual-planner` (no args) → serve current working directory
- `visual-planner <dir>` → serve `<dir>`
- Opens a local HTTP server; user browses in a browser. No flags required for the
  default flow.

### Flags

- `--port <n>`, `--host <addr>`, `--title <s>`, `--open` (auto-open browser)
- `--include <glob>` / `--exclude <glob>` (repeatable)
- `--hidden` (include hidden files/folders), `--no-gitignore` (ignore `.gitignore`) —
  CLI escape hatches over the default ignore layers
- `--help`, `--version`

### Lifecycle

- **Startup banner**: prints resolved root dir + clickable `http://<host>:<port>`.
- **Bad root**: if `<dir>` doesn't exist or isn't a directory → clear error, non-zero exit.
- **Port in use**: try the configured port, then increment to the next free port; banner
  prints the actual port chosen.
- **Graceful shutdown**: SIGINT/SIGTERM closes the fs-watcher, SSE connections, and HTTP
  server cleanly.
- **No network egress**: the process makes no outbound requests and emits no telemetry —
  a hard invariant (§11 Security).

## 5. Discovery

Recursive walk of the root directory, collecting **common documentation file types**.
Files fall into two classes, both **viewable**; only **text** files are **indexed** for
content search. Both extension lists are configurable in `.vpconfig.json` (§5 schema).

**Text files** — viewed **and** indexed:

| Extension | Handling                                                         |
| --------- | ---------------------------------------------------------------- |
| `.mdx`    | **Custom renderer** — markdown + custom blocks + shiki + mermaid |
| `.md`     | Markdown renderer — GFM + shiki + mermaid, **no custom blocks**  |
| `.txt`    | Plain text — displayed preformatted                              |

**Non-text files** — viewed, **not** indexed:

| Extension          | Handling                                                |
| ------------------ | ------------------------------------------------------- |
| `.html` / `.htm`   | **Display only**, sandboxed iframe, **JavaScript disabled** |
| `.pdf`             | Displayed via pdf.js                                    |
| `.jpg` / `.jpeg` / `.png` | Displayed as an image (`<img>`, no extra dep)    |

### Ignore rules (layered, applied in order)

1. **Hidden** files and anything inside **hidden folders** (dot-prefixed, e.g. `.git/`,
   `.cache`) → skipped by default.
2. **`.gitignore`** respected by default, with proper gitignore semantics including
   nested `.gitignore` files.
3. **`.vpconfig.json`** in the root → **always applied**, overrides the above. Can
   restrict discovery to specific paths (include-only) or exclude paths, and can
   re-include something the defaults would skip (e.g. a hidden path).

### Discovery edge cases (v1)

- **Symlinks: not followed.** `lstat`; if a symlink, skip it — eliminates both root-escape
  and traversal-loop risk.
- **Extensions matched case-insensitively** (`.MD`, `.PDF` count).
- **Tree ordering**: folders first, then files; alphabetical within each, case-insensitive.
- **Empty / no docs discovered** → friendly empty state in the UI (not an error).
- **Max file size**: files above a cap (default 5 MB) are still listed but show a
  "too large to render/index" notice; they are skipped by the search index.
- **Decode guard**: a file with a text extension that fails UTF-8 decode → shown as a
  "binary/undecodable" notice instead of garbage; not indexed.
- **Relpaths normalized to `/`** internally (cross-OS; Windows `\` normalized).

### `.vpconfig.json` schema

```json
{
  "include": ["docs/**", "specs/**"],
  "exclude": ["**/drafts/**"],
  "title": "My Plans",
  "textFiles": [".md", ".mdx", ".txt"],
  "nonTextFiles": [".html", ".htm", ".pdf", ".jpg", ".jpeg", ".png"]
}
```

- `include` (optional): glob allow-list. If present, only matching paths are discovered.
- `exclude` (optional): glob deny-list, applied after `include`.
- `title` (optional): app title shown in the header.
- `textFiles` (optional): extensions treated as **text** — viewed **and** indexed.
  Overrides the default text list. `.mdx` always gets the custom renderer; other text
  extensions render as markdown unless `.txt`-like.
- `nonTextFiles` (optional): extensions treated as **non-text** — viewed, **not** indexed.
  Overrides the default non-text list.
- An extension not in either list is **not discovered**. Defaults (above) apply when the
  keys are absent.
- Absent config → defaults only (everything minus hidden + gitignored).
- Globs override the hidden/gitignore defaults when they explicitly name a path.

### Configuration resolution (layering)

Settings resolve through layers, **later layers win per-key**:

```
built-in defaults  <  ENV vars  <  .vpconfig.json  <  CLI args
```

(lowest precedence on the left; **CLI args always win**).

| Setting        | Default                | ENV              | Config key      | CLI flag           |
| -------------- | ---------------------- | ---------------- | --------------- | ------------------ |
| root dir       | `cwd`                  | `VP_ROOT`        | —               | positional `<dir>` |
| port           | `4321`                 | `VP_PORT`        | `port`          | `--port`           |
| host           | `127.0.0.1`            | `VP_HOST`        | `host`          | `--host`           |
| title          | root dir name          | `VP_TITLE`       | `title`         | `--title`          |
| open browser   | `false`                | `VP_OPEN`        | `open`          | `--open`           |
| include globs  | none                   | —                | `include`       | `--include` (rep.) |
| exclude globs  | none                   | —                | `exclude`       | `--exclude` (rep.) |
| text files     | `.md .mdx .txt`        | —                | `textFiles`     | —                  |
| non-text files | `.html .htm .pdf .jpg .jpeg .png` | —     | `nonTextFiles`  | —                  |

Merge semantics: **scalars** (port, title, …) — later layer replaces. **Lists**
(include/exclude/textFiles/nonTextFiles) — a layer that sets the key **replaces** the
whole list (no append), for predictability. A `config` module produces one resolved,
validated config object consumed by the rest of the app.

## 6. Server API (Hono)

- `GET /api/tree` — discovered files as a directory tree (folders + files, relpaths).
- `GET /api/doc/<relpath>` — file content for rendering:
  - `.mdx` / `.md` / `.txt` → raw text (+ parsed frontmatter for mdx/md)
  - `.html` → raw HTML (served into a sandboxed iframe by the client)
  - `.pdf` → binary stream (or served for pdf.js)
  - `.jpg`/`.jpeg`/`.png` → binary stream (rendered via `<img>`)
- `GET /api/search?q=<query>` — FTS5 search over `.md`/`.mdx`/`.txt`; returns ranked
  hits `[{ relpath, snippet }]` (BM25 rank, `snippet()` highlighted excerpt).
- `GET /api/events` — **SSE** stream of filesystem change events (live reload).
- `GET /*` — serves the built SPA (and index.html fallback for client routes).

Path safety: all `relpath` inputs are resolved and confined to the root; traversal
outside the root is rejected.

## 7. Content search

- **Backend:** `bun:sqlite` in-memory (`:memory:`) FTS5 virtual table.
- **Indexed:** **text files only** (default `.md`, `.mdx`, `.txt`; configurable via
  `textFiles`). Non-text files (`.html`, `.pdf`, images) are excluded.
- **What is indexed:** frontmatter stripped, then markdown/MDX syntax stripped to plain
  **prose**, so results match readable text — not `<Callout>` / `#` / fence syntax.
- **Query:** `MATCH` with BM25 ranking + `snippet()` for highlighted excerpts.
- **Freshness:** built at startup; kept fresh **incrementally via the fs-watcher** that
  already powers live reload (update/insert/delete the single affected row on change).
- In-memory → no DB file on disk, rebuilt cheaply on restart; FS stays source of truth.

## 8. UI / layout

- **Left sidebar:** collapsible **directory tree** mirroring the on-disk folder
  structure, files nested under their directories. Plus:
  - a **filename filter box** (filters the tree by name/path as you type)
  - a **content-search box** (md/mdx/txt) returning ranked file + snippet hits
- **Main pane:** the rendered document.
- **Header:** app title + **dark/light toggle** (system-preference default, **persisted
  in `localStorage`**; syntax theme follows the mode). Reading-optimized typography.
- **Routes:**
  - `/` — index / welcome (and a hint to pick a doc)
  - `/doc/<relpath>` — render the selected document
- **Live reload:** fs-watch → SSE → the browser refreshes the open document and
  re-scans the tree when files are added/removed.

### Watcher hygiene

- **Ignore-aware**: the watcher does not watch ignored paths (hidden, gitignored,
  excluded) — never descends `node_modules`, `.git`, etc.
- **Debounce**: rapid bursts (agent writing a file, editor save-swap) are debounced
  (~150 ms) into a single change event before refresh + index update.
- Change events drive both the SSE refresh and the incremental search-index upsert/delete.

## 9. MDX block vocabulary

Philosophy: **let standard markdown/GFM do the heavy lifting; add a custom component
only where markdown can't express the intent.** This covers the full reference block set
(RichText, Table, Checklist, etc.) with far fewer components.

### Native (no component)

- Prose, headings, lists, links → plain markdown (= reference "RichText")
- Tables → GFM `| a | b |` (= reference "Table")
- Checklists → GFM task lists `- [ ]` / `- [x]`, styled, with an auto progress count
  (= reference "Checklist")
- Code → fenced ` ```ts ` with Shiki highlight
- Diagrams → fenced ` ```mermaid `

### Custom components (4)

- **`<Callout type="info|warn|success|danger" title="…">`** — markdown body.
- **`<CodeTabs>`** — wraps fenced code blocks tagged with a `tab="…"` meta:
  ````mdx
  <CodeTabs>
  ```ts tab="server.ts"
  // ...
  ```
  ```ts tab="client.ts"
  // ...
  ```
  </CodeTabs>
  ````
- **`<Decision status="proposed|accepted|rejected" title="…">`** — decision card with
  markdown rationale.
- **`<HtmlBlock>`** — sandboxed raw-HTML escape hatch (rendered in a sandboxed iframe,
  no JavaScript), for the rare case markdown can't express the layout.

### Frontmatter

```yaml
---
title: Auth Rewrite Plan
brief: Short one-line summary shown in lists and the header.
---
```

`title` and `brief` only. Unknown frontmatter keys are ignored (forward-compatible).

## 10. Error & empty states (user-facing)

Every failure degrades to a clear in-app state — **the viewer never crashes**, and the
sidebar/tree stays usable throughout. Each state below is what the user actually sees.

| State | Trigger | What the user sees |
| --- | --- | --- |
| **Parse error** | bad MDX / malformed frontmatter | inline error **card** in the main pane: file path + the error message (and which line if available); rest of app unaffected. Optionally a "show raw" toggle to read the source. |
| **Not found** | open doc was deleted/renamed | friendly "this document is gone" card; tree re-scans via SSE and the node disappears. |
| **Empty / no docs** | root has no discoverable files | welcome/empty state in main pane: short explanation + hints ("no docs found under `<root>` — check `.vpconfig.json` `include`/`exclude`, or that files aren't hidden/gitignored"). |
| **Too large** | file over size cap (default 5 MB) | notice card: "too large to render (> 5 MB)"; the file is still listed; offer an "open raw" link (served via the raw endpoint). |
| **Undecodable** | text-extension file fails UTF-8 decode | "binary or undecodable content" notice instead of garbage; not indexed. |
| **Search: no results** | content/filename query matches nothing | inline "no matches for *query*" in the search panel; clearing the box restores the tree. |
| **Live reload disconnected** | SSE drops | subtle, non-blocking banner: "live reload disconnected — reconnecting…"; `EventSource` auto-retries; banner clears on reconnect. |
| **Image/PDF load fail** | corrupt/unreadable binary | placeholder card "couldn't display this file" with the raw link. |

Cross-cutting:
- `.html` is always sandboxed (no `allow-scripts`/`allow-same-origin`, §11) — JavaScript
  cannot run; arbitrary doc content can't touch the app or the local environment.
- Loading states: tree and document use skeleton/spinner placeholders (TanStack Query
  `isLoading`) so nothing flashes empty.
- All error cards share one consistent component (icon + title + detail + optional action)
  for a uniform feel across states.

## 11. Security

Threat model: the app renders **untrusted document content** (an agent or arbitrary files
in a directory) on `localhost`. Hardening invariants:

- **Bind to `127.0.0.1` by default**, not `0.0.0.0` — no LAN/Internet exposure. LAN access
  is opt-in only via `--host`/`VP_HOST`, and the startup banner makes a non-loopback bind
  explicit.
- **No network egress / no telemetry** — the process makes zero outbound requests. Mermaid,
  Shiki, fonts, and all assets are bundled/served locally; nothing is fetched at runtime.
- **HTML docs sandboxed**: rendered in an `<iframe sandbox>` with **no `allow-scripts`**
  and **no `allow-same-origin`**, fed via `srcdoc` so document HTML cannot run JavaScript,
  reach the app's origin, read cookies/`localStorage`, or escape the frame.
- **Path traversal blocked**: every `relpath` from the client is resolved and confined to
  the root; any path escaping the root is rejected (404/403). Applies to `/api/doc` and any
  asset serving.
- **Symlinks not followed** (§5) → no symlink-based escape outside root.
- **Size caps** (§5) bound memory/CPU from pathological files.

## 12. Build / run

- **`bun dev`** — Vite HMR client + Bun/Hono server (daily use).
- **`bun start`** — serves the built client + server as the local "prod" mode.
- `bun --compile` single-file binary — **deferred** (COULD); the architecture keeps it
  reachable later without rework.

### Tooling

- **Language:** TypeScript, `strict`. Bun runs TS natively; Vite type-checks the client.
- **Package manager:** Bun.
- **Lint + format:** **Biome** (single tool, `biome check --write`).
- **Tests:** **`bun test`** for everything unit-level — backend (needs Bun runtime for
  `bun:sqlite`) and components (**happy-dom** + **`@testing-library/react`**). **Playwright**
  for E2E smoke (list → open doc → render a block → search). TDD per the build milestones.

### Repo layout (single package)

```
package.json          # one package, Bun scripts
biome.json
tsconfig.json
vite.config.ts
src/
  server/             # Hono server, discovery, watcher, search-index, config, cli
  client/             # React SPA: shell, render, blocks
  shared/             # types shared by both: TreeNode, SearchHit, ResolvedConfig, DocKind
tests/
  e2e/                # Playwright
docs/superpowers/specs/
```

Scripts: `bun dev` (Vite + server), `bun start` (serve built client + server),
`bun test`, `bun run e2e`, `bun run check` (Biome).

## 13. Component boundaries (for the implementation plan)

Each unit has one purpose, a clear interface, and is independently testable:

- **discovery** — walk + ignore-layering (hidden / gitignore / vpconfig) → file list.
  Pure-ish: given a root + config, returns the discovered relpaths.
- **config** — resolve layered config (defaults < ENV < `.vpconfig.json` < CLI),
  validate, emit one resolved object.
- **search-index** — `bun:sqlite` FTS5 wrapper: build, upsert, delete, query.
- **prose-strip** — markdown/MDX → plain prose (feeds search-index).
- **watcher** — fs watch → emits change events (consumed by SSE + search-index).
- **cli** — arg parse, lifecycle (banner, port-fallback, graceful shutdown, bad-root).
- **server** — Hono routes wiring the above + SSE + static SPA + path-confinement.
- **client/render** — MDX runtime compile + block components + shiki + mermaid.
- **client/blocks** — the 4 custom components.
- **client/shell** — tree sidebar, filter box, search box, header/theme, routing.

## 14. Incremental build order (milestones)

1. **Viewer skeleton** — server serves a hard-coded `.md`/`.mdx`; client renders markdown.
   Prove rendering early.
2. **Custom blocks** — Callout, CodeTabs, Decision, HtmlBlock + frontmatter.
3. **Discovery + sidebar** — recursive walk, ignore layers, `.vpconfig.json`, tree UI,
   per-doc route; handle text (`.txt`) + non-text (`.html` sandboxed, `.pdf`,
   `.jpg`/`.png` images).
4. **Search** — FTS5 index + prose-strip + filename filter + content-search UI.
5. **Highlight + mermaid** — Shiki theming (light/dark), mermaid fences.
6. **Live reload + polish** — fs-watch → SSE, theme toggle, error states, typography.

## 15. Parked / future features (post-v1 todo)

Deliberately out of v1. Recorded here so they aren't lost.

- **In-view relative linking** — a relative URL in a markdown/MDX doc (e.g.
  `[see api](../specs/api.md)`, or an image `![](./diagram.png)`) is clickable and opens
  the target file **inside the viewer** (resolve relative path against the doc's location,
  confine to root, route to `/doc/<relpath>`) without leaving the app. Covers doc→doc
  links and inline image references to discovered files. Not v1.
- Single-binary (`bun --compile`) packaging.
- Container image for self-host.
- Per-plan sibling-file bundles / multi-file plans.

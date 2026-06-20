---
paths:
  - "src/server/config.ts"
  - "src/server/discovery.ts"
  - "src/server/kind.ts"
  - "src/server/cli.ts"
  - "src/server/watcher.ts"
  - "tests/server/**"
---

# Server config + discovery conventions (slice 1.1)

Durable rules for any slice that consumes `ResolvedConfig`, walks the FS, or
extends config layering (3.1 CLI, 3.2 watcher, 2.2 search all depend on these).

## Config layering (`resolveConfig`)

Precedence, later wins **per-key**:

```
built-in defaults  <  ENV (PLANDECK_*)  <  .plandeck.json  <  overrides arg (CLI layer)
```

- **Root resolved FIRST** (defaults < `PLANDECK_ROOT` < overrides), *then* `.plandeck.json`
  is read from that resolved root, then the full merge applies, then overrides go on
  top so CLI always wins. Do not read plandeck config before resolving root.
- **Lists replace wholesale** — `include`, `exclude`, `textFiles`, `nonTextFiles`:
  a layer that sets the key replaces the entire list. No append/merge across layers.
- **`title`** falls back to `path.basename(root)` **only** when no layer set it.
- ENV scalars only: `PLANDECK_ROOT`, `PLANDECK_PORT` (number), `PLANDECK_HOST`, `PLANDECK_TITLE`,
  `PLANDECK_OPEN` ('true'/'1' → true). No ENV for list keys (per spec table).
- **`.plandeck.json` is zod-validated and `.strict()`** — it has NO `root` key, and
  any unknown key throws a friendly error (catches typos). The final `ResolvedConfig`
  is also zod-validated (port int > 0, exts start with `.`, etc).
- zod is **v4**: `ZodError` uses `.issues` (not `.errors`) —
  `err.issues.map(i => i.message)`. tsc strict flags `.errors`.

## Discovery (`discover`)

Hand-rolled recursive walk — `readdirSync(dir, { withFileTypes: true })` +
`lstatSync` per entry. **Security-critical, keep these invariants:**

- **Symlinks NOT followed.** `lstatSync(p).isSymbolicLink()` → skip the entry
  entirely (both file and dir links). Never `statSync` (it follows links). This is
  the root-escape + traversal-loop guard. Watcher (3.2) must be ignore-aware the same way.
- **Relpaths** built only via `path.relative(root, abs).replace(/\\/g, "/")` —
  `/`-normalized, never string-concat of input. No `..` can appear.
- **Hidden** (dot-prefixed) files and dirs skipped by default; hidden dirs not descended.
- **Nested `.gitignore`** via the `ignore` package. ONE unified `walkDir`: it always
  loads `dirPath`'s own `.gitignore` and inherits the parent matcher; `discover()`
  seeds the recursion with an empty `ignore()` so the root `.gitignore` loads through
  the same path exactly once. Feed relpaths to the matcher; dirs matched as `relpath + "/"`.

### `include` / `exclude` (Bun.Glob) + the re-include override

- `include` non-empty → a FILE is kept only if its relpath matches some include glob.
  `exclude` prunes (file or dir) after include.
- **Override rule (spec §5):** an `include` glob re-includes an otherwise hidden/gitignored
  path. The `dir/**` form must reach INTO a hidden/gitignored dir — a hidden/gitignored
  DIR is pruned before its children, and `new Bun.Glob("X/**").match("X")` is `false`.
  So before pruning a hidden/gitignored dir, run `includeCouldReachDir(dirRelPath, include)`:
  admit the dir if any pattern `startsWith(dir + "/")` OR (pattern with trailing `/**`
  stripped) glob-matches the dir. Then per-file include filtering prunes non-matches.
  Without a naming include, hidden/gitignored dirs stay skipped.

### Classification + ordering

- `kindFor(path, config)` matches ext **case-insensitively** (`.MD`, `.PDF` count).
  text exts → `mdx`/`md`/`txt` (other text ext → `md` renderer); non-text →
  `html`/`pdf`/`image`. `textFiles` wins if an ext is in both lists. Unknown ext → `null`
  (file not discovered).
- **Sort:** folders first, then files; alphabetical case-insensitive within each group.
- **Over-cap files are still LISTED** (not dropped by `maxFileBytes`). Render/index slices
  handle the cap; discovery only lists.

## Biome

Use dot notation for known keys: `env.PLANDECK_PORT`, not `env["PLANDECK_PORT"]`
(lint `complexity/useLiteralKeys`).

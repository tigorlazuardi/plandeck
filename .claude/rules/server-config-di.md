---
paths: ["src/server/**", "tests/server/**"]
---

# Server config is dependency-injected (createApp factory)

The resolved config is built ONCE at startup (with CLI overrides) and injected into the
app. **Never call `resolveConfig()` argless inside a route/watcher/search handler** — that
silently ignores the CLI layer and serves cwd instead of the chosen `<dir>` (the bug fixed
in `738eaeb`).

- `createApp(config: ResolvedConfig): Hono` (app.ts) is the factory. `startServer(config)`
  (index.ts) resolves config once → `createApp(config)` → `.fetch`.
- All four endpoints (`/api/tree`, `/api/doc`, `/api/search`, `/api/raw`) + the shared
  watcher (`createWatcher(config)`) + the search index (`discover(config)`) read the SAME
  injected `config` closure — one root everywhere.
- `raw.ts` exposes `makeRawHandler(config)` (not a module singleton); `confinedResolve`
  stays a pure `(root, relpath)` fn.
- A back-compat `export const app = createApp(resolveConfig())` exists for convenience, but
  `searchIndex`/`sharedWatcher` are per-`createApp`-closure locals and the watcher is lazy
  (first `/api/events` only) — so the back-compat singleton creates no eager watcher / no
  leak. Tests should build their own `createApp(resolveConfig({ root }, { env: {} }))` with
  an explicit root rather than relying on env mutation.
- Config layering is still `defaults < ENV (PLANDECK_*) < .plandeck.json < CLI` — see
  [[server-config-and-discovery]].

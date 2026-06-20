---
paths: ["src/server/**", "tests/server/**"]
---

# Server runtime: port fallback, SSE, watcher (slices 3.1 / 3.2)

## Port fallback + lifecycle
- `Bun.Server.port` is typed `number | undefined` — null-coalesce (`server.port ?? tryPort`).
- Port-in-use error has `.code === 'EADDRINUSE'`; on it, increment to the next free port and
  print the ACTUAL port in the startup banner (OSC 8 clickable URL).
- Graceful shutdown: handle `SIGINT`/`SIGTERM` → close the server (and the chokidar watcher +
  SSE streams) before exit. Bad root dir → clear message + non-zero exit.

## SSE (`/api/events`)
- Use `streamSSE` from `hono/streaming`. It auto-sets `Content-Type: text/event-stream`,
  `Cache-Control: no-cache`, `Connection: keep-alive` — do NOT set these manually.
- `StreamingApi.write()` swallows write errors, so an unawaited `void stream.writeSSE(...)`
  in a subscriber callback won't cause unhandled rejections.
- The `/api/events` route + the shared watcher singleton must be registered BEFORE the static
  SPA middleware (otherwise the catch-all swallows it).

## chokidar watcher (`watcher.ts`)
- chokidar v5 `ignored` accepts a function `(absPath) => boolean`. Load the root `.gitignore`
  ONCE at watcher creation (no FS reads inside the hot fn). Reuse the SAME `ignore` pkg +
  segment logic as `discovery.ts` — do NOT fork a second ignore implementation.
- Check EVERY path segment (not just basename): dot-prefixed → ignore; `node_modules` → ignore;
  `ig.ignores(relPath)` → ignore; `config.exclude` Bun.Glob match → ignore. `followSymlinks:
  false`.
- The `ignored` fn is called with the root itself on startup — `path.relative(root,root)===''`
  whose segment `['']` does NOT start with `.`, so root stays watchable.
- Debounce ~150 ms via a `Map<string, Timer>`. The watcher subscriber also drives incremental
  search-index `upsert`(add/change for md/mdx/txt)/`remove`(unlink) on the same singleton.
- CLI (`citty`) has NO array arg type — repeated flags keep only the last value; accept
  comma-separated strings for `--include`/`--exclude` rather than advertising repeatable.

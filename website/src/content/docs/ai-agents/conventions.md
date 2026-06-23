---
title: Project conventions
description: The code conventions enforced in the Plandeck repo, mirrored from its .claude/rules.
---

The repo encodes its durable conventions as path-scoped rule files under
`.claude/rules/`, which a coding agent loads automatically when editing matching
files. This page summarizes them so contributors (human or agent) know the
constraints up front.

## Server

- **Config is dependency-injected.** Build the resolved config once at startup
  and pass it through `createApp(config)`. Never call `resolveConfig()` argless
  inside a route, watcher, or search handler — that drops the CLI layer and
  serves the wrong directory.
- **Config layering** is `defaults < PLANDECK_* env < .plandeck.json < CLI`.
- **Port fallback / lifecycle** — on `EADDRINUSE`, increment the port and print
  the actual bound URL. Handle `SIGINT`/`SIGTERM` for graceful shutdown.
- **SSE** uses `streamSSE` from `hono/streaming`; the events route and watcher
  singleton register before the static SPA middleware.
- **The watcher and `discovery.ts` share one ignore implementation** (the
  `ignore` package + the same per-segment dot/`node_modules` logic). Don't fork a
  second one.

## Security

- **Raw file serving is path-confined**; symlinks are not followed and escapes
  are rejected. Active types (`.html`, `.svg`) are served as downloads with
  `nosniff`, never as live documents.
- **Search snippets are XSS-sanitized** on the server before the client renders
  them — only `<mark>` survives. This two-layer gate is load-bearing; don't
  relax it.

## Client

- **Data hooks** live in `src/client/api.ts` (`useTree`, `useDoc`) and use the
  frozen shared types in `src/shared/types.ts`. Don't redefine those types.
- **Color scheme** is initialized from `localStorage` at module level to avoid a
  flash of the wrong theme.
- **Do not mock `@mantine/core` in tests** — it leaks across the worker's module
  registry and breaks unrelated tests. Render with a real `MantineProvider`.

## TypeScript

`tsconfig` enables `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`:

- Don't pass `string | undefined` to an optional prop — spread the key
  conditionally instead.
- `array[i]` is `T | undefined`; guard or assert after a length check.

:::tip
The rule files themselves (`.claude/rules/*.md`) carry the full detail and the
`paths:` globs that scope each rule. This page is the human-readable digest.
:::

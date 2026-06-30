---
title: Contributing
description: Local development workflow, test commands, and repo layout for Plandeck.
---

Plandeck is a [Bun](https://bun.sh) + [Hono](https://hono.dev) backend serving a
Vite + React single-page app. The filesystem is the source of truth; there is no
database.

## Local development

```sh
bun install

# Backend serving a directory (terminal 1)
bun start <dir>

# Vite dev server with HMR (terminal 2)
bun dev
```

## Checks

```sh
bun test          # unit + component tests (bun:test + happy-dom)
bun run check     # Biome lint + format, plus tsc --noEmit
bun run build     # tsc + vite build
bun run e2e       # Playwright end-to-end (requires podman)
```

End-to-end tests run a live backend against `tests/e2e/fixtures/` inside the
official Playwright container via podman — no host browser required. E2E is
local-only; CI does not run it.

## Repo layout

| Path | Contents |
|---|---|
| `bin/plandeck.ts` | CLI entry point (citty) |
| `src/server/` | Hono app, config, discovery, search, watcher, raw serving |
| `src/client/` | React SPA — render, blocks, shell |
| `src/shared/types.ts` | Frozen contract shared by server + client |
| `scripts/` | `gen-embedded.ts`, `compile.ts` (binary build) |
| `website/` | This documentation site (Astro + Starlight) |
| `.claude/rules/` | Path-scoped conventions (see [Project conventions](/plandeck/ai-agents/conventions/)) |
| `.claude/skills/` | Agent skills, e.g. `releasing-plandeck`, `plandeck-authoring` |
| `.agents/` | Symlink → `.claude/`, so harness-agnostic agents discover the same skills/rules |
| `website/scripts/gen-agent-docs.ts` | Generates the [Recommended agent setup](/plandeck/ai-agents/agent-authoring/) page from the `plandeck-authoring` skill/rule (runs on `prebuild`) |

## CI

`ci.yml` runs check + tests + build on a Linux/macOS/Windows matrix for every
push and PR to `main`. Releases and docs deploys are separate workflows
(`release.yml`, `docs.yml`). All workflows pin `actions/checkout@v5` and
`oven-sh/setup-bun@v2`.

## Conventions

Before changing code, skim [Project conventions](/plandeck/ai-agents/conventions/) — the
server config-injection rule and the search-XSS sanitization gate in particular
are load-bearing.

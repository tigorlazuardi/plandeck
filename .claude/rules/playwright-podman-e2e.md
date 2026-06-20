---
paths: ["tests/e2e/**", "playwright.config.ts", "scripts/e2e.sh"]
---

# Playwright E2E runs in Podman (portable, host-independent)

E2E uses the **official Playwright container**, not host/nix browsers — so it runs
unchanged on any machine with podman (or docker) + bun. Do NOT use the nix-store
`PLAYWRIGHT_BROWSERS_PATH` approach here, and do NOT run `playwright install`.

## Recipe (proven on this host)

- Pin `@playwright/test` to **exactly the image tag's version**. Currently
  `@playwright/test@1.59.1` ↔ image `mcr.microsoft.com/playwright:v1.59.1-noble`.
  Bumping one without the other breaks E2E ("Executable doesn't exist").
- `bun run e2e` → `scripts/e2e.sh`:
  1. `bun run build` on the **host** (fast) → produces `dist/`.
  2. `podman run --rm -v "$PWD":/work:Z -w /work <image> npx playwright test`.
- Inside the container everything is **node/npx** (the image has node, NOT bun):
  `playwright.config.ts` `webServer.command` is `npx vite preview --port 4321`
  (not `bunx`). `vite preview` runs fine on node against bun-installed `node_modules`
  (host + container are both linux-x64).
- Browsers come from the image's default path — do NOT set `PLAYWRIGHT_BROWSERS_PATH`.
- `node_modules` is mounted from the host; the local `@playwright/test` version must
  match the image's bundled browsers (hence the version pin).

## Constraints

- Chromium only: image ships chromium; use `...devices["Desktop Chrome"]` + custom
  `viewport` for mobile emulation. No webkit/firefox device presets.
- A `vite proxy error: /api/tree ECONNREFUSED 8787` during preview is EXPECTED when no
  backend runs — the SPA renders its empty state; not a failure.
- CI: the same image runs under docker on CI runners if E2E is ever gated there; today
  CI runs `check`/`test`/`build` only and E2E is local/container.

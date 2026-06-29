import { defineConfig, devices } from "@playwright/test";

// Visual-capture config — SEPARATE from playwright.config.ts (the CI e2e suite).
// This drives tests/visual/capture.spec.ts, which only takes screenshots into
// tests/visual/screenshots/ for a human/LLM to eyeball. It is NOT run in CI.
// Run via `bun run visual` (scripts/visual.sh, podman). See skill: visual-check.
export default defineConfig({
  testDir: "tests/visual",
  // One worker + retries off — captures must be deterministic, not racing.
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:4321",
    viewport: { width: 1440, height: 900 },
    ...devices["Desktop Chrome"],
  },
});

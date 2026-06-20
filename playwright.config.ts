import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Runs INSIDE the Playwright container (see scripts/e2e.sh) via node, so use npx
  // (not bunx — the image has node, not bun). dist/ is built on the host beforehand.
  webServer: {
    command: "npx vite preview --port 4321 --host 127.0.0.1",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4321",
  },
});

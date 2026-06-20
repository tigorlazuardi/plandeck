import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bunx vite preview --port 4321",
    url: "http://localhost:4321",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:4321",
  },
});

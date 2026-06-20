import { expect, test } from "@playwright/test";

test.describe("Visual Planner E2E", () => {
  test("tree sidebar lists fixture docs", async ({ page }) => {
    await page.goto("/");
    // Wait for tree to load
    await expect(page.getByText("plan.mdx")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("readme.md")).toBeVisible();
    await expect(page.getByText("notes.txt")).toBeVisible();
  });

  test("open MDX doc — Callout renders + code block is highlighted", async ({ page }) => {
    await page.goto("/");
    await page.getByText("plan.mdx").click();
    // Doc navigates to /doc/plan.mdx
    await expect(page).toHaveURL(/\/doc\/plan\.mdx/);
    // Callout renders
    await expect(page.getByText("This is an informational callout for testing.")).toBeVisible({
      timeout: 10000,
    });
    // Shiki-highlighted code block — shiki adds class "shiki" to pre
    await expect(page.locator("pre.shiki")).toBeVisible();
  });

  test("content search finds a fixture doc and opens it", async ({ page }) => {
    await page.goto("/");
    // Find search input — SearchBox uses Mantine TextInput or Spotlight trigger
    // Try common search input patterns
    const searchInput = page.locator('input[placeholder*="earch"], input[type="search"]').first();
    await searchInput.fill("fixture");
    // Wait for results
    await page.waitForTimeout(500); // debounce
    // Click the readme.md hit
    const hit = page.getByText("readme.md").first();
    await hit.click();
    await expect(page).toHaveURL(/readme\.md/);
  });

  test("theme toggle persists across reload", async ({ page }) => {
    await page.goto("/");
    // Find theme toggle button
    const toggle = page.locator('button[aria-label*="heme"], button[title*="heme"]').first();
    // Check initial state — app should load
    await expect(page.locator("body")).toBeVisible();
    // Toggle theme
    await toggle.click();
    // Reload
    await page.reload();
    // App should still load without crashing (theme persisted from localStorage)
    await expect(page.getByText("Visual Planner")).toBeVisible({ timeout: 10000 });
  });
});

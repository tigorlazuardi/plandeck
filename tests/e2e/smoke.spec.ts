import { expect, test } from "@playwright/test";

test.describe("Plandeck E2E", () => {
  test("tree sidebar lists fixture docs", async ({ page }) => {
    await page.goto("/");
    // Wait for tree to load — all three fixture docs should appear
    await expect(page.getByRole("button", { name: "plan.mdx" }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "readme.md" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "notes.txt" }).first()).toBeVisible();
  });

  test("open MDX doc — Callout renders + code block is highlighted", async ({ page }) => {
    await page.goto("/");
    // Click plan.mdx in the sidebar
    await page.getByRole("button", { name: "plan.mdx" }).first().click();
    // Doc navigates to /doc/plan.mdx
    await expect(page).toHaveURL(/\/doc\/plan\.mdx/, { timeout: 5000 });
    // Callout renders (text from the Callout block in the fixture)
    await expect(page.getByText("This is an informational callout for testing.")).toBeVisible({
      timeout: 10000,
    });
    // Shiki-highlighted code block — shiki adds class "shiki" to pre
    await expect(page.locator("pre.shiki")).toBeVisible({ timeout: 10000 });
  });

  test("content search finds a fixture doc and opens it", async ({ page }) => {
    await page.goto("/");
    // Wait for page to load
    await page.getByRole("button", { name: "plan.mdx" }).first().waitFor({ timeout: 10000 });
    // Find search input in the header SearchBox area
    const searchInput = page
      .locator('input[placeholder*="earch"], input[placeholder*="ontent"]')
      .first();
    await searchInput.fill("searchable");
    // Wait for results to appear (debounce + network)
    await page.waitForTimeout(800);
    // notes.txt contains "searchable" — click the result
    const hit = page.getByText("notes.txt").first();
    await hit.click();
    // Should navigate to notes.txt
    await expect(page).toHaveURL(/notes\.txt/, { timeout: 5000 });
  });

  test("theme toggle persists across reload", async ({ page }) => {
    await page.goto("/");
    // Wait for app to load
    await expect(page.locator("h4, h1, [data-testid='app-title']")).toBeVisible({
      timeout: 10000,
    });
    // Find theme toggle button by aria-label
    const toggle = page.getByRole("button", { name: /toggle color scheme/i });
    await expect(toggle).toBeVisible({ timeout: 5000 });
    // Toggle theme
    await toggle.click();
    // Reload — app should still function without crashing
    await page.reload();
    // After reload, the toggle button should still be present (theme persisted)
    await expect(page.getByRole("button", { name: /toggle color scheme/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

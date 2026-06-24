import { expect, test } from "@playwright/test";

test.describe("Sidebar tree", () => {
  test("directory is collapsed by default and expands on click", async ({ page }) => {
    await page.goto("/");

    // The "guide" directory node is listed…
    const folder = page.getByText("guide", { exact: true });
    await expect(folder).toBeVisible({ timeout: 10000 });

    // …but its child is hidden until the folder is expanded.
    await expect(page.getByText("intro.md")).toBeHidden();

    await folder.click();
    await expect(page.getByText("intro.md")).toBeVisible();

    // And the nested file navigates when clicked.
    await page.getByText("intro.md").click();
    await expect(page).toHaveURL(/guide\/intro\.md/, { timeout: 5000 });
  });
});

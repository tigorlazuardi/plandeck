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

    // Nested file is indented relative to a top-level file (regression: a
    // `padding` shorthand once clobbered Mantine's indent var).
    const topBox = await page.getByText("readme.md").first().boundingBox();
    const nestedBox = await page.getByText("intro.md").boundingBox();
    expect(topBox).not.toBeNull();
    expect(nestedBox).not.toBeNull();
    expect((nestedBox?.x ?? 0) > (topBox?.x ?? 0)).toBe(true);

    // And the nested file navigates when clicked.
    await page.getByText("intro.md").click();
    await expect(page).toHaveURL(/guide\/intro\.md/, { timeout: 5000 });
  });
});

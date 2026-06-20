import { expect, test } from "@playwright/test";

test("Visual Planner loads and renders title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Visual Planner")).toBeVisible();
});

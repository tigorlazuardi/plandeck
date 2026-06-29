import { expect, test } from "@playwright/test";

test.describe("Document viewers", () => {
  test("html preview fills the viewport, not clipped at minHeight", async ({ page }) => {
    await page.goto("/");
    await page.getByText("preview.html").first().click();
    await expect(page).toHaveURL(/preview\.html/, { timeout: 10000 });

    const frame = page.locator('iframe[title="HTML document preview"]');
    await expect(frame).toBeVisible();

    // Regression: height:100% collapsed the iframe to its 400px minHeight,
    // clipping the document. It should now fill the viewport.
    const box = await frame.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(500);
  });

  test("html doc has an Export → Print / Save as PDF action", async ({ page }) => {
    await page.goto("/");
    await page.getByText("preview.html").first().click();
    await expect(page).toHaveURL(/preview\.html/, { timeout: 10000 });

    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText("Print / Save as PDF")).toBeVisible();
  });
});

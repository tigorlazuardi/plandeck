import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type PrintProbe = Window & { __printed?: boolean };

test.describe("Export", () => {
  test.beforeEach(async ({ page }) => {
    // Stub window.print so "Print / Save as PDF" is observable headlessly.
    await page.addInitScript(() => {
      const w = window as PrintProbe;
      w.__printed = false;
      window.print = () => {
        w.__printed = true;
      };
    });
    await page.goto("/");
    await page.getByText("readme.md").first().click();
    await expect(page).toHaveURL(/readme\.md/, { timeout: 10000 });
  });

  test("Export menu offers HTML and PDF", async ({ page }) => {
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText("Download HTML")).toBeVisible();
    await expect(page.getByText("Print / Save as PDF")).toBeVisible();
  });

  test("Download HTML produces a self-contained file", async ({ page }) => {
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Download HTML").click(),
    ]);
    expect(download.suggestedFilename()).toBe("readme.html");

    const path = await download.path();
    const html = readFileSync(path, "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
    // The rendered document body is embedded …
    expect(html).toContain("This is a plain markdown file");
    // … and CSS is inlined (self-contained, no external stylesheet link).
    expect(html).toContain("<style>");
    expect(html).not.toContain("<link ");
  });

  test("Print / Save as PDF triggers window.print", async ({ page }) => {
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByText("Print / Save as PDF").click();
    expect(await page.evaluate(() => (window as PrintProbe).__printed)).toBe(true);
  });
});

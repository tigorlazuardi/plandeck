import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Visual capture — screenshots only, NO assertions about pixels. Each scenario is
// shot in BOTH light and dark themes so a human/LLM reviewer can spot contrast,
// overflow, and layout regressions (e.g. unreadable text on a floating toolbar).
//
// Output: tests/visual/screenshots/<scenario>-<theme>.png (gitignored).
// Add a scenario here whenever you ship UI a human should eyeball. See the
// `visual-check` skill for the review loop.

const OUT = "tests/visual/screenshots";
const THEMES = ["light", "dark"] as const;

mkdirSync(OUT, { recursive: true });

// Theme is read from localStorage('vp-color-scheme') at module load in main.tsx,
// so it must be set BEFORE the app boots — addInitScript runs pre-navigation.
async function shoot(
  page: import("@playwright/test").Page,
  name: string,
  theme: (typeof THEMES)[number],
  prepare: (page: import("@playwright/test").Page) => Promise<void>,
) {
  await page.addInitScript((t) => {
    localStorage.setItem("vp-color-scheme", t);
  }, theme);
  await prepare(page);
  await page.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: true });
}

for (const theme of THEMES) {
  test(`home (${theme})`, async ({ page }) => {
    await shoot(page, "home", theme, async (p) => {
      await p.goto("/");
      await expect(p.getByText("plan.mdx").first()).toBeVisible({ timeout: 10000 });
    });
  });

  test(`mdx doc (${theme})`, async ({ page }) => {
    await shoot(page, "mdx-doc", theme, async (p) => {
      await p.goto("/doc/plan.mdx");
      await expect(p.locator("pre.shiki").first()).toBeVisible({ timeout: 10000 });
    });
  });

  test(`html viewer — scripts off (${theme})`, async ({ page }) => {
    await shoot(page, "html-scripts-off", theme, async (p) => {
      await p.goto("/doc/preview.html");
      // The Mantine Switch <input> is sr-only/hidden — wait on the visible iframe.
      await expect(p.locator('iframe[title="HTML document preview"]')).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test(`html viewer — scripts on (${theme})`, async ({ page }) => {
    await shoot(page, "html-scripts-on", theme, async (p) => {
      await p.goto("/doc/preview.html");
      await expect(p.locator('iframe[title="HTML document preview"]')).toBeVisible({
        timeout: 10000,
      });
      // The <input> is sr-only/off-viewport — click the visible label to toggle,
      // then assert state on the (hidden) input.
      await p.getByText("Enable scripts").click();
      await expect(p.getByRole("switch")).toBeChecked({ timeout: 5000 });
    });
  });
}

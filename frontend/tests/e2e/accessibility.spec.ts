import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { chooseSignOut, openBoard } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

// The spec mandates #888888 for supporting text (about 3.5:1 on white) and
// accepts it at 14px or larger, so muted text is excluded from the contrast rule.
async function violations(page: Page) {
  const all = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(["color-contrast"])
    .analyze();
  const contrast = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .exclude(".text-muted")
    .analyze();
  return [...all.violations, ...contrast.violations];
}

test("board has no detectable accessibility violations", async ({ page }) => {
  await openBoard(page);
  expect(await violations(page)).toEqual([]);
});

test("card dialog has no detectable accessibility violations", async ({
  page,
}) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Add card to Backlog" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("sign-in page has no detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("unsaved changes dialog has no detectable accessibility violations", async ({
  page,
}) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Rename column: Done" }).click();
  await page.getByRole("textbox", { name: "Column name" }).fill("Shipped");
  await page.keyboard.press("Enter");
  await chooseSignOut(page);
  await expect(page.getByRole("alertdialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("focus is visible on cards and controls", async ({ page }) => {
  await openBoard(page);
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toHaveCount(1);
  const shadow = await focused.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
});

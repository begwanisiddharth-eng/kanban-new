import { expect, test } from "@playwright/test";

import { cards, COLUMNS, openBoard } from "./helpers";

test("shows a single board with the five default columns", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kanban");
  for (const [i, name] of COLUMNS.entries()) {
    await expect(page.getByRole("region").nth(i)).toHaveAccessibleName(name);
  }
});

test("opens with 2-4 sample cards in every column", async ({ page }) => {
  await openBoard(page);
  for (const name of COLUMNS) {
    const count = await cards(page, name).count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
    await expect(cards(page, name).first().locator("h3")).not.toBeEmpty();
    await expect(cards(page, name).first().locator("p")).not.toBeEmpty();
  }
});

test("offers no way to add or remove columns", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole("button", { name: /column/i })).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: /^Rename column:/ }),
  ).toHaveCount(5);
});

test("is usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);
  await expect(page.getByRole("region").first()).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

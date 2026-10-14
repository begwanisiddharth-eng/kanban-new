import { expect, test } from "@playwright/test";

import { cards, COLUMNS, openBoard, signUp } from "./helpers";

test("shows a single board with the five default columns", async ({ page }) => {
  await openBoard(page);
  for (const [i, name] of COLUMNS.entries()) {
    await expect(page.getByRole("region").nth(i)).toHaveAccessibleName(name);
  }
});

test("a new user starts with one empty board", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  for (const name of COLUMNS) {
    await expect(cards(page, name)).toHaveCount(0);
  }
});

test("offers no way to add or remove columns", async ({ page }) => {
  await openBoard(page);
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

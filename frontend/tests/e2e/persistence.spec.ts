import { expect, test } from "@playwright/test";

import { cards, column, openBoard } from "./helpers";

const KEY = "kanban-board-v1";

test("saves the board to localStorage and restores it", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Add card to Backlog" }).click();
  await page.getByLabel("Title").fill("Persisted card");
  await page.getByLabel("Details").fill("Still here after reload.");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Rename column: Done" }).click();
  await page.getByRole("textbox", { name: "Column name" }).fill("Shipped");
  await page.keyboard.press("Enter");

  await page.reload();
  await expect(column(page, "Shipped")).toBeVisible();
  await expect(cards(page, "Backlog").last()).toHaveAccessibleName(
    "Persisted card",
  );
  const saved = await page.evaluate((k) => localStorage.getItem(k), KEY);
  expect(saved).toContain("Persisted card");
});

test("loads sample data when no saved board exists", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Rename column: Backlog" }).click();
  await page.getByRole("textbox", { name: "Column name" }).fill("Ideas");
  await page.keyboard.press("Enter");
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await expect(column(page, "Backlog")).toBeVisible();
  await expect(cards(page, "Backlog")).toHaveCount(3);
});

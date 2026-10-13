import { expect, test } from "@playwright/test";

import { column, openBoard, save } from "./helpers";

test("renames a column inline and keeps it after reload", async ({ page }) => {
  await openBoard(page);
  await page
    .getByRole("button", { name: "Rename column: In Progress" })
    .click();
  const input = page.getByRole("textbox", { name: "Column name" });
  await expect(input).toBeFocused();
  await input.fill("Doing");
  await input.press("Enter");
  await expect(column(page, "Doing")).toBeVisible();
  await save(page);
  await page.reload();
  await expect(column(page, "Doing")).toBeVisible();
});

test("saves a rename on blur", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Rename column: Backlog" }).click();
  await page.getByRole("textbox", { name: "Column name" }).fill("Ideas");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(column(page, "Ideas")).toBeVisible();
});

test("rejects an empty column name", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Rename column: Review" }).click();
  const input = page.getByRole("textbox", { name: "Column name" });
  await input.fill("   ");
  await input.press("Enter");
  await expect(column(page, "Review")).toBeVisible();
});

test("Escape cancels a rename", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Rename column: Done" }).click();
  const input = page.getByRole("textbox", { name: "Column name" });
  await input.fill("Finished");
  await input.press("Escape");
  await expect(column(page, "Done")).toBeVisible();
});

test("renames a column using only the keyboard", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Rename column: To Do" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Next up");
  await page.keyboard.press("Enter");
  await expect(column(page, "Next up")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rename column: Next up" }),
  ).toBeFocused();
});

import { expect, test } from "@playwright/test";

import { cards, column, deleteCard, openBoard } from "./helpers";

test("adds a card to the bottom of a column", async ({ page }) => {
  await openBoard(page);
  const before = await cards(page, "Review").count();
  await page.getByRole("button", { name: "Add card to Review" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await dialog.getByLabel("Title").fill("Security review");
  await dialog
    .getByLabel("Details")
    .fill("Check auth flows\nand session handling.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(cards(page, "Review")).toHaveCount(before + 1);
  await expect(cards(page, "Review").last()).toHaveAccessibleName(
    "Security review",
  );
  await expect(cards(page, "Review").last()).toContainText(
    "and session handling.",
  );
});

test("cannot save a card with a blank title or details", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Add card to Backlog" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Title").fill("Only a title");
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Title").press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Details").fill("   ");
  await expect(save).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(cards(page, "Backlog")).toHaveCount(3);
});

test("edits a card and cannot blank it out", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("listitem", { name: "Redesign pricing page" }).hover();
  await page
    .getByRole("button", { name: "Edit card: Redesign pricing page" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit card" });
  await expect(dialog.getByLabel("Title")).toHaveValue("Redesign pricing page");
  await dialog.getByLabel("Title").fill("");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await dialog.getByLabel("Title").fill("Pricing page v2");
  await dialog.getByLabel("Details").fill("Ship the new comparison table.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(cards(page, "In Progress").first()).toHaveAccessibleName(
    "Pricing page v2",
  );
  await expect(cards(page, "In Progress").first()).toContainText(
    "Ship the new comparison table.",
  );
});

test("deletes a card only after confirmation", async ({ page }) => {
  await openBoard(page);
  const name = "Fix timezone bug in reports";
  await page.getByRole("listitem", { name }).hover();
  await page.getByRole("button", { name: `Delete card: ${name}` }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(name);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("listitem", { name })).toBeVisible();

  await deleteCard(page, name);
  await expect(page.getByRole("listitem", { name })).toHaveCount(0);
  await expect(cards(page, "Done")).toHaveCount(2);
});

test("long titles and details wrap inside the card", async ({ page }) => {
  await openBoard(page);
  const longWord = "Supercalifragilistic".repeat(6);
  await page.getByRole("button", { name: "Add card to To Do" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(`Long ${longWord}`);
  await dialog.getByLabel("Details").fill(`Details ${longWord} ${longWord}`);
  await dialog.getByRole("button", { name: "Save" }).click();
  const card = cards(page, "To Do").last();
  const fits = await card.evaluate((el) =>
    [...el.querySelectorAll("h3, p")].every(
      (t) => t.scrollWidth <= t.clientWidth,
    ),
  );
  expect(fits).toBe(true);
  const cardBox = (await card.boundingBox())!;
  const colBox = (await column(page, "To Do").boundingBox())!;
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
    colBox.x + colBox.width,
  );
});

test("adds and deletes a card using only the keyboard", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Add card to Done" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Keyboard card");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Created without a mouse");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const card = page.getByRole("listitem", { name: "Keyboard card" });
  await expect(card).toBeVisible();

  const remove = page.getByRole("button", {
    name: "Delete card: Keyboard card",
  });
  await remove.focus();
  await expect(remove).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(card).toHaveCount(0);
});

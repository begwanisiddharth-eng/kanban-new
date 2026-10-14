import { expect, test } from "@playwright/test";

import {
  cards,
  column,
  openBoard,
  save,
  signIn,
  signUp,
  signOut,
} from "./helpers";

const switcher = (page: import("@playwright/test").Page) =>
  page.getByRole("combobox", { name: "Current board" });

async function createBoard(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByRole("button", { name: "New board" }).click();
  const dialog = page.getByRole("dialog", { name: "New board" });
  await expect(
    dialog.getByRole("button", { name: "Create board" }),
  ).toBeDisabled();
  await dialog.getByLabel("Board name").fill(name);
  await dialog.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

async function switchTo(page: import("@playwright/test").Page, name: string) {
  await switcher(page).click();
  await page.getByRole("option", { name }).click();
}

test("creates a new empty board and switches between boards", async ({
  page,
}) => {
  await openBoard(page);
  await createBoard(page, "Marketing");
  await expect(cards(page, "Backlog")).toHaveCount(0);
  await expect(switcher(page)).toHaveText("Marketing");

  await switchTo(page, "My board");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  await expect(cards(page, "Backlog")).toHaveCount(3);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
});

test("reopens the board that was open before a reload", async ({ page }) => {
  await signUp(page);
  await createBoard(page, "Second");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second");
});

test("allows at most three boards", async ({ page }) => {
  await signUp(page);
  await createBoard(page, "Two");
  await createBoard(page, "Three");
  await expect(page.getByRole("button", { name: "New board" })).toBeDisabled();
  await switcher(page).click();
  await expect(page.getByText("3 of 3 boards")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(3);
});

test("deletes a board after confirmation but never the only one", async ({
  page,
}) => {
  await signUp(page);
  const remove = page.getByRole("button", { name: "Delete board" });
  await expect(remove).toBeDisabled();

  await createBoard(page, "Temporary");
  await remove.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Temporary");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Temporary");

  await remove.click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete board" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  await expect(remove).toBeDisabled();
  await switcher(page).click();
  await expect(page.getByRole("option")).toHaveCount(1);
});

test("each user sees only their own boards", async ({ page, browser }) => {
  const owner = await openBoard(page);
  await createBoard(page, "Private plans");

  const other = await browser.newPage();
  await signUp(other);
  await expect(cards(other, "Backlog")).toHaveCount(0);
  await other.getByRole("combobox", { name: "Current board" }).click();
  await expect(other.getByRole("option")).toHaveText(["My board"]);
  await other.close();

  await signOut(page);
  await signIn(page, owner);
  await expect(cards(page, "Backlog")).toHaveCount(3);
});

test("board data persists across sign out and sign in", async ({ page }) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Add card to Review" }).click();
  await page.getByLabel("Title").fill("Saved card");
  await page.getByLabel("Details").fill("Kept on the server.");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await save(page);
  await signOut(page);
  await signIn(page, email);
  await expect(
    column(page, "Review").getByRole("listitem"),
  ).toHaveAccessibleName("Saved card");
});

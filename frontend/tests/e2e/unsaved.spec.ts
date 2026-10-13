import { expect, test, type Page } from "@playwright/test";

import {
  cards,
  chooseSignOut,
  column,
  openBoard,
  save,
  saveButton,
} from "./helpers";

const discardButton = (page: Page) =>
  page.getByRole("button", { name: "Discard changes" });

async function makeChange(page: Page, name = "Shipped") {
  await page
    .getByRole("button", { name: /^Rename column: / })
    .last()
    .click();
  const input = page.getByRole("textbox", { name: "Column name" });
  await input.fill(name);
  await input.press("Enter");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
}

async function createSecondBoard(page: Page) {
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Board name").fill("Second");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second");
}

async function switchTo(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Current board" }).click();
  await page.getByRole("option", { name }).click();
}

const unsavedDialog = (page: Page) =>
  page.getByRole("alertdialog", { name: "Save your changes?" });

test("Save and Discard are enabled only with unsaved changes", async ({
  page,
}) => {
  await openBoard(page);
  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
  await expect(discardButton(page)).toBeDisabled();

  await makeChange(page);
  await expect(saveButton(page)).toBeEnabled();
  await expect(discardButton(page)).toBeEnabled();

  await save(page);
  await expect(saveButton(page)).toBeDisabled();
  await page.reload();
  await expect(column(page, "Shipped")).toBeVisible();
});

test("every kind of edit counts as an unsaved change", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Add card to Done" }).click();
  await page.getByLabel("Title").fill("New");
  await page.getByLabel("Details").fill("Card");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(saveButton(page)).toBeEnabled();
  await save(page);

  const name = "Fix timezone bug in reports";
  await page.getByRole("listitem", { name }).hover();
  await page.getByRole("button", { name: `Delete card: ${name}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(saveButton(page)).toBeEnabled();
});

test("Discard changes restores the last saved board", async ({ page }) => {
  await openBoard(page);
  await makeChange(page);
  await discardButton(page).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(column(page, "Shipped")).toBeVisible();

  await discardButton(page).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(column(page, "Done")).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
});

test("switching boards with unsaved changes asks first", async ({ page }) => {
  await openBoard(page);
  await createSecondBoard(page);
  await switchTo(page, "My board");
  await makeChange(page);

  await switchTo(page, "Second");
  await expect(unsavedDialog(page)).toContainText("My board");
  await unsavedDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  await expect(column(page, "Shipped")).toBeVisible();

  await switchTo(page, "Second");
  await unsavedDialog(page)
    .getByRole("button", { name: "Discard changes" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second");
  await switchTo(page, "My board");
  await expect(column(page, "Done")).toBeVisible();

  await makeChange(page, "Released");
  await switchTo(page, "Second");
  await unsavedDialog(page)
    .getByRole("button", { name: "Save and continue" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second");
  await switchTo(page, "My board");
  await expect(column(page, "Released")).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
});

test("creating a board with unsaved changes asks first", async ({ page }) => {
  await openBoard(page);
  await makeChange(page);
  await page.getByRole("button", { name: "New board" }).click();
  await unsavedDialog(page)
    .getByRole("button", { name: "Save and continue" })
    .click();
  await expect(page.getByRole("dialog", { name: "New board" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(column(page, "Shipped")).toBeVisible();
});

test("signing out with unsaved changes asks first", async ({ page }) => {
  await openBoard(page);
  await makeChange(page);
  await chooseSignOut(page);
  await unsavedDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(page).not.toHaveURL(/signin/);

  await chooseSignOut(page);
  await unsavedDialog(page)
    .getByRole("button", { name: "Discard changes" })
    .click();
  await expect(page).toHaveURL(/\/signin$/);
});

test("reloading with unsaved changes shows the browser warning", async ({
  page,
}) => {
  await openBoard(page);
  await makeChange(page);

  const stay = page.waitForEvent("dialog");
  void page.reload().catch(() => {});
  const warning = await stay;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  await expect(column(page, "Shipped")).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(column(page, "Done")).toBeVisible();
  await expect(cards(page, "Done")).toHaveCount(3);
});

test("no warning on reload once changes are saved", async ({ page }) => {
  await openBoard(page);
  await makeChange(page);
  await save(page);
  let warned = false;
  page.on("dialog", (dialog) => {
    warned = true;
    void dialog.accept();
  });
  await page.reload();
  await expect(column(page, "Shipped")).toBeVisible();
  expect(warned).toBe(false);
});

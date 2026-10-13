import { expect, test, type Page } from "@playwright/test";

import {
  cards,
  column,
  openBoard,
  PASSWORD,
  signIn,
  signOut,
  signUp,
} from "./helpers";

async function trySignIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("an account can be signed in in only one place at a time", async ({
  page,
  browser,
}) => {
  const email = await signUp(page);
  const other = await (await browser.newContext()).newPage();
  await trySignIn(other, email);
  await expect(
    other.getByText(/already signed in somewhere else/),
  ).toBeVisible();
  await expect(other).toHaveURL(/\/signin$/);

  await signOut(page);
  await signIn(other, email);
  await expect(other.getByRole("heading", { level: 1 })).toHaveText("My board");
  await other.context().close();
});

test("a user can change their password", async ({ page }) => {
  const email = await signUp(page);
  const open = async () => {
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Change password" }).click();
  };
  const dialog = page.getByRole("dialog", { name: "Change password" });
  const fill = async (current: string, next: string, confirm: string) => {
    await dialog.getByLabel("Current password").fill(current);
    await dialog.getByLabel("New password", { exact: true }).fill(next);
    await dialog.getByLabel("Confirm new password").fill(confirm);
    await dialog.getByRole("button", { name: "Change password" }).click();
  };

  await open();
  await fill("not-my-password", "brand-new-pass", "brand-new-pass");
  await expect(dialog.getByRole("alert")).toHaveText(
    "Your current password is incorrect.",
  );
  await fill(PASSWORD, "brand-new-pass", "different-pass");
  await expect(dialog.getByRole("alert")).toHaveText(
    "The new passwords do not match.",
  );
  await fill(PASSWORD, "brand-new-pass", "brand-new-pass");
  await expect(dialog).toContainText("Your password has been changed.");
  await dialog.getByRole("button", { name: "Done" }).click();

  await signOut(page);
  await trySignIn(page, email);
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await trySignIn(page, email, "brand-new-pass");
  await expect(page.getByRole("region")).toHaveCount(5);
});

test.describe("inactivity", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  test("warns at 18 minutes and signs out at 20", async ({ page }) => {
    await openBoard(page);
    await page.getByRole("button", { name: "Rename column: Done" }).click();
    await page.getByRole("textbox", { name: "Column name" }).fill("Shipped");
    await page.keyboard.press("Enter");

    await page.clock.runFor("17:50");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await page.clock.runFor("00:15");
    const warning = page.getByRole("alertdialog", {
      name: "Are you still there?",
    });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Your unsaved changes will be lost.");

    await page.clock.runFor("02:00");
    await expect(page).toHaveURL(/\/signin\?reason=timeout$/);
    await expect(
      page.getByText("You were signed out after 20 minutes of inactivity."),
    ).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/signin$/);
  });

  test("Stay signed in keeps the session and the changes", async ({ page }) => {
    await openBoard(page);
    await page.getByRole("button", { name: "Rename column: Done" }).click();
    await page.getByRole("textbox", { name: "Column name" }).fill("Shipped");
    await page.keyboard.press("Enter");
    await page.clock.runFor("18:30");
    await page.getByRole("button", { name: "Stay signed in" }).click();
    await page.clock.runFor("17:00");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(column(page, "Shipped")).toBeVisible();
  });

  test("activity keeps the user signed in", async ({ page }) => {
    await openBoard(page);
    for (let minute = 0; minute < 25; minute++) {
      await page.clock.runFor("01:00");
      await page.mouse.move(200 + minute, 300);
    }
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(cards(page, "Backlog")).toHaveCount(3);
    await page.reload();
    await expect(page.getByRole("region")).toHaveCount(5);
  });
});

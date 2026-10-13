import { expect, test } from "@playwright/test";

import { PASSWORD, signIn, signUp, uniqueEmail, signOut } from "./helpers";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a new user can sign up and lands on their board", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await signUp(page);
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
});

test("sign up rejects an email that is already registered", async ({
  page,
}) => {
  const email = await signUp(page);
  await signOut(page);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("An account with this email already exists."),
  ).toBeVisible();
});

test("sign up requires a password of at least 8 characters", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  expect(
    await page
      .getByLabel("Password")
      .evaluate((el: HTMLInputElement) => el.validity.tooShort),
  ).toBe(true);
});

test("an existing user can sign out and sign back in", async ({ page }) => {
  const email = await signUp(page);
  await signOut(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();

  await signIn(page, email);
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menu")).toContainText(email);
});

test("signed-in users skip the sign-in page", async ({ page }) => {
  await signUp(page);
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByRole("region")).toHaveCount(5);
});

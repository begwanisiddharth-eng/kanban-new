import { expect, type Locator, type Page } from "@playwright/test";

import { sampleBoardData } from "../fixtures/sampleBoard";

export const COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"];

let counter = 0;

export const uniqueEmail = () =>
  `user-${Date.now()}-${process.pid}-${++counter}@example.com`;

export const PASSWORD = "password123";

/** Signs up a new user, who lands on their empty first board. */
export async function signUp(page: Page, email = uniqueEmail()) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("region")).toHaveCount(5);
  return email;
}

export async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("region")).toHaveCount(5);
}

/** Signs up a new user whose first board is saved with the sample cards. */
export async function openBoard(page: Page) {
  const email = await signUp(page);
  const [board] = await (await page.request.get("/api/boards")).json();
  const res = await page.request.put(`/api/boards/${board.id}`, {
    data: sampleBoardData(),
  });
  expect(res.status()).toBe(204);
  await page.reload();
  await expect(page.getByRole("region")).toHaveCount(5);
  return email;
}

export const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Save", exact: true });

export async function save(page: Page) {
  await saveButton(page).click();
  await expect(page.getByText("All changes saved")).toBeVisible();
}

export const column = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

export const cards = (page: Page, columnName: string) =>
  column(page, columnName).getByRole("listitem");

export async function cardTitles(page: Page, columnName: string) {
  return cards(page, columnName).evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label")),
  );
}

export async function deleteCard(page: Page, name: string) {
  await page.getByRole("listitem", { name }).hover();
  await page.getByRole("button", { name: `Delete card: ${name}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
}

export async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  offsetY = 0,
) {
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  const x = to.x + to.width / 2;
  const y = to.y + to.height / 2 + offsetY;
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + 40, { steps: 5 });
  await page.mouse.move(x, y, { steps: 20 });
  await page.mouse.move(x, y + 2, { steps: 2 });
  await page.mouse.up();
}

export async function keyboardMove(page: Page, card: Locator, key: string) {
  await card.focus();
  await page.keyboard.press("Space");
  const live = page.locator("[id^=DndLiveRegion]");
  await expect(live).toContainText("Picked up card");
  await page.keyboard.press(key);
  await expect(live).toContainText("moved to");
}

/** Opens the account menu and chooses Sign out (no unsaved-changes prompt expected). */
export async function chooseSignOut(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
}

export async function signOut(page: Page) {
  await chooseSignOut(page);
  await expect(page).toHaveURL(/\/signin$/);
}

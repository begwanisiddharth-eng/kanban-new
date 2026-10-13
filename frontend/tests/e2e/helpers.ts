import { expect, type Locator, type Page } from "@playwright/test";

export const COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"];

export async function openBoard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("region")).toHaveCount(5);
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

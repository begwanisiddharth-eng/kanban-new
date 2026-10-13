import { expect, test } from "@playwright/test";

import {
  cards,
  cardTitles,
  column,
  deleteCard,
  drag,
  keyboardMove,
  openBoard,
  save,
} from "./helpers";

// Large enough that every sample card is visible without scrolling a column.
test.use({ viewport: { width: 1920, height: 1080 } });

test("reorders a card within its column", async ({ page }) => {
  await openBoard(page);
  const [first, second, third] = await cardTitles(page, "Backlog");
  await drag(
    page,
    cards(page, "Backlog").nth(0),
    cards(page, "Backlog").nth(2),
    10,
  );
  await expect
    .poll(() => cardTitles(page, "Backlog"))
    .toEqual([second, third, first]);
});

test("moves a card to a position in another column", async ({ page }) => {
  await openBoard(page);
  const [moved] = await cardTitles(page, "Backlog");
  const [a, b] = await cardTitles(page, "Review");
  await drag(
    page,
    cards(page, "Backlog").first(),
    cards(page, "Review").nth(1),
    -20,
  );
  await expect.poll(() => cardTitles(page, "Review")).toEqual([a, moved, b]);
  await expect(cards(page, "Backlog")).toHaveCount(2);
});

test("drops a card into an empty column", async ({ page }) => {
  await openBoard(page);
  for (const name of await cardTitles(page, "In Progress")) {
    await deleteCard(page, name!);
  }
  await expect(cards(page, "In Progress")).toHaveCount(0);
  const [moved] = await cardTitles(page, "To Do");
  await drag(page, cards(page, "To Do").first(), column(page, "In Progress"));
  await expect.poll(() => cardTitles(page, "In Progress")).toEqual([moved]);
});

test("moves a card to another column with the keyboard", async ({ page }) => {
  await openBoard(page);
  const [moved] = await cardTitles(page, "To Do");
  await keyboardMove(page, cards(page, "To Do").first(), "ArrowRight");
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await cardTitles(page, "In Progress")).includes(moved))
    .toBe(true);
  await expect(cards(page, "To Do")).toHaveCount(2);
});

test("reorders a card with the keyboard", async ({ page }) => {
  await openBoard(page);
  const [first, second] = await cardTitles(page, "Done");
  await keyboardMove(page, cards(page, "Done").first(), "ArrowDown");
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await cardTitles(page, "Done")).slice(0, 2))
    .toEqual([second, first]);
});

test("Escape cancels a keyboard drag", async ({ page }) => {
  await openBoard(page);
  const before = await cardTitles(page, "To Do");
  await keyboardMove(page, cards(page, "To Do").first(), "ArrowRight");
  await page.keyboard.press("Escape");
  await expect.poll(() => cardTitles(page, "To Do")).toEqual(before);
});

test("saved card order survives a reload", async ({ page }) => {
  await openBoard(page);
  await drag(
    page,
    cards(page, "Done").first(),
    cards(page, "Backlog").first(),
    -20,
  );
  await expect(cards(page, "Backlog")).toHaveCount(4);
  const backlog = await cardTitles(page, "Backlog");
  const done = await cardTitles(page, "Done");
  await save(page);
  await page.reload();
  await expect.poll(() => cardTitles(page, "Backlog")).toEqual(backlog);
  expect(await cardTitles(page, "Done")).toEqual(done);
});

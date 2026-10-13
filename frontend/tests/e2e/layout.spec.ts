import { expect, test, type Page } from "@playwright/test";

import { cards, column, COLUMNS, openBoard } from "./helpers";

const box = async (page: Page, selector: ReturnType<Page["locator"]>) =>
  (await selector.boundingBox())!;

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
]) {
  test(`columns and assistant share one row at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openBoard(page);
    const chat = await box(
      page,
      page.getByRole("complementary", { name: "Board assistant" }),
    );
    const columns = await Promise.all(
      COLUMNS.map((name) => box(page, column(page, name))),
    );
    for (const c of columns) {
      expect(c.y).toBeCloseTo(columns[0].y, 0);
      expect(c.height).toBeCloseTo(columns[0].height, 0);
    }
    expect(chat.x).toBeGreaterThanOrEqual(columns[4].x + columns[4].width);
    expect(chat.y).toBeCloseTo(columns[0].y, 0);
    expect(chat.x + chat.width).toBeLessThanOrEqual(viewport.width);
    expect(chat.height / columns[0].height).toBeCloseTo(0.75, 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("columns keep their height however many cards they hold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openBoard(page);
  const height = async (name: string) =>
    (await box(page, column(page, name))).height;
  const before = await height("Backlog");
  for (let i = 1; i <= 6; i++) {
    await page.getByRole("button", { name: "Add card to Backlog" }).click();
    await page.getByLabel("Title").fill(`Extra card ${i}`);
    await page.getByLabel("Details").fill("Filler");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save" })
      .click();
  }
  await expect(cards(page, "Backlog")).toHaveCount(9);
  expect(await height("Backlog")).toBeCloseTo(before, 0);
  expect(await height("In Progress")).toBeCloseTo(before, 0);

  const last = cards(page, "Backlog").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test("every card has the same height", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Add card to Done" }).click();
  await page.getByLabel("Title").fill("Short");
  await page.getByLabel("Details").fill("x");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Add card to Done" }).click();
  await page.getByLabel("Title").fill("A very long title ".repeat(8));
  await page.getByLabel("Details").fill("Long details text. ".repeat(30));
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(cards(page, "Done")).toHaveCount(5);
  const heights = await page
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map((li) => li.getBoundingClientRect().height),
    );
  expect(new Set(heights).size).toBe(1);
});

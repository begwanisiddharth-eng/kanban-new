import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  cards,
  cardTitles,
  column,
  drag,
  openBoard,
  save,
  scriptModel,
  uniqueMessage,
} from "./helpers";

// Adding and removing columns: a board keeps between one and five.

const regions = (page: Page) => page.getByRole("region");
const removeButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `Remove column: ${name}` });
const addTile = (page: Page) =>
  page.getByRole("button", { name: "Add column", exact: true });

async function removeColumn(page: Page, name: string) {
  await removeButton(page, name).click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false))
    await dialog.getByRole("button", { name: "Remove column" }).click();
  await expect(column(page, name)).toHaveCount(0);
}

async function addColumn(page: Page, name: string) {
  await addTile(page).click();
  await page.getByLabel("Column name").fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add column" })
    .click();
  await expect(column(page, name)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test("removes a column and its cards after confirming, then saves", async ({
  page,
}) => {
  await removeButton(page, "Review").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(
    '"Review" and its 2 cards will be removed.',
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(regions(page)).toHaveCount(5);

  await removeColumn(page, "Review");
  await expect(regions(page)).toHaveCount(4);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await save(page);
  await page.reload();
  await expect(regions(page)).toHaveCount(4);
  await expect(column(page, "Review")).toHaveCount(0);
  await expect(
    page.getByRole("listitem", { name: "Password reset email template" }),
  ).toHaveCount(0);
});

test("Discard brings a removed column back", async ({ page }) => {
  await removeColumn(page, "Done");
  await page.getByRole("button", { name: "Discard changes" }).click();
  const confirm = page.getByRole("alertdialog");
  if (await confirm.isVisible().catch(() => false))
    await confirm.getByRole("button", { name: /discard/i }).click();
  await expect(regions(page)).toHaveCount(5);
  await expect.poll(() => cardTitles(page, "Done")).toHaveLength(3);
});

test("keeps at least one column", async ({ page }) => {
  for (const name of ["Backlog", "To Do", "In Progress", "Review"])
    await removeColumn(page, name);
  await expect(regions(page)).toHaveCount(1);
  await expect(removeButton(page, "Done")).toBeDisabled();
  await save(page);
});

test("adds an empty column at the end, up to five, and saves it", async ({
  page,
}) => {
  await expect(addTile(page)).toHaveCount(0);
  await removeColumn(page, "Review");
  await addColumn(page, "Blocked");
  await expect(cards(page, "Blocked")).toHaveCount(0);
  await expect(regions(page).last()).toHaveAccessibleName("Blocked");
  await expect(addTile(page)).toHaveCount(0);

  await save(page);
  await page.reload();
  await expect(regions(page).last()).toHaveAccessibleName("Blocked");
  await expect(regions(page)).toHaveCount(5);
});

test("the new column dialog needs a name of at most 60 characters", async ({
  page,
}) => {
  await removeColumn(page, "Review");
  await addTile(page).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Add column" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Column name").fill("   ");
  await expect(submit).toBeDisabled();
  await page.getByLabel("Column name").fill("x".repeat(80));
  await expect(page.getByLabel("Column name")).toHaveValue("x".repeat(60));
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(regions(page)).toHaveCount(4);
});

test("cards can be added to and dragged into a new column", async ({
  page,
}) => {
  await removeColumn(page, "Review");
  await addColumn(page, "Blocked");
  await page.getByRole("button", { name: "Add card to Blocked" }).click();
  await page.getByLabel("Title").fill("Waiting on legal");
  await page.getByLabel("Details").fill("Contract review pending.");
  await page
    .getByRole("button", { name: /save|add/i })
    .last()
    .click();
  await expect(cards(page, "Blocked")).toHaveCount(1);

  await drag(
    page,
    page.getByRole("listitem", { name: "Redesign pricing page" }),
    column(page, "Blocked"),
  );
  await expect
    .poll(() => cardTitles(page, "Blocked"))
    .toContain("Redesign pricing page");
  await save(page);
  await page.reload();
  await expect.poll(() => cardTitles(page, "Blocked")).toHaveLength(2);
});

test("a new column can be renamed and removed again", async ({ page }) => {
  await removeColumn(page, "Review");
  await addColumn(page, "Blocked");
  await page.getByRole("button", { name: "Rename column: Blocked" }).click();
  await page.getByRole("textbox", { name: "Column name" }).fill("On hold");
  await page.keyboard.press("Enter");
  await expect(column(page, "On hold")).toBeVisible();
  await removeColumn(page, "On hold");
  await expect(regions(page)).toHaveCount(4);
});

test("renaming a column is capped at 60 characters", async ({ page }) => {
  await page.getByRole("button", { name: "Rename column: To Do" }).click();
  await page.getByRole("textbox", { name: "Column name" }).fill("y".repeat(70));
  await page.keyboard.press("Enter");
  await expect(column(page, "y".repeat(60))).toBeVisible();
  await save(page);
});

test("the API keeps one to five unique columns", async ({ page }) => {
  const [board] = await (await page.request.get("/api/boards")).json();
  const { data } = await (
    await page.request.get(`/api/boards/${board.id}`)
  ).json();
  const put = (body: unknown) =>
    page.request.put(`/api/boards/${board.id}`, { data: body });
  expect((await put({ columns: [], cards: {} })).status()).toBe(400);
  const sixth = { id: "extra", name: "Extra", cardIds: [] };
  expect(
    (await put({ ...data, columns: [...data.columns, sixth] })).status(),
  ).toBe(400);
  const duplicate = [...data.columns];
  duplicate[1] = { ...duplicate[1], id: duplicate[0].id };
  expect((await put({ ...data, columns: duplicate })).status()).toBe(400);
  const one = {
    columns: [{ id: "only", name: "Only", cardIds: [] }],
    cards: {},
  };
  expect((await put(one)).status()).toBe(204);
});

test("the assistant removes and adds columns", async ({ page }) => {
  const message = uniqueMessage("Replace Review with Blocked");
  await scriptModel(page, message, [
    {
      content: {
        reply: "Replaced Review with Blocked.",
        actions: [
          { type: "move_card", cardId: "review-1", columnId: "done" },
          { type: "remove_column", columnId: "review" },
          { type: "add_column", name: "Blocked" },
          {
            type: "add_card",
            columnId: "Blocked",
            title: "Waiting on legal",
            details: "Contract review pending.",
          },
          { type: "add_column", name: "One too many" },
        ],
      },
    },
  ]);
  const box = page.getByRole("textbox", { name: "Message the assistant" });
  await box.fill(message);
  await box.press("Enter");
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByRole("listitem")).toHaveText([
    'Moved "Password reset email template" to Done',
    "Removed column Review and its card",
    "Added column Blocked",
    'Added "Waiting on legal" to Blocked',
    "Not saved yet. Use Save to keep these changes.",
  ]);
  await expect(log).toContainText("1 requested change could not be applied");
  await expect(regions(page).last()).toHaveAccessibleName("Blocked");
  await expect
    .poll(() => cardTitles(page, "Blocked"))
    .toEqual(["Waiting on legal"]);
  await save(page);
  await page.reload();
  await expect(regions(page).last()).toHaveAccessibleName("Blocked");
});

test("layout holds with fewer columns", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await removeColumn(page, "Review");
  await removeColumn(page, "Done");
  const panel = page.getByRole("complementary", { name: "Board assistant" });
  const first = (await column(page, "Backlog").boundingBox())!;
  const aside = (await panel.boundingBox())!;
  const tile = (await addTile(page).boundingBox())!;
  expect(Math.abs(aside.y - first.y)).toBeLessThan(2);
  expect(tile.x + tile.width).toBeLessThanOrEqual(aside.x);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// As in accessibility.spec.ts: muted text (#888888) is mandated by the spec
// and excluded from the contrast rule only.
async function violations(page: Page) {
  const tags = ["wcag2a", "wcag2aa", "wcag21aa"];
  const all = await new AxeBuilder({ page })
    .withTags(tags)
    .disableRules(["color-contrast"])
    .analyze();
  const contrast = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .exclude(".text-muted")
    .analyze();
  return [...all.violations, ...contrast.violations];
}

test("column controls have no accessibility violations", async ({ page }) => {
  await removeColumn(page, "Review");
  expect(await violations(page)).toEqual([]);
  await removeButton(page, "Done").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await addTile(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

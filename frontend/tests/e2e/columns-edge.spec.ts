import { expect, test, type Page } from "@playwright/test";

import {
  cardTitles,
  column,
  keyboardMove,
  modelCalls,
  openBoard,
  save,
  scriptModel,
  uniqueMessage,
  type ModelStep,
} from "./helpers";

// Edge cases around adding and removing columns.

const regions = (page: Page) => page.getByRole("region");
const removeButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `Remove column: ${name}` });
const addTile = (page: Page) =>
  page.getByRole("button", { name: "Add column", exact: true });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function removeColumn(page: Page, name: string) {
  await removeButton(page, name).click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false))
    await dialog.getByRole("button", { name: "Remove column" }).click();
  await expect(column(page, name)).toHaveCount(0);
}

async function askScripted(page: Page, text: string, responses: ModelStep[]) {
  const message = uniqueMessage(text);
  await scriptModel(page, message, responses);
  const box = page.getByRole("textbox", { name: "Message the assistant" });
  await box.fill(message);
  await box.press("Enter");
  return message;
}

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test("removing a column by keyboard keeps focus on the board", async ({
  page,
}) => {
  await removeButton(page, "Review").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter"); // "Remove column" follows "Cancel"
  await expect(column(page, "Review")).toHaveCount(0);
  // Focus moves to the column that took its place.
  await expect(removeButton(page, "Done")).toBeFocused();
  // An empty column goes at once, and focus moves on again.
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  await page.getByLabel("Column name").fill("Empty");
  await page.keyboard.press("Enter");
  // Focus settles on the new column's title first.
  await expect(
    page.getByRole("button", { name: "Rename column: Empty" }),
  ).toBeFocused();
  await removeButton(page, "Empty").focus();
  await page.keyboard.press("Enter");
  await expect(column(page, "Empty")).toHaveCount(0);
  await expect(removeButton(page, "Done")).toBeFocused();
});

test("adding the fifth column by keyboard keeps focus on the board", async ({
  page,
}) => {
  await removeColumn(page, "Review");
  // Focus settles on the neighbouring column first.
  await expect(removeButton(page, "Done")).toBeFocused();
  await addTile(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Column name")).toBeFocused();
  await page.keyboard.type("Blocked");
  await page.keyboard.press("Enter");
  await expect(column(page, "Blocked")).toBeVisible();
  await expect(addTile(page)).toHaveCount(0);
  // The tile is gone, so focus moves to the new column's title.
  await expect(
    page.getByRole("button", { name: "Rename column: Blocked" }),
  ).toBeFocused();
});

test("cards move into a new column by keyboard", async ({ page }) => {
  await removeColumn(page, "Done");
  await addTile(page).click();
  await page.getByLabel("Column name").fill("Shipped");
  await page.keyboard.press("Enter");
  const card = page.getByRole("listitem", {
    name: "Password reset email template",
  });
  await keyboardMove(page, card, "ArrowRight");
  await page.keyboard.press("Space");
  await expect
    .poll(() => cardTitles(page, "Shipped"))
    .toEqual(["Password reset email template"]);
});

test("a one-column board works end to end", async ({ page }) => {
  for (const name of ["Backlog", "To Do", "In Progress", "Review"])
    await removeColumn(page, name);
  await save(page);
  await page.reload();
  await expect(regions(page)).toHaveCount(1);
  const message = await askScripted(page, "Add one", [
    {
      content: {
        reply: "Added.",
        actions: [
          {
            type: "add_card",
            columnId: "done",
            title: "Solo",
            details: "Only column.",
          },
          { type: "remove_column", columnId: "done" },
        ],
      },
    },
  ]);
  await expect(log(page)).toContainText('Added "Solo" to Done');
  await expect(log(page)).toContainText(
    "1 requested change could not be applied",
  );
  await expect(regions(page)).toHaveCount(1);
  const [call] = await modelCalls(page, message);
  const board = JSON.parse(call.messages[0].content.split("Board:\n")[1]);
  expect(board.columns).toHaveLength(1);
});

test("switching boards after removing a column asks first", async ({
  page,
}) => {
  await removeColumn(page, "Review");
  await page.getByRole("button", { name: "New board" }).click();
  await expect(
    page.getByRole("alertdialog").or(page.getByRole("dialog")),
  ).toContainText(/unsaved/i);
});

test("a column removed and re-added with the same name is a new column", async ({
  page,
}) => {
  await removeColumn(page, "Review");
  await addTile(page).click();
  await page.getByLabel("Column name").fill("Review");
  await page.keyboard.press("Enter");
  await expect(column(page, "Review")).toBeVisible();
  await expect(regions(page).last()).toHaveAccessibleName("Review");
  await expect.poll(() => cardTitles(page, "Review")).toEqual([]);
  await save(page);
  const [board] = await (await page.request.get("/api/boards")).json();
  const { data } = await (
    await page.request.get(`/api/boards/${board.id}`)
  ).json();
  expect(data.columns.at(-1).id).not.toBe("review");
  expect(Object.keys(data.cards)).toHaveLength(11);
});

test("the assistant cannot go past five columns or below one", async ({
  page,
}) => {
  await askScripted(page, "Add two columns", [
    {
      content: {
        reply: "Done.",
        actions: [
          { type: "add_column", name: "Blocked" },
          { type: "remove_column", columnId: "review" },
          { type: "add_column", name: "Blocked" },
        ],
      },
    },
  ]);
  await expect(log(page)).toContainText(
    "Removed column Review and its 2 cards",
  );
  await expect(log(page)).toContainText("Added column Blocked");
  await expect(log(page)).toContainText(
    "1 requested change could not be applied",
  );
  await expect(regions(page)).toHaveCount(5);
});

test("a late reply naming a column the user removed skips it", async ({
  page,
}) => {
  await askScripted(page, "Slow", [
    {
      delayMs: 2500,
      content: {
        reply: "Moved.",
        actions: [
          { type: "move_card", cardId: "todo-1", columnId: "review" },
          { type: "rename_column", columnId: "review", name: "QA" },
          { type: "move_card", cardId: "todo-2", columnId: "done" },
        ],
      },
    },
  ]);
  await removeColumn(page, "Review");
  await expect(log(page)).toContainText(
    'Moved "Write release notes for v2.4" to Done',
  );
  await expect(log(page)).not.toContainText("Renamed");
  await expect(regions(page)).toHaveCount(4);
  await expect(column(page, "QA")).toHaveCount(0);
  await expect
    .poll(() => cardTitles(page, "To Do"))
    .toContain("Set up error monitoring");
});

test("the assistant names a single removed card correctly", async ({
  page,
}) => {
  await askScripted(page, "Remove In Progress", [
    {
      content: {
        reply: "Removed.",
        actions: [
          { type: "delete_card", cardId: "in-progress-1" },
          { type: "remove_column", columnId: "In Progress" },
        ],
      },
    },
  ]);
  await expect(log(page)).toContainText(
    "Removed column In Progress and its card",
  );
  await expect(log(page)).not.toContainText("its 1 cards");
});

test("columns can be managed on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await removeButton(page, "Backlog").scrollIntoViewIfNeeded();
  await removeColumn(page, "Backlog");
  await addTile(page).scrollIntoViewIfNeeded();
  await addTile(page).click();
  await page.getByLabel("Column name").fill("Ideas");
  await page.keyboard.press("Enter");
  await expect(column(page, "Ideas")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

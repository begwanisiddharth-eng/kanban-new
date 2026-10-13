import { expect, test, type Page } from "@playwright/test";

import { cards, cardTitles, openBoard, save } from "./helpers";

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Board assistant" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function ask(page: Page, text: string) {
  await panel(page)
    .getByRole("textbox", { name: "Message the assistant" })
    .fill(text);
  await panel(page)
    .getByRole("textbox", { name: "Message the assistant" })
    .press("Enter");
}

test("answers questions about the board", async ({ page }) => {
  await openBoard(page);
  await panel(page)
    .getByRole("button", { name: "Summarise this board" })
    .click();
  await expect(log(page)).toContainText("Summarise this board");
  await expect(log(page)).toContainText("This board has 13 cards.");
  await expect(page.getByText("All changes saved")).toBeVisible();
});

test("moves a card on request, as an unsaved change", async ({ page }) => {
  await openBoard(page);
  await ask(page, "Move Fix timezone bug in reports to Backlog");
  await expect(log(page)).toContainText(
    'Moved "Fix timezone bug in reports" to Backlog',
  );
  await expect(log(page)).toContainText("Not saved yet");
  await expect(cards(page, "Backlog").last()).toHaveAccessibleName(
    "Fix timezone bug in reports",
  );
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await save(page);
  await page.reload();
  await expect
    .poll(() => cardTitles(page, "Backlog"))
    .toContain("Fix timezone bug in reports");
});

test("adds a card on request and keeps the conversation going", async ({
  page,
}) => {
  await openBoard(page);
  await ask(page, "Add Prepare the demo to To Do");
  await expect(cards(page, "To Do").last()).toHaveAccessibleName(
    "Prepare the demo",
  );
  await ask(page, "Thanks");
  await expect(log(page)).toContainText("You said: Thanks");
  await expect(
    log(page).getByText("Prepare the demo", { exact: false }),
  ).toHaveCount(2);
});

test("retries when the model is temporarily unavailable", async ({ page }) => {
  test.setTimeout(60_000);
  await openBoard(page);
  await ask(page, "A flaky question");
  await expect(log(page)).toContainText("Thinking...");
  await expect(log(page)).toContainText("You said: A flaky question", {
    timeout: 45_000,
  });
});

test("starts a fresh conversation on another board", async ({ page }) => {
  await openBoard(page);
  await ask(page, "Hello");
  await expect(log(page)).toContainText("You said: Hello");
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Board name").fill("Second");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second");
  await expect(log(page)).not.toContainText("Hello");
  await ask(page, "Summarise this board");
  await expect(log(page)).toContainText("This board has 0 cards.");
});

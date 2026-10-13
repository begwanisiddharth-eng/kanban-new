import { expect, test, type Page } from "@playwright/test";

import {
  cardTitles,
  column,
  modelCalls,
  openBoard,
  save,
  scriptModel,
  uniqueMessage,
  type ModelStep,
} from "./helpers";

// Longer conversations and multi-step edits through the board assistant.

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Board assistant" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });
const input = (page: Page) =>
  panel(page).getByRole("textbox", { name: "Message the assistant" });

async function send(page: Page, message: string) {
  await input(page).fill(message);
  await input(page).press("Enter");
}

async function askScripted(page: Page, text: string, responses: ModelStep[]) {
  const message = uniqueMessage(text);
  await scriptModel(page, message, responses);
  await send(page, message);
  return message;
}

const say = (reply: string, actions: unknown[] = []): ModelStep => ({
  content: { reply, actions },
});

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test("keeps talking after a very long reply", async ({ page }) => {
  const long = "Here is a detailed plan. ".repeat(250); // ~6,000 characters
  await askScripted(page, "Plan my week", [say(long)]);
  await expect(log(page)).toContainText("Here is a detailed plan.");
  const followUp = await askScripted(page, "Shorter please", [say("Sure.")]);
  await expect(log(page)).toContainText("Sure.");
  const [call] = await modelCalls(page, followUp);
  expect(call.messages.at(-2)?.role).toBe("assistant");
  expect(call.messages.every((m) => m.content.length <= 4000)).toBe(true);
});

test("sends at most the last 40 messages", async ({ page }) => {
  test.setTimeout(90_000);
  for (let i = 1; i <= 21; i++) {
    await send(page, `Message ${i}`);
    await expect(log(page)).toContainText(`You said: Message ${i}`);
  }
  const last = await askScripted(page, "Final", [say("Last answer.")]);
  await expect(log(page)).toContainText("Last answer.");
  const [call] = await modelCalls(page, last);
  expect(call.messages[0].role).toBe("system");
  // The 40-message window would open on the reply to message 2; it starts
  // at the next question instead.
  expect(call.messages).toHaveLength(40);
  expect(call.messages[1]).toEqual({ role: "user", content: "Message 3" });
});

test("applies several kinds of change from one reply, then saves", async ({
  page,
}) => {
  await askScripted(page, "Reorganise", [
    say("Reorganised.", [
      {
        type: "add_card",
        columnId: "backlog",
        title: "Write onboarding emails",
        details: "Three emails over the first week.",
      },
      {
        type: "update_card",
        cardId: "review-1",
        details: "Copy approved; waiting for design.",
      },
      { type: "delete_card", cardId: "done-3" },
      { type: "rename_column", columnId: "review", name: "QA" },
      { type: "move_card", cardId: "backlog-3", columnId: "todo", position: 0 },
      { type: "move_card", cardId: "done-3", columnId: "todo" },
    ]),
  ]);
  const entry = log(page).getByRole("listitem");
  await expect(entry).toHaveText([
    'Added "Write onboarding emails" to Backlog',
    'Updated "Password reset email template"',
    'Deleted "Onboard two new support agents"',
    "Renamed Review to QA",
    'Moved "Audit accessibility of settings page" to To Do',
    "Not saved yet. Use Save to keep these changes.",
  ]);
  await expect(log(page)).toContainText(
    "1 requested change could not be applied",
  );
  await expect(column(page, "QA")).toBeVisible();
  await expect
    .poll(() => cardTitles(page, "To Do"))
    .toEqual([
      "Audit accessibility of settings page",
      "Set up error monitoring",
      "Write release notes for v2.4",
      "Plan customer interview sessions",
    ]);

  await save(page);
  await page.reload();
  await expect(column(page, "QA")).toBeVisible();
  await expect
    .poll(() => cardTitles(page, "Backlog"))
    .toContain("Write onboarding emails");
  await expect
    .poll(() => cardTitles(page, "Done"))
    .not.toContain("Onboard two new support agents");
});

test("Discard changes undoes the assistant's edits but keeps the chat", async ({
  page,
}) => {
  await askScripted(page, "Clear done", [
    say("Cleared Done.", [
      { type: "delete_card", cardId: "done-1" },
      { type: "delete_card", cardId: "done-2" },
    ]),
  ]);
  await expect.poll(() => cardTitles(page, "Done")).toHaveLength(1);
  await page.getByRole("button", { name: "Discard changes" }).click();
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: /discard/i }).click();
  }
  await expect.poll(() => cardTitles(page, "Done")).toHaveLength(3);
  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(log(page)).toContainText("Cleared Done.");
});

test("shows markup from the model as plain text", async ({ page }) => {
  await askScripted(page, "Add a tricky card", [
    say("<b>Bold</b> <img src=x onerror=\"document.title='pwned'\">", [
      {
        type: "add_card",
        columnId: "todo",
        title: "<script>alert(1)</script>",
        details: "**not markdown**",
      },
    ]),
  ]);
  await expect(log(page)).toContainText("<b>Bold</b>");
  await expect(
    page.getByRole("listitem", { name: "<script>alert(1)</script>" }),
  ).toBeVisible();
  expect(await page.title()).not.toBe("pwned");
  await expect(log(page).locator("img, b")).toHaveCount(0);
});

test("keeps line breaks and unicode in replies", async ({ page }) => {
  await askScripted(page, "List", [
    say("Two things:\n• Ship it 🚀\n• Rest 😴"),
  ]);
  await expect(log(page)).toContainText("• Ship it 🚀");
  await expect(log(page)).toContainText("• Rest 😴");
});

test("sends the edited board on the next message", async ({ page }) => {
  await askScripted(page, "Delete the CDN card", [
    say("Deleted.", [{ type: "delete_card", cardId: "in-progress-2" }]),
  ]);
  await expect(log(page)).toContainText(
    'Deleted "Migrate image storage to CDN"',
  );
  const next = await askScripted(page, "What is left?", [say("Not much.")]);
  await expect(log(page)).toContainText("Not much.");
  const [call] = await modelCalls(page, next);
  expect(call.messages[0].content).not.toContain("in-progress-2");
});

test("accepts a message at the 4,000 character limit", async ({ page }) => {
  const message = uniqueMessage("x").padEnd(4000, "x");
  await scriptModel(page, message, [say("That was long.")]);
  await input(page).fill(message);
  await panel(page).getByRole("button", { name: "Send message" }).click();
  await expect(log(page)).toContainText("That was long.");
});

test("Clear conversation starts again", async ({ page }) => {
  await send(page, "Hello");
  await expect(log(page)).toContainText("You said: Hello");
  await panel(page).getByRole("button", { name: "Clear conversation" }).click();
  await expect(log(page)).not.toContainText("Hello");
  await expect(
    panel(page).getByRole("button", { name: "Summarise this board" }),
  ).toBeVisible();
});

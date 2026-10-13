import { expect, test, type Page } from "@playwright/test";

import {
  cardTitles,
  column,
  deleteCard,
  modelCalls,
  openBoard,
  scriptModel,
  uniqueMessage,
  type ModelStep,
} from "./helpers";

// What happens around an assistant request that is still in flight, and
// when the chat route itself fails.

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Board assistant" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });
const input = (page: Page) =>
  panel(page).getByRole("textbox", { name: "Message the assistant" });

async function askScripted(page: Page, text: string, responses: ModelStep[]) {
  const message = uniqueMessage(text);
  await scriptModel(page, message, responses);
  await input(page).fill(message);
  await input(page).press("Enter");
  return message;
}

const slowly = (reply: string, actions: unknown[]): ModelStep => ({
  delayMs: 2500,
  content: { reply, actions },
});

const addToTodo = {
  type: "add_card",
  columnId: "todo",
  title: "Added by a late reply",
  details: "Should land on the board it was asked about.",
};

async function newBoard(page: Page, name: string) {
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Board name").fill(name);
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test("a reply that arrives after switching boards changes nothing", async ({
  page,
}) => {
  await askScripted(page, "Add a card slowly", [
    slowly("Added.", [
      addToTodo,
      { type: "rename_column", columnId: "done", name: "Shipped" },
    ]),
  ]);
  await expect(log(page)).toContainText("Thinking...");
  await newBoard(page, "Other board");
  await page.waitForTimeout(3500);
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(column(page, "Done")).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(log(page)).not.toContainText("Added.");
});

test("cannot send a second message while one is pending", async ({ page }) => {
  const message = await askScripted(page, "Slow", [slowly("Only once.", [])]);
  await expect(
    panel(page).getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  await input(page).fill("Another");
  await input(page).press("Enter");
  await expect(log(page)).toContainText("Only once.");
  await expect(log(page)).not.toContainText("You said: Another");
  expect(await modelCalls(page, message)).toHaveLength(1);
  // The draft typed while waiting is kept and can be sent afterwards.
  await expect(input(page)).toHaveValue("Another");
});

test("a suggestion clicked twice sends once", async ({ page }) => {
  await panel(page)
    .getByRole("button", { name: "What is in progress?" })
    .dblclick();
  await expect(log(page)).toContainText("You said: What is in progress?");
  await expect(
    log(page).getByText("You said: What is in progress?"),
  ).toHaveCount(1);
});

test("edits made while waiting are kept alongside the reply", async ({
  page,
}) => {
  await askScripted(page, "Move a card slowly", [
    slowly("Moved.", [
      { type: "move_card", cardId: "backlog-1", columnId: "done" },
      { type: "move_card", cardId: "backlog-2", columnId: "done" },
    ]),
  ]);
  await deleteCard(page, "Draft Q3 product roadmap");
  await expect(log(page)).toContainText(
    'Moved "Research competitor onboarding flows" to Done',
  );
  await expect(log(page)).not.toContainText("Draft Q3 product roadmap");
  await expect
    .poll(() => cardTitles(page, "Done"))
    .toContain("Research competitor onboarding flows");
  await expect
    .poll(() => cardTitles(page, "Backlog"))
    .toEqual(["Audit accessibility of settings page"]);
});

test("signing out while waiting does not break anything", async ({ page }) => {
  await askScripted(page, "Slow sign out", [slowly("Late.", [addToTodo])]);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin/);
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/signin/);
});

test("explains when the chat service is down", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "The assistant is not running. Start the chat service." },
    }),
  );
  await input(page).fill("Hello");
  await input(page).press("Enter");
  await expect(log(page)).toContainText("The assistant is not running.");
  await expect(input(page)).toBeEnabled();

  // Once it is back, the failed reply is left out of the history.
  await page.unroute("**/api/chat");
  const message = await askScripted(page, "Back again", [
    { content: { reply: "I'm here.", actions: [] } },
  ]);
  await expect(log(page)).toContainText("I'm here.");
  const [call] = await modelCalls(page, message);
  expect(call.messages.slice(1)).toEqual([
    { role: "user", content: "Hello" },
    { role: "user", content: message },
  ]);
});

test("explains when the network drops", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.abort("connectionreset"));
  await input(page).fill("Hello");
  await input(page).press("Enter");
  await expect(log(page)).toContainText("The assistant could not be reached.");
});

test("an expired session returns to sign in", async ({ page }) => {
  await page.context().clearCookies();
  await input(page).fill("Hello");
  await input(page).press("Enter");
  await expect(page).toHaveURL(/\/signin\?reason=expired/);
});

test("the chat API is only for signed-in users", async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.request.post("/api/chat", {
    data: { board: {}, messages: [{ role: "user", content: "Hi" }] },
  });
  expect(res.status()).toBe(401);
});

test("the chat API rejects malformed requests", async ({ page }) => {
  const res = await page.request.post("/api/chat", {
    data: { board: { columns: [], cards: {} }, messages: [] },
  });
  expect(res.status()).toBe(400);
  expect(await res.json()).toEqual({ error: "Invalid chat request." });
});

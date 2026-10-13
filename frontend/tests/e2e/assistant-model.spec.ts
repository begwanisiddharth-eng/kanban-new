import { expect, test, type Page } from "@playwright/test";

import {
  cardTitles,
  column,
  modelCalls,
  openBoard,
  scriptModel,
  uniqueMessage,
  type ModelStep,
} from "./helpers";

// How the board assistant copes with the shapes of output a real model
// produces, using scripted answers from the fake Groq server.

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Board assistant" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function askScripted(page: Page, text: string, responses: ModelStep[]) {
  const message = uniqueMessage(text);
  await scriptModel(page, message, responses);
  const box = panel(page).getByRole("textbox", {
    name: "Message the assistant",
  });
  await box.fill(message);
  await box.press("Enter");
  return message;
}

const moveTimezoneBug = {
  type: "move_card",
  cardId: "done-2",
  columnId: "todo",
};

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test("sends the fixed model, JSON mode and the board", async ({ page }) => {
  const message = await askScripted(page, "Hi", [
    { content: { reply: "Hello!", actions: [] } },
  ]);
  await expect(log(page)).toContainText("Hello!");
  const [call] = await modelCalls(page, message);
  expect(call.model).toBe("openai/gpt-oss-120b");
  expect(call.response_format).toEqual({ type: "json_object" });
  expect(call.messages[0].role).toBe("system");
  expect(call.messages[0].content).toContain('"id":"done-2"');
  expect(call.messages.at(-1)).toEqual({ role: "user", content: message });
});

test("accepts a reply wrapped in a markdown code fence", async ({ page }) => {
  const reply = { reply: "Moved it to To Do.", actions: [moveTimezoneBug] };
  await askScripted(page, "Move the timezone bug to To Do", [
    { content: "```json\n" + JSON.stringify(reply) + "\n```" },
  ]);
  await expect(log(page)).toContainText("Moved it to To Do.");
  await expect
    .poll(() => cardTitles(page, "To Do"))
    .toContain("Fix timezone bug in reports");
});

test("accepts a reply with text around the JSON", async ({ page }) => {
  const reply = { reply: "Here you go.", actions: [] };
  await askScripted(page, "Anything", [
    { content: `Sure! ${JSON.stringify(reply)} Let me know.` },
  ]);
  await expect(log(page)).toContainText("Here you go.");
});

test("accepts column names and card titles in place of ids", async ({
  page,
}) => {
  await askScripted(page, "Move the timezone bug to To Do", [
    {
      content: {
        reply: "Done.",
        actions: [
          {
            type: "move_card",
            cardId: "Fix timezone bug in reports",
            columnId: "to do",
          },
        ],
      },
    },
  ]);
  await expect(log(page)).toContainText(
    'Moved "Fix timezone bug in reports" to To Do',
  );
});

test("applies the valid actions when one action is malformed", async ({
  page,
}) => {
  await askScripted(page, "Tidy up", [
    {
      content: {
        reply: "I made the changes.",
        actions: [
          moveTimezoneBug,
          { type: "add_card", columnId: "todo", title: "No details" },
          { type: "rename_column", columnId: "review", name: "x".repeat(80) },
          { type: "add_column", name: "Blocked" },
          { type: "delete_card", cardId: "missing-card" },
        ],
      },
    },
  ]);
  await expect(log(page)).toContainText("I made the changes.");
  await expect(log(page)).toContainText(
    'Moved "Fix timezone bug in reports" to To Do',
  );
  await expect(log(page)).toContainText(
    "4 requested changes could not be applied",
  );
  await expect
    .poll(() => cardTitles(page, "To Do"))
    .toContain("Fix timezone bug in reports");
  await expect(column(page, "Review")).toBeVisible();
});

test("tolerates null and string fields the model sends", async ({ page }) => {
  await askScripted(page, "Rename and move", [
    {
      content: {
        reply: "Updated.",
        actions: [
          {
            type: "update_card",
            cardId: "todo-1",
            title: "Set up Sentry",
            details: null,
          },
          {
            type: "move_card",
            cardId: "todo-1",
            columnId: "done",
            position: "0",
          },
        ],
        note: "extra keys are ignored",
      },
    },
  ]);
  await expect(log(page)).toContainText('Updated "Set up Sentry"');
  await expect
    .poll(() => cardTitles(page, "Done"))
    .toEqual([
      "Set up Sentry",
      "Launch referral programme",
      "Fix timezone bug in reports",
      "Onboard two new support agents",
    ]);
});

test("retries when Groq cannot produce valid JSON", async ({ page }) => {
  test.setTimeout(60_000);
  await askScripted(page, "Summarise", [
    {
      status: 400,
      body: {
        error: {
          message:
            "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
          type: "invalid_request_error",
          code: "json_validate_failed",
          failed_generation: "{reply: oops",
        },
      },
    },
    { content: "" },
    { content: null },
    { content: { reply: "Recovered.", actions: [] } },
  ]);
  await expect(log(page)).toContainText("Recovered.", { timeout: 45_000 });
});

test("retries after a rate limit", async ({ page }) => {
  test.setTimeout(60_000);
  await askScripted(page, "Busy", [
    {
      status: 429,
      body: {
        error: {
          message: "Rate limit reached",
          type: "tokens",
          code: "rate_limit_exceeded",
        },
      },
    },
    { content: { reply: "After the wait.", actions: [] } },
  ]);
  await expect(log(page)).toContainText("After the wait.", { timeout: 30_000 });
});

test("explains a rejected API key without retrying", async ({ page }) => {
  const message = await askScripted(page, "Hello", [
    {
      status: 401,
      body: {
        error: {
          message: "Invalid API Key",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      },
    },
  ]);
  await expect(log(page)).toContainText("Groq rejected the API key");
  expect(await modelCalls(page, message)).toHaveLength(1);
  await expect(
    panel(page).getByRole("textbox", { name: "Message the assistant" }),
  ).toBeEnabled();
});

test("gives up with a clear message when the model keeps failing", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const message = await askScripted(page, "Broken", [
    { content: "not json at all" },
  ]);
  await expect(log(page)).toContainText(
    "The assistant could not answer right now",
    { timeout: 75_000 },
  );
  expect(await modelCalls(page, message)).toHaveLength(5);
  await expect(page.getByText("All changes saved")).toBeVisible();
});

test("uses a default reply when the model only sends actions", async ({
  page,
}) => {
  await askScripted(page, "Move it", [
    { content: { actions: [moveTimezoneBug] } },
  ]);
  await expect(log(page)).toContainText(
    'Moved "Fix timezone bug in reports" to To Do',
  );
  await expect(log(page)).toContainText("Done.");
});

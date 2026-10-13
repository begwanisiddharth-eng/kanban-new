import { expect, test, type Page } from "@playwright/test";

import {
  cardTitles,
  modelCalls,
  openBoard,
  save,
  scriptModel,
  uniqueMessage,
  type ModelStep,
} from "./helpers";

// Several users at once, truncated output and ambiguous references.

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Board assistant" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function askScripted(page: Page, text: string, responses: ModelStep[]) {
  const message = uniqueMessage(text);
  await scriptModel(page, message, responses);
  const input = panel(page).getByRole("textbox", {
    name: "Message the assistant",
  });
  await input.fill(message);
  await input.press("Enter");
  return message;
}

test("several users chat at once, each about their own board", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const users = await Promise.all(
    [0, 1, 2].map(async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await openBoard(page);
      return { context, page };
    }),
  );
  await Promise.all(
    users.map(async ({ page }, i) => {
      const message = await askScripted(page, `User ${i}`, [
        {
          delayMs: 500,
          content: {
            reply: `Added for user ${i}.`,
            actions: [
              {
                type: "add_card",
                columnId: "todo",
                title: `Card of user ${i}`,
                details: "Mine.",
              },
            ],
          },
        },
      ]);
      await expect(log(page)).toContainText(`Added for user ${i}.`);
      await save(page);
      const [call] = await modelCalls(page, message);
      expect(call.messages[0].content).not.toContain("Card of user");
    }),
  );
  for (const [i, { page, context }] of users.entries()) {
    await page.reload();
    // Wait for the reloaded board before reading it.
    await expect
      .poll(() => cardTitles(page, "To Do"))
      .toContain(`Card of user ${i}`);
    const titles = await cardTitles(page, "To Do");
    expect(titles.filter((t) => t?.startsWith("Card of user"))).toHaveLength(1);
    await context.close();
  }
});

test("retries a reply cut off mid-JSON", async ({ page }) => {
  test.setTimeout(30_000);
  await openBoard(page);
  const message = await askScripted(page, "Long answer", [
    { content: '{"reply": "This answer was cut off because the' },
    { content: { reply: "Complete answer.", actions: [] } },
  ]);
  await expect(log(page)).toContainText("Complete answer.", {
    timeout: 20_000,
  });
  expect(await modelCalls(page, message)).toHaveLength(2);
});

test("does not guess between cards with the same title", async ({ page }) => {
  await openBoard(page);
  // Two cards called "Duplicate" in To Do.
  for (let i = 0; i < 2; i++) {
    await askScripted(page, `Add duplicate ${i}`, [
      {
        content: {
          reply: "Added.",
          actions: [
            {
              type: "add_card",
              columnId: "To Do",
              title: "Duplicate",
              details: `Copy ${i}`,
            },
          ],
        },
      },
    ]);
    await expect(log(page).getByText("Not saved yet")).toHaveCount(i + 1);
  }
  await askScripted(page, "Delete duplicate", [
    {
      content: {
        reply: "Deleted.",
        actions: [{ type: "delete_card", cardId: "Duplicate" }],
      },
    },
  ]);
  await expect(log(page)).toContainText(
    "1 requested change could not be applied",
  );
  await expect
    .poll(async () =>
      (await cardTitles(page, "To Do")).filter((t) => t === "Duplicate"),
    )
    .toHaveLength(2);
});

test("answers about a board with many cards", async ({ page }) => {
  await openBoard(page);
  const [board] = await (await page.request.get("/api/boards")).json();
  const { data } = await (
    await page.request.get(`/api/boards/${board.id}`)
  ).json();
  for (let i = 0; i < 300; i++) {
    const id = `bulk-${i}`;
    data.cards[id] = {
      id,
      title: `Bulk card ${i}`,
      details: "Some details that make the board larger. ".repeat(5),
    };
    data.columns[i % 5].cardIds.push(id);
  }
  expect(
    (await page.request.put(`/api/boards/${board.id}`, { data })).status(),
  ).toBe(204);
  await page.reload();
  const message = await askScripted(page, "Count", [
    {
      content: {
        reply: "Moved the last one.",
        actions: [
          {
            type: "move_card",
            cardId: "bulk-299",
            columnId: "backlog",
            position: 0,
          },
        ],
      },
    },
  ]);
  await expect(log(page)).toContainText('Moved "Bulk card 299" to Backlog');
  const [call] = await modelCalls(page, message);
  expect(call.messages[0].content).toContain('"bulk-299"');
});

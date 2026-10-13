import { expect, test, type Page } from "@playwright/test";

import { cardTitles, column, openBoard, save } from "../e2e/helpers";

// The board assistant against the real model. Assertions check the board,
// not the model's wording, which varies from run to run.

test.skip(!process.env.GROQ_API_KEY, "needs GROQ_API_KEY");

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Board assistant" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function ask(page: Page, text: string) {
  const replies = log(page).locator(".self-start:not(p)");
  const before = await replies.count();
  const input = panel(page).getByRole("textbox", {
    name: "Message the assistant",
  });
  await input.fill(text);
  await input.press("Enter");
  await expect(replies).toHaveCount(before + 1);
  // The model's own words, without the change list or screen-reader prefix.
  const reply = await replies.last().evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("ul, .sr-only").forEach((node) => node.remove());
    return (copy.textContent ?? "").trim();
  });
  test.info().annotations.push({ type: text, description: reply });
  return reply;
}

test.beforeEach(async ({ page }) => {
  await openBoard(page);
});

test("answers a question without changing the board", async ({ page }) => {
  const reply = await ask(page, "What is in progress?");
  expect(reply).toContain("Redesign pricing page");
  expect(reply).not.toMatch(/\*\*|^#+ /m);
  await expect(page.getByText("All changes saved")).toBeVisible();
});

test("moves a card", async ({ page }) => {
  await ask(page, "Move the pricing page redesign to Review");
  await expect
    .poll(() => cardTitles(page, "Review"))
    .toContain("Redesign pricing page");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
});

test("adds a card from the suggestion, writing details itself", async ({
  page,
}) => {
  await panel(page)
    .getByRole("button", {
      name: "Add a card to To Do for writing release notes",
    })
    .click();
  await expect.poll(() => cardTitles(page, "To Do")).toHaveLength(4);
  const added = (await cardTitles(page, "To Do")).at(-1);
  expect(added?.toLowerCase()).toContain("release notes");
});

test("updates, renames and deletes in one request, then saves", async ({
  page,
}) => {
  await ask(
    page,
    "Rename the Review column to QA, delete the referral programme card and change the details of the error monitoring card to: Use Sentry and alert on Slack.",
  );
  await expect(column(page, "QA")).toBeVisible();
  await expect
    .poll(() => cardTitles(page, "Done"))
    .not.toContain("Launch referral programme");
  await expect(
    page.getByRole("listitem", { name: "Set up error monitoring" }),
  ).toContainText("Sentry");
  await save(page);
  await page.reload();
  await expect(column(page, "QA")).toBeVisible();
});

test("follows up on the previous turn", async ({ page }) => {
  await ask(page, "Which card is about accessibility?");
  await ask(page, "Move that one to In Progress");
  await expect
    .poll(() => cardTitles(page, "In Progress"))
    .toContain("Audit accessibility of settings page");
});

test("asks instead of guessing when the request is unclear", async ({
  page,
}) => {
  await ask(page, "Move it to done");
  await expect(page.getByText("All changes saved")).toBeVisible();
});

test("explains that columns cannot be added", async ({ page }) => {
  const reply = await ask(page, "Add a new column called Blocked");
  expect(reply.toLowerCase()).toMatch(/can(no|')t|not possible|unable|only/);
  await expect(page.getByRole("region")).toHaveCount(5);
});

test("tells the user to save instead of claiming it saved", async ({
  page,
}) => {
  const reply = await ask(
    page,
    "Delete the onboarding support agents card and save the board",
  );
  await expect
    .poll(() => cardTitles(page, "Done"))
    .not.toContain("Onboard two new support agents");
  expect(reply).toMatch(/Save/);
  expect(reply.toLowerCase()).not.toMatch(/(have|has|i've|been) saved/);
});

test("refuses a column name over 60 characters without claiming it", async ({
  page,
}) => {
  const reply = await ask(
    page,
    "Rename the Review column to 'Waiting for review by the design team, the product owner and the legal department'",
  );
  await expect(column(page, "Review")).toBeVisible();
  expect(reply.toLowerCase()).toMatch(/60|too long|shorter/);
  expect(reply.toLowerCase()).not.toMatch(
    /has been renamed|i('ve| have) renamed/,
  );
});

test("talks about cards by title, not id", async ({ page }) => {
  const reply = await ask(
    page,
    "Move the card at position 2 in Backlog to Done",
  );
  await expect
    .poll(() => cardTitles(page, "Done"))
    .toContain("Audit accessibility of settings page");
  expect(reply).not.toMatch(/backlog-\d|done-\d|in-progress-\d/);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  openBoard,
  scriptModel,
  uniqueMessage,
  type ModelStep,
} from "./helpers";

// The assistant panel's usability: keyboard, screen readers, overflow and
// small screens.

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

const say = (reply: string, actions: unknown[] = []): ModelStep => ({
  content: { reply, actions },
});

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("works from the keyboard alone", async ({ page }) => {
  await openBoard(page);
  await input(page).focus();
  await page.keyboard.type("First line");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second line");
  await expect(input(page)).toHaveValue("First line\nsecond line");
  await page.keyboard.press("Enter");
  await expect(log(page)).toContainText("You said: First line");
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveValue("");
  // The conversation can be reached to scroll it.
  await page.keyboard.press("Shift+Tab");
  await expect(log(page)).toBeFocused();
});

test("conversation with changes has no accessibility violations", async ({
  page,
}) => {
  await openBoard(page);
  await askScripted(page, "Move it", [
    say("Moved.", [{ type: "move_card", cardId: "done-2", columnId: "todo" }]),
  ]);
  await expect(log(page)).toContainText("Not saved yet");
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 502, json: { error: "Try again." } }),
  );
  await input(page).fill("Fail");
  await input(page).press("Enter");
  await expect(log(page)).toContainText("Try again.");
  const results = await new AxeBuilder({ page })
    .include("aside")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("long unbroken text wraps inside the panel", async ({ page }) => {
  await openBoard(page);
  const url = "https://example.com/" + "a".repeat(300);
  await askScripted(page, url, [say(`See ${url}`)]);
  await expect(log(page)).toContainText("See https://example.com/");
  const { scrollWidth, clientWidth } = await log(page).evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  await noHorizontalOverflow(page);
});

test("long conversations scroll inside the panel", async ({ page }) => {
  await openBoard(page);
  const before = await panel(page).boundingBox();
  for (let i = 0; i < 3; i++) {
    await askScripted(page, `Long ${i}`, [
      say("Line\n".repeat(30) + `End ${i}`),
    ]);
    await expect(log(page)).toContainText(`End ${i}`);
  }
  const after = await panel(page).boundingBox();
  expect(after?.height).toBe(before?.height);
  // The newest reply is scrolled into view.
  await expect(log(page).getByText("End 2", { exact: false })).toBeInViewport();
});

test("the input grows with its text up to a limit", async ({ page }) => {
  await openBoard(page);
  const one = (await input(page).boundingBox())!.height;
  await input(page).fill("a\nb\nc");
  const three = (await input(page).boundingBox())!.height;
  await input(page).fill("x\n".repeat(30));
  const many = (await input(page).boundingBox())!.height;
  expect(three).toBeGreaterThan(one);
  expect(many).toBeLessThanOrEqual(128);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`the assistant is usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openBoard(page);
    await input(page).scrollIntoViewIfNeeded();
    await expect(input(page)).toBeVisible();
    await askScripted(page, "Small screen", [say("Works on small screens.")]);
    await expect(log(page)).toContainText("Works on small screens.");
    const box = (await panel(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await noHorizontalOverflow(page);
  });
}

test("a card added with a very long title keeps the card height", async ({
  page,
}) => {
  await openBoard(page);
  const heights = async () =>
    page
      .getByRole("region", { name: "To Do", exact: true })
      .getByRole("listitem")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  const [normal] = await heights();
  await askScripted(page, "Add long", [
    say("Added.", [
      {
        type: "add_card",
        columnId: "todo",
        title: "Very long title ".repeat(20),
        details: "Very long details ".repeat(60),
      },
    ]),
  ]);
  await expect(log(page)).toContainText("Not saved yet");
  expect((await heights()).at(-1)).toBe(normal);
});

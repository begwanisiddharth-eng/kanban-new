import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/lib/api";
import { selectIsDirty } from "@/store/boardStore";
import { renderWithBoard } from "@/tests/renderBoard";
import { ChatPanel } from "./ChatPanel";

vi.mock("@/lib/api", async (original) => {
  const actual = await original<typeof import("@/lib/api")>();
  return { ...actual, api: { chat: vi.fn() } };
});

const chat = vi.mocked(api.chat);
const onExpired = vi.fn();

function setup() {
  const user = userEvent.setup();
  const result = renderWithBoard(<ChatPanel onExpired={onExpired} />);
  const input = screen.getByRole("textbox", { name: "Message the assistant" });
  const log = screen.getByRole("log", { name: "Conversation" });
  return { ...result, user, input, log };
}

beforeEach(() => vi.clearAllMocks());

describe("ChatPanel", () => {
  it("sends the board and conversation, then shows the reply", async () => {
    chat.mockResolvedValue({ reply: "You have 13 cards.", actions: [] });
    const { user, input, log, state } = setup();
    await user.type(input, "How many cards?{Enter}");
    expect(await within(log).findByText("You have 13 cards.")).toBeVisible();
    expect(within(log).getByText("How many cards?")).toBeVisible();
    expect(chat).toHaveBeenCalledWith(
      { columns: state().columns, cards: state().cards },
      [{ role: "user", content: "How many cards?" }],
    );
    expect(input).toHaveValue("");
  });

  it("applies the assistant's changes as unsaved edits", async () => {
    chat.mockResolvedValue({
      reply: "Moved it.",
      actions: [{ type: "move_card", cardId: "todo-1", columnId: "done" }],
    });
    const { user, input, log, state } = setup();
    await user.type(input, "Finish error monitoring{Enter}");
    expect(
      await within(log).findByText('Moved "Set up error monitoring" to Done'),
    ).toBeVisible();
    expect(within(log).getByText(/Not saved yet/)).toBeVisible();
    expect(state().columns[4].cardIds.at(-1)).toBe("todo-1");
    expect(selectIsDirty(state())).toBe(true);
  });

  it("keeps the conversation as context for follow-ups", async () => {
    chat.mockResolvedValueOnce({ reply: "First answer", actions: [] });
    chat.mockResolvedValueOnce({ reply: "Second answer", actions: [] });
    const { user, input, log } = setup();
    await user.type(input, "One{Enter}");
    await within(log).findByText("First answer");
    await user.type(input, "Two{Enter}");
    await within(log).findByText("Second answer");
    expect(chat.mock.calls[1][1]).toEqual([
      { role: "user", content: "One" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Two" },
    ]);
  });

  it("shows errors and leaves them out of later requests", async () => {
    chat.mockRejectedValueOnce(new ApiError(502, "The assistant failed."));
    chat.mockResolvedValueOnce({ reply: "Back again", actions: [] });
    const { user, input, log } = setup();
    await user.type(input, "Hello{Enter}");
    expect(await within(log).findByText("The assistant failed.")).toBeVisible();
    await user.type(input, "Again{Enter}");
    await within(log).findByText("Back again");
    expect(chat.mock.calls[1][1]).toEqual([
      { role: "user", content: "Hello" },
      { role: "user", content: "Again" },
    ]);
  });

  it("hands an expired session to the caller", async () => {
    chat.mockRejectedValue(new ApiError(401, "Sign in to continue."));
    const { user, input } = setup();
    await user.type(input, "Hi{Enter}");
    await waitFor(() => expect(onExpired).toHaveBeenCalled());
  });

  it("offers suggestions and can clear the conversation", async () => {
    chat.mockResolvedValue({ reply: "Summary here", actions: [] });
    const { user, log } = setup();
    await user.click(
      screen.getByRole("button", { name: "Summarise this board" }),
    );
    await within(log).findByText("Summary here");
    await user.click(
      screen.getByRole("button", { name: "Clear conversation" }),
    );
    expect(within(log).queryByText("Summary here")).toBeNull();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { sampleBoard } from "@/tests/fixtures/sampleBoard";
import { renderWithBoard } from "@/tests/renderBoard";
import type { BoardSummary } from "@/types/board";
import { BoardApp } from "./BoardApp";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api: {
    saveBoard: vi.fn(async () => undefined),
    getBoard: vi.fn(async (id: string) => ({
      ...sampleBoard(),
      id,
      name: "Second",
    })),
    createBoard: vi.fn(),
    deleteBoard: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  },
}));

const TWO_BOARDS: BoardSummary[] = [
  { id: "board-1", name: "Sample board" },
  { id: "board-2", name: "Second" },
];

function setup(boards = TWO_BOARDS) {
  const user = userEvent.setup();
  const result = renderWithBoard(
    <BoardApp email="me@example.com" boards={boards} />,
  );
  const button = (name: string) => screen.getByRole("button", { name });
  const makeDirty = async () => {
    await user.click(button("Rename column: Done"));
    await user.type(
      screen.getByRole("textbox", { name: "Column name" }),
      " now{Enter}",
    );
  };
  const switchBoard = async () => {
    await user.click(screen.getByRole("combobox", { name: "Current board" }));
    await user.click(await screen.findByRole("option", { name: "Second" }));
  };
  return { ...result, user, button, makeDirty, switchBoard };
}

beforeEach(() => vi.clearAllMocks());

describe("BoardApp", () => {
  it("enables Save and Discard only when there are unsaved changes", async () => {
    const { button, makeDirty, user } = setup();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    expect(button("Save")).toBeDisabled();
    expect(button("Discard changes")).toBeDisabled();

    await makeDirty();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(button("Save")).toBeEnabled();

    await user.click(button("Save"));
    expect(api.saveBoard).toHaveBeenCalledWith(
      "board-1",
      expect.objectContaining({ cards: expect.any(Object) }),
    );
    await waitFor(() => expect(button("Save")).toBeDisabled());
  });

  it("discards changes after confirmation", async () => {
    const { button, makeDirty, user, state } = setup();
    await makeDirty();
    await user.click(button("Discard changes"));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Discard changes",
      }),
    );
    expect(state().columns[4].name).toBe("Done");
    expect(button("Save")).toBeDisabled();
  });

  it("switches boards straight away when nothing is unsaved", async () => {
    const { switchBoard, state } = setup();
    await switchBoard();
    await waitFor(() => expect(state().boardId).toBe("board-2"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks before switching with unsaved changes", async () => {
    const { makeDirty, switchBoard, user, state } = setup();
    await makeDirty();
    await switchBoard();
    const dialog = await screen.findByRole("alertdialog", {
      name: "Save your changes?",
    });

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(state().boardId).toBe("board-1");
    expect(api.getBoard).not.toHaveBeenCalled();

    await switchBoard();
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Save and continue",
      }),
    );
    await waitFor(() => expect(state().boardId).toBe("board-2"));
    expect(api.saveBoard).toHaveBeenCalledTimes(1);
  });

  it("can discard changes and switch", async () => {
    const { makeDirty, switchBoard, user, state } = setup();
    await makeDirty();
    await switchBoard();
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Discard changes",
      }),
    );
    await waitFor(() => expect(state().boardId).toBe("board-2"));
    expect(api.saveBoard).not.toHaveBeenCalled();
  });

  it("asks before signing out with unsaved changes", async () => {
    const { button, makeDirty, user } = setup();
    await makeDirty();
    await user.click(button("Sign out"));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Discard changes",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
  });

  it("limits boards to three and keeps the last one", () => {
    const { button, unmount } = setup([{ id: "board-1", name: "Only" }]);
    expect(button("Delete board")).toBeDisabled();
    expect(button("New board")).toBeEnabled();
    unmount();

    const full = setup([...TWO_BOARDS, { id: "board-3", name: "Third" }]);
    expect(full.button("New board")).toBeDisabled();
    expect(full.button("Delete board")).toBeEnabled();
  });
});

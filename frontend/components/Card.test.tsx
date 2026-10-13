import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "@/store/boardStore";
import { createSeedBoard } from "@/store/seedData";
import { Board } from "./Board";

const TITLE = "Redesign pricing page";

beforeEach(() => {
  useBoardStore.setState(createSeedBoard());
});

describe("Card", () => {
  it("edits title and details", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(
      await screen.findByRole("button", { name: `Edit card: ${TITLE}` }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit card" });
    const title = within(dialog).getByLabelText("Title");
    expect(title).toHaveValue(TITLE);
    await user.clear(title);
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.type(title, "New pricing page");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      screen.getByRole("listitem", { name: "New pricing page" }),
    ).toBeInTheDocument();
  });

  it("discards edits on cancel", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(
      await screen.findByRole("button", { name: `Edit card: ${TITLE}` }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Details"), " extra");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const card = Object.values(useBoardStore.getState().cards).find(
      (c) => c.title === TITLE,
    );
    expect(card?.details).not.toContain("extra");
  });

  it("deletes only after confirmation", async () => {
    const user = userEvent.setup();
    render(<Board />);
    const remove = await screen.findByRole("button", {
      name: `Delete card: ${TITLE}`,
    });
    await user.click(remove);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("listitem", { name: TITLE })).toBeInTheDocument();

    await user.click(remove);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(TITLE);
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("listitem", { name: TITLE })).toBeNull();
  });
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithBoard } from "@/tests/renderBoard";

describe("Column", () => {
  it("renames a column inline with Enter", async () => {
    const user = userEvent.setup();
    const { state } = renderWithBoard();
    await user.click(
      await screen.findByRole("button", { name: "Rename column: To Do" }),
    );
    const input = screen.getByRole("textbox", { name: "Column name" });
    await user.clear(input);
    await user.type(input, "Next up{Enter}");
    expect(state().columns[1].name).toBe("Next up");
    expect(screen.getByRole("region", { name: "Next up" })).toBeInTheDocument();
  });

  it("keeps the old name when cleared or cancelled", async () => {
    const user = userEvent.setup();
    const { state } = renderWithBoard();
    await user.click(
      await screen.findByRole("button", { name: "Rename column: Review" }),
    );
    await user.clear(screen.getByRole("textbox", { name: "Column name" }));
    await user.keyboard("{Enter}");
    expect(state().columns[3].name).toBe("Review");

    await user.click(
      screen.getByRole("button", { name: "Rename column: Review" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Column name" }),
      "Typo{Escape}",
    );
    expect(state().columns[3].name).toBe("Review");
  });

  it("adds a card at the bottom of the column", async () => {
    const user = userEvent.setup();
    renderWithBoard();
    await user.click(
      await screen.findByRole("button", { name: "Add card to Done" }),
    );
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Title"), "Ship it");
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Details"), "Today");
    await user.click(save);
    const items = within(
      screen.getByRole("region", { name: "Done" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[3]).toHaveAccessibleName("Ship it");
  });
});

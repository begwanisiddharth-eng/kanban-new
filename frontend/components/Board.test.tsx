import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithBoard } from "@/tests/renderBoard";

describe("Board", () => {
  it("renders five columns with their cards", () => {
    renderWithBoard();
    const regions = screen.getAllByRole("region");
    expect(regions.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Review",
      "Done",
    ]);
    expect(
      within(screen.getByRole("region", { name: "In Progress" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
  });
});

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "@/store/boardStore";
import { createSeedBoard } from "@/store/seedData";
import { Board } from "./Board";

const column = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  useBoardStore.setState(createSeedBoard());
});

describe("Board", () => {
  it("renders five columns with their cards", async () => {
    render(<Board />);
    const regions = await screen.findAllByRole("region");
    expect(regions.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Review",
      "Done",
    ]);
    expect(within(column("In Progress")).getAllByRole("listitem")).toHaveLength(
      2,
    );
  });

  it("shows the saved board instead of seed data", async () => {
    const saved = createSeedBoard();
    saved.columns[1].name = "Up next";
    localStorage.setItem(
      "kanban-board-v1",
      JSON.stringify({ state: saved, version: 0 }),
    );
    render(<Board />);
    expect(
      await screen.findByRole("region", { name: "Up next" }),
    ).toBeInTheDocument();
  });
});

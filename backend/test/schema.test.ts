import { describe, expect, it } from "vitest";

import { createEmptyBoard } from "../src/emptyBoard";
import { boardSchema } from "../src/schema";

const withCard = () => {
  const board = createEmptyBoard();
  board.cards.a = { id: "a", title: "Title", details: "Details" };
  board.columns[0].cardIds.push("a");
  return board;
};

describe("boardSchema", () => {
  it("accepts an empty board and a board with cards", () => {
    expect(boardSchema.safeParse(createEmptyBoard()).success).toBe(true);
    expect(boardSchema.safeParse(withCard()).success).toBe(true);
  });

  it("rejects the wrong number of columns", () => {
    const board = createEmptyBoard();
    expect(
      boardSchema.safeParse({ ...board, columns: board.columns.slice(0, 4) })
        .success,
    ).toBe(false);
  });

  it("rejects blank names, titles and details", () => {
    const blankColumn = createEmptyBoard();
    blankColumn.columns[2].name = "  ";
    expect(boardSchema.safeParse(blankColumn).success).toBe(false);

    const blankCard = withCard();
    blankCard.cards.a.details = " ";
    expect(boardSchema.safeParse(blankCard).success).toBe(false);
  });

  it("rejects cards missing from or repeated across columns", () => {
    const orphan = withCard();
    orphan.columns[0].cardIds = [];
    expect(boardSchema.safeParse(orphan).success).toBe(false);

    const twice = withCard();
    twice.columns[1].cardIds.push("a");
    expect(boardSchema.safeParse(twice).success).toBe(false);

    const dangling = createEmptyBoard();
    dangling.columns[0].cardIds.push("ghost");
    expect(boardSchema.safeParse(dangling).success).toBe(false);
  });
});

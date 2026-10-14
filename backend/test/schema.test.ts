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

  it("accepts one to five columns", () => {
    const board = createEmptyBoard();
    for (const count of [1, 3, 5]) {
      const columns = board.columns.slice(0, count);
      expect(boardSchema.safeParse({ ...board, columns }).success).toBe(true);
    }
  });

  it("rejects no columns or more than five", () => {
    const board = createEmptyBoard();
    expect(boardSchema.safeParse({ ...board, columns: [] }).success).toBe(
      false,
    );
    const sixth = { id: "extra", name: "Extra", cardIds: [] };
    expect(
      boardSchema.safeParse({ ...board, columns: [...board.columns, sixth] })
        .success,
    ).toBe(false);
  });

  it("rejects duplicate column ids", () => {
    const board = createEmptyBoard();
    board.columns[1].id = board.columns[0].id;
    expect(boardSchema.safeParse(board).success).toBe(false);
  });

  it("rejects a removed column's cards left behind", () => {
    const board = withCard();
    board.columns.shift();
    expect(boardSchema.safeParse(board).success).toBe(false);
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

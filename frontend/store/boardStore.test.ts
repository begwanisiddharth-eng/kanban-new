import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEY, useBoardStore } from "./boardStore";
import { COLUMN_IDS, createSeedBoard } from "./seedData";

const state = () => useBoardStore.getState();
const column = (id: string) => state().columns.find((c) => c.id === id)!;

beforeEach(() => {
  localStorage.clear();
  useBoardStore.setState(createSeedBoard());
});

describe("seed data", () => {
  it("has five default columns with 2-4 cards each", () => {
    const board = createSeedBoard();
    expect(board.columns.map((c) => c.name)).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Review",
      "Done",
    ]);
    for (const c of board.columns) {
      expect(c.cardIds.length).toBeGreaterThanOrEqual(2);
      expect(c.cardIds.length).toBeLessThanOrEqual(4);
      for (const id of c.cardIds) {
        expect(board.cards[id].title).not.toBe("");
        expect(board.cards[id].details).not.toBe("");
      }
    }
  });
});

describe("renameColumn", () => {
  it("renames and trims", () => {
    state().renameColumn("todo", "  Next up  ");
    expect(column("todo").name).toBe("Next up");
  });

  it("ignores blank names", () => {
    state().renameColumn("todo", "   ");
    expect(column("todo").name).toBe("To Do");
  });
});

describe("addCard", () => {
  it("appends a trimmed card to the column", () => {
    state().addCard("review", " New title ", " Some details ");
    const ids = column("review").cardIds;
    const card = state().cards[ids[ids.length - 1]];
    expect(card).toMatchObject({ title: "New title", details: "Some details" });
    expect(ids).toHaveLength(3);
  });

  it("rejects a blank title or details", () => {
    const before = state().cards;
    state().addCard("review", " ", "details");
    state().addCard("review", "title", "\n");
    expect(state().cards).toBe(before);
    expect(column("review").cardIds).toHaveLength(2);
  });
});

describe("updateCard", () => {
  it("updates title and details", () => {
    const id = column("backlog").cardIds[0];
    state().updateCard(id, "Edited", "Edited details");
    expect(state().cards[id]).toEqual({
      id,
      title: "Edited",
      details: "Edited details",
    });
  });

  it("rejects blank values", () => {
    const id = column("backlog").cardIds[0];
    const before = state().cards[id];
    state().updateCard(id, "", "x");
    state().updateCard(id, "x", "  ");
    expect(state().cards[id]).toBe(before);
  });
});

describe("deleteCard", () => {
  it("removes the card and its reference", () => {
    const id = column("done").cardIds[1];
    state().deleteCard(id);
    expect(state().cards[id]).toBeUndefined();
    expect(column("done").cardIds).not.toContain(id);
    expect(column("done").cardIds).toHaveLength(2);
  });
});

describe("moveCard", () => {
  it("reorders within a column", () => {
    const [a, b, c] = column("backlog").cardIds;
    state().moveCard(a, "backlog", 2);
    expect(column("backlog").cardIds).toEqual([b, c, a]);
  });

  it("moves to a position in another column", () => {
    const id = column("backlog").cardIds[0];
    const [x, y] = column("review").cardIds;
    state().moveCard(id, "review", 1);
    expect(column("review").cardIds).toEqual([x, id, y]);
    expect(column("backlog").cardIds).not.toContain(id);
  });

  it("moves into an empty column", () => {
    for (const id of column("review").cardIds) state().deleteCard(id);
    const id = column("todo").cardIds[0];
    state().moveCard(id, "review", 0);
    expect(column("review").cardIds).toEqual([id]);
  });

  it("keeps exactly five columns", () => {
    state().moveCard(column("todo").cardIds[0], "done", 0);
    expect(state().columns.map((c) => c.id)).toEqual([...COLUMN_IDS]);
  });
});

describe("persistence", () => {
  it("saves board data under the storage key", () => {
    state().renameColumn("done", "Shipped");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.columns[4].name).toBe("Shipped");
    expect(Object.keys(saved.state)).toEqual(["columns", "cards"]);
  });

  it("restores a saved board on rehydrate", async () => {
    const saved = createSeedBoard();
    saved.columns[0].name = "Ideas";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: saved, version: 0 }),
    );
    await useBoardStore.persist.rehydrate();
    expect(column("backlog").name).toBe("Ideas");
    expect(state().cards).toEqual(saved.cards);
  });
});

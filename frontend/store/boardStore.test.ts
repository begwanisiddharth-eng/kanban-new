import { beforeEach, describe, expect, it } from "vitest";

import { sampleBoard } from "@/tests/fixtures/sampleBoard";
import {
  createBoardStore,
  selectBoardData,
  selectIsDirty,
  type BoardStore,
} from "./boardStore";

let store: BoardStore;
const state = () => store.getState();
const column = (id: string) => state().columns.find((c) => c.id === id)!;
const dirty = () => selectIsDirty(state());

beforeEach(() => {
  store = createBoardStore(sampleBoard());
});

describe("initial state", () => {
  it("loads the given board and starts clean", () => {
    expect(state().boardId).toBe("board-1");
    expect(state().name).toBe("Sample board");
    expect(selectBoardData(state())).toEqual(sampleBoard().data);
    expect(dirty()).toBe(false);
  });
});

describe("renameColumn", () => {
  it("renames and trims", () => {
    state().renameColumn("todo", "  Next up  ");
    expect(column("todo").name).toBe("Next up");
    expect(dirty()).toBe(true);
  });

  it("ignores blank names", () => {
    state().renameColumn("todo", "   ");
    expect(column("todo").name).toBe("To Do");
    expect(dirty()).toBe(false);
  });
});

describe("addCard", () => {
  it("appends a trimmed card to the column", () => {
    state().addCard("review", " New title ", " Some details ");
    const ids = column("review").cardIds;
    expect(ids).toHaveLength(3);
    expect(state().cards[ids[2]]).toMatchObject({
      title: "New title",
      details: "Some details",
    });
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
    state().updateCard("backlog-1", "Edited", "Edited details");
    expect(state().cards["backlog-1"]).toEqual({
      id: "backlog-1",
      title: "Edited",
      details: "Edited details",
    });
  });

  it("rejects blank values", () => {
    const before = state().cards["backlog-1"];
    state().updateCard("backlog-1", "", "x");
    state().updateCard("backlog-1", "x", "  ");
    expect(state().cards["backlog-1"]).toBe(before);
  });
});

describe("deleteCard", () => {
  it("removes the card and its reference", () => {
    state().deleteCard("done-2");
    expect(state().cards["done-2"]).toBeUndefined();
    expect(column("done").cardIds).toEqual(["done-1", "done-3"]);
  });
});

describe("moveCard", () => {
  it("reorders within a column", () => {
    state().moveCard("backlog-1", "backlog", 2);
    expect(column("backlog").cardIds).toEqual([
      "backlog-2",
      "backlog-3",
      "backlog-1",
    ]);
  });

  it("moves to a position in another column", () => {
    state().moveCard("backlog-1", "review", 1);
    expect(column("review").cardIds).toEqual([
      "review-1",
      "backlog-1",
      "review-2",
    ]);
    expect(column("backlog").cardIds).not.toContain("backlog-1");
  });

  it("moves into an empty column", () => {
    state().deleteCard("review-1");
    state().deleteCard("review-2");
    state().moveCard("todo-1", "review", 0);
    expect(column("review").cardIds).toEqual(["todo-1"]);
  });

  it("is not a change when a card is dropped where it was", () => {
    state().moveCard("todo-2", "todo", 1);
    expect(dirty()).toBe(false);
  });
});

describe("save tracking", () => {
  it("markSaved records the saved data", () => {
    state().renameColumn("done", "Shipped");
    const data = selectBoardData(state());
    state().addCard("done", "After save started", "Still unsaved");
    state().markSaved(data);
    expect(dirty()).toBe(true);
    state().markSaved(selectBoardData(state()));
    expect(dirty()).toBe(false);
  });

  it("is clean again when an edit is undone by hand", () => {
    state().renameColumn("done", "Shipped");
    state().renameColumn("done", "Done");
    expect(dirty()).toBe(false);
  });

  it("revert restores the last saved data", () => {
    state().deleteCard("backlog-1");
    state().renameColumn("todo", "Next");
    state().revert();
    expect(selectBoardData(state())).toEqual(sampleBoard().data);
    expect(dirty()).toBe(false);
  });

  it("load replaces the board and its saved state", () => {
    state().deleteCard("backlog-1");
    const other = { ...sampleBoard(), id: "board-2", name: "Other" };
    other.data.columns[0].name = "Ideas";
    state().load(other);
    expect(state()).toMatchObject({ boardId: "board-2", name: "Other" });
    expect(column("backlog").name).toBe("Ideas");
    expect(dirty()).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { createBoardStore, selectIsDirty } from "@/store/boardStore";
import { sampleBoard } from "@/tests/fixtures/sampleBoard";
import { applyAssistantActions } from "./assistantActions";

const setup = () => createBoardStore(sampleBoard());

describe("applyAssistantActions", () => {
  it("applies each action and describes it", () => {
    const store = setup();
    const lines = applyAssistantActions(store.getState, [
      { type: "add_card", columnId: "todo", title: " Plan ", details: "Q4" },
      { type: "move_card", cardId: "backlog-1", columnId: "done", position: 0 },
      { type: "update_card", cardId: "review-1", details: "Approved" },
      { type: "delete_card", cardId: "done-3" },
      { type: "rename_column", columnId: "review", name: "QA" },
    ]);
    expect(lines).toEqual([
      'Added "Plan" to To Do',
      'Moved "Research competitor onboarding flows" to Done',
      'Updated "Password reset email template"',
      'Deleted "Onboard two new support agents"',
      "Renamed Review to QA",
    ]);
    const state = store.getState();
    expect(state.columns[1].cardIds).toHaveLength(4);
    expect(state.columns[4].cardIds).toEqual(["backlog-1", "done-1", "done-2"]);
    expect(state.cards["review-1"].details).toBe("Approved");
    expect(state.columns[3].name).toBe("QA");
    expect(selectIsDirty(state)).toBe(true);
  });

  it("moves to the end when no position is given", () => {
    const store = setup();
    applyAssistantActions(store.getState, [
      { type: "move_card", cardId: "todo-1", columnId: "todo" },
    ]);
    expect(store.getState().columns[1].cardIds).toEqual([
      "todo-2",
      "todo-3",
      "todo-1",
    ]);
  });

  it("skips actions that refer to missing cards or columns", () => {
    const store = setup();
    const lines = applyAssistantActions(store.getState, [
      { type: "add_card", columnId: "nope", title: "A", details: "B" },
      { type: "update_card", cardId: "ghost", title: "X" },
      { type: "move_card", cardId: "ghost", columnId: "done" },
      { type: "delete_card", cardId: "ghost" },
      { type: "rename_column", columnId: "nope", name: "X" },
    ]);
    expect(lines).toEqual([]);
    expect(selectIsDirty(store.getState())).toBe(false);
  });

  it("adds and removes columns, naming the cards that went", () => {
    const store = setup();
    const lines = applyAssistantActions(store.getState, [
      { type: "remove_column", columnId: "review" },
      { type: "add_column", columnId: "col-1", name: " Blocked " },
      { type: "move_card", cardId: "todo-1", columnId: "col-1" },
      { type: "add_column", columnId: "col-2", name: "Too many" },
      { type: "remove_column", columnId: "ghost" },
    ]);
    expect(lines).toEqual([
      "Removed column Review and its 2 cards",
      "Added column Blocked",
      'Moved "Set up error monitoring" to Blocked',
    ]);
    const state = store.getState();
    expect(state.columns.map((c) => c.name)).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Done",
      "Blocked",
    ]);
    expect(state.columns[4].cardIds).toEqual(["todo-1"]);
    expect(state.cards["review-1"]).toBeUndefined();
  });

  it("never removes the last column", () => {
    const store = setup();
    const ids = ["backlog", "todo", "in-progress", "review", "done"];
    const lines = applyAssistantActions(
      store.getState,
      ids.map((columnId) => ({ type: "remove_column" as const, columnId })),
    );
    expect(lines).toHaveLength(4);
    expect(store.getState().columns).toHaveLength(1);
  });
});

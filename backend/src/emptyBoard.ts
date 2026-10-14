import type { Board } from "./schema";

type Column = Board["columns"][number];

const DEFAULT_COLUMNS = [
  ["backlog", "Backlog"],
  ["todo", "To Do"],
  ["in-progress", "In Progress"],
  ["review", "Review"],
  ["done", "Done"],
] as const;

export function createEmptyBoard(): Board {
  return {
    columns: DEFAULT_COLUMNS.map(([id, name]): Column => ({
      id,
      name,
      cardIds: [],
    })),
    cards: {},
  };
}

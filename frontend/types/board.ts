export type Card = { id: string; title: string; details: string };

export type Column = { id: string; name: string; cardIds: string[] };

export type Board = {
  columns: Column[];
  cards: Record<string, Card>;
};

/** A board keeps between one and five columns. */
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 5;

export type BoardSummary = { id: string; name: string };

export type SavedBoard = BoardSummary & { data: Board };

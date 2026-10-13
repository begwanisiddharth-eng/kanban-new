export type Card = { id: string; title: string; details: string };

export type Column = { id: string; name: string; cardIds: string[] };

export type Board = {
  columns: [Column, Column, Column, Column, Column];
  cards: Record<string, Card>;
};

export type BoardSummary = { id: string; name: string };

export type SavedBoard = BoardSummary & { data: Board };

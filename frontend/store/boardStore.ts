import { createStore } from "zustand";

import {
  MAX_COLUMNS,
  MIN_COLUMNS,
  type Board,
  type Card,
  type SavedBoard,
} from "@/types/board";

type BoardActions = {
  renameColumn: (columnId: string, name: string) => void;
  /** Adds an empty column at the end; returns its id, or null at the limit. */
  addColumn: (name: string, id?: string) => string | null;
  /** Removes a column and its cards, unless it is the last one. */
  removeColumn: (columnId: string) => void;
  addCard: (columnId: string, title: string, details: string) => void;
  updateCard: (cardId: string, title: string, details: string) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void;
  load: (board: SavedBoard) => void;
  markSaved: (data: Board) => void;
  revert: () => void;
};

export type BoardState = Board & {
  boardId: string;
  name: string;
  savedSnapshot: string;
} & BoardActions;

const MAX_COLUMN_NAME = 60;

const snapshot = ({ columns, cards }: Board) =>
  JSON.stringify({ columns, cards });

export const selectBoardData = ({ columns, cards }: BoardState): Board => ({
  columns,
  cards,
});

export const selectIsDirty = (s: BoardState) => snapshot(s) !== s.savedSnapshot;

function cleanCard(title: string, details: string) {
  const card = { title: title.trim(), details: details.trim() };
  return card.title && card.details ? card : null;
}

function mapColumns(
  columns: Board["columns"],
  fn: (column: Board["columns"][number]) => Board["columns"][number],
) {
  return columns.map(fn);
}

const loaded = (board: SavedBoard) => ({
  boardId: board.id,
  name: board.name,
  ...board.data,
  savedSnapshot: snapshot(board.data),
});

export const createBoardStore = (board: SavedBoard) =>
  createStore<BoardState>()((set, get) => ({
    ...loaded(board),

    renameColumn: (columnId, name) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > MAX_COLUMN_NAME) return;
      set((s) => ({
        columns: mapColumns(s.columns, (c) =>
          c.id === columnId ? { ...c, name: trimmed } : c,
        ),
      }));
    },

    addColumn: (name, id = crypto.randomUUID()) => {
      const trimmed = name.trim();
      const { columns } = get();
      if (
        !trimmed ||
        trimmed.length > MAX_COLUMN_NAME ||
        columns.length >= MAX_COLUMNS ||
        columns.some((c) => c.id === id)
      )
        return null;
      set({ columns: [...columns, { id, name: trimmed, cardIds: [] }] });
      return id;
    },

    removeColumn: (columnId) =>
      set((s) => {
        const column = s.columns.find((c) => c.id === columnId);
        if (!column || s.columns.length <= MIN_COLUMNS) return s;
        const cards = { ...s.cards };
        for (const id of column.cardIds) delete cards[id];
        return { cards, columns: s.columns.filter((c) => c !== column) };
      }),

    addCard: (columnId, title, details) => {
      const fields = cleanCard(title, details);
      if (!fields) return;
      const card: Card = { id: crypto.randomUUID(), ...fields };
      set((s) => ({
        cards: { ...s.cards, [card.id]: card },
        columns: mapColumns(s.columns, (c) =>
          c.id === columnId ? { ...c, cardIds: [...c.cardIds, card.id] } : c,
        ),
      }));
    },

    updateCard: (cardId, title, details) => {
      const fields = cleanCard(title, details);
      if (!fields) return;
      set((s) => ({
        cards: { ...s.cards, [cardId]: { ...s.cards[cardId], ...fields } },
      }));
    },

    deleteCard: (cardId) =>
      set((s) => {
        const cards = { ...s.cards };
        delete cards[cardId];
        return {
          cards,
          columns: mapColumns(s.columns, (c) => ({
            ...c,
            cardIds: c.cardIds.filter((id) => id !== cardId),
          })),
        };
      }),

    moveCard: (cardId, toColumnId, toIndex) =>
      set((s) => ({
        columns: mapColumns(s.columns, (c) => {
          const cardIds = c.cardIds.filter((id) => id !== cardId);
          if (c.id === toColumnId) cardIds.splice(toIndex, 0, cardId);
          return { ...c, cardIds };
        }),
      })),

    load: (board) => set(loaded(board)),

    markSaved: (data) => set({ savedSnapshot: snapshot(data) }),

    revert: () => set((s) => JSON.parse(s.savedSnapshot) as Board),
  }));

export type BoardStore = ReturnType<typeof createBoardStore>;

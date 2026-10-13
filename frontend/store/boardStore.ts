import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Board, Card } from "@/types/board";
import { createSeedBoard } from "./seedData";

export const STORAGE_KEY = "kanban-board-v1";

type BoardActions = {
  renameColumn: (columnId: string, name: string) => void;
  addCard: (columnId: string, title: string, details: string) => void;
  updateCard: (cardId: string, title: string, details: string) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void;
};

export type BoardState = Board & BoardActions;

function cleanCard(title: string, details: string) {
  const card = { title: title.trim(), details: details.trim() };
  return card.title && card.details ? card : null;
}

function mapColumns(
  columns: Board["columns"],
  fn: (column: Board["columns"][number]) => Board["columns"][number],
) {
  return columns.map(fn) as Board["columns"];
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      ...createSeedBoard(),

      renameColumn: (columnId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          columns: mapColumns(s.columns, (c) =>
            c.id === columnId ? { ...c, name: trimmed } : c,
          ),
        }));
      },

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
    }),
    {
      name: STORAGE_KEY,
      partialize: ({ columns, cards }) => ({ columns, cards }),
      skipHydration: true,
    },
  ),
);

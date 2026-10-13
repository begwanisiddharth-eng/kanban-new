"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import type { SavedBoard } from "@/types/board";
import {
  createBoardStore,
  type BoardState,
  type BoardStore,
} from "./boardStore";

const BoardStoreContext = createContext<BoardStore | null>(null);

export function BoardStoreProvider({
  board,
  children,
}: {
  board: SavedBoard;
  children: ReactNode;
}) {
  const [store] = useState(() => createBoardStore(board));
  return <BoardStoreContext value={store}>{children}</BoardStoreContext>;
}

export function useBoardStoreApi() {
  const store = use(BoardStoreContext);
  if (!store) throw new Error("useBoardStore needs a BoardStoreProvider");
  return store;
}

export function useBoardStore<T>(selector: (state: BoardState) => T) {
  return useStore(useBoardStoreApi(), selector);
}

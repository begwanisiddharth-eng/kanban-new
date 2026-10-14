import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { Board } from "@/components/Board";
import type { BoardState, BoardStore } from "@/store/boardStore";
import {
  BoardStoreProvider,
  useBoardStoreApi,
} from "@/store/BoardStoreProvider";
import type { SavedBoard } from "@/types/board";
import { sampleBoard } from "./fixtures/sampleBoard";

export function renderWithBoard(
  ui: ReactNode = <Board />,
  board: SavedBoard = sampleBoard(),
) {
  let store: BoardStore | undefined;
  function Capture() {
    store = useBoardStoreApi();
    return null;
  }
  const result = render(
    <BoardStoreProvider board={board}>
      <Capture />
      {ui}
    </BoardStoreProvider>,
  );
  return { ...result, state: (): BoardState => store!.getState() };
}

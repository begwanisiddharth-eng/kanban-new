import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api, ApiError, isSessionExpired } from "@/lib/api";
import { selectBoardData, selectIsDirty } from "@/store/boardStore";
import { useBoardStore, useBoardStoreApi } from "@/store/BoardStoreProvider";
import type { BoardSummary, SavedBoard } from "@/types/board";

// Also backend/src/boards.ts; change both together.
export const MAX_BOARDS = 3;

export function useBoardSession(initialBoards: BoardSummary[]) {
  const store = useBoardStoreApi();
  const router = useRouter();
  const dirty = useBoardStore(selectIsDirty);
  const [boards, setBoards] = useState(initialBoards);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (e) {
      if (isSessionExpired(e)) expire();
      else
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const expire = () => router.replace("/signin?reason=expired");

  const timeOut = async () => {
    await api.signOut().catch(() => undefined);
    router.replace("/signin?reason=timeout");
  };

  function show(board: SavedBoard) {
    store.getState().load(board);
    window.history.replaceState(null, "", `?board=${board.id}`);
  }

  const save = () =>
    run(async () => {
      const state = store.getState();
      const data = selectBoardData(state);
      await api.saveBoard(state.boardId, data);
      state.markSaved(data);
    });

  const discard = () => store.getState().revert();

  const switchTo = (id: string) =>
    run(async () => show(await api.getBoard(id)));

  const create = (name: string) =>
    run(async () => {
      const board = await api.createBoard(name);
      setBoards((list) => [...list, { id: board.id, name: board.name }]);
      show(board);
    });

  const remove = () =>
    run(async () => {
      const id = store.getState().boardId;
      await api.deleteBoard(id);
      const rest = boards.filter((b) => b.id !== id);
      setBoards(rest);
      show(await api.getBoard(rest[0].id));
    });

  const signOut = () =>
    run(async () => {
      await api.signOut();
      router.replace("/signin");
    });

  const guard = (action: () => void) =>
    dirty ? setPending(() => action) : action();

  const continuePending = () => {
    const action = pending;
    setPending(null);
    action?.();
  };

  return {
    boards,
    dirty,
    busy,
    error,
    save,
    discard,
    switchTo,
    create,
    remove,
    signOut,
    expire,
    timeOut,
    guard,
    unsaved: {
      open: pending !== null,
      saveAndContinue: async () => {
        if (await save()) continuePending();
      },
      discardAndContinue: () => {
        discard();
        continuePending();
      },
      cancel: () => setPending(null),
    },
  };
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BoardApp } from "@/components/BoardApp";
import { BoardSkeleton } from "@/components/BoardSkeleton";
import { api, ApiError, type User } from "@/lib/api";
import { BoardStoreProvider } from "@/store/BoardStoreProvider";
import type { BoardSummary, SavedBoard } from "@/types/board";

type Loaded = { user: User; boards: BoardSummary[]; board: SavedBoard };

async function load(): Promise<Loaded> {
  const [user, boards] = await Promise.all([api.me(), api.listBoards()]);
  const requested = new URLSearchParams(window.location.search).get("board");
  const id = boards.find((b) => b.id === requested)?.id ?? boards[0].id;
  return { user, boards, board: await api.getBoard(id) };
}

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    load().then(setData, (e) =>
      e instanceof ApiError && e.status === 401
        ? router.replace("/signin")
        : setFailed(true),
    );
  }, [router]);

  if (failed) {
    return (
      <p role="alert" className="text-navy p-10">
        Your boards could not be loaded. Check that the server is running and
        reload the page.
      </p>
    );
  }
  if (!data) return <BoardSkeleton />;
  return (
    <BoardStoreProvider board={data.board}>
      <BoardApp email={data.user.email} boards={data.boards} />
    </BoardStoreProvider>
  );
}

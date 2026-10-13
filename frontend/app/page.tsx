import { SquareKanban } from "lucide-react";

import { Board } from "@/components/Board";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 px-6 pt-10 pb-8 lg:px-10">
        <div className="bg-navy grid size-10 place-items-center rounded-xl text-white shadow-sm">
          <SquareKanban className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-navy text-xl font-bold tracking-tight">Kanban</h1>
          <p className="text-muted text-sm">
            Drag cards between columns to track progress.
          </p>
        </div>
      </header>
      <Board />
    </main>
  );
}

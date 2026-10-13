import { Board } from "@/components/Board";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="px-6 pt-10 pb-8 lg:px-10">
        <h1 className="text-navy text-2xl font-bold tracking-tight">Kanban</h1>
        <p className="text-muted mt-1 text-sm">
          Drag cards between columns to track progress.
        </p>
      </header>
      <Board />
    </main>
  );
}

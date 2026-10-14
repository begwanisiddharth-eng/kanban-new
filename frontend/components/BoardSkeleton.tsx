export function BoardSkeleton() {
  return (
    <main className="flex min-h-screen flex-col" aria-busy>
      <div className="px-6 pt-8 pb-6 lg:px-10">
        <div className="bg-column h-10 w-48 animate-pulse rounded-xl" />
        <div className="bg-column mt-5 h-9 w-full max-w-md animate-pulse rounded-lg" />
      </div>
      <div className="board-grid" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-column h-96 animate-pulse rounded-2xl" />
        ))}
      </div>
    </main>
  );
}

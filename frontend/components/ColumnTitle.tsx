"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { useBoardStore } from "@/store/boardStore";
import type { Column } from "@/types/board";

export function ColumnTitle({ column }: { column: Column }) {
  const renameColumn = useBoardStore((s) => s.renameColumn);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) renameColumn(column.id, draft);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Input
        aria-label="Column name"
        value={draft}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        className="h-8 px-2 text-sm font-semibold"
      />
    );
  }

  return (
    <h2>
      <button
        type="button"
        className="text-navy hover:bg-surface/70 focus-visible:ring-ring/50 -mx-2 w-[calc(100%+1rem)] truncate rounded-md px-2 py-1 text-left text-sm font-semibold tracking-tight transition-colors outline-none focus-visible:ring-[3px]"
        title="Rename column"
        aria-label={`Rename column: ${column.name}`}
        onClick={() => setDraft(column.name)}
      >
        {column.name}
      </button>
    </h2>
  );
}

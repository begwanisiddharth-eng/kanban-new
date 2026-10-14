"use client";

import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useBoardStore } from "@/store/BoardStoreProvider";
import type { Column } from "@/types/board";

export function ColumnTitle({ column }: { column: Column }) {
  const renameColumn = useBoardStore((s) => s.renameColumn);
  const [draft, setDraft] = useState<string | null>(null);
  const refocus = useRef(false);

  const commit = () => {
    if (draft !== null) renameColumn(column.id, draft);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Input
        aria-label="Column name"
        value={draft}
        maxLength={60}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== "Escape") return;
          e.preventDefault();
          refocus.current = true;
          if (e.key === "Enter") commit();
          else setDraft(null);
        }}
        className="-ml-2 h-7 w-[calc(100%+0.5rem)] px-2 text-sm font-semibold md:text-sm"
      />
    );
  }

  return (
    <h2>
      <button
        ref={(el) => {
          if (el && refocus.current) el.focus();
          refocus.current = false;
        }}
        type="button"
        className="text-navy hover:bg-surface/70 focus-visible:ring-ring/50 -ml-2 w-[calc(100%+0.5rem)] truncate rounded-md px-2 py-1 text-left text-sm font-semibold tracking-tight transition-colors outline-none focus-visible:ring-[3px]"
        title="Rename column"
        aria-label={`Rename column: ${column.name}`}
        onClick={() => setDraft(column.name)}
      >
        {column.name}
      </button>
    </h2>
  );
}

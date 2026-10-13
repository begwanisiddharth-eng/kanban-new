"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/BoardStoreProvider";
import type { Column as ColumnType } from "@/types/board";
import { Card } from "./Card";
import { CardEditor } from "./CardEditor";
import { ColumnTitle } from "./ColumnTitle";

export function Column({ column }: { column: ColumnType }) {
  const cards = useBoardStore((s) => s.cards);
  const addCard = useBoardStore((s) => s.addCard);
  const [adding, setAdding] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      aria-label={column.name}
      className={cn(
        "bg-column flex h-[34rem] min-h-0 snap-start flex-col rounded-2xl p-3 transition-shadow duration-200 xl:h-full",
        isOver && "ring-accent/50 ring-2",
      )}
    >
      <header className="mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ColumnTitle column={column} />
          </div>
          <span
            className="bg-surface text-navy/70 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
            aria-label={`${column.cardIds.length} cards`}
          >
            {column.cardIds.length}
          </span>
        </div>
        <div className="bg-accent mt-2 h-0.5 w-10 rounded-full" />
      </header>
      <SortableContext
        id={column.id}
        items={column.cardIds}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          className="empty:border-border empty:before:text-muted -mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 py-1 empty:mx-0 empty:items-center empty:justify-center empty:rounded-xl empty:border-2 empty:border-dashed empty:before:text-sm empty:before:content-['No_cards_yet']"
        >
          {column.cardIds.map((id) => (
            <Card key={id} card={cards[id]} />
          ))}
        </ul>
      </SortableContext>
      <Button
        variant="ghost"
        className="text-secondary hover:bg-secondary/10 hover:text-secondary mt-3 justify-start"
        onClick={() => setAdding(true)}
        aria-label={`Add card to ${column.name}`}
      >
        <Plus />
        Add card
      </Button>
      <CardEditor
        open={adding}
        onOpenChange={setAdding}
        heading={`New card in ${column.name}`}
        onSave={(title, details) => addCard(column.id, title, details)}
      />
    </section>
  );
}

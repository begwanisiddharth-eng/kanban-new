"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/BoardStoreProvider";
import { MIN_COLUMNS, type Column as ColumnType } from "@/types/board";
import { Card } from "./Card";
import { CardEditor } from "./CardEditor";
import { ColumnTitle } from "./ColumnTitle";
import { ConfirmDialog } from "./ConfirmDialog";

/** Focuses a column's title or remove button once it has rendered. */
export function focusColumn(id: string, control: "title" | "remove") {
  requestAnimationFrame(() => {
    const section = document.querySelector(
      `[data-column-id="${CSS.escape(id)}"]`,
    );
    const target =
      control === "title"
        ? section?.querySelector("h2 button")
        : section?.querySelector("[data-remove-column]");
    if (target instanceof HTMLElement) target.focus();
  });
}

export function Column({ column }: { column: ColumnType }) {
  const cards = useBoardStore((s) => s.cards);
  const addCard = useBoardStore((s) => s.addCard);
  const removeColumn = useBoardStore((s) => s.removeColumn);
  const isLast = useBoardStore((s) => s.columns.length <= MIN_COLUMNS);
  // The column that takes this one's place, to keep keyboard focus nearby.
  const neighbour = useBoardStore((s) => {
    const i = s.columns.findIndex((c) => c.id === column.id);
    return (s.columns[i + 1] ?? s.columns[i - 1])?.id;
  });
  const removed = useRef(false);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const count = column.cardIds.length;

  const confirmRemove = () => {
    removed.current = true;
    removeColumn(column.id);
  };

  // An empty column goes at once; one with cards asks first.
  const remove = () => {
    if (count) return setConfirming(true);
    removeColumn(column.id);
    if (neighbour) focusColumn(neighbour, "remove");
  };
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      aria-label={column.name}
      data-column-id={column.id}
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
            aria-label={`${count} cards`}
          >
            {count}
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
      <div className="mt-3 flex items-center gap-1">
        <Button
          variant="ghost"
          className="text-secondary hover:bg-secondary/10 hover:text-secondary flex-1 justify-start"
          onClick={() => setAdding(true)}
          aria-label={`Add card to ${column.name}`}
        >
          <Plus />
          Add card
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-navy/60 hover:text-destructive hover:bg-destructive/10"
          aria-label={`Remove column: ${column.name}`}
          data-remove-column
          title={isLast ? "A board needs at least one column" : "Remove column"}
          disabled={isLast}
          onClick={remove}
        >
          <Trash2 />
        </Button>
      </div>
      <CardEditor
        open={adding}
        onOpenChange={setAdding}
        heading={`New card in ${column.name}`}
        onSave={(title, details) => addCard(column.id, title, details)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove this column?"
        description={`"${column.name}" and its ${count === 1 ? "card" : `${count} cards`} will be removed.`}
        confirmLabel="Remove column"
        onConfirm={confirmRemove}
        onCloseAutoFocus={(e) => {
          if (!removed.current || !neighbour) return;
          e.preventDefault();
          focusColumn(neighbour, "remove");
        }}
      />
    </section>
  );
}

"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/boardStore";
import type { Card as CardType } from "@/types/board";
import { CardBody } from "./CardBody";
import { CardEditor } from "./CardEditor";
import { ConfirmDialog } from "./ConfirmDialog";

export function Card({ card }: { card: CardType }) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, attributes: { role: "listitem" } });

  const actions = (
    <div className="-mt-1 -mr-2 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-primary"
        aria-label={`Edit card: ${card.title}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-destructive"
        aria-label={`Delete card: ${card.title}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>
    </div>
  );

  return (
    <>
      <li
        ref={(node) => {
          setNodeRef(node);
          setActivatorNodeRef(node);
        }}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className="focus-visible:ring-ring/60 cursor-grab touch-manipulation rounded-xl outline-none focus-visible:ring-[3px]"
        aria-label={card.title}
        {...attributes}
        {...listeners}
      >
        <CardBody
          card={card}
          actions={actions}
          className={cn(
            "transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md",
            isDragging &&
              "border-accent bg-accent/10 border-2 border-dashed shadow-none [&>*]:invisible",
          )}
        />
      </li>
      <CardEditor
        open={editing}
        onOpenChange={setEditing}
        heading="Edit card"
        card={card}
        onSave={(title, details) => updateCard(card.id, title, details)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this card?"
        description={`"${card.title}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => deleteCard(card.id)}
      />
    </>
  );
}

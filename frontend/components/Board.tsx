"use client";

import { useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { useBoardDnd } from "@/hooks/useBoardDnd";
import { useBoardStore } from "@/store/BoardStoreProvider";
import { MAX_COLUMNS } from "@/types/board";
import { AddColumnDialog } from "./AddColumnDialog";
import { CardBody } from "./CardBody";
import { Column } from "./Column";

export function Board() {
  const dnd = useBoardDnd();
  const addColumn = useBoardStore((s) => s.addColumn);
  const [adding, setAdding] = useState(false);

  return (
    <DndContext
      id="board"
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      accessibility={{ announcements: dnd.announcements }}
      onDragStart={dnd.onDragStart}
      onDragOver={dnd.onDragOver}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
    >
      <div className="board-grid">
        {dnd.columns.map((column) => (
          <Column key={column.id} column={column} />
        ))}
        {dnd.columns.length < MAX_COLUMNS && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-border text-secondary hover:border-secondary hover:bg-secondary/5 focus-visible:ring-ring/50 flex h-[34rem] snap-start flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] xl:h-full"
          >
            <Plus className="size-5" aria-hidden />
            Add column
          </button>
        )}
      </div>
      <AddColumnDialog
        open={adding}
        onOpenChange={setAdding}
        onAdd={(name) => addColumn(name)}
      />
      <DragOverlay>
        {dnd.activeCard && (
          <div className="cursor-grabbing">
            <CardBody
              card={dnd.activeCard}
              className="ring-accent/60 rotate-2 shadow-xl ring-2"
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";

import { useBoardDnd } from "@/hooks/useBoardDnd";
import { CardBody } from "./CardBody";
import { Column } from "./Column";

export function Board() {
  const dnd = useBoardDnd();

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
      </div>
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

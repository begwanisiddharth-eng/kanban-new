"use client";

import { useEffect, useState } from "react";
import { closestCorners, DndContext, DragOverlay } from "@dnd-kit/core";

import { useBoardDnd } from "@/hooks/useBoardDnd";
import { useBoardStore } from "@/store/boardStore";
import { CardBody } from "./CardBody";
import { Column } from "./Column";

export function Board() {
  const [hydrated, setHydrated] = useState(false);
  const dnd = useBoardDnd();

  useEffect(() => {
    void Promise.resolve(useBoardStore.persist.rehydrate()).then(() =>
      setHydrated(true),
    );
  }, []);

  if (!hydrated) {
    return (
      <div className="board-grid" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-column h-96 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      id="board"
      sensors={dnd.sensors}
      collisionDetection={closestCorners}
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
          <CardBody
            card={dnd.activeCard}
            className="ring-accent/60 rotate-2 cursor-grabbing shadow-xl ring-2"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

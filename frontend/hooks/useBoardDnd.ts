import { useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { useBoardStore } from "@/store/boardStore";
import type { Board } from "@/types/board";

type Columns = Board["columns"];

function findColumn(columns: Columns, id: string) {
  return columns.find((c) => c.id === id || c.cardIds.includes(id));
}

export function useBoardDnd() {
  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);
  const moveCard = useBoardStore((s) => s.moveCard);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Columns | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reset = () => {
    setActiveId(null);
    setPreview(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setPreview(columns);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setPreview((cols) => {
      if (!cols) return cols;
      const activeCard = String(active.id);
      const from = findColumn(cols, activeCard);
      const to = findColumn(cols, String(over.id));
      if (!from || !to || from.id === to.id) return cols;
      const overIndex = to.cardIds.indexOf(String(over.id));
      const translated = active.rect.current.translated;
      const below =
        translated && translated.top > over.rect.top + over.rect.height / 2;
      const index =
        overIndex === -1 ? to.cardIds.length : overIndex + (below ? 1 : 0);
      return cols.map((c) => {
        if (c.id === from.id)
          return { ...c, cardIds: c.cardIds.filter((id) => id !== activeCard) };
        if (c.id === to.id) {
          const cardIds = [...c.cardIds];
          cardIds.splice(index, 0, activeCard);
          return { ...c, cardIds };
        }
        return c;
      }) as Columns;
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const cols = preview;
    reset();
    if (!over || !cols) return;
    const activeCard = String(active.id);
    const to = findColumn(cols, String(over.id));
    if (!to) return;
    const overIndex = to.cardIds.indexOf(String(over.id));
    const index = overIndex === -1 ? to.cardIds.indexOf(activeCard) : overIndex;
    moveCard(activeCard, to.id, index);
  };

  const describe = (id: string | number | undefined) => {
    if (id === undefined) return "";
    const column = findColumn(preview ?? columns, String(id));
    const card = cards[String(id)];
    if (!column) return "";
    if (!card) return `column ${column.name}`;
    const position = column.cardIds.indexOf(card.id) + 1;
    return `position ${position} of ${column.cardIds.length} in ${column.name}`;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up card ${cards[String(active.id)]?.title}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Card ${cards[String(active.id)]?.title} moved to ${describe(active.id)}.`
        : "",
    onDragEnd: ({ active, over }) =>
      over
        ? `Card ${cards[String(active.id)]?.title} dropped at ${describe(active.id)}.`
        : "Card dropped.",
    onDragCancel: ({ active }) =>
      `Moving card ${cards[String(active.id)]?.title} was cancelled.`,
  };

  return {
    columns: preview ?? columns,
    activeCard: activeId ? cards[activeId] : null,
    sensors,
    announcements,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: reset,
  };
}

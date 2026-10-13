import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Card } from "@/types/board";

type CardBodyProps = {
  card: Card;
  actions?: ReactNode;
  className?: string;
};

export function CardBody({ card, actions, className }: CardBodyProps) {
  return (
    <div
      className={cn(
        "group border-border bg-surface relative rounded-xl border p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <h3 className="text-navy min-w-0 flex-1 text-[15px] leading-snug font-semibold break-words">
          {card.title}
        </h3>
        {actions}
      </div>
      <p className="text-muted mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line">
        {card.details}
      </p>
    </div>
  );
}

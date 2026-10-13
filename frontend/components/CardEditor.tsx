"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Card } from "@/types/board";
import { CardForm } from "./CardForm";

type CardEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  card?: Pick<Card, "title" | "details">;
  onSave: (title: string, details: string) => void;
};

export function CardEditor({
  open,
  onOpenChange,
  heading,
  card,
  onSave,
}: CardEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            Both a title and details are required.
          </DialogDescription>
        </DialogHeader>
        <CardForm
          initial={card ?? { title: "", details: "" }}
          onCancel={() => onOpenChange(false)}
          onSubmit={(title, details) => {
            onSave(title, details);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

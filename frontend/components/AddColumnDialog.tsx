"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_COLUMNS } from "@/types/board";
import { focusColumn } from "./Column";

type AddColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Adds the column and returns its id, or null if it was not added. */
  onAdd: (name: string) => string | null;
};

export function AddColumnDialog({
  open,
  onOpenChange,
  onAdd,
}: AddColumnDialogProps) {
  const [name, setName] = useState("");
  // The tile that opened the dialog is gone once the fifth column is added,
  // so focus moves to the new column instead.
  const added = useRef<string | null>(null);

  const close = () => {
    onOpenChange(false);
    setName("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent
        onCloseAutoFocus={(e) => {
          if (!added.current) return;
          e.preventDefault();
          focusColumn(added.current, "title");
          added.current = null;
        }}
      >
        <DialogHeader>
          <DialogTitle>New column</DialogTitle>
          <DialogDescription>
            It is added at the end, with no cards. A board can have up to{" "}
            {MAX_COLUMNS} columns.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            added.current = onAdd(name);
            close();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="column-name">Column name</Label>
            <Input
              id="column-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blocked"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

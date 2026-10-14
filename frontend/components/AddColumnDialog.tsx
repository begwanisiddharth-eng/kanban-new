"use client";

import { useState } from "react";

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

type AddColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
};

export function AddColumnDialog({
  open,
  onOpenChange,
  onAdd,
}: AddColumnDialogProps) {
  const [name, setName] = useState("");

  const close = () => {
    onOpenChange(false);
    setName("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
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
            onAdd(name);
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

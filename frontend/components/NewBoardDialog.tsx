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

type NewBoardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remaining: number;
  busy: boolean;
  onCreate: (name: string) => Promise<boolean>;
};

export function NewBoardDialog({
  open,
  onOpenChange,
  remaining,
  busy,
  onCreate,
}: NewBoardDialogProps) {
  const [name, setName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>
            It starts with the five default columns and no cards. You can create{" "}
            {remaining} more {remaining === 1 ? "board" : "boards"}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onCreate(name)) {
              onOpenChange(false);
              setName("");
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="board-name">Board name</Label>
            <Input
              id="board-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing launch"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Create board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

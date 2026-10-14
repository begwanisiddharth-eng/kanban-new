"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_BOARDS } from "@/hooks/useBoardSession";
import type { BoardSummary } from "@/types/board";
import { AccountMenu } from "./AccountMenu";
import { BoardSwitcher } from "./BoardSwitcher";

type BoardToolbarProps = {
  boards: BoardSummary[];
  boardId: string;
  email: string;
  dirty: boolean;
  busy: boolean;
  error: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onSignOut: () => void;
  onChangePassword: () => void;
};

export function BoardToolbar(props: BoardToolbarProps) {
  const { boards, dirty, busy, error } = props;
  const atLimit = boards.length >= MAX_BOARDS;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <BoardSwitcher
          boards={boards}
          value={props.boardId}
          disabled={busy}
          onChange={props.onSwitch}
        />
        <Button
          variant="outline"
          onClick={props.onNew}
          disabled={busy || atLimit}
          title={
            atLimit ? `You can have up to ${MAX_BOARDS} boards` : undefined
          }
        >
          <Plus />
          New board
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted hover:text-destructive size-9"
          aria-label="Delete board"
          title={
            boards.length <= 1
              ? "Your only board cannot be deleted"
              : "Delete board"
          }
          onClick={props.onDelete}
          disabled={busy || boards.length <= 1}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <p
          role={error ? "alert" : "status"}
          className={cn(
            "basis-full text-sm sm:basis-auto",
            error ? "text-destructive" : "text-muted",
          )}
        >
          {error ?? (dirty ? "Unsaved changes" : "All changes saved")}
        </p>
        <Button
          variant="outline"
          onClick={props.onDiscard}
          disabled={busy || !dirty}
        >
          Discard changes
        </Button>
        <Button onClick={props.onSave} disabled={busy || !dirty}>
          Save
        </Button>
        <span className="bg-border mx-1 hidden h-6 w-px sm:block" />
        <AccountMenu
          email={props.email}
          disabled={busy}
          onChangePassword={props.onChangePassword}
          onSignOut={props.onSignOut}
        />
      </div>
    </div>
  );
}

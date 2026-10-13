"use client";

import { useState } from "react";
import { SquareKanban } from "lucide-react";

import { MAX_BOARDS, useBoardSession } from "@/hooks/useBoardSession";
import { useBoardStore } from "@/store/BoardStoreProvider";
import type { BoardSummary } from "@/types/board";
import { Board } from "./Board";
import { BoardToolbar } from "./BoardToolbar";
import { ConfirmDialog } from "./ConfirmDialog";
import { NewBoardDialog } from "./NewBoardDialog";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

type BoardAppProps = { email: string; boards: BoardSummary[] };

export function BoardApp({ email, boards: initialBoards }: BoardAppProps) {
  const session = useBoardSession(initialBoards);
  const boardId = useBoardStore((s) => s.boardId);
  const name = useBoardStore((s) => s.name);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex flex-col gap-5 px-6 pt-8 pb-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="bg-navy grid size-10 place-items-center rounded-xl text-white shadow-sm">
            <SquareKanban className="size-5" aria-hidden />
          </div>
          <h1 className="text-navy text-xl font-bold tracking-tight">{name}</h1>
        </div>
        <BoardToolbar
          boards={session.boards}
          boardId={boardId}
          email={email}
          dirty={session.dirty}
          busy={session.busy}
          error={session.unsaved.open ? null : session.error}
          onSwitch={(id) => session.guard(() => session.switchTo(id))}
          onNew={() => session.guard(() => setCreating(true))}
          onDelete={() => setDeleting(true)}
          onDiscard={() => setDiscarding(true)}
          onSave={session.save}
          onSignOut={() => session.guard(session.signOut)}
        />
      </header>
      <Board key={boardId} />
      <UnsavedChangesDialog
        open={session.unsaved.open}
        boardName={name}
        busy={session.busy}
        error={session.error}
        onSave={session.unsaved.saveAndContinue}
        onDiscard={session.unsaved.discardAndContinue}
        onCancel={session.unsaved.cancel}
      />
      <NewBoardDialog
        open={creating}
        onOpenChange={setCreating}
        remaining={MAX_BOARDS - session.boards.length}
        busy={session.busy}
        onCreate={session.create}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this board?"
        description={`"${name}" and all of its cards will be permanently deleted.`}
        confirmLabel="Delete board"
        onConfirm={session.remove}
      />
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard unsaved changes?"
        description="The board will go back to how it was when you last saved."
        confirmLabel="Discard changes"
        onConfirm={session.discard}
      />
    </main>
  );
}

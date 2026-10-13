"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type UnsavedChangesDialogProps = {
  open: boolean;
  boardName: string;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({
  open,
  boardName,
  busy,
  error,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{boardName}&rdquo; has unsaved changes. They will be lost if
            you continue without saving.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={onDiscard}
            disabled={busy}
          >
            Discard changes
          </Button>
          <Button onClick={onSave} disabled={busy}>
            Save and continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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

type IdleWarningDialogProps = {
  secondsLeft: number | null;
  dirty: boolean;
  onStay: () => void;
  onSignOut: () => void;
};

export function IdleWarningDialog({
  secondsLeft,
  dirty,
  onStay,
  onSignOut,
}: IdleWarningDialogProps) {
  const minutes = Math.floor((secondsLeft ?? 0) / 60);
  const seconds = String((secondsLeft ?? 0) % 60).padStart(2, "0");

  return (
    <AlertDialog open={secondsLeft !== null}>
      <AlertDialogContent onEscapeKeyDown={onStay}>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be signed out in{" "}
            <span className="text-navy font-semibold tabular-nums">
              {minutes}:{seconds}
            </span>{" "}
            because of inactivity.
            {dirty && " Your unsaved changes will be lost."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
          <Button onClick={onStay} autoFocus>
            Stay signed in
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

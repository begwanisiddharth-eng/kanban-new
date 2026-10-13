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
import { api, ApiError, isSessionExpired } from "@/lib/api";

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpired: () => void;
};

const FIELDS = [
  ["current", "Current password", "current-password"],
  ["next", "New password", "new-password"],
  ["confirm", "Confirm new password", "new-password"],
] as const;

export function ChangePasswordDialog({
  open,
  onOpenChange,
  onExpired,
}: ChangePasswordDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setError(null);
      setDone(false);
    }
  };

  async function submit(form: FormData) {
    const [current, next, confirm] = FIELDS.map(([name]) =>
      String(form.get(name)),
    );
    if (next !== confirm) return setError("The new passwords do not match.");
    setPending(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (e) {
      if (isSessionExpired(e)) return onExpired();
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            {done
              ? "Your password has been changed. Use it the next time you sign in."
              : "Enter your current password, then choose a new one of at least 8 characters."}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <DialogFooter>
            <Button onClick={() => close(false)}>Done</Button>
          </DialogFooter>
        ) : (
          <form action={submit} className="grid gap-4">
            {FIELDS.map(([name, label, autoComplete], i) => (
              <div key={name} className="grid gap-2">
                <Label htmlFor={`password-${name}`}>{label}</Label>
                <Input
                  id={`password-${name}`}
                  name={name}
                  type="password"
                  autoComplete={autoComplete}
                  minLength={i > 0 ? 8 : undefined}
                  autoFocus={i === 0}
                  required
                />
              </div>
            ))}
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Change password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

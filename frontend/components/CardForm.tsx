"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CardFormProps = {
  initial: { title: string; details: string };
  onCancel: () => void;
  onSubmit: (title: string, details: string) => void;
};

export function CardForm({ initial, onCancel, onSubmit }: CardFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [details, setDetails] = useState(initial.details);
  const valid = title.trim() !== "" && details.trim() !== "";

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(title, details);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="card-title">Title</Label>
        <Input
          id="card-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          required
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="card-details">Details</Label>
        <Textarea
          id="card-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add the context someone needs to pick this up."
          className="max-h-72"
          required
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

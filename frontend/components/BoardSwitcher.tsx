"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_BOARDS } from "@/hooks/useBoardSession";
import type { BoardSummary } from "@/types/board";

type BoardSwitcherProps = {
  boards: BoardSummary[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
};

export function BoardSwitcher({
  boards,
  value,
  disabled,
  onChange,
}: BoardSwitcherProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label="Current board"
        className="min-w-0 flex-1 sm:w-56 sm:flex-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>
            {boards.length} of {MAX_BOARDS} boards
          </SelectLabel>
          {boards.map((board) => (
            <SelectItem key={board.id} value={board.id}>
              {board.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

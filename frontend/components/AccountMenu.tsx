"use client";

import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AccountMenuProps = {
  email: string;
  disabled: boolean;
  onChangePassword: () => void;
  onSignOut: () => void;
};

export function AccountMenu({
  email,
  disabled,
  onChangePassword,
  onSignOut,
}: AccountMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="ghost" aria-label="Account">
          <UserRound />
          <span className="hidden max-w-48 truncate 2xl:inline">{email}</span>
          <ChevronDown className="text-navy/60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onChangePassword}>
          <KeyRound />
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

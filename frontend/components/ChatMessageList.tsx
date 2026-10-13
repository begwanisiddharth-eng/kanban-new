"use client";

import { useEffect, useRef } from "react";

import type { ChatEntry } from "@/hooks/useAssistantChat";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Summarise this board",
  "What is in progress?",
  "Add a card to To Do for writing release notes",
];

type ChatMessageListProps = {
  entries: ChatEntry[];
  pending: boolean;
  onSuggest: (text: string) => void;
};

export function ChatMessageList({
  entries,
  pending,
  onSuggest,
}: ChatMessageListProps) {
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [entries.length, pending]);

  return (
    <div
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      // Focusable so keyboard users can scroll back through the conversation.
      tabIndex={0}
      className="focus-visible:ring-ring/50 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
    >
      {entries.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-3 text-center">
          <p className="text-muted text-sm">
            Ask about this board, or ask me to add, edit or move cards.
          </p>
          <div className="flex flex-col items-center gap-2">
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => onSuggest(text)}
                className="border-border bg-surface text-navy hover:border-primary focus-visible:ring-ring/50 rounded-full border px-3 py-1.5 text-xs transition-colors outline-none focus-visible:ring-[3px]"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}
      {entries.map((entry, i) => (
        <div
          key={i}
          className={cn(
            "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-line",
            entry.role === "user"
              ? "bg-secondary self-end rounded-br-md text-white"
              : "bg-page text-navy self-start rounded-bl-md",
            entry.failed && "border-destructive/30 text-destructive border",
          )}
        >
          <span className="sr-only">
            {entry.role === "user" ? "You: " : "Assistant: "}
          </span>
          {entry.content}
          {entry.changes && entry.changes.length > 0 && (
            <ul className="border-border text-navy/80 mt-2 space-y-1 border-t pt-2 text-xs">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
              <li className="text-navy font-medium">
                Not saved yet. Use Save to keep these changes.
              </li>
            </ul>
          )}
        </div>
      ))}
      {pending && (
        <p className="bg-page text-navy/70 self-start rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm">
          Thinking...
        </p>
      )}
      <div ref={end} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { RotateCcw, SendHorizontal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { ChatMessageList } from "./ChatMessageList";

export function ChatPanel({ onExpired }: { onExpired: () => void }) {
  const chat = useAssistantChat(onExpired);
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim() || chat.pending) return;
    void chat.send(draft);
    setDraft("");
  };

  return (
    <aside
      aria-label="Board assistant"
      className="border-border bg-surface mx-6 flex h-[25.5rem] min-h-0 flex-col rounded-2xl border shadow-sm lg:mx-10 xl:mx-0 xl:h-3/4 xl:w-[clamp(16rem,22vw,22rem)] xl:shrink-0"
    >
      <header className="border-border flex items-center gap-2.5 border-b px-4 py-3">
        <div className="bg-accent/15 text-navy grid size-8 place-items-center rounded-lg">
          <Sparkles className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-navy text-sm font-semibold">Board assistant</h2>
          <p className="text-navy/70 truncate text-xs">
            Changes it makes stay unsaved until you Save.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-navy/70"
          aria-label="Clear conversation"
          title="Clear conversation"
          onClick={chat.clear}
          disabled={chat.entries.length === 0 || chat.pending}
        >
          <RotateCcw />
        </Button>
      </header>
      <ChatMessageList
        entries={chat.entries}
        pending={chat.pending}
        onSuggest={(text) => void chat.send(text)}
      />
      <form
        className="border-border flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          aria-label="Message the assistant"
          placeholder="Ask or tell the assistant..."
          value={draft}
          rows={1}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-32 min-h-10 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0"
          aria-label="Send message"
          disabled={!draft.trim() || chat.pending}
        >
          <SendHorizontal />
        </Button>
      </form>
    </aside>
  );
}

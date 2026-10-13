import { useState } from "react";

import { api, ApiError, isSessionExpired } from "@/lib/api";
import { applyAssistantActions } from "@/lib/assistantActions";
import { selectBoardData } from "@/store/boardStore";
import { useBoardStoreApi } from "@/store/BoardStoreProvider";
import type { ChatMessage } from "@/types/chat";

export type ChatEntry = ChatMessage & { changes?: string[]; failed?: boolean };

const MAX_HISTORY = 40;

export function useAssistantChat(onExpired: () => void) {
  const store = useBoardStoreApi();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const question: ChatEntry = { role: "user", content };
    const history = [...entries, question]
      .filter((entry) => !entry.failed)
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }));
    setEntries((list) => [...list, question]);
    setPending(true);
    try {
      const reply = await api.chat(selectBoardData(store.getState()), history);
      const changes = applyAssistantActions(store.getState, reply.actions);
      setEntries((list) => [
        ...list,
        { role: "assistant", content: reply.reply, changes },
      ]);
    } catch (error) {
      if (isSessionExpired(error)) return onExpired();
      setEntries((list) => [
        ...list,
        {
          role: "assistant",
          failed: true,
          content:
            error instanceof ApiError
              ? error.message
              : "The assistant could not be reached.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return { entries, pending, send, clear: () => setEntries([]) };
}

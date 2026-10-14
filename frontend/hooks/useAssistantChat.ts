import { useEffect, useRef, useState } from "react";

import { api, ApiError, isSessionExpired } from "@/lib/api";
import { applyAssistantActions } from "@/lib/assistantActions";
import { selectBoardData } from "@/store/boardStore";
import { useBoardStoreApi } from "@/store/BoardStoreProvider";
import type { ChatMessage } from "@/types/chat";

export type ChatEntry = ChatMessage & { changes?: string[]; failed?: boolean };

const MAX_HISTORY = 40;
// The API caps each message; long replies are clipped when sent back as history.
const MAX_MESSAGE_LENGTH = 4000;

/** The last messages to send, starting with a question and clipped to the API's limits. */
export function chatHistory(entries: ChatEntry[]): ChatMessage[] {
  const history = entries.filter((entry) => !entry.failed).slice(-MAX_HISTORY);
  const start = history.findIndex((entry) => entry.role === "user");
  return history.slice(Math.max(start, 0)).map(({ role, content }) => ({
    role,
    content: content.slice(0, MAX_MESSAGE_LENGTH),
  }));
}

export function useAssistantChat(onExpired: () => void) {
  const store = useBoardStoreApi();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  // The panel remounts per board; a reply that arrives after leaving the
  // board must not touch the next one, which shares the same store.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const question: ChatEntry = { role: "user", content };
    const history = chatHistory([...entries, question]);
    setEntries((list) => [...list, question]);
    setPending(true);
    try {
      const reply = await api.chat(selectBoardData(store.getState()), history);
      if (!mounted.current) return;
      const changes = applyAssistantActions(store.getState, reply.actions);
      setEntries((list) => [
        ...list,
        { role: "assistant", content: reply.reply, changes },
      ]);
    } catch (error) {
      if (!mounted.current) return;
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

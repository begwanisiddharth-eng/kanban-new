export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantAction =
  | { type: "add_card"; columnId: string; title: string; details: string }
  | { type: "update_card"; cardId: string; title?: string; details?: string }
  | { type: "move_card"; cardId: string; columnId: string; position?: number }
  | { type: "delete_card"; cardId: string }
  | { type: "rename_column"; columnId: string; name: string }
  | { type: "add_column"; columnId: string; name: string }
  | { type: "remove_column"; columnId: string };

export type AssistantReply = { reply: string; actions: AssistantAction[] };

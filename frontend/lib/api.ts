import type { Board, BoardSummary, SavedBoard } from "@/types/board";
import type { AssistantReply, ChatMessage } from "@/types/chat";

export type User = { id: string; email: string };

export const isSessionExpired = (error: unknown) =>
  error instanceof ApiError && error.status === 401;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "Something went wrong.");
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  me: () => request<User>("/auth/me"),
  signUp: (email: string, password: string) =>
    request<User>("/auth/signup", send("POST", { email, password })),
  signIn: (email: string, password: string) =>
    request<User>("/auth/signin", send("POST", { email, password })),
  signOut: () => request<void>("/auth/signout", send("POST")),
  heartbeat: () => request<void>("/auth/heartbeat", send("POST")),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>(
      "/auth/password",
      send("POST", { currentPassword, newPassword }),
    ),
  chat: (board: Board, messages: ChatMessage[]) =>
    request<AssistantReply>("/chat", send("POST", { board, messages })),
  listBoards: () => request<BoardSummary[]>("/boards"),
  getBoard: (id: string) => request<SavedBoard>(`/boards/${id}`),
  createBoard: (name: string) =>
    request<SavedBoard>("/boards", send("POST", { name })),
  saveBoard: (id: string, data: Board) =>
    request<void>(`/boards/${id}`, send("PUT", data)),
  deleteBoard: (id: string) => request<void>(`/boards/${id}`, send("DELETE")),
};

import { describe, expect, it } from "vitest";

import { chatHistory, type ChatEntry } from "./useAssistantChat";

const turn = (i: number): ChatEntry[] => [
  { role: "user", content: `Q${i}` },
  { role: "assistant", content: `A${i}` },
];

describe("chatHistory", () => {
  it("drops failed replies", () => {
    expect(
      chatHistory([
        { role: "user", content: "Q" },
        { role: "assistant", content: "Oops", failed: true },
        { role: "user", content: "Again" },
      ]),
    ).toEqual([
      { role: "user", content: "Q" },
      { role: "user", content: "Again" },
    ]);
  });

  it("keeps the last 40 messages, starting with a question", () => {
    const entries = [
      ...Array.from({ length: 21 }, (_, i) => turn(i + 1)).flat(),
      { role: "user" as const, content: "Last" },
    ];
    const history = chatHistory(entries);
    expect(history).toHaveLength(39);
    expect(history[0]).toEqual({ role: "user", content: "Q3" });
    expect(history.at(-1)).toEqual({ role: "user", content: "Last" });
  });

  it("clips long messages to the API limit", () => {
    const history = chatHistory([
      { role: "user", content: "Plan" },
      { role: "assistant", content: "x".repeat(6000) },
      { role: "user", content: "Shorter" },
    ]);
    expect(history[1].content).toHaveLength(4000);
  });
});

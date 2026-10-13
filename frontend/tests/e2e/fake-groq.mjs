// A stand-in for Groq's OpenAI-compatible API, used by the e2e tests through
// GROQ_API_BASE. It answers a few phrasings deterministically and fails the
// first two calls of a "flaky" message so retries are exercised end to end.
import { createServer } from "node:http";

const port = Number(process.env.FAKE_GROQ_PORT ?? 3199);
const failures = new Map();

function answer(messages) {
  const board = JSON.parse(messages[0].content.split("Board:\n")[1]);
  const text = messages.at(-1).content;
  const cards = Object.values(board.cards);
  const column = (name) =>
    board.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());

  let match;
  if (/summari[sz]e/i.test(text))
    return { reply: `This board has ${cards.length} cards.`, actions: [] };
  if ((match = text.match(/^move (.+) to (.+)$/i))) {
    const card = cards.find(
      (c) => c.title.toLowerCase() === match[1].toLowerCase(),
    );
    const target = column(match[2]);
    return {
      reply: `Moved ${card.title} to ${target.name}.`,
      actions: [{ type: "move_card", cardId: card.id, columnId: target.id }],
    };
  }
  if ((match = text.match(/^add (.+) to (.+)$/i)))
    return {
      reply: "Added it.",
      actions: [
        {
          type: "add_card",
          columnId: column(match[2]).id,
          title: match[1],
          details: "Added by the assistant.",
        },
      ],
    };
  return { reply: `You said: ${text}`, actions: [] };
}

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const { messages, model } = JSON.parse(body);
    const last = messages.at(-1).content;
    if (/flaky/i.test(last) && (failures.get(last) ?? 0) < 2) {
      failures.set(last, (failures.get(last) ?? 0) + 1);
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Over capacity" } }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: "chatcmpl-fake",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify(answer(messages)),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  });
}).listen(port, "127.0.0.1");

// A stand-in for the OpenAI chat completions API, used by the e2e tests through
// OPENAI_BASE_URL. It answers a few phrasings deterministically and fails the
// first two calls of a "flaky" message so retries are exercised end to end.
// Tests can also script the responses for an exact message with
// POST /__script { message, responses: [{ status?, content?, body?, delayMs? }] }
// (used in order, the last one repeating) and read what the service sent with
// GET /__calls?message=...
import { createServer } from "node:http";

const port = Number(process.env.FAKE_OPENAI_PORT ?? 3199);
const failures = new Map();
const scripts = new Map();
const calls = new Map();

function answer(messages) {
  const board = JSON.parse(messages[0].content.split("Board:\n")[1]);
  const text = messages.at(-1).content;
  const cards = board.columns.flatMap((c) => c.cards);
  const column = (name) =>
    board.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());

  let match;
  if (/summari[sz]e/i.test(text))
    return { reply: `This board has ${cards.length} cards.`, actions: [] };
  if ((match = text.match(/^move (.+?) to (.+)$/i))) {
    const card = cards.find(
      (c) => c.title.toLowerCase() === match[1].toLowerCase(),
    );
    const target = column(match[2]);
    return {
      reply: `Moved ${card.title} to ${target.name}.`,
      actions: [{ type: "move_card", cardId: card.id, columnId: target.id }],
    };
  }
  if ((match = text.match(/^add (.+?) to (.+)$/i)))
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
  req.on("end", async () => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__script") {
      const { message, responses } = JSON.parse(body);
      scripts.set(message, responses);
      calls.delete(message);
      return res.end("{}");
    }
    if (url.pathname === "/__calls") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify(calls.get(url.searchParams.get("message")) ?? []),
      );
    }
    const request = JSON.parse(body);
    const { messages, model } = request;
    const last = messages.at(-1).content;
    calls.set(last, [...(calls.get(last) ?? []), request]);
    const script = scripts.get(last);
    if (script) {
      const step = script[calls.get(last).length - 1] ?? script.at(-1);
      if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
      res.writeHead(step.status ?? 200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify(step.body ?? completion(model, step.content)),
      );
    }
    if (/flaky/i.test(last) && (failures.get(last) ?? 0) < 2) {
      failures.set(last, (failures.get(last) ?? 0) + 1);
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Over capacity" } }));
    }
    let content;
    try {
      content = JSON.stringify(answer(messages));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: String(error) } }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(completion(model, content)));
  });
}).listen(port, "127.0.0.1");

// Shaped like an OpenAI chat completion.
function completion(model, content) {
  return {
    id: "chatcmpl-fake",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    service_tier: "default",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content:
            content === null || typeof content === "string"
              ? content
              : JSON.stringify(content),
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

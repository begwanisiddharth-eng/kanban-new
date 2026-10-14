import { Router } from "express";

import { requireUser } from "../auth";
import { chatSchema } from "../schema";

export const chatRouter = Router();

// Statuses from the chat service that mean the same to the client: not set
// up, board too large for the OpenAI plan, OpenAI usage limit reached.
const PASSED_ON = [503, 413, 429];

// The chat service bounds its own retries well inside this.
const CHAT_TIMEOUT_MS = 180_000;

chatRouter.post("/", requireUser, async (req, res) => {
  const body = chatSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid chat request." });
    return;
  }
  let reply: Response;
  try {
    const chatUrl = process.env.CHAT_URL ?? "http://127.0.0.1:8000";
    reply = await fetch(`${chatUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      res.status(504).json({
        error: "The assistant took too long to answer. Please try again.",
      });
    else
      res.status(503).json({
        error: "The assistant is not running. Start the chat service.",
      });
    return;
  }
  const data = (await reply.json().catch(() => ({}))) as { detail?: unknown };
  if (reply.ok) res.json(data);
  else
    res.status(PASSED_ON.includes(reply.status) ? reply.status : 502).json({
      error:
        typeof data.detail === "string"
          ? data.detail
          : "The assistant could not answer right now. Please try again.",
    });
});

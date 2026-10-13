import { Router } from "express";

import { requireUser } from "../auth";
import { chatSchema } from "../schema";

export const chatRouter = Router();

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
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    res
      .status(503)
      .json({ error: "The assistant is not running. Start the chat service." });
    return;
  }
  const data = (await reply.json()) as { detail?: unknown };
  if (reply.ok) res.json(data);
  else
    res.status(reply.status === 503 ? 503 : 502).json({
      error:
        typeof data.detail === "string"
          ? data.detail
          : "The assistant could not answer right now. Please try again.",
    });
});

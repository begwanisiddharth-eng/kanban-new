import { Router } from "express";

import {
  requireUser,
  SESSION_COOKIE,
  sessionToken,
  setSessionCookie,
  type AuthedResponse,
} from "../auth";
import { createBoard } from "../boards";
import { createEmptyBoard } from "../emptyBoard";
import { hashPassword, verifyPassword } from "../password";
import { signInSchema, signUpSchema } from "../schema";
import { createSession, deleteSession } from "../sessions";
import { createUser, findUserByEmail } from "../users";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const body = signUpSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0].message });
    return;
  }
  const user = createUser(
    body.data.email,
    await hashPassword(body.data.password),
  );
  if (!user) {
    res
      .status(409)
      .json({ error: "An account with this email already exists." });
    return;
  }
  createBoard(user.id, "My board", createEmptyBoard());
  setSessionCookie(res, createSession(user.id).token);
  res.status(201).json(user);
});

authRouter.post("/signin", async (req, res) => {
  const body = signInSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0].message });
    return;
  }
  const user = findUserByEmail(body.data.email);
  if (
    !user ||
    !(await verifyPassword(body.data.password, user.password_hash))
  ) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }
  setSessionCookie(res, createSession(user.id).token);
  res.json({ id: user.id, email: user.email });
});

authRouter.post("/signout", (req, res) => {
  const token = sessionToken(req);
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireUser, (_req, res: AuthedResponse) => {
  res.json(res.locals.user);
});

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
import { changePasswordSchema, signInSchema, signUpSchema } from "../schema";
import { createSession, deleteSession } from "../sessions";
import {
  createUser,
  findUserByEmail,
  getPasswordHash,
  setPasswordHash,
} from "../users";

export const authRouter = Router();

export const ALREADY_SIGNED_IN =
  "This account is already signed in somewhere else. Sign out there first, or try again 20 minutes after it was last used.";

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
  setSessionCookie(res, createSession(user.id)!);
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
  const token = createSession(user.id);
  if (!token) {
    res.status(409).json({ error: ALREADY_SIGNED_IN });
    return;
  }
  setSessionCookie(res, token);
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

// Any authenticated request counts as activity; this one carries no data.
authRouter.post("/heartbeat", requireUser, (_req, res) => {
  res.status(204).end();
});

authRouter.post("/password", requireUser, async (req, res: AuthedResponse) => {
  const body = changePasswordSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0].message });
    return;
  }
  const { id } = res.locals.user;
  if (!(await verifyPassword(body.data.currentPassword, getPasswordHash(id)))) {
    res.status(400).json({ error: "Your current password is incorrect." });
    return;
  }
  setPasswordHash(id, await hashPassword(body.data.newPassword));
  res.status(204).end();
});

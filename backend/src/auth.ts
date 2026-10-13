import type { NextFunction, Request, Response } from "express";

import { validateSession } from "./sessions";
import type { User } from "./users";

export const SESSION_COOKIE = "session";

export type AuthedResponse = Response<unknown, { user: User }>;

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function sessionToken(req: Request): string | undefined {
  return req.cookies[SESSION_COOKIE];
}

export function requireUser(
  req: Request,
  res: AuthedResponse,
  next: NextFunction,
) {
  const token = sessionToken(req);
  const user = token ? validateSession(token) : null;
  if (!user) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.locals.user = user;
  next();
}

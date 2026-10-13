import { createHash, randomBytes } from "node:crypto";

import { getDb } from "./db";
import type { User } from "./users";

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 30 * DAY;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL;
  getDb()
    .prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(hash(token), userId, expiresAt);
  return { token, expiresAt };
}

export function validateSession(token: string): User | null {
  const row = getDb()
    .prepare(
      `SELECT users.id, users.email, sessions.expires_at FROM sessions
       JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?`,
    )
    .get(hash(token)) as (User & { expires_at: number }) | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteSession(token);
    return null;
  }
  return { id: row.id, email: row.email };
}

export function deleteSession(token: string) {
  getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(hash(token));
}

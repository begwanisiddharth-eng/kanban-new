import { createHash, randomBytes } from "node:crypto";

import { getDb } from "./db";
import type { User } from "./users";

/** A session ends after 20 minutes without activity. */
export const SESSION_IDLE_MS = 20 * 60 * 1000;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const expiredBefore = () => Date.now() - SESSION_IDLE_MS;

/** Starts a session, or returns null if the user already has an active one. */
export function createSession(userId: string) {
  const db = getDb();
  return db
    .transaction(() => {
      db.prepare(
        `DELETE FROM sessions WHERE user_id = ? AND last_seen_at < ?`,
      ).run(userId, expiredBefore());
      const token = randomBytes(32).toString("base64url");
      const { changes } = db
        .prepare(
          `INSERT INTO sessions (id, user_id, last_seen_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO NOTHING`,
        )
        .run(hash(token), userId, Date.now());
      return changes ? token : null;
    })
    .immediate();
}

/** Returns the session's user and records the activity, or null if expired. */
export function validateSession(token: string): User | null {
  const db = getDb();
  const id = hash(token);
  const row = db
    .prepare(
      `SELECT users.id, users.email, sessions.last_seen_at FROM sessions
       JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?`,
    )
    .get(id) as (User & { last_seen_at: number }) | undefined;
  if (!row) return null;
  if (row.last_seen_at < expiredBefore()) {
    deleteSession(token);
    return null;
  }
  db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`).run(
    Date.now(),
    id,
  );
  return { id: row.id, email: row.email };
}

export function deleteSession(token: string) {
  getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(hash(token));
}

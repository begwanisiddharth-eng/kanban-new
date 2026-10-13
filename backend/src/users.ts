import { getDb } from "./db";

export type User = { id: string; email: string };

export function createUser(email: string, passwordHash: string): User | null {
  const id = crypto.randomUUID();
  const { changes } = getDb()
    .prepare(
      `INSERT INTO users (id, email, password_hash, created_at)
       VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING`,
    )
    .run(id, email, passwordHash, Date.now());
  return changes ? { id, email } : null;
}

export function findUserByEmail(email: string) {
  return getDb()
    .prepare(`SELECT id, email, password_hash FROM users WHERE email = ?`)
    .get(email) as (User & { password_hash: string }) | undefined;
}

export function getPasswordHash(userId: string) {
  return getDb()
    .prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .pluck()
    .get(userId) as string;
}

export function setPasswordHash(userId: string, passwordHash: string) {
  getDb()
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .run(passwordHash, userId);
}

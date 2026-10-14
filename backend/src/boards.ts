import { getDb } from "./db";
import type { Board, BoardSummary, SavedBoard } from "./schema";

// Also frontend/hooks/useBoardSession.ts; change both together.
export const MAX_BOARDS = 3;

export function listBoards(userId: string) {
  return getDb()
    .prepare(
      `SELECT id, name FROM boards WHERE user_id = ? ORDER BY created_at, rowid`,
    )
    .all(userId) as BoardSummary[];
}

export function getBoard(userId: string, id: string): SavedBoard | null {
  const row = getDb()
    .prepare(`SELECT id, name, data FROM boards WHERE id = ? AND user_id = ?`)
    .get(id, userId) as (BoardSummary & { data: string }) | undefined;
  return row ? { ...row, data: JSON.parse(row.data) as Board } : null;
}

export function createBoard(
  userId: string,
  name: string,
  data: Board,
): SavedBoard | null {
  const db = getDb();
  return db
    .transaction(() => {
      const { count } = db
        .prepare(`SELECT COUNT(*) AS count FROM boards WHERE user_id = ?`)
        .get(userId) as { count: number };
      if (count >= MAX_BOARDS) return null;
      const id = crypto.randomUUID();
      const now = Date.now();
      db.prepare(
        `INSERT INTO boards (id, user_id, name, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, userId, name, JSON.stringify(data), now, now);
      return { id, name, data };
    })
    .immediate();
}

export function saveBoard(userId: string, id: string, data: Board) {
  const { changes } = getDb()
    .prepare(
      `UPDATE boards SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    )
    .run(JSON.stringify(data), Date.now(), id, userId);
  return changes > 0;
}

export function deleteBoard(userId: string, id: string) {
  const db = getDb();
  return db
    .transaction(() => {
      if (!getBoard(userId, id)) return "not-found" as const;
      if (listBoards(userId).length <= 1) return "last-board" as const;
      db.prepare(`DELETE FROM boards WHERE id = ?`).run(id);
      return "deleted" as const;
    })
    .immediate();
}

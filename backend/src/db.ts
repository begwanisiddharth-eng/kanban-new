import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS boards_by_user ON boards(user_id, created_at);
`;

const DEFAULT_PATH = fileURLToPath(
  new URL("../../data/kanban.db", import.meta.url),
);

function open() {
  const path = process.env.DATABASE_PATH ?? DEFAULT_PATH;
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Version 1: one idle-timed session per user. Old sessions are dropped.
  if (db.pragma("user_version", { simple: true }) === 0) {
    db.exec("DROP TABLE IF EXISTS sessions");
    db.pragma("user_version = 1");
  }
  db.exec(SCHEMA);
  return db;
}

let db: Database.Database | undefined;

export function getDb() {
  db ??= open();
  return db;
}

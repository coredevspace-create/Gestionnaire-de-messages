import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config";

// Une seule connexion par process (survit au hot-reload en dev).
const g = globalThis as unknown as { __db?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(config.dataDir, "app.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 0,
      onboarded INTEGER NOT NULL DEFAULT 0,
      monetized INTEGER NOT NULL DEFAULT 0,
      country TEXT NOT NULL DEFAULT 'ci',
      style TEXT NOT NULL DEFAULT 'fruits3d',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    -- Planches de personnages (owner_id NULL = bibliothèque partagée)
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      country TEXT NOT NULL,
      style TEXT NOT NULL,
      name TEXT NOT NULL,
      fruit TEXT NOT NULL,
      role TEXT NOT NULL,
      look TEXT NOT NULL,
      sheet_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      pitch TEXT NOT NULL,
      country TEXT NOT NULL,
      style TEXT NOT NULL,
      format TEXT NOT NULL,
      episodes_total INTEGER NOT NULL,
      cast_json TEXT NOT NULL,
      plan_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      episode INTEGER NOT NULL,
      format TEXT NOT NULL,
      seconds INTEGER NOT NULL,
      credits_cost INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed
      step TEXT,
      script_json TEXT,
      output_path TEXT,
      error TEXT,
      mock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function db(): DatabaseSync {
  if (!g.__db) g.__db = open();
  return g.__db;
}

export type User = {
  id: number;
  email: string;
  credits: number;
  onboarded: number;
  monetized: number;
  country: string;
  style: string;
};

export type Series = {
  id: number;
  user_id: number;
  title: string;
  pitch: string;
  country: string;
  style: string;
  format: string;
  episodes_total: number;
  cast_json: string;
  plan_json: string | null;
  created_at: string;
};

export type Video = {
  id: number;
  user_id: number;
  series_id: number;
  episode: number;
  format: string;
  seconds: number;
  credits_cost: number;
  status: "queued" | "running" | "done" | "failed";
  step: string | null;
  script_json: string | null;
  output_path: string | null;
  error: string | null;
  mock: number;
  created_at: string;
};

export type Character = {
  id: number;
  key: string | null;
  owner_id: number | null;
  country: string;
  style: string;
  name: string;
  fruit: string;
  role: string;
  look: string;
  sheet_path: string | null;
};

/** Mouvement de crédits atomique. Retourne false si solde insuffisant. */
export function changeCredits(userId: number, delta: number, reason: string): boolean {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const row = d.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as
      | { credits: number }
      | undefined;
    if (!row || row.credits + delta < 0) {
      d.exec("ROLLBACK");
      return false;
    }
    d.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(delta, userId);
    d.prepare("INSERT INTO credit_ledger (user_id, delta, reason) VALUES (?, ?, ?)").run(
      userId,
      delta,
      reason,
    );
    d.exec("COMMIT");
    return true;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

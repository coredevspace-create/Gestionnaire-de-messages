import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

/**
 * Base Postgres.
 * - Production (Vercel) : DATABASE_URL (Neon / Supabase / tout Postgres).
 * - Local sans DATABASE_URL : PGlite (Postgres embarqué, fichiers dans DATA_DIR/pg).
 */

type Rows<T> = Promise<T[]>;
type Exec = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Rows<T>;

const g = globalThis as unknown as { __exec?: Promise<Exec> };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  monetized BOOLEAN NOT NULL DEFAULT false,
  country TEXT NOT NULL DEFAULT 'ci',
  style TEXT NOT NULL DEFAULT 'fruits3d',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  style TEXT NOT NULL,
  name TEXT NOT NULL,
  fruit TEXT NOT NULL,
  role TEXT NOT NULL,
  look TEXT NOT NULL,
  sheet_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS series (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pitch TEXT NOT NULL,
  country TEXT NOT NULL,
  style TEXT NOT NULL,
  format TEXT NOT NULL,
  episodes_total INTEGER NOT NULL,
  cast_json TEXT NOT NULL,
  plan_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL,
  format TEXT NOT NULL,
  seconds INTEGER NOT NULL,
  credits_cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT,
  script_json TEXT,
  output_path TEXT,
  error TEXT,
  mock BOOLEAN NOT NULL DEFAULT false,
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS metrics_json TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS music BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS music_tracks (
  id SERIAL PRIMARY KEY,
  mood TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function connect(): Promise<Exec> {
  // Noms possibles selon l'intégration Vercel (avec ou sans préfixe personnalisé).
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_URL ||
    Object.entries(process.env).find(([k, v]) => k.endsWith("_DATABASE_URL") && v)?.[1];
  let exec: Exec;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    exec = async (sql, params = []) => (await pool.query(sql, params)).rows;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = path.join(config.dataDir, "pg");
    fs.mkdirSync(dir, { recursive: true });
    const lite = new PGlite(dir);
    exec = async (sql, params = []) => (await lite.query(sql, params)).rows as never;
  }
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await exec(stmt);
  return exec;
}

function exec(): Promise<Exec> {
  if (!g.__exec) {
    g.__exec = connect().catch((e) => {
      g.__exec = undefined;
      throw e;
    });
  }
  return g.__exec;
}

/** Toutes les lignes. Paramètres en $1, $2… */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await exec())<T>(text, params);
}

/** Première ligne ou undefined. */
export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await sql<T>(text, params))[0];
}

export type User = {
  id: number;
  email: string;
  credits: number;
  onboarded: boolean;
  monetized: boolean;
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
  mock: boolean;
  metrics_json: string | null;
  music: boolean;
  created_at: Date;
  updated_at: Date;
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
export async function changeCredits(userId: number, delta: number, reason: string): Promise<boolean> {
  const row = await one(
    "UPDATE users SET credits = credits + $2 WHERE id = $1 AND credits + $2 >= 0 RETURNING credits",
    [userId, delta],
  );
  if (!row) return false;
  await sql("INSERT INTO credit_ledger (user_id, delta, reason) VALUES ($1, $2, $3)", [userId, delta, reason]);
  return true;
}

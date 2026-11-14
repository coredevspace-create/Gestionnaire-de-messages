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
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS bg_jobs (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  options_json TEXT,
  error TEXT,
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
-- Évolutions du schéma (après la création de toutes les tables)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS metrics_json TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS cover_path TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'grok';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE videos ALTER COLUMN approved SET DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_interval TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_ref ON credit_ledger(ref) WHERE ref IS NOT NULL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS music BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS showcase BOOLEAN NOT NULL DEFAULT false;
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
  // Migration unique : crédits ×10 (même valeur, montants affichés plus généreux). Atomique (un seul bloc).
  await exec(`DO $m$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'credits_x10') THEN
      INSERT INTO app_meta (key) VALUES ('credits_x10');
      UPDATE users SET credits = credits * 10, sub_credits = sub_credits * 10;
      UPDATE videos SET credits_cost = credits_cost * 10;
      UPDATE credit_ledger SET delta = delta * 10;
    END IF;
  END $m$`);
  // Migration unique : lunettes de soleil relevées sur la tête (on veut voir les yeux) → portraits recréés à la demande.
  await exec(`DO $m$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'no_sunglasses_eyes') THEN
      INSERT INTO app_meta (key) VALUES ('no_sunglasses_eyes');
      UPDATE characters SET look = replace(replace(look, 'sunglasses indoors', 'sunglasses'), 'sunglasses', 'sunglasses pushed up on the head'), sheet_path = NULL
        WHERE look LIKE '%sunglasses%' AND look NOT LIKE '%pushed up%';
    END IF;
  END $m$`);
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
  /** Crédits permanents (recharges, bienvenue, remboursements) */
  credits: number;
  /** Crédits de l'abonnement, remplacés à chaque renouvellement */
  sub_credits: number;
  plan: string | null;
  plan_interval: string | null;
  plan_status: string | null;
  stripe_customer_id: string | null;
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
  status: "queued" | "running" | "review" | "done" | "failed" | "stopped";
  /** Premier clip validé par l'utilisateur : on peut animer le reste */
  approved: boolean;
  /** Couverture TikTok (JPEG 1080x1920) */
  cover_path: string | null;
  /** « grok » (voix générées par Grok) ou « dub » (voix OpenAI + animation muette + lèvres Kling) */
  engine: string;
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

/** Solde total affiché. */
export function totalCredits(u: { credits: number; sub_credits?: number }) {
  return u.credits + (u.sub_credits ?? 0);
}

/**
 * Mouvement de crédits atomique. Retourne false si solde insuffisant.
 * Débit : on prend d'abord les crédits d'abonnement, puis les crédits permanents.
 * Crédit (remboursement, recharge, admin) : va dans les crédits permanents.
 */
export async function changeCredits(userId: number, delta: number, reason: string, ref?: string): Promise<boolean> {
  if (ref) {
    // Idempotence : un même paiement Stripe ne crédite qu'une fois.
    const fresh = await one("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id", [userId, delta, reason, ref]);
    if (!fresh) return true;
  }
  const row =
    delta >= 0
      ? await one("UPDATE users SET credits = credits + $2 WHERE id = $1 RETURNING id", [userId, delta])
      : await one(
          `UPDATE users SET
             sub_credits = GREATEST(sub_credits + $2, 0),
             credits = credits + LEAST(sub_credits + $2, 0)
           WHERE id = $1 AND credits + sub_credits + $2 >= 0 RETURNING id`,
          [userId, delta],
        );
  if (!row) {
    if (ref) await sql("DELETE FROM credit_ledger WHERE ref = $1", [ref]);
    return false;
  }
  if (!ref) await sql("INSERT INTO credit_ledger (user_id, delta, reason) VALUES ($1, $2, $3)", [userId, delta, reason]);
  return true;
}

/** Renouvellement d'abonnement : remplace les crédits d'abonnement (une seule fois par facture). */
export async function resetSubCredits(userId: number, amount: number, reason: string, ref: string): Promise<void> {
  const fresh = await one(
    "INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id",
    [userId, amount, reason, ref],
  );
  if (fresh) await sql("UPDATE users SET sub_credits = $2 WHERE id = $1", [userId, amount]);
}

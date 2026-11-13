import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

/** Racine des médias : DATA_DIR/media. Les chemins stockés en base sont relatifs à cette racine. */
export const MEDIA_ROOT = path.join(config.dataDir, "media");

export function mediaPath(rel: string): string {
  const abs = path.resolve(MEDIA_ROOT, rel);
  if (!abs.startsWith(MEDIA_ROOT + path.sep)) throw new Error("Chemin média invalide");
  return abs;
}

export function ensureDir(rel: string): string {
  const abs = mediaPath(rel);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

export function writeMedia(rel: string, data: Buffer): string {
  const abs = mediaPath(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return rel;
}

/** URL servie par /api/media/... */
export function mediaUrl(rel: string | null | undefined): string | null {
  return rel ? `/api/media/${rel.split(path.sep).map(encodeURIComponent).join("/")}` : null;
}

/** URL publique absolue (utile pour que Grok télécharge l'image si PUBLIC_BASE_URL est défini). */
export function publicMediaUrl(rel: string): string | null {
  const base = process.env.PUBLIC_BASE_URL;
  return base ? base.replace(/\/$/, "") + mediaUrl(rel) : null;
}

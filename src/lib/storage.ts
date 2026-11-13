import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

/**
 * Stockage des médias.
 * - Production : Vercel Blob (BLOB_READ_WRITE_TOKEN ou BLOB_STORE_ID) -> on stocke l'URL publique complète.
 * - Local : fichiers dans DATA_DIR/media, servis par /api/media/... -> on stocke le chemin relatif.
 */
export const MEDIA_ROOT = path.join(config.dataDir, "media");

export function useBlob() {
  // Ancienne méthode : jeton BLOB_READ_WRITE_TOKEN.
  // Nouvelle méthode Vercel : BLOB_STORE_ID + jeton OIDC fourni automatiquement à l'exécution.
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function localPath(rel: string): string {
  const abs = path.resolve(MEDIA_ROOT, rel);
  if (!abs.startsWith(MEDIA_ROOT + path.sep)) throw new Error("Chemin média invalide");
  return abs;
}

export function localMediaPath(rel: string) {
  return localPath(rel);
}

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg" };

/** Enregistre un fichier et renvoie sa référence (URL Blob ou chemin relatif). */
export async function putMedia(rel: string, data: Buffer): Promise<string> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const res = await put(rel, data, {
      access: "public",
      addRandomSuffix: true,
      contentType: TYPES[path.extname(rel)] ?? "application/octet-stream",
    });
    return res.url;
  }
  const abs = localPath(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return rel;
}

export async function getMedia(ref: string): Promise<Buffer> {
  if (/^https?:\/\//.test(ref)) {
    const res = await fetch(ref);
    if (!res.ok) throw new Error(`Lecture média impossible (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(localPath(ref));
}

export async function mediaExists(ref: string | null | undefined): Promise<boolean> {
  if (!ref) return false;
  if (/^https?:\/\//.test(ref)) return true;
  return fs.existsSync(localPath(ref));
}

/** URL affichable dans le navigateur. */
export function mediaUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (/^https?:\/\//.test(ref)) return ref;
  return `/api/media/${ref.split(/[\\/]/).map(encodeURIComponent).join("/")}`;
}

/** URL publique absolue (pour que Grok télécharge l'image), si disponible. */
export function publicMediaUrl(ref: string): string | null {
  if (/^https?:\/\//.test(ref)) return ref;
  const base = process.env.PUBLIC_BASE_URL;
  return base ? base.replace(/\/$/, "") + mediaUrl(ref) : null;
}

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

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg" };

/** Enregistre un fichier et renvoie sa référence (URL Blob ou chemin relatif). */
/** Type réel d'un fichier d'après ses premiers octets (l'extension peut mentir). */
function sniff(data: Buffer): { type: string; ext: string } | null {
  if (data.length < 12) return null;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return { type: "image/png", ext: ".png" };
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { type: "image/jpeg", ext: ".jpg" };
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return { type: "image/webp", ext: ".webp" };
  if (data.toString("ascii", 4, 8) === "ftyp") return { type: "video/mp4", ext: ".mp4" };
  return null;
}

export async function putMedia(rel: string, data: Buffer): Promise<string> {
  // Corrige extension et type si le contenu n'est pas celui annoncé (ex. image WebP nommée .png) :
  // sinon le navigateur refuse de l'afficher (en-tête nosniff du stockage).
  const real = sniff(data);
  if (real && real.ext !== path.extname(rel) && real.type.startsWith("image/") === (TYPES[path.extname(rel)] ?? "").startsWith("image/")) {
    rel = rel.slice(0, rel.length - path.extname(rel).length) + real.ext;
  }
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const res = await put(rel, data, {
      access: "public",
      addRandomSuffix: true,
      contentType: real?.type ?? TYPES[path.extname(rel)] ?? "application/octet-stream",
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

/** URL qui force le téléchargement (Vercel Blob : ?download=1 ; local : en-tête attachment). */
export function mediaDownloadUrl(ref: string | null | undefined): string | null {
  const u = mediaUrl(ref);
  return u ? `${u}${u.includes("?") ? "&" : "?"}download=1` : null;
}

/** URL publique absolue (pour que Grok télécharge l'image), si disponible. */
export function publicMediaUrl(ref: string): string | null {
  if (/^https?:\/\//.test(ref)) return ref;
  const base = process.env.PUBLIC_BASE_URL;
  return base ? base.replace(/\/$/, "") + mediaUrl(ref) : null;
}

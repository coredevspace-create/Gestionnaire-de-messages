import fs from "node:fs";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { localMediaPath } from "@/lib/storage";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

/**
 * Sert les médias en stockage LOCAL (sans Vercel Blob), avec support Range pour la vidéo.
 * Avec Vercel Blob, les médias ont leur propre URL publique et cette route n'est pas utilisée.
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts[0] === "videos") {
    const isPublicFrame = !!process.env.PUBLIC_BASE_URL && parts[2]?.endsWith(".png");
    if (!isPublicFrame) {
      const user = await currentUser();
      const row = await one<{ user_id: number }>("SELECT user_id FROM videos WHERE id = $1", [Number(parts[1]) || 0]);
      if (!user || !row || row.user_id !== user.id) return new Response("Interdit", { status: 403 });
    }
  }
  let file: string;
  try {
    file = localMediaPath(parts.join("/"));
  } catch {
    return new Response("Chemin invalide", { status: 400 });
  }
  if (!fs.existsSync(file)) return new Response("Introuvable", { status: 404 });
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    return new Response(fs.createReadStream(file, { start, end }) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(fs.createReadStream(file) as unknown as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      ...(new URL(req.url).searchParams.has("download")
        ? { "Content-Disposition": `attachment; filename="${path.basename(file)}"` }
        : {}),
    },
  });
}

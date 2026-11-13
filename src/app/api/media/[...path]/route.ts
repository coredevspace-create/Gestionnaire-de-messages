import fs from "node:fs";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { mediaPath } from "@/lib/storage";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".srt": "text/plain" };

/** Sert les médias (avec support Range pour la lecture vidéo). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  // Les planches de personnages sont publiques (utiles si Grok doit les télécharger) ;
  // les vidéos ne sont accessibles qu'à leur propriétaire.
  if (parts[0] === "videos") {
    const user = await currentUser();
    const { db } = await import("@/lib/db");
    const row = db().prepare("SELECT user_id FROM videos WHERE id = ?").get(Number(parts[1])) as { user_id: number } | undefined;
    const isPublicFrame = !!process.env.PUBLIC_BASE_URL && parts[2]?.endsWith(".png");
    if (!isPublicFrame && (!user || !row || row.user_id !== user.id)) return new Response("Interdit", { status: 403 });
  }
  let file: string;
  try {
    file = mediaPath(parts.join("/"));
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
    const stream = fs.createReadStream(file, { start, end });
    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(fs.createReadStream(file) as unknown as ReadableStream, {
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" },
  });
}

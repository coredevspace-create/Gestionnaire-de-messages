import { one } from "@/lib/db";
import { kickVideo } from "@/lib/pipeline/kick";

// Durée max d'une fonction Vercel (Hobby : 300 s avec Fluid compute).
export const maxDuration = 300;

/** Fait avancer la génération d'une vidéo (idempotent : un seul worker à la fois grâce au bail). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const v = await one<{ status: string; busy: boolean }>(
    "SELECT status, (lease_until IS NOT NULL AND lease_until > now()) AS busy FROM videos WHERE id = $1",
    [id],
  );
  if (!v) return Response.json({ error: "introuvable" }, { status: 404 });
  if ((v.status === "queued" || v.status === "running") && !v.busy) await kickVideo(id);
  return Response.json({ status: v.status, busy: v.busy }, { status: 202 });
}

import { one } from "@/lib/db";
import { kickPregen } from "@/lib/pipeline/kick";

export const maxDuration = 300;

/** Fait avancer la création des portraits (idempotent grâce au bail). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const job = await one<{ status: string; busy: boolean }>(
    "SELECT status, (lease_until IS NOT NULL AND lease_until > now()) AS busy FROM bg_jobs WHERE id = $1",
    [id],
  );
  if (!job) return Response.json({ error: "introuvable" }, { status: 404 });
  if (job.status === "running" && !job.busy) await kickPregen(id);
  return Response.json(job, { status: 202 });
}

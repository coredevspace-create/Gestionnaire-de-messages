import { config } from "../config";

/**
 * Grok Imagine Video (xAI) — image-to-video.
 * POST /v1/videos/generations  -> { request_id }
 * GET  /v1/videos/{request_id} -> { status, video: { url } }
 * Les URLs de sortie sont temporaires : on télécharge la vidéo immédiatement.
 */
const BASE = "https://api.x.ai/v1";

function headers() {
  return { Authorization: `Bearer ${config.xaiKey}`, "Content-Type": "application/json" };
}

export async function imageToVideo(opts: {
  prompt: string;
  /** URL publique de l'image, ou data URI base64 */
  imageUrl: string;
  seconds: number;
}): Promise<Buffer> {
  const res = await fetch(`${BASE}/videos/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: config.xaiVideoModel,
      prompt: opts.prompt,
      image: { url: opts.imageUrl },
      duration: opts.seconds,
      aspect_ratio: "9:16",
      resolution: config.xaiVideoResolution,
    }),
  });
  if (!res.ok) throw new Error(`Grok vidéo a échoué (${res.status}) : ${(await res.text()).slice(0, 400)}`);
  const { request_id } = (await res.json()) as { request_id: string };
  if (!request_id) throw new Error("Grok n'a pas renvoyé de request_id");

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${BASE}/videos/${request_id}`, { headers: headers() });
    if (!poll.ok) continue;
    const json = (await poll.json()) as { status?: string; video?: { url?: string }; error?: unknown };
    const status = (json.status || "").toLowerCase();
    if (json.video?.url && (status === "done" || status === "" || status === "completed")) {
      const vid = await fetch(json.video.url);
      if (!vid.ok) throw new Error(`Téléchargement de la vidéo Grok impossible (${vid.status})`);
      return Buffer.from(await vid.arrayBuffer());
    }
    if (["failed", "error", "expired"].includes(status)) {
      throw new Error(`Grok vidéo : statut ${status} ${JSON.stringify(json.error ?? "")}`);
    }
  }
  throw new Error("Grok vidéo : délai dépassé (10 min)");
}

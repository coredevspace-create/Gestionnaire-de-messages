import { config } from "../config";

/**
 * Grok Imagine Video (xAI) — image-to-video, en deux temps pour tenir dans
 * les limites de durée des fonctions Vercel :
 *   submitVideo()  POST /v1/videos/generations -> request_id
 *   checkVideo()   GET  /v1/videos/{request_id} -> en cours | prêt (url) | échec
 * Les URLs de sortie sont temporaires : on télécharge la vidéo dès qu'elle est prête.
 */
const BASE = "https://api.x.ai/v1";

function headers() {
  return { Authorization: `Bearer ${config.xaiKey}`, "Content-Type": "application/json" };
}

export async function submitVideo(opts: { prompt: string; imageUrl: string; seconds: number }): Promise<string> {
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
  const { request_id } = (await res.json()) as { request_id?: string };
  if (!request_id) throw new Error("Grok n'a pas renvoyé de request_id");
  return request_id;
}

export type VideoCheck = { state: "pending" } | { state: "done"; data: Buffer } | { state: "failed"; error: string };

export async function checkVideo(requestId: string): Promise<VideoCheck> {
  const res = await fetch(`${BASE}/videos/${requestId}`, { headers: headers() });
  if (!res.ok) {
    if (res.status >= 500 || res.status === 429) return { state: "pending" };
    return { state: "failed", error: `Grok statut HTTP ${res.status} : ${(await res.text()).slice(0, 300)}` };
  }
  const json = (await res.json()) as { status?: string; video?: { url?: string }; error?: unknown };
  const status = (json.status || "").toLowerCase();
  if (json.video?.url && ["done", "completed", "succeeded", ""].includes(status)) {
    const vid = await fetch(json.video.url);
    if (!vid.ok) return { state: "failed", error: `Téléchargement de la vidéo Grok impossible (${vid.status})` };
    return { state: "done", data: Buffer.from(await vid.arrayBuffer()) };
  }
  if (["failed", "error", "expired", "cancelled"].includes(status)) {
    return { state: "failed", error: `Grok vidéo : ${status} ${JSON.stringify(json.error ?? "")}` };
  }
  return { state: "pending" };
}

/**
 * Kling (synchronisation labiale) : on lui donne une vidéo muette (720p, 2-10 s, URL publique)
 * et la voix du personnage (MP3) ; il anime la bouche pour coller à la voix.
 *   submitLipSync()  POST /v1/videos/lip-sync        -> task_id
 *   checkLipSync()   GET  /v1/videos/lip-sync/{id}   -> en cours | prêt | échec
 * Clé API (nouvelle méthode) : variable KLING_API_KEY, envoyée en « Authorization: Bearer ».
 */
const BASE = (process.env.KLING_API_BASE || "https://api-singapore.klingai.com").replace(/\/$/, "");

function headers() {
  return { Authorization: `Bearer ${process.env.KLING_API_KEY || ""}`, "Content-Type": "application/json" };
}

export function klingEnabled() {
  return !!process.env.KLING_API_KEY;
}

type KlingResponse = {
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    task_status?: string;
    task_status_msg?: string;
    task_result?: { videos?: { url?: string }[] };
  };
};

export async function submitLipSync(opts: { videoUrl: string; audio: Buffer }): Promise<string> {
  const res = await fetch(`${BASE}/v1/videos/lip-sync`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      input: {
        video_url: opts.videoUrl,
        mode: "audio2video",
        audio_type: "file",
        audio_file: opts.audio.toString("base64"),
      },
    }),
  });
  const body = await res.text();
  let json: KlingResponse = {};
  try {
    json = JSON.parse(body);
  } catch {}
  if (!res.ok || (json.code ?? 0) !== 0 || !json.data?.task_id) {
    throw new Error(`Kling lip-sync a échoué (${res.status}) : ${body.slice(0, 400)}`);
  }
  return json.data.task_id;
}

export type LipSyncCheck = { state: "pending" } | { state: "done"; data: Buffer } | { state: "failed"; error: string };

export async function checkLipSync(taskId: string): Promise<LipSyncCheck> {
  const res = await fetch(`${BASE}/v1/videos/lip-sync/${taskId}`, { headers: headers() });
  if (!res.ok) {
    if (res.status >= 500 || res.status === 429) return { state: "pending" };
    return { state: "failed", error: `Kling statut HTTP ${res.status} : ${(await res.text()).slice(0, 300)}` };
  }
  const json = (await res.json()) as KlingResponse;
  const status = (json.data?.task_status || "").toLowerCase();
  const url = json.data?.task_result?.videos?.[0]?.url;
  if (status === "succeed" && url) {
    const vid = await fetch(url);
    if (!vid.ok) return { state: "failed", error: `Téléchargement de la vidéo Kling impossible (${vid.status})` };
    return { state: "done", data: Buffer.from(await vid.arrayBuffer()) };
  }
  if (status === "failed") return { state: "failed", error: `Kling lip-sync : ${json.data?.task_status_msg ?? "échec"}` };
  return { state: "pending" };
}

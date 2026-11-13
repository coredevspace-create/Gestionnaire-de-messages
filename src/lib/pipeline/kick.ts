import { after } from "next/server";
import { headers } from "next/headers";
import { work } from "./runner";

/**
 * Enchaînement des étapes sans service externe :
 * - kickVideo() lance `work()` en arrière-plan via `after()` (la réponse HTTP part tout de suite,
 *   la fonction Vercel continue jusqu'à maxDuration)
 * - s'il reste du travail, on rappelle /api/videos/[id]/tick, qui refait la même chose.
 * La page de la vidéo appelle aussi /tick régulièrement (filet de sécurité).
 */

export async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function callTick(origin: string, id: number) {
  const hdrs: Record<string, string> = {};
  // Permet l'auto-appel quand la « Deployment Protection » de Vercel est active.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    hdrs["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  try {
    await fetch(`${origin}/api/videos/${id}/tick`, { method: "POST", headers: hdrs });
  } catch (e) {
    console.error(`[video ${id}] relance impossible`, e);
  }
}

/** À appeler depuis une action serveur ou une route. */
export async function kickVideo(id: number) {
  const origin = await baseUrl();
  after(async () => {
    const r = await work(id);
    if (r === "more") await callTick(origin, id);
  });
}

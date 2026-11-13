import { one, sql } from "./db";

/**
 * Bibliothèque de musiques de fond (libres de droits), gérée depuis /admin.
 * Le scénario choisit une ambiance (mood) ; on prend au hasard une musique de cette ambiance.
 */
export const MOODS = {
  suspense: "Suspense / tension",
  drame: "Drame / injustice",
  emotion: "Émotion / tristesse",
  action: "Action / épique",
  comedie: "Comédie / léger",
  triomphe: "Triomphe / révélation",
} as const;

export type Mood = keyof typeof MOODS;

export function isMood(m: unknown): m is Mood {
  return typeof m === "string" && m in MOODS;
}

export type MusicTrack = { id: number; mood: Mood; title: string; path: string; created_at: Date };

export async function listTracks(): Promise<MusicTrack[]> {
  return sql<MusicTrack>("SELECT * FROM music_tracks ORDER BY mood, id");
}

/** Une musique de l'ambiance demandée, sinon n'importe laquelle, sinon null. */
export async function pickTrack(mood: string | undefined): Promise<MusicTrack | null> {
  const m = isMood(mood) ? mood : "suspense";
  return (
    (await one<MusicTrack>("SELECT * FROM music_tracks WHERE mood = $1 ORDER BY random() LIMIT 1", [m])) ??
    (await one<MusicTrack>("SELECT * FROM music_tracks ORDER BY random() LIMIT 1")) ??
    null
  );
}

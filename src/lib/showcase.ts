import { sql, type Character } from "./db";
import { mediaUrl } from "./storage";
import { fruitLabel } from "./catalog/characters";
import { isMock } from "./config";

/** Contenus réels affichés sur la page d'accueil (vidéos choisies par l'admin + portraits de personnages). */

export type ShowcaseVideo = { id: number; title: string; episode: number; poster: string | null; src: string };
export type ShowcasePortrait = { id: number; name: string; fruit: string; role: string; src: string };

export async function showcaseVideos(limit = 8): Promise<ShowcaseVideo[]> {
  const rows = await sql<{ id: number; episode: number; output_path: string; script_json: string | null; title: string }>(
    `SELECT v.id, v.episode, v.output_path, v.script_json, s.title
     FROM videos v JOIN series s ON s.id = v.series_id
     WHERE v.showcase = true AND v.status = 'done' AND v.output_path IS NOT NULL
     ORDER BY v.id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => {
    let poster: string | null = null;
    try {
      poster = mediaUrl(JSON.parse(r.script_json ?? "{}").scenes?.[0]?.imagePath);
    } catch {}
    return { id: r.id, title: r.title, episode: r.episode, poster, src: mediaUrl(r.output_path)! };
  });
}

export async function showcasePortraits(limit = 18): Promise<ShowcasePortrait[]> {
  // En simulation, les portraits sont des images factices : on ne les montre pas aux visiteurs.
  if (isMock()) return [];
  const rows = await sql<Character>(
    `SELECT * FROM characters WHERE owner_id IS NULL AND sheet_path LIKE '%portrait-v2%'
     ORDER BY random() LIMIT $1`,
    [limit],
  );
  return rows.map((c) => ({ id: c.id, name: c.name, fruit: fruitLabel(c.fruit), role: c.role, src: mediaUrl(c.sheet_path)! }));
}

export const FRUIT_EMOJI: Record<string, string> = {
  mango: "🥭", orange: "🍊", strawberry: "🍓", pineapple: "🍍", avocado: "🥑", peach: "🍑", coconut: "🥥",
  watermelon: "🍉", banana: "🍌", pomegranate: "🔴", blueberry: "🫐", melon: "🍈", apple: "🍎", lemon: "🍋",
  kiwi: "🥝", grape: "🍇", pear: "🍐", cherry: "🍒", tomato: "🍅", potato: "🥔", carrot: "🥕", eggplant: "🍆",
};

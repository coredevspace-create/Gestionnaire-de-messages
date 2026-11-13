import { FORMATS, isMock, type FormatId } from "./config";
import { changeCredits, db, type Series, type User } from "./db";
import { castFor, type RoleId } from "./catalog/characters";
import { getStory } from "./catalog/stories";
import { enqueueVideo } from "./pipeline/runner";

export class UserError extends Error {}

const FREE_CAST: RoleId[] = ["papa", "maman", "fils", "bellemere"];

function insertVideo(user: User, series: Series, episode: number, formatId: FormatId): number {
  const f = FORMATS[formatId];
  if (!changeCredits(user.id, -f.credits, `Vidéo ${series.title} ép. ${episode}`)) {
    throw new UserError(`Crédits insuffisants : il faut ${f.credits} crédits.`);
  }
  const res = db()
    .prepare(
      "INSERT INTO videos (user_id, series_id, episode, format, seconds, credits_cost, mock) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(user.id, series.id, episode, formatId, f.seconds, f.credits, isMock() ? 1 : 0);
  const id = Number(res.lastInsertRowid);
  enqueueVideo(id);
  return id;
}

/** Création en un clic : histoire du catalogue OU pitch libre. Les réglages viennent du profil. */
export function createSeriesAndFirstVideo(
  user: User,
  input: { storyId?: string; pitch?: string; formatId?: string; episodes?: number; country?: string },
): number {
  const story = input.storyId ? getStory(input.storyId) : undefined;
  const pitch = story?.pitch ?? input.pitch?.trim();
  if (!pitch) throw new UserError("Choisis une histoire ou écris ton idée en une phrase.");
  if (pitch.length > 500) throw new UserError("Ton idée est trop longue (500 caractères max).");

  const formatId = (input.formatId && input.formatId in FORMATS ? input.formatId : user.monetized ? "long70" : "short30") as FormatId;
  const episodes = [1, 3, 5, 8].includes(Number(input.episodes)) ? Number(input.episodes) : 1;
  const country = input.country || user.country;
  const cast = castFor(country, user.style, story?.cast ?? FREE_CAST);
  const title = story?.title ?? (pitch.length > 60 ? pitch.slice(0, 57) + "…" : pitch);

  const d = db();
  const res = d
    .prepare(
      "INSERT INTO series (user_id, title, pitch, country, style, format, episodes_total, cast_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(user.id, title, pitch, country, user.style, formatId, episodes, JSON.stringify(cast.map((c) => c.id)));
  const series = d.prepare("SELECT * FROM series WHERE id = ?").get(Number(res.lastInsertRowid)) as Series;
  try {
    return insertVideo(user, series, 1, formatId);
  } catch (e) {
    d.prepare("DELETE FROM series WHERE id = ?").run(series.id);
    throw e;
  }
}

/** « Épisode suivant » : un clic, mêmes personnages, même pays, même format. */
export function createNextEpisode(user: User, seriesId: number): number {
  const d = db();
  const series = d.prepare("SELECT * FROM series WHERE id = ? AND user_id = ?").get(seriesId, user.id) as
    | Series
    | undefined;
  if (!series) throw new UserError("Série introuvable.");
  const last = d
    .prepare("SELECT MAX(episode) AS n FROM videos WHERE series_id = ? AND status != 'failed'")
    .get(seriesId) as { n: number | null };
  const next = (last.n ?? 0) + 1;
  if (next > series.episodes_total) throw new UserError("Tous les épisodes de cette série sont déjà créés.");
  return insertVideo(user, series, next, series.format as FormatId);
}

/** Relance une vidéo échouée (recrédite déjà fait à l'échec, on redébite). */
export function retryVideo(user: User, videoId: number): number {
  const d = db();
  const v = d.prepare("SELECT * FROM videos WHERE id = ? AND user_id = ?").get(videoId, user.id) as
    | { id: number; status: string; series_id: number; episode: number; format: string }
    | undefined;
  if (!v || v.status !== "failed") throw new UserError("Cette vidéo ne peut pas être relancée.");
  const series = d.prepare("SELECT * FROM series WHERE id = ?").get(v.series_id) as Series;
  return insertVideo(user, series, v.episode, v.format as FormatId);
}

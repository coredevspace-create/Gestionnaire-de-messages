import { defaultFormat, FORMATS, isMock, type FormatId } from "./config";
import { changeCredits, one, sql, type Series, type User } from "./db";
import { castFor, type RoleId } from "./catalog/characters";
import { getStory } from "./catalog/stories";
import { kickVideo } from "./pipeline/kick";

export class UserError extends Error {}

const FREE_CAST: RoleId[] = ["papa", "maman", "fils", "bellemere"];

async function insertVideo(
  user: User,
  series: Series,
  episode: number,
  formatId: FormatId,
  music = true,
): Promise<number> {
  const f = FORMATS[formatId];
  if (!(await changeCredits(user.id, -f.credits, `Vidéo ${series.title} ép. ${episode}`))) {
    throw new UserError(`Crédits insuffisants : il faut ${f.credits} crédits.`);
  }
  const row = await one<{ id: number }>(
    `INSERT INTO videos (user_id, series_id, episode, format, seconds, credits_cost, mock, music)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [user.id, series.id, episode, formatId, f.seconds, f.credits, isMock(), music],
  );
  await kickVideo(row!.id);
  return row!.id;
}

/** Création en un clic : histoire du catalogue OU pitch libre. Les réglages viennent du profil. */
export async function createSeriesAndFirstVideo(
  user: User,
  input: { storyId?: string; pitch?: string; formatId?: string; episodes?: number; country?: string; music?: boolean },
): Promise<number> {
  const story = input.storyId ? getStory(input.storyId) : undefined;
  const pitch = story?.pitch ?? input.pitch?.trim();
  if (!pitch) throw new UserError("Choisis une histoire ou écris ton idée en une phrase.");
  if (pitch.length > 500) throw new UserError("Ton idée est trop longue (500 caractères max).");

  const formatId = (input.formatId && input.formatId in FORMATS ? input.formatId : defaultFormat(user.monetized)) as FormatId;
  const episodes = [1, 3, 5, 8].includes(Number(input.episodes)) ? Number(input.episodes) : 1;
  const country = input.country || user.country;
  const cast = await castFor(country, user.style, story?.cast ?? FREE_CAST);
  const title = story?.title ?? (pitch.length > 60 ? pitch.slice(0, 57) + "…" : pitch);

  const series = (await one<Series>(
    `INSERT INTO series (user_id, title, pitch, country, style, format, episodes_total, cast_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [user.id, title, pitch, country, user.style, formatId, episodes, JSON.stringify(cast.map((c) => c.id))],
  ))!;
  try {
    return await insertVideo(user, series, 1, formatId, input.music !== false);
  } catch (e) {
    await sql("DELETE FROM series WHERE id = $1", [series.id]);
    throw e;
  }
}

/** « Épisode suivant » : un clic, mêmes personnages, même pays, même format. */
export async function createNextEpisode(user: User, seriesId: number): Promise<number> {
  const series = await one<Series>("SELECT * FROM series WHERE id = $1 AND user_id = $2", [seriesId, user.id]);
  if (!series) throw new UserError("Série introuvable.");
  const last = (await one<{ n: number | null }>(
    "SELECT MAX(episode) AS n FROM videos WHERE series_id = $1 AND status != 'failed'",
    [seriesId],
  ))!;
  const next = (last.n ?? 0) + 1;
  if (next > series.episodes_total) throw new UserError("Tous les épisodes de cette série sont déjà créés.");
  const prev = await one<{ music: boolean }>("SELECT music FROM videos WHERE series_id = $1 ORDER BY id DESC LIMIT 1", [seriesId]);
  return insertVideo(user, series, next, series.format as FormatId, prev?.music ?? true);
}

/** Relance une vidéo échouée (recrédite déjà fait à l'échec, on redébite). */
export async function retryVideo(user: User, videoId: number): Promise<number> {
  const v = await one<{ id: number; status: string; series_id: number; episode: number; format: string }>(
    "SELECT * FROM videos WHERE id = $1 AND user_id = $2",
    [videoId, user.id],
  );
  if (!v || v.status !== "failed") throw new UserError("Cette vidéo ne peut pas être relancée.");
  const series = (await one<Series>("SELECT * FROM series WHERE id = $1", [v.series_id]))!;
  return insertVideo(user, series, v.episode, v.format as FormatId);
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config, isMock } from "../config";
import { changeCredits, one, sql, type Character, type Series, type Video } from "../db";
import { getCountry, getStyle } from "../catalog/countries";
import { fruitLabel } from "../catalog/characters";
import { checkSceneImage, editImage, generateImage, transcribeWords } from "../ai/openai";
import { checkVideo, submitVideo } from "../ai/xai";
import { mockClip, mockImage } from "../ai/mock";
import { buildPlan, buildScript, type Scene, type Script, type SeriesPlan } from "../ai/script";
import { getMedia, mediaExists, publicMediaUrl, putMedia } from "../storage";
import { burnSubtitles, concatClips, ffmpeg, mixAudio, normalizeClip } from "./ffmpeg";
import { pickTrack } from "../music";
import { buildAss, wordsToTimedLines, type TimedLine } from "./subtitles";
import { emptyMetrics, parseMetrics, timed, withMetrics, type Metrics } from "../metrics";

/**
 * Pipeline découpé en petites étapes pour tenir dans les fonctions Vercel (max 300 s).
 * Chaque appel à `work()` :
 *   1. prend un « bail » (lease) sur la vidéo pour qu'un seul process travaille dessus
 *   2. avance étape par étape tant qu'il reste du temps
 *   3. sauvegarde tout en base, rend la main, et renvoie "more" s'il reste du travail
 * L'appelant relance alors un nouvel appel (voir kick.ts).
 */

export const WORK_BUDGET_MS = Number(process.env.WORK_BUDGET_MS || 240_000);
const LEASE_SECONDS = 290;

type Ctx = {
  video: Video;
  series: Series;
  cast: Character[];
  script: Script | null;
  plan: SeriesPlan | null;
  metrics: Metrics;
};

/** Version des portraits de référence : changer la valeur force leur régénération. */
const SHEET_VERSION = "portrait-v2";

export function sheetIsCurrent(c: Character) {
  return !!c.sheet_path && c.sheet_path.includes(SHEET_VERSION);
}

async function setStep(id: number, step: string, extra: Record<string, string | null> = {}) {
  const fields: Record<string, string | null> = { step, ...extra };
  const keys = Object.keys(fields);
  await sql(
    `UPDATE videos SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
    [id, ...keys.map((k) => fields[k])],
  );
}

async function saveScript(ctx: Ctx, step: string) {
  await setStep(ctx.video.id, step, {
    script_json: JSON.stringify(ctx.script),
    metrics_json: JSON.stringify(ctx.metrics),
  });
}

async function saveMetrics(ctx: Ctx) {
  await sql("UPDATE videos SET metrics_json = $2 WHERE id = $1", [ctx.video.id, JSON.stringify(ctx.metrics)]);
}

/** Lance des tâches en parallèle (max `limit` à la fois). */
async function parallel<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

function slug(s: string) {
  return s.normalize("NFD").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

// ---------- Unités de travail (chacune < ~2 min) ----------

/**
 * Portrait de référence d'un personnage — généré UNE fois, partagé par tous.
 * Une seule pose plein cadre (pas de planche multi-vues : sinon les images de plan
 * reproduisent la mise en page en mosaïque).
 */
export async function makeSheet(c: Character, quality = process.env.OPENAI_PORTRAIT_QUALITY || "medium"): Promise<void> {
  const country = getCountry(c.country);
  const style = getStyle(c.style);
  let png: Buffer;
  if (isMock()) {
    png = await mockImage(`Portrait · ${c.name}`, `${fruitLabel(c.fruit)} — ${c.role}\n${country.name}`);
  } else {
    png = await generateImage(
      `Single full-body character portrait of ONE character: ${c.name}, an anthropomorphic character whose head is a realistic ${c.fruit} with an expressive face, human body. ${c.look}.${country.id === "monde" ? "" : ` Culture: ${country.name}.`}
Standing, front three-quarter view, neutral friendly expression, whole body visible from head to feet, centered.
ONE single image of ONE character only: no grid, no panels, no multiple views, no collage, no turnaround, no text. Plain light grey studio background.
Style: ${style.prompt}`,
      "1024x1536",
      quality,
    );
  }
  const ref = await putMedia(`characters/${c.id}-${slug(c.name)}-${c.fruit}-${SHEET_VERSION}.png`, png);
  await sql("UPDATE characters SET sheet_path = $2 WHERE id = $1", [c.id, ref]);
  c.sheet_path = ref;
}

function scenePrompt(scene: Scene, ctx: Ctx) {
  const style = getStyle(ctx.series.style);
  const country = getCountry(ctx.series.country);
  const who = ctx.cast
    .filter((c) => scene.characters.includes(c.name))
    .map((c) => `${c.name} (the ${c.fruit}-headed character)`)
    .join(", ");
  return `ONE single cinematic still frame (the first frame of a vertical 9:16 movie shot), one continuous scene filling the whole image.
STRICTLY FORBIDDEN: grid, panels, comic layout, split screen, collage, multiple frames, borders, insets, text, subtitles.
Characters: ${who || "the characters from the reference images"}. The reference images only show what each character looks like: keep EXACTLY the same fruit head, face and outfit, but place them together in the new scene.
Location: ${scene.setting}${country.id === "monde" ? "" : ` (${country.name})`}. Action: ${scene.action}. Camera: ${scene.camera}.
Style: ${style.prompt}`;
}

/** Voix demandée à Grok — jamais d'exemples de mots (sinon Grok les prononce tels quels). */
function voiceOf(countryId: string) {
  const country = getCountry(countryId);
  return country.id === "monde"
    ? "natural spoken French from France, casual tone"
    : `French spoken with a natural accent from ${country.name}`;
}

function videoPrompt(scene: Scene, ctx: Ctx) {
  const dialogue = scene.lines
    .map((l) =>
      /\(pens[ée]e\)/i.test(l.speaker)
        ? `${l.speaker.replace(/\s*\(pens[ée]e\)/i, "")} (inner voice-over, mouth closed): "${l.text}"`
        : `${l.speaker} (lips moving, facing camera): "${l.text}"`,
    )
    .join(" — then — ");
  return `One continuous single shot, no cuts. ${scene.action}. Camera: ${scene.camera}.
DIALOGUE — the ONLY words spoken in this clip, said clearly and completely, one voice at a time: ${dialogue}.
Nobody says anything else: no extra words, no improvisation, no background chatter, no crowd voices. Silence before and after the line.
Voice: ${voiceOf(ctx.series.country)}. Soft ambient sound only. No music, no subtitles, no text. Keep the characters identical to the first frame.`;
}

function sceneSeconds(ctx: Ctx): number[] {
  const n = ctx.script!.scenes.length;
  const total = ctx.video.seconds;
  const base = Math.floor(total / n);
  return ctx.script!.scenes.map((_, i) => (i < total - base * n ? base + 1 : base));
}

async function makeSceneImage(ctx: Ctx, i: number) {
  const scene = ctx.script!.scenes[i];
  let png: Buffer;
  if (isMock()) {
    png = await mockImage(`Plan ${i + 1}`, `${scene.characters.join(" & ")}\n\n${scene.action}`);
  } else {
    const inScene = ctx.cast.filter((c) => scene.characters.includes(c.name));
    const refs = await Promise.all((inScene.length ? inScene : ctx.cast).slice(0, 3).map((c) => getMedia(c.sheet_path!)));
    // Jusqu'à 2 essais : on regénère l'image (quelques centimes) plutôt que d'animer une image ratée.
    png = await editImage(scenePrompt(scene, ctx), refs, "1024x1536");
    const verdict = await checkSceneImage(png, scene);
    if (!verdict.ok) {
      console.warn(`[video ${ctx.video.id}] plan ${i + 1} refusé (${verdict.reason}), nouvel essai`);
      ctx.metrics.rejectedImages = (ctx.metrics.rejectedImages ?? 0) + 1;
      png = await editImage(scenePrompt(scene, ctx) + `\nPrevious attempt was rejected because: ${verdict.reason}. Fix it.`, refs, "1024x1536");
    }
  }
  scene.imagePath = await putMedia(`videos/${ctx.video.id}/scene-${i + 1}.png`, png);
}

async function submitClips(ctx: Ctx) {
  const secs = sceneSeconds(ctx);
  for (let i = 0; i < ctx.script!.scenes.length; i++) {
    const s = ctx.script!.scenes[i];
    if (s.clipPath || s.videoRequestId) continue;
    const img = s.imagePath!;
    const imageUrl =
      publicMediaUrl(img) ?? `data:image/png;base64,${(await getMedia(img)).toString("base64")}`;
    const seconds = Math.min(secs[i], config.clipSeconds);
    s.videoRequestId = await submitVideo({ prompt: videoPrompt(s, ctx), imageUrl, seconds });
    ctx.metrics.grokClips++;
    ctx.metrics.grokSeconds += seconds;
  }
}

/** Vérifie les clips Grok en cours. Renvoie true si au moins un est encore en attente. */
async function collectClips(ctx: Ctx): Promise<boolean> {
  let pending = false;
  for (let i = 0; i < ctx.script!.scenes.length; i++) {
    const s = ctx.script!.scenes[i];
    if (s.clipPath || !s.videoRequestId) continue;
    const r = await checkVideo(s.videoRequestId);
    if (r.state === "pending") pending = true;
    else if (r.state === "failed") throw new Error(`Plan ${i + 1} : ${r.error}`);
    else s.clipPath = await putMedia(`videos/${ctx.video.id}/clip-${i + 1}.mp4`, r.data);
  }
  return pending;
}

async function assemble(ctx: Ctx): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fs-video-${ctx.video.id}-`));
  try {
    const secs = sceneSeconds(ctx);
    const normalized: string[] = [];
    for (let i = 0; i < ctx.script!.scenes.length; i++) {
      const raw = path.join(dir, `raw-${i}.mp4`);
      fs.writeFileSync(raw, await getMedia(ctx.script!.scenes[i].clipPath!));
      const out = path.join(dir, `norm-${i}.mp4`);
      await normalizeClip(raw, out, secs[i]);
      normalized.push(out);
    }
    const joined = path.join(dir, "joined.mp4");
    await concatClips(normalized, joined);

    // Sous-titres : on transcrit la voix réelle de chaque plan (mot à mot) pour coller exactement
    // à ce qui est dit. Repli : le texte du scénario réparti sur la durée du plan.
    const offsets: number[] = [];
    secs.reduce((acc, d) => (offsets.push(acc), acc + d), 0);
    const perScene = await Promise.all(
      ctx.script!.scenes.map(async (s, i): Promise<TimedLine[]> => {
        if (!isMock()) {
          try {
            const mp3 = path.join(dir, `voice-${i}.mp3`);
            await ffmpeg(["-i", normalized[i], "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3]);
            const words = await transcribeWords(fs.readFileSync(mp3), s.lines.map((l) => l.text).join(" "));
            const lines = wordsToTimedLines(words, s.lines, offsets[i]).filter((l) => l.end <= offsets[i] + secs[i] + 0.3);
            if (lines.length) return lines;
          } catch (e) {
            console.warn(`[video ${ctx.video.id}] transcription plan ${i + 1} impossible`, e);
          }
        }
        const usable = Math.max(1, secs[i] - 0.6);
        const totalChars = s.lines.reduce((a, l) => a + l.text.length, 0) || 1;
        let cur = offsets[i] + 0.3;
        return s.lines.map((l) => {
          const d = (usable * l.text.length) / totalChars;
          const line = { speaker: l.speaker, text: l.text, start: cur, end: cur + d };
          cur += d;
          return line;
        });
      }),
    );
    const timed: TimedLine[] = perScene.flat();
    const assPath = path.join(dir, "subs.ass");
    const total = secs.reduce((a, b) => a + b, 0);
    const hasNext = ctx.video.episode < ctx.series.episodes_total;
    fs.writeFileSync(
      assPath,
      buildAss(timed, {
        total,
        title: `${ctx.series.title}${ctx.series.episodes_total > 1 ? ` · Partie ${ctx.video.episode}` : ""}`,
        outro: hasNext ? `À suivre… Partie ${ctx.video.episode + 1}` : undefined,
      }),
    );

    const subbed = path.join(dir, "subbed.mp4");
    await burnSubtitles(joined, assPath, subbed);

    // Musique de fond (si activée et si la bibliothèque en contient) + whoosh entre les plans.
    let musicFile: string | null = null;
    if (ctx.video.music !== false) {
      const track = await pickTrack(ctx.script!.mood);
      if (track) {
        musicFile = path.join(dir, `music${path.extname(track.path) || ".mp3"}`);
        fs.writeFileSync(musicFile, await getMedia(track.path));
      }
    }
    const cuts: number[] = [];
    secs.reduce((acc, d) => (cuts.push(acc + d), acc + d), 0);
    cuts.pop();
    const final = path.join(dir, "final.mp4");
    try {
      await mixAudio({ input: subbed, output: final, duration: total, music: musicFile, cuts });
    } catch (e) {
      console.error(`[video ${ctx.video.id}] mixage audio ignoré :`, e);
      fs.copyFileSync(subbed, final);
    }
    return putMedia(`videos/${ctx.video.id}/final.mp4`, fs.readFileSync(final));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Fait UNE unité de travail. Renvoie :
 *  - "done" : vidéo terminée
 *  - "progress" : une étape a avancé
 *  - "waiting" : on attend Grok
 */
async function step(ctx: Ctx, elapsedMs: number): Promise<"done" | "progress" | "waiting" | "stop"> {
  const id = ctx.video.id;

  const missing: Character[] = [];
  for (const c of ctx.cast) {
    if (!sheetIsCurrent(c) || !(await mediaExists(c.sheet_path))) {
      // Un autre process a peut-être déjà créé le portrait entre-temps.
      const fresh = await one<Character>("SELECT * FROM characters WHERE id = $1", [c.id]);
      if (fresh && sheetIsCurrent(fresh) && (await mediaExists(fresh.sheet_path))) c.sheet_path = fresh.sheet_path;
      else missing.push(c);
    }
  }
  if (missing.length) {
    await setStep(id, `Création des personnages (${missing.map((c) => c.name).join(", ")})`);
    await timed(ctx.metrics, "Personnages", () => parallel(missing, 4, makeSheet));
    ctx.metrics.sheets += missing.length;
    await saveMetrics(ctx);
    return "progress";
  }

  if (!ctx.plan) {
    await setStep(id, "Écriture du plan de la saison");
    ctx.plan = await timed(ctx.metrics, "Scénario", () => buildPlan({
      title: ctx.series.title,
      pitch: ctx.series.pitch,
      countryId: ctx.series.country,
      episodes: ctx.series.episodes_total,
      cast: ctx.cast,
      seconds: ctx.video.seconds,
    }));
    await saveMetrics(ctx);
    await sql("UPDATE series SET plan_json = $2, title = $3 WHERE id = $1", [
      ctx.series.id,
      JSON.stringify(ctx.plan),
      ctx.plan.title || ctx.series.title,
    ]);
    return "progress";
  }

  if (!ctx.script) {
    await setStep(id, "Écriture du scénario");
    ctx.script = await timed(ctx.metrics, "Scénario", () => buildScript({
      plan: ctx.plan!,
      episode: ctx.video.episode,
      countryId: ctx.series.country,
      styleId: ctx.series.style,
      cast: ctx.cast,
      seconds: ctx.video.seconds,
    }));
    if (!ctx.script.scenes?.length) throw new Error("Scénario vide");
    await saveScript(ctx, "Scénario prêt");
    return "progress";
  }

  const scenes = ctx.script.scenes;
  const n = scenes.length;

  const noImage = scenes.map((s, i) => (s.imagePath ? -1 : i)).filter((i) => i >= 0);
  if (noImage.length) {
    await setStep(id, `Images des plans (${n - noImage.length}/${n} prêtes)`);
    // Au plus 4 images par étape (en parallèle) pour tenir dans la durée max d'une fonction Vercel.
    const batch = noImage.slice(0, 4);
    await timed(ctx.metrics, "Images des plans", () => parallel(batch, 4, (i) => makeSceneImage(ctx, i)));
    await saveScript(ctx, `Images des plans (${n - noImage.length + batch.length}/${n} prêtes)`);
    return "progress";
  }

  if (scenes.some((s) => !s.clipPath)) {
    if (isMock()) {
      const i = scenes.findIndex((s) => !s.clipPath);
      await setStep(id, `Animation du plan ${i + 1}/${n}`);
      const s = scenes[i];
      const clip = await timed(ctx.metrics, "Animation", async () =>
        mockClip(await getMedia(s.imagePath!), sceneSeconds(ctx)[i], `Plan ${i + 1} · ${s.characters.join(" & ")}`),
      );
      s.clipPath = await putMedia(`videos/${id}/clip-${i + 1}.mp4`, clip);
      await saveScript(ctx, `Animation du plan ${i + 1}/${n}`);
      return "progress";
    }
    if (scenes.some((s) => !s.clipPath && !s.videoRequestId)) {
      await setStep(id, "Envoi des plans à l'animation");
      await timed(ctx.metrics, "Animation", () => submitClips(ctx));
      await saveScript(ctx, "Animation en cours");
      return "progress";
    }
    const pending = await timed(ctx.metrics, "Animation", () => collectClips(ctx));
    const ready = scenes.filter((s) => s.clipPath).length;
    await saveScript(ctx, `Animation en cours (${ready}/${n} plans prêts)`);
    return pending ? "waiting" : "progress";
  }

  // Le montage peut prendre 1-2 min : on ne le démarre qu'en début d'appel.
  if (elapsedMs > 30_000) return "stop";
  await setStep(id, "Montage final");
  const out = await timed(ctx.metrics, "Montage", () => assemble(ctx));
  ctx.metrics.finishedAt = new Date().toISOString();
  await setStep(id, "Terminé", { status: "done", output_path: out, metrics_json: JSON.stringify(ctx.metrics) });
  return "done";
}

/** Fait avancer une vidéo pendant au plus `budgetMs`. */
export async function work(id: number, budgetMs = WORK_BUDGET_MS): Promise<"done" | "more" | "busy" | "failed"> {
  const video = await one<Video>(
    `UPDATE videos SET lease_until = now() + ($2 || ' seconds')::interval, status = 'running'
     WHERE id = $1 AND status IN ('queued','running') AND (lease_until IS NULL OR lease_until < now())
     RETURNING *`,
    [id, String(LEASE_SECONDS)],
  );
  if (!video) return "busy";

  const start = Date.now();
  let metricsRef: Metrics | undefined;
  try {
    const series = (await one<Series>("SELECT * FROM series WHERE id = $1", [video.series_id]))!;
    const castIds = JSON.parse(series.cast_json) as number[];
    const cast: Character[] = [];
    for (const cid of castIds) cast.push((await one<Character>("SELECT * FROM characters WHERE id = $1", [cid]))!);
    const ctx: Ctx = {
      video,
      series,
      cast,
      plan: series.plan_json ? JSON.parse(series.plan_json) : null,
      script: video.script_json ? JSON.parse(video.script_json) : null,
      metrics: video.metrics_json ? parseMetrics(video.metrics_json) : emptyMetrics(),
    };
    ctx.metrics.startedAt ??= new Date(video.created_at).toISOString();
    metricsRef = ctx.metrics;

    // On s'arrête avant 2 min écoulées pour qu'une unité longue (image, montage) tienne dans le budget.
    while (Date.now() - start < budgetMs / 2) {
      const r = await withMetrics(ctx.metrics, () => step(ctx, Date.now() - start));
      if (r === "done") return "done";
      if (r === "stop") break;
      if (r === "waiting") await timed(ctx.metrics, "Animation", () => new Promise((res) => setTimeout(res, 8000)));
    }
    return "more";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[video ${id}]`, e);
    await setStep(id, "Échec", {
      status: "failed",
      error: msg,
      metrics_json: metricsRef ? JSON.stringify(metricsRef) : null,
    });
    await changeCredits(video.user_id, video.credits_cost, `Remboursement vidéo #${id}`);
    return "failed";
  } finally {
    await sql("UPDATE videos SET lease_until = NULL WHERE id = $1", [id]);
  }
}

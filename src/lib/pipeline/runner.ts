import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config, isMock } from "../config";
import { changeCredits, one, sql, type Character, type Series, type Video } from "../db";
import { getCountry, getStyle } from "../catalog/countries";
import { fruitLabel } from "../catalog/characters";
import { checkSceneImage, editImage, generateImage, transcribeWords, type Word } from "../ai/openai";
import { checkVideo, submitVideo } from "../ai/xai";
import { mockClip, mockImage } from "../ai/mock";
import { buildPlan, buildScript, type Scene, type Script, type SeriesPlan } from "../ai/script";
import { getMedia, mediaExists, publicMediaUrl, putMedia } from "../storage";
import { burnSubtitles, ffmpeg, joinWithTransitions, makeCover, mixAudio, normalizeClip, WHIP_SECONDS, type ClipFx } from "./ffmpeg";
import { pickTrack } from "../music";
import { buildAss, coverAss, wordsToTimedLines, type TimedLine } from "./subtitles";
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
ONLY these fruit-headed characters appear in the frame: ${scene.characters.join(" and ") || "the referenced characters"}. No other fruit-headed character, no crowd in focus.
Cinematic framing as described by the camera, shallow depth of field. Big expressive faces showing the emotion of the moment, eyes clearly visible (no sunglasses, nothing covering the eyes).
Style: ${style.prompt}`;
}

/** Voix d'un personnage : celle définie dans le plan de la série, sinon déduite de son rôle. */
function voiceFor(name: string, ctx: Ctx): string {
  const v = ctx.plan?.voices;
  const hit = v && (v[name] ?? Object.entries(v).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]);
  if (hit) return hit;
  const c = ctx.cast.find((x) => x.name === name);
  const role = `${c?.role ?? ""} ${c?.look ?? ""}`.toLowerCase();
  const female = /(m[eè]re|maman|fille|femme|[ée]pouse|soeur|sœur|directrice|reine|cliente|candidate|recruteuse|coll[eè]gue|woman|girl|mother|wife)/.test(role);
  const old = /(old|grand|vieux|vieille|elderly|belle-m[eè]re|p[eè]re|papa|uncle|oncle|pdg|ceo)/.test(role);
  return `${old ? "older" : "young"} ${female ? "woman" : "man"}, distinctive voice`;
}

function videoPrompt(scene: Scene, ctx: Ctx) {
  const line = scene.lines[0];
  const thought = line && /\(pens[ée]e\)/i.test(line.speaker);
  const speaker = line ? line.speaker.replace(/\s*\(pens[ée]e\)/i, "").trim() : "";
  const others = scene.characters.filter((c) => c !== speaker);
  const lang = getCountry(ctx.series.country).id === "monde" ? "French from France" : `French with a natural accent from ${getCountry(ctx.series.country).name}`;
  const speech = !line
    ? "Nobody speaks."
    : thought
      ? `ONLY ${speaker} speaks, whispering to themself, barely moving the lips: "${line.text}"`
      : `ONLY ${speaker} speaks, lips moving. Calm, unhurried delivery: half a second of silence, then the line at a slow conversational pace with natural pauses and strong emotion: "${line.text}"`;
  return `One continuous single shot, no cuts, steady camera. ${scene.action}. Camera: ${scene.camera}.
Strong, natural facial acting that matches the emotion of the line (eyes, eyebrows, mouth).
${speech}
${speaker ? `Voice of ${speaker}: ${voiceFor(speaker, ctx)}, speaking ${lang}.` : ""}
${others.length ? `${others.join(" and ")} stay${others.length > 1 ? "" : "s"} completely silent with mouth closed, only reacting with facial expressions.` : ""}
Exactly one voice in this clip. No other words, no improvisation, no background chatter. Soft ambient sound only. No music, no subtitles, no text.
Keep the characters identical to the first frame.`;
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

async function submitClips(ctx: Ctx, limit = Infinity) {
  const secs = sceneSeconds(ctx);
  for (let i = 0; i < Math.min(limit, ctx.script!.scenes.length); i++) {
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

/** Couverture TikTok : le plan choisi par le scénariste + le titre. Jamais bloquant. */
async function makeVideoCover(ctx: Ctx): Promise<string | null> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fs-cover-${ctx.video.id}-`));
  try {
    const scenes = ctx.script!.scenes;
    const idx = Math.min(Math.max(0, Math.round(Number(ctx.script!.cover) || 0)), scenes.length - 1);
    const img = path.join(dir, "img.png");
    fs.writeFileSync(img, await getMedia(scenes[idx].imagePath ?? scenes[0].imagePath!));
    const ass = path.join(dir, "cover.ass");
    fs.writeFileSync(ass, coverAss(ctx.series.title, `Partie ${ctx.video.episode}`));
    const out = path.join(dir, "cover.jpg");
    await makeCover(img, ass, out);
    return await putMedia(`videos/${ctx.video.id}/cover.jpg`, fs.readFileSync(out));
  } catch (e) {
    console.warn(`[video ${ctx.video.id}] couverture impossible`, e);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function assemble(ctx: Ctx): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fs-video-${ctx.video.id}-`));
  try {
    const planned = sceneSeconds(ctx);
    const scenes = ctx.script!.scenes;

    // 1. Pour chaque plan : transcription mot à mot de la voix réelle (Grok) …
    const raws: string[] = [];
    const wordsPer: (Word[] | null)[] = await Promise.all(
      scenes.map(async (s, i) => {
        const raw = path.join(dir, `raw-${i}.mp4`);
        fs.writeFileSync(raw, await getMedia(s.clipPath!));
        raws[i] = raw;
        if (isMock()) return null;
        try {
          const mp3 = path.join(dir, `voice-${i}.mp3`);
          await ffmpeg(["-i", raw, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3]);
          const w = await transcribeWords(fs.readFileSync(mp3), s.lines.map((l) => l.text).join(" "));
          return w.length ? w : null;
        } catch (e) {
          console.warn(`[video ${ctx.video.id}] transcription plan ${i + 1} impossible`, e);
          return null;
        }
      }),
    );

    // 2. … puis on coupe les blancs : le plan commence juste avant la 1re parole
    //    et s'arrête peu après la dernière (rythme TikTok, pas de « trous »).
    const cutStart: number[] = [];
    const secs: number[] = scenes.map((_, i) => {
      const w = wordsPer[i];
      if (!w) {
        cutStart[i] = 0;
        return planned[i];
      }
      const first = w[0].start;
      const last = w[w.length - 1].end;
      const begin = first > 0.7 ? Math.max(0, first - 0.3) : 0;
      const end = Math.min(planned[i] + 2, last + 0.55);
      cutStart[i] = begin;
      return Math.max(2.2, Math.round((end - begin) * 100) / 100);
    });

    // Montage façon série : panoramique filé (glissement + flou + whoosh) quand on change de lieu
    // et un changement de plan sur deux, coupe franche sinon ; zoom lent dans chaque plan.
    const whip = scenes.slice(0, -1).map((s, i) => s.setting !== scenes[i + 1].setting || i % 2 === 1);
    const normalized: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const out = path.join(dir, `norm-${i}.mp4`);
      // Dernier plan : 1 s d'arrêt sur image après la chute, pour qu'elle marque.
      const hold = i === scenes.length - 1 ? 1 : 0;
      if (hold) secs[i] += hold;
      const cam = (scenes[i].camera ?? "").toLowerCase();
      const fx: ClipFx = {
        zoom: /over.the.shoulder/.test(cam) ? "none" : /close/.test(cam) || i === scenes.length - 1 ? "in" : "out",
        blurIn: i > 0 && whip[i - 1] ? WHIP_SECONDS : 0,
        blurOut: i < scenes.length - 1 && whip[i] ? WHIP_SECONDS : 0,
      };
      await normalizeClip(raws[i], out, secs[i], cutStart[i], hold, fx);
      normalized.push(out);
    }
    const joined = path.join(dir, "joined.mp4");
    const { starts: offsets, total } = await joinWithTransitions(normalized, secs, whip, joined);

    // 3. Sous-titres calés sur les mots réels (décalés de la coupe). Repli : texte du scénario réparti.
    const perScene = scenes.map((s, i): TimedLine[] => {
      const w = wordsPer[i];
      if (w) {
        const shifted = w.map((x) => ({ ...x, start: x.start - cutStart[i], end: x.end - cutStart[i] }));
        const lines = wordsToTimedLines(shifted, s.lines, offsets[i]).filter((l) => l.start < offsets[i] + secs[i]);
        if (lines.length) return lines;
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
    });
    const timed: TimedLine[] = perScene.flat();
    const assPath = path.join(dir, "subs.ass");
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
    // Whoosh uniquement sur les panoramiques filés.
    const cuts = offsets.slice(1).map((o, i) => (whip[i] ? o + WHIP_SECONDS / 2 : -1)).filter((c) => c > 0);
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
async function step(ctx: Ctx, elapsedMs: number): Promise<"done" | "progress" | "waiting" | "stop" | "paused"> {
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
      pitch: ctx.series.pitch,
    }));
    if (!ctx.script.scenes?.length) throw new Error("Scénario vide");
    await saveScript(ctx, "Scénario prêt");
    return "progress";
  }

  const scenes = ctx.script.scenes;
  const n = scenes.length;

  // Aperçu : le 1er plan est animé en premier et montré à l'utilisateur avant de payer le reste.
  if (!ctx.video.approved) {
    const first = scenes[0];
    if (!first.imagePath) {
      await setStep(id, "Image du premier plan");
      await timed(ctx.metrics, "Images des plans", () => makeSceneImage(ctx, 0));
      await saveScript(ctx, "Image du premier plan prête");
      return "progress";
    }
    if (!first.clipPath && !first.videoRequestId) {
      await setStep(id, "Animation du premier clip");
      if (isMock()) {
        const clip = await mockClip(await getMedia(first.imagePath), sceneSeconds(ctx)[0], `Plan 1 · ${first.characters.join(" & ")}`);
        first.clipPath = await putMedia(`videos/${id}/clip-1.mp4`, clip);
      } else {
        await timed(ctx.metrics, "Animation", () => submitClips(ctx, 1));
      }
      await saveScript(ctx, "Animation du premier clip");
      return "progress";
    }
  }

  const noImage = scenes.map((s, i) => (s.imagePath ? -1 : i)).filter((i) => i >= 0);
  if (noImage.length) {
    await setStep(id, `Images des plans (${n - noImage.length}/${n} prêtes)`);
    // Au plus 4 images par étape (en parallèle) pour tenir dans la durée max d'une fonction Vercel.
    const batch = noImage.slice(0, 4);
    await timed(ctx.metrics, "Images des plans", () => parallel(batch, 4, (i) => makeSceneImage(ctx, i)));
    await saveScript(ctx, `Images des plans (${n - noImage.length + batch.length}/${n} prêtes)`);
    return "progress";
  }

  if (!ctx.video.approved) {
    if (!scenes[0].clipPath) {
      const pending = await timed(ctx.metrics, "Animation", () => collectClips(ctx));
      await saveScript(ctx, "Animation du premier clip");
      if (pending) return "waiting";
    }
    // Le clip est prêt : on attend le feu vert de l'utilisateur (la vidéo ne bouge plus d'ici là).
    await setStep(id, "Premier clip prêt : à toi de valider", { status: "review", metrics_json: JSON.stringify(ctx.metrics) });
    return "paused";
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
  const cover = await makeVideoCover(ctx);
  ctx.metrics.finishedAt = new Date().toISOString();
  await setStep(id, "Terminé", { status: "done", output_path: out, cover_path: cover, metrics_json: JSON.stringify(ctx.metrics) });
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
      if (r === "done" || r === "paused") return "done";
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

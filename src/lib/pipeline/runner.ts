import fs from "node:fs";
import path from "node:path";
import { config, isMock } from "../config";
import { changeCredits, db, type Character, type Series, type Video } from "../db";
import { getCountry, getStyle } from "../catalog/countries";
import { fruitLabel } from "../catalog/characters";
import { editImage, generateImage } from "../ai/openai";
import { imageToVideo } from "../ai/xai";
import { mockClip, mockImage } from "../ai/mock";
import { buildPlan, buildScript, type Scene, type Script, type SeriesPlan } from "../ai/script";
import { mediaPath, publicMediaUrl } from "../storage";
import { burnSubtitles, concatClips, normalizeClip, toSrtTime } from "./ffmpeg";

// ---------- File d'attente en mémoire (MVP : un seul process) ----------

const MAX_PARALLEL = 2;
const g = globalThis as unknown as { __queue?: { pending: number[]; running: Set<number> } };
const queue = (g.__queue ??= { pending: [], running: new Set() });

export function enqueueVideo(id: number) {
  if (queue.running.has(id) || queue.pending.includes(id)) return;
  queue.pending.push(id);
  pump();
}

function pump() {
  while (queue.running.size < MAX_PARALLEL && queue.pending.length) {
    const id = queue.pending.shift()!;
    queue.running.add(id);
    runVideo(id)
      .catch((e) => console.error(`[video ${id}]`, e))
      .finally(() => {
        queue.running.delete(id);
        pump();
      });
  }
}

/** Au démarrage du serveur : relance les vidéos interrompues. */
export function resumePending() {
  const rows = db()
    .prepare("SELECT id FROM videos WHERE status IN ('queued','running') ORDER BY id")
    .all() as { id: number }[];
  rows.forEach((r) => enqueueVideo(r.id));
}

// ---------- Pipeline ----------

function setStep(id: number, step: string, extra: Partial<Pick<Video, "status" | "script_json" | "output_path" | "error">> = {}) {
  const fields = { step, ...extra };
  const keys = Object.keys(fields);
  db()
    .prepare(`UPDATE videos SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => (fields as Record<string, string | null>)[k] ?? null), id);
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

/** Planche de référence d'un personnage — générée UNE fois, réutilisée pour toujours. */
export async function ensureSheet(c: Character): Promise<string> {
  if (c.sheet_path && fs.existsSync(mediaPath(c.sheet_path))) return c.sheet_path;
  const rel = path.join("characters", `${c.id}-${slug(c.name)}-${c.fruit}.png`);
  const style = getStyle(c.style);
  const country = getCountry(c.country);
  if (isMock()) {
    await mockImage(mediaPath(rel), `Planche · ${c.name}`, `${fruitLabel(c.fruit)} — ${c.role}\n${country.name}`, "landscape");
  } else {
    const prompt = `Character reference sheet (turnaround) of ONE character: ${c.name}, an anthropomorphic character whose head is a realistic ${c.fruit} with an expressive face, human body. ${c.look}. Setting culture: ${country.name}.
Show the same character: front view, 3/4 view, side view, back view, plus 3 facial expressions (happy, angry, shocked). Plain light grey background, no text, consistent outfit and proportions. Style: ${style.prompt}`;
    fs.mkdirSync(path.dirname(mediaPath(rel)), { recursive: true });
    fs.writeFileSync(mediaPath(rel), await generateImage(prompt, "1536x1024"));
  }
  db().prepare("UPDATE characters SET sheet_path = ? WHERE id = ?").run(rel, c.id);
  c.sheet_path = rel;
  return rel;
}

function scenePrompt(scene: Scene, cast: Character[], series: Series) {
  const style = getStyle(series.style);
  const country = getCountry(series.country);
  const who = cast
    .filter((c) => scene.characters.includes(c.name))
    .map((c) => `${c.name} (the ${c.fruit}-headed character from the reference sheet)`)
    .join(", ");
  return `First frame of a vertical 9:16 movie shot. Characters: ${who || "the characters from the reference sheets"}. They must look EXACTLY like their reference sheets (same fruit head, face, outfit).
Location: ${scene.setting} (${country.name}). Action: ${scene.action}. Camera: ${scene.camera}. No text, no subtitles. Style: ${style.prompt}`;
}

function videoPrompt(scene: Scene, series: Series) {
  const country = getCountry(series.country);
  const dialogue = scene.lines.map((l) => `${l.speaker} says: "${l.text}"`).join(" Then ");
  return `${scene.action}. Camera: ${scene.camera}. The characters talk with lip-sync and expressive gestures. ${dialogue}. Speech in ${country.accent}. Ambient sound of ${country.setting}. No music, no subtitles, keep characters identical to the first frame.`;
}

async function sceneImage(scene: Scene, i: number, video: Video, series: Series, cast: Character[]): Promise<string> {
  const rel = path.join("videos", String(video.id), `scene-${i + 1}.png`);
  if (isMock()) {
    await mockImage(mediaPath(rel), `Plan ${i + 1}`, `${scene.characters.join(" & ")}\n\n${scene.action}`);
  } else {
    const inScene = cast.filter((c) => scene.characters.includes(c.name));
    const refs = (inScene.length ? inScene : cast).slice(0, 4).map((c) => mediaPath(c.sheet_path!));
    fs.mkdirSync(path.dirname(mediaPath(rel)), { recursive: true });
    fs.writeFileSync(mediaPath(rel), await editImage(scenePrompt(scene, cast, series), refs, "1024x1536"));
  }
  return rel;
}

async function sceneClip(scene: Scene, i: number, video: Video, series: Series, seconds: number): Promise<string> {
  const rel = path.join("videos", String(video.id), `clip-${i + 1}.mp4`);
  const imgAbs = mediaPath(scene.imagePath!);
  if (isMock()) {
    await mockClip(imgAbs, mediaPath(rel), seconds, `Plan ${i + 1} · ${scene.characters.join(" & ")}`);
  } else {
    const imageUrl =
      publicMediaUrl(scene.imagePath!) ?? `data:image/png;base64,${fs.readFileSync(imgAbs).toString("base64")}`;
    const buf = await imageToVideo({ prompt: videoPrompt(scene, series), imageUrl, seconds });
    fs.writeFileSync(mediaPath(rel), buf);
  }
  return rel;
}

async function assemble(video: Video, script: Script, sceneSeconds: number[]): Promise<string> {
  const dir = mediaPath(path.join("videos", String(video.id)));
  const normalized: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const out = path.join(dir, `norm-${i + 1}.mp4`);
    await normalizeClip(mediaPath(script.scenes[i].clipPath!), out, sceneSeconds[i]);
    normalized.push(out);
  }
  const joined = path.join(dir, "joined.mp4");
  await concatClips(normalized, joined);

  // Sous-titres : chaque réplique occupe une part égale de son plan.
  let t = 0;
  let n = 1;
  const srt: string[] = [];
  script.scenes.forEach((s, i) => {
    const d = sceneSeconds[i];
    const per = d / Math.max(1, s.lines.length);
    s.lines.forEach((l, j) => {
      srt.push(`${n++}\n${toSrtTime(t + j * per + 0.1)} --> ${toSrtTime(t + (j + 1) * per - 0.1)}\n${l.text}\n`);
    });
    t += d;
  });
  const srtPath = path.join(dir, "subs.srt");
  fs.writeFileSync(srtPath, srt.join("\n"));

  const finalRel = path.join("videos", String(video.id), "final.mp4");
  await burnSubtitles(joined, srtPath, mediaPath(finalRel));
  [...normalized, joined].forEach((f) => fs.rmSync(f, { force: true }));
  return finalRel;
}

export async function runVideo(id: number) {
  const d = db();
  const video = d.prepare("SELECT * FROM videos WHERE id = ?").get(id) as Video | undefined;
  if (!video || video.status === "done" || video.status === "failed") return;
  const series = d.prepare("SELECT * FROM series WHERE id = ?").get(video.series_id) as Series;
  const castIds = JSON.parse(series.cast_json) as number[];
  const cast = castIds.map((cid) => d.prepare("SELECT * FROM characters WHERE id = ?").get(cid) as Character);

  try {
    setStep(id, "Préparation des personnages", { status: "running" });
    for (const c of cast) await ensureSheet(c);

    // Plan de la série (une fois pour toute la saison)
    let plan: SeriesPlan;
    if (series.plan_json) plan = JSON.parse(series.plan_json);
    else {
      setStep(id, "Écriture du plan de la saison");
      plan = await buildPlan({
        title: series.title,
        pitch: series.pitch,
        countryId: series.country,
        episodes: series.episodes_total,
        cast,
      });
      d.prepare("UPDATE series SET plan_json = ?, title = ? WHERE id = ?").run(
        JSON.stringify(plan),
        plan.title || series.title,
        series.id,
      );
    }

    // Script de l'épisode (sauvegardé pour reprendre en cas de crash)
    let script: Script;
    if (video.script_json) script = JSON.parse(video.script_json);
    else {
      setStep(id, "Écriture du scénario");
      script = await buildScript({
        plan,
        episode: video.episode,
        countryId: series.country,
        styleId: series.style,
        cast,
        seconds: video.seconds,
      });
      if (!script.scenes?.length) throw new Error("Scénario vide");
      setStep(id, "Scénario prêt", { script_json: JSON.stringify(script) });
    }

    // Durée de chaque plan : on répartit la durée totale.
    const n = script.scenes.length;
    const base = Math.floor(video.seconds / n);
    const sceneSeconds = script.scenes.map((_, i) => (i < video.seconds - base * n ? base + 1 : base));

    for (let i = 0; i < n; i++) {
      const s = script.scenes[i];
      if (!s.imagePath || !fs.existsSync(mediaPath(s.imagePath))) {
        setStep(id, `Image du plan ${i + 1}/${n}`);
        s.imagePath = await sceneImage(s, i, video, series, cast);
        setStep(id, `Image du plan ${i + 1}/${n}`, { script_json: JSON.stringify(script) });
      }
    }
    for (let i = 0; i < n; i++) {
      const s = script.scenes[i];
      if (!s.clipPath || !fs.existsSync(mediaPath(s.clipPath))) {
        setStep(id, `Animation du plan ${i + 1}/${n}`);
        s.clipPath = await sceneClip(s, i, video, series, Math.min(sceneSeconds[i], config.clipSeconds));
        setStep(id, `Animation du plan ${i + 1}/${n}`, { script_json: JSON.stringify(script) });
      }
    }

    setStep(id, "Montage final");
    const out = await assemble(video, script, sceneSeconds);
    setStep(id, "Terminé", { status: "done", output_path: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setStep(id, "Échec", { status: "failed", error: msg });
    changeCredits(video.user_id, video.credits_cost, `Remboursement vidéo #${id}`);
  }
}

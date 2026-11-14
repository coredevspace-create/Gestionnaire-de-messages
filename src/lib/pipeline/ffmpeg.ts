import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** ffmpeg embarqué (ffmpeg-static, fonctionne sur Vercel) sinon ffmpeg du système. */
function ffmpegBin(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("ffmpeg-static") as string | null;
    if (p && fs.existsSync(p)) return p;
  } catch {}
  return "ffmpeg";
}

/** Dossier des polices embarquées (utilisé par libass). */
export const FONTS_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "fonts");
export const FONT_NAME = "DejaVu Sans";

export async function ffmpeg(args: string[]) {
  try {
    await run(ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 24 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg : ${(err.stderr || err.message).slice(0, 600)}`);
  }
}

export async function hasAudio(file: string): Promise<boolean> {
  // ffmpeg -i sans sortie renvoie une erreur, mais décrit les flux sur stderr.
  try {
    await run(ffmpegBin(), ["-hide_banner", "-i", file]);
    return false;
  } catch (e) {
    return /Stream #.*Audio:/.test((e as { stderr?: string }).stderr ?? "");
  }
}

/** Durée d'un fichier audio/vidéo (s), lue dans la sortie de ffmpeg. */
export async function mediaDuration(file: string): Promise<number> {
  try {
    await run(ffmpegBin(), ["-hide_banner", "-i", file]);
  } catch (e) {
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec((e as { stderr?: string }).stderr ?? "");
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return 0;
}

/** Voix de synthèse plus vive : raccourcit les longues pauses et accélère légèrement (sans changer la hauteur). */
export async function tightenSpeech(input: string, output: string) {
  await ffmpeg([
    "-i", input,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.25:stop_threshold=-45dB:stop_silence=0.15:detection=peak,atempo=1.1",
    "-b:a", "128k", output,
  ]);
}

/** Échappe un chemin pour une option de filtre ffmpeg. */
export function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function subtitlesFilter(file: string, style: string) {
  return `subtitles='${filterPath(file)}':fontsdir='${filterPath(FONTS_DIR)}':force_style='${style}'`;
}


export type ClipFx = {
  /** Mouvement de caméra lent ajouté au montage */
  zoom?: "in" | "out" | "none";
  /** Flou de mouvement horizontal au début / à la fin (transition « panoramique filé ») */
  blurIn?: number;
  blurOut?: number;
};

/**
 * Normalise un clip : 720x1280, 30 fps, piste audio garantie, durée fixe.
 * `hold` : secondes d'arrêt sur image ajoutées à la fin (pour laisser « atterrir » la chute).
 */
export async function normalizeClip(input: string, output: string, seconds: number, start = 0, hold = 0, fx: ClipFx = {}) {
  const audio = await hasAudio(input);
  const frames = Math.max(1, Math.round((seconds - hold) * 30));
  const filters = ["scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30"];
  if (fx.zoom && fx.zoom !== "none") {
    // Zoom lent (6 %) ; image agrandie avant le zoompan pour un mouvement sans tremblement.
    const z = fx.zoom === "in" ? `1+0.06*min(on,${frames})/${frames}` : `1.06-0.06*min(on,${frames})/${frames}`;
    filters.push(`scale=1440:2560,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps=30`);
  }
  filters.push("format=yuv420p");
  if (hold > 0) filters.push(`trim=duration=${(seconds - hold).toFixed(2)},tpad=stop_mode=clone:stop_duration=${hold.toFixed(2)}`);
  // Garantit la durée exacte même si la source est un peu courte (sinon les transitions se décalent).
  else filters.push("tpad=stop_mode=clone:stop_duration=2");
  if (fx.blurIn) filters.push(`dblur=angle=0:radius=40:enable='lte(t,${fx.blurIn.toFixed(2)})'`);
  if (fx.blurOut) filters.push(`dblur=angle=0:radius=40:enable='gte(t,${(seconds - fx.blurOut).toFixed(2)})'`);
  filters.push("format=yuv420p");
  const seek = start > 0 ? ["-ss", start.toFixed(2)] : [];
  const args = audio ? [...seek, "-i", input] : [...seek, "-i", input, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
  args.push(
    "-t", String(seconds),
    "-vf", filters.join(","),
    "-map", "0:v:0", "-map", audio ? "0:a:0" : "1:a:0",
    ...(audio ? ["-af", "apad"] : []),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-ar", "44100", "-ac", "2",
    "-shortest", output,
  );
  await ffmpeg(args);
}

export async function concatClips(inputs: string[], output: string) {
  const list = output + ".txt";
  fs.writeFileSync(list, inputs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", output]);
  fs.unlinkSync(list);
}

/** Durée d'une transition « panoramique filé » et d'une coupe franche (1 image de fondu). */
export const WHIP_SECONDS = 0.22;
export const CUT_SECONDS = 0.04;

/**
 * Assemble les plans avec des transitions : panoramique filé (glissement + flou) ou coupe franche,
 * puis fondu au noir final. Renvoie l'instant de début de chaque plan dans la vidéo finale.
 */
export async function joinWithTransitions(
  inputs: string[],
  durations: number[],
  whip: boolean[],
  output: string,
): Promise<{ starts: number[]; total: number }> {
  const starts = [0];
  let t = 0;
  for (let i = 1; i < inputs.length; i++) {
    const d = whip[i - 1] ? WHIP_SECONDS : CUT_SECONDS;
    t += durations[i - 1] - d;
    starts.push(t);
  }
  const total = t + durations[durations.length - 1];
  if (inputs.length === 1) {
    fs.copyFileSync(inputs[0], output);
    return { starts, total };
  }
  const args: string[] = [];
  inputs.forEach((f) => args.push("-i", f));
  const parts: string[] = [];
  let v = "[0:v]";
  let a = "[0:a]";
  let dir = 0;
  for (let i = 1; i < inputs.length; i++) {
    const d = whip[i - 1] ? WHIP_SECONDS : CUT_SECONDS;
    const tr = whip[i - 1] ? (dir++ % 2 === 0 ? "slideleft" : "slideright") : "fade";
    parts.push(`${v}[${i}:v]xfade=transition=${tr}:duration=${d}:offset=${starts[i].toFixed(3)}[v${i}]`);
    parts.push(`${a}[${i}:a]acrossfade=d=${d}[a${i}]`);
    v = `[v${i}]`;
    a = `[a${i}]`;
  }
  parts.push(`${v}fade=t=out:st=${Math.max(0, total - 0.6).toFixed(2)}:d=0.6,format=yuv420p[vout]`);
  await ffmpeg([
    ...args,
    "-filter_complex", parts.join(";"),
    "-map", "[vout]", "-map", a,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
    "-c:a", "aac", "-ar", "44100", "-ac", "2",
    output,
  ]);
  return { starts, total };
}

/** Couverture 1080x1920 (JPEG) à partir d'une image de plan et d'un fichier ASS (titre). */
export async function makeCover(image: string, ass: string, output: string) {
  await ffmpeg([
    "-i", image,
    "-vf", `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,ass='${filterPath(ass)}':fontsdir='${filterPath(FONTS_DIR)}'`,
    "-frames:v", "1", "-q:v", "3", output,
  ]);
}

/** Incruste des sous-titres ASS ; en cas d'échec, garde la vidéo sans sous-titres. */
export async function burnSubtitles(input: string, ass: string, output: string) {
  try {
    await ffmpeg([
      "-i", input,
      "-vf", `ass='${filterPath(ass)}':fontsdir='${filterPath(FONTS_DIR)}'`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "copy",
      "-movflags", "+faststart", output,
    ]);
  } catch (e) {
    console.error("Sous-titres ignorés :", e);
    fs.copyFileSync(input, output);
  }
}

export function toSrtTime(s: number): string {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
}

/**
 * Mixage audio final :
 * - voix des personnages (piste d'origine)
 * - musique de fond en boucle, qui baisse automatiquement quand quelqu'un parle (sidechain),
 *   fondu d'entrée et de sortie
 * - petit « whoosh » à chaque changement de plan
 */
export async function mixAudio(opts: {
  input: string;
  output: string;
  duration: number;
  music?: string | null;
  cuts?: number[];
  musicVolume?: number;
}) {
  const T = opts.duration;
  const cuts = (opts.cuts ?? []).filter((c) => c > 0.5 && c < T - 0.3);
  const args = ["-i", opts.input];
  const parts: string[] = [];
  const mixInputs: string[] = [];
  let idx = 1;

  if (opts.music) {
    args.push("-stream_loop", "-1", "-i", opts.music);
    parts.push(`[0:a]asplit=2[voice][sc]`);
    parts.push(
      `[${idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${opts.musicVolume ?? 0.22},` +
        `afade=t=in:d=1,afade=t=out:st=${Math.max(0, T - 2).toFixed(2)}:d=2,atrim=0:${T.toFixed(2)}[mraw]`,
    );
    parts.push(`[mraw][sc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[mus]`);
    mixInputs.push("[voice]", "[mus]");
    idx++;
  } else {
    parts.push(`[0:a]anull[voice]`);
    mixInputs.push("[voice]");
  }

  if (cuts.length) {
    args.push("-f", "lavfi", "-i", "anoisesrc=d=0.6:c=pink:a=0.6:r=44100");
    parts.push(
      `[${idx}:a]highpass=f=500,lowpass=f=3500,afade=t=in:d=0.25,afade=t=out:st=0.25:d=0.35,volume=0.18,` +
        `aformat=channel_layouts=stereo,asplit=${cuts.length}${cuts.map((_, i) => `[w${i}]`).join("")}`,
    );
    cuts.forEach((c, i) => {
      const ms = Math.max(0, Math.round((c - 0.3) * 1000));
      parts.push(`[w${i}]adelay=${ms}|${ms}[wd${i}]`);
      mixInputs.push(`[wd${i}]`);
    });
    idx++;
  }

  if (mixInputs.length === 1) {
    fs.copyFileSync(opts.input, opts.output);
    return;
  }
  parts.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:normalize=0,alimiter=limit=0.95[aout]`);
  args.push(
    "-filter_complex", parts.join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
    "-t", T.toFixed(2), "-movflags", "+faststart", opts.output,
  );
  await ffmpeg(args);
}

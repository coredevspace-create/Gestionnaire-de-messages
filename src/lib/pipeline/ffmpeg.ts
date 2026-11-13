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

/** Échappe un chemin pour une option de filtre ffmpeg. */
export function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function subtitlesFilter(file: string, style: string) {
  return `subtitles='${filterPath(file)}':fontsdir='${filterPath(FONTS_DIR)}':force_style='${style}'`;
}


/** Normalise un clip : 720x1280, 30 fps, piste audio garantie, durée fixe. */
export async function normalizeClip(input: string, output: string, seconds: number, start = 0) {
  const audio = await hasAudio(input);
  const vf =
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,format=yuv420p";
  const seek = start > 0 ? ["-ss", start.toFixed(2)] : [];
  const args = audio ? [...seek, "-i", input] : [...seek, "-i", input, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
  args.push(
    "-t", String(seconds),
    "-vf", vf,
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

/** Incruste des sous-titres ASS ; en cas d'échec, garde la vidéo sans sous-titres. */
export async function burnSubtitles(input: string, ass: string, output: string) {
  try {
    await ffmpeg([
      "-i", input,
      "-vf", `ass='${filterPath(ass)}':fontsdir='${filterPath(FONTS_DIR)}'`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "copy",
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

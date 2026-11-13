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
export async function normalizeClip(input: string, output: string, seconds: number) {
  const audio = await hasAudio(input);
  const vf =
    "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p";
  const args = audio ? ["-i", input] : ["-i", input, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
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

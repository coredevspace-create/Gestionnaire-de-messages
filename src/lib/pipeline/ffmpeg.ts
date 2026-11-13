import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function ffmpeg(args: string[]) {
  try {
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 24 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg : ${(err.stderr || err.message).slice(0, 600)}`);
  }
}

export async function hasAudio(file: string): Promise<boolean> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file,
  ]);
  return stdout.trim().length > 0;
}

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
];

export function fontFile(): string | null {
  return FONT_CANDIDATES.find((f) => fs.existsSync(f)) ?? null;
}

/** Échappe un chemin pour une option de filtre ffmpeg. */
export function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

/** Normalise un clip : 720x1280, 30 fps, piste audio garantie, durée fixe. */
export async function normalizeClip(input: string, output: string, seconds: number) {
  const audio = await hasAudio(input);
  const vf =
    "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p";
  const args = audio
    ? ["-i", input]
    : ["-i", input, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
  args.push(
    "-t", String(seconds),
    "-vf", vf,
    "-map", "0:v:0", "-map", audio ? "0:a:0" : "1:a:0",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-ar", "44100", "-ac", "2",
    "-shortest", output,
  );
  // apad pour éviter qu'un audio trop court coupe la vidéo
  if (audio) args.splice(args.indexOf("-c:a"), 0, "-af", "apad");
  await ffmpeg(args);
}

export async function concatClips(inputs: string[], output: string) {
  const list = output + ".txt";
  fs.writeFileSync(list, inputs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", output]);
  fs.unlinkSync(list);
}

/** Incruste des sous-titres SRT ; si libass n'est pas dispo, copie simplement la vidéo. */
export async function burnSubtitles(input: string, srt: string, output: string) {
  const style = "FontName=DejaVu Sans,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=70";
  try {
    await ffmpeg([
      "-i", input,
      "-vf", `subtitles='${filterPath(srt)}':force_style='${style}'`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "copy",
      "-movflags", "+faststart", output,
    ]);
  } catch {
    fs.copyFileSync(input, output);
  }
}

export function toSrtTime(s: number): string {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
}

export function tmpName(dir: string, name: string) {
  return path.join(dir, name);
}

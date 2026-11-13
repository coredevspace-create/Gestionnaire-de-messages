import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ffmpeg, FONT_NAME, subtitlesFilter, toSrtTime } from "../pipeline/ffmpeg";

/**
 * Mode SIMULATION : images et clips factices (ffmpeg) pour tester tout le parcours
 * sans payer OpenAI ni xAI. Le texte est rendu via libass (dispo dans ffmpeg-static).
 */

const COLORS = ["0xF59E0B", "0xEF4444", "0x10B981", "0x8B5CF6", "0x3B82F6", "0xEC4899", "0x14B8A6"];

function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fs-mock-"));
}

function srtFile(dir: string, text: string, seconds: number) {
  const f = path.join(dir, "t.srt");
  fs.writeFileSync(f, `1\n${toSrtTime(0)} --> ${toSrtTime(seconds)}\n${text}\n`);
  return f;
}

const STYLE = (size: number, align: number) =>
  `FontName=${FONT_NAME},FontSize=${size},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=${align},MarginV=40`;

export async function mockImage(title: string, body: string, size: "portrait" | "landscape" = "portrait"): Promise<Buffer> {
  const dir = tmpDir();
  try {
    const s = size === "portrait" ? "720x1280" : "1280x720";
    const out = path.join(dir, "out.png");
    const srt = srtFile(dir, `[SIMULATION] ${title}\\N\\N${body.replace(/\n/g, "\\N")}`, 10);
    await ffmpeg([
      "-f", "lavfi", "-i", `color=c=${colorFor(title)}:s=${s}:d=1`,
      "-vf", subtitlesFilter(srt, STYLE(size === "portrait" ? 14 : 18, 10)),
      "-frames:v", "1", out,
    ]);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function mockClip(image: Buffer, seconds: number, caption: string): Promise<Buffer> {
  const dir = tmpDir();
  try {
    const img = path.join(dir, "in.png");
    const out = path.join(dir, "out.mp4");
    fs.writeFileSync(img, image);
    const srt = srtFile(dir, caption, seconds);
    await ffmpeg([
      "-loop", "1", "-i", img,
      "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100",
      "-t", String(seconds),
      "-vf", `scale=720:1280,zoompan=z='min(zoom+0.0015,1.15)':d=${seconds * 30}:s=720x1280:fps=30,${subtitlesFilter(srt, STYLE(12, 6))},format=yuv420p`,
      "-af", "volume=0.05",
      "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", out,
    ]);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

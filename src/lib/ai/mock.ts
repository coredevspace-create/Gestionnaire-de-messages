import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ffmpeg, filterPath, fontFile } from "../pipeline/ffmpeg";

/**
 * Mode SIMULATION : produit des images et des clips factices avec ffmpeg
 * pour tester tout le parcours sans payer OpenAI ni xAI.
 */

const COLORS = ["0xF59E0B", "0xEF4444", "0x10B981", "0x8B5CF6", "0x3B82F6", "0xEC4899", "0x14B8A6"];

function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function wrap(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

function textFilter(text: string, size: number, y: string, width: number) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fs-")), "t.txt");
  fs.writeFileSync(tmp, wrap(text, width));
  const font = fontFile();
  return (
    `drawtext=${font ? `fontfile='${filterPath(font)}':` : ""}textfile='${filterPath(tmp)}':` +
    `fontsize=${size}:fontcolor=white:borderw=3:bordercolor=black:line_spacing=10:x=(w-text_w)/2:y=${y}`
  );
}

export async function mockImage(outAbs: string, title: string, body: string, size: "portrait" | "landscape" = "portrait") {
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const s = size === "portrait" ? "720x1280" : "1280x720";
  const filters = [
    textFilter("[SIMULATION] " + title, size === "portrait" ? 40 : 44, "80", size === "portrait" ? 24 : 40),
    textFilter(body, 28, "(h-text_h)/2", size === "portrait" ? 36 : 70),
  ].join(",");
  await ffmpeg(["-f", "lavfi", "-i", `color=c=${colorFor(title)}:s=${s}`, "-vf", filters, "-frames:v", "1", outAbs]);
}

export async function mockClip(imageAbs: string, outAbs: string, seconds: number, caption: string) {
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const vf = [
    "scale=720:1280",
    // léger zoom pour simuler le mouvement
    `zoompan=z='min(zoom+0.0015,1.15)':d=${seconds * 30}:s=720x1280:fps=30`,
    textFilter(caption || "…", 30, "h-260", 34),
    "format=yuv420p",
  ].join(",");
  await ffmpeg([
    "-loop", "1", "-i", imageAbs,
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100",
    "-t", String(seconds),
    "-vf", vf,
    "-af", "volume=0.05",
    "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", outAbs,
  ]);
}

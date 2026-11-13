import path from "node:path";

export const config = {
  dataDir: path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATA_DIR || "./data"),
  openaiKey: process.env.OPENAI_API_KEY || "",
  xaiKey: process.env.XAI_API_KEY || "",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || "gpt-5-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  xaiVideoModel: process.env.XAI_VIDEO_MODEL || "grok-imagine-video-1.5",
  xaiVideoResolution: process.env.XAI_VIDEO_RESOLUTION || "480p",
  clipSeconds: Number(process.env.CLIP_SECONDS || 10),
  starterCredits: Number(process.env.STARTER_CREDITS || 30),
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

/** Mode simulation : aucune API payante n'est appelée. */
export function isMock(): boolean {
  return process.env.AI_MOCK === "1" || !config.openaiKey || !config.xaiKey;
}

/**
 * Formats proposés.
 * - court : 20 ou 30 s (comptes en croissance)
 * - long  : 70 s (comptes monétisés, > 1 min pour le programme TikTok)
 */
export const FORMATS = {
  short20: { label: "Court · 20 s", seconds: 20, kind: "short", credits: 8 },
  short30: { label: "Court · 30 s", seconds: 30, kind: "short", credits: 12 },
  long70: { label: "Long · 70 s (monétisation)", seconds: 70, kind: "long", credits: 28 },
} as const;

export type FormatId = keyof typeof FORMATS;

export function defaultFormat(monetized: boolean): FormatId {
  return monetized ? "long70" : "short30";
}

export const EPISODE_CHOICES = [1, 3, 5, 8] as const;

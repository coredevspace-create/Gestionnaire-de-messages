import path from "node:path";

export const config = {
  dataDir: path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/fruitstory" : "./data"),
  ),
  openaiKey: process.env.OPENAI_API_KEY || "",
  xaiKey: process.env.XAI_API_KEY || "",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || "gpt-5-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
  // Grok de base : ~40 % moins cher que la 1.5
  xaiVideoModel: process.env.XAI_VIDEO_MODEL || "grok-imagine-video",
  xaiVideoResolution: process.env.XAI_VIDEO_RESOLUTION || "480p",
  // Plans courts = rythme plus dynamique (on ne paie que les secondes affichées)
  clipSeconds: Number(process.env.CLIP_SECONDS || 5),
  // Crédits offerts : de quoi faire UNE vidéo de 20 s (80) — le reste ne suffit pas pour une 2e.
  starterCredits: Number(process.env.STARTER_CREDITS || 100),
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
  short20: { label: "Court · 20 s", seconds: 20, kind: "short", credits: 80 },
  short30: { label: "Court · 30 s", seconds: 30, kind: "short", credits: 120 },
  long70: { label: "Long · 70 s (monétisation)", seconds: 70, kind: "long", credits: 280 },
} as const;

export type FormatId = keyof typeof FORMATS;

export function defaultFormat(monetized: boolean): FormatId {
  return monetized ? "long70" : "short20";
}

export const EPISODE_CHOICES = [1, 3, 5, 8] as const;

import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "./config";

/**
 * Mesure du coût et du temps de chaque vidéo.
 * Les tarifs sont des estimations (modifiables par variables d'environnement) :
 * vérifier régulièrement les pages de prix OpenAI et xAI.
 */
export const PRICES = {
  // gpt-image-2 : $ par million de tokens
  imageInPerM: Number(process.env.PRICE_IMAGE_IN_PER_M || 8),
  imageTextInPerM: Number(process.env.PRICE_IMAGE_TEXT_IN_PER_M || 5),
  imageOutPerM: Number(process.env.PRICE_IMAGE_OUT_PER_M || 30),
  // modèle texte (mini) : $ par million de tokens
  textInPerM: Number(process.env.PRICE_TEXT_IN_PER_M || 0.25),
  textOutPerM: Number(process.env.PRICE_TEXT_OUT_PER_M || 2),
  // Grok Imagine Video : $ par seconde générée, selon la résolution
  // grok-imagine-video (base) : ~0,05 $/s en 480p, ~0,07 $/s en 720p
  // grok-imagine-video-1.5 : ~0,08 $/s en 480p, ~0,14 $/s en 720p
  grokPerSecond: Number(
    process.env.PRICE_GROK_PER_SECOND ||
      (config.xaiVideoModel.includes("1.5")
        ? config.xaiVideoResolution === "720p" ? 0.14 : 0.08
        : config.xaiVideoResolution === "720p" ? 0.07 : 0.05),
  ),
  // $ par image envoyée à Grok
  grokPerInputImage: Number(process.env.PRICE_GROK_PER_INPUT_IMAGE || 0.01),
};

export type Metrics = {
  /** Durée de chaque étape (ms), cumulée */
  steps: Record<string, number>;
  images: number;
  imageTokensIn: number;
  imageTextTokensIn: number;
  imageTokensOut: number;
  /** Images dont OpenAI n'a pas renvoyé l'usage (coût estimé forfaitairement) */
  imagesWithoutUsage: number;
  textTokensIn: number;
  textTokensOut: number;
  grokClips: number;
  /** Secondes d'audio transcrites (sous-titres) */
  transcribedSeconds?: number;
  grokSeconds: number;
  /** Planches de personnages générées pour cette vidéo (coût partagé ensuite) */
  sheets: number;
  /** Images de plan refusées par le contrôle qualité puis regénérées */
  rejectedImages?: number;
  startedAt?: string;
  finishedAt?: string;
};

export function emptyMetrics(): Metrics {
  return {
    steps: {},
    images: 0,
    imageTokensIn: 0,
    imageTextTokensIn: 0,
    imageTokensOut: 0,
    imagesWithoutUsage: 0,
    textTokensIn: 0,
    textTokensOut: 0,
    grokClips: 0,
    grokSeconds: 0,
    sheets: 0,
  };
}

const store = new AsyncLocalStorage<Metrics>();

/** Exécute `fn` en enregistrant l'usage des API dans `m`. */
export function withMetrics<T>(m: Metrics, fn: () => Promise<T>): Promise<T> {
  return store.run(m, fn);
}

export function current(): Metrics | undefined {
  return store.getStore();
}

export function recordImageUsage(usage?: {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { image_tokens?: number; text_tokens?: number };
}) {
  const m = current();
  if (!m) return;
  m.images++;
  if (!usage) {
    m.imagesWithoutUsage++;
    return;
  }
  const img = usage.input_tokens_details?.image_tokens ?? 0;
  const txt = usage.input_tokens_details?.text_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - img);
  m.imageTokensIn += img;
  m.imageTextTokensIn += txt;
  m.imageTokensOut += usage.output_tokens ?? 0;
}

export function recordTranscription(seconds: number) {
  const m = current();
  if (m) m.transcribedSeconds = (m.transcribedSeconds ?? 0) + seconds;
}

export function recordTextUsage(usage?: { prompt_tokens?: number; completion_tokens?: number }) {
  const m = current();
  if (!m || !usage) return;
  m.textTokensIn += usage.prompt_tokens ?? 0;
  m.textTokensOut += usage.completion_tokens ?? 0;
}

export async function timed<T>(m: Metrics, step: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    return await fn();
  } finally {
    m.steps[step] = (m.steps[step] ?? 0) + (Date.now() - t);
  }
}

/** Coût estimé en dollars, détaillé. */
export function costOf(m: Metrics) {
  const images =
    (m.imageTokensIn * PRICES.imageInPerM +
      m.imageTextTokensIn * PRICES.imageTextInPerM +
      m.imageTokensOut * PRICES.imageOutPerM) /
      1e6 +
    m.imagesWithoutUsage * 0.2; // forfait prudent si l'usage n'est pas renvoyé
  const text =
    (m.textTokensIn * PRICES.textInPerM + m.textTokensOut * PRICES.textOutPerM) / 1e6 +
    ((m.transcribedSeconds ?? 0) / 60) * 0.006;
  const video = m.grokSeconds * PRICES.grokPerSecond + m.grokClips * PRICES.grokPerInputImage;
  return { images, text, video, total: images + text + video };
}

export function parseMetrics(json: string | null | undefined): Metrics {
  try {
    return json ? { ...emptyMetrics(), ...JSON.parse(json) } : emptyMetrics();
  } catch {
    return emptyMetrics();
  }
}

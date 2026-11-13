import { config } from "../config";
import { recordImageUsage, recordTextUsage } from "../metrics";

const BASE = "https://api.openai.com/v1";

/**
 * Modèles essayés dans l'ordre. Le premier est celui de la variable d'environnement
 * (si définie). Si OpenAI répond que le modèle n'existe pas / n'est pas accessible,
 * on passe au suivant au lieu de faire échouer la vidéo.
 */
const IMAGE_MODELS = ["gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare"];
const TEXT_MODELS = ["gpt-5-mini", "gpt-5.1-mini", "gpt-4.1-mini", "gpt-4o-mini"];

function candidates(preferred: string | undefined, list: string[]) {
  return [...new Set([preferred, ...list].filter(Boolean) as string[])];
}

// Modèle qui a fonctionné en dernier (évite de retester les modèles morts à chaque appel).
const working: Record<"image" | "text", string | undefined> = { image: undefined, text: undefined };

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${config.openaiKey}`, ...extra };
}

class ModelUnavailable extends Error {}

async function check(res: Response, what: string) {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  const modelProblem =
    (res.status === 400 || res.status === 403 || res.status === 404) &&
    /model/i.test(body) &&
    /(does not exist|not found|invalid_value|model_not_found|do not have access|not supported)/i.test(body);
  const msg = `OpenAI ${what} a échoué (${res.status}) : ${body.slice(0, 400)}`;
  throw modelProblem ? new ModelUnavailable(msg) : new Error(msg);
}

async function withModels<T>(kind: "image" | "text", fn: (model: string) => Promise<T>): Promise<T> {
  const preferred = kind === "image" ? process.env.OPENAI_IMAGE_MODEL : process.env.OPENAI_TEXT_MODEL;
  const list = candidates(working[kind] ?? preferred, kind === "image" ? IMAGE_MODELS : TEXT_MODELS);
  let last: Error | undefined;
  for (const model of list) {
    try {
      const out = await fn(model);
      working[kind] = model;
      return out;
    } catch (e) {
      if (!(e instanceof ModelUnavailable)) throw e;
      console.warn(`[openai] modèle ${model} indisponible, essai du suivant`);
      last = e;
    }
  }
  throw last ?? new Error("Aucun modèle OpenAI disponible");
}

/** Appel texte qui renvoie un objet JSON. */
export async function chatJSON<T>(system: string, user: string): Promise<T> {
  return withModels("text", async (model) => {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    await check(res, "texte");
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    recordTextUsage(json.usage);
    return JSON.parse(json.choices[0].message.content) as T;
  });
}

/**
 * Contrôle qualité d'une image avant de payer son animation (≈ 0,001 $ par image).
 * En cas d'erreur de l'API, on laisse passer (on ne bloque jamais une vidéo pour ça).
 */
export async function checkSceneImage(
  png: Buffer,
  expected: { characters: string[]; action: string },
): Promise<{ ok: boolean; reason: string }> {
  try {
    return await withModels("text", async (model) => {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Tu contrôles la première image d\'une vidéo. Réponds en JSON {"ok": boolean, "reason": string}. ' +
                "ok=false UNIQUEMENT si : l'image est découpée en plusieurs cases/panneaux (grille, BD, split-screen, collage), " +
                "OU contient du texte/sous-titres incrustés, OU un personnage est gravement déformé (membres en trop, visage cassé). " +
                "Sinon ok=true (ne sois pas exigeant sur le style).",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Personnages attendus : ${expected.characters.join(", ")}. Action : ${expected.action}` },
                { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}`, detail: "low" } },
              ],
            },
          ],
        }),
      });
      await check(res, "contrôle image");
      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      recordTextUsage(json.usage);
      const r = JSON.parse(json.choices[0].message.content) as { ok?: boolean; reason?: string };
      return { ok: r.ok !== false, reason: r.reason ?? "" };
    });
  } catch (e) {
    console.warn("[openai] contrôle image ignoré :", e);
    return { ok: true, reason: "contrôle indisponible" };
  }
}

type ImageResponse = {
  data: { b64_json?: string; url?: string }[];
  usage?: Parameters<typeof recordImageUsage>[0];
};

async function toBuffer(json: ImageResponse): Promise<Buffer> {
  recordImageUsage(json.usage);
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error("OpenAI n'a renvoyé aucune image");
}

/** Génère une image à partir d'un prompt (planche de personnage). */
/**
 * Qualité : "low" | "medium" | "high". Les planches (réutilisées à vie) en "high",
 * les images de plan (simple 1re image d'une vidéo 480p) en "medium" pour réduire le coût.
 */
export async function generateImage(prompt: string, size = "1536x1024", quality = "high"): Promise<Buffer> {
  return withModels("image", async (model) => {
    const res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    });
    await check(res, "image");
    return toBuffer((await res.json()) as ImageResponse);
  });
}

/** Génère une image en s'appuyant sur des images de référence (planches des personnages). */
export async function editImage(
  prompt: string,
  refs: Buffer[],
  size = "1024x1536",
  quality = process.env.OPENAI_SCENE_QUALITY || "low",
): Promise<Buffer> {
  return withModels("image", async (model) => {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");
    refs.forEach((buf, i) =>
      form.append("image[]", new Blob([new Uint8Array(buf)], { type: "image/png" }), `ref-${i}.png`),
    );
    const res = await fetch(`${BASE}/images/edits`, { method: "POST", headers: headers(), body: form });
    await check(res, "image (références)");
    return toBuffer((await res.json()) as ImageResponse);
  });
}

/**
 * Modération (gratuite chez OpenAI) des idées écrites par les utilisateurs.
 * Renvoie la liste des catégories problématiques (vide = OK). En cas de panne de l'API, on laisse passer.
 */
export async function moderate(text: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/moderations`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest", input: text }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: { flagged: boolean; categories: Record<string, boolean> }[] };
    const r = json.results?.[0];
    if (!r?.flagged) return [];
    return Object.entries(r.categories).filter(([, v]) => v).map(([k]) => k);
  } catch {
    return [];
  }
}

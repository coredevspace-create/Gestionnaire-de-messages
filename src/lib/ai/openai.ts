import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

const BASE = "https://api.openai.com/v1";

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${config.openaiKey}`, ...extra };
}

async function check(res: Response, what: string) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${what} a échoué (${res.status}) : ${body.slice(0, 400)}`);
  }
}

/** Appel texte qui renvoie un objet JSON. */
export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: config.openaiTextModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  await check(res, "texte");
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(json.choices[0].message.content) as T;
}

type ImageResponse = { data: { b64_json?: string; url?: string }[] };

async function toBuffer(json: ImageResponse): Promise<Buffer> {
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error("OpenAI n'a renvoyé aucune image");
}

/** Génère une image à partir d'un prompt (planche de personnage). */
export async function generateImage(prompt: string, size = "1536x1024"): Promise<Buffer> {
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model: config.openaiImageModel, prompt, size, n: 1 }),
  });
  await check(res, "image");
  return toBuffer((await res.json()) as ImageResponse);
}

/** Génère une image en s'appuyant sur des images de référence (planches des personnages). */
export async function editImage(prompt: string, refAbsPaths: string[], size = "1024x1536"): Promise<Buffer> {
  const form = new FormData();
  form.append("model", config.openaiImageModel);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("n", "1");
  for (const p of refAbsPaths) {
    const blob = new Blob([fs.readFileSync(p)], { type: "image/png" });
    form.append("image[]", blob, path.basename(p));
  }
  const res = await fetch(`${BASE}/images/edits`, { method: "POST", headers: headers(), body: form });
  await check(res, "image (références)");
  return toBuffer((await res.json()) as ImageResponse);
}

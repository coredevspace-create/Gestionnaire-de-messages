import { config, isMock } from "../config";
import type { Character } from "../db";
import { getCountry, getStyle } from "../catalog/countries";
import { fruitLabel } from "../catalog/characters";
import { chatJSON } from "./openai";

export type EpisodePlan = { n: number; title: string; summary: string; cliffhanger: string };
export type SeriesPlan = { title: string; episodes: EpisodePlan[] };

export type Line = { speaker: string; text: string };
export type Scene = {
  characters: string[];
  setting: string;
  action: string;
  camera: string;
  lines: Line[];
  imagePath?: string;
  clipPath?: string;
};
export type Script = { title: string; scenes: Scene[] };

function castText(cast: Character[]) {
  return cast
    .map((c) => `- ${c.name} : ${fruitLabel(c.fruit)} (${c.role}) — ${c.look}`)
    .join("\n");
}

export async function buildPlan(input: {
  title: string;
  pitch: string;
  countryId: string;
  episodes: number;
  cast: Character[];
}): Promise<SeriesPlan> {
  if (isMock()) {
    return {
      title: input.title,
      episodes: Array.from({ length: input.episodes }, (_, i) => ({
        n: i + 1,
        title: input.episodes === 1 ? input.title : `${input.title} — partie ${i + 1}`,
        summary: `${input.pitch} (épisode ${i + 1})`,
        cliffhanger: i + 1 < input.episodes ? "Et là, quelqu'un frappe à la porte…" : "Fin.",
      })),
    };
  }
  const country = getCountry(input.countryId);
  return chatJSON<SeriesPlan>(
    `Tu es scénariste de mini-séries virales TikTok jouées par des personnages-fruits en 3D.
Public : Afrique francophone. Ton : drôle, dramatique, rebondissements, punchlines.
Réponds UNIQUEMENT en JSON : {"title": string, "episodes": [{"n": number, "title": string, "summary": string, "cliffhanger": string}]}.
Chaque épisode (sauf le dernier) finit sur un suspense fort.`,
    `Pays : ${country.name} (${country.setting}).
Titre : ${input.title}
Pitch : ${input.pitch}
Nombre d'épisodes : ${input.episodes}
Personnages :
${castText(input.cast)}`,
  );
}

export async function buildScript(input: {
  plan: SeriesPlan;
  episode: number;
  countryId: string;
  styleId: string;
  cast: Character[];
  seconds: number;
}): Promise<Script> {
  const sceneCount = Math.max(1, Math.round(input.seconds / config.clipSeconds));
  const ep = input.plan.episodes.find((e) => e.n === input.episode) ?? input.plan.episodes[0];

  if (isMock()) {
    return {
      title: ep.title,
      scenes: Array.from({ length: sceneCount }, (_, i) => {
        const a = input.cast[i % input.cast.length];
        const b = input.cast[(i + 1) % input.cast.length];
        return {
          characters: [a.name, b.name],
          setting: getCountry(input.countryId).setting,
          action: `Scène ${i + 1} : ${ep.summary}`,
          camera: "medium shot",
          lines: [
            { speaker: a.name, text: i === 0 ? "Attends… tu peux m'expliquer ça ?!" : "Je savais que ça allait arriver !" },
            { speaker: b.name, text: i === sceneCount - 1 ? ep.cliffhanger : "Ce n'est pas ce que tu crois…" },
          ],
        };
      }),
    };
  }

  const country = getCountry(input.countryId);
  const style = getStyle(input.styleId);
  return chatJSON<Script>(
    `Tu découpes un épisode de mini-série TikTok en plans vidéo de ${config.clipSeconds} secondes chacun.
Personnages-fruits 3D. Style : ${style.prompt}.
Règles :
- Exactement ${sceneCount} plans, format vertical.
- 1 à 2 répliques par plan, très courtes (max 12 mots), en français avec l'accent et les expressions : ${country.accent}.
- "setting", "action" et "camera" sont en ANGLAIS (servent aux prompts image/vidéo), les répliques en français.
- "characters" ne contient que des prénoms de la liste fournie (max 3 par plan).
- Le premier plan accroche en 2 secondes, le dernier finit sur : ${ep.cliffhanger}
Réponds UNIQUEMENT en JSON : {"title": string, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`,
    `Pays : ${country.name} — décor : ${country.setting}
Épisode ${ep.n} : ${ep.title}
Résumé : ${ep.summary}
Personnages :
${castText(input.cast)}`,
  );
}

import { config, isMock } from "../config";
import type { Character } from "../db";
import { getCountry, getStyle } from "../catalog/countries";
import { fruitLabel } from "../catalog/characters";
import { chatJSON } from "./openai";

/**
 * Formule des vidéos « fruits IA » virales (analyse de vidéos TikTok à succès) :
 * personnages sous-estimés, injustice révoltante, test moral, pouvoir/secret caché,
 * enjeux énormes, et arrêt net au moment le plus intense.
 */
const VIRAL_FORMULA = `FORMULE VIRALE À APPLIQUER :
1. ACCROCHE (0-3 s) : une image ou une phrase choc immédiate (exploit impossible, humiliation, menace, chiffre énorme). Jamais d'introduction lente.
2. EMPATHIE : un héros sympathique et sous-estimé (pauvre, humble, honnête, « le nouveau », le cousin du village) face à un méchant arrogant ou fourbe.
3. INJUSTICE / TEST : humiliation, trahison, vol, mensonge, ou test moral secret (le patron/la belle-famille teste quelqu'un). Le spectateur doit être révolté.
4. SECRET : quelque chose que le méchant ignore (le héros est riche en secret, a un pouvoir, a une preuve filmée, est le vrai propriétaire…). On peut révéler une PENSÉE intérieure pour mettre le spectateur dans la confidence.
5. ESCALADE : chaque plan monte d'un cran (enjeux énormes, chiffres précis : « 5 millions », « 300 tonnes »).
6. ARRÊT NET au moment le plus intense (juste avant la révélation ou la riposte) → le spectateur veut la suite.
Ton : familier, vivant, punchlines, comme des vrais gens qui parlent (« frère », « mon gars », « wesh », « eh Dieu ! »), toujours compréhensible.`;

export type EpisodePlan = { n: number; title: string; summary: string; cliffhanger: string };
export type SeriesPlan = { title: string; episodes: EpisodePlan[] };

export type Line = { speaker: string; text: string };
export type Scene = {
  characters: string[];
  setting: string;
  action: string;
  camera: string;
  lines: Line[];
  /** Référence média (URL Blob ou chemin local) */
  imagePath?: string;
  /** Requête Grok en cours */
  videoRequestId?: string;
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
        cliffhanger: i + 1 < input.episodes ? "Et là, quelqu'un frappe à la porte…" : "Tout le quartier éclate de rire.",
      })),
    };
  }
  const country = getCountry(input.countryId);
  return chatJSON<SeriesPlan>(
    `Tu es scénariste de mini-séries virales TikTok jouées par des personnages-fruits en 3D.
Public : Afrique francophone (et diaspora). Ton : drôle, dramatique, rebondissements, punchlines.
L'histoire doit être simple à suivre : un enjeu clair (argent, mariage, trahison, honte publique…), des personnages aux motivations évidentes.
${VIRAL_FORMULA}
Réponds UNIQUEMENT en JSON : {"title": string, "episodes": [{"n": number, "title": string, "summary": string, "cliffhanger": string}]}.
Chaque épisode (sauf le dernier) finit sur un suspense fort. Le dernier épisode finit sur une chute drôle ou choquante (décrite en une phrase, pas "Fin").`,
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
- 1 à 2 répliques par plan, très courtes (max 10 mots), qui se disent en ${config.clipSeconds} secondes.
${VIRAL_FORMULA}
- Une pensée intérieure est permise : speaker = "Prénom (pensée)".
- Varie les cadrages d'un plan à l'autre (gros plan visage, plan large, plan sur un objet clé : billets, téléphone, coffre…). 2 à 4 lieux maximum.
- LISIBILITÉ AVANT TOUT : français simple que n'importe quel francophone comprend du premier coup.
  Couleur locale (${country.accent}) : au maximum UNE expression locale par plan, toujours compréhensible grâce au contexte.
- L'histoire doit être claire même sans le son : situation → conflit → retournement. Chaque réplique fait avancer l'histoire
  (révèle une info, accuse, ment, menace, avoue…). Pas de répliques vagues ou de remplissage.
- Les personnages s'appellent par leur prénom ou leur rôle (« Papa », « Tonton ») dans les premiers plans pour qu'on sache qui est qui.
- "setting", "action" et "camera" sont en ANGLAIS (servent aux prompts image/vidéo), les répliques en français.
- "characters" ne contient que des prénoms de la liste fournie (max 3 par plan, idéalement 1 ou 2 : plus lisible).
- "lines" ne contient QUE des paroles prononcées à voix haute par un personnage : jamais de résumé, de narration, de didascalie ni de mot comme "Fin", "Suite", "Morale".
- Le premier plan accroche en 2 secondes : une phrase choc ou une question qui donne envie de connaître la suite.
- Le dernier plan se termine sur une réplique choc qui illustre ce moment (sans le recopier) : ${ep.cliffhanger}
- Chaque plan = UNE seule action continue dans UN seul lieu (pas de montage, pas de split-screen).
Réponds UNIQUEMENT en JSON : {"title": string, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`,
    `Pays : ${country.name} — décor : ${country.setting}
Épisode ${ep.n} : ${ep.title}
Résumé : ${ep.summary}
Personnages :
${castText(input.cast)}`,
  );
}

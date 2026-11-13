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
Ton : familier et vivant, comme de vrais gens qui parlent, avec des mots simples. Toujours compréhensible.`;

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
export type Script = {
  title: string;
  /** Ambiance musicale : suspense | drame | emotion | action | comedie | triomphe */
  mood?: string;
  scenes: Scene[];
};

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
  /** Durée d'un épisode (s) : chaque épisode ne contient que ce qui tient dans ce temps */
  seconds?: number;
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
Chaque épisode = UNE scène filmable : un lieu, deux personnages principaux face à face, un conflit concret (argent, accusation, humiliation, secret),
et un fait précis révélé ou un geste fort à la fin. "summary" décrit cette scène en 2 phrases concrètes (qui, où, quoi, ce qui est révélé).
Chaque épisode (sauf le dernier) finit sur un suspense fort et précis. Le dernier épisode finit sur une chute drôle ou choquante (pas "Fin").
Les épisodes s'enchaînent : chacun reprend exactement là où le précédent s'est arrêté.`,
    `Pays : ${country.name} (${country.setting}).
Titre : ${input.title}
Pitch : ${input.pitch}
Nombre d'épisodes : ${input.episodes}
Durée de chaque épisode : ${input.seconds ?? 30} secondes. Chaque "summary" ne décrit qu'UNE situation simple qui tient dans cette durée
(en ${input.seconds ?? 30} s : 3 à ${Math.max(3, Math.round((input.seconds ?? 30) / 6))} répliques). Si l'histoire est longue, garde le reste pour les épisodes suivants.
${input.episodes === 1 ? "Épisode unique : raconte seulement le début accrocheur de l'histoire et coupe sur un suspense." : ""}
Personnages :
${castText(input.cast)}`,
    "writer",
  );
}

/** Débit de parole visé (mots par seconde) : sert à remplir chaque plan sans blanc. */
const WORDS_PER_SECOND = 2.4;

/** Exemple de référence (qualité attendue) montré au scénariste. */
const GOLD_EXAMPLE = `EXEMPLE DE RÉFÉRENCE (20 s, 3 plans) — imite ce niveau de clarté et de tension, pas son histoire :
{"title":"Le test du patron","logline":"Accusé de vol par son patron, l'employé révèle que la vraie voleuse est la femme du patron.","mood":"suspense",
"scenes":[
{"characters":["M. Mangue","Kouassi"],"setting":"small shop office, cash register open and empty","action":"M. Mangue, furious, slams the empty cash box on the desk and points at Kouassi, who raises his hands, shocked","camera":"medium shot",
 "lines":[{"speaker":"M. Mangue","text":"Kouassi, il manque cinq cent mille francs dans ma caisse ce matin !"},{"speaker":"Kouassi","text":"Patron, je vous jure, je n'ai jamais touché à votre argent."}]},
{"characters":["M. Mangue","Kouassi"],"setting":"same office","action":"M. Mangue shoves the register book with a signature in Kouassi's face; Kouassi looks at it, then his eyes narrow as he understands","camera":"close-up on Kouassi's face",
 "lines":[{"speaker":"M. Mangue","text":"Alors pourquoi ta signature est sur le registre, menteur ?"},{"speaker":"Kouassi (pensée)","text":"Quelqu'un a imité ma signature… et je sais exactement qui."}]},
{"characters":["Kouassi","M. Mangue"],"setting":"same office","action":"Kouassi turns his phone screen toward M. Mangue: a video shows a woman taking the money; M. Mangue's face freezes in shock","camera":"over-the-shoulder shot on the phone screen",
 "lines":[{"speaker":"Kouassi","text":"Regardez la caméra du magasin, patron. C'est votre propre femme."},{"speaker":"M. Mangue","text":"Quoi ?! Fraise… ce n'est pas possible !"}]}]}`;

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
  const perShot = input.seconds / sceneCount;
  const wordsMin = Math.round(perShot * WORDS_PER_SECOND * 0.8);
  const wordsMax = Math.round(perShot * WORDS_PER_SECOND * 1.05);

  if (isMock()) {
    return {
      title: ep.title,
      mood: "suspense",
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
  const world =
    country.id === "monde"
      ? "Univers Monde : décors universels, argent en euros, prénoms courants, aucune référence africaine."
      : `Univers ${country.name} : décors, prénoms et argent locaux (${country.setting}).`;

  const rules = `CONTRAINTES :
- Exactement ${sceneCount} plans de ~${perShot.toFixed(0)} s, format vertical. ${world}
- UNE SEULE SCÈNE : même lieu, temps continu, les mêmes 2 personnages principaux (un 3e au maximum, seulement s'il est indispensable).
- DIALOGUE QUI REMPLIT LE TEMPS : chaque plan contient ${wordsMin} à ${wordsMax} mots de dialogue au total
  (en général 2 répliques qui se répondent, chacune une phrase complète). Aucun plan muet, aucun blanc.
- Plan 1 : en une phrase, on comprend QUI accuse/menace QUI et POURQUOI (l'enjeu concret, avec un chiffre ou un objet précis).
- Chaque réplique répond directement à la précédente (question → réponse, accusation → défense, menace → riposte).
- Le dernier plan contient le RETOURNEMENT ou la RÉVÉLATION, dit clairement, avec la réaction du perdant. Rien de vague (« tu vas voir… »).
- Interdits : phrases télégraphiques, énumérations, informations qui tombent du ciel, « Fin », narration, didascalies dans les répliques.
- Pensée intérieure possible : speaker = "Prénom (pensée)" (au plus une par épisode).
- "characters" et "speaker" : EXACTEMENT les noms de la liste fournie.
- "setting", "action", "camera" en ANGLAIS. "action" décrit ce qu'on VOIT : le geste, l'objet clé visible, et la réaction de l'autre.
- "mood" parmi : suspense, drame, emotion, action, comedie, triomphe.
Réponds UNIQUEMENT en JSON : {"title": string, "logline": string, "mood": string, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`;

  const brief = `Épisode ${ep.n}/${input.plan.episodes.length} : ${ep.title}
Ce qui doit se passer : ${ep.summary}
Fin de l'épisode : ${ep.cliffhanger}
Personnages disponibles :
${castText(input.cast)}`;

  const draft = await chatJSON<Script>(
    `Tu es le meilleur scénariste de mini-séries TikTok (personnages-fruits 3D, style ${style.prompt}).
Tu écris un épisode de ${input.seconds} secondes que n'importe qui comprend du premier coup et regarde jusqu'au bout.
Méthode : 1) choisis UN conflit simple et concret entre deux personnages ; 2) écris la scène comme un vrai dialogue de film,
naturel, tendu, avec des répliques qui s'enchaînent ; 3) découpe-la en plans.
${VIRAL_FORMULA}
${rules}
${GOLD_EXAMPLE}`,
    brief,
    "writer",
  );
  draft.scenes = normalizeNames(draft.scenes ?? [], input.cast);

  // Relecture notée : si la note est faible, réécriture complète.
  try {
    const review = await chatJSON<Script & { score?: number; problems?: string[] }>(
      `Tu es script doctor exigeant. On te donne un épisode TikTok de ${input.seconds} s en JSON.
Lis-le comme un spectateur qui ne connaît RIEN de l'histoire et n'a que les images et les répliques.
Note sur 10 (champ "score") selon : clarté de la situation dès le plan 1, logique réplique après réplique,
tension qui monte, retournement net et compréhensible à la fin, dialogue naturel, absence de blancs (${wordsMin}-${wordsMax} mots par plan).
Liste les défauts dans "problems". Puis renvoie la version CORRIGÉE de l'épisode (même format, ${sceneCount} plans, mêmes noms) :
si la note est < 8, réécris franchement le dialogue pour atteindre 9/10 en gardant l'idée.
${rules}`,
      JSON.stringify(draft),
      "writer",
    );
    if (review?.scenes?.length === sceneCount && review.scenes.every((sc) => sc.lines?.length)) {
      const { problems, score, ...rest } = review;
      console.log("[script doctor]", score, problems);
      rest.scenes = normalizeNames(rest.scenes, input.cast);
      return rest;
    }
  } catch (e) {
    console.warn("[script doctor] relecture ignorée", e);
  }
  return draft;
}

function norm(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * L'IA renomme parfois un personnage (« La Pastèque » au lieu de « Le Boss ») : on ramène chaque nom
 * au bon personnage du casting (nom exact, puis fruit, puis rôle), pour retrouver son portrait de référence.
 */
export function normalizeNames(scenes: Scene[], cast: Character[]): Scene[] {
  const resolve = (raw: string) => {
    const thought = /\(pens[ée]e\)/i.test(raw);
    const name = raw.replace(/\s*\(pens[ée]e\)/i, "").trim();
    const n = norm(name);
    const hit =
      cast.find((c) => norm(c.name) === n) ??
      cast.find((c) => n.includes(norm(c.name)) || norm(c.name).includes(n)) ??
      cast.find((c) => n.includes(norm(fruitLabel(c.fruit)))) ??
      cast.find((c) => n.includes(norm(c.role)) || norm(c.role).split(/\s+/).some((w) => w.length > 4 && n.includes(w)));
    const fixed = hit?.name ?? name;
    return thought ? `${fixed} (pensée)` : fixed;
  };
  return scenes.map((s) => ({
    ...s,
    characters: [...new Set((s.characters ?? []).map(resolve))],
    lines: (s.lines ?? []).map((l) => ({ ...l, speaker: resolve(l.speaker) })),
  }));
}

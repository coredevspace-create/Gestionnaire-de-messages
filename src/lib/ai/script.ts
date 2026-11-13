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
Chaque épisode (sauf le dernier) finit sur un suspense fort. Le dernier épisode finit sur une chute drôle ou choquante (décrite en une phrase, pas "Fin").`,
    `Pays : ${country.name} (${country.setting}).
Titre : ${input.title}
Pitch : ${input.pitch}
Nombre d'épisodes : ${input.episodes}
Durée de chaque épisode : ${input.seconds ?? 30} secondes. Chaque "summary" ne décrit qu'UNE situation simple qui tient dans cette durée
(en ${input.seconds ?? 30} s : 3 à ${Math.max(3, Math.round((input.seconds ?? 30) / 6))} répliques). Si l'histoire est longue, garde le reste pour les épisodes suivants.
${input.episodes === 1 ? "Épisode unique : raconte seulement le début accrocheur de l'histoire et coupe sur un suspense." : ""}
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
      ? "Univers Monde : décors universels, argent en euros, aucune référence africaine (pas de FCFA, pas de pagne…)."
      : `Univers ${country.name} : décors, prénoms et argent locaux (${country.setting}).`;

  const draft = await chatJSON<Script>(
    `Tu es scénariste de mini-séries TikTok jouées par des personnages-fruits 3D. Tu écris UN épisode de ${input.seconds} secondes,
découpé en exactement ${sceneCount} plans de ~${config.clipSeconds} s. Style visuel : ${style.prompt}.
${world}

PRINCIPE N°1 — UN SPECTATEUR QUI NE SAIT RIEN DOIT TOUT COMPRENDRE.
En ${input.seconds} secondes on ne raconte qu'UNE situation simple, pas toute l'histoire. Mieux vaut moins d'événements, parfaitement clairs.

BEATS OBLIGATOIRES :
${beats(sceneCount)}

RÈGLES DES RÉPLIQUES :
- UNE réplique par plan, dite par UN personnage visible. Phrase complète, naturelle, 6 à 12 mots, dicible en ${Math.max(3, config.clipSeconds - 2)} s.
- Chaque réplique répond DIRECTEMENT à la précédente ou à ce qu'on vient de voir (cause → conséquence). Aucun saut logique.
- Toute information nécessaire est DITE ou MONTRÉE (qui est qui, ce qu'il veut, ce qui est en jeu). Pas de chiffres ni de noms sortis de nulle part.
- Le méchant et la victime sont identifiables dès le plan 1 (on s'appelle par son prénom ou son rôle).
- Pas de jargon, pas d'énumérations télégraphiques (« 300 plateaux, 5 minutes »). Français simple, ton familier.
- Une pensée intérieure est permise : speaker = "Prénom (pensée)".
- Au maximum ${sceneCount <= 5 ? "2 ou 3" : "4"} personnages dans tout l'épisode.
${VIRAL_FORMULA}

RÈGLES DES IMAGES ("setting", "action", "camera" en ANGLAIS) :
- "action" décrit précisément ce qu'on VOIT : qui fait quoi, l'objet clé visible (téléphone avec la preuve à l'écran, liasse de billets…),
  et la RÉACTION visible de l'autre personnage (peur, colère, choc). L'image doit illustrer la réplique.
- Un seul lieu continu par plan, 1 à 3 lieux pour tout l'épisode. Cadrages variés (gros plan visage, plan moyen, détail sur l'objet).
- "characters" et "speaker" : EXACTEMENT les noms de la liste fournie, écrits pareil (ex. « Le Boss », pas « La Pastèque »), 1 ou 2 par plan.

FIN : le dernier plan se termine sur ce moment (sans le recopier mot pour mot) : ${ep.cliffhanger}
"logline" = l'épisode en une phrase simple. "mood" parmi : suspense, drame, emotion, action, comedie, triomphe.
Réponds UNIQUEMENT en JSON : {"title": string, "logline": string, "mood": string, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`,
    `Épisode ${ep.n}/${input.plan.episodes.length} : ${ep.title}
Ce qui se passe dans CET épisode : ${ep.summary}
Personnages disponibles :
${castText(input.cast)}`,
  );

  draft.scenes = normalizeNames(draft.scenes ?? [], input.cast);

  // Relecture par un « script doctor » : vérifie la clarté pour un spectateur qui ne sait rien et corrige.
  try {
    const fixed = await chatJSON<Script & { problems?: string[] }>(
      `Tu es script doctor pour des mini-séries TikTok de ${input.seconds} secondes. On te donne un scénario en JSON.
Relis-le comme un spectateur qui ne sait RIEN de l'histoire et qui n'entend que les répliques en voyant les images.
Vérifie et CORRIGE si besoin :
1. Comprend-on qui est le méchant, qui est la victime, et ce qui est en jeu dès le plan 1 ?
2. Chaque réplique découle-t-elle logiquement de la précédente ? Supprime tout saut, tout élément sorti de nulle part.
3. Les répliques sont-elles des phrases complètes et naturelles de 6 à 12 mots (pas de style télégraphique) ?
4. Les "action" (anglais) montrent-elles ce qui est dit et la réaction des autres personnages ?
5. Cohérence de l'univers : ${world}
6. La fin donne-t-elle envie de voir la suite ?
Garde exactement ${sceneCount} plans, les mêmes prénoms, et le même format JSON (+ un champ "problems" listant ce que tu as corrigé).
Réponds UNIQUEMENT en JSON.`,
      JSON.stringify(draft),
    );
    if (fixed?.scenes?.length === draft.scenes?.length && fixed.scenes.every((sc) => sc.lines?.length)) {
      const { problems, ...rest } = fixed;
      if (problems?.length) console.log("[script doctor]", problems);
      rest.scenes = normalizeNames(rest.scenes, input.cast);
      return rest;
    }
  } catch (e) {
    console.warn("[script doctor] relecture ignorée", e);
  }
  return draft;
}

/** Structure narrative imposée selon le nombre de plans. */
function beats(n: number): string {
  if (n <= 3)
    return `- Plan 1 : LA SITUATION. Le méchant menace/humilie la victime ; on comprend tout de suite l'injustice.
- Plan ${n === 3 ? 2 : 1} : LA RÉACTION. La victime (ou un témoin) réagit et laisse voir qu'elle a un secret ou un atout.
- Plan ${n} : LE CHOC. Le secret éclate ou va éclater ; réaction du méchant ; on coupe au moment le plus fort.`;
  if (n <= 5)
    return `- Plan 1 : la situation et l'injustice, claires.
- Plan 2 : l'injustice empire (le méchant en rajoute).
- Plan 3 : la victime révèle un indice/atout (un témoin le remarque).
- Plan 4 : le méchant ne voit rien venir, il se moque.
- Plan ${n} : le choc, coupé au moment le plus fort.`;
  return `- Plans 1-2 : la situation, les personnages, l'injustice.
- Plans 3-${Math.floor(n / 2)} : l'injustice monte, la victime encaisse ; un témoin remarque quelque chose.
- Plans ${Math.floor(n / 2) + 1}-${n - 2} : la victime prépare sa riposte, le méchant se croit intouchable.
- Plans ${n - 1}-${n} : le retournement éclate ; réaction du méchant ; on coupe au moment le plus fort.`;
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

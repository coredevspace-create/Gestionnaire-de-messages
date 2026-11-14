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
export type SeriesPlan = {
  title: string;
  episodes: EpisodePlan[];
  /** Voix de chaque personnage (description en anglais), identique pour toute la série */
  voices?: Record<string, string>;
};

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
    .map((c) => `- ${c.name} — RÔLE : ${c.role} — ${fruitLabel(c.fruit)}, ${c.look}`)
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
Réponds UNIQUEMENT en JSON : {"title": string, "voices": {"<nom exact du personnage>": "<voice description in English>"}, "episodes": [{"n": number, "title": string, "summary": string, "cliffhanger": string}]}.
"voices" : une voix TRÈS distincte pour chaque personnage (sexe, âge, timbre, grave/aigu, rythme), ex. "elderly woman, low raspy authoritative voice, slow".
FIDÉLITÉ : le pitch est la vérité. Découpe SES événements, dans SON ordre, sur les épisodes. N'invente aucune autre intrigue
(dette, chantage, vol, vidéo, licenciement…) qui n'y est pas. Les rôles et relations des personnages ne changent JAMAIS.
IL DOIT SE PASSER QUELQUE CHOSE DANS CHAQUE ÉPISODE : chaque épisode contient au moins UN événement concret et sa conséquence
(une révélation dite clairement, un exploit, une humiliation retournée, une décision). Jamais un épisode de pure mise en place.
Chaque épisode = UNE scène filmable : un lieu, les personnages concernés, ce qui s'y passe concrètement,
et le moment fort de la fin. "summary" décrit cette scène en 2 phrases concrètes (qui, où, quoi).
Chaque épisode (sauf le dernier) : un événement résolu PUIS un nouveau suspense précis à la toute fin. Le dernier épisode : la chute complète.
Les épisodes s'enchaînent : chacun reprend exactement là où le précédent s'est arrêté.`,
    `Pays : ${country.name} (${country.setting}).
Titre : ${input.title}
Pitch : ${input.pitch}
Nombre d'épisodes : ${input.episodes}
Durée de chaque épisode : ${input.seconds ?? 30} secondes. Chaque "summary" ne décrit qu'UNE situation simple qui tient dans cette durée
(en ${input.seconds ?? 30} s : 3 à ${Math.max(3, Math.round((input.seconds ?? 30) / 6))} répliques). Si l'histoire est longue, garde le reste pour les épisodes suivants.
${input.episodes === 1 ? "ÉPISODE UNIQUE : raconte l'histoire EN ENTIER, en version courte : la situation, l'injustice ou le défi, ET la chute (le secret révélé, l'exploit, la revanche). Le spectateur doit voir la fin. Pas de « à suivre »." : ""}
Personnages :
${castText(input.cast)}`,
    "writer",
  );
}

/** Débit de parole visé (mots par seconde) : sert à remplir chaque plan sans blanc. */
const WORDS_PER_SECOND = 1.8;

/** Exemple de référence (qualité attendue) montré au scénariste. */
const GOLD_EXAMPLE = `EXEMPLE DE RÉFÉRENCE (20 s, 4 plans, UNE réplique par plan) — imite ce niveau de clarté et de tension, pas son histoire :
{"title":"Le test du patron","logline":"Accusé de vol par son patron, l'employé révèle que la vraie voleuse est la femme du patron.","mood":"suspense",
"scenes":[
{"characters":["M. Mangue","Kouassi"],"setting":"small shop office, cash box open and empty","action":"M. Mangue, furious, slams the empty cash box on the desk and points at Kouassi; Kouassi stays silent, shocked","camera":"medium shot on M. Mangue",
 "lines":[{"speaker":"M. Mangue","text":"Kouassi, il manque cinq cent mille francs dans ma caisse !"}]},
{"characters":["Kouassi","M. Mangue"],"setting":"same office","action":"Kouassi raises his hands, pleading; M. Mangue listens silently, arms crossed","camera":"medium close-up on Kouassi",
 "lines":[{"speaker":"Kouassi","text":"Patron, je vous jure que je n'ai jamais touché à votre argent."}]},
{"characters":["M. Mangue","Kouassi"],"setting":"same office","action":"M. Mangue shoves the register with a signature in Kouassi's face; Kouassi stares at it silently","camera":"medium shot",
 "lines":[{"speaker":"M. Mangue","text":"Alors pourquoi ta signature est sur le registre, menteur ?"}]},
{"characters":["Kouassi","M. Mangue"],"setting":"same office","action":"Kouassi turns his phone toward M. Mangue: a camera video shows a woman taking the money; M. Mangue freezes, mouth open, silent","camera":"close-up on Kouassi holding the phone",
 "lines":[{"speaker":"Kouassi","text":"Regardez la caméra du magasin, patron. C'est votre propre femme."}]}]}`;

export async function buildScript(input: {
  plan: SeriesPlan;
  episode: number;
  countryId: string;
  styleId: string;
  cast: Character[];
  seconds: number;
  /** Pitch de la série : l'épisode doit le respecter */
  pitch?: string;
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
- UNE SEULE RÉPLIQUE PAR PLAN, dite par UN SEUL personnage (le générateur vidéo ne sait faire qu'une voix par plan).
  Les autres personnages du plan écoutent en silence (bouche fermée) et réagissent par le visage.
  Les plans alternent les personnages qui parlent, comme un champ/contrechamp : A, puis B, puis A…
- Chaque réplique fait ${wordsMin} à ${wordsMax} mots : une phrase complète, naturelle, qui se dit calmement en ~${perShot.toFixed(0)} s. Aucun plan muet.
- FIDÉLITÉ ABSOLUE À L'HISTOIRE : l'épisode montre EXACTEMENT les événements de « Ce qui doit se passer », dans cet ordre.
  N'invente AUCUNE autre intrigue (pas de dette, de chantage, de vidéo, de vol, de licenciement… s'ils ne sont pas dans l'histoire).
- RÔLES IMMUABLES : chaque personnage garde le rôle indiqué dans la liste (un ami reste un ami, un patron reste un patron).
  Le personnage qui s'oppose au héros est celui que l'histoire désigne, jamais un autre.
- Plan 1 : on comprend tout de suite la situation de CET épisode (qui, où, ce qui se passe), avec une image forte.
- Chaque réplique répond directement à la précédente ou à ce qu'on vient de voir. Aucune information qui tombe du ciel.
- ARC : la tension monte jusqu'au dernier plan, qui contient le moment fort prévu par l'histoire (exploit, révélation, retournement
  ou cliffhanger), dit ou montré clairement, avec la réaction visible des autres. Adapte l'émotion au type d'histoire :
  injustice → révolte puis satisfaction ; pouvoir caché/exploit → incrédulité puis « waouh » ; drame familial → choc ; comédie → chute drôle.
  Phrase finale COURTE et percutante (8 mots max). Rien de vague (« tu vas voir… »).
- Les répliques sont des paroles qu'un personnage dit À un autre (pas de description de la scène : jamais « le cadenas claque », « personne ne respire »).
- Le dernier plan donne la RÉPONSE, pas une promesse : on entend ce qui est révélé ou on voit ce qui arrive (« Le manoir est à Léa », pas « ce qu'elle reçoit va vous choquer »).
- Interdits : phrases télégraphiques, énumérations, informations qui tombent du ciel, « Fin », narration, didascalies dans les répliques.
- Pensée intérieure possible : speaker = "Prénom (pensée)" (au plus une par épisode).
- "characters" et "speaker" : EXACTEMENT les noms de la liste fournie.
- "setting", "action", "camera" en ANGLAIS. "action" décrit ce qu'on VOIT : le geste, l'objet clé visible, et la réaction de l'autre.
- "mood" parmi : suspense, drame, emotion, action, comedie, triomphe.
Réponds UNIQUEMENT en JSON : {"title": string, "logline": string, "mood": string, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`;

  const brief = `HISTOIRE DE LA SÉRIE (à respecter) : ${input.pitch ?? input.plan.title}
Épisode ${ep.n}/${input.plan.episodes.length} : ${ep.title}
Ce qui doit se passer : ${ep.summary}
Fin de l'épisode : ${ep.cliffhanger}
Personnages disponibles :
${castText(input.cast)}`;

  const draft = await chatJSON<Script>(
    `Tu es le meilleur scénariste de mini-séries TikTok (personnages-fruits 3D, style ${style.prompt}).
Tu écris un épisode de ${input.seconds} secondes que n'importe qui comprend du premier coup et regarde jusqu'au bout.
Méthode : 1) relis l'histoire et les rôles : tu racontes CETTE histoire, rien d'autre ; 2) écris la scène comme un vrai dialogue de film,
naturel, avec des répliques qui s'enchaînent ; 3) découpe-la en plans.
${VIRAL_FORMULA}
(Ces ressorts servent à rendre l'histoire prévue plus forte : ils ne remplacent jamais l'histoire ni les rôles.)
${rules}
${GOLD_EXAMPLE}`,
    brief,
    "writer",
  );
  draft.scenes = oneSpeakerPerShot(normalizeNames(draft.scenes ?? [], input.cast));

  // Relecture notée : si la note est faible, réécriture complète.
  try {
    const review = await chatJSON<Script & { score?: number; problems?: string[] }>(
      `Tu es script doctor exigeant. On te donne un épisode TikTok de ${input.seconds} s en JSON.
Lis-le comme un spectateur qui ne connaît RIEN de l'histoire et n'a que les images et les répliques.
HISTOIRE PRÉVUE (référence) : ${brief}
Note sur 10 (champ "score") selon : FIDÉLITÉ à l'histoire prévue et aux rôles (note max 4 si une intrigue est inventée ou un rôle
inversé — dans ce cas réécris pour coller à l'histoire), clarté de la situation dès le plan 1, émotion adaptée, logique réplique après réplique,
tension qui monte, IL SE PASSE QUELQUE CHOSE (note max 5 si l'épisode n'est qu'une mise en place sans chute ou finit sur une promesse vague), retournement net et compréhensible à la fin, dialogue naturel, absence de blancs (${wordsMin}-${wordsMax} mots par plan).
Vérifie aussi : exactement UNE réplique par plan, d'un seul personnage, les orateurs alternent. Liste les défauts dans "problems". Puis renvoie la version CORRIGÉE de l'épisode (même format, ${sceneCount} plans, mêmes noms) :
si la note est < 8, réécris franchement le dialogue pour atteindre 9/10 en gardant l'idée.
${rules}`,
      JSON.stringify(draft),
      "writer",
    );
    if (review?.scenes?.length && Math.abs(review.scenes.length - sceneCount) <= 1 && review.scenes.every((sc) => sc.lines?.length)) {
      const { problems, score, ...rest } = review;
      console.log("[script doctor]", score, problems);
      rest.scenes = oneSpeakerPerShot(normalizeNames(rest.scenes, input.cast));
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

/**
 * Le générateur vidéo ne fait qu'une voix par plan : si un plan contient des répliques de
 * plusieurs personnages, on le découpe en plusieurs plans (un orateur chacun, cadré sur lui).
 */
export function oneSpeakerPerShot(scenes: Scene[]): Scene[] {
  const out: Scene[] = [];
  for (const s of scenes) {
    const lines = s.lines ?? [];
    if (lines.length <= 1) {
      out.push(s);
      continue;
    }
    // Regroupe les répliques consécutives d'un même personnage.
    const groups: Line[][] = [];
    for (const l of lines) {
      const last = groups[groups.length - 1];
      if (last && last[0].speaker === l.speaker) last.push(l);
      else groups.push([l]);
    }
    groups.forEach((g, i) => {
      const who = g[0].speaker.replace(/\s*\(pens[ée]e\)/i, "").trim();
      out.push({
        ...s,
        camera: i === 0 ? s.camera : `medium close-up on ${who}`,
        action: i === 0 ? s.action : `${who} answers; the others listen silently. ${s.action}`,
        lines: [{ speaker: g[0].speaker, text: g.map((l) => l.text).join(" ") }],
        imagePath: undefined,
        clipPath: undefined,
        videoRequestId: undefined,
      });
    });
  }
  return out;
}

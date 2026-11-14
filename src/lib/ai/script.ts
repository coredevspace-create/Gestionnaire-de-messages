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
const VIRAL_FORMULA = `CE QUI REND LES VIDÉOS VIRALES CAPTIVANTES (analyse de vidéos à succès) — applique cette MÉCANIQUE :
1. ACCROCHE IMMÉDIATE : la toute première réplique pose l'enjeu (« Le jour de paie est arrivé ! », « Tu m'as trompé ! »).
2. IRONIE DRAMATIQUE (le plus important) : TRÈS TÔT, le spectateur apprend un secret que la victime ou le méchant ignore,
   par une confidence à un proche (« J'ai mis trop d'argent exprès pour le tester ») ou une PENSÉE intérieure (« Cet argent est pour moi »).
   Le spectateur en sait plus que les personnages : c'est ce qui le scotche.
3. DILEMME du héros, dit en pensée intérieure (« Ma mère est malade… mais ce n'est pas comme ça qu'elle m'a élevé »).
4. CHOIX MORAL du héros, puis TRAHISON ou piège d'un tiers (souvent révélé par sa pensée intérieure).
5. INJUSTICE : le héros est accusé ou humilié à tort, devant les autres. Le spectateur, qui sait la vérité, est révolté.
6. CONFRONTATION puis RÉVÉLATION / PREUVE (caméra, témoin, papier) ou cliffhanger juste au moment de la preuve.
Forme : répliques COURTES (5 à 10 mots), qui s'enchaînent vite, émotions fortes (cris, supplications, rires mauvais).
Plusieurs lieux et moments si besoin (le bureau, puis la maison le soir, puis le lendemain) : on change de décor d'un plan à l'autre.
Ton : familier, naturel, mots simples, toujours compréhensible.`;

export type EpisodePlan = { n: number; title: string; summary: string; cliffhanger: string };
export type SeriesPlan = {
  title: string;
  episodes: EpisodePlan[];
  /** Voix de chaque personnage (description en anglais), identique pour toute la série */
  voices?: Record<string, string>;
  /** Rôle réel de chaque personnage dans CETTE histoire (le rôle du casting n'est qu'un type d'allure) */
  roles?: Record<string, string>;
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

function castText(cast: Character[], roles?: Record<string, string>) {
  return cast
    .map((c) =>
      roles?.[c.name]
        ? `- ${c.name} — RÔLE DANS L'HISTOIRE : ${roles[c.name]} — ${fruitLabel(c.fruit)}, ${c.look}`
        : `- ${c.name} — casting : ${c.role} — ${fruitLabel(c.fruit)}, ${c.look}`,
    )
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
Réponds UNIQUEMENT en JSON : {"title": string, "roles": {"<nom exact du personnage>": "<son rôle dans CETTE histoire>"}, "voices": {"<nom exact du personnage>": "<voice description in English>"}, "episodes": [{"n": number, "title": string, "summary": string, "cliffhanger": string}]}.
"roles" : le « casting » de la liste n'est qu'un type d'allure (âge, sexe, look). Donne à CHAQUE personnage son rôle réel
dans le pitch (ex. "patron riche", "employé pauvre et honnête", "femme du patron"), en choisissant le personnage dont l'âge,
le sexe et l'allure collent le mieux. N'ajoute AUCUN lien de parenté absent du pitch (un patron n'est pas le « papa » de son employé).
Les personnes du pitch sans personnage disponible restent hors champ (on en parle, on ne les fait pas parler).
"voices" : une voix TRÈS distincte pour chaque personnage (sexe, âge, timbre, grave/aigu, rythme), ex. "elderly woman, low raspy authoritative voice, slow".
FIDÉLITÉ : le pitch est la vérité. Découpe SES événements, dans SON ordre, sur les épisodes. N'invente aucune autre intrigue
(dette, chantage, vol, vidéo, licenciement…) qui n'y est pas. Les rôles et relations des personnages ne changent JAMAIS.
IL DOIT SE PASSER QUELQUE CHOSE DANS CHAQUE ÉPISODE : chaque épisode contient au moins UN événement concret et sa conséquence
(une révélation dite clairement, un exploit, une humiliation retournée, une décision). Jamais un épisode de pure mise en place.
Chaque épisode = une suite d'événements filmables (1 à 4 lieux, le temps peut avancer). "summary" les décrit en 2-3 phrases
concrètes (qui, où, quoi), dans l'ordre, en indiquant le SECRET que le spectateur apprend tôt.
Chaque épisode (sauf le dernier) : un événement résolu PUIS un nouveau suspense précis à la toute fin. Le dernier épisode : la chute complète.
Les épisodes s'enchaînent : chacun reprend exactement là où le précédent s'est arrêté.`,
    `Pays : ${country.name} (${country.setting}).
Titre : ${input.title}
Pitch : ${input.pitch}
Nombre d'épisodes : ${input.episodes}
Durée de chaque épisode : ${input.seconds ?? 30} secondes. Chaque "summary" ne décrit qu'UNE situation simple qui tient dans cette durée
(en ${input.seconds ?? 30} s : environ ${Math.max(3, Math.round((input.seconds ?? 30) / config.clipSeconds))} répliques courtes). Si l'histoire est longue, garde le reste pour les épisodes suivants.
${input.episodes === 1 ? "ÉPISODE UNIQUE : raconte l'histoire EN ENTIER, en version courte : la situation, l'injustice ou le défi, ET la chute (le secret révélé, l'exploit, la revanche). Le spectateur doit voir la fin. Pas de « à suivre »." : ""}
Personnages :
${castText(input.cast)}`,
    "writer",
  );
}

/** Débit de parole visé (mots par seconde) : sert à remplir chaque plan sans blanc. */
const WORDS_PER_SECOND = 2.3;

/** Exemple de référence (qualité attendue) montré au scénariste. */
const GOLD_EXAMPLE = `EXEMPLE DE RÉFÉRENCE (~30 s, 10 plans, une réplique courte par plan) — imite cette MÉCANIQUE (accroche, secret confié au spectateur, trahison en pensée, injustice, preuve), pas cette histoire :
{"title": "Le collier du patron", "logline": "Le patron teste son chauffeur avec un collier, mais c'est son propre fils qui le vole et accuse le chauffeur.", "mood": "suspense", "scenes": [{"characters": ["Mme Mangue", "Kouassi"], "setting": "luxury car parked in front of a villa", "action": "Mme Mangue leaves a diamond necklace on the back seat and points a finger at Kouassi, the driver", "camera": "medium shot", "lines": [{"speaker": "Mme Mangue", "text": "Chauffeur, ce collier vaut dix millions, n'y touche pas."}]}, {"characters": ["M. Mangue", "Mme Mangue"], "setting": "villa living room, evening", "action": "M. Mangue whispers to his wife with a sly smile", "camera": "close-up on M. Mangue", "lines": [{"speaker": "M. Mangue", "text": "Je l'ai laissé exprès pour tester Kouassi, chérie."}]}, {"characters": ["Junior"], "setting": "villa hallway, behind a door", "action": "Junior, the son, listens behind the door, eyes narrowing greedily", "camera": "close-up on Junior", "lines": [{"speaker": "Junior (pensée)", "text": "Si le collier disparaît, c'est le chauffeur qu'on accusera."}]}, {"characters": ["Kouassi", "Junior"], "setting": "villa garage at night", "action": "Kouassi hands the shining necklace to Junior, relieved and honest", "camera": "medium shot", "lines": [{"speaker": "Kouassi", "text": "Monsieur Junior, votre mère a oublié son collier."}]}, {"characters": ["Junior", "Kouassi"], "setting": "villa garage at night", "action": "Junior snatches the necklace and pats Kouassi's shoulder with a fake smile", "camera": "medium shot", "lines": [{"speaker": "Junior", "text": "Merci Kouassi, je le lui rends tout de suite."}]}, {"characters": ["Junior"], "setting": "Junior's bedroom", "action": "Junior hides the necklace in his bag, smirking", "camera": "close-up on the bag", "lines": [{"speaker": "Junior (pensée)", "text": "Ce collier va payer toutes mes dettes."}]}, {"characters": ["M. Mangue", "Kouassi"], "setting": "villa courtyard, next morning", "action": "M. Mangue grabs Kouassi by the collar in front of the staff", "camera": "medium shot", "lines": [{"speaker": "M. Mangue", "text": "Kouassi, le collier a disparu. C'est toi le voleur ?"}]}, {"characters": ["Kouassi", "M. Mangue"], "setting": "villa courtyard", "action": "Kouassi raises his hands, desperate, tears in his eyes", "camera": "close-up on Kouassi", "lines": [{"speaker": "Kouassi", "text": "Patron, je l'ai donné à votre fils hier soir !"}]}, {"characters": ["Junior", "M. Mangue", "Kouassi"], "setting": "villa courtyard", "action": "Junior steps in, pointing at Kouassi with fake outrage", "camera": "medium shot", "lines": [{"speaker": "Junior", "text": "Il ment, papa ! Je n'ai jamais vu ce collier !"}]}, {"characters": ["Kouassi", "M. Mangue", "Junior"], "setting": "villa courtyard", "action": "Kouassi points at the small camera on the car's dashboard; Junior freezes, pale", "camera": "close-up on the dashboard camera", "lines": [{"speaker": "Kouassi", "text": "Regardez la caméra de la voiture, patron."}]}]}
Pour 20 s : garde accroche → secret → retournement en 5-7 plans. Pour 70 s : déroule toutes les étapes avec plus de rebondissements.`;

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
  const wordsMax = Math.round(perShot * WORDS_PER_SECOND * 1.35);

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
- 2 à 4 personnages, 1 à 4 lieux. Le temps peut avancer entre deux plans (on le comprend par le décor et les répliques, sans narrateur).
- UNE SEULE RÉPLIQUE PAR PLAN, dite par UN SEUL personnage (le générateur vidéo ne sait faire qu'une voix par plan).
  Les autres personnages du plan écoutent en silence (bouche fermée) et réagissent par le visage.
  Les plans alternent les personnages qui parlent, comme un champ/contrechamp : A, puis B, puis A…
- Chaque réplique fait ${wordsMin} à ${wordsMax} mots : une phrase complète, naturelle, qui se dit calmement en ~${perShot.toFixed(0)} s. Aucun plan muet.
- FIDÉLITÉ ABSOLUE À L'HISTOIRE : l'épisode montre EXACTEMENT les événements de « Ce qui doit se passer », dans cet ordre.
  N'invente AUCUNE autre intrigue (pas de dette, de chantage, de vidéo, de vol, de licenciement… s'ils ne sont pas dans l'histoire).
- RÔLES IMMUABLES : chaque personnage garde le rôle indiqué dans la liste (un ami reste un ami, un patron reste un patron).
  Aucun lien de parenté qui n'est pas dans l'histoire (un patron n'appelle pas son employé « mon fils »).
  Le personnage qui s'oppose au héros est celui que l'histoire désigne, jamais un autre.
- Plan 1 : accroche, on comprend tout de suite la situation (qui, où, ce qui se passe), avec une image forte.
- Dans le premier quart de l'épisode : le spectateur apprend le secret (ironie dramatique).
- Chaque réplique répond directement à la précédente ou à ce qu'on vient de voir. Aucune information qui tombe du ciel.
- AUCUNE RÉPÉTITION : chaque plan apporte une information, une action ou une émotion NOUVELLE (jamais 3 moqueries d'affilée qui disent la même chose).
  ${input.seconds >= 50 ? "En " + input.seconds + " s : au moins 3 rebondissements distincts (ex. secret confié, piège ou trahison, injustice publique, preuve, renversement), avec des changements de lieu ou de moment." : "Va droit au but : chaque plan fait avancer l'histoire."}
- Un personnage ne cite jamais les paroles d'un autre entre guillemets (une seule voix par plan) : il dit ce que la preuve montre (« Le directeur avoue tout sur cet audio ! »).
- ARC : la tension monte jusqu'au dernier plan, qui contient le moment fort prévu par l'histoire (exploit, révélation, retournement
  ou cliffhanger), dit ou montré clairement, avec la réaction visible des autres. Adapte l'émotion au type d'histoire :
  injustice → révolte puis satisfaction ; pouvoir caché/exploit → incrédulité puis « waouh » ; drame familial → choc ; comédie → chute drôle.
  Phrase finale COURTE et percutante (8 mots max). Rien de vague (« tu vas voir… »).
- Les répliques sont des paroles qu'un personnage dit À un autre (pas de description de la scène : jamais « le cadenas claque », « personne ne respire »).
- Le dernier plan donne la RÉPONSE, pas une promesse : on entend ce qui est révélé ou on voit ce qui arrive (« Le manoir est à Léa », pas « ce qu'elle reçoit va vous choquer »).
- Interdits : phrases télégraphiques, énumérations, informations qui tombent du ciel, « Fin », narration, didascalies dans les répliques.
- Pensées intérieures (speaker = "Prénom (pensée)") : utilise-les pour l'ironie dramatique et le dilemme (1 à 3 par épisode).
- "characters" et "speaker" : EXACTEMENT les noms de la liste fournie.
- "setting", "action", "camera" en ANGLAIS. "action" décrit ce qu'on VOIT : le geste, l'objet clé visible, et la réaction de l'autre.
- "mood" parmi : suspense, drame, emotion, action, comedie, triomphe.
Réponds UNIQUEMENT en JSON : {"title": string, "logline": string, "mood": string, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`;

  const brief = `HISTOIRE DE LA SÉRIE (à respecter) : ${input.pitch ?? input.plan.title}
Épisode ${ep.n}/${input.plan.episodes.length} : ${ep.title}
Ce qui doit se passer : ${ep.summary}
Fin de l'épisode : ${ep.cliffhanger}
Personnages disponibles :
${castText(input.cast, input.plan.roles)}`;

  const draft = await chatJSON<Script>(
    `Tu es le meilleur scénariste de mini-séries TikTok (personnages-fruits 3D, style ${style.prompt}).
Tu écris un épisode de ${input.seconds} secondes que n'importe qui comprend du premier coup et regarde jusqu'au bout.
Méthode : 1) relis l'histoire et les rôles : tu racontes CETTE histoire, rien d'autre ; 2) décide quel SECRET le spectateur apprend tôt ;
3) écris la suite d'événements comme un vrai dialogue de film, répliques courtes qui s'enchaînent ; 4) découpe en plans (une réplique par plan).
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
Note sur 10 (champ "score") selon : présence d'IRONIE DRAMATIQUE (le spectateur sait un secret tôt), FIDÉLITÉ à l'histoire prévue et aux rôles (note max 4 si une intrigue est inventée ou un rôle
inversé — dans ce cas réécris pour coller à l'histoire), clarté de la situation dès le plan 1, émotion adaptée, logique réplique après réplique,
tension qui monte, IL SE PASSE QUELQUE CHOSE (note max 5 si l'épisode n'est qu'une mise en place sans chute ou finit sur une promesse vague), retournement net et compréhensible à la fin, dialogue naturel, absence de blancs (${wordsMin}-${wordsMax} mots par plan).
Vérifie aussi : exactement UNE réplique par plan, d'un seul personnage, les orateurs alternent. Liste les défauts dans "problems". Puis renvoie la version CORRIGÉE de l'épisode (même format, ${sceneCount} plans, mêmes noms) :
si la note est < 8, réécris franchement le dialogue pour atteindre 9/10 en gardant l'idée.
${rules}
Ajoute à ce JSON les champs "score" (number, note de la version d'ORIGINE) et "problems" (string[]).`,
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

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
   par une CONFIDENCE chuchotée à un complice ou au téléphone (« J'ai mis trop d'argent exprès pour le tester »),
   ou par une ACTION visible (le méchant cache le collier dans son sac). Le spectateur en sait plus que les personnages : c'est ce qui le scotche.
3. DILEMME du héros, confié à un proche (« Ma mère est malade… mais ce n'est pas comme ça qu'elle m'a élevé »).
4. CHOIX MORAL du héros, puis TRAHISON ou piège d'un tiers (révélé par une confidence ou un geste visible).
5. INJUSTICE : le héros est accusé ou humilié à tort, devant les autres. Le spectateur, qui sait la vérité, est révolté.
6. CONFRONTATION puis RÉVÉLATION / PREUVE (caméra, témoin, papier) ou cliffhanger juste au moment de la preuve.
Forme : répliques de 7 à 11 mots, PHRASES COMPLÈTES et naturelles (sujet, verbe, articles), comme on parle vraiment
(« Vingt ans que je cuisine pour toi, et tu ramènes ça dans ma cour ? »). JAMAIS de style télégraphique (« Toi lunettes café » est interdit).
Elles s'enchaînent vite, avec des émotions fortes (cris, supplications, rires mauvais).
Plusieurs lieux et moments si besoin (le bureau, puis la maison le soir, puis le lendemain) : on change de décor d'un plan à l'autre.
Ton : familier, naturel, mots simples, toujours compréhensible.
MISE EN SCÈNE (comme une vraie série) :
- 1 ou 2 personnages par plan, JAMAIS plus : celui qui parle et celui à qui il parle. Les autres sont hors champ.
- Cadrages variés : gros plan sur le visage pour les émotions fortes, plan par-dessus l'épaule pour les face-à-face,
  plan à deux pour situer. Visages expressifs (colère, larmes, sourire en coin), yeux toujours visibles (jamais de lunettes de soleil).
- Un OBJET CLÉ bien visible (clé, enveloppe, collier, téléphone, papier) qui revient d'un plan à l'autre et porte l'intrigue.
- Les personnages se présentent par les répliques : dans les premiers plans, on s'appelle par son prénom et on dit le lien
  (« Bineta, c'est Fama, ma deuxième épouse »), pour que le spectateur sache tout de suite qui est qui.
- Petits détails du quotidien local (plat, prière, marché, monnaie) pour que ça sonne vrai.`;

export type EpisodePlan = {
  n: number;
  title: string;
  summary: string;
  cliffhanger: string;
  /** Ce que le spectateur sait et que la victime/le méchant ignore */
  secret?: string;
  /** Retournement de l'épisode (surprenant mais logique) */
  twist?: string;
  /** Séquencier : un moment par plan, écrit avant les dialogues */
  beats?: string[];
};

/**
 * Savoir-faire de scénariste (dramaturgie des mini-séries virales) : ce qui fait qu'on regarde jusqu'au bout.
 * Utilisé par le plan de la série et par le séquencier.
 */
const STORY_CRAFT = `SAVOIR-FAIRE DE SCÉNARISTE (ce qui fait qu'on regarde jusqu'au bout) :
- DÉSIR : dès les premières secondes, le spectateur VEUT quelque chose (que la vérité éclate, que le méchant paie, que le héros gagne)
  et CRAINT quelque chose. Toute l'histoire joue avec ce désir.
- IRONIE DRAMATIQUE : le spectateur apprend tôt un secret que la victime ou le méchant ignore (confidence chuchotée, appel, geste caché).
- ESCALADE : chaque moment fait monter les enjeux (argent → honneur → famille → avenir). Le méchant devient de plus en plus odieux
  et sûr de lui jusqu'à son sommet, juste avant sa chute. Jamais deux moments qui disent la même chose.
- PLANTER / PAYER : un détail concret montré tôt (un objet, une phrase, une cicatrice, une caméra, un tatouage, un reçu) devient
  la clé du retournement. Le spectateur se dit « mais oui, c'était là depuis le début ! ».
- RETOURNEMENT : surprenant ET logique, impossible à deviner depuis le titre ou les premières secondes. En 60 s et plus :
  double retournement (on croit avoir compris, puis ça va encore plus loin).
- LE HÉROS AGIT : il gagne par un choix, un piège, une preuve, un courage — jamais sauvé par hasard ou par un inconnu.
- ÉMOTION ET HUMOUR : au moins un moment touchant et une punchline drôle ou cinglante.
- SPÉCIFICITÉ : détails concrets et locaux (« 300 000 francs », « le thieb du dimanche », « la Mercedes grise », « le bus de 6 h »)
  plutôt que des généralités.
- FIN : une image et une réplique mémorables (la sentence, la gifle verbale, la vérité dite en face). Épisode non final :
  cliffhanger concret (quelqu'un entre, un objet est découvert, une phrase choc) — jamais « à suivre » ni une promesse vague.`;
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
  /** Description TikTok : teaser de l'histoire + question au spectateur */
  caption?: string;
  /** Commentaire à épingler : une question qui fait débattre */
  pinned?: string;
  /** Index du plan utilisé pour la couverture */
  cover?: number;
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
  const ask = (effort: "low" | "medium") => chatJSON<SeriesPlan>(
    `Tu es scénariste de mini-séries virales TikTok jouées par des personnages-fruits en 3D.
Public : Afrique francophone (et diaspora). Ton : drôle, dramatique, rebondissements, punchlines.
L'histoire doit être simple à suivre : un enjeu clair (argent, mariage, trahison, honte publique…), des personnages aux motivations évidentes.
${STORY_CRAFT}
Réponds UNIQUEMENT en JSON : {"title": string, "roles": {"<nom exact du personnage>": "<son rôle dans CETTE histoire>"}, "voices": {"<nom exact du personnage>": "<voice description in English>"}, "episodes": [{"n": number, "title": string, "summary": string, "secret": string, "twist": string, "cliffhanger": string}]}.
"secret" : ce que le spectateur apprend tôt et que la victime ou le méchant ignore. "twist" : le retournement de l'épisode
(surprenant et logique). Avant de répondre, imagine 3 retournements possibles et garde le plus surprenant qui reste logique et fidèle au pitch.
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
    effort,
  );
  try {
    return await ask("medium");
  } catch (e) {
    console.warn("[plan] nouvel essai en mode rapide", e);
    return ask("low");
  }
}

/**
 * Séquencier d'un épisode : exactement un moment fort par plan, écrit AVANT les dialogues.
 * C'est l'étape qui fait la qualité de l'histoire (structure, escalade, indice planté, retournement).
 */
export async function buildBeats(input: {
  plan: SeriesPlan;
  episode: number;
  countryId: string;
  cast: Character[];
  seconds: number;
  pitch: string;
}): Promise<string[]> {
  const sceneCount = Math.max(1, Math.round(input.seconds / config.clipSeconds));
  const ep = input.plan.episodes.find((e) => e.n === input.episode) ?? input.plan.episodes[0];
  if (isMock()) return Array.from({ length: sceneCount }, (_, i) => `Moment ${i + 1} : ${ep.summary}`);
  const country = getCountry(input.countryId);
  const last = ep.n >= input.plan.episodes.length;
  const prev = input.plan.episodes.filter((e) => e.n < ep.n).map((e) => `Épisode ${e.n} : ${e.summary} (fin : ${e.cliffhanger})`).join("\n");
  const ask = (effort: "low" | "medium") => chatJSON<{ twists?: string[]; plant?: string; beats?: string[] }>(
    `Tu es le showrunner d'une mini-série TikTok de personnages-fruits en 3D (épisodes très regardés, public francophone).
Tu écris le SÉQUENCIER d'un épisode de ${input.seconds} s : exactement ${sceneCount} moments, un par plan de ~${(input.seconds / sceneCount).toFixed(0)} s.
${STORY_CRAFT}
STRUCTURE DE L'ÉPISODE (${sceneCount} moments) :
- Moment 1 : ACCROCHE en plein conflit (on comprend qui, où et l'enjeu en une phrase).
- Avant le moment ${Math.max(2, Math.round(sceneCount / 4))} : le SECRET est confié au spectateur, et l'INDICE (objet, phrase, détail) est planté.
- Moments du milieu : ESCALADE avec au moins un renversement (le héros croit gagner puis perd, ou l'inverse).
- ${last ? "Avant-derniers moments : le RETOURNEMENT, qui s'appuie sur l'indice planté. Dernier moment : la CHUTE complète, le méchant puni ou la vérité dite en face, avec la réaction." : "Dernier moment : CLIFFHANGER concret qui donne envie de voir l'épisode suivant (et l'épisode a déjà résolu quelque chose avant)."}
${country.id === "monde" ? "UNIVERS MONDE : décors universels, argent en euros, prénoms courants, AUCUNE référence africaine (plats, monnaie, lieux).\n" : ""}CONTRAINTES DE TOURNAGE : chaque moment = UNE seule personne parle (1 réplique de 7 à 11 mots, phrase complète et naturelle), 1 ou 2 personnages visibles,
alterne les personnes qui parlent (jamais la même trois fois de suite), le plus souvent en face-à-face,
une action VISIBLE (geste, objet, expression). Pas de narrateur ni de pensée : un secret passe par une confidence ou un geste.
Les personnes du pitch sans personnage dans la liste restent hors champ. Rôles et relations immuables, fidélité totale au pitch.
Réponds UNIQUEMENT en JSON : {"twists": [3 idées de retournement], "plant": "l'indice planté tôt", "beats": [${sceneCount} chaînes]}.
Chaque moment : « LIEU — QUI fait QUOI (geste visible) — QUI parle : idée précise de la réplique ».`,
    `Pays : ${country.name} (${country.setting}).
HISTOIRE (pitch, à respecter) : ${input.pitch}
${prev ? `Déjà raconté :\n${prev}\n` : ""}Épisode ${ep.n}/${input.plan.episodes.length} : ${ep.title}
Ce qui doit se passer : ${ep.summary}
${ep.secret ? `Secret : ${ep.secret}\n` : ""}${ep.twist ? `Retournement prévu : ${ep.twist}\n` : ""}Fin : ${ep.cliffhanger}
Personnages :
${castText(input.cast, input.plan.roles)}`,
    "writer",
    effort,
  );
  // Réflexion poussée d'abord ; en cas de panne passagère, version rapide ; sinon on écrit sans séquencier.
  let res: { beats?: string[] } = {};
  try {
    res = await ask("medium");
  } catch (e) {
    console.warn("[séquencier] nouvel essai en mode rapide", e);
    try {
      res = await ask("low");
    } catch (e2) {
      console.warn("[séquencier] ignoré", e2);
    }
  }
  const beats = (res.beats ?? []).filter((b) => typeof b === "string" && b.trim());
  return beats.length ? beats : [];
}

/** Débit de parole visé (mots par seconde) : sert à remplir chaque plan sans blanc. */
const WORDS_PER_SECOND = 2.8;

/** Exemple de référence (qualité attendue) montré au scénariste. */
const GOLD_EXAMPLE = `EXEMPLE DE RÉFÉRENCE (~30 s, 10 plans, une réplique courte par plan, 1 ou 2 personnages par plan) — imite cette MÉCANIQUE (accroche, secret confié au spectateur par une confidence, objet clé, trahison, injustice, preuve) et cette MISE EN SCÈNE, pas cette histoire :
{"title": "Le collier du patron", "logline": "Le patron teste son chauffeur avec un collier, mais c'est son propre fils qui le vole et accuse le chauffeur.", "mood": "suspense", "scenes": [{"characters": ["Mme Mangue", "Kouassi"], "setting": "luxury car parked in front of a villa, afternoon", "action": "Mme Mangue drops a sparkling diamond necklace on the back seat and points a stern finger at Kouassi, the nervous driver", "camera": "medium two-shot of Mme Mangue and Kouassi", "lines": [{"speaker": "Mme Mangue", "text": "Kouassi, ce collier vaut dix millions, n'y touche pas."}]}, {"characters": ["M. Mangue", "Mme Mangue"], "setting": "villa living room, evening", "action": "M. Mangue leans to his wife and whispers with a sly smile, eyebrows raised", "camera": "close-up on M. Mangue", "lines": [{"speaker": "M. Mangue", "text": "Chérie, je l'ai laissé exprès pour tester notre chauffeur."}]}, {"characters": ["Junior"], "setting": "dark villa hallway, behind a half-open door", "action": "Junior, the son, presses his phone to his ear and whispers, eyes narrowing greedily", "camera": "close-up on Junior", "lines": [{"speaker": "Junior", "text": "Si le collier disparaît, c'est le chauffeur qu'on accusera."}]}, {"characters": ["Kouassi", "Junior"], "setting": "villa garage at night", "action": "Kouassi holds out the shining necklace to Junior with both hands, relieved and honest", "camera": "over-the-shoulder shot from behind Junior, facing Kouassi", "lines": [{"speaker": "Kouassi", "text": "Monsieur Junior, votre mère a oublié son collier."}]}, {"characters": ["Junior", "Kouassi"], "setting": "villa garage at night", "action": "Junior snatches the necklace with a fake warm smile while Kouassi nods respectfully", "camera": "over-the-shoulder shot from behind Kouassi, facing Junior", "lines": [{"speaker": "Junior", "text": "Merci Kouassi, je le lui rends tout de suite."}]}, {"characters": ["Junior"], "setting": "Junior's bedroom at night", "action": "Junior stuffs the necklace deep into his bag and laughs quietly into his phone", "camera": "close-up on Junior", "lines": [{"speaker": "Junior", "text": "Le collier est dans mon sac, mes dettes sont payées."}]}, {"characters": ["M. Mangue", "Kouassi"], "setting": "villa courtyard, next morning", "action": "M. Mangue, furious, grabs Kouassi by the collar; Kouassi's eyes widen in shock", "camera": "medium two-shot of M. Mangue and Kouassi", "lines": [{"speaker": "M. Mangue", "text": "Kouassi, le collier a disparu. C'est toi le voleur ?"}]}, {"characters": ["Kouassi", "M. Mangue"], "setting": "villa courtyard", "action": "Kouassi raises his trembling hands, tears in his eyes", "camera": "close-up on Kouassi", "lines": [{"speaker": "Kouassi", "text": "Patron, je l'ai donné à votre fils hier soir !"}]}, {"characters": ["Junior", "M. Mangue"], "setting": "villa courtyard", "action": "Junior points at Kouassi with fake outrage, chin up, avoiding his father's eyes", "camera": "over-the-shoulder shot from behind M. Mangue, facing Junior", "lines": [{"speaker": "Junior", "text": "Il ment, papa ! Je n'ai jamais vu ce collier !"}]}, {"characters": ["Kouassi", "M. Mangue"], "setting": "villa courtyard", "action": "Kouassi points at the small camera on the car's dashboard; M. Mangue slowly turns, stunned", "camera": "close-up on Kouassi", "lines": [{"speaker": "Kouassi", "text": "Regardez la caméra de la voiture, patron."}]}]}
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
  const found = input.plan.episodes.find((e) => e.n === input.episode) ?? input.plan.episodes[0];
  const ep = { ...found, beats: (found.beats ?? []).filter((b) => b !== "(libre)") };
  const perShot = input.seconds / sceneCount;
  const wordsMin = Math.round(perShot * WORDS_PER_SECOND * 0.8);
  const wordsMax = Math.round(perShot * WORDS_PER_SECOND * 1.3);

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
- 2 à 4 personnages dans l'épisode, mais 1 ou 2 par plan ("characters" contient au plus 2 noms). 1 à 4 lieux. Le temps peut avancer entre deux plans (on le comprend par le décor et les répliques, sans narrateur).
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
  Phrase finale percutante et mémorable, mais toujours une phrase complète et naturelle. Rien de vague (« tu vas voir… »).
- Les répliques sont des paroles qu'un personnage dit À un autre (pas de description de la scène : jamais « le cadenas claque », « personne ne respire »).
- Si l'histoire promet une ACTION (bagarre, K.O., gifle, fuite, objet trouvé), un plan la MONTRE dans son "action" avant la réplique
  finale : on ne saute jamais le moment que le spectateur attend.
- Le dernier plan donne la RÉPONSE, pas une promesse : on entend ce qui est révélé ou on voit ce qui arrive (« Le manoir est à Léa », pas « ce qu'elle reçoit va vous choquer »).
- Interdits : phrases télégraphiques, énumérations, informations qui tombent du ciel, « Fin », narration, didascalies dans les répliques.
- AUCUNE pensée intérieure ni voix off (le générateur vidéo fait toujours bouger les lèvres) : le secret passe par une confidence
  chuchotée à un complice, un appel téléphonique ou une action visible.
- "characters" et "speaker" : EXACTEMENT les noms de la liste fournie.
- "setting", "action", "camera" en ANGLAIS. "action" décrit ce qu'on VOIT : le geste, l'objet clé visible, l'expression du visage, et la réaction de l'autre.
  "camera" parmi : "close-up on <Nom>", "over-the-shoulder shot from behind <Nom>, facing <Nom>", "medium two-shot of <Nom> and <Nom>".
- "mood" parmi : suspense, drame, emotion, action, comedie, triomphe.
- "caption" : description TikTok de 2 phrases qui donne envie sans tout dévoiler, puis une question directe au spectateur
  (« Toi, tu pardonnes ou tu pars ? »), avec 1 emoji maximum. "pinned" : un commentaire à épingler qui fait débattre
  (« Vous êtes team Bineta, ou vous pensez que Moussa cache pire ? »). "cover" : numéro (à partir de 0) du plan le plus fort
  visuellement pour la couverture (gros plan expressif, idéalement avec l'objet clé).
Réponds UNIQUEMENT en JSON : {"title": string, "logline": string, "mood": string, "caption": string, "pinned": string, "cover": number, "scenes": [{"characters": string[], "setting": string, "action": string, "camera": string, "lines": [{"speaker": string, "text": string}]}]}`;

  const brief = `HISTOIRE DE LA SÉRIE (à respecter) : ${input.pitch ?? input.plan.title}
Épisode ${ep.n}/${input.plan.episodes.length} : ${ep.title}
Ce qui doit se passer : ${ep.summary}
Fin de l'épisode : ${ep.cliffhanger}
${ep.beats?.length ? `SÉQUENCIER (plan par plan — le plan N raconte le moment N, dans cet ordre ; écris la réplique et la mise en scène de chaque moment) :\n${ep.beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n` : ""}Personnages disponibles :
${castText(input.cast, input.plan.roles)}`;

  const draft = await chatJSON<Script>(
    `Tu es le meilleur scénariste de mini-séries TikTok (personnages-fruits 3D, style ${style.prompt}).
Tu écris un épisode de ${input.seconds} secondes que n'importe qui comprend du premier coup et regarde jusqu'au bout.
${ep.beats?.length
  ? "Méthode : le SÉQUENCIER fourni est la structure validée par le showrunner. Plan N = moment N. Ton travail : des répliques vivantes, naturelles et percutantes (vraies paroles de gens qui se disputent, avec du caractère), et une mise en scène visuelle forte. Ne change ni l'ordre ni le contenu des moments."
  : "Méthode : 1) relis l'histoire et les rôles : tu racontes CETTE histoire, rien d'autre ; 2) décide quel SECRET le spectateur apprend tôt ;\n3) écris la suite d'événements comme un vrai dialogue de film, répliques courtes qui s'enchaînent ; 4) découpe en plans (une réplique par plan)."}
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
      rest.caption ||= draft.caption;
      rest.pinned ||= draft.pinned;
      rest.cover ??= draft.cover;
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
/** Au plus 2 personnages par plan : celui qui parle et son interlocuteur (lisibilité, images plus nettes). */
function twoPerShot(scenes: Scene[]): Scene[] {
  return scenes.map((s) => {
    if ((s.characters?.length ?? 0) <= 2) return s;
    const who = s.lines?.[0]?.speaker.replace(/\s*\(pens[ée]e\)/i, "").trim();
    const keep = who && s.characters.includes(who) ? [who, ...s.characters.filter((c) => c !== who)] : s.characters;
    return { ...s, characters: keep.slice(0, 2) };
  });
}

export function oneSpeakerPerShot(scenes: Scene[]): Scene[] {
  return twoPerShot(splitSpeakers(scenes));
}

function splitSpeakers(scenes: Scene[]): Scene[] {
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

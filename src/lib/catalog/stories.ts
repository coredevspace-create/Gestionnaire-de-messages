import type { CharSpec, RoleId } from "./characters";

export type Story = {
  id: string;
  title: string;
  hook: string;
  theme: string;
  pitch: string;
  cast: RoleId[];
  /** Personnages sur mesure (univers Monde) — remplace `cast` si présent */
  castSpec?: CharSpec[];
  /** Univers imposé (ex. "monde") — sinon le pays de l'utilisateur */
  world?: string;
  /** Pays où l'histoire marche le mieux ; vide = tous */
  countries: string[];
  tags: ("viral" | "top" | "nouveau")[];
};

export const THEMES = [
  "Monde : pouvoir caché",
  "Monde : injustice et karma",
  "Héros sous-estimé",
  "Test et karma",
  "Polygamie et co-épouses",
  "Belle-mère et belle-famille",
  "Argent et diaspora",
  "Mariage et dot",
  "Funérailles et héritage",
  "Village contre ville",
  "Trahison et jalousie",
] as const;

export const STORIES: Story[] = [
  // ---- Formule virale : test moral, héros sous-estimé, secret, karma ----
  {
    id: "test-du-patron",
    title: "Le test du patron",
    hook: "« Il y a trop d'argent dans ma paie… Je le rends ou je nourris ma famille ? »",
    theme: "Test et karma",
    pitch:
      "Le riche patron glisse exprès trop d'argent dans la paie de son employé le plus pauvre pour tester son honnêteté. L'employé vient le rendre… mais c'est la femme du patron qui ouvre la porte et garde l'argent pour elle. Le patron accuse l'employé de vol. L'employé sort son téléphone : il a tout filmé.",
    cast: ["fils", "papa", "coepouse"],
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "gardien-milliardaire",
    title: "Le gardien était le propriétaire",
    hook: "« Toi le gardien, va me garer ma voiture ! » — Il ne sait pas à qui il parle.",
    theme: "Héros sous-estimé",
    pitch:
      "Un jeune cadre arrogant humilie le vieux gardien de l'immeuble devant tout le monde. Il ignore que ce gardien est le milliardaire propriétaire de l'entreprise, qui s'est déguisé pour voir comment ses employés traitent les petits.",
    cast: ["papa", "fils", "fille"],
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "fiance-pauvre",
    title: "Le fiancé « pauvre »",
    hook: "« Ma fille ne va pas épouser un vendeur de beignets ! »",
    theme: "Mariage et dot",
    pitch:
      "Pour tester sa future belle-famille, un fiancé très riche se fait passer pour un pauvre vendeur de beignets. La belle-mère le méprise et lui présente un « vrai » prétendant riche… qui travaille en réalité pour le fiancé.",
    cast: ["fils", "bellemere", "fille", "oncle"],
    countries: [],
    tags: ["viral", "top"],
  },
  {
    id: "zemidjan-force",
    title: "Le moto-taxi qui soulève un camion",
    hook: "« Frère… tu viens de soulever un camion avec une main ?! »",
    theme: "Héros sous-estimé",
    pitch:
      "Un moto-taxi discret soulève un camion d'une main pour sauver un enfant. Son ami le pousse à s'inscrire au grand concours de force de la ville, 50 millions à gagner. Le champion en titre se moque de lui… jusqu'à la première épreuve.",
    cast: ["fils", "voisin", "oncle"],
    countries: ["bj", "tg", "cm"],
    tags: ["viral", "nouveau"],
  },
  {
    id: "nouveau-du-quartier",
    title: "Le nouveau du quartier",
    hook: "« Ici c'est mon quartier. Le nouveau, tu baisses les yeux. »",
    theme: "Héros sous-estimé",
    pitch:
      "Le caïd du quartier rackette tout le monde et s'en prend au nouveau, un garçon calme à lunettes. Les vendeuses du marché chuchotent : « S'il enlève ses lunettes, c'est fini pour lui… »",
    cast: ["voisin", "fils", "maman", "coepouse"],
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "mendiante-heritage",
    title: "La mendiante du mariage",
    hook: "« Chassez cette mendiante de mon mariage ! »",
    theme: "Test et karma",
    pitch:
      "Pendant un mariage luxueux, la mariée fait chasser une vieille femme mal habillée. Au moment du discours, on découvre que c'est la grand-mère du marié, qui finance tout le mariage… et qui voulait voir le vrai visage de la mariée.",
    cast: ["bellemere", "coepouse", "fils"],
    countries: [],
    tags: ["viral", "top"],
  },
  {
    id: "bourse-volee",
    title: "La bourse volée",
    hook: "« C'est moi qui ai eu 19 au bac, pas elle ! »",
    theme: "Trahison et jalousie",
    pitch:
      "La meilleure élève du pays apprend que sa bourse pour l'étranger a été donnée à la fille du directeur. Elle n'a qu'une preuve : un enregistrement… et le directeur vient de le découvrir.",
    cast: ["fille", "papa", "coepouse"],
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "heritier-cache",
    title: "Le cousin du village",
    hook: "« Il arrive du village avec un sac en plastique et il veut parler au PDG ? »",
    theme: "Village contre ville",
    pitch:
      "Un cousin du village débarque dans la tour d'une grande entreprise de la capitale. Tout le monde se moque de lui à l'accueil. Il est l'unique héritier du fondateur, mort la semaine dernière.",
    cast: ["voisin", "fille", "oncle"],
    countries: [],
    tags: ["viral", "nouveau"],
  },

  // ---- Drames familiaux ----
  {
    id: "funerailles-ruineuses",
    title: "Des funérailles qui ruinent",
    hook: "« Il m'a jamais payé l'école. Maintenant je dois lui payer un orchestre. »",
    theme: "Funérailles et héritage",
    pitch:
      "Le fils doit financer les funérailles grandioses d'un oncle qui ne l'a jamais aidé, pendant que toute la famille réclame toujours plus.",
    cast: ["fils", "maman", "oncle", "bellemere"],
    countries: ["ci", "cm"],
    tags: ["viral"],
  },
  {
    id: "deuxieme-epouse",
    title: "La deuxième épouse arrive",
    hook: "« Tu as dit que tu allais au marché. Tu es revenu avec une femme ! »",
    theme: "Polygamie et co-épouses",
    pitch:
      "Le papa rentre à la maison avec une jeune deuxième épouse sans prévenir. La première épouse prépare sa riposte.",
    cast: ["papa", "maman", "coepouse"],
    countries: [],
    tags: ["viral", "top"],
  },
  {
    id: "cuisine-coepouses",
    title: "Guerre dans la cuisine",
    hook: "« Ce soir, c'est MA sauce qu'il va manger. »",
    theme: "Polygamie et co-épouses",
    pitch: "Les deux co-épouses s'affrontent pour savoir qui cuisinera le repas du mari ce soir.",
    cast: ["maman", "coepouse", "papa"],
    countries: ["sn", "ml", "gn"],
    tags: ["top"],
  },
  {
    id: "bellemere-inspection",
    title: "L'inspection de la belle-mère",
    hook: "« Ma belle-fille ne sait même pas piler le foutou. »",
    theme: "Belle-mère et belle-famille",
    pitch:
      "La belle-mère débarque à l'improviste pour inspecter la maison de sa belle-fille et trouve tout à redire.",
    cast: ["bellemere", "fille", "fils"],
    countries: [],
    tags: ["viral"],
  },
  {
    id: "bellemere-installe",
    title: "Elle est venue pour une semaine",
    hook: "« Une semaine… ça fait trois mois. »",
    theme: "Belle-mère et belle-famille",
    pitch: "La belle-mère devait rester une semaine. Trois mois plus tard, elle a pris la chambre du couple.",
    cast: ["bellemere", "fils", "fille"],
    countries: [],
    tags: ["top"],
  },
  {
    id: "oncle-paris",
    title: "L'oncle de Paris",
    hook: "« En France je suis directeur. » — Il est agent de sécurité.",
    theme: "Argent et diaspora",
    pitch:
      "L'oncle rentre de France en faisant croire qu'il est riche. La famille fait la queue pour demander de l'argent… jusqu'à ce que la vérité éclate.",
    cast: ["oncle", "maman", "fils", "voisin"],
    countries: [],
    tags: ["viral", "top"],
  },
  {
    id: "transfert-argent",
    title: "Le transfert qui n'arrive jamais",
    hook: "« Je t'ai envoyé l'argent pour la maison. Montre-moi la maison. »",
    theme: "Argent et diaspora",
    pitch:
      "Depuis l'étranger, la fille envoie de l'argent pour construire une maison. Elle rentre au pays et découvre un terrain vide.",
    cast: ["fille", "oncle", "maman"],
    countries: ["cm", "cd", "sn"],
    tags: ["viral"],
  },
  {
    id: "dot-impossible",
    title: "La dot impossible",
    hook: "« 20 chèvres, une moto et un iPhone 17. »",
    theme: "Mariage et dot",
    pitch: "Le fils veut épouser la femme qu'il aime, mais la famille de la mariée exige une dot délirante.",
    cast: ["fils", "fille", "papa", "bellemere"],
    countries: [],
    tags: ["top"],
  },
  {
    id: "mariage-fete",
    title: "Le mariage qui tourne mal",
    hook: "« Qui a invité l'ex ?! »",
    theme: "Mariage et dot",
    pitch: "En plein mariage, l'ex du marié débarque et prend le micro.",
    cast: ["fils", "fille", "coepouse", "maman"],
    countries: [],
    tags: ["nouveau"],
  },
  {
    id: "village-ville",
    title: "Le cousin du village",
    hook: "« C'est quoi l'ascenseur ? Ça mange quoi ? »",
    theme: "Village contre ville",
    pitch: "Un cousin du village vient vivre chez la famille en ville et découvre la vie moderne.",
    cast: ["voisin", "fils", "maman"],
    countries: [],
    tags: ["nouveau"],
  },
  {
    id: "voisin-commere",
    title: "Le voisin sait tout",
    hook: "« Avant même que tu rentres, le quartier était au courant. »",
    theme: "Trahison et jalousie",
    pitch: "Le voisin commère répand une rumeur sur le couple et tout le quartier s'en mêle.",
    cast: ["voisin", "papa", "maman"],
    countries: [],
    tags: [],
  },
  {
    id: "sape-dette",
    title: "Sapé comme jamais, fauché comme toujours",
    hook: "« Le costume coûte 3 mois de loyer. Mais regarde comme je brille. »",
    theme: "Argent et diaspora",
    pitch: "Le fils dépense tout son argent en vêtements de marque pour impressionner, pendant que le propriétaire réclame le loyer.",
    cast: ["fils", "papa", "voisin"],
    countries: ["cd"],
    tags: ["viral"],
  },
  {
    id: "heritage-papa",
    title: "Le testament de papa",
    hook: "« Papa a laissé la maison… à son autre famille. »",
    theme: "Funérailles et héritage",
    pitch: "À la lecture du testament, la famille découvre que le papa avait une deuxième famille cachée.",
    cast: ["maman", "fils", "fille", "coepouse"],
    countries: [],
    tags: ["top"],
  },
];


/**
 * Univers « Monde » : décors de cinéma variés, personnages-fruits archétypaux,
 * français familier. Mêmes ressorts que les vidéos fruits IA virales.
 */
const M = "monde";
export const WORLD_STORIES: Story[] = [
  {
    id: "m-stagiaire-lunettes",
    title: "Le stagiaire à lunettes",
    hook: "« Le stagiaire, va me chercher un café. Et plus vite que ça ! »",
    theme: "Monde : pouvoir caché",
    pitch:
      "Dans une tour de bureaux, le chef d'équipe humilie chaque jour le stagiaire timide à lunettes. Les collègues chuchotent : personne ne sait que le stagiaire est le fils du PDG, envoyé en secret pour juger les managers. Aujourd'hui, c'est le jour de l'évaluation.",
    cast: [],
    castSpec: [
      { id: "stagiaire", name: "Théo", fruit: "banana", role: "stagiaire timide", look: "young shy intern, round glasses, oversized shirt and tie, badge" },
      { id: "chef", name: "Bruno", fruit: "pomegranate", role: "chef d'équipe arrogant", look: "arrogant middle manager, slick suit, gold watch, smug face" },
      { id: "collegue", name: "Inès", fruit: "kiwi", role: "collègue commère", look: "gossiping office colleague, trendy blazer, coffee cup" },
      { id: "pdg", name: "Monsieur Grand", fruit: "melon", role: "PDG milliardaire", look: "powerful elderly CEO, grey beard, expensive navy suit" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "m-cantine-prison",
    title: "La loi de la cantine",
    hook: "« Ici, c'est moi qui mange en premier. Toi, tu baisses les yeux. »",
    theme: "Monde : pouvoir caché",
    pitch:
      "Dans la cantine d'une prison, un caïd énorme terrorise les cuisiniers et vole les plateaux. Il s'en prend à un nouveau détenu silencieux. Les cuisiniers savent quelque chose sur ce nouveau… et prient pour que le caïd ne le pousse pas à bout.",
    cast: [],
    castSpec: [
      { id: "caid", name: "Le Boss", fruit: "watermelon", role: "caïd de la prison", look: "huge muscular inmate, white prison uniform, tattoos, menacing stare" },
      { id: "nouveau", name: "Le Nouveau", fruit: "lemon", role: "nouveau détenu silencieux", look: "calm quiet inmate, white prison uniform, scar, very composed" },
      { id: "cuisinier", name: "Momo", fruit: "orange", role: "cuisinier de la prison", look: "nervous prison cook, white chef hat and apron, ladle in hand" },
      { id: "cuisiniere", name: "Fraisette", fruit: "strawberry", role: "cuisinière", look: "prison cook, hairnet, white apron, worried face" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "top"],
  },
  {
    id: "m-tournoi-milliard",
    title: "Le tournoi du milliard",
    hook: "« Frère… tu viens de rattraper une voiture d'une seule main ?! »",
    theme: "Monde : pouvoir caché",
    pitch:
      "Un livreur discret rattrape une voiture qui tombait d'un pont, d'une seule main. Son pote le filme et l'inscrit au Tournoi des Titans : 1 milliard d'euros pour le plus fort du monde. Le champion, une montagne de muscles, se moque de lui devant tout le stade.",
    cast: [],
    castSpec: [
      { id: "livreur", name: "Nono", fruit: "apple", role: "livreur surpuissant en secret", look: "humble delivery guy, cap, delivery jacket, calm smile" },
      { id: "pote", name: "Kévin", fruit: "melon", role: "meilleur pote bavard", look: "talkative best friend, hoodie, phone always filming" },
      { id: "champion", name: "Titan", fruit: "potato", role: "champion arrogant", look: "gigantic bodybuilder champion, championship belt, tank top" },
      { id: "presentateur", name: "Jean-Mi", fruit: "carrot", role: "présentateur survolté", look: "flashy arena host, sparkly suit, microphone" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "m-livreur-patron",
    title: "Le livreur humilié",
    hook: "« Tu es en retard de deux minutes. Pas de pourboire, et je te fais virer. »",
    theme: "Monde : injustice et karma",
    pitch:
      "Une cliente riche humilie un livreur sous la pluie et le fait renvoyer. Le lendemain, elle passe l'entretien d'embauche de sa vie dans une grande entreprise… et découvre qui est assis en face d'elle : le livreur, qui en est le propriétaire.",
    cast: [],
    castSpec: [
      { id: "livreur", name: "Sami", fruit: "avocado", role: "livreur (propriétaire en secret)", look: "delivery rider in rain jacket, helmet, kind eyes; later in elegant suit" },
      { id: "cliente", name: "Jessica", fruit: "cherry", role: "cliente riche et méprisante", look: "rich arrogant woman, designer dress, sunglasses pushed up on her head, luxury handbag" },
      { id: "rh", name: "Madame Poire", fruit: "pear", role: "recruteuse", look: "professional HR manager, glasses, tablet" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "m-heritage-freres",
    title: "Le testament du grand-père",
    hook: "« Le vieux est mort ? Parfait. Maintenant, on partage le manoir. »",
    theme: "Monde : injustice et karma",
    pitch:
      "Trois frères et sœurs n'ont jamais rendu visite à leur grand-père milliardaire. Seule la petite-fille pauvre s'occupait de lui. À la lecture du testament, ils se moquent d'elle… mais le notaire n'a pas fini de lire.",
    cast: [],
    castSpec: [
      { id: "petitefille", name: "Léa", fruit: "peach", role: "petite-fille pauvre et dévouée", look: "kind young woman, simple worn clothes, teary eyes" },
      { id: "frere", name: "Maxime", fruit: "grape", role: "frère cupide", look: "greedy rich heir, flashy suit, sunglasses pushed up on his head" },
      { id: "soeur", name: "Victoria", fruit: "blueberry", role: "sœur hautaine", look: "snobby heiress, fur coat, pearls" },
      { id: "notaire", name: "Maître Citron", fruit: "lemon", role: "notaire", look: "serious old notary, round glasses, documents" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "top"],
  },
  {
    id: "m-concours-cuisine",
    title: "Le concours truqué",
    hook: "« Le jury est payé. Elle peut cuisiner ce qu'elle veut, elle perdra. »",
    theme: "Monde : injustice et karma",
    pitch:
      "Lors d'un grand concours de cuisine télévisé, une candidate riche a acheté le jury. La candidate modeste, plongeuse dans un fast-food, sert un plat qui fait pleurer le chef le plus redouté du pays… qui n'était pas dans le plan.",
    cast: [],
    castSpec: [
      { id: "plongeuse", name: "Sarah", fruit: "tomato", role: "candidate modeste", look: "humble young cook, fast-food uniform under apron, determined" },
      { id: "riche", name: "Clarisse", fruit: "pomegranate", role: "candidate riche tricheuse", look: "spoiled rich contestant, designer chef jacket, smirk" },
      { id: "chef", name: "Chef Aubergine", fruit: "eggplant", role: "grand chef redouté", look: "legendary stern chef, black chef jacket, crossed arms" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "m-lycee-bourse",
    title: "La boursière du lycée privé",
    hook: "« Ici c'est un lycée pour les riches. Toi, t'es la fille de la femme de ménage. »",
    theme: "Monde : injustice et karma",
    pitch:
      "Dans un lycée privé de luxe, une élève boursière est harcelée par la reine du lycée. Le jour du gala, la reine l'humilie devant tout le monde. Mais la directrice monte sur scène avec une annonce qui change tout.",
    cast: [],
    castSpec: [
      { id: "boursiere", name: "Nina", fruit: "kiwi", role: "élève boursière", look: "modest scholarship student, school uniform slightly worn, backpack" },
      { id: "reine", name: "Chloé", fruit: "cherry", role: "reine du lycée", look: "rich popular girl, perfect uniform, phone, mean smile" },
      { id: "directrice", name: "Madame Prune", fruit: "blueberry", role: "directrice", look: "elegant strict principal, grey bun, pearl necklace" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "nouveau"],
  },
  {
    id: "m-vigile-champion",
    title: "Le vigile du centre commercial",
    hook: "« Tu sers à rien, le vigile. Regarde, je vole devant toi. »",
    theme: "Monde : pouvoir caché",
    pitch:
      "Une bande de voyous provoque le vieux vigile d'un centre commercial et vole une boutique sous ses yeux. Ils ne savent pas que ce vigile est un ancien champion du monde de boxe, qui a juré de ne plus jamais se battre… sauf si on touche à un enfant.",
    cast: [],
    castSpec: [
      { id: "vigile", name: "Papi Joe", fruit: "coconut", role: "vieux vigile ancien champion", look: "old calm security guard, uniform, cap, big strong bare hands of a former boxer (no gloves)" },
      { id: "voyou", name: "Dylan", fruit: "grape", role: "chef des voyous", look: "cocky young thug whose head is ONE big round purple grape, purple tracksuit, gold chain" },
      { id: "enfant", name: "Petit Kiwi", fruit: "kiwi", role: "enfant", look: "small child, backpack, big eyes" },
    ],
    world: M,
    countries: [],
    tags: ["viral", "top"],
  },
];

export function storiesFor(countryId: string): Story[] {
  if (countryId === "monde") return [...WORLD_STORIES, ...STORIES.filter((s) => s.countries.length === 0)];
  // Les histoires du pays d'abord, puis les histoires universelles.
  const local = STORIES.filter((s) => s.countries.includes(countryId));
  const universal = STORIES.filter((s) => s.countries.length === 0);
  const others = STORIES.filter((s) => s.countries.length > 0 && !s.countries.includes(countryId));
  return [...local, ...universal, ...others];
}

export function getStory(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id) ?? WORLD_STORIES.find((s) => s.id === id);
}

/** Série du jour : rotation déterministe par date. */
export function storyOfTheDay(countryId: string): Story {
  const list = [...storiesFor(countryId), ...(countryId === "monde" ? [] : WORLD_STORIES)].filter((s) =>
    s.tags.includes("viral"),
  );
  const day = Math.floor(Date.now() / 86400_000);
  return list[day % list.length] ?? STORIES[0];
}

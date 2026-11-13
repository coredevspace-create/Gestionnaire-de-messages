export type Country = {
  id: string;
  name: string;
  flag: string;
  /** Décor utilisé dans les prompts image / vidéo */
  setting: string;
  /** Façon de parler pour les dialogues et la voix */
  accent: string;
  /** Tenues typiques */
  outfits: string;
  names: { male: string[]; female: string[] };
};

export const COUNTRIES: Country[] = [
  {
    id: "monde",
    name: "Monde",
    flag: "🌍",
    setting:
      "spectacular cinematic locations chosen by the story (modern city, luxury mansion, high-security prison, office tower, stadium arena, airport, high school, restaurant kitchen…)",
    accent: "français familier et moderne de France, comme des jeunes (« frère », « gros », « wesh », « mec », « j'avoue »)",
    outfits: "modern clothes that fit the character's job and social status",
    names: { male: ["Kévin", "Lucas", "Bryan", "Marco"], female: ["Sarah", "Inès", "Jessica", "Léa"] },
  },
  {
    id: "sn",
    name: "Sénégal",
    flag: "🇸🇳",
    setting: "Dakar, colorful cars rapides buses, sandy streets, Atlantic coast, Médina neighborhood",
    accent: "French with a Senegalese Wolof accent, mixing Wolof words like 'waaw', 'dafa', 'yow'",
    outfits: "grand boubou, colorful wax fabrics, embroidered kaftans",
    names: { male: ["Moussa", "Abdou", "Cheikh", "Modou"], female: ["Fatou", "Aminata", "Awa", "Khady"] },
  },
  {
    id: "ci",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    setting: "Abidjan, Plateau skyline, maquis restaurants, busy Yopougon streets, woro-woro taxis",
    accent: "Ivorian French with Nouchi slang like 'on dit quoi', 'c'est comment', 'gbê'",
    outfits: "bright wax print shirts and dresses, pagne, sneakers and gold chains",
    names: { male: ["Konan", "Yao", "Koffi", "Didier"], female: ["Adjoua", "Aya", "Affoué", "Mariam"] },
  },
  {
    id: "cm",
    name: "Cameroun",
    flag: "🇨🇲",
    setting: "Douala and Yaoundé, motorbike taxis, market stalls, green hills",
    accent: "Cameroonian French with camfranglais like 'on va faire comment', 'mola', 'je wanda'",
    outfits: "kabba dresses, toghu embroidered tops, wax prints",
    names: { male: ["Ngono", "Paul", "Samuel", "Junior"], female: ["Clarisse", "Brenda", "Nadège", "Carine"] },
  },
  {
    id: "cd",
    name: "Congo (RDC)",
    flag: "🇨🇩",
    setting: "Kinshasa, Congo river, crowded boulevards, sape culture, rumba bars",
    accent: "Congolese French with Lingala words like 'mbote', 'boni', 'yaka'",
    outfits: "flamboyant designer suits (la sape), liputa wax dresses",
    names: { male: ["Papy", "Fiston", "Christian", "Patrick"], female: ["Mamie", "Grâce", "Bijou", "Ornella"] },
  },
  {
    id: "ml",
    name: "Mali",
    flag: "🇲🇱",
    setting: "Bamako, Niger river, red earth streets, adobe architecture",
    accent: "Malian French with Bambara words like 'i ni ce', 'awó', 'tubabu'",
    outfits: "bazin riche boubous in bright colors, bogolan fabrics",
    names: { male: ["Oumar", "Seydou", "Bakary", "Mamadou"], female: ["Mariam", "Kadiatou", "Oumou", "Djeneba"] },
  },
  {
    id: "gn",
    name: "Guinée",
    flag: "🇬🇳",
    setting: "Conakry, coastal peninsula, busy markets, Fouta Djallon hills",
    accent: "Guinean French with Pular and Soussou expressions",
    outfits: "boubous, wax prints, headwraps",
    names: { male: ["Alpha", "Mamadou", "Sékou", "Ibrahima"], female: ["Hadja", "Mariama", "Fanta", "Kadiatou"] },
  },
  {
    id: "bf",
    name: "Burkina Faso",
    flag: "🇧🇫",
    setting: "Ouagadougou, mopeds everywhere, red dust roads, maquis at night",
    accent: "Burkinabè French with Mooré words",
    outfits: "Faso Dan Fani woven fabrics, boubous",
    names: { male: ["Salif", "Issouf", "Boukary", "Rasmané"], female: ["Awa", "Salimata", "Rasmata", "Assita"] },
  },
  {
    id: "bj",
    name: "Bénin",
    flag: "🇧🇯",
    setting: "Cotonou, zemidjan motorbike taxis, Dantokpa market, lagoon",
    accent: "Beninese French with Fon expressions",
    outfits: "wax prints, embroidered agbada",
    names: { male: ["Sèna", "Codjo", "Romuald", "Gildas"], female: ["Afiavi", "Nadège", "Sènami", "Ablawa"] },
  },
  {
    id: "tg",
    name: "Togo",
    flag: "🇹🇬",
    setting: "Lomé, Grand Marché, beach road, motorbike taxis",
    accent: "Togolese French with Ewe expressions",
    outfits: "wax prints, kente-inspired fabrics",
    names: { male: ["Kossi", "Komlan", "Edem", "Yao"], female: ["Akossiwa", "Ama", "Enyonam", "Afi"] },
  },
  {
    id: "ga",
    name: "Gabon",
    flag: "🇬🇦",
    setting: "Libreville, seaside boulevard, tropical forest edges",
    accent: "Gabonese French, relaxed and expressive",
    outfits: "wax prints, elegant suits",
    names: { male: ["Brice", "Landry", "Ghislain", "Rodrigue"], female: ["Laetitia", "Prisca", "Murielle", "Sandrine"] },
  },
];

export function getCountry(id: string): Country {
  return COUNTRIES.find((c) => c.id === id) ?? COUNTRIES[1];
}

export const STYLES = {
  fruits3d: {
    label: "Fruits 3D",
    prompt:
      "cinematic 3D animation, Pixar-like quality, anthropomorphic characters with a realistic fruit as the head and human body wearing clothes, expressive faces, warm cinematic lighting, vertical 9:16 framing",
  },
} as const;

export type StyleId = keyof typeof STYLES;

export function getStyle(id: string) {
  return STYLES[(id as StyleId) in STYLES ? (id as StyleId) : "fruits3d"];
}

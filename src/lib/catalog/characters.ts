import { one, type Character } from "../db";
import { getCountry } from "./countries";

/** Rôles récurrents des histoires familiales. Chaque pays a son propre casting. */
export const ROLES = {
  papa: { fruit: "mango", gender: "male", nameIdx: 0, look: "middle-aged father, proud, slightly round belly" },
  maman: { fruit: "orange", gender: "female", nameIdx: 0, look: "middle-aged mother, strong and dramatic, headwrap" },
  coepouse: { fruit: "strawberry", gender: "female", nameIdx: 1, look: "young elegant second wife, glamorous, lots of jewelry" },
  bellemere: { fruit: "pineapple", gender: "female", nameIdx: 2, look: "old stern mother-in-law, glasses, walking stick" },
  fils: { fruit: "avocado", gender: "male", nameIdx: 1, look: "young man in his twenties, trendy, phone in hand" },
  fille: { fruit: "peach", gender: "female", nameIdx: 3, look: "young woman in her twenties, ambitious, stylish" },
  oncle: { fruit: "coconut", gender: "male", nameIdx: 2, look: "uncle back from Europe (diaspora), flashy, sunglasses" },
  voisin: { fruit: "watermelon", gender: "male", nameIdx: 3, look: "gossiping neighbor, big smile, always listening" },
} as const;

export type RoleId = keyof typeof ROLES;

const FRUIT_FR: Record<string, string> = {
  mango: "Mangue",
  orange: "Orange",
  strawberry: "Fraise",
  pineapple: "Ananas",
  avocado: "Avocat",
  peach: "Pêche",
  coconut: "Noix de coco",
  watermelon: "Pastèque",
};

export function fruitLabel(fruit: string) {
  return FRUIT_FR[fruit] ?? fruit;
}

/** Récupère (ou crée) le personnage partagé d'un rôle pour un pays/style. */
export async function getOrCreateCharacter(countryId: string, style: string, role: RoleId): Promise<Character> {
  const key = `${countryId}:${style}:${role}`;
  const existing = await one<Character>("SELECT * FROM characters WHERE key = $1", [key]);
  if (existing) return existing;
  const r = ROLES[role];
  const country = getCountry(countryId);
  const name = country.names[r.gender][r.nameIdx];
  const look = `${r.look}, wearing ${country.outfits}`;
  await one(
    `INSERT INTO characters (key, owner_id, country, style, name, fruit, role, look)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) ON CONFLICT (key) DO NOTHING`,
    [key, countryId, style, name, r.fruit, role, look],
  );
  return (await one<Character>("SELECT * FROM characters WHERE key = $1", [key]))!;
}

export async function castFor(countryId: string, style: string, roles: RoleId[]): Promise<Character[]> {
  const out: Character[] = [];
  for (const r of roles) out.push(await getOrCreateCharacter(countryId, style, r));
  return out;
}

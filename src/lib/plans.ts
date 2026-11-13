import { FORMATS } from "./config";

/**
 * Offres et prix (en centimes d'euro, TTC). Modifier ici suffit :
 * les produits Stripe sont créés automatiquement (une version par prix).
 *
 * Unité : une vidéo de 20 s = 80 crédits, 30 s = 120, 70 s = 280
 * (×10 par rapport à la valeur « réelle » : les montants paraissent plus généreux).
 * Prix de départ choisis pour rester sous Vidify (19,99 / 39,99 / 79,99 €)
 * tout en couvrant le coût réel mesuré (~0,014 € par crédit avec Grok de base).
 */
export const PLANS = {
  starter: { name: "Starter", tagline: "Pour lancer ton compte", monthly: 1499, credits: 700 },
  createur: { name: "Créateur", tagline: "Pour poster tous les 2-3 jours", monthly: 3499, credits: 1800, popular: true },
  pro: { name: "Pro", tagline: "Pour poster tous les jours", monthly: 6999, credits: 3800 },
} as const;

export type PlanId = keyof typeof PLANS;
export type Interval = "month" | "year";

/** Annuel = 10 mois payés (2 mois offerts). Les crédits de l'année sont donnés d'un coup. */
export const YEARLY_MONTHS_PAID = 10;

export const TOPUPS = {
  pack40: { name: "Recharge 400 crédits", price: 999, credits: 400 },
  pack100: { name: "Recharge 1 000 crédits", price: 2299, credits: 1000 },
} as const;

export type TopupId = keyof typeof TOPUPS;

export function isPlan(id: string): id is PlanId {
  return id in PLANS;
}
export function isTopup(id: string): id is TopupId {
  return id in TOPUPS;
}

export function planPrice(id: PlanId, interval: Interval) {
  return interval === "year" ? PLANS[id].monthly * YEARLY_MONTHS_PAID : PLANS[id].monthly;
}

export function planCredits(id: PlanId, interval: Interval) {
  return interval === "year" ? PLANS[id].credits * 12 : PLANS[id].credits;
}

export function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** « ≈ 5 vidéos de 30 s ou 2 de 70 s » */
export function videosFor(credits: number) {
  const v30 = Math.floor(credits / FORMATS.short30.credits);
  const v70 = Math.floor(credits / FORMATS.long70.credits);
  return `≈ ${v30} vidéos de 30 s ou ${v70} de 70 s`;
}

/** Clé de recherche Stripe : change automatiquement si le prix change. */
export function lookupKey(kind: "plan" | "topup", id: string, interval: Interval | "once", cents: number) {
  return `fruitstory_${kind}_${id}_${interval}_${cents}`;
}

/** Retrouve l'offre à partir d'une clé Stripe. */
export function parseLookupKey(key: string | null | undefined):
  | { kind: "plan"; id: PlanId; interval: Interval }
  | { kind: "topup"; id: TopupId }
  | null {
  const m = key?.match(/^fruitstory_(plan|topup)_([a-z0-9]+)_(month|year|once)_\d+$/);
  if (!m) return null;
  if (m[1] === "plan" && isPlan(m[2]) && (m[3] === "month" || m[3] === "year")) return { kind: "plan", id: m[2], interval: m[3] };
  if (m[1] === "topup" && isTopup(m[2])) return { kind: "topup", id: m[2] };
  return null;
}

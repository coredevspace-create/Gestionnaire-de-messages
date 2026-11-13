import Stripe from "stripe";
import { changeCredits, one, resetSubCredits, sql, type User } from "./db";
import {
  isPlan,
  lookupKey,
  parseLookupKey,
  planCredits,
  planPrice,
  PLANS,
  TOPUPS,
  type Interval,
  type PlanId,
  type TopupId,
} from "./plans";

/**
 * Paiements Stripe.
 * - Abonnements (mensuel/annuel) : crédits remis à niveau à chaque facture payée.
 * - Recharges ponctuelles : crédits permanents.
 * Les produits/prix sont créés automatiquement (clé de recherche « lookup_key »).
 */

let client: Stripe | null = null;
export function stripeEnabled() {
  return !!process.env.STRIPE_SECRET_KEY;
}
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquant");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

/** Prix Stripe correspondant à une offre (créé au besoin). */
async function priceFor(kind: "plan" | "topup", id: string, interval: Interval | "once"): Promise<string> {
  const cents =
    kind === "plan" ? planPrice(id as PlanId, interval as Interval) : TOPUPS[id as TopupId].price;
  const key = lookupKey(kind, id, interval, cents);
  const s = stripe();
  const found = await s.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const name =
    kind === "plan"
      ? `FruitStory ${PLANS[id as PlanId].name} (${interval === "year" ? "annuel" : "mensuel"})`
      : `FruitStory ${TOPUPS[id as TopupId].name}`;
  const price = await s.prices.create({
    currency: "eur",
    unit_amount: cents,
    lookup_key: key,
    tax_behavior: "inclusive",
    product_data: { name },
    ...(kind === "plan" ? { recurring: { interval: interval as Interval } } : {}),
  });
  return price.id;
}

async function customerFor(user: User): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const c = await stripe().customers.create({ email: user.email, metadata: { userId: String(user.id) } });
  await sql("UPDATE users SET stripe_customer_id = $2 WHERE id = $1", [user.id, c.id]);
  return c.id;
}

export async function checkoutPlan(user: User, plan: PlanId, interval: Interval, origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(user),
    client_reference_id: String(user.id),
    line_items: [{ price: await priceFor("plan", plan, interval), quantity: 1 }],
    subscription_data: { metadata: { userId: String(user.id) } },
    metadata: { userId: String(user.id) },
    allow_promotion_codes: true,
    locale: "fr",
    success_url: `${origin}/abonnement?paiement=ok`,
    cancel_url: `${origin}/abonnement?paiement=annule`,
  });
  return session.url!;
}

export async function checkoutTopup(user: User, pack: TopupId, origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer: await customerFor(user),
    client_reference_id: String(user.id),
    line_items: [{ price: await priceFor("topup", pack, "once"), quantity: 1 }],
    metadata: { userId: String(user.id), kind: "topup", pack },
    locale: "fr",
    success_url: `${origin}/abonnement?paiement=ok`,
    cancel_url: `${origin}/abonnement?paiement=annule`,
  });
  return session.url!;
}

/** Portail client Stripe : changer de carte, voir les factures, résilier. */
export async function portalUrl(user: User, origin: string): Promise<string> {
  const s = await stripe().billingPortal.sessions.create({
    customer: await customerFor(user),
    return_url: `${origin}/abonnement`,
    locale: "fr",
  });
  return s.url;
}

// ---------------- Webhook ----------------

async function userIdFromCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<number | null> {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const row = await one<{ id: number }>("SELECT id FROM users WHERE stripe_customer_id = $1", [id]);
  return row?.id ?? null;
}

function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  // Selon la version de l'API Stripe, l'abonnement est à des endroits différents.
  const inv = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  };
  const sub = inv.parent?.subscription_details?.subscription ?? inv.subscription ?? null;
  return typeof sub === "string" ? sub : sub?.id ?? null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const userId = Number(sub.metadata?.userId) || (await userIdFromCustomer(sub.customer));
  if (!userId) return;
  const info = parseLookupKey(sub.items.data[0]?.price?.lookup_key);
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  await sql(
    "UPDATE users SET plan = $2, plan_interval = $3, plan_status = $4, stripe_subscription_id = $5 WHERE id = $1",
    [
      userId,
      active && info?.kind === "plan" ? info.id : null,
      active && info?.kind === "plan" ? info.interval : null,
      sub.status,
      active ? sub.id : null,
    ],
  );
  if (!active) await sql("UPDATE users SET sub_credits = 0 WHERE id = $1", [userId]);
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = Number(s.metadata?.userId || s.client_reference_id);
      if (!userId) return;
      if (s.customer && typeof s.customer === "string") {
        await sql("UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $2) WHERE id = $1", [userId, s.customer]);
      }
      if (s.mode === "payment" && s.metadata?.kind === "topup" && s.payment_status === "paid") {
        const pack = s.metadata.pack as TopupId;
        if (pack in TOPUPS) await changeCredits(userId, TOPUPS[pack].credits, `Achat ${TOPUPS[pack].name}`, `cs:${s.id}`);
      }
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const subId = subscriptionIdOf(invoice);
      if (!subId) return;
      const sub = await stripe().subscriptions.retrieve(subId);
      await syncSubscription(sub);
      const userId = Number(sub.metadata?.userId) || (await userIdFromCustomer(sub.customer));
      const info = parseLookupKey(sub.items.data[0]?.price?.lookup_key);
      if (!userId || info?.kind !== "plan" || !isPlan(info.id)) return;
      await resetSubCredits(
        userId,
        planCredits(info.id, info.interval),
        `Abonnement ${PLANS[info.id].name} (${info.interval === "year" ? "annuel" : "mensuel"})`,
        `in:${invoice.id}`,
      );
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      return;
  }
}

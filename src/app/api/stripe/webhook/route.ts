import type Stripe from "stripe";
import { handleStripeEvent, stripe } from "@/lib/stripe";

/** Webhook Stripe : vérifie la signature puis crédite le compte. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET manquant", { status: 500 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (e) {
    console.error("[stripe] erreur webhook", event.type, e);
    return new Response("Erreur", { status: 500 }); // Stripe réessaiera
  }
  return Response.json({ received: true });
}

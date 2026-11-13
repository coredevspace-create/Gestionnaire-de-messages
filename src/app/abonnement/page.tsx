import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { totalCredits } from "@/lib/db";
import { euros, PLANS, planCredits, planPrice, TOPUPS, videosFor, YEARLY_MONTHS_PAID, type PlanId } from "@/lib/plans";
import { stripeEnabled } from "@/lib/stripe";
import { ActionForm, Submit } from "@/components/forms";
import { openPortal, startCheckout } from "../actions";

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const yearly = sp.periode === "annuel";
  const interval = yearly ? "year" : "month";
  const hasPlan = !!user.plan;

  return (
    <div className="stack">
      <h1>Abonnement</h1>
      {sp.paiement === "ok" && (
        <p className="card">✅ Paiement reçu ! Tes crédits arrivent dans quelques secondes (rafraîchis la page).</p>
      )}
      {sp.paiement === "annule" && <p className="card">Paiement annulé, rien n&apos;a été débité.</p>}
      {!stripeEnabled() && <p className="warn">Le paiement n&apos;est pas encore activé sur ce site.</p>}

      <section className="card row" style={{ justifyContent: "space-between" }}>
        <span>
          <b>{totalCredits(user)} crédits</b> disponibles
          {user.sub_credits > 0 && ` (dont ${user.sub_credits} de ton abonnement, renouvelés à chaque échéance)`}
          {hasPlan && (
            <>
              {" "}
              · Offre <b>{PLANS[user.plan as PlanId]?.name ?? user.plan}</b> ({user.plan_interval === "year" ? "annuelle" : "mensuelle"})
              {user.plan_status === "past_due" && <span className="warn"> · paiement en retard</span>}
            </>
          )}
        </span>
        {user.stripe_customer_id && stripeEnabled() && (
          <form action={openPortal}>
            <button className="secondary">Gérer mon abonnement / factures</button>
          </form>
        )}
      </section>

      <ActionForm action={startCheckout} className="stack">
        <input type="hidden" name="interval" value={interval} />
        <div className="row">
          <Link href="/abonnement" className="tag" style={!yearly ? { background: "#7c3aed" } : undefined}>
            Mensuel
          </Link>
          <Link href="/abonnement?periode=annuel" className="tag" style={yearly ? { background: "#7c3aed" } : undefined}>
            Annuel · {12 - YEARLY_MONTHS_PAID} mois offerts
          </Link>
        </div>

        <label className="row card">
          <input type="checkbox" name="cgv" />
          <span>
            J&apos;accepte les <Link href="/cgv">conditions générales</Link> et je demande l&apos;accès immédiat au service :
            je reconnais perdre mon droit de rétractation pour la partie déjà fournie.
          </span>
        </label>
        <div className="grid">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const price = planPrice(id, interval);
            const credits = planCredits(id, interval);
            return (
              <div key={id} className="card stack" style={"popular" in p && p.popular ? { borderColor: "#7c3aed" } : undefined}>
                {"popular" in p && p.popular && <span className="tag">Le plus choisi</span>}
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                <span className="muted">{p.tagline}</span>
                <span style={{ fontSize: 28, fontWeight: 800 }}>
                  {euros(price)} <span className="muted">/ {yearly ? "an" : "mois"}</span>
                </span>
                {yearly && <span className="muted">soit {euros(Math.round(price / 12))} / mois</span>}
                <span>
                  <b>{p.credits} crédits</b> chaque mois{yearly ? ` (${credits} donnés d'un coup)` : ""}
                </span>
                <span className="muted">{videosFor(p.credits)} par mois</span>
                <span className="muted">Sans engagement · {(p.monthly / p.credits / 100).toFixed(3).replace(".", ",")} € le crédit</span>
                <Submit name="item" value={id}>
                  {hasPlan ? "Déjà abonné" : `Choisir ${p.name}`}
                </Submit>
              </div>
            );
          })}
        </div>

        <h2>Recharges ponctuelles</h2>
        <p className="muted">Crédits qui n&apos;expirent pas, utilisables avec ou sans abonnement.</p>
        <div className="grid">
          {Object.entries(TOPUPS).map(([id, t]) => (
            <div key={id} className="card stack">
              <b>{t.name}</b>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{euros(t.price)}</span>
              <span className="muted">{videosFor(t.credits)}</span>
              <Submit name="item" value={id}>
                Acheter
              </Submit>
            </div>
          ))}
        </div>

        <p className="muted">✓ Sans engagement, résiliable en 1 clic · ✓ Paiement sécurisé par Stripe · ✓ Crédits d&apos;abonnement renouvelés à chaque échéance</p>
      </ActionForm>
    </div>
  );
}

import "./billing.css";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { totalCredits } from "@/lib/db";
import { FORMATS } from "@/lib/config";
import { euros, PLANS, planCredits, planPrice, TOPUPS, videosFor, YEARLY_MONTHS_PAID, type PlanId } from "@/lib/plans";
import { stripeEnabled } from "@/lib/stripe";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { openPortal, startCheckout } from "@/app/actions";

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const yearly = sp.periode === "annuel";
  const interval = yearly ? "year" : "month";
  const current = user.plan ? (user.plan as PlanId) : null;
  const credits = totalCredits(user);
  const cap = current ? planCredits(current, (user.plan_interval as "month" | "year") ?? "month") : 700;
  const gauge = Math.min(100, Math.round((credits / cap) * 100));
  const formats = Object.values(FORMATS);

  return (
    <div className="bl">
      <div className="ws-head">
        <div>
          <span className="eyebrow">Crédits</span>
          <h1>Crédits et abonnement</h1>
          <p>Chaque vidéo consomme des crédits. Recharge ou change d&apos;offre quand tu veux.</p>
        </div>
      </div>

      {sp.paiement === "ok" && (
        <div className="bl-alert ok"><Icon name="check" size={16} /> Paiement reçu ! Tes crédits arrivent dans quelques secondes.</div>
      )}
      {sp.paiement === "annule" && <div className="bl-alert">Paiement annulé, rien n&apos;a été débité.</div>}
      {!stripeEnabled() && <div className="bl-alert">Le paiement n&apos;est pas encore activé sur ce site.</div>}

      {/* ---------- Portefeuille ---------- */}
      <section className="bl-wallet">
        <div className="bl-balance">
          <span className="bl-label">Solde disponible</span>
          <div className="bl-amount">
            {credits.toLocaleString("fr-FR")} <small>crédits</small>
          </div>
          <div className="bl-gauge"><div style={{ width: `${gauge}%` }} /></div>
          <span className="muted">
            {current
              ? `${user.sub_credits.toLocaleString("fr-FR")} crédits d'abonnement, renouvelés à chaque échéance`
              : "Sans abonnement · les crédits de recharge n'expirent pas"}
          </span>
        </div>
        <div className="bl-equiv">
          {formats.map((f) => (
            <div key={f.seconds}>
              <b>{Math.floor(credits / f.credits)}</b>
              <span>vidéo{Math.floor(credits / f.credits) > 1 ? "s" : ""} de {f.seconds} s</span>
            </div>
          ))}
        </div>
        <div className="bl-plan">
          <span className="bl-label">Offre actuelle</span>
          <b>{current ? `${PLANS[current].name} · ${user.plan_interval === "year" ? "annuelle" : "mensuelle"}` : "Aucune"}</b>
          {user.plan_status === "past_due" && <span className="warn">Paiement en retard</span>}
          {user.stripe_customer_id && stripeEnabled() ? (
            <form action={openPortal}>
              <button className="secondary btn-sm">Gérer · factures · résilier</button>
            </form>
          ) : (
            <span className="muted">Choisis une offre ci-dessous.</span>
          )}
        </div>
      </section>

      <ActionForm action={startCheckout} className="bl-form">
        <input type="hidden" name="interval" value={interval} />

        {/* ---------- Offres ---------- */}
        <div className="bl-sec-head">
          <h2>Offres mensuelles</h2>
          <div className="bl-toggle">
            <Link href="/abonnement" className={yearly ? "" : "on"} scroll={false}>Mensuel</Link>
            <Link href="/abonnement?periode=annuel" className={yearly ? "on" : ""} scroll={false}>
              Annuel <em>−{Math.round((1 - YEARLY_MONTHS_PAID / 12) * 100)} %</em>
            </Link>
          </div>
        </div>

        <label className="bl-cgv">
          <input type="checkbox" name="cgv" />
          <span>
            J&apos;accepte les <Link className="link" href="/cgv">conditions générales</Link> et demande l&apos;accès immédiat au service, en
            renonçant à mon droit de rétractation pour la partie déjà fournie.
          </span>
        </label>
        <div className="bl-plans">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const pop = "popular" in p && p.popular;
            const isCurrent = current === id;
            const price = planPrice(id, interval);
            return (
              <div key={id} className={`bl-card${pop ? " pop" : ""}${isCurrent ? " current" : ""}`}>
                <div className="bl-card-head">
                  <h3>{p.name}</h3>
                  {isCurrent ? <span className="pill cur">Ton offre</span> : pop ? <span className="pill">Le plus choisi</span> : null}
                </div>
                <span className="muted">{p.tagline}</span>
                <div className="bl-price">
                  {euros(Math.round(yearly ? price / 12 : price))}
                  <small>/ mois</small>
                </div>
                {yearly && <span className="muted bl-sub">{euros(price)} facturés par an</span>}
                <ul>
                  <li><Icon name="check" size={15} /><span><b>{p.credits.toLocaleString("fr-FR")} crédits</b> par mois</span></li>
                  <li><Icon name="check" size={15} />{videosFor(p.credits)}</li>
                  <li><Icon name="check" size={15} />Toutes les histoires et personnages</li>
                  <li><Icon name="check" size={15} />Sans engagement</li>
                </ul>
                {isCurrent ? (
                  <span className="bl-current"><Icon name="check" size={15} /> Offre active</span>
                ) : current ? (
                  <span className="muted bl-switch">Pour changer d&apos;offre : « Gérer » en haut de page.</span>
                ) : (
                  <Submit name="item" value={id} className={pop ? "btn-grad" : "secondary"}>
                    Choisir {p.name}
                  </Submit>
                )}
              </div>
            );
          })}
        </div>

        {/* ---------- Recharges ---------- */}
        <div className="bl-sec-head">
          <h2>Recharges ponctuelles</h2>
          <span className="muted">Des crédits qui n&apos;expirent pas, avec ou sans abonnement.</span>
        </div>
        <div className="bl-topups">
          {Object.entries(TOPUPS).map(([id, t]) => (
            <div key={id} className="bl-topup">
              <div className="bl-topup-ic"><Icon name="sparkle" size={20} /></div>
              <div className="bl-topup-txt">
                <b>{t.credits.toLocaleString("fr-FR")} crédits</b>
                <span className="muted">{videosFor(t.credits)}</span>
              </div>
              <div className="bl-topup-buy">
                <span>{euros(t.price)}</span>
                <Submit name="item" value={id} className="btn-sm">Acheter</Submit>
              </div>
            </div>
          ))}
        </div>

        <div className="bl-trust">
          <span><Icon name="shield" size={14} /> Paiement sécurisé par Stripe</span>
          <span><Icon name="refresh" size={14} /> Résiliable en un clic</span>
          <span><Icon name="check" size={14} /> Crédits remboursés si une vidéo échoue</span>
        </div>
      </ActionForm>
    </div>
  );
}

import { Legal } from "@/components/Legal";

export default function Confidentialite() {
  return (
    <Legal title="Politique de confidentialité">
      <p>Responsable du traitement : [NOM DE L&apos;ENTREPRISE], [ADRESSE], [EMAIL DE CONTACT].</p>
      <h2>Données collectées</h2>
      <p>
        Email, mot de passe (chiffré), préférences (pays, monétisation), historique des vidéos et des crédits, informations
        de facturation gérées par Stripe (nous ne voyons jamais ton numéro de carte).
      </p>
      <h2>Finalités</h2>
      <p>Fournir le service, gérer les paiements, assurer la sécurité, respecter nos obligations légales.</p>
      <h2>Sous-traitants</h2>
      <p>
        Vercel (hébergement), Neon (base de données), Stripe (paiement), OpenAI (texte et images), xAI (vidéo). Certains
        sont situés hors de l&apos;Union européenne, avec des garanties appropriées (clauses contractuelles types).
      </p>
      <h2>Conservation</h2>
      <p>Pendant la durée du compte, puis [DURÉE] ; factures : 10 ans (obligation légale).</p>
      <h2>Tes droits</h2>
      <p>
        Accès, rectification, suppression, opposition, portabilité : écris à [EMAIL DE CONTACT]. Tu peux aussi saisir la
        CNIL (cnil.fr).
      </p>
    </Legal>
  );
}

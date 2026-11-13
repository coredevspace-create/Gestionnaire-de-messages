import { Legal } from "@/components/Legal";

export default function CGV() {
  return (
    <Legal title="Conditions générales de vente et d'utilisation">
      <h2>1. Objet</h2>
      <p>
        FruitStory, édité par [NOM DE L&apos;ENTREPRISE / ENTREPRENEUR], permet de générer des vidéos courtes à l&apos;aide
        d&apos;intelligences artificielles à partir d&apos;histoires prêtes ou d&apos;idées fournies par l&apos;utilisateur.
      </p>
      <h2>2. Compte</h2>
      <p>L&apos;utilisateur doit avoir au moins 18 ans (ou l&apos;accord d&apos;un parent) et fournir un email valide. Il est responsable de la confidentialité de son mot de passe.</p>
      <h2>3. Crédits et offres</h2>
      <p>
        La génération de vidéos consomme des crédits (indiqués avant chaque création). Les crédits d&apos;abonnement sont
        renouvelés à chaque échéance et ne sont pas cumulables d&apos;une période à l&apos;autre. Les crédits achetés en
        recharge n&apos;expirent pas tant que le compte est actif. Les crédits n&apos;ont aucune valeur monétaire et ne
        sont pas remboursables, sauf échec technique de génération (crédits restitués automatiquement).
      </p>
      <h2>4. Prix et paiement</h2>
      <p>
        Les prix sont indiqués en euros TTC. Le paiement est effectué par carte via Stripe. Les abonnements sont sans
        engagement et se renouvellent automatiquement jusqu&apos;à résiliation, possible à tout moment depuis la page
        Abonnement ; la résiliation prend effet à la fin de la période payée.
      </p>
      <h2>5. Droit de rétractation</h2>
      <p>
        Conformément à l&apos;article L221-28 du Code de la consommation, l&apos;utilisateur qui demande l&apos;accès immédiat
        au service et reconnaît perdre son droit de rétractation ne peut plus l&apos;exercer pour la partie du service déjà
        fournie.
      </p>
      <h2>6. Contenus générés</h2>
      <p>
        L&apos;utilisateur peut utiliser les vidéos générées, y compris à des fins commerciales (publication et monétisation
        sur les réseaux sociaux). Il s&apos;interdit de générer des contenus illégaux, haineux, violents envers des
        personnes réelles, sexuels ou portant atteinte aux droits de tiers. Les vidéos sont produites par des IA et
        peuvent contenir des imperfections ; aucun résultat d&apos;audience ou de revenu n&apos;est garanti.
      </p>
      <h2>7. Responsabilité et disponibilité</h2>
      <p>Le service dépend de fournisseurs tiers (OpenAI, xAI, Vercel, Stripe) et peut être temporairement indisponible.</p>
      <h2>8. Contact et litiges</h2>
      <p>
        Contact : [EMAIL DE CONTACT]. En cas de litige, l&apos;utilisateur consommateur peut recourir gratuitement au
        médiateur de la consommation : [NOM ET SITE DU MÉDIATEUR]. Droit applicable : droit français.
      </p>
    </Legal>
  );
}

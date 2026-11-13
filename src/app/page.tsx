import Link from "next/link";
import { redirect } from "next/navigation";
import "./landing.css";
import { currentUser } from "@/lib/auth";
import { config, FORMATS } from "@/lib/config";
import { COUNTRIES } from "@/lib/catalog/countries";
import { STORIES, WORLD_STORIES, type Story } from "@/lib/catalog/stories";
import { euros, PLANS, planPrice, videosFor, YEARLY_MONTHS_PAID, type PlanId } from "@/lib/plans";
import { FRUIT_EMOJI, showcasePortraits, showcaseVideos } from "@/lib/showcase";
import { ROLES } from "@/lib/catalog/characters";
import { BRAND } from "@/components/Logo";

export const dynamic = "force-dynamic";

const THEMES = [
  "Le héros sous-estimé",
  "Injustice & karma",
  "Drame familial",
  "Test du patron",
  "Héritage caché",
  "Mariage qui tourne mal",
  "Pouvoir secret",
  "Belle-mère terrible",
  "Tournoi à 1 milliard",
  "Le cousin du village",
];

const GRADIENTS = [
  "linear-gradient(135deg,#ffb21f,#ff3d6b)",
  "linear-gradient(135deg,#c8f53a,#1fb8a6)",
  "linear-gradient(135deg,#ff2e9a,#7a3dff)",
  "linear-gradient(135deg,#ff6a2b,#ffd27a)",
];

function storyEmojis(s: Story) {
  const fruits = s.castSpec?.length ? s.castSpec.map((c) => c.fruit) : s.cast.map((r) => ROLES[r]?.fruit);
  return fruits.slice(0, 3).map((f) => FRUIT_EMOJI[f] ?? "🍊").join("");
}

/** Affiche typographique d'une histoire (quand on n'a pas encore de vidéo en vitrine). */
function Poster({ s, g }: { s: Story; g: string }) {
  return (
    <div className="lp-shot poster" style={{ ["--g" as string]: g }}>
      <div className="emojis">{storyEmojis(s)}</div>
      <blockquote>{s.hook}</blockquote>
      <div className="foot">
        <b>{s.title}</b>
        <span className="part">Partie 1</span>
      </div>
    </div>
  );
}

export default async function Landing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentUser()) redirect("/creer");
  const yearly = (await searchParams).periode === "annuel";
  const [videos, portraits] = await Promise.all([showcaseVideos(8), showcasePortraits(18)]);
  const featured = [...WORLD_STORIES.slice(0, 4), ...STORIES.filter((s) => s.tags.includes("viral")).slice(0, 4)];
  const africa = COUNTRIES.filter((c) => c.id !== "monde");

  return (
    <div className="lp">
      {/* ---------- HERO ---------- */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div>
            <span className="lp-kicker">
              <b>NOUVEAU</b> Studio IA pour créateurs TikTok, Reels & Shorts
            </span>
            <h1 className="lp-title">
              Des fruits qui parlent.
              <br />
              Des vues qui <span className="gradient-text underline">explosent</span>.
            </h1>
            <p className="lp-sub">
              Choisis une histoire, {BRAND} s&apos;occupe du reste : <b>scénario viral, personnages qui parlent, sous-titres,
              musique et montage</b>. Ta mini-série est prête à publier en quelques minutes.
            </p>
            <div className="lp-cta">
              <Link href="/signup" className="btn btn-lg">
                Créer ma première vidéo →
              </Link>
              <Link href="#exemples" className="btn btn-ghost btn-lg">
                Voir des exemples
              </Link>
            </div>
            <div className="lp-proof">
              <span>{config.starterCredits} crédits offerts</span>
              <span>Sans carte bancaire</span>
              <span>Vidéo prête en ~3 min</span>
            </div>
          </div>

          <div className="lp-stage">
            <div className="lp-phone">
              <div className="lp-screen">
                <div className="lp-notch" />
                {videos[0] ? (
                  <video src={videos[0].src} poster={videos[0].poster ?? undefined} autoPlay muted loop playsInline />
                ) : (
                  <img src="/visuals/peche-valise.jpg" alt="Personnage pêche dans une mini-série" />
                )}
                <div className="lp-titlebar">LE TRANSFERT · PARTIE 1</div>
                <div className="lp-sub-overlay">ON DIT QUOI ?!</div>
                <div className="lp-rail">
                  <span><i>❤️</i>1,2 M</span>
                  <span><i>💬</i>8 431</span>
                  <span><i>↗️</i>Partager</span>
                </div>
                <div className="lp-caption">
                  <b>@ton.compte</b>
                  Elle rentre au pays… et découvre un terrain vide 😱 #partie1
                </div>
              </div>
            </div>
            <div className="lp-float f1"><span className="ico">🧠</span><div>Scénario viral<small>écrit pour toi</small></div></div>
            <div className="lp-float f2"><span className="ico">🎙️</span><div>Voix + lèvres<small>synchronisées</small></div></div>
            <div className="lp-float f3"><span className="ico">🔁</span><div>Même visage<small>à chaque épisode</small></div></div>
            <div className="lp-float f4"><span className="ico">⚡</span><div>Prête en ~3 min<small>format 9:16</small></div></div>
          </div>
        </div>
      </section>

      {/* ---------- BANDEAU ---------- */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...THEMES, ...THEMES].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      {/* ---------- EXEMPLES ---------- */}
      <section className="lp-section" id="exemples">
        <div className="lp-head">
          <span className="eyebrow">Exemples</span>
          <h2>
            Des épisodes qu&apos;on <span className="gradient-text">regarde jusqu&apos;au bout</span>
          </h2>
          <p>Accroche dès la première seconde, suspense à la fin, et l&apos;envie de voir la partie 2.</p>
        </div>
        <div className="lp-gallery">
          {videos.length >= 4
            ? videos.slice(0, 8).map((v) => (
                <div key={v.id} className="lp-shot">
                  <video src={v.src} poster={v.poster ?? undefined} muted loop playsInline preload="none" autoPlay />
                  <div className="meta">
                    <b>{v.title}</b>
                    <span className="part">Partie {v.episode}</span>
                  </div>
                </div>
              ))
            : (
              <>
                <div className="lp-shot">
                  <img src="/visuals/peche-valise.jpg" alt="" />
                  <div className="meta"><b>Le transfert qui n&apos;arrive jamais</b><span className="part">Partie 1</span></div>
                </div>
                {featured.slice(0, 2).map((s, i) => <Poster key={s.id} s={s} g={GRADIENTS[i % 4]} />)}
                <div className="lp-shot">
                  <img src="/visuals/coco.jpg" alt="" />
                  <div className="meta"><b>L&apos;oncle de Paris</b><span className="part">Partie 2</span></div>
                </div>
                {featured.slice(2, 4).map((s, i) => <Poster key={s.id} s={s} g={GRADIENTS[(i + 2) % 4]} />)}
                <div className="lp-shot">
                  <img src="/visuals/foule.jpg" alt="" />
                  <div className="meta"><b>Le chantier fantôme</b><span className="part">Partie 3</span></div>
                </div>
                {featured.slice(4, 5).map((s) => <Poster key={s.id} s={s} g={GRADIENTS[1]} />)}
              </>
            )}
        </div>
      </section>

      {/* ---------- CASTING ---------- */}
      {portraits.length >= 6 && (
        <section style={{ padding: "20px 0 40px" }}>
          <div className="lp-head" style={{ marginBottom: 28 }}>
            <span className="eyebrow">Le casting</span>
            <h2>
              Des personnages <span className="gradient-text">déjà prêts</span> à jouer
            </h2>
            <p>Chacun garde le même visage d&apos;un épisode à l&apos;autre. Tes abonnés s&apos;y attachent.</p>
          </div>
          <div style={{ overflow: "hidden" }}>
            <div className="lp-cast-track">
              {[...portraits, ...portraits].map((p, i) => (
                <div key={i} className="lp-cast">
                  <img src={p.src} alt={p.name} loading="lazy" />
                  <div>
                    <b>{p.name}</b>
                    {p.fruit} · {p.role}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- COMMENT ÇA MARCHE ---------- */}
      <section className="lp-section" id="comment">
        <div className="lp-head">
          <span className="eyebrow">Comment ça marche</span>
          <h2>
            Trois étapes. <span className="gradient-text">Zéro montage.</span>
          </h2>
          <p>Pas besoin de savoir écrire, filmer ou monter. Et pas de questionnaire à rallonge à chaque vidéo.</p>
        </div>
        <div className="lp-steps">
          <div className="lp-step">
            <div className="num">01</div>
            <h3>Choisis une histoire</h3>
            <p>Pioche dans les séries qui marchent déjà, ou écris ton idée en une phrase.</p>
            <div className="mock">« Le patron glisse trop d&apos;argent dans la paie pour tester son employé… »</div>
          </div>
          <div className="lp-step">
            <div className="num">02</div>
            <h3>On génère tout</h3>
            <p>Scénario à suspense, personnages, voix, sous-titres, musique et montage vertical.</p>
            <div className="mock">✓ Scénario · ✓ 5 plans · ✓ Voix · ✓ Sous-titres · ✓ Musique</div>
          </div>
          <div className="lp-step">
            <div className="num">03</div>
            <h3>Publie et enchaîne</h3>
            <p>Télécharge, poste, puis lance la partie suivante en un clic : mêmes personnages, même univers.</p>
            <div className="mock">▶ Partie 2 — « Il sort son téléphone : il a tout filmé. »</div>
          </div>
        </div>
      </section>

      {/* ---------- UNIVERS ---------- */}
      <section className="lp-section" style={{ paddingTop: 20 }}>
        <div className="lp-head">
          <span className="eyebrow">Deux univers</span>
          <h2>
            Ton public, <span className="gradient-text">tes histoires</span>
          </h2>
          <p>{STORIES.length + WORLD_STORIES.length} séries prêtes à lancer, et de nouvelles chaque semaine.</p>
        </div>
        <div className="lp-worlds">
          <div className="lp-world">
            <img src="/visuals/foule.jpg" alt="" />
            <div className="lp-flags">{africa.map((c) => c.flag).join(" ")}</div>
            <h3>Afrique</h3>
            <p>
              {africa.length} pays, décors, prénoms et façons de parler locaux. Belle-mère, co-épouses, diaspora, dot,
              funérailles : les histoires que ton public vit.
            </p>
            <span className="tag hot">Idéal pour monétiser vite</span>
          </div>
          <div className="lp-world" style={{ background: "radial-gradient(120% 120% at 100% 0%, rgba(255,46,154,0.35), transparent 60%), #140f12" }}>
            <div className="lp-flags">🏢 🏟️ 🏛️ 🍽️ 🎓</div>
            <h3>Monde</h3>
            <p>
              Bureaux, prison, arène, manoir, lycée de luxe… Le stagiaire sous-estimé, le caïd de la cantine, le tournoi du
              milliard : les ressorts des vidéos qui font des millions.
            </p>
            <span className="tag new">Français de tous les jours</span>
          </div>
        </div>
      </section>

      {/* ---------- POINTS FORTS ---------- */}
      <section className="lp-section" style={{ paddingTop: 20 }}>
        <div className="lp-head">
          <span className="eyebrow">Pourquoi {BRAND}</span>
          <h2>
            Pensé pour <span className="gradient-text">faire des vues</span>
          </h2>
        </div>
        <div className="lp-bento">
          <div className="lp-tile wide">
            <div className="ico">🎬</div>
            <h3>La formule des vidéos virales</h3>
            <p>Accroche en 2 secondes, héros attachant, injustice, secret, et fin coupée au meilleur moment. Écrit pour être regardé jusqu&apos;au bout.</p>
          </div>
          <div className="lp-tile wide">
            <div className="ico">💸</div>
            <h3>Court pour grandir, long pour gagner</h3>
            <p>
              {FORMATS.short20.seconds}-{FORMATS.short30.seconds} s pour gagner des abonnés, {FORMATS.long70.seconds} s (plus d&apos;une minute) pour être payé par
              TikTok. Le bon format est choisi selon ton compte.
            </p>
          </div>
          <div className="lp-tile">
            <div className="ico">🔁</div>
            <h3>Séries à suspense</h3>
            <p>Plan de saison en 3, 5 ou 8 parties. « Épisode suivant » en un clic.</p>
          </div>
          <div className="lp-tile">
            <div className="ico">🔤</div>
            <h3>Sous-titres qui claquent</h3>
            <p>Gros, colorés, mot à mot, placés là où TikTok ne les cache pas.</p>
          </div>
          <div className="lp-tile">
            <div className="ico">🎵</div>
            <h3>Musique & bruitages</h3>
            <p>Ambiance qui baisse quand les personnages parlent, whoosh entre les plans.</p>
          </div>
        </div>
      </section>

      {/* ---------- TARIFS ---------- */}
      <section className="lp-section" id="tarifs">
        <div className="lp-head">
          <span className="eyebrow">Tarifs</span>
          <h2>
            Simple, <span className="gradient-text">sans engagement</span>
          </h2>
          <p>
            {config.starterCredits} crédits offerts pour essayer. Une vidéo de 30 s = {FORMATS.short30.credits} crédits.
          </p>
          <div style={{ marginTop: 18 }}>
            <div className="lp-toggle">
              <Link href="/?periode=mensuel#tarifs" className={yearly ? "" : "on"} scroll={false}>Mensuel</Link>
              <Link href="/?periode=annuel#tarifs" className={yearly ? "on" : ""} scroll={false}>
                Annuel · {12 - YEARLY_MONTHS_PAID} mois offerts
              </Link>
            </div>
          </div>
        </div>
        <div className="lp-prices">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const pop = "popular" in p && p.popular;
            const monthlyEq = yearly ? planPrice(id, "year") / 12 : p.monthly;
            return (
              <div key={id} className={`lp-price${pop ? " pop" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: 24 }}>{p.name}</h3>
                  {pop && <span className="tag hot">Le plus choisi</span>}
                </div>
                <span className="muted">{p.tagline}</span>
                <div className="amount">
                  {euros(Math.round(monthlyEq))} <small>/ mois</small>
                </div>
                {yearly && <span className="muted">soit {euros(planPrice(id, "year"))} par an</span>}
                <ul>
                  <li><b style={{ color: "var(--text)" }}>{p.credits} crédits</b> chaque mois</li>
                  <li>{videosFor(p.credits)}</li>
                  <li>Toutes les histoires et personnages</li>
                  <li>Sous-titres, musique, montage inclus</li>
                  <li>Résiliable en 1 clic</li>
                </ul>
                <Link href="/signup" className={`btn${pop ? "" : " btn-ghost"}`}>
                  Commencer
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="lp-section" id="faq" style={{ paddingTop: 20 }}>
        <div className="lp-head">
          <span className="eyebrow">FAQ</span>
          <h2>Questions fréquentes</h2>
        </div>
        <div className="lp-faq">
          <details>
            <summary>Je n&apos;y connais rien en montage, c&apos;est pour moi ?</summary>
            <p>Oui. Tu choisis une histoire (ou tu écris une phrase), et tu récupères une vidéo verticale terminée : voix, sous-titres, musique, tout est fait.</p>
          </details>
          <details>
            <summary>Combien de temps pour une vidéo ?</summary>
            <p>Environ 3 à 5 minutes pour une vidéo de 20-30 s. Tu peux fermer la page, la génération continue.</p>
          </details>
          <details>
            <summary>Les personnages restent les mêmes d&apos;un épisode à l&apos;autre ?</summary>
            <p>Oui : chaque personnage a un portrait de référence réutilisé à chaque plan et à chaque épisode.</p>
          </details>
          <details>
            <summary>Est-ce que je peux monétiser mes vidéos ?</summary>
            <p>Oui, les vidéos t&apos;appartiennent. Pour les comptes monétisés, on propose des formats de plus d&apos;une minute, comme l&apos;exige TikTok.</p>
          </details>
          <details>
            <summary>Que se passe-t-il si une vidéo rate ?</summary>
            <p>Tes crédits sont remboursés automatiquement, et tu peux relancer en un clic.</p>
          </details>
          <details>
            <summary>Je peux arrêter quand je veux ?</summary>
            <p>Oui, sans engagement. Tu résilies en un clic depuis ta page Abonnement.</p>
          </details>
        </div>
      </section>

      {/* ---------- APPEL FINAL ---------- */}
      <section className="lp-section" style={{ paddingTop: 10 }}>
        <div className="lp-final">
          <h2>Ta prochaine vidéo virale commence ici.</h2>
          <p>{config.starterCredits} crédits offerts. Ta première vidéo en quelques minutes.</p>
          <Link href="/signup" className="btn btn-lg">
            Essayer gratuitement →
          </Link>
        </div>
      </section>
    </div>
  );
}

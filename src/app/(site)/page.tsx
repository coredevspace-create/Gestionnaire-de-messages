import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { config, FORMATS } from "@/lib/config";
import { COUNTRIES } from "@/lib/catalog/countries";
import { STORIES, WORLD_STORIES, type Story } from "@/lib/catalog/stories";
import { euros, PLANS, planPrice, videosFor, YEARLY_MONTHS_PAID, type PlanId } from "@/lib/plans";
import { showcaseVideos } from "@/lib/showcase";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "pen", title: "Un scénario qui accroche", text: "Accroche en deux secondes, enjeu clair, fin coupée au meilleur moment." },
  { icon: "repeat", title: "Des personnages constants", text: "Chaque personnage garde le même visage, d'un plan à l'autre et d'un épisode à l'autre." },
  { icon: "mic", title: "Ils parlent vraiment", text: "Voix naturelles et lèvres synchronisées, en français, avec l'accent de ton public." },
  { icon: "type", title: "Sous-titres au mot près", text: "Calés sur la voix réelle, lisibles, placés là où TikTok ne les cache pas." },
  { icon: "music", title: "Musique et bruitages", text: "Une ambiance qui s'efface quand les personnages parlent. Rien à monter." },
  { icon: "clock", title: "Court ou long", text: `${FORMATS.short20.seconds} à ${FORMATS.short30.seconds} s pour grandir, ${FORMATS.long70.seconds} s pour la monétisation TikTok.` },
];

const FAQ = [
  ["Je n'y connais rien en montage. C'est pour moi ?", "Oui. Tu choisis une histoire ou tu écris une phrase, et tu récupères une vidéo verticale terminée : voix, sous-titres, musique, tout est fait."],
  ["Combien de temps pour une vidéo ?", "Environ trois à cinq minutes. Tu peux fermer la page, la génération continue."],
  ["Les personnages restent-ils les mêmes ?", "Oui. Chaque personnage a un portrait de référence réutilisé à chaque plan et à chaque épisode."],
  ["Puis-je monétiser mes vidéos ?", "Oui, elles t'appartiennent. Pour les comptes monétisés, on propose des formats de plus d'une minute, comme l'exige TikTok."],
  ["Et si une vidéo rate ?", "Tes crédits sont remboursés automatiquement et tu peux relancer en un clic."],
  ["Puis-je arrêter quand je veux ?", "Oui. Les offres sont sans engagement et se résilient en un clic depuis ton compte."],
];

const FALLBACK_IMAGES = [
  { src: "/visuals/peche-valise.jpg", title: "Le transfert qui n'arrive jamais", part: 1 },
  { src: "/visuals/coco.jpg", title: "L'oncle de Paris", part: 2 },
];

export default async function Landing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentUser()) redirect("/creer");
  const yearly = (await searchParams).periode === "annuel";
  const videos = await showcaseVideos(8);
  const quotes: Story[] = [WORLD_STORIES[1], STORIES.find((s) => s.id === "test-du-patron") ?? STORIES[0]];
  const africa = COUNTRIES.filter((c) => c.id !== "monde");
  const total = STORIES.length + WORLD_STORIES.length;

  const reel = [
    ...videos.map((v) => (
      <div key={`v${v.id}`} className="lp-clip">
        <div className="frame">
          <video src={v.src} poster={v.poster ?? undefined} muted loop playsInline autoPlay preload="metadata" />
        </div>
        <div className="meta"><b>{v.title}</b><span>Partie {v.episode}</span></div>
      </div>
    )),
    <div key="i0" className="lp-clip">
      <div className="frame"><img src={FALLBACK_IMAGES[0].src} alt="" /></div>
      <div className="meta"><b>{FALLBACK_IMAGES[0].title}</b><span>Partie 1</span></div>
    </div>,
    <div key="q0" className="lp-clip">
      <div className="frame text"><span className="who">{quotes[0].title}</span><blockquote>{quotes[0].hook}</blockquote><span className="who">Partie 1</span></div>
      <div className="meta"><b>{quotes[0].title}</b><span>Partie 1</span></div>
    </div>,
    <div key="i1" className="lp-clip">
      <div className="frame"><img src={FALLBACK_IMAGES[1].src} alt="" /></div>
      <div className="meta"><b>{FALLBACK_IMAGES[1].title}</b><span>Partie 2</span></div>
    </div>,
    <div key="q1" className="lp-clip">
      <div className="frame text"><span className="who">{quotes[1].title}</span><blockquote>{quotes[1].hook}</blockquote><span className="who">Partie 1</span></div>
      <div className="meta"><b>{quotes[1].title}</b><span>Partie 1</span></div>
    </div>,
  ].slice(0, videos.length > 4 ? 8 : 4);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <div>
            <span className="lp-pill"><b>Nouveau</b> Le studio des mini-séries IA</span>
            <h1>
              Des mini-séries que l&apos;on regarde <span className="serif">jusqu&apos;au bout.</span>
            </h1>
            <p>
              Choisis une histoire. On écrit le scénario, on fait parler les personnages, on ajoute les sous-titres et la
              musique. Tu publies.
            </p>
            <div className="lp-cta">
              <Link href="/signup" className="btn btn-lg">
                Créer ma première vidéo <Icon name="arrow" size={17} />
              </Link>
              <Link href="#exemples" className="btn btn-ghost btn-lg">
                Voir des exemples
              </Link>
            </div>
            <div className="lp-facts">
              <div><b>~3 min</b><span>par vidéo</span></div>
              <div><b>{total}</b><span>séries prêtes</span></div>
              <div><b>0 €</b><span>pour essayer</span></div>
            </div>
          </div>
          <div className="lp-device">
            <div className="screen">
              <div className="island" />
              {videos[0] ? (
                <video src={videos[0].src} poster={videos[0].poster ?? undefined} autoPlay muted loop playsInline />
              ) : (
                <>
                  <img src="/visuals/peche-valise.jpg" alt="Personnage d'une mini-série" />
                  <div className="caption">ON DIT QUOI ?!</div>
                </>
              )}
            </div>
            <div className="lp-note">
              <span className="ic"><Icon name="mic" size={16} /></span>
              <div>Voix et lèvres synchronisées<small>prête en quelques minutes</small></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Exemples ---------- */}
      <section className="lp-sec" id="exemples">
        <div className="lp-wrap">
          <span className="lp-label">Exemples</span>
          <h2 className="lp-h2">
            Des épisodes qui <span className="serif">accrochent.</span>
          </h2>
          <p className="lp-lead">Une accroche dès la première seconde, du suspense à la fin, et l&apos;envie de voir la suite.</p>
          <div className="lp-reel">{reel}</div>
        </div>
      </section>

      {/* ---------- Fonctionnement ---------- */}
      <section className="lp-sec" id="comment">
        <div className="lp-wrap">
          <span className="lp-label">Fonctionnement</span>
          <h2 className="lp-h2">
            Trois étapes. <span className="serif">Aucun montage.</span>
          </h2>
          <div className="lp-steps">
            <div>
              <span className="n">01</span>
              <h3>Choisis une histoire</h3>
              <p>Pioche parmi les séries qui fonctionnent déjà, ou décris ton idée en une phrase.</p>
            </div>
            <div>
              <span className="n">02</span>
              <h3>On produit l&apos;épisode</h3>
              <p>Scénario, personnages, voix, sous-titres, musique et montage vertical, en quelques minutes.</p>
            </div>
            <div>
              <span className="n">03</span>
              <h3>Publie, puis enchaîne</h3>
              <p>Télécharge, poste, et lance la partie suivante avec les mêmes personnages.</p>
            </div>
          </div>
          <div className="lp-feats">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <span className="ic"><Icon name={f.icon} size={17} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Univers ---------- */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <span className="lp-label">Univers</span>
          <h2 className="lp-h2">
            Ton public, <span className="serif">tes histoires.</span>
          </h2>
          <p className="lp-lead">{total} séries prêtes à lancer, dans deux univers.</p>
          <div className="lp-worlds">
            <div className="lp-world">
              <img src="/visuals/foule.jpg" alt="" />
              <div className="lp-flags">{africa.map((c) => <Flag key={c.id} id={c.id} size={16} />)}</div>
              <h3>Afrique</h3>
              <p>Dix pays, leurs décors, leurs prénoms et leur façon de parler. Les histoires de famille que ton public vit.</p>
            </div>
            <div className="lp-world plain">
              <div className="lp-places">
                {["Bureaux", "Prison", "Arène", "Manoir", "Lycée", "Cuisine"].map((p) => <span key={p}>{p}</span>)}
              </div>
              <h3>Monde</h3>
              <p>Le stagiaire sous-estimé, le caïd de la cantine, le tournoi du milliard : les ressorts des vidéos qui font des millions de vues.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Tarifs ---------- */}
      <section className="lp-sec" id="tarifs">
        <div className="lp-wrap">
          <span className="lp-label">Tarifs</span>
          <h2 className="lp-h2">
            Simple. <span className="serif">Sans engagement.</span>
          </h2>
          <p className="lp-lead">
            {config.starterCredits} crédits offerts pour essayer. Une vidéo de {FORMATS.short20.seconds} s = {FORMATS.short20.credits} crédits.
          </p>
          <div className="lp-toggle">
            <Link href="/?periode=mensuel#tarifs" className={yearly ? "" : "on"} scroll={false}>Mensuel</Link>
            <Link href="/?periode=annuel#tarifs" className={yearly ? "on" : ""} scroll={false}>
              Annuel · {12 - YEARLY_MONTHS_PAID} mois offerts
            </Link>
          </div>
          <div className="lp-prices">
            {(Object.keys(PLANS) as PlanId[]).map((id) => {
              const p = PLANS[id];
              const pop = "popular" in p && p.popular;
              const monthly = yearly ? planPrice(id, "year") / 12 : p.monthly;
              return (
                <div key={id} className={`lp-price${pop ? " pop" : ""}`}>
                  <div className="head">
                    <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                    {pop && <span>Le plus choisi</span>}
                  </div>
                  <span className="muted">{p.tagline}</span>
                  <div className="amount">
                    {euros(Math.round(monthly))} <small>/ mois</small>
                  </div>
                  {yearly && <span className="muted">{euros(planPrice(id, "year"))} facturés par an</span>}
                  <ul>
                    {[`${p.credits.toLocaleString("fr-FR")} crédits par mois`, videosFor(p.credits), "Toutes les histoires et personnages", "Sous-titres, musique et montage inclus", "Résiliable en un clic"].map((t) => (
                      <li key={t}><Icon name="check" size={15} />{t}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className={`btn${pop ? "" : " btn-ghost"}`}>Commencer</Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="lp-sec" id="faq">
        <div className="lp-wrap lp-faq">
          <div>
            <span className="lp-label">FAQ</span>
            <h2 className="lp-h2" style={{ fontSize: "clamp(32px, 3.6vw, 44px)" }}>
              Questions <span className="serif">fréquentes.</span>
            </h2>
          </div>
          <div>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final ---------- */}
      <section className="lp-sec lp-final">
        <div className="lp-wrap">
          <h2>
            Ta prochaine série <span className="serif">commence ici.</span>
          </h2>
          <p>Ta première vidéo est offerte. Aucune carte bancaire.</p>
          <Link href="/signup" className="btn btn-lg">
            Commencer gratuitement <Icon name="arrow" size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}

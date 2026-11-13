import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "./Logo";
import { Icon } from "./Icon";

const TILES = [
  { type: "video", src: "/reels/cantine.mp4", poster: "/reels/cantine.jpg" },
  { type: "img", src: "/visuals/afrique.jpg" },
  { type: "img", src: "/visuals/monde.jpg" },
  { type: "video", src: "/reels/transfert.mp4", poster: "/reels/transfert.jpg" },
  { type: "img", src: "/visuals/peche-valise.jpg" },
  { type: "video", src: "/reels/cantine-2.mp4", poster: "/reels/cantine-2.jpg" },
];

/** Écran de connexion / inscription : visuel animé à gauche, formulaire à droite. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-mosaic">
          {[0, 1, 2].map((col) => (
            <div key={col} className={`auth-col c${col}`}>
              {[...TILES.slice(col * 2), ...TILES.slice(0, col * 2), ...TILES.slice(col * 2), ...TILES.slice(0, col * 2)].map((t, i) => (
                <div key={i} className="auth-tile">
                  {t.type === "video" ? (
                    <video src={t.src} poster={t.poster} muted loop playsInline autoPlay preload="metadata" />
                  ) : (
                    <img src={t.src} alt="" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="auth-shade" />
        <Link href="/" className="auth-logo">
          <LogoMark size={30} />
          <span>FruitStory</span>
        </Link>
        <div className="auth-pitch">
          <span className="auth-kicker">Séries TikTok · Fruits 3D</span>
          <h2>
            Tu choisis l&apos;histoire.
            <br />
            <span className="serif grad">On fait le reste.</span>
          </h2>
          <p>Scénario, personnages qui parlent, sous-titres et musique. Ta vidéo est prête en quelques minutes.</p>
          <div className="auth-stats">
            <div><b>29</b><span>séries prêtes</span></div>
            <div><b>Voix FR</b><span>avec l&apos;accent</span></div>
            <div><b>Même visage</b><span>à chaque épisode</span></div>
          </div>
        </div>
      </aside>

      <main className="auth-form">
        <div className="auth-form-in">
          <Link href="/" className="auth-logo-m">
            <LogoMark size={30} />
            <span>FruitStory</span>
          </Link>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
          <div className="auth-foot">{footer}</div>
          <div className="auth-trust">
            <span><Icon name="check" size={14} /> Sans engagement</span>
            <span><Icon name="check" size={14} /> 1 vidéo offerte</span>
            <span><Icon name="check" size={14} /> Paiement sécurisé</span>
          </div>
        </div>
      </main>
    </div>
  );
}

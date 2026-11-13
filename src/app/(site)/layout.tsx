import type { ReactNode } from "react";
import Link from "next/link";
import "./site.css";
import { currentUser } from "@/lib/auth";
import { Brand, BRAND } from "@/components/Logo";
import { RevealObserver } from "@/components/Reveal";

/** Mise en page du site public (vitrine, connexion, pages légales). */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href="/">
            <Brand />
          </Link>
          <nav className="site-nav">
            <Link href="/#exemples">Exemples</Link>
            <Link href="/#comment">Fonctionnement</Link>
            <Link href="/#tarifs">Tarifs</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
          <div className="header-actions">
            {user ? (
              <Link href="/creer" className="btn btn-sm btn-grad">
                Ouvrir le studio
              </Link>
            ) : (
              <>
                <Link href="/login" className="site-login">
                  Connexion
                </Link>
                <Link href="/signup" className="btn btn-sm btn-grad">
                  Commencer
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <RevealObserver />
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="inner">
          <div className="stack" style={{ gap: 8 }}>
            <Brand />
            <span>Mini-séries IA pour TikTok, Reels et Shorts.</span>
          </div>
          <div className="footer-links">
            <Link href="/#tarifs">Tarifs</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/cgv">Conditions générales</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
          </div>
          <span className="copy">© {new Date().getFullYear()} {BRAND}</span>
        </div>
      </footer>
    </>
  );
}

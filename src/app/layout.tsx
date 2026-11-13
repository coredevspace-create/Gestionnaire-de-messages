import type { ReactNode } from "react";
import Link from "next/link";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
import "./globals.css";
import { currentUser, isAdmin } from "@/lib/auth";
import { isMock } from "@/lib/config";
import { totalCredits } from "@/lib/db";
import { Brand, BRAND } from "@/components/Logo";
import { logout } from "./actions";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";

export const metadata = {
  title: `${BRAND} — Mini-séries de fruits IA pour TikTok`,
  description:
    "Crée en un clic des mini-séries virales avec des personnages-fruits qui parlent : histoire, voix, sous-titres et montage inclus.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="fr">
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <header className="site-header">
          <div className="inner">
            <Link href={user ? "/creer" : "/"}>
              <Brand />
            </Link>
            {user ? (
              <>
                <nav className="site-nav">
                  <Link href="/creer">Créer</Link>
                  <Link href="/creations">Mes vidéos</Link>
                  <Link href="/abonnement">Abonnement</Link>
                  <Link href="/profile">Profil</Link>
                  {isAdmin(user) && <Link href="/admin">Admin</Link>}
                </nav>
                <div className="header-actions">
                  {isMock() && <span className="badge-mock">Mode simulation</span>}
                  <Link href="/abonnement" className="credits-pill">
                    ✦ {totalCredits(user)} crédits
                  </Link>
                  <form action={logout} className="hide-mobile">
                    <button className="secondary btn-sm">Déconnexion</button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <nav className="site-nav public">
                  <Link href="/#exemples">Exemples</Link>
                  <Link href="/#comment">Comment ça marche</Link>
                  <Link href="/#tarifs">Tarifs</Link>
                  <Link href="/#faq">FAQ</Link>
                </nav>
                <div className="header-actions">
                  <Link href="/login" className="btn btn-ghost btn-sm">
                    Connexion
                  </Link>
                  <Link href="/signup" className="btn btn-sm">
                    Essayer gratuitement
                  </Link>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="app">{children}</main>
        <footer className="site-footer">
          <div className="inner">
            <span>
              © {new Date().getFullYear()} {BRAND} · Fait pour les créateurs TikTok, Reels et Shorts
            </span>
            <span className="row" style={{ gap: 16 }}>
              <Link href="/cgv">Conditions générales</Link>
              <Link href="/confidentialite">Confidentialité</Link>
              <Link href="/mentions-legales">Mentions légales</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

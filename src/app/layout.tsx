import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { currentUser, isAdmin } from "@/lib/auth";
import { isMock } from "@/lib/config";
import { logout } from "./actions";

export const metadata = { title: "FruitStory (MVP)" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="fr">
      <body>
        <header>
          <strong>🍊 FruitStory</strong>
          {user ? (
            <>
              <nav>
                <Link href="/">Créer</Link>
                <Link href="/creations">Mes créations</Link>
                <Link href="/profile">Profil</Link>
                {isAdmin(user) && <Link href="/admin">Admin</Link>}
              </nav>
              <span>{user.credits} crédits</span>
              <form action={logout}>
                <button className="secondary">Déconnexion</button>
              </form>
            </>
          ) : (
            <nav>
              <Link href="/login">Connexion</Link>
              <Link href="/signup">Inscription</Link>
            </nav>
          )}
          {isMock() && <span className="badge-mock">Mode simulation (pas de clés API)</span>}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

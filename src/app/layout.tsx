import type { ReactNode } from "react";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { BRAND } from "@/components/Logo";
import { NavProgress } from "@/components/NavProgress";

export const metadata = {
  title: `${BRAND} — Mini-séries IA pour TikTok, Reels et Shorts`,
  description:
    "Crée en quelques minutes des mini-séries avec des personnages-fruits qui parlent : scénario, voix, sous-titres et montage inclus.",
};
export const dynamic = "force-dynamic";

/** Racine commune. Le site public et le studio ont chacun leur propre mise en page. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

import type { ReactNode } from "react";

/** Mise en page des pages légales. Les [crochets] sont à compléter avant le lancement. */
export function Legal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="stack" style={{ maxWidth: 760, lineHeight: 1.6 }}>
      <h1>{title}</h1>
      <p className="warn">
        Modèle à compléter et à faire vérifier par un professionnel avant le lancement (les éléments entre crochets).
      </p>
      {children}
    </article>
  );
}

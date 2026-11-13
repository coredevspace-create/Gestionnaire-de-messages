"use client";

import { useState } from "react";

/** Image de plan qui réessaie si elle n'est pas encore disponible, au lieu d'afficher une image cassée. */
export function Thumb({ src, alt }: { src: string; alt: string }) {
  const [tries, setTries] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="spinner" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={tries}
      src={tries ? `${src}${src.includes("?") ? "&" : "?"}r=${tries}` : src}
      alt={alt}
      onError={() => (tries < 4 ? setTimeout(() => setTries((t) => t + 1), 1500 * (tries + 1)) : setFailed(true))}
    />
  );
}

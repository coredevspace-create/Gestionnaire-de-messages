"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { icon: "🍊", label: "Personnages" },
  { icon: "✍️", label: "Scénario" },
  { icon: "🎨", label: "Images" },
  { icon: "🎬", label: "Animation" },
  { icon: "🎵", label: "Montage" },
];

const TIPS = [
  "On coiffe l'ananas et on repasse le costume du melon…",
  "Le scénariste ajoute un rebondissement de dernière minute…",
  "Les personnages répètent leurs répliques…",
  "Le réalisateur crie « Action ! »…",
  "On cale les sous-titres au mot près…",
  "Petit astuce : poste aux heures où ton public est en ligne (souvent 12 h et 19-21 h).",
  "Astuce : réponds aux commentaires « partie 2 ? » avec l'épisode suivant.",
  "Tu peux fermer cette page : la génération continue sans toi.",
];

/** Progression animée de la génération (étapes, pourcentage, chrono, messages). */
export function GenerationProgress({ stage, percent, step, startedAt, queued }: {
  stage: number;
  percent: number;
  step: string | null;
  startedAt: string;
  queued: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const u = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 5000);
    return () => {
      clearInterval(t);
      clearInterval(u);
    };
  }, []);
  const elapsed = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <section className="gen" role="status" aria-live="polite">
      <div className="gen-top">
        <div>
          <span className="eyebrow">Tournage en cours</span>
          <h2 style={{ margin: "6px 0 0" }}>{queued ? "Dans la file d'attente…" : step ?? "Préparation…"}</h2>
          <span className="muted">
            ⏱ {mm}:{ss} écoulées · environ 3 à 5 min au total
          </span>
        </div>
        <div className="gen-pct">{Math.round(percent)}%</div>
      </div>
      <div className="gen-bar">
        <div style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
      <div className="gen-steps">
        {STEPS.map((s, i) => (
          <div key={s.label} className={`gen-step${i < stage ? " done" : i === stage ? " now" : ""}`}>
            <span className="dot">{i < stage ? "✓" : s.icon}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <p className="gen-tip">💡 {TIPS[tip]}</p>
    </section>
  );
}

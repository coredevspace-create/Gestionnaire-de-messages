import { costOf, PRICES, type Metrics } from "@/lib/metrics";

export function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

export function wallTime(m: Metrics): number | null {
  if (!m.startedAt || !m.finishedAt) return null;
  return new Date(m.finishedAt).getTime() - new Date(m.startedAt).getTime();
}

/** Détail coût + temps d'une vidéo (réservé à l'admin). */
export function MetricsView({ m, seconds, credits }: { m: Metrics; seconds: number; credits: number }) {
  const c = costOf(m);
  const wall = wallTime(m);
  const $ = (n: number) => `${n.toFixed(2)} $`;
  return (
    <details className="card" open>
      <summary>
        <strong>Coût & temps (admin)</strong> — {$(c.total)} · {wall ? fmtDuration(wall) : "en cours"}
      </summary>
      <div className="grid" style={{ marginTop: 10 }}>
        <div className="stack">
          <strong>Coût estimé</strong>
          <span>Images OpenAI : {$(c.images)} ({m.images} images{m.sheets ? `, dont ${m.sheets} portraits réutilisables` : ""})</span>
          <span>Texte (scénario + contrôle images) : {$(c.text)}</span>
          {!!m.rejectedImages && <span>Images refusées puis refaites : {m.rejectedImages}</span>}
          <span>Vidéo Grok : {$(c.video)} ({m.grokSeconds} s × {PRICES.grokPerSecond} $)</span>
          <strong>Total : {$(c.total)}</strong>
          <span className="muted">
            Soit {$(c.total / Math.max(1, seconds))} par seconde de vidéo · {(c.total / Math.max(1, credits)).toFixed(3)} $ par crédit consommé
          </span>
        </div>
        <div className="stack">
          <strong>Temps de production</strong>
          {Object.entries(m.steps).map(([k, v]) => (
            <span key={k}>
              {k} : {fmtDuration(v)}
            </span>
          ))}
          <strong>Total (de la création à la fin) : {wall ? fmtDuration(wall) : "—"}</strong>
        </div>
      </div>
      <p className="muted">
        Estimations à partir des tokens renvoyés par OpenAI et des tarifs configurés (variables PRICE_*). Vérifie avec
        les tableaux de bord Usage d&apos;OpenAI et de xAI.
      </p>
    </details>
  );
}

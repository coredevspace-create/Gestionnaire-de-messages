/** Affiché instantanément pendant le chargement d'une page. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="spinner" />
      <span className="muted">Chargement…</span>
    </div>
  );
}

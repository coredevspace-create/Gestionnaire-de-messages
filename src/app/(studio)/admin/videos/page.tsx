import Link from "next/link";
import { sql } from "@/lib/db";
import { costOf, parseMetrics } from "@/lib/metrics";
import { fmtDuration, wallTime } from "@/components/MetricsView";
import { adminToggleShowcase } from "@/app/actions";

const FILTERS = { tous: "Toutes", done: "Terminées", running: "En cours", failed: "Échecs" } as const;

export default async function AdminVideos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = (await searchParams).statut ?? "tous";
  const where = f === "done" ? "v.status = 'done'" : f === "failed" ? "v.status = 'failed'" : f === "running" ? "v.status IN ('queued','running')" : "true";
  const rows = await sql<{ id: number; seconds: number; credits_cost: number; status: string; mock: boolean; showcase: boolean; metrics_json: string | null; email: string; title: string; episode: number; error: string | null; step: string | null }>(
    `SELECT v.id, v.seconds, v.credits_cost, v.status, v.mock, v.showcase, v.metrics_json, v.error, v.step, v.episode, u.email, s.title
     FROM videos v JOIN users u ON u.id = v.user_id JOIN series s ON s.id = v.series_id
     WHERE ${where} ORDER BY v.id DESC LIMIT 100`,
  );
  return (
    <>
      <h1>Vidéos</h1>
      <div className="filters">
        {Object.entries(FILTERS).map(([k, l]) => (
          <Link key={k} href={`/admin/videos?statut=${k}`} className={f === k ? "on" : ""}>{l}</Link>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Histoire</th><th>Utilisateur</th><th>Durée</th><th>Statut</th><th>Coût</th><th>$/crédit</th><th>Temps</th><th>Vitrine</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = parseMetrics(r.metrics_json);
              const cost = costOf(m).total;
              const wall = wallTime(m);
              return (
                <tr key={r.id}>
                  <td><Link className="link" href={`/videos/${r.id}`}>#{r.id}</Link>{r.mock ? " 🧪" : ""}</td>
                  <td>{r.title} · ép. {r.episode}{r.status === "failed" && r.error ? <div className="muted" style={{ fontSize: 12 }}>{r.error.slice(0, 90)}</div> : null}</td>
                  <td>{r.email}</td>
                  <td>{r.seconds} s</td>
                  <td><span className={`status ${r.status}`}>{r.status === "running" ? r.step ?? "en cours" : r.status}</span></td>
                  <td>{cost.toFixed(2)} $</td>
                  <td>{(cost / r.credits_cost).toFixed(3)}</td>
                  <td>{wall ? fmtDuration(wall) : "—"}</td>
                  <td>
                    {r.status === "done" && (
                      <form action={adminToggleShowcase}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="secondary btn-sm">{r.showcase ? "★ Retirer" : "☆ Ajouter"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">Aucune vidéo.</p>}
    </>
  );
}

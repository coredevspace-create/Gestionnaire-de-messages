import { redirect } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import Link from "next/link";
import { MusicAdmin } from "@/components/MusicAdmin";
import { PregenAdmin } from "@/components/PregenAdmin";
import { costOf, parseMetrics } from "@/lib/metrics";
import { fmtDuration, wallTime } from "@/components/MetricsView";
import { adminGrantCredits } from "../actions";

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  const users = await sql<{ id: number; email: string; credits: number; monetized: boolean; country: string; created_at: Date; plan: string | null }>(
    "SELECT id, email, credits + sub_credits AS credits, monetized, country, created_at, plan FROM users ORDER BY id DESC LIMIT 200",
  );
  const stats = await sql<{ status: string; n: number }>("SELECT status, COUNT(*)::int AS n FROM videos GROUP BY status");
  const recent = await sql<{ id: number; format: string; seconds: number; credits_cost: number; status: string; mock: boolean; metrics_json: string | null; email: string }>(
    `SELECT v.id, v.format, v.seconds, v.credits_cost, v.status, v.mock, v.metrics_json, u.email
     FROM videos v JOIN users u ON u.id = v.user_id ORDER BY v.id DESC LIMIT 30`,
  );
  const rows = recent.map((v) => {
    const m = parseMetrics(v.metrics_json);
    return { ...v, cost: costOf(m).total, wall: wallTime(m), sheets: m.sheets };
  });
  const real = rows.filter((r) => r.status === "done" && !r.mock);
  const avg = (f: (r: (typeof rows)[number]) => number) => (real.length ? real.reduce((a, r) => a + f(r), 0) / real.length : 0);

  return (
    <div className="stack">
      <h1>Admin</h1>
      <section className="card stack">
        <strong>Coût et temps des vidéos réelles terminées ({real.length})</strong>
        <span>
          Coût moyen : {avg((r) => r.cost).toFixed(2)} $ · par seconde de vidéo : {avg((r) => r.cost / r.seconds).toFixed(3)} $ ·
          temps moyen : {fmtDuration(avg((r) => r.wall ?? 0))}
        </span>
        <table>
          <thead>
            <tr><th>Vidéo</th><th>Utilisateur</th><th>Format</th><th>Statut</th><th>Coût</th><th>$/crédit</th><th>Temps</th><th>Portraits créés</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/videos/${r.id}`}>#{r.id}</Link>{r.mock ? " (simu)" : ""}</td>
                <td>{r.email}</td>
                <td>{r.seconds} s</td>
                <td>{r.status}</td>
                <td>{r.cost.toFixed(2)} $</td>
                <td>{(r.cost / r.credits_cost).toFixed(3)}</td>
                <td>{r.wall ? fmtDuration(r.wall) : "—"}</td>
                <td>{r.sheets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="muted">Vidéos : {stats.map((s) => `${s.status} ${s.n}`).join(" · ") || "aucune"}</p>
      <PregenAdmin />
      <MusicAdmin />
      <form action={adminGrantCredits} className="row card">
        <input name="email" type="email" placeholder="email" required />
        <input name="amount" type="number" placeholder="crédits (+/-)" required />
        <button>Ajouter</button>
      </form>
      <table>
        <thead><tr><th>Email</th><th>Crédits</th><th>Offre</th><th>Monétisé</th><th>Pays</th><th>Inscrit</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.email}</td><td>{u.credits}</td><td>{u.plan ?? "—"}</td><td>{u.monetized ? "oui" : "non"}</td><td>{u.country}</td><td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

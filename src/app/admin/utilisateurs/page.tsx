import { sql } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";
import { Flag } from "@/components/Flag";
import { adminGrantCredits } from "@/app/actions";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = ((await searchParams).q ?? "").trim().toLowerCase();
  const users = await sql<{ id: number; email: string; credits: number; sub_credits: number; monetized: boolean; country: string; created_at: Date; plan: string | null; videos: number }>(
    `SELECT u.id, u.email, u.credits, u.sub_credits, u.monetized, u.country, u.created_at, u.plan,
            (SELECT COUNT(*)::int FROM videos v WHERE v.user_id = u.id AND v.status = 'done') AS videos
     FROM users u WHERE ($1 = '' OR u.email LIKE '%' || $1 || '%') ORDER BY u.id DESC LIMIT 200`,
    [q],
  );
  return (
    <>
      <h1>Utilisateurs</h1>
      <form className="row" action="/admin/utilisateurs">
        <input name="q" defaultValue={q} placeholder="Rechercher un email…" style={{ flex: "1 1 260px" }} />
        <button className="secondary">Rechercher</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Email</th><th>Crédits</th><th>Offre</th><th>Vidéos</th><th>Univers</th><th>Inscrit</th><th>Ajouter / retirer</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}{u.monetized ? " 💰" : ""}</td>
                <td><b>{u.credits + u.sub_credits}</b>{u.sub_credits ? <span className="muted"> ({u.sub_credits} abo)</span> : null}</td>
                <td>{u.plan ? PLANS[u.plan as PlanId]?.name ?? u.plan : "—"}</td>
                <td>{u.videos}</td>
                <td><Flag id={u.country} size={13} /></td>
                <td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                <td>
                  <form action={adminGrantCredits} className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                    <input type="hidden" name="email" value={u.email} />
                    <input name="amount" type="number" placeholder="+/-" required style={{ width: 80, padding: "6px 8px" }} />
                    <button className="btn-sm">OK</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!users.length && <p className="muted">Aucun utilisateur trouvé.</p>}
    </>
  );
}

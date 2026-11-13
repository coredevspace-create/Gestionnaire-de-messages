import { redirect } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { adminGrantCredits } from "../actions";

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  const users = await sql<{ id: number; email: string; credits: number; monetized: boolean; country: string; created_at: Date }>(
    "SELECT id, email, credits, monetized, country, created_at FROM users ORDER BY id DESC LIMIT 200",
  );
  const stats = await sql<{ status: string; n: number }>("SELECT status, COUNT(*)::int AS n FROM videos GROUP BY status");
  return (
    <div className="stack">
      <h1>Admin</h1>
      <p className="muted">Vidéos : {stats.map((s) => `${s.status} ${s.n}`).join(" · ") || "aucune"}</p>
      <form action={adminGrantCredits} className="row card">
        <input name="email" type="email" placeholder="email" required />
        <input name="amount" type="number" placeholder="crédits (+/-)" required />
        <button>Ajouter</button>
      </form>
      <table>
        <thead><tr><th>Email</th><th>Crédits</th><th>Monétisé</th><th>Pays</th><th>Inscrit</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.email}</td><td>{u.credits}</td><td>{u.monetized ? "oui" : "non"}</td><td>{u.country}</td><td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

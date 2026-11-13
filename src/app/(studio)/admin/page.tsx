import Link from "next/link";
import { one, sql } from "@/lib/db";
import { costOf, parseMetrics } from "@/lib/metrics";
import { euros, PLANS, planPrice, type PlanId } from "@/lib/plans";
import { pregenOrder } from "@/lib/pregen";
import { stripeEnabled } from "@/lib/stripe";
import { isMock } from "@/lib/config";
import { fmtDuration, wallTime } from "@/components/MetricsView";

export default async function AdminDashboard() {
  const u = (await one<{ n: number; n7: number; mon: number }>(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int n7,
            COUNT(*) FILTER (WHERE monetized)::int mon FROM users`,
  ))!;
  const subs = await sql<{ plan: PlanId; plan_interval: "month" | "year"; n: number }>(
    "SELECT plan, plan_interval, COUNT(*)::int n FROM users WHERE plan IS NOT NULL GROUP BY 1, 2",
  );
  const mrrCents = subs.reduce(
    (a, s) => a + (s.plan in PLANS ? (s.plan_interval === "year" ? planPrice(s.plan, "year") / 12 : PLANS[s.plan].monthly) * s.n : 0),
    0,
  );
  const status = await sql<{ status: string; n: number }>("SELECT status, COUNT(*)::int n FROM videos GROUP BY status");
  const st = (k: string) => status.find((s) => s.status === k)?.n ?? 0;
  const last30 = await sql<{ metrics_json: string | null; seconds: number }>(
    "SELECT metrics_json, seconds FROM videos WHERE status = 'done' AND NOT mock AND created_at > now() - interval '30 days'",
  );
  const costs = last30.map((v) => ({ cost: costOf(parseMetrics(v.metrics_json)).total, wall: wallTime(parseMetrics(v.metrics_json)), s: v.seconds }));
  const cost30 = costs.reduce((a, c) => a + c.cost, 0);
  const avgWall = costs.filter((c) => c.wall).reduce((a, c, _, arr) => a + (c.wall ?? 0) / arr.length, 0);
  const portraits = (await one<{ n: number }>("SELECT COUNT(*)::int n FROM characters WHERE sheet_path LIKE '%portrait-v2%'"))!.n;
  const music = (await one<{ n: number }>("SELECT COUNT(*)::int n FROM music_tracks"))!.n;
  const vitrine = (await one<{ n: number }>("SELECT COUNT(*)::int n FROM videos WHERE showcase"))!.n;
  const margin = mrrCents / 100 - cost30 * 0.93;

  return (
    <>
      <h1>Tableau de bord</h1>
      <p className="muted" style={{ margin: 0 }}>
        {isMock() ? "⚠️ Mode simulation actif (clés IA absentes). " : ""}
        {stripeEnabled() ? "" : "⚠️ Stripe non configuré. "}
        Coûts IA en dollars (estimations), revenus en euros.
      </p>

      <h2 style={{ marginTop: 10 }}>Business</h2>
      <div className="kpis">
        <div className="kpi"><span>Revenu mensuel récurrent</span><b>{euros(Math.round(mrrCents))}</b><small>abonnements actifs</small></div>
        <div className="kpi"><span>Coût IA (30 jours)</span><b>{cost30.toFixed(2)} $</b><small>{costs.length} vidéos réelles</small></div>
        <div className={`kpi ${margin >= 0 ? "good" : "bad"}`}><span>Marge estimée / mois</span><b>{euros(Math.round(margin * 100))}</b><small>revenu − coût IA (hors frais)</small></div>
        <div className="kpi"><span>Abonnés</span><b>{subs.reduce((a, s) => a + s.n, 0)}</b><small>{subs.map((s) => `${PLANS[s.plan]?.name ?? s.plan} ${s.plan_interval === "year" ? "an" : "mois"} ×${s.n}`).join(" · ") || "aucun"}</small></div>
      </div>

      <h2 style={{ marginTop: 10 }}>Utilisateurs & vidéos</h2>
      <div className="kpis">
        <div className="kpi"><span>Utilisateurs</span><b>{u.n}</b><small>+{u.n7} cette semaine · {u.mon} monétisés</small></div>
        <div className="kpi"><span>Vidéos terminées</span><b>{st("done")}</b><small>{st("running") + st("queued")} en cours · {st("failed")} échecs</small></div>
        <div className="kpi"><span>Coût moyen / vidéo</span><b>{costs.length ? (cost30 / costs.length).toFixed(2) : "—"} $</b><small>temps moyen {avgWall ? fmtDuration(avgWall) : "—"}</small></div>
        <div className="kpi"><span>Contenu</span><b>{portraits}</b><small>portraits / {pregenOrder().length} · {music} musiques · {vitrine} en vitrine</small></div>
      </div>

      <h2 style={{ marginTop: 10 }}>Raccourcis</h2>
      <div className="row">
        <Link className="btn btn-ghost" href="/admin/vitrine">⭐ Choisir les vidéos de l&apos;accueil</Link>
        <Link className="btn btn-ghost" href="/admin/utilisateurs">👥 Donner des crédits</Link>
        <Link className="btn btn-ghost" href="/admin/personnages">🍊 Créer des personnages</Link>
        <Link className="btn btn-ghost" href="/admin/musiques">🎵 Ajouter des musiques</Link>
        <Link className="btn btn-ghost" href="/admin/videos?statut=failed">⚠️ Voir les échecs</Link>
      </div>
    </>
  );
}

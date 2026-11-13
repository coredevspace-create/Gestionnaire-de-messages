import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mediaUrl } from "@/lib/storage";
import { Icon } from "@/components/Icon";

const LABEL: Record<string, string> = { queued: "En attente", running: "En cours…", done: "Prête", failed: "Échec" };

export default async function CreationsPage() {
  const user = await requireUser();
  const rows = await sql<{ id: number; episode: number; status: string; script_json: string | null; seconds: number; title: string; episodes_total: number; created_at: Date }>(
    `SELECT v.id, v.episode, v.status, v.script_json, v.seconds, v.created_at, s.title, s.episodes_total
     FROM videos v JOIN series s ON s.id = v.series_id WHERE v.user_id = $1 ORDER BY v.id DESC`,
    [user.id],
  );

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="ws-head">
        <div>
          <span className="eyebrow">Bibliothèque</span>
          <h1>Mes vidéos</h1>
          <p>{rows.length ? `${rows.length} vidéo${rows.length > 1 ? "s" : ""}` : "Tes vidéos apparaîtront ici."}</p>
        </div>
        <Link href="/creer" className="btn btn-accent">
          <Icon name="plus" size={16} /> Nouvelle vidéo
        </Link>
      </div>

      {!rows.length ? (
        <div className="empty">
          <Icon name="film" size={28} />
          <b>Aucune vidéo pour l&apos;instant</b>
          <span className="muted">Choisis une histoire et lance ton premier tournage.</span>
          <Link href="/creer" className="btn btn-accent">Créer ma première vidéo</Link>
        </div>
      ) : (
        <div className="lib-grid">
          {rows.map((v) => {
            let img: string | null = null;
            try {
              img = mediaUrl(JSON.parse(v.script_json ?? "{}").scenes?.[0]?.imagePath);
            } catch {}
            return (
              <Link key={v.id} href={`/videos/${v.id}`} className="lib-item">
                <div className="lib-thumb">
                  {img ? <img src={img} alt="" loading="lazy" /> : v.status === "failed" ? <Icon name="refresh" size={22} /> : <div className="spinner" />}
                  {v.status !== "done" && <span className={`badge ${v.status}`}>{LABEL[v.status]}</span>}
                  {v.status === "done" && <span className="play"><Icon name="play" size={34} /></span>}
                </div>
                <b>{v.title}</b>
                <span>
                  Partie {v.episode}{v.episodes_total > 1 ? `/${v.episodes_total}` : ""} · {v.seconds} s ·{" "}
                  {new Date(v.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

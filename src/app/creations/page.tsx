import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql, type Series, type Video } from "@/lib/db";
import { getCountry } from "@/lib/catalog/countries";

const STATUS: Record<string, string> = { queued: "⏳ en attente", running: "⚙️ en cours", done: "✅ prête", failed: "❌ échec" };

export default async function CreationsPage() {
  const user = await requireUser();
  const series = await sql<Series>("SELECT * FROM series WHERE user_id = $1 ORDER BY id DESC", [user.id]);
  const videos = await sql<Video>("SELECT * FROM videos WHERE user_id = $1 ORDER BY episode, id", [user.id]);

  if (!series.length) return <p>Aucune création pour l&apos;instant. <Link className="link" href="/creer">Crée ta première vidéo</Link>.</p>;

  return (
    <div className="stack">
      <h1>Mes créations</h1>
      {series.map((s) => (
        <div key={s.id} id={`serie-${s.id}`} className="card stack">
          <strong>
            {getCountry(s.country).flag} {s.title}
          </strong>
          <span className="muted">{s.episodes_total} épisode(s)</span>
          <ul>
            {videos
              .filter((v) => v.series_id === s.id)
              .map((v) => (
                <li key={v.id}>
                  <Link href={`/videos/${v.id}`}>Épisode {v.episode}</Link> — {STATUS[v.status]}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

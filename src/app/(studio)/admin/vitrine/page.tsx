import { sql } from "@/lib/db";
import { mediaUrl } from "@/lib/storage";
import { adminToggleShowcase } from "@/app/actions";

export default async function AdminVitrine() {
  const rows = await sql<{ id: number; output_path: string; script_json: string | null; showcase: boolean; title: string; episode: number }>(
    `SELECT v.id, v.output_path, v.script_json, v.showcase, v.episode, s.title
     FROM videos v JOIN series s ON s.id = v.series_id
     WHERE v.status = 'done' AND v.output_path IS NOT NULL ORDER BY v.showcase DESC, v.id DESC LIMIT 60`,
  );
  const on = rows.filter((r) => r.showcase).length;
  return (
    <>
      <h1>Vitrine de la page d&apos;accueil</h1>
      <p className="muted" style={{ margin: 0 }}>
        {on} vidéo(s) en vitrine. La plus récente passe dans le téléphone du haut, les 8 premières remplissent « Exemples ».
        Choisis tes meilleures réussites.
      </p>
      <div className="vit-grid">
        {rows.map((r) => {
          let poster: string | undefined;
          try {
            poster = mediaUrl(JSON.parse(r.script_json ?? "{}").scenes?.[0]?.imagePath) ?? undefined;
          } catch {}
          return (
            <div key={r.id} className={`vit${r.showcase ? " on" : ""}`}>
              <video src={mediaUrl(r.output_path)!} poster={poster} controls preload="none" playsInline />
              <div>
                <b>{r.title} · ép. {r.episode}</b>
                <form action={adminToggleShowcase}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={r.showcase ? "btn-sm" : "secondary btn-sm"}>{r.showcase ? "★ En vitrine — retirer" : "☆ Mettre en vitrine"}</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
      {!rows.length && <p className="muted">Aucune vidéo terminée pour l&apos;instant.</p>}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { parseMetrics } from "@/lib/metrics";
import { MetricsView } from "@/components/MetricsView";
import { one, type Series, type Video } from "@/lib/db";
import { FORMATS, type FormatId } from "@/lib/config";
import { mediaUrl } from "@/lib/storage";
import type { Script } from "@/lib/ai/script";
import { ActionForm, AutoRefresh, Submit } from "@/components/forms";
import { GenerationProgress } from "@/components/GenerationProgress";
import { adminToggleShowcase, nextEpisode, retry } from "@/app/actions";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const video = await one<Video>("SELECT * FROM videos WHERE id = $1 AND user_id = $2", [Number(id) || 0, user.id]);
  if (!video) notFound();
  const series = (await one<Series>("SELECT * FROM series WHERE id = $1", [video.series_id]))!;
  const script: Script | null = video.script_json ? JSON.parse(video.script_json) : null;
  const active = video.status === "queued" || video.status === "running";
  const doneCount = (await one<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM videos WHERE series_id = $1 AND status != 'failed'",
    [series.id],
  ))!.n;
  const canNext = video.status === "done" && doneCount < series.episodes_total;

  return (
    <div className="stack">
      <AutoRefresh active={active} tickUrl={`/api/videos/${video.id}/tick`} />
      <p className="muted">
        <Link href={`/creations#serie-${series.id}`}>{series.title}</Link> · épisode {video.episode}/{series.episodes_total} ·{" "}
        {FORMATS[video.format as FormatId]?.label}
        {video.mock ? " · simulation" : ""}
      </p>
      <h1>{script?.title ?? series.title}</h1>

      {active && (() => {
        const p = progressOf(video.step, script);
        return (
          <GenerationProgress
            stage={p.stage}
            percent={p.percent}
            step={video.step}
            startedAt={new Date(video.created_at).toISOString()}
            queued={video.status === "queued"}
          />
        );
      })()}

      {video.status === "failed" && (
        <div className="card stack">
          <p className="error">La génération a échoué. Tes crédits ont été remboursés.</p>
          <code className="muted">{video.error}</code>
          <ActionForm action={retry}>
            <input type="hidden" name="videoId" value={video.id} />
            <Submit>Relancer ({video.credits_cost} crédits)</Submit>
          </ActionForm>
        </div>
      )}

      {video.status === "done" && video.output_path && (
        <div className="row" style={{ alignItems: "flex-start" }}>
          <video src={mediaUrl(video.output_path)!} controls style={{ width: 320 }} />
          <div className="stack">
            <a href={mediaUrl(video.output_path)!} download={`episode-${video.episode}.mp4`}>
              ⬇️ Télécharger la vidéo
            </a>
            {isAdmin(user) && (
              <form action={adminToggleShowcase}>
                <input type="hidden" name="id" value={video.id} />
                <button className="secondary btn-sm">
                  {(video as Video & { showcase?: boolean }).showcase ? "★ En vitrine (retirer)" : "☆ Mettre en vitrine sur l'accueil"}
                </button>
              </form>
            )}
            {canNext && (
              <ActionForm action={nextEpisode}>
                <input type="hidden" name="seriesId" value={series.id} />
                <Submit>Épisode suivant ({FORMATS[series.format as FormatId]?.credits} crédits)</Submit>
              </ActionForm>
            )}
          </div>
        </div>
      )}

      {isAdmin(user) && video.metrics_json && (
        <MetricsView m={parseMetrics(video.metrics_json)} seconds={video.seconds} credits={video.credits_cost} />
      )}

      {script && (
        <>
          <h2>Plans</h2>
          <div className="grid">
            {script.scenes.map((s, i) => (
              <div key={i} className="card stack">
                <strong>Plan {i + 1}</strong>
                {s.imagePath && <img className="preview" src={mediaUrl(s.imagePath)!} alt={`Plan ${i + 1}`} />}
                {s.lines.map((l, j) => (
                  <div key={j}>
                    <b>{l.speaker} :</b> {l.text}
                  </div>
                ))}
                <span className="muted">{s.clipPath ? "✅ animé" : "…"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Étape (0-4) et pourcentage estimés à partir de l'état de la génération. */
function progressOf(step: string | null, script: Script | null): { stage: number; percent: number } {
  const s = (step ?? "").toLowerCase();
  const n = script?.scenes.length || 1;
  const images = script?.scenes.filter((x) => x.imagePath).length ?? 0;
  const clips = script?.scenes.filter((x) => x.clipPath).length ?? 0;
  if (s.includes("montage") || clips === n) return { stage: 4, percent: 92 };
  if (s.includes("animation") || s.includes("envoi") || images === n) return { stage: 3, percent: 45 + (clips / n) * 45 };
  if (s.includes("image") || script) return { stage: 2, percent: 20 + (images / n) * 25 };
  if (s.includes("scénario") || s.includes("plan de la saison")) return { stage: 1, percent: 12 };
  return { stage: 0, percent: 5 };
}

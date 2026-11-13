import "./video.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth";
import { parseMetrics } from "@/lib/metrics";
import { MetricsView } from "@/components/MetricsView";
import { one, type Series, type Video } from "@/lib/db";
import { FORMATS, type FormatId } from "@/lib/config";
import { mediaDownloadUrl, mediaUrl } from "@/lib/storage";
import type { Script } from "@/lib/ai/script";
import { ActionForm, AutoRefresh, Submit } from "@/components/forms";
import { GenerationProgress } from "@/components/GenerationProgress";
import { CopyCaption, DownloadButton } from "@/components/DownloadButton";
import { Icon } from "@/components/Icon";
import { Thumb } from "@/components/Thumb";
import { adminToggleShowcase, nextEpisode, retry } from "@/app/actions";

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

/** Description TikTok prête à coller : accroche, titre, appel à la suite, hashtags. */
function captionFor(title: string, episode: number, total: number, script: Script | null) {
  const hook = script?.scenes?.[0]?.lines?.[0]?.text;
  const parts = [
    hook ? `« ${hook} »` : null,
    `${title} — Partie ${episode}${total > 1 ? `/${total}` : ""}`,
    episode < total ? `👉 Abonne-toi pour la partie ${episode + 1}` : "Tu aurais fait quoi à sa place ? 👇",
    `#histoire #serie #fruits #ia #partie${episode} #pourtoi #fyp`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const video = await one<Video & { showcase?: boolean }>("SELECT * FROM videos WHERE id = $1 AND user_id = $2", [Number(id) || 0, user.id]);
  if (!video) notFound();
  const series = (await one<Series>("SELECT * FROM series WHERE id = $1", [video.series_id]))!;
  const script: Script | null = video.script_json ? JSON.parse(video.script_json) : null;
  const active = video.status === "queued" || video.status === "running";
  const doneCount = (await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM videos WHERE series_id = $1 AND status != 'failed'", [series.id]))!.n;
  const canNext = video.status === "done" && doneCount < series.episodes_total;
  const fmt = FORMATS[video.format as FormatId];
  const title = script?.title ?? series.title;
  const src = mediaUrl(video.output_path);
  const poster = mediaUrl(script?.scenes?.[0]?.imagePath);

  return (
    <div className="vp">
      <AutoRefresh active={active} tickUrl={`/api/videos/${video.id}/tick`} />

      <nav className="vp-crumbs">
        <Link href="/creations">Mes vidéos</Link>
        <span>/</span>
        <span>{series.title}</span>
      </nav>

      {active &&
        (() => {
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
        <div className="panel vp-failed">
          <h2>La génération n&apos;a pas abouti</h2>
          <p className="muted">Tes crédits ont été remboursés automatiquement. Tu peux relancer, ça marche le plus souvent au second essai.</p>
          {video.error && <code>{video.error.slice(0, 240)}</code>}
          <ActionForm action={retry}>
            <input type="hidden" name="videoId" value={video.id} />
            <Submit className="btn-accent">Relancer · {video.credits_cost} crédits</Submit>
          </ActionForm>
        </div>
      )}

      {video.status === "done" && src && (
        <div className="vp-main">
          <div className="vp-player">
            <video src={src} poster={poster ?? undefined} controls playsInline preload="metadata" />
          </div>

          <div className="vp-side">
            <span className="vp-ready"><Icon name="check" size={14} /> Prête à publier</span>
            <h1>{title}</h1>
            <div className="vp-meta">
              <span>Partie {video.episode}{series.episodes_total > 1 ? ` / ${series.episodes_total}` : ""}</span>
              <span>{fmt?.seconds ?? video.seconds} s · 9:16</span>
              <span>{new Date(video.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
            </div>

            <DownloadButton src={src} downloadUrl={mediaDownloadUrl(video.output_path)!} filename={`${slug(series.title)}-partie-${video.episode}.mp4`} />

            <div className="vp-actions">
              <CopyCaption text={captionFor(series.title, video.episode, series.episodes_total, script)} />
              {canNext && (
                <ActionForm action={nextEpisode}>
                  <input type="hidden" name="seriesId" value={series.id} />
                  <Submit className="secondary">
                    <Icon name="next" size={15} /> Partie {video.episode + 1} · {fmt?.credits} cr.
                  </Submit>
                </ActionForm>
              )}
              <Link href="/creer" className="btn secondary">
                <Icon name="plus" size={15} /> Nouvelle vidéo
              </Link>
            </div>

            <div className="vp-caption">
              <span className="eyebrow">Description suggérée</span>
              <p>{captionFor(series.title, video.episode, series.episodes_total, script)}</p>
            </div>

            <div className="vp-tips">
              <span className="eyebrow">Pour plus de vues</span>
              <ul>
                <li>Publie entre 12 h et 14 h ou entre 19 h et 22 h.</li>
                <li>Épingle un commentaire « Partie 2 ? » pour faire réagir.</li>
                {series.episodes_total > 1 && <li>Poste la partie suivante dans les 24 heures.</li>}
              </ul>
            </div>

            {isAdmin(user) && (
              <form action={adminToggleShowcase} className="vp-admin">
                <input type="hidden" name="id" value={video.id} />
                <button className="secondary btn-sm">
                  <Icon name="star" size={14} /> {video.showcase ? "En vitrine — retirer" : "Mettre en vitrine sur l'accueil"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {script && (
        <section className="vp-plans">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Plans</h2>
            <span className="muted">{script.scenes.length} plans</span>
          </div>
          <div className="vp-strip">
            {script.scenes.map((s, i) => (
              <div key={i} className="vp-shot">
                <div className="thumb">
                  {s.imagePath ? <Thumb src={mediaUrl(s.imagePath)!} alt={`Plan ${i + 1}`} /> : <div className="spinner" />}
                  <span className="n">{i + 1}</span>
                  {s.clipPath && <span className="ok"><Icon name="check" size={12} /></span>}
                </div>
                {s.lines.map((l, j) => (
                  <p key={j}>
                    <b>{l.speaker.replace(/\s*\(pens[ée]e\)/i, "")}</b> {l.text}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin(user) && video.metrics_json && (
        <MetricsView m={parseMetrics(video.metrics_json)} seconds={video.seconds} credits={video.credits_cost} />
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

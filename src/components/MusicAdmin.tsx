import { MOODS, listTracks } from "@/lib/music";
import { mediaUrl } from "@/lib/storage";
import { adminDeleteMusic, adminSetMusicMood } from "@/app/actions";
import { MusicUploader } from "./music/MusicUploader";
import { MiniPlayer } from "./music/MiniPlayer";
import "./music/music.css";

const COLORS: Record<string, string> = {
  suspense: "#c64dff",
  drame: "#ff3d6b",
  emotion: "#4db8ff",
  action: "#ff6a2b",
  comedie: "#ffcf3f",
  triomphe: "#3ee6b0",
};

/** Bibliothèque de musiques de fond (admin). */
export async function MusicAdmin() {
  const tracks = await listTracks();
  const moods = Object.entries(MOODS).map(([id, label]) => ({ id, label, color: COLORS[id] ?? "#ff6a2b" }));
  return (
    <div className="mu">
      <MusicUploader moods={moods} />

      <div className="mu-summary">
        {moods.map((m) => {
          const n = tracks.filter((t) => t.mood === m.id).length;
          return (
            <a key={m.id} href={`#mood-${m.id}`} className={`mu-chip${n ? "" : " empty"}`} style={{ ["--c" as string]: m.color }}>
              <i />
              {m.label}
              <b>{n}</b>
            </a>
          );
        })}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Mets 2 ou 3 musiques libres de droits par ambiance (ex. Pixabay Music). Le scénario choisit l&apos;ambiance ; sans musique
        dans celle-ci, une autre est utilisée.
      </p>

      <div className="mu-groups">
        {moods.map((m) => {
          const list = tracks.filter((t) => t.mood === m.id);
          return (
            <section key={m.id} id={`mood-${m.id}`} className="mu-group" style={{ ["--c" as string]: m.color }}>
              <header>
                <i />
                <h3>{m.label}</h3>
                <span className="muted">{list.length || "vide"}</span>
              </header>
              {list.length === 0 ? (
                <p className="mu-empty">Aucune musique. Ajoute-en une au-dessus.</p>
              ) : (
                list.map((t) => (
                  <div key={t.id} className="mu-track">
                    <MiniPlayer src={mediaUrl(t.path)!} title={t.title} />
                    <form action={adminSetMusicMood} className="mu-move">
                      <input type="hidden" name="id" value={t.id} />
                      <select name="mood" defaultValue={t.mood} aria-label="Changer d'ambiance">
                        {moods.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                      <button className="secondary btn-sm">Déplacer</button>
                    </form>
                    <form action={adminDeleteMusic}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="icon-btn mu-del" aria-label="Supprimer" title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" /></svg>
                      </button>
                    </form>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

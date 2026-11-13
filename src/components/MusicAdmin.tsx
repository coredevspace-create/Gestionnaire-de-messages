import { MOODS, listTracks } from "@/lib/music";
import { mediaUrl } from "@/lib/storage";
import { ActionForm, Submit } from "@/components/forms";
import { adminDeleteMusic, adminUploadMusic } from "@/app/actions";

/** Gestion de la bibliothèque de musiques de fond (admin). */
export async function MusicAdmin() {
  const tracks = await listTracks();
  return (
    <section className="card stack">
      <strong>Musiques de fond ({tracks.length})</strong>
      <span className="muted">
        Ajoute 2 ou 3 musiques par ambiance, libres de droits pour un usage commercial (ex. Pixabay Music, FreePD,
        YouTube Audio Library « sans attribution »). MP3, 4 Mo max. Sans musique dans une ambiance, une autre est utilisée.
      </span>
      <ActionForm action={adminUploadMusic} className="row">
        <input type="file" name="file" accept="audio/*" required />
        <select name="mood" defaultValue="suspense">
          {Object.entries(MOODS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input name="title" placeholder="Titre (optionnel)" />
        <Submit>Ajouter</Submit>
      </ActionForm>
      {Object.entries(MOODS).map(([id, label]) => {
        const list = tracks.filter((t) => t.mood === id);
        return (
          <div key={id} className="stack">
            <b>
              {label} ({list.length})
            </b>
            {list.map((t) => (
              <div key={t.id} className="row">
                <span>{t.title}</span>
                <audio src={mediaUrl(t.path)!} controls preload="none" />
                <form action={adminDeleteMusic}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="secondary">Supprimer</button>
                </form>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

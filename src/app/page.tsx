import { requireUser } from "@/lib/auth";
import { defaultFormat, EPISODE_CHOICES, FORMATS } from "@/lib/config";
import { COUNTRIES, getCountry } from "@/lib/catalog/countries";
import { storiesFor, storyOfTheDay, WORLD_STORIES, type Story } from "@/lib/catalog/stories";
import { ActionForm, Submit } from "@/components/forms";
import { createVideo } from "./actions";

/**
 * Écran de création unique :
 * - 1 clic sur une histoire = 1 vidéo (réglages tirés du profil)
 * - ou une idée libre en une phrase
 * - options avancées repliées
 */
export default async function HomePage() {
  const user = await requireUser();
  const country = getCountry(user.country);
  const fmt = defaultFormat(!!user.monetized);
  const daily = storyOfTheDay(user.country);
  const stories = storiesFor(user.country);
  const world = user.country === "monde" ? [] : WORLD_STORIES;

  return (
    <ActionForm action={createVideo} className="stack">
      <h1>Créer une vidéo</h1>
      <p className="muted">
        {country.flag} {country.name} · {FORMATS[fmt].label} ({FORMATS[fmt].credits} crédits) — réglé depuis ton profil.
      </p>

      <section className="card stack">
        <strong>Ton idée en une phrase</strong>
        <textarea name="pitch" rows={2} maxLength={500} placeholder="Ex : Le papa ramène une deuxième femme et la maman prépare sa vengeance…" />
        <div>
          <Submit>Générer</Submit>
        </div>
      </section>

      <details className="card">
        <summary>Options avancées</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <label className="row">
            Format
            <select name="format" defaultValue={fmt}>
              {Object.entries(FORMATS).map(([id, f]) => (
                <option key={id} value={id}>
                  {f.label} — {f.credits} crédits
                </option>
              ))}
            </select>
          </label>
          {!user.monetized && (
            <p className="warn">
              Ton compte n&apos;est pas encore monétisé : on te conseille les vidéos courtes pour grandir. Le format long
              reste disponible.
            </p>
          )}
          <label className="row">
            Épisodes
            <select name="episodes" defaultValue="1">
              {EPISODE_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Épisode unique" : `${n} parties (tu crées chaque partie quand tu veux)`}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <input type="checkbox" name="music" defaultChecked /> Musique de fond (décoche si tu ajoutes un son tendance
            directement sur TikTok)
          </label>
          <label className="row">
            Pays
            <select name="country" defaultValue={user.country}>
              {COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <section className="card stack">
        <span className="tag">Série du jour</span>
        <h2 style={{ margin: 0 }}>{daily.title}</h2>
        <em>{daily.hook}</em>
        <div>
          <Submit name="storyId" value={daily.id}>
            Générer cette histoire
          </Submit>
        </div>
      </section>

      <h2>
        {country.flag} Histoires {country.id === "monde" ? "Monde" : `· ${country.name}`}
      </h2>
      <StoryGrid stories={stories} />
      {world.length > 0 && (
        <>
          <h2>🌍 Histoires Monde</h2>
          <p className="muted">Décors de cinéma, personnages-fruits variés, français de tous les jours.</p>
          <StoryGrid stories={world} />
        </>
      )}
    </ActionForm>
  );
}

function StoryGrid({ stories }: { stories: Story[] }) {
  return (
    <div className="grid">
      {stories.map((s) => (
        <div key={s.id} className="card stack">
          <div>
            {s.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
            <span className="tag">{s.theme}</span>
          </div>
          <strong>{s.title}</strong>
          <em className="muted">{s.hook}</em>
          <div>
            <Submit name="storyId" value={s.id}>
              Générer
            </Submit>
          </div>
        </div>
      ))}
    </div>
  );
}

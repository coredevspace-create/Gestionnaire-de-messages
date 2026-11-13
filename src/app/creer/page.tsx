import { requireUser } from "@/lib/auth";
import { defaultFormat, EPISODE_CHOICES, FORMATS } from "@/lib/config";
import { COUNTRIES, getCountry } from "@/lib/catalog/countries";
import { storiesFor, storyOfTheDay, WORLD_STORIES, type Story } from "@/lib/catalog/stories";
import { ROLES } from "@/lib/catalog/characters";
import { FRUIT_EMOJI } from "@/lib/showcase";
import { ActionForm, Submit } from "@/components/forms";
import { createVideo } from "../actions";

function emojiOf(s: Story) {
  const fruits = s.castSpec?.length ? s.castSpec.map((c) => c.fruit) : s.cast.map((r) => ROLES[r]?.fruit);
  return fruits
    .slice(0, 3)
    .map((f) => FRUIT_EMOJI[f] ?? "🍊")
    .join("");
}

/**
 * Écran de création unique :
 * - 1 clic sur une histoire = 1 vidéo (réglages tirés du profil)
 * - ou une idée libre en une phrase
 * - options avancées repliées
 */
export default async function CreatePage() {
  const user = await requireUser();
  const country = getCountry(user.country);
  const fmt = defaultFormat(!!user.monetized);
  const daily = storyOfTheDay(user.country);
  const stories = storiesFor(user.country);
  const world = user.country === "monde" ? [] : WORLD_STORIES;

  return (
    <ActionForm action={createVideo} className="stack" >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "end" }}>
        <div>
          <span className="eyebrow">Studio</span>
          <h1 style={{ margin: "6px 0 0" }}>Qu&apos;est-ce qu&apos;on tourne aujourd&apos;hui ?</h1>
        </div>
        <span className="tag">
          {country.flag} {country.name} · {FORMATS[fmt].label} · {FORMATS[fmt].credits} crédits
        </span>
      </div>

      <section className="composer stack">
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>✍️ Ton idée en une phrase</strong>
        <textarea
          name="pitch"
          rows={2}
          maxLength={500}
          placeholder="Ex : Le livreur humilié par une cliente riche découvre qu'elle passe un entretien… dans SA société."
        />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">On écrit le scénario, les dialogues et on choisit les personnages pour toi.</span>
          <Submit>Générer ma vidéo →</Submit>
        </div>
      </section>

      <details className="card">
        <summary>⚙️ Options avancées</summary>
        <div className="grid" style={{ marginTop: 14 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted">Format</span>
            <select name="format" defaultValue={fmt}>
              {Object.entries(FORMATS).map(([id, f]) => (
                <option key={id} value={id}>
                  {f.label} — {f.credits} crédits
                </option>
              ))}
            </select>
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted">Épisodes</span>
            <select name="episodes" defaultValue="1">
              {EPISODE_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Épisode unique" : `${n} parties (une à la fois)`}
                </option>
              ))}
            </select>
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted">Univers</span>
            <select name="country" defaultValue={user.country}>
              {COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="row" style={{ alignSelf: "end" }}>
            <input type="checkbox" name="music" defaultChecked /> Musique de fond
          </label>
        </div>
        {!user.monetized && (
          <p className="warn" style={{ marginBottom: 0 }}>
            Ton compte n&apos;est pas encore monétisé : les vidéos courtes sont idéales pour grandir. Le format long reste
            disponible. Décoche la musique si tu ajoutes un son tendance sur TikTok.
          </p>
        )}
      </details>

      <section className="card highlight row" style={{ justifyContent: "space-between", padding: 22 }}>
        <div className="stack" style={{ gap: 6, flex: "1 1 320px" }}>
          <span className="eyebrow">🔥 Série du jour</span>
          <h2 style={{ margin: 0 }}>
            {emojiOf(daily)} {daily.title}
          </h2>
          <span className="muted">{daily.hook}</span>
        </div>
        <Submit name="storyId" value={daily.id}>
          Lancer cette série →
        </Submit>
      </section>

      <h2 style={{ marginTop: 18 }}>
        {country.flag} Histoires {country.id === "monde" ? "Monde" : `· ${country.name}`}
      </h2>
      <StoryGrid stories={stories} />
      {world.length > 0 && (
        <>
          <h2 style={{ marginTop: 18 }}>🌍 Histoires Monde</h2>
          <p className="muted" style={{ marginTop: -8 }}>
            Décors de cinéma, personnages-fruits variés, français de tous les jours.
          </p>
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
        <div key={s.id} className="card story-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="emoji">{emojiOf(s)}</span>
            <span>
              {s.tags.includes("viral") && <span className="tag hot">🔥 Viral</span>}
              {s.tags.includes("nouveau") && <span className="tag new">Nouveau</span>}
            </span>
          </div>
          <strong>{s.title}</strong>
          <em>{s.hook}</em>
          <span className="muted" style={{ fontSize: 12.5 }}>{s.theme}</span>
          <div className="actions">
            <Submit name="storyId" value={s.id} className="btn-sm">
              Générer
            </Submit>
          </div>
        </div>
      ))}
    </div>
  );
}

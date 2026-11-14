"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createVideo, type FormState } from "@/app/actions";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/Icon";

export type StudioStory = {
  id: string;
  title: string;
  hook: string;
  theme: string;
  viral: boolean;
  isNew: boolean;
  world: boolean;
  portraits: string[];
  emojis: string[];
};

type Props = {
  credits: number;
  monetized: boolean;
  /** Admin : accès au moteur expérimental « doublage » */
  admin?: boolean;
  defaultFormat: string;
  defaultCountry: string;
  dailyId: string;
  formats: { id: string; label: string; seconds: number; credits: number; kind: string }[];
  episodes: number[];
  countries: { id: string; label: string }[];
  tabs: { id: string; label: string; flag?: string; stories: StudioStory[] }[];
};

/** Teinte discrète et stable par histoire (pas de dégradés criards). */
function tint(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `radial-gradient(120% 100% at 50% 0%, hsl(${h % 360} 70% 34%), hsl(${(h + 40) % 360} 50% 12%) 75%)`;
}

function LaunchOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="launch-overlay" role="status" aria-live="polite">
      <div>
        <div className="spinner" style={{ margin: "0 auto", width: 40, height: 40 }} />
        <h2>Lancement du tournage…</h2>
        <p className="muted">On réserve tes crédits et on prépare les personnages.</p>
      </div>
    </div>
  );
}

function GenerateButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-accent btn-lg ed-go" disabled={disabled || pending}>
      {pending ? (
        <>
          <span className="spinner sm" /> Lancement…
        </>
      ) : (
        <>
          <Icon name="sparkle" size={16} /> {label}
        </>
      )}
    </button>
  );
}

function Visual({ s, big }: { s: StudioStory; big?: boolean }) {
  return (
    <div className={`ed-visual${big ? " big" : ""}`} style={{ background: tint(s.id) }}>
      {s.portraits.length ? (
        <div className={`ed-fan n${s.portraits.length}`}>
          {s.portraits.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" />
          ))}
        </div>
      ) : (
        <div className="ed-emojis">{s.emojis.join(" ")}</div>
      )}
    </div>
  );
}

export function Studio(p: Props) {
  const [state, action] = useActionState<FormState, FormData>(createVideo, undefined);
  const [tab, setTab] = useState(p.tabs[0].id);
  const [selected, setSelected] = useState<string | null>(p.dailyId);
  const [pitch, setPitch] = useState("");
  const [format, setFormat] = useState(p.defaultFormat);
  const [episodes, setEpisodes] = useState(1);
  const [country, setCountry] = useState(p.defaultCountry);
  const [music, setMusic] = useState(true);
  const [dub, setDub] = useState(false);

  const all = useMemo(() => new Map(p.tabs.flatMap((t) => t.stories).map((s) => [s.id, s])), [p.tabs]);
  const isIdea = tab === "idea";
  const story = !isIdea && selected ? all.get(selected) : undefined;
  const fmt = p.formats.find((f) => f.id === format)!;
  const ready = isIdea ? pitch.trim().length >= 10 : !!story;
  const enough = p.credits >= fmt.credits;
  const stories = p.tabs.find((t) => t.id === tab)?.stories ?? [];
  const showCountry = isIdea || (story && !story.world);

  return (
    <form action={action} className="ed">
      <LaunchOverlay />
      <input type="hidden" name="storyId" value={story?.id ?? ""} />
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="episodes" value={episodes} />
      {music && <input type="hidden" name="music" value="1" />}
      {dub && <input type="hidden" name="engine" value="dub" />}
      {showCountry && <input type="hidden" name="country" value={country} />}

      {/* ---------- Bibliothèque ---------- */}
      <section className="ed-lib">
        <div className="ws-head">
          <div>
            <span className="eyebrow">Nouvelle vidéo</span>
            <h1>Choisis une histoire</h1>
            <p>Une série qui marche déjà, ou ta propre idée.</p>
          </div>
        </div>

        <div className="ed-tabs" role="tablist">
          {p.tabs.map((t) => (
            <button key={t.id} type="button" role="tab" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.flag && <Flag id={t.flag} size={12} />}
              {t.label}
            </button>
          ))}
          <button type="button" role="tab" className={isIdea ? "on" : ""} onClick={() => setTab("idea")}>
            <Icon name="pen" size={14} /> Mon idée
          </button>
        </div>

        {isIdea ? (
          <div className="ed-idea panel">
            <label htmlFor="pitch">Raconte ton histoire en une ou deux phrases</label>
            <textarea
              id="pitch"
              name="pitch"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              maxLength={500}
              rows={5}
              autoFocus
              placeholder="Un livreur se fait humilier par une cliente riche… Le lendemain, elle passe un entretien dans sa société."
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">{pitch.length}/500</span>
              <span className="muted">Le scénario, les dialogues et les personnages sont créés pour toi.</span>
            </div>
            <div className="ed-sparks">
              <span className="eyebrow">Inspiration</span>
              {[
                "Le patron teste l'honnêteté de son employé le plus pauvre",
                "La belle-mère humilie sa belle-fille devant toute la famille",
                "Le vigile du supermarché est un ancien champion de boxe",
                "Une mendiante au mariage est la grand-mère milliardaire du marié",
              ].map((s) => (
                <button key={s} type="button" className="ed-spark" onClick={() => setPitch(s)}>
                  {s} <Icon name="arrow" size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ed-grid">
            {stories.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`ed-card${selected === s.id ? " on" : ""}`}
                onClick={() => setSelected(s.id)}
                aria-pressed={selected === s.id}
              >
                <Visual s={s} />
                <div className="ed-card-body">
                  <div className="ed-tags">
                    {s.id === p.dailyId && <span className="tag hot">Série du jour</span>}
                    {s.viral && s.id !== p.dailyId && <span className="tag">Tendance</span>}
                    {s.isNew && <span className="tag new">Nouveau</span>}
                  </div>
                  <strong>{s.title}</strong>
                  <em>{s.hook}</em>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Inspecteur ---------- */}
      <aside className="ed-insp">
        <div className="ed-insp-in">
          <span className="eyebrow">Réglages</span>

          <div className="ed-preview">
            {isIdea ? (
              <div className="ed-visual big ed-empty">
                <Icon name="pen" size={26} />
                <span>{pitch.trim() ? "Ton idée" : "Écris ton idée à gauche"}</span>
              </div>
            ) : story ? (
              <Visual s={story} big />
            ) : (
              <div className="ed-visual big ed-empty">
                <Icon name="layers" size={26} />
                <span>Choisis une histoire</span>
              </div>
            )}
            <b className="ed-title">{isIdea ? (pitch.trim() || "Mon idée") : (story?.title ?? "—")}</b>
            {story && !isIdea && <span className="muted ed-hook">{story.hook}</span>}
          </div>

          <div className="ed-field">
            <span>Durée</span>
            <div className="ed-seg">
              {p.formats.map((f) => (
                <button key={f.id} type="button" className={format === f.id ? "on" : ""} onClick={() => setFormat(f.id)}>
                  <b>{f.seconds} s</b>
                  <small>{f.credits} cr.</small>
                </button>
              ))}
            </div>
            {fmt.kind === "long" && <small className="muted">Plus d&apos;une minute : éligible à la monétisation TikTok.</small>}
            {!p.monetized && fmt.kind === "long" && <small className="warn">Ton compte n&apos;est pas monétisé : le format court est idéal pour grandir.</small>}
          </div>

          <div className="ed-field">
            <span>Épisodes</span>
            <div className="ed-seg">
              {p.episodes.map((n) => (
                <button key={n} type="button" className={episodes === n ? "on" : ""} onClick={() => setEpisodes(n)}>
                  <b>{n}</b>
                  <small>{n === 1 ? "unique" : "parties"}</small>
                </button>
              ))}
            </div>
          </div>

          {showCountry && (
            <label className="ed-field">
              <span>Univers</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                {p.countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="ed-switch">
            <span>
              <Icon name="music" size={15} /> Musique de fond
            </span>
            <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />
            <i aria-hidden="true" />
          </label>

          {p.admin && (
            <label className="ed-switch">
              <span>
                <Icon name="star" size={15} /> Moteur doublage (test admin)
              </span>
              <input type="checkbox" checked={dub} onChange={(e) => setDub(e.target.checked)} />
              <i aria-hidden="true" />
            </label>
          )}

          <div className="ed-foot">
          <div className="ed-sum">
            <div><span>{episodes > 1 ? "Partie 1" : "Coût"}</span><b>{fmt.credits} crédits</b></div>
            {episodes > 1 && <div><span>Série complète</span><b>{episodes * fmt.credits} crédits</b></div>}
            <div><span>Solde après</span><b className={enough ? "" : "warn"}>{enough ? `${p.credits - fmt.credits} crédits` : "insuffisant"}</b></div>
          </div>

          <GenerateButton disabled={!ready || !enough} label={episodes > 1 ? "Générer la partie 1" : "Générer la vidéo"} />
          {!enough && (
            <a href="/abonnement" className="btn btn-ghost" style={{ width: "100%" }}>
              Recharger mes crédits
            </a>
          )}
          {state?.error && <p className="error">{state.error}</p>}
          </div>
        </div>
      </aside>
    </form>
  );
}

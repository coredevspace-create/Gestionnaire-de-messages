"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createVideo, type FormState } from "../actions";
import { Flag } from "@/components/Flag";

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
  defaultFormat: string;
  defaultCountry: string;
  dailyId: string;
  formats: { id: string; label: string; seconds: number; credits: number; kind: string }[];
  episodes: number[];
  countries: { id: string; label: string }[];
  tabs: { id: string; label: string; flag?: string; stories: StudioStory[] }[];
};

const GRADS = [
  "linear-gradient(150deg,#ff9a1f 0%,#ff3d6b 100%)",
  "linear-gradient(150deg,#1fb8a6 0%,#c8f53a 100%)",
  "linear-gradient(150deg,#7a3dff 0%,#ff2e9a 100%)",
  "linear-gradient(150deg,#ff6a2b 0%,#ffd27a 100%)",
  "linear-gradient(150deg,#ff2e7e 0%,#ffb21f 100%)",
];

function grad(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADS[h % GRADS.length];
}

function GenerateButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-lg st-go" disabled={disabled || pending}>
      {pending ? "Lancement…" : label}
    </button>
  );
}

export function Studio(p: Props) {
  const [state, action] = useActionState<FormState, FormData>(createVideo, undefined);
  const [tab, setTab] = useState(p.tabs[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [format, setFormat] = useState(p.defaultFormat);
  const [episodes, setEpisodes] = useState(1);
  const [country, setCountry] = useState(p.defaultCountry);
  const [music, setMusic] = useState(true);

  const allStories = useMemo(() => new Map(p.tabs.flatMap((t) => t.stories).map((s) => [s.id, s])), [p.tabs]);
  const story = selected ? allStories.get(selected) : undefined;
  const isIdea = tab === "idea";
  const fmt = p.formats.find((f) => f.id === format)!;
  const ready = isIdea ? pitch.trim().length >= 10 : !!story;
  const enough = p.credits >= fmt.credits;
  const stories = p.tabs.find((t) => t.id === tab)?.stories ?? [];

  return (
    <form action={action} className="st">
      <input type="hidden" name="storyId" value={isIdea ? "" : (story?.id ?? "")} />
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="episodes" value={episodes} />
      {music && <input type="hidden" name="music" value="1" />}
      {(isIdea || !story?.world) && <input type="hidden" name="country" value={country} />}

      <header className="st-head">
        <div>
          <span className="eyebrow">Studio</span>
          <h1>Quelle histoire on tourne ?</h1>
          <p className="muted">Choisis une série qui marche déjà, ou raconte la tienne. On s&apos;occupe du reste.</p>
        </div>
      </header>

      <nav className="st-tabs" role="tablist">
        {p.tabs.map((t) => (
          <button key={t.id} type="button" role="tab" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.flag && <Flag id={t.flag} size={14} />} {t.label}
          </button>
        ))}
        <button type="button" role="tab" className={`idea ${isIdea ? "on" : ""}`} onClick={() => setTab("idea")}>
          ✍️ Mon idée
        </button>
      </nav>

      {isIdea ? (
        <section className="st-idea">
          <label htmlFor="pitch">Raconte ton histoire en une ou deux phrases</label>
          <textarea
            id="pitch"
            name="pitch"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            maxLength={500}
            rows={4}
            autoFocus
            placeholder="Ex : Un livreur se fait humilier par une cliente riche… le lendemain, elle passe un entretien dans SA société."
          />
          <div className="st-idea-foot">
            <span className="muted">{pitch.length}/500 · On écrit le scénario, les dialogues et on choisit les personnages.</span>
          </div>
          <div className="st-sparks">
            {[
              "Le patron teste l'honnêteté de son employé le plus pauvre",
              "La belle-mère humilie sa belle-fille devant toute la famille",
              "Le vigile du supermarché est un ancien champion de boxe",
              "Une mendiante au mariage est en fait la grand-mère milliardaire",
            ].map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setPitch(s)}>
                💡 {s}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="st-grid">
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`st-card${selected === s.id ? " on" : ""}`}
              onClick={() => setSelected(s.id)}
              aria-pressed={selected === s.id}
            >
              <div className="st-visual" style={{ background: grad(s.id) }}>
                {s.portraits.length ? (
                  <div className={`st-fan n${s.portraits.length}`}>
                    {s.portraits.map((src, i) => (
                      <img key={i} src={src} alt="" loading="lazy" />
                    ))}
                  </div>
                ) : (
                  <div className="st-emojis">{s.emojis.join("")}</div>
                )}
                <div className="st-badges">
                  {s.id === p.dailyId && <span className="tag hot">⭐ Série du jour</span>}
                  {s.viral && s.id !== p.dailyId && <span className="tag hot">🔥 Viral</span>}
                  {s.isNew && <span className="tag new">Nouveau</span>}
                </div>
                <span className="st-check">✓</span>
              </div>
              <div className="st-body">
                <strong>{s.title}</strong>
                <em>{s.hook}</em>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* ---------- Barre de lancement ---------- */}
      <div className={`st-bar${ready ? " ready" : ""}`}>
        <div className="st-bar-inner">
          <div className="st-pick">
            <span className="muted">{isIdea ? "Ton idée" : "Histoire"}</span>
            <b>{isIdea ? (pitch.trim() ? pitch.trim().slice(0, 60) + (pitch.length > 60 ? "…" : "") : "Écris ton idée") : (story?.title ?? "Choisis une histoire")}</b>
          </div>

          <div className="st-opts">
            <div className="seg" role="group" aria-label="Durée">
              {p.formats.map((f) => (
                <button key={f.id} type="button" className={format === f.id ? "on" : ""} onClick={() => setFormat(f.id)} title={f.label}>
                  {f.seconds}s{f.kind === "long" ? " 💰" : ""}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Épisodes">
              {p.episodes.map((n) => (
                <button key={n} type="button" className={episodes === n ? "on" : ""} onClick={() => setEpisodes(n)}>
                  {n === 1 ? "1 ép." : `${n} ép.`}
                </button>
              ))}
            </div>
            {(isIdea || (story && !story.world)) && (
              <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Univers">
                {p.countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            <label className="st-toggle">
              <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> 🎵
            </label>
          </div>

          <div className="st-launch">
            <GenerateButton disabled={!ready || !enough} label={`Générer · ${fmt.credits} crédits →`} />
            <span className={`muted ${enough ? "" : "warn"}`}>
              {enough ? `Il te restera ${p.credits - fmt.credits} crédits` : "Crédits insuffisants — recharge sur Abonnement"}
            </span>
          </div>
        </div>
        {(state?.error || (!p.monetized && fmt.kind === "long")) && (
          <div className="st-bar-msg">
            {state?.error ? (
              <span className="error">{state.error}</span>
            ) : (
              <span className="warn">💡 Ton compte n&apos;est pas encore monétisé : les vidéos courtes sont idéales pour grandir.</span>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

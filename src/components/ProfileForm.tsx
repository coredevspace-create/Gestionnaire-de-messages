import { COUNTRIES } from "@/lib/catalog/countries";
import type { User } from "@/lib/db";
import { saveProfile } from "@/app/actions";

/** Les 2 seules questions posées — une fois pour toutes. */
export function ProfileForm({ user, submitLabel }: { user: User; submitLabel: string }) {
  return (
    <form action={saveProfile} className="stack" style={{ maxWidth: 560 }}>
      <fieldset className="card stack">
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Ton compte TikTok est-il monétisé ?</legend>
        <label>
          <input type="radio" name="monetized" value="0" defaultChecked={!user.monetized} /> Pas encore —
          je veux grandir (vidéos courtes 20-30 s)
        </label>
        <label>
          <input type="radio" name="monetized" value="1" defaultChecked={!!user.monetized} /> Oui — je veux
          être payé (vidéos de plus d&apos;une minute)
        </label>
      </fieldset>
      <label className="card stack">
        Ton univers par défaut (pays africain ou 🌍 Monde)
        <select name="country" defaultValue={user.country}>
          {COUNTRIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id === "monde" ? "🌍 " : ""}{c.name}
            </option>
          ))}
        </select>
      </label>
      <button>{submitLabel}</button>
    </form>
  );
}

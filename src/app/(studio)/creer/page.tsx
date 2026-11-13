import "./studio.css";
import { requireUser } from "@/lib/auth";
import { defaultFormat, EPISODE_CHOICES, FORMATS } from "@/lib/config";
import { COUNTRIES, getCountry } from "@/lib/catalog/countries";
import { STORIES, storiesFor, storyOfTheDay, WORLD_STORIES, type Story } from "@/lib/catalog/stories";
import { ROLES } from "@/lib/catalog/characters";
import { sql, totalCredits } from "@/lib/db";
import { mediaUrl } from "@/lib/storage";
import { FRUIT_EMOJI } from "@/lib/showcase";
import { Studio, type StudioStory } from "./Studio";

const STYLE = "fruits3d";

/** Clés des personnages d'une histoire (pour retrouver leurs portraits). */
function castKeys(s: Story, country: string): { key: string; fruit: string }[] {
  if (s.castSpec?.length) return s.castSpec.map((c) => ({ key: `story:${s.id}:${c.id}:${STYLE}`, fruit: c.fruit }));
  return s.cast.map((r) => ({ key: `${s.world ?? country}:${STYLE}:${r}`, fruit: ROLES[r]?.fruit ?? "orange" }));
}

export default async function CreatePage() {
  const user = await requireUser();
  const country = getCountry(user.country);
  const local = storiesFor(user.country);
  const daily = storyOfTheDay(user.country);
  const trending = [daily, ...[...WORLD_STORIES, ...STORIES].filter((s) => s.tags.includes("viral") && s.id !== daily.id)];
  const all = [...new Map([...trending, ...local, ...WORLD_STORIES].map((s) => [s.id, s])).values()];

  // Portraits disponibles pour illustrer les cartes.
  const keys = [...new Set(all.flatMap((s) => castKeys(s, user.country).map((k) => k.key)))];
  const rows = await sql<{ key: string; sheet_path: string }>(
    "SELECT key, sheet_path FROM characters WHERE key = ANY($1) AND sheet_path LIKE '%portrait-v2%'",
    [keys],
  );
  const portrait = new Map(rows.map((r) => [r.key, mediaUrl(r.sheet_path)!]));

  const toStudio = (s: Story): StudioStory => {
    const cast = castKeys(s, user.country);
    return {
      id: s.id,
      title: s.title,
      hook: s.hook,
      theme: s.theme,
      viral: s.tags.includes("viral"),
      isNew: s.tags.includes("nouveau"),
      world: s.world === "monde",
      portraits: cast.map((c) => portrait.get(c.key)).filter((u): u is string => !!u).slice(0, 3),
      emojis: cast.slice(0, 3).map((c) => FRUIT_EMOJI[c.fruit] ?? "🍊"),
    };
  };

  return (
    <Studio
      credits={totalCredits(user)}
      monetized={!!user.monetized}
      defaultFormat={defaultFormat(!!user.monetized)}
      defaultCountry={user.country}
      dailyId={daily.id}
      formats={Object.entries(FORMATS).map(([id, f]) => ({ id, label: f.label, seconds: f.seconds, credits: f.credits, kind: f.kind }))}
      episodes={[...EPISODE_CHOICES]}
      countries={COUNTRIES.map((c) => ({ id: c.id, label: `${c.id === "monde" ? "🌍 " : ""}${c.name}` }))}
      tabs={[
        { id: "trending", label: "Tendances", stories: trending.slice(0, 12).map(toStudio) },
        { id: "monde", label: "Monde", stories: WORLD_STORIES.map(toStudio) },
        ...(user.country === "monde"
          ? []
          : [{ id: "local", label: country.name, flag: country.id, stories: local.filter((s) => !s.world).map(toStudio) }]),
      ]}
    />
  );
}

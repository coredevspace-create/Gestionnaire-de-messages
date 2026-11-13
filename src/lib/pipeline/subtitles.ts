/**
 * Sous-titres style TikTok (fichier ASS rendu par libass) :
 * - morceaux courts (3-4 mots) qui défilent au rythme de la réplique
 * - police épaisse (Inter Display Black), gros contour noir, légère ombre
 * - une couleur par personnage pour savoir qui parle
 * - placés au-dessus de la zone des boutons TikTok
 */

export const SUB_FONT = "Inter Display Black";

// Couleurs ASS au format &H00BBGGRR
const SPEAKER_COLORS = ["&H00FFFFFF", "&H004DE1FF", "&H00FFD24D", "&H0080FF9E", "&H00B98CFF"];

export type TimedLine = { speaker: string; text: string; start: number; end: number };

function assTime(s: number) {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

function escapeAss(t: string) {
  return t.replace(/\\/g, "").replace(/[{}]/g, "").replace(/\n/g, " ");
}

/** Découpe une réplique en morceaux de 3-4 mots (sans couper avant une ponctuation isolée). */
export function chunk(text: string, maxWords = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) out.push(words.slice(i, i + maxWords).join(" "));
  // Évite un dernier morceau d'un seul mot : on le colle au précédent.
  if (out.length > 1 && out[out.length - 1].split(" ").length === 1) {
    const last = out.pop()!;
    out[out.length - 1] += " " + last;
  }
  return out;
}

export function buildAss(lines: TimedLine[]): string {
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${SUB_FONT},84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,8,4,2,40,40,520,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];
  for (const l of lines) {
    const parts = chunk(escapeAss(l.text));
    if (!parts.length) continue;
    // Durée de chaque morceau proportionnelle à son nombre de caractères.
    const total = parts.reduce((a, p) => a + p.length, 0);
    const dur = Math.max(0.3, l.end - l.start);
    const color = SPEAKER_COLORS[speakers.indexOf(l.speaker) % SPEAKER_COLORS.length];
    let t = l.start;
    for (const p of parts) {
      const d = (dur * p.length) / total;
      // Petit effet « pop » à l'apparition (110% -> 100%).
      const text = `{\\c${color}\\fscx110\\fscy110\\t(0,120,\\fscx100\\fscy100)}${p}`;
      events.push(`Dialogue: 0,${assTime(t)},${assTime(t + d)},Sub,,0,0,0,,${text}`);
      t += d;
    }
  }
  return header + events.join("\n") + "\n";
}

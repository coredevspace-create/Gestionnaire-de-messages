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
export function chunk(text: string, maxWords = 3): string[] {
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

export type Overlay = {
  /** Titre affiché en haut au début (ex. « LE TEST DU PATRON · ÉPISODE 1 ») */
  title?: string;
  /** Texte affiché en haut à la fin (ex. « À SUIVRE… ») */
  outro?: string;
  /** Durée totale de la vidéo (s) */
  total: number;
};

/**
 * Transforme des mots horodatés (transcription réelle) en sous-titres de 1 à 3 mots,
 * coupés aux pauses. Les mots sont attribués aux répliques du plan dans l'ordre.
 */
export function wordsToTimedLines(
  words: { word: string; start: number; end: number }[],
  lines: { speaker: string; text: string }[],
  offset: number,
): TimedLine[] {
  if (!words.length) return [];
  const counts = lines.map((l) => Math.max(1, l.text.split(/\s+/).length));
  const total = counts.reduce((a, b) => a + b, 0);
  const speakerAt = (i: number) => {
    let acc = 0;
    for (let k = 0; k < lines.length; k++) {
      acc += (counts[k] / total) * words.length;
      if (i < Math.round(acc)) return lines[k]?.speaker ?? "";
    }
    return lines[lines.length - 1]?.speaker ?? "";
  };
  const out: TimedLine[] = [];
  let cur: { words: string[]; start: number; end: number; speaker: string } | null = null;
  words.forEach((w, i) => {
    const speaker = speakerAt(i);
    const gap = cur ? w.start - cur.end : 0;
    if (!cur || cur.words.length >= 3 || gap > 0.35 || speaker !== cur.speaker) {
      if (cur) out.push({ speaker: cur.speaker, text: cur.words.join(" "), start: offset + cur.start, end: offset + cur.end });
      cur = { words: [], start: w.start, end: w.end, speaker };
    }
    cur.words.push(w.word.trim());
    cur.end = w.end;
  });
  if (cur) {
    const c = cur as { words: string[]; start: number; end: number; speaker: string };
    out.push({ speaker: c.speaker, text: c.words.join(" "), start: offset + c.start, end: offset + c.end });
  }
  // Un mot isolé en fin de phrase est rattaché au morceau précédent (même personnage, sans pause).
  for (let i = out.length - 1; i > 0; i--) {
    const a = out[i - 1];
    const b = out[i];
    if (b.text.split(" ").length === 1 && a.speaker === b.speaker && b.start - a.end < 0.35 && a.text.split(" ").length <= 3) {
      a.text += " " + b.text;
      a.end = b.end;
      out.splice(i, 1);
    }
  }
  // Chaque sous-titre reste affiché jusqu'au suivant (max 0,6 s de plus) pour éviter le clignotement.
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1]?.start ?? out[i].end + 0.6;
    out[i].end = Math.min(next, out[i].end + 0.6);
  }
  return out;
}

export function buildAss(lines: TimedLine[], overlay?: Overlay): string {
  const who = (sp: string) => sp.replace(/\s*\(pens[ée]e\)\s*$/i, "").trim();
  const speakers = [...new Set(lines.map((l) => who(l.speaker)))];
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${SUB_FONT},54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3.2,0,2,60,60,330,1
Style: Title,${SUB_FONT},54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,3,14,0,8,40,40,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];
  // Style « karaoké » : 2-3 mots blancs à l'écran, le mot prononcé passe en jaune.
  const YELLOW = "&H0033E6FF&";
  for (const l of lines) {
    const parts = chunk(escapeAss(l.text).toLocaleUpperCase("fr-FR"));
    if (!parts.length) continue;
    const total = parts.reduce((a, p) => a + p.length, 0);
    const dur = Math.max(0.3, l.end - l.start);
    const thought = who(l.speaker) !== l.speaker.trim();
    let t = l.start;
    for (const p of parts) {
      const d = (dur * p.length) / total;
      const words = p.split(" ");
      const chars = words.reduce((a, w) => a + w.length + 1, 0);
      let wt = t;
      words.forEach((_, wi) => {
        const wd = (d * (words[wi].length + 1)) / chars;
        const text = words.map((w, k) => (k === wi ? `{\\c${YELLOW}}${w}{\\c&HFFFFFF&}` : w)).join(" ");
        events.push(`Dialogue: 0,${assTime(wt)},${assTime(wt + wd)},Sub,,0,0,0,,${thought ? "{\\i1}" : ""}${text}`);
        wt += wd;
      });
      t += d;
    }
  }
  void speakers;
  if (overlay?.title) {
    // Bandeau titre (fond noir) les 3 premières secondes.
    events.push(`Dialogue: 1,${assTime(0)},${assTime(Math.min(3, overlay.total))},Title,,0,0,0,,{\\fad(150,300)}${escapeAss(overlay.title).toLocaleUpperCase("fr-FR")}`);
  }
  if (overlay?.outro) {
    events.push(`Dialogue: 1,${assTime(Math.max(0, overlay.total - 2.5))},${assTime(overlay.total)},Title,,0,0,0,,{\\c&H004DE1FF&\\fad(200,0)}${escapeAss(overlay.outro).toLocaleUpperCase("fr-FR")}`);
  }
  return header + events.join("\n") + "\n";
}

/** Couverture TikTok : titre énorme en haut, « PARTIE N » en jaune, voile sombre pour la lisibilité. */
export function coverAss(title: string, part?: string): string {
  const t = escapeAss(title).toUpperCase();
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Veil,${SUB_FONT},10,&H55000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Title,${SUB_FONT},132,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,9,5,8,70,70,290,1
Style: Part,${SUB_FONT},76,&H0000D7FF,&H0000D7FF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,7,4,8,70,70,170,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Veil,,0,0,0,,{\\blur60\\pos(0,0)\\p1}m 0 0 l 1080 0 1080 820 0 820{\\p0}
Dialogue: 1,0:00:00.00,0:00:05.00,Title,,0,0,0,,${t}
${part ? `Dialogue: 1,0:00:00.00,0:00:05.00,Part,,0,0,0,,${escapeAss(part).toUpperCase()}` : ""}
`;
}

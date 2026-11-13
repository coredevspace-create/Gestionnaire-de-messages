"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { adminUploadMusic } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { MiniPlayer } from "./MiniPlayer";

export type MoodOption = { id: string; label: string; color: string };

/** Durée gardée : la vidéo la plus longue fait ~71 s et la musique tourne en boucle. */
const KEEP_SECONDS = 90;

/** Décode le fichier, garde 90 s en mono 44,1 kHz avec un fondu de sortie, et l'encode en MP3 128 kbps. */
async function compress(file: File, onProgress: (p: number) => void): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  await ctx.close();
  const rate = 44100;
  const length = Math.min(decoded.duration, KEEP_SECONDS);
  const off = new OfflineAudioContext(1, Math.ceil(length * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  const gain = off.createGain();
  gain.gain.setValueAtTime(1, Math.max(0, length - 2));
  gain.gain.linearRampToValueAtTime(0, length);
  src.connect(gain).connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);
  const enc = new Mp3Encoder(1, rate, 128);
  const chunks: Uint8Array[] = [];
  const block = 1152 * 20;
  const buf = new Int16Array(block);
  for (let i = 0; i < pcm.length; i += block) {
    const n = Math.min(block, pcm.length - i);
    for (let j = 0; j < n; j++) buf[j] = Math.max(-1, Math.min(1, pcm[i + j])) * 0x7fff;
    const out = enc.encodeBuffer(n === block ? buf : buf.subarray(0, n));
    if (out.length) chunks.push(out);
    if ((i / block) % 10 === 0) {
      onProgress(i / pcm.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const end = enc.flush();
  if (end.length) chunks.push(end);
  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}

/** Ajout d'une musique : on choisit le fichier, on l'écoute, puis on la classe. */
export function MusicUploader({ moods }: { moods: MoodOption[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  function pick(f: File | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)) {
      setError("Choisis un fichier audio (MP3, WAV, M4A…).");
      return;
    }
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s\d{5,}$/, ""));
    setMood(null);
    setError(null);
    setStatus(null);
  }

  function reset() {
    if (url) URL.revokeObjectURL(url);
    setFile(null);
    setUrl(null);
    setMood(null);
    setTitle("");
    setStatus(null);
    if (input.current) input.current.value = "";
  }

  function save() {
    if (!file || !mood) return;
    setError(null);
    start(async () => {
      try {
        setStatus("Compression…");
        const mp3 = await compress(file, (p) => setStatus(`Compression… ${Math.round(p * 100)} %`));
        setStatus("Envoi…");
        const fd = new FormData();
        fd.append("file", new File([mp3], `${title || "musique"}.mp3`, { type: "audio/mpeg" }));
        fd.append("mood", mood);
        fd.append("title", title);
        const res = await adminUploadMusic(undefined, fd);
        if (res?.error) {
          setError(res.error);
          setStatus(null);
          return;
        }
        reset();
        setStatus("Ajoutée !");
        setTimeout(() => setStatus(null), 2500);
      } catch {
        setError("Impossible de lire ce fichier. Essaie un MP3.");
        setStatus(null);
      }
    });
  }

  if (!file) {
    return (
      <div
        className={`mu-drop${drag ? " drag" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
      >
        <input ref={input} type="file" accept="audio/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <span className="mu-drop-ic"><Icon name="music" size={22} /></span>
        <b>Glisse une musique ici ou clique pour la choisir</b>
        <span className="muted">MP3, WAV, M4A… Aucune limite de taille : on garde 90 s et on compresse automatiquement.</span>
        {status && <span className="mu-ok"><Icon name="check" size={14} /> {status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="mu-new">
      <div className="mu-new-head">
        <span className="eyebrow">Nouvelle musique</span>
        <button type="button" className="icon-btn" onClick={reset} aria-label="Annuler">✕</button>
      </div>
      <MiniPlayer src={url!} title={file.name} big autoPlay />
      <label className="mu-field">
        <span>Titre</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </label>
      <div className="mu-field">
        <span>Écoute, puis choisis l&apos;ambiance</span>
        <div className="mu-moods">
          {moods.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mu-mood${mood === m.id ? " on" : ""}`}
              style={{ ["--c" as string]: m.color }}
              onClick={() => setMood(m.id)}
            >
              <i />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="secondary" onClick={reset} disabled={pending}>Annuler</button>
        <button type="button" className="btn-grad" onClick={save} disabled={!mood || pending}>
          {pending ? <><span className="spinner sm" /> {status ?? "Ajout…"}</> : mood ? "Ajouter à la bibliothèque" : "Choisis une ambiance"}
        </button>
      </div>
    </div>
  );
}

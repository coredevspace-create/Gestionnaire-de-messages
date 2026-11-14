"use client";

import { useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Icon } from "./Icon";

type Phase = "idle" | "loading" | "done";

/** Petit « pop » sonore (Web Audio, aucun fichier à charger). */
function pop() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {}
}

function celebrate(el: HTMLElement | null) {
  const r = el?.getBoundingClientRect();
  const origin = r
    ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
    : { x: 0.5, y: 0.6 };
  const colors = ["#ff6b2c", "#fafafa", "#4ade80", "#ffb21f"];
  confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin, colors, scalar: 0.9, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 50, spread: 110, startVelocity: 25, origin, colors, scalar: 0.7, disableForReducedMotion: true }), 180);
  navigator.vibrate?.([12, 40, 20]);
  pop();
}

/**
 * Téléchargement avec progression dans le bouton, puis confettis + vibration + son.
 * Sur mobile, propose « Enregistrer la vidéo » (partage natif) quand c'est possible.
 */
export function DownloadButton({ src, downloadUrl, filename }: { src: string; downloadUrl: string; filename: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);

  async function run() {
    if (phase === "loading") return;
    setPhase("loading");
    setPct(0);
    try {
      const res = await fetch(src);
      if (!res.ok || !res.body) throw new Error("fetch");
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        if (total) setPct(Math.round((got / total) * 100));
      }
      const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
      const file = new File([blob], filename, { type: "video/mp4" });
      const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (mobile && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
        } catch {
          /* partage annulé : on télécharge quand même */
          save(blob);
        }
      } else {
        save(blob);
      }
      setPct(100);
      setPhase("done");
      celebrate(btn.current);
      setTimeout(() => setPhase("idle"), 4000);
    } catch {
      // Repli : lien direct (le navigateur gère le téléchargement).
      window.location.href = downloadUrl;
      setPhase("done");
      celebrate(btn.current);
      setTimeout(() => setPhase("idle"), 4000);
    }
  }

  function save(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <button ref={btn} type="button" className={`dl-btn ${phase}`} onClick={run} aria-live="polite">
      <span className="dl-fill" style={{ width: phase === "loading" ? `${Math.max(6, pct)}%` : phase === "done" ? "100%" : "0%" }} />
      <span className="dl-label">
        {phase === "idle" && (
          <>
            <Icon name="download" size={19} /> Télécharger la vidéo
          </>
        )}
        {phase === "loading" && (
          <>
            <span className="spinner sm" /> Téléchargement… {pct ? `${pct}%` : ""}
          </>
        )}
        {phase === "done" && (
          <>
            <Icon name="check" size={19} /> Vidéo téléchargée !
          </>
        )}
      </span>
    </button>
  );
}

/** Copie la description TikTok (texte + hashtags) avec confirmation. */
export function CopyCaption({ text, label = "Copier la description", done = "Description copiée", small }: { text: string; label?: string; done?: string; small?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={small ? "secondary btn-sm" : "secondary"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = document.createElement("textarea");
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setOk(true);
        navigator.vibrate?.(10);
        setTimeout(() => setOk(false), 2200);
      }}
    >
      <Icon name={ok ? "check" : "copy"} size={16} /> {ok ? done : label}
    </button>
  );
}

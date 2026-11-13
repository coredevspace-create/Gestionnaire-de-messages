"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/** Un seul lecteur joue à la fois sur la page. */
const EVT = "fs-mini-player-play";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Lecteur audio compact : bouton lecture, barre de progression cliquable, durée. */
export function MiniPlayer({ src, title, big, autoPlay }: { src: string; title?: string; big?: boolean; autoPlay?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);

  useEffect(() => {
    const stopOthers = (e: Event) => {
      if ((e as CustomEvent).detail !== audio.current) audio.current?.pause();
    };
    window.addEventListener(EVT, stopOthers);
    return () => window.removeEventListener(EVT, stopOthers);
  }, []);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      window.dispatchEvent(new CustomEvent(EVT, { detail: a }));
      void a.play();
    } else a.pause();
  }

  return (
    <div className={`mp${big ? " big" : ""}${playing ? " playing" : ""}`}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        onPlay={() => {
          setPlaying(true);
          window.dispatchEvent(new CustomEvent(EVT, { detail: audio.current }));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setD(e.currentTarget.duration)}
      />
      <button type="button" className="mp-btn" onClick={toggle} aria-label={playing ? "Pause" : "Écouter"}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <Icon name="play" size={16} />
        )}
      </button>
      <div className="mp-body">
        {title && <span className="mp-title" title={title}>{title}</span>}
        <div
          className="mp-bar"
          onClick={(e) => {
            const a = audio.current;
            if (!a || !d) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * d;
          }}
        >
          <div style={{ width: d ? `${(t / d) * 100}%` : "0%" }} />
        </div>
      </div>
      <span className="mp-time">{playing || t ? `${fmt(t)} / ${fmt(d)}` : fmt(d)}</span>
      <span className="mp-eq" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}

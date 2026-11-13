"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de chargement en haut de l'écran : démarre dès un clic sur un lien interne
 * ou l'envoi d'un formulaire, se termine quand la nouvelle page est affichée.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = () => {
      setState("loading");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 20000); // sécurité
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // ancre sur la même page
      start();
    };
    const onSubmit = () => start();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 400);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return <div className={`nav-progress ${state}`} aria-hidden="true" />;
}

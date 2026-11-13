"use client";

import { useEffect } from "react";

/**
 * Apparition au défilement : chaque élément marqué data-reveal glisse et apparaît
 * quand il entre à l'écran. Sans JavaScript (ou animations réduites), tout reste visible.
 */
export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("js-reveal");
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el, i) => {
      el.style.setProperty("--d", `${(Number(el.dataset.reveal) || 0) * 80}ms`);
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
      else io.observe(el);
      void i;
    });
    return () => io.disconnect();
  }, []);
  return null;
}

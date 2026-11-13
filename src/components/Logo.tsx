/** Logo : tranche d'agrume stylisée dont un quartier devient un bouton « lecture ». */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lg-citrus" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb21f" />
          <stop offset="0.45" stopColor="#ff6a2b" />
          <stop offset="1" stopColor="#ff2e9a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#lg-citrus)" />
      <circle cx="20" cy="21" r="11" fill="#fff6ec" />
      <circle cx="20" cy="21" r="8.6" fill="#ffd27a" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line
          key={a}
          x1="20"
          y1="21"
          x2={20 + 8.6 * Math.cos((a * Math.PI) / 180)}
          y2={21 + 8.6 * Math.sin((a * Math.PI) / 180)}
          stroke="#fff6ec"
          strokeWidth="1.4"
        />
      ))}
      <path d="M17.6 16.8 L25 21 L17.6 25.2 Z" fill="#1a0a06" />
      <path d="M22 8.5c2.6-2.6 6-2.4 7.4-1.6-.6 2.6-3.6 4.6-7.4 1.6z" fill="#c8f53a" />
    </svg>
  );
}

export const BRAND = "FruitStory";

export function Brand() {
  return (
    <span className="brand">
      <LogoMark />
      {BRAND}
    </span>
  );
}

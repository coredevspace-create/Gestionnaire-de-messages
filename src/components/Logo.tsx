/** Logo : tranche d'agrume au trait dont le centre est un bouton « lecture ». Sobre, monochrome + accent. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#fafafa" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#0a0a0b" strokeWidth="1.6" />
      {[30, 90, 150, 210, 270, 330].map((a) => (
        <line
          key={a}
          x1={16 + 3.6 * Math.cos((a * Math.PI) / 180)}
          y1={16 + 3.6 * Math.sin((a * Math.PI) / 180)}
          x2={16 + 9 * Math.cos((a * Math.PI) / 180)}
          y2={16 + 9 * Math.sin((a * Math.PI) / 180)}
          stroke="#0a0a0b"
          strokeWidth="1.2"
        />
      ))}
      <path d="M14.4 13.3 L18.9 16 L14.4 18.7 Z" fill="#ff6b2c" />
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

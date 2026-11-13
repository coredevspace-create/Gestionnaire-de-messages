/** Icônes au trait (style « lucide »), cohérentes et sobres. */
const PATHS: Record<string, string[]> = {
  plus: ["M12 5v14", "M5 12h14"],
  play: ["M7 4.5v15l12-7.5z"],
  film: ["M3 5h18v14H3z", "M7 5v14", "M17 5v14", "M3 9h4", "M3 15h4", "M17 9h4", "M17 15h4"],
  grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  card: ["M3 6h18v12H3z", "M3 10h18", "M7 15h3"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"],
  shield: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  sparkle: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  type: ["M5 6h14", "M12 6v13", "M9 19h6"],
  music: ["M9 18V6l11-2v12", "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", "M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
  repeat: ["M17 3l3 3-3 3", "M4 11V9a3 3 0 0 1 3-3h13", "M7 21l-3-3 3-3", "M20 13v2a3 3 0 0 1-3 3H4"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M3 12h18", "M12 3c2.5 3 2.5 15 0 18", "M12 3c-2.5 3-2.5 15 0 18"],
  copy: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  share: ["M12 15V3", "M7 8l5-5 5 5", "M5 13v7h14v-7"],
  next: ["M6 5l8 7-8 7z", "M18 5v14"],
  logout: ["M15 4h4v16h-4", "M10 8l-4 4 4 4", "M6 12h11"],
  mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M5 11a7 7 0 0 0 14 0", "M12 18v3"],
  pen: ["M4 20h4L19 9l-4-4L4 16z", "M13 7l4 4"],
  layers: ["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5"],
  star: ["M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"],
  heart: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
  chat: ["M4 5h16v11H9l-5 4z"],
  refresh: ["M20 11a8 8 0 0 0-14.5-4.5L4 8", "M4 4v4h4", "M4 13a8 8 0 0 0 14.5 4.5L20 16", "M20 20v-4h-4"],
};

export function Icon({ name, size = 18, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  const paths = PATHS[name] ?? [];
  const filled = name === "play" || name === "star" || name === "heart";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flex: "none" }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/**
 * Drapeaux en SVG : les emojis drapeaux ne s'affichent pas sur Windows (« CI » au lieu de 🇨🇮).
 */
const STAR = "M0,-1 L0.2245,-0.309 L0.951,-0.309 L0.363,0.118 L0.588,0.809 L0,0.382 L-0.588,0.809 L-0.363,0.118 L-0.951,-0.309 L-0.2245,-0.309 Z";

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <path d={STAR} transform={`translate(${x} ${y}) scale(${r})`} fill={fill} />;
}

function vertical(colors: string[]) {
  return colors.map((c, i) => <rect key={i} x={(i * 30) / colors.length} y="0" width={30 / colors.length + 0.1} height="20" fill={c} />);
}
function horizontal(colors: string[]) {
  return colors.map((c, i) => <rect key={i} x="0" y={(i * 20) / colors.length} width="30" height={20 / colors.length + 0.1} fill={c} />);
}

const FLAGS: Record<string, React.ReactNode> = {
  sn: <>{vertical(["#00853f", "#fdef42", "#e31b23"])}<Star x={15} y={10} r={3.4} fill="#00853f" /></>,
  ci: <>{vertical(["#f77f00", "#ffffff", "#009e60"])}</>,
  cm: <>{vertical(["#007a5e", "#ce1126", "#fcd116"])}<Star x={15} y={10} r={3.2} fill="#fcd116" /></>,
  ml: <>{vertical(["#14b53a", "#fcd116", "#ce1126"])}</>,
  gn: <>{vertical(["#ce1126", "#fcd116", "#009460"])}</>,
  bf: <>{horizontal(["#ef2b2d", "#009e49"])}<Star x={15} y={10} r={3.4} fill="#fcd116" /></>,
  ga: <>{horizontal(["#009e60", "#fcd116", "#3a75c4"])}</>,
  bj: (
    <>
      <rect x="0" y="0" width="12" height="20" fill="#008751" />
      <rect x="12" y="0" width="18" height="10" fill="#fcd116" />
      <rect x="12" y="10" width="18" height="10" fill="#e8112d" />
    </>
  ),
  tg: (
    <>
      {horizontal(["#006a4e", "#ffce00", "#006a4e", "#ffce00", "#006a4e"])}
      <rect x="0" y="0" width="12" height="12" fill="#d21034" />
      <Star x={6} y={6.3} r={3.6} fill="#ffffff" />
    </>
  ),
  cd: (
    <>
      <rect width="30" height="20" fill="#007fff" />
      <path d="M0,17 L25,0 L30,0 L30,3 L5,20 L0,20 Z" fill="#f7d618" />
      <path d="M0,18.5 L27.5,0 L30,0 L30,1.5 L2.5,20 L0,20 Z" fill="#ce1021" />
      <Star x={5} y={5} r={3.2} fill="#f7d618" />
    </>
  ),
};

export function Flag({ id, size = 20 }: { id: string; size?: number }) {
  if (id === "monde" || !FLAGS[id]) return <span aria-hidden="true">🌍</span>;
  return (
    <svg
      width={size * 1.5}
      height={size}
      viewBox="0 0 30 20"
      aria-hidden="true"
      style={{ borderRadius: 3, verticalAlign: "-0.15em", boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", flex: "none" }}
    >
      {FLAGS[id]}
    </svg>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "📊 Tableau de bord" },
  { href: "/admin/videos", label: "🎬 Vidéos" },
  { href: "/admin/vitrine", label: "⭐ Vitrine" },
  { href: "/admin/utilisateurs", label: "👥 Utilisateurs" },
  { href: "/admin/personnages", label: "🍊 Personnages" },
  { href: "/admin/musiques", label: "🎵 Musiques" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="adm-nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

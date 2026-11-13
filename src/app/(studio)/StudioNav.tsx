"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const ITEMS = [
  { href: "/creer", label: "Créer", icon: "plus" },
  { href: "/creations", label: "Mes vidéos", icon: "film" },
  { href: "/abonnement", label: "Crédits", icon: "card" },
  { href: "/profile", label: "Profil", icon: "user" },
];

/** Navigation du studio : barre latérale (ordinateur) ou barre d'onglets (mobile). */
export function StudioNav({ admin, variant }: { admin: boolean; variant: "side" | "tabs" }) {
  const path = usePathname();
  const items = admin ? [...ITEMS, { href: "/admin", label: "Admin", icon: "shield" }] : ITEMS;
  const active = (href: string) => path === href || path.startsWith(href + "/") || (href === "/creations" && path.startsWith("/videos"));
  return (
    <nav className={variant === "side" ? "sb-nav" : "tabbar"}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={active(i.href) ? "on" : ""}>
          <Icon name={i.icon} size={variant === "side" ? 17 : 21} />
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}

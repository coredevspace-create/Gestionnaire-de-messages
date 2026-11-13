import type { ReactNode } from "react";
import Link from "next/link";
import "./app.css";
import { currentUser, isAdmin } from "@/lib/auth";
import { isMock } from "@/lib/config";
import { totalCredits } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";
import { LogoMark } from "@/components/Logo";
import { logout } from "@/app/actions";
import { StudioNav } from "./StudioNav";
import { Icon } from "@/components/Icon";

/** Le studio : un espace de travail à part (barre latérale, panneaux), distinct du site vitrine. */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) return <div className="studio-bare">{children}</div>; // pages qui redirigent vers /login
  const credits = totalCredits(user);
  const plan = user.plan ? PLANS[user.plan as PlanId] : null;
  const gauge = Math.min(100, Math.round((credits / (plan?.credits ?? 700)) * 100));

  return (
    <div className="studio">
      <aside className="sidebar">
        <Link href="/creer" className="sb-brand">
          <LogoMark size={24} />
          <span>Studio</span>
        </Link>
        <Link href="/creer" className="sb-new">
          <Icon name="plus" size={16} /> Nouvelle vidéo
        </Link>
        <StudioNav admin={isAdmin(user)} variant="side" />
        <div className="sb-bottom">
          <Link href="/abonnement" className="sb-credits">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Crédits</span>
              <b>{credits.toLocaleString("fr-FR")}</b>
            </div>
            <div className="gauge"><div style={{ width: `${gauge}%` }} /></div>
            <small>{plan ? `Offre ${plan.name}` : "Sans abonnement · Recharger"}</small>
          </Link>
          <div className="sb-user">
            <span title={user.email}>{user.email}</span>
            <form action={logout}>
              <button className="icon-btn" title="Se déconnecter" aria-label="Se déconnecter">
                <Icon name="logout" size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <Link href="/creer" className="tb-brand">
            <LogoMark size={22} />
          </Link>
          {isMock() && <span className="badge-mock">Simulation</span>}
          <Link href="/abonnement" className="tb-credits">
            <Icon name="sparkle" size={14} /> {credits.toLocaleString("fr-FR")}
          </Link>
        </header>
        <main className="ws-main">{children}</main>
      </div>

      <StudioNav admin={isAdmin(user)} variant="tabs" />
    </div>
  );
}

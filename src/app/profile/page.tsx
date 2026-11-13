import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";
import { logout } from "../actions";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <span className="eyebrow">Profil</span>
      <h1 style={{ margin: 0 }}>Tes réglages</h1>
      <p className="muted" style={{ marginTop: 0 }}>{user.email} · <Link className="link" href="/abonnement">Abonnement et factures</Link></p>
      <ProfileForm user={user} submitLabel="Enregistrer" />
      <form action={logout}>
        <button className="secondary">Se déconnecter</button>
      </form>
    </div>
  );
}

import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <h1>Profil</h1>
      <p className="muted">{user.email}</p>
      <ProfileForm user={user} submitLabel="Enregistrer" />
    </>
  );
}

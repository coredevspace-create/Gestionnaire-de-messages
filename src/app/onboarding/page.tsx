import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";

export default async function OnboardingPage() {
  const user = await requireUser({ allowNotOnboarded: true });
  return (
    <>
      <h1>Bienvenue 👋</h1>
      <p className="muted">Deux questions, une seule fois. Ensuite tu crées tes vidéos en un clic.</p>
      <ProfileForm user={user} submitLabel="C'est parti" />
    </>
  );
}

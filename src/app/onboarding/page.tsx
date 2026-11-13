import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";

export default async function OnboardingPage() {
  const user = await requireUser({ allowNotOnboarded: true });
  return (
    <div className="auth-wrap">
      <div className="stack" style={{ maxWidth: 560, width: "100%" }}>
        <span className="eyebrow">Bienvenue</span>
        <h1 style={{ margin: 0 }}>Deux questions, une seule fois.</h1>
        <p className="muted" style={{ marginTop: 0 }}>Ensuite, tu crées tes vidéos en un clic. Tu pourras tout changer dans ton profil.</p>
        <ProfileForm user={user} submitLabel="C'est parti →" />
      </div>
    </div>
  );
}

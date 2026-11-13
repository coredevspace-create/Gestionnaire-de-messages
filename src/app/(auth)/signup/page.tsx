import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell } from "@/components/AuthShell";
import { signup } from "@/app/actions";

export default function SignupPage() {
  return (
    <AuthShell
      title="Crée ton studio."
      subtitle="Ta première vidéo est offerte. Aucune carte bancaire."
      footer={<>Déjà inscrit ? <Link className="link" href="/login">Connecte-toi</Link></>}
    >
      <ActionForm action={signup} className="auth-fields">
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" />
        </label>
        <Submit className="btn-grad btn-lg">Créer mon compte</Submit>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          En créant un compte, tu acceptes les <Link className="link" href="/cgv">conditions générales</Link>.
        </p>
      </ActionForm>
    </AuthShell>
  );
}

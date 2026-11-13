import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell } from "@/components/AuthShell";
import { login } from "@/app/actions";

export default function LoginPage() {
  return (
    <AuthShell
      title="Bon retour."
      subtitle="Connecte-toi pour retrouver tes séries."
      footer={<>Pas encore de compte ? <Link className="link" href="/signup">Inscris-toi</Link></>}
    >
      <ActionForm action={login} className="auth-fields">
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <Submit className="btn-grad btn-lg">Se connecter</Submit>
      </ActionForm>
    </AuthShell>
  );
}

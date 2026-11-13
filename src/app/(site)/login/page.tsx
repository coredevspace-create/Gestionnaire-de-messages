import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { LogoMark } from "@/components/Logo";
import { login } from "@/app/actions";

export default function LoginPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card stack" style={{ padding: 28 }}>
        <LogoMark size={44} />
        <div>
          <h1 style={{ margin: 0 }}>Bon retour 👋</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Connecte-toi pour continuer tes séries.</p>
        </div>
        <ActionForm action={login} className="stack">
          <input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input name="password" type="password" placeholder="Mot de passe" required autoComplete="current-password" />
          <Submit>Se connecter</Submit>
        </ActionForm>
        <p className="muted" style={{ margin: 0 }}>
          Pas encore de compte ? <Link className="link" href="/signup">Crée-le gratuitement</Link>
        </p>
      </div>
    </div>
  );
}

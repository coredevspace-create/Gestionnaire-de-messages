import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { LogoMark } from "@/components/Logo";
import { config } from "@/lib/config";
import { signup } from "@/app/actions";

export default function SignupPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card stack" style={{ padding: 28 }}>
        <LogoMark size={44} />
        <div>
          <h1 style={{ margin: 0 }}>Crée ton studio</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            <span className="lime">{config.starterCredits} crédits offerts</span> · sans carte bancaire · prêt en 30 secondes
          </p>
        </div>
        <ActionForm action={signup} className="stack">
          <input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input name="password" type="password" placeholder="Mot de passe (8 caractères min.)" required minLength={8} autoComplete="new-password" />
          <Submit>Créer mon compte →</Submit>
        </ActionForm>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          En créant un compte, tu acceptes les <Link className="link" href="/cgv">conditions générales</Link>.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Déjà inscrit ? <Link className="link" href="/login">Connexion</Link>
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <div className="card" style={{ maxWidth: 380, margin: "40px auto" }}>
      <h1>Connexion</h1>
      <ActionForm action={login} className="stack">
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Mot de passe" required />
        <Submit>Se connecter</Submit>
      </ActionForm>
      <p className="muted">Pas de compte ? <Link href="/signup">Inscription</Link></p>
    </div>
  );
}

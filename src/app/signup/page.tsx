import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <div className="card" style={{ maxWidth: 380, margin: "40px auto" }}>
      <h1>Inscription</h1>
      <ActionForm action={signup} className="stack">
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Mot de passe (8 caractères min.)" required minLength={8} />
        <Submit>Créer mon compte</Submit>
      </ActionForm>
      <p className="muted">Déjà inscrit ? <Link href="/login">Connexion</Link></p>
    </div>
  );
}

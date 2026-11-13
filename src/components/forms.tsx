"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/actions";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && <p className="error">{state.error}</p>}
      {children}
    </form>
  );
}

export function Submit({ children, name, value, className }: { children: ReactNode; name?: string; value?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {pending ? (
        <>
          <span className="spinner sm" /> Chargement…
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Suivi de génération : rafraîchit la page toutes les `ms` tant que `active` est vrai,
 * et relance la génération via `tickUrl` si elle s'est arrêtée (filet de sécurité).
 */
export function AutoRefresh({ active, ms = 4000, tickUrl }: { active: boolean; ms?: number; tickUrl?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const t = setInterval(() => {
      router.refresh();
      if (tickUrl && n++ % 5 === 0) fetch(tickUrl, { method: "POST" }).catch(() => {});
    }, ms);
    return () => clearInterval(t);
  }, [active, ms, router, tickUrl]);
  return null;
}

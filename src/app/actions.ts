"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { changeCredits, db } from "@/lib/db";
import { createSession, destroySession, hashPassword, isAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { COUNTRIES } from "@/lib/catalog/countries";
import { createNextEpisode, createSeriesAndFirstVideo, retryVideo, UserError } from "@/lib/service";

export type FormState = { error?: string } | undefined;

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email invalide." };
  if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
  const d = db();
  if (d.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return { error: "Cet email est déjà utilisé." };
  const res = d.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, hashPassword(password));
  const id = Number(res.lastInsertRowid);
  if (config.starterCredits > 0) changeCredits(id, config.starterCredits, "Crédits de bienvenue");
  await createSession(id);
  redirect("/onboarding");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const row = db().prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email) as
    | { id: number; password_hash: string }
    | undefined;
  if (!row || !verifyPassword(str(fd, "password"), row.password_hash)) {
    return { error: "Email ou mot de passe incorrect." };
  }
  await createSession(row.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Onboarding unique (et modification du profil). */
export async function saveProfile(fd: FormData) {
  const user = await requireUser({ allowNotOnboarded: true });
  const country = str(fd, "country");
  const monetized = str(fd, "monetized") === "1" ? 1 : 0;
  db()
    .prepare("UPDATE users SET onboarded = 1, monetized = ?, country = ? WHERE id = ?")
    .run(monetized, COUNTRIES.some((c) => c.id === country) ? country : "ci", user.id);
  redirect("/");
}

export async function createVideo(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let id: number;
  try {
    id = createSeriesAndFirstVideo(user, {
      storyId: str(fd, "storyId") || undefined,
      pitch: str(fd, "pitch") || undefined,
      formatId: str(fd, "format") || undefined,
      episodes: Number(str(fd, "episodes")) || undefined,
      country: str(fd, "country") || undefined,
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect(`/videos/${id}`);
}

export async function nextEpisode(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let id: number;
  try {
    id = createNextEpisode(user, Number(str(fd, "seriesId")));
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect(`/videos/${id}`);
}

export async function retry(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let id: number;
  try {
    id = retryVideo(user, Number(str(fd, "videoId")));
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  redirect(`/videos/${id}`);
}

export async function adminGrantCredits(fd: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  const email = str(fd, "email").toLowerCase();
  const amount = Math.trunc(Number(str(fd, "amount")));
  const target = db().prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
  if (target && amount) changeCredits(target.id, amount, `Ajout admin par ${user.email}`);
  revalidatePath("/admin");
}

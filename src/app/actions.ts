"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { changeCredits, one, sql } from "@/lib/db";
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
  const row = await one<{ id: number }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id",
    [email, hashPassword(password)],
  );
  if (!row) return { error: "Cet email est déjà utilisé." };
  const id = row.id;
  if (config.starterCredits > 0) await changeCredits(id, config.starterCredits, "Crédits de bienvenue");
  await createSession(id);
  redirect("/onboarding");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const row = await one<{ id: number; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = $1", [email]);
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
  const monetized = str(fd, "monetized") === "1";
  await sql("UPDATE users SET onboarded = true, monetized = $1, country = $2 WHERE id = $3", [
    monetized,
    COUNTRIES.some((c) => c.id === country) ? country : "ci",
    user.id,
  ]);
  redirect("/");
}

export async function createVideo(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let id: number;
  try {
    id = await createSeriesAndFirstVideo(user, {
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
    id = await createNextEpisode(user, Number(str(fd, "seriesId")));
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
    id = await retryVideo(user, Number(str(fd, "videoId")));
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
  const target = await one<{ id: number }>("SELECT id FROM users WHERE email = $1", [email]);
  if (target && amount) await changeCredits(target.id, amount, `Ajout admin par ${user.email}`);
  revalidatePath("/admin");
}

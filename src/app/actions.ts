"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { changeCredits, one, sql } from "@/lib/db";
import { createSession, destroySession, hashPassword, isAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { COUNTRIES } from "@/lib/catalog/countries";
import { createNextEpisode, createSeriesAndFirstVideo, retryVideo, UserError } from "@/lib/service";
import { isMood } from "@/lib/music";
import { putMedia } from "@/lib/storage";
import { startPregen } from "@/lib/pregen";
import { kickPregen } from "@/lib/pipeline/kick";
import { checkoutPlan, checkoutTopup, portalUrl, stripeEnabled } from "@/lib/stripe";
import { isPlan, isTopup } from "@/lib/plans";

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
  redirect("/creer");
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
  redirect("/creer");
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
      music: fd.get("music") !== null,
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
  redirect(`/videos/${id}`);
}

export async function adminGrantCredits(fd: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  const email = str(fd, "email").toLowerCase();
  const amount = Math.trunc(Number(str(fd, "amount")));
  const target = await one<{ id: number }>("SELECT id FROM users WHERE email = $1", [email]);
  if (target && amount) await changeCredits(target.id, amount, `Ajout admin par ${user.email}`);
  revalidatePath("/admin", "layout");
}

/** Ajout d'une musique libre de droits à la bibliothèque (admin). */
export async function adminUploadMusic(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  const file = fd.get("file");
  const mood = str(fd, "mood");
  if (!(file instanceof File) || !file.size) return { error: "Choisis un fichier audio." };
  if (!isMood(mood)) return { error: "Ambiance invalide." };
  if (file.size > 4 * 1024 * 1024) return { error: "Fichier trop lourd (4 Mo max) : coupe ou compresse la musique (MP3 128 kbps)." };
  const ext = (file.name.match(/\.(mp3|m4a|aac|wav|ogg)$/i)?.[1] ?? "mp3").toLowerCase();
  const title = str(fd, "title") || file.name.replace(/\.[^.]+$/, "");
  const ref = await putMedia(`music/${mood}/${Date.now()}.${ext}`, Buffer.from(await file.arrayBuffer()));
  await sql("INSERT INTO music_tracks (mood, title, path) VALUES ($1, $2, $3)", [mood, title.slice(0, 120), ref]);
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function adminDeleteMusic(fd: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  await sql("DELETE FROM music_tracks WHERE id = $1", [Number(str(fd, "id"))]);
  revalidatePath("/admin", "layout");
}

/** Lance la création des portraits à l'avance, avec un plafond de dépense (admin). */
export async function adminStartPregen(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  const budget = Number(str(fd, "budget").replace(",", "."));
  const quality = ["low", "medium", "high"].includes(str(fd, "quality")) ? str(fd, "quality") : "medium";
  if (!(budget > 0 && budget <= 50)) return { error: "Budget entre 0,10 $ et 50 $." };
  const running = await one("SELECT id FROM bg_jobs WHERE kind = 'pregen' AND status = 'running'");
  if (running) return { error: "Une création est déjà en cours." };
  const id = await startPregen(budget, quality);
  await kickPregen(id);
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function adminStopPregen(fd: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  await sql("UPDATE bg_jobs SET status = 'stopped', error = 'Arrêté manuellement' WHERE id = $1 AND status = 'running'", [
    Number(str(fd, "id")),
  ]);
  revalidatePath("/admin", "layout");
}

// ---------------- Paiements ----------------

async function originUrl() {
  const { baseUrl } = await import("@/lib/pipeline/kick");
  return baseUrl();
}

export async function startCheckout(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!stripeEnabled()) return { error: "Le paiement n'est pas encore activé." };
  if (fd.get("cgv") === null) {
    return { error: "Coche la case pour accepter les conditions générales et l'accès immédiat au service." };
  }
  const item = str(fd, "item");
  const interval = str(fd, "interval") === "year" ? "year" : "month";
  let url: string;
  if (isPlan(item)) {
    if (user.plan && user.plan_status !== "canceled") {
      return { error: "Tu as déjà un abonnement : utilise « Gérer mon abonnement » pour le modifier." };
    }
    url = await checkoutPlan(user, item, interval, await originUrl());
  } else if (isTopup(item)) {
    url = await checkoutTopup(user, item, await originUrl());
  } else return { error: "Offre inconnue." };
  redirect(url);
}

export async function openPortal() {
  const user = await requireUser();
  if (!stripeEnabled()) redirect("/abonnement");
  redirect(await portalUrl(user, await originUrl()));
}

/** Met une vidéo en avant sur la page d'accueil (admin). */
export async function adminToggleShowcase(fd: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/creer");
  const id = Number(str(fd, "id"));
  await sql("UPDATE videos SET showcase = NOT showcase WHERE id = $1", [id]);
  revalidatePath(`/videos/${id}`);
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

import { COUNTRIES } from "./catalog/countries";
import { getOrCreateCharacter, ROLES, type RoleId } from "./catalog/characters";
import { one, sql, type Character } from "./db";
import { isMock } from "./config";
import { mediaExists } from "./storage";
import { costOf, emptyMetrics, withMetrics } from "./metrics";
import { makeSheet, sheetIsCurrent } from "./pipeline/runner";

/**
 * Création des portraits de personnages à l'avance, avec un plafond de dépense.
 * Ordre de priorité : pays les plus visés d'abord, puis rôles les plus utilisés par les histoires.
 */
const COUNTRY_PRIORITY = ["ci", "sn", "cm", "cd", "ml", "gn", "bf", "bj", "tg", "ga"];
const ROLE_PRIORITY: RoleId[] = ["fils", "papa", "maman", "fille", "coepouse", "bellemere", "voisin", "oncle"];
const STYLE = "fruits3d";

/** Liste ordonnée : tous les rôles du 1er pays, puis du 2e, etc. */
export function pregenOrder(): { country: string; role: RoleId }[] {
  const countries = [...COUNTRY_PRIORITY, ...COUNTRIES.map((c) => c.id).filter((c) => !COUNTRY_PRIORITY.includes(c))];
  return countries.flatMap((country) => ROLE_PRIORITY.filter((r) => r in ROLES).map((role) => ({ country, role })));
}

export type BgJob = {
  id: number;
  kind: string;
  status: "running" | "done" | "stopped" | "failed";
  budget: number;
  spent: number;
  done: number;
  total: number;
  options_json: string | null;
  error: string | null;
};

const BATCH = 4;
/** Coût estimé d'un portrait avant la première mesure réelle ($). */
const FIRST_GUESS: Record<string, number> = { low: 0.02, medium: 0.07, high: 0.2 };

export async function startPregen(budget: number, quality: string): Promise<number> {
  const row = await one<{ id: number }>(
    "INSERT INTO bg_jobs (kind, budget, total, options_json) VALUES ('pregen', $1, $2, $3) RETURNING id",
    [budget, pregenOrder().length, JSON.stringify({ quality })],
  );
  return row!.id;
}

/** Avance le travail pendant ~2 min. Renvoie "more" s'il faut relancer. */
export async function runPregen(jobId: number, budgetMs = 150_000): Promise<"done" | "more" | "busy"> {
  const job = await one<BgJob>(
    `UPDATE bg_jobs SET lease_until = now() + interval '290 seconds', updated_at = now()
     WHERE id = $1 AND status = 'running' AND (lease_until IS NULL OR lease_until < now()) RETURNING *`,
    [jobId],
  );
  if (!job) return "busy";
  const opts = JSON.parse(job.options_json || "{}") as { quality?: string; generated?: number };
  const quality = opts.quality || "medium";
  let generated = opts.generated ?? 0;
  const start = Date.now();
  let spent = job.spent;
  try {
    while (Date.now() - start < budgetMs) {
      // Prochains personnages sans portrait à jour.
      const todo: Character[] = [];
      let doneCount = 0;
      for (const { country, role } of pregenOrder()) {
        const c = await getOrCreateCharacter(country, STYLE, role);
        if (sheetIsCurrent(c) && (await mediaExists(c.sheet_path))) doneCount++;
        else if (todo.length < BATCH) todo.push(c);
      }
      await sql("UPDATE bg_jobs SET done = $2, updated_at = now() WHERE id = $1", [jobId, doneCount]);
      if (!todo.length) {
        await sql("UPDATE bg_jobs SET status = 'done' WHERE id = $1", [jobId]);
        return "done";
      }

      // Coût moyen par portrait observé jusque-là (ou estimation de départ).
      const perImage = isMock() ? 0 : generated > 0 && spent > 0 ? spent / generated : FIRST_GUESS[quality] ?? 0.07;
      const affordable = perImage > 0 ? Math.floor((job.budget - spent) / perImage) : todo.length;
      if (affordable <= 0) {
        await sql("UPDATE bg_jobs SET status = 'stopped', error = $2 WHERE id = $1", [
          jobId,
          `Budget atteint (${spent.toFixed(2)} $ / ${job.budget.toFixed(2)} $)`,
        ]);
        return "done";
      }
      const batch = todo.slice(0, Math.min(BATCH, affordable));

      const m = emptyMetrics();
      const results = await withMetrics(m, () =>
        Promise.allSettled(batch.map((c) => makeSheet(c, quality))),
      );
      spent += costOf(m).total;
      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      generated += batch.length - failed.length;
      await sql("UPDATE bg_jobs SET spent = $2, options_json = $3, updated_at = now() WHERE id = $1", [
        jobId,
        spent,
        JSON.stringify({ quality, generated }),
      ]);
      if (failed.length === batch.length) throw failed[0].reason;
    }
    return "more";
  } catch (e) {
    await sql("UPDATE bg_jobs SET status = 'failed', error = $2 WHERE id = $1", [
      jobId,
      e instanceof Error ? e.message.slice(0, 500) : String(e),
    ]);
    return "done";
  } finally {
    await sql("UPDATE bg_jobs SET lease_until = NULL WHERE id = $1", [jobId]);
  }
}

import { one, sql, type Character } from "@/lib/db";
import { getCountry } from "@/lib/catalog/countries";
import { fruitLabel } from "@/lib/catalog/characters";
import { pregenOrder, type BgJob } from "@/lib/pregen";
import { sheetIsCurrent } from "@/lib/pipeline/runner";
import { mediaUrl } from "@/lib/storage";
import { ActionForm, AutoRefresh, Submit } from "@/components/forms";
import { adminStartPregen, adminStopPregen } from "@/app/actions";

/** Création des portraits à l'avance + galerie pour vérifier les personnages (admin). */
export async function PregenAdmin() {
  const job = await one<BgJob>("SELECT * FROM bg_jobs WHERE kind = 'pregen' ORDER BY id DESC LIMIT 1");
  const chars = await sql<Character>("SELECT * FROM characters WHERE owner_id IS NULL ORDER BY country, id");
  const order = pregenOrder().map((o) => o.key);
  const rank = (c: Character) => (c.key && order.includes(c.key) ? order.indexOf(c.key) : 999);
  const ready = chars.filter(sheetIsCurrent).sort((a, b) => rank(a) - rank(b));
  const total = order.length;
  const running = job?.status === "running";

  return (
    <section className="card stack">
      <AutoRefresh active={running} ms={5000} tickUrl={running ? `/api/admin/pregen/${job!.id}/tick` : undefined} />
      <strong>
        Personnages prêts : {ready.length} / {total}
      </strong>
      <span className="muted">
        Chaque personnage n&apos;est dessiné qu&apos;une fois puis réutilisé par toutes les vidéos. Les créer d&apos;avance
        évite aux clients d&apos;attendre. Ordre : Côte d&apos;Ivoire, personnages des histoires Monde, Sénégal, Cameroun, RDC, puis le reste.
        Coût estimé par portrait : ~0,02 $ (low), ~0,07 $ (medium), ~0,20 $ (high).
      </span>
      {job && (
        <div className="row">
          <span>
            Dernière création : <b>{running ? "en cours…" : job.status === "done" ? "terminée" : job.status === "failed" ? "échec" : "arrêtée"}</b> ·
            dépensé {job.spent.toFixed(2)} $ / {job.budget.toFixed(2)} $
            {job.error ? ` · ${job.error}` : ""}
          </span>
          {running && (
            <form action={adminStopPregen}>
              <input type="hidden" name="id" value={job.id} />
              <button className="secondary">Arrêter</button>
            </form>
          )}
        </div>
      )}
      {!running && ready.length < total && (
        <ActionForm action={adminStartPregen} className="row">
          Budget max ($)
          <input name="budget" type="number" step="0.1" min="0.1" max="50" defaultValue="3" style={{ width: 90 }} />
          Qualité
          <select name="quality" defaultValue="medium">
            <option value="low">low (le plus de personnages)</option>
            <option value="medium">medium (recommandé)</option>
            <option value="high">high (le plus beau)</option>
          </select>
          <Submit>Créer les personnages d&apos;avance</Submit>
        </ActionForm>
      )}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
        {ready.map((c) => (
          <div key={c.id} className="stack" style={{ gap: 4 }}>
            <img className="preview" src={mediaUrl(c.sheet_path)!} alt={c.name} loading="lazy" />
            <span className="muted" style={{ fontSize: 12 }}>
              {getCountry(c.country).flag} {c.name} · {fruitLabel(c.fruit)} · {c.role}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

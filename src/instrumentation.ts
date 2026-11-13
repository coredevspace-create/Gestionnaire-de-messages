/** Au démarrage du serveur : reprend les vidéos interrompues (crash / redémarrage). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumePending } = await import("./lib/pipeline/runner");
    resumePending();
  }
}

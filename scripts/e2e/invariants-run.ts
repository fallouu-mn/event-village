/**
 * Lot 8 (contrat 15.5, L79, AR2) — invariants (a) à (t) de la recette, sur la base LOCALE du parcours, dans un processus
 * à part : jamais d'import du dépôt dans Playwright (alias @/ en CI, run 71). Lancé par e2e/support/parcours.ts :
 *
 *   EV_ENV_FILE=.env.e2e node --import tsx --import ./tests/helpers/env.ts scripts/e2e/invariants-run.ts <libellé>
 *
 * tests/helpers/env.ts installe les faux adaptateurs : une ligne due de la boîte d'envoi partirait ici dans le vide au lieu
 * d'aller aux faux services. La recette vide donc la boîte par la vraie route avant cet appel, et ce script rend le nombre
 * de lignes qu'il a trouvées dues, que la recette exige à 0. Ce passage précède assertRecetteInvariants, dont l'envoyeur
 * ne trouve alors plus rien.
 *
 * Sortie : journaux [INVARIANT-…], puis une dernière ligne JSON { label, reserved } ; code 1 sur violation. Jamais d'appel
 * pendant un paiement en cours : la chaîne purge les réservations et passe le cron de fin d'événement.
 */
import { dispatchPendingNotifications } from '../../tests/helpers/notification-invariants';
import { assertRecetteInvariants } from '../../tests/helpers/recette-invariants';

const TAG = '[invariants-run]';

async function main(): Promise<void> {
    const label = (process.argv[2] ?? '').trim();
    if (!/^[a-z0-9-]{1,60}$/.test(label)) throw new Error(`${TAG} libellé attendu en minuscules et tirets, reçu « ${label} »`);
    if (process.env.EV_TEST_GUARD !== '1') throw new Error(`${TAG} garde-fou de test non chargé : --import ./tests/helpers/env.ts obligatoire.`);
    const pending = await dispatchPendingNotifications();
    const reserved = pending.claimed + pending.reclaimed;
    await assertRecetteInvariants(label);
    process.stdout.write(`${JSON.stringify({ label, reserved })}\n`);
}

main().then(() => process.exit(0), (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
});

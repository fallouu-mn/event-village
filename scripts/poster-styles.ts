/**
 * Design 1d (point 1) — couleur et image floutée des affiches déjà citées par un événement (déposées avant le design 1d).
 * Procédure d'exploitation (compte de service), après la fusion et la migration 20261127000001 ; voir
 * docs/design-1d-rapport.md (migrations et contrôles prévus).
 *
 * Usage (variables d'environnement du projet visé chargées dans le shell, comme scripts/reencode-posters.ts) :
 *   npx tsx scripts/poster-styles.ts               à blanc : liste ce qui sera fait (avec la couleur), rien n'est écrit
 *   npx tsx scripts/poster-styles.ts --appliquer   calcule et enregistre le style ; chaque événement qui cite l'affiche
 *                                                  le prend (une écriture par événement, seulement s'il change)
 * 100 fichiers au plus par passage : relancer tant que « restants » n'est pas 0. Rejouable : un passage de plus ne
 * retrouve que les fichiers absents ou illisibles, signalés ; l’écran garde pour eux le « bleu nuit ».
 */
import { backfillPosterStyles } from '../lib/events/poster-styles-backfill';

async function main(): Promise<void> {
    const apply = process.argv.includes('--appliquer');
    const report = await backfillPosterStyles({ apply });
    console.log(apply ? 'Couleur des affiches existantes' : 'À blanc : rien n’est écrit (ajoutez --appliquer pour enregistrer)');
    console.log(`Affiches sans couleur citées par un événement : ${report.candidates}`);
    for (const p of report.planned) console.log(`  serait enregistrée : ${p.path} → ${p.color} (événements : ${p.events.join(', ')})`);
    for (const d of report.done) console.log(`  enregistrée : ${d.path} → ${d.color} (${d.events} événement(s) mis à jour)`);
    for (const s of report.skipped) console.log(`  laissée telle quelle : ${s.path} (${s.reason} ; événements : ${s.events.join(', ')})`);
    console.log(`Restants pour un passage suivant : ${report.remaining}`);
}

main().catch((err: unknown) => {
    console.error('Couleur des affiches interrompue :', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
});
